
import nodemailer from 'nodemailer';
import { storage } from "../storage";
import { Invoice } from "@shared/schema";
import fs from "fs";
import path from "path";
import { nfseProvider } from "../providers/NfseNationalProvider";
import { InterProvider } from "../providers/InterProvider";
import axios from "axios";

interface SendEmailResult {
  success: boolean;
  message: string;
}

export class EmailService {
  private transporter = nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: 'simpledfe@simpleit.com.br',
      pass: '@@S1mpl3DF3@2026',
    },
    // tls: {
    //   ciphers: 'SSLv3',
    // },
  });

  private getMonthName(month: number): string {
    const months = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return months[month - 1] || "";
  }

  async sendInvoiceEmail(invoiceId: string): Promise<SendEmailResult> {
    try {
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        throw new Error("Invoice not found");
      }

      const receipt = await storage.getReceipt(invoice.receiptId);
      if (!receipt) {
        throw new Error("Receipt not found");
      }

      let billingEmails: string | undefined;
      let clientName: string = "Cliente";
      let responsibleContact: string | undefined;
      let serviceCatalogId: string | undefined;
      let dayDue: number | undefined;
      let isSimpleDFe = false;
      let systemName = "";

      // Resolve source (Contract, Project, SystemContract) to get billingEmails
      if (receipt.contractId) {
        const contract = await storage.getContract(receipt.contractId);
        if (contract) {
          billingEmails = contract.billingEmails;
          dayDue = contract.dayDue;
          systemName = contract.description || "Contrato";
          // If no billing emails, try to get client email
          if (!billingEmails && contract.clientId) {
             const client = await storage.getClient(contract.clientId);
             if (client) {
                 billingEmails = client.email;
                 clientName = client.name;
             }
          }
        }
      } else if (receipt.projectId) {
        const project = await storage.getProject(receipt.projectId);
        if (project) {
          billingEmails = project.billingEmails;
          responsibleContact = project.responsibleContact || undefined;
          serviceCatalogId = project.serviceCatalogId || undefined;
          dayDue = project.dayDue || undefined;
          systemName = project.name;

          // Always try to resolve Client/Partner Name
          if (project.clientId) {
               const client = await storage.getClient(project.clientId);
               if (client) {
                   clientName = client.name;
                   // Fallback email if not set in project
                   if (!billingEmails) billingEmails = client.email;
               }
          } else if (project.partnerId) {
               const partner = await storage.getPartner(project.partnerId);
               if (partner) {
                   clientName = partner.name;
                   // Fallback email if not set in project
                   if (!billingEmails) billingEmails = partner.email;
               }
          }
        }
      } else if (receipt.systemContractId) {
        isSimpleDFe = true;
        const sysContract = await storage.getSystemContract(receipt.systemContractId);
        if (sysContract) {
          billingEmails = sysContract.billingEmails;
          responsibleContact = sysContract.responsibleContact || undefined;
          serviceCatalogId = sysContract.serviceCatalogId || undefined;
          dayDue = sysContract.dayDue || undefined;
          systemName = sysContract.systemName;
          
          // Always try to resolve client name from linked client
          if (sysContract.clientId) {
              const client = await storage.getClient(sysContract.clientId);
              if (client) {
                  clientName = client.name;
                  if (!billingEmails) billingEmails = client.email;
              }
          }
          
          // Fallback to name matching if clientName is still default or no billing emails
          if ((clientName === "Cliente" || !billingEmails) && sysContract.clientName) {
               const clients = await storage.getClients();
               const client = clients.find(c => c.name === sysContract.clientName);
               if (client) {
                   if (clientName === "Cliente") clientName = client.name;
                   if (!billingEmails) billingEmails = client.email;
               }
          }
        }
      }

      if (!billingEmails) {
        return { success: false, message: "Nenhum email de cobrança encontrado para este contrato/projeto." };
      }

      const emails = billingEmails.split(',').map(e => e.trim()).filter(e => e);
      
      console.log(`[EmailService] Enviando email da Nota Fiscal ${invoice.number || invoice.id}`);
      console.log(`[EmailService] Para: ${emails.join(', ')}`);

      const monthName = this.getMonthName(receipt.refMonth);
      const year = receipt.refYear;
      
      // Calculate Previous Month for Description (Competência)
      let descMonth = receipt.refMonth - 1;
      let descYear = receipt.refYear;
      if (descMonth < 1) {
          descMonth = 12;
          descYear--;
      }
      const descMonthName = this.getMonthName(descMonth);
      const refText = `${descMonthName}/${descYear}`;
      
      const greetingName = responsibleContact || clientName || "Cliente";

      // Calculate Description
      let descriptionText = `serviços prestados no mês de ${refText}`; // Default

      if (serviceCatalogId) {
          const catalogItem = await storage.getServiceCatalogItem(serviceCatalogId);
          if (catalogItem && catalogItem.description) {
              let customDesc = catalogItem.description;
              
              // Replace [mês/ano]
              customDesc = customDesc.replace(/\[mês\/ano\]/gi, refText);
              
              // Replace [data_vencimento]
              if (dayDue) {
                   // User update: "Vencimento é no mesmo mês de referencia" (Receipt reference)
                   let dueMonth = receipt.refMonth; 
                   let dueYear = receipt.refYear;
                   
                   // Handle invalid days (e.g. Feb 30)
                   const lastDayOfMonth = new Date(dueYear, dueMonth, 0).getDate();
                   const dueDay = Math.min(dayDue, lastDayOfMonth);
                   
                   const dueDateStr = `${dueDay.toString().padStart(2, '0')}/${dueMonth.toString().padStart(2, '0')}/${dueYear}`;
                   customDesc = customDesc.replace(/\[data_vencimento\]/gi, dueDateStr);
              } else {
                   customDesc = customDesc.replace(/\[data_vencimento\]/gi, "__/__/____");
              }
              
              descriptionText = customDesc;
          }
      }

      // Logo paths
      const assetsDir = path.join(process.cwd(), "server", "assets");
      const logoSimpleITPath = path.join(assetsDir, "logo_simpleit.png");
      const logoSimpleDFePath = path.join(assetsDir, "logo_simpledfe.png");

      // Prepare Filename Parts
      let fileSubject = systemName;
      if (isSimpleDFe || systemName === 'SimpleDFe' || systemName === 'SimpleDFE') {
          fileSubject = "Captura de Notas Ficais SimpleDFe";
      } else if (!fileSubject) {
          fileSubject = "Serviços";
      }
      
      // Sanitize filename parts
      const sanitizeFilename = (s: string) => s.replace(/[^a-zA-Z0-9À-ÿ \-\.]/g, "").trim();
      const safeClientName = sanitizeFilename(clientName);
      const safeSubject = sanitizeFilename(fileSubject);
      
      const fileSuffix = `${descMonthName} ${descYear} - ${safeClientName}`;

      const attachments: any[] = [];
      let logoHtml = "";
      
      // Add SimpleIT Logo (Always)
      if (fs.existsSync(logoSimpleITPath)) {
          attachments.push({
              filename: 'logo_simpleit.png',
              path: logoSimpleITPath,
              cid: 'logo_simpleit'
          });
          logoHtml += `<img src="cid:logo_simpleit" alt="SimpleIT" style="height: 50px; margin-right: 20px;">`;
      } else {
          logoHtml += `<h2 style="color: #333; display: inline-block; margin-right: 20px;">SimpleIT</h2>`;
      }

      // Add SimpleDFe Logo (Always, as requested)
      if (fs.existsSync(logoSimpleDFePath)) {
          attachments.push({
              filename: 'logo_simpledfe.png',
              path: logoSimpleDFePath,
              cid: 'logo_simpledfe'
          });
          logoHtml += `<img src="cid:logo_simpledfe" alt="SimpleDFe" style="height: 50px;">`;
      } else {
           logoHtml += `<h2 style="color: #6366f1; display: inline-block;">SimpleDFe</h2>`;
      }

      // Validation flags
      let hasXml = false;
      let hasDanfse = false;
      let hasBoleto = false;
      const requiresBoleto = !!receipt.boletoSolicitacaoId;

      // Helper function for retries
      const fetchWithRetry = async <T>(operation: () => Promise<T>, attempts: number = 3, delay: number = 2000): Promise<T> => {
          let lastError: any;
          for (let i = 0; i < attempts; i++) {
              try {
                  return await operation();
              } catch (error) {
                  lastError = error;
                  if (i < attempts - 1) {
                      await new Promise(resolve => setTimeout(resolve, delay));
                  }
              }
          }
          throw lastError;
      };

      // Fetch NFS-e Attachments (XML and DANFSE)
      const nfseEmissao = await storage.getNfseEmissaoByInvoiceId(invoiceId);
      if (nfseEmissao) {
          // 1. Fetch XML
          try {
              const xml = await fetchWithRetry(() => nfseProvider.downloadXml(nfseEmissao.id), 5, 3000);
              if (xml) {
                  attachments.push({
                      filename: `XML - ${safeSubject} - ${fileSuffix}.xml`,
                      content: xml,
                      contentType: 'application/xml'
                  });
                  hasXml = true;
              }
          } catch (e) {
              console.error(`[EmailService] Erro ao buscar XML para anexo da invoice ${invoiceId}:`, e);
          }

          // 2. Fetch DANFSE PDF
          if (nfseEmissao.chaveAcesso) {
              try {
                  const buffer = await fetchWithRetry(() => nfseProvider.getDanfsePdf(nfseEmissao.chaveAcesso!, invoice.companyId), 5, 3000);
                  attachments.push({
                      filename: `NF - ${safeSubject} - ${fileSuffix}.pdf`,
                      content: buffer,
                      contentType: 'application/pdf'
                  });
                  hasDanfse = true;
              } catch (e: any) {
                  console.error(`[EmailService] Erro ao buscar PDF DANFSE para anexo da invoice ${invoiceId}:`, e.message);
              }
          }
      }

      // Fetch Boleto PDF
      if (invoice.boletoSolicitacaoId && invoice.boletoStatus === 'ISSUED') {
          try {
              // Try to get company from invoice, fallback to receipt logic
              let companyId = invoice.companyId;
              if (!companyId) {
                  // Resolve from receipt again if not in invoice
                  if (receipt.projectId) {
                      const p = await storage.getProject(receipt.projectId);
                      companyId = p?.companyId;
                  } else if (receipt.contractId) {
                      const c = await storage.getContract(receipt.contractId);
                      companyId = c?.companyId;
                  } else if (receipt.systemContractId) {
                      const sc = await storage.getSystemContract(receipt.systemContractId);
                      companyId = sc?.companyId;
                  }
              }

              if (companyId) {
                  const company = await storage.getCompany(companyId);
                  if (company && company.interClientId && company.interClientSecret && company.interCertPath) {
                      const interProvider = new InterProvider({
                          environment: company.interEnvironment || "sandbox",
                          clientId: company.interClientId,
                          clientSecret: company.interClientSecret,
                          certPath: company.interCertPath,
                          keyPath: company.interKeyPath || undefined
                      });
                      const pdfBase64 = await interProvider.getPdf(invoice.boletoSolicitacaoId);
                      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
                      attachments.push({
                          filename: `BOLETO - ${safeSubject} - ${fileSuffix}.pdf`,
                          content: pdfBuffer,
                          contentType: 'application/pdf'
                      });
                      hasBoleto = true;
                  } else {
                      console.warn(`[EmailService] Configuração do Banco Inter incompleta para empresa ${companyId}. Boleto da Invoice não anexado.`);
                  }
              }
          } catch (e: any) {
               console.error(`[EmailService] Erro ao buscar PDF Boleto da Invoice para anexo:`, e.message);
          }
      } else if (requiresBoleto) {
          // Fallback to Receipt Boleto
          try {
              const company = await storage.getCompany(invoice.companyId);
              if (company && company.interClientId && company.interClientSecret && company.interCertPath) {
                  const interProvider = new InterProvider({
                      environment: company.interEnvironment || "sandbox",
                      clientId: company.interClientId,
                      clientSecret: company.interClientSecret,
                      certPath: company.interCertPath,
                      keyPath: company.interKeyPath || undefined
                  });
                  const pdfBase64 = await interProvider.getPdf(receipt.boletoSolicitacaoId);
                  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
                  attachments.push({
                      filename: `BOLETO - ${safeSubject} - ${fileSuffix}.pdf`,
                      content: pdfBuffer,
                      contentType: 'application/pdf'
                  });
                  hasBoleto = true;
              } else {
                  console.warn(`[EmailService] Configuração do Banco Inter incompleta para empresa ${invoice.companyId}. Boleto não anexado.`);
              }
          } catch (e: any) {
              console.error(`[EmailService] Erro ao buscar PDF Boleto para anexo da invoice ${invoiceId}:`, e.message);
          }
      }

      // Validate required attachments
      const missingAttachments: string[] = [];
      if (!hasXml) missingAttachments.push("XML");
      if (!hasDanfse) missingAttachments.push("Nota Fiscal (PDF)");
      if (requiresBoleto && !hasBoleto && !invoice.boletoSolicitacaoId) missingAttachments.push("Boleto");

      if (missingAttachments.length > 0) {
          const msg = `Envio cancelado. Falha ao obter anexos obrigatórios: ${missingAttachments.join(", ")}.`;
          console.error(`[EmailService] ${msg}`);
          return { success: false, message: msg };
      }

      // Format description text: replace *** with line breaks and bold
      const formattedDescription = descriptionText.replace(/\*\*\*/g, '<br>');

      const htmlContent = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
            <div style="padding: 20px 0; border-bottom: 2px solid #f3f4f6;">
                ${logoHtml}
            </div>
            
            <div style="padding: 30px 0;">
                <p style="font-size: 16px; margin-bottom: 20px;">Olá <strong>${greetingName}</strong>,</p>
                
                <p style="font-size: 16px; margin-bottom: 20px;">
                    Este email é referente aos serviços prestados à empresa <strong>${clientName}</strong>.
                </p>

                <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 15px; margin: 25px 0; border-radius: 4px;">
                    <p style="font-size: 15px; color: #4b5563; margin-top: 0; margin-bottom: 10px; font-weight: 600;">
                        Detalhes do Faturamento:
                    </p>
                    <p style="font-size: 16px; margin: 0; white-space: pre-line;">
                        ${formattedDescription}
                    </p>
                </div>

                <p style="font-size: 16px; margin-bottom: 10px;">
                    Segue em anexo a <strong>Nota Fiscal de Serviços</strong>.
                </p>
                
                <p style="font-size: 16px; color: #666;">
                    O boleto bancário e o arquivo XML também constam nos anexos deste email.
                </p>
                
                <br>
                
                <p style="font-size: 16px;">
                    Caso tenha qualquer dúvida ou necessite de mais informações, estamos à disposição.
                </p>
            </div>
            
            <div style="padding: 20px 0; border-top: 1px solid #eee; font-size: 14px; color: #666; background-color: #f9fafb; padding: 15px; border-radius: 4px;">
                <p style="margin: 0; font-weight: bold;">Atenciosamente,</p>
                <p style="margin: 5px 0 0 0;">Equipe SimpleIT</p>
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">Soluções em Tecnologia</p>
            </div>
        </div>
      `;

      const mailOptions = {
        from: '"Simple DFE" <simpledfe@simpleit.com.br>',
        to: emails.join(', '),
        subject: `Nota Fiscal de Serviços - ${clientName} - Ref: ${refText}`,
        text: `Olá ${greetingName},\n\nSegue em anexo a nota fiscal referente aos ${descriptionText}.\n\nAtenciosamente,\nEquipe SimpleIT`,
        html: htmlContent,
        attachments: attachments
      };

      await this.transporter.sendMail(mailOptions);

      // Update invoice status
      await storage.updateInvoice(invoiceId, { 
        emailStatus: 'SENT', 
        emailSentAt: new Date() 
      });

      return { success: true, message: `Email enviado com sucesso para: ${emails.join(', ')}` };

    } catch (error: any) {
      console.error("[EmailService] Erro ao enviar email:", error);
      return { success: false, message: error.message || "Erro interno ao enviar email" };
    }
  }
}

export const emailService = new EmailService();
