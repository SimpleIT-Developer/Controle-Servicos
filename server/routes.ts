import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import https from "https";
import session from "express-session";
import bcrypt from "bcrypt";
import axios from "axios";
import { storage } from "./storage";
import { pixProvider } from "./providers/MockPixProvider";
import { nfProvider } from "./providers/MockNfProvider";
import { nfseProvider } from "./providers/NfseNationalProvider";
import { emailService } from "./services/emailService";
import { InterProvider } from "./providers/InterProvider";
import { 
  companies, 
  receipts, 
  projects, 
  contracts, 
  systemContracts, 
  clients, 
  partners, 
  nfseEmissoes 
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { loginSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure Multer for Certificate Uploads (Memory Storage for DB saving)
const storageMulter = multer.memoryStorage();

const upload = multer({ storage: storageMulter });

// Configure Multer for Certificate Uploads (Disk Storage)
const certStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(process.cwd(), "server", "certs");
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadCert = multer({ storage: certStorage });

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  next();
};

async function seedAdminUser() {
  const existingAdmin = await storage.getUserByEmail("admin@admin.com");
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("Admin@123", 10);
    await storage.createUser({
      name: "Administrador",
      email: "admin@admin.com",
      passwordHash,
      role: "admin",
    });
    console.log("Admin user created: admin@admin.com / Admin@123");
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "controle-servicos-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  await seedAdminUser();

  // CEP Lookup
  app.get("/api/cep/:cep", async (req, res) => {
    const cep = req.params.cep.replace(/\D/g, "");
    if (cep.length !== 8) {
      return res.status(400).json({ error: "CEP inválido" });
    }

    try {
      // 1. OpenCEP (Primary)
      try {
        const response = await axios.get(`https://opencep.com/v1/${cep}`, { timeout: 3000 });
        if (response.data && !response.data.error) {
           return res.json({
             street: response.data.logradouro,
             neighborhood: response.data.bairro,
             city: response.data.localidade,
             state: response.data.uf,
             ibge: response.data.ibge,
             zipCode: response.data.cep
           });
        }
      } catch (e) {
        // console.log("OpenCEP failed, trying ViaCEP...");
      }

      // 2. ViaCEP (Fallback)
      try {
        const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`, { timeout: 3000 });
        if (response.data && !response.data.erro) {
           return res.json({
             street: response.data.logradouro,
             neighborhood: response.data.bairro,
             city: response.data.localidade,
             state: response.data.uf,
             ibge: response.data.ibge,
             zipCode: response.data.cep
           });
        }
      } catch (e) {
         // console.log("ViaCEP failed, trying BrasilAPI...");
      }

      // 3. BrasilAPI (Last Resort)
      try {
        const response = await axios.get(`https://brasilapi.com.br/api/cep/v2/${cep}`, { timeout: 3000 });
        if (response.data) {
           return res.json({
             street: response.data.street,
             neighborhood: response.data.neighborhood,
             city: response.data.city,
             state: response.data.state,
             ibge: null, 
             zipCode: response.data.cep
           });
        }
      } catch (e) {
        // console.log("BrasilAPI failed.");
      }

      return res.status(404).json({ error: "CEP não encontrado" });
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      res.status(500).json({ error: "Erro interno ao buscar CEP" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ error: "Email ou senha inválidos" });
      }
      const validPassword = await bcrypt.compare(data.password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: "Email ou senha inválidos" });
      }
      req.session.userId = user.id;
      res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos" });
      }
      console.error("Login error:", error);
      res.status(500).json({ error: "Erro interno" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "Usuário não encontrado" });
    }
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });

  // --- Boleto Inter Endpoints ---

  app.post("/api/receipts/:id/boleto", requireAuth, async (req, res) => {
    try {
      const receiptId = req.params.id;
      
      // 1. Fetch Receipt
      const receipt = await storage.getReceipt(receiptId);
      if (!receipt) {
        return res.status(404).json({ error: "Recibo não encontrado" });
      }

      // 2. Determine Company and Payer
      let companyId: string | undefined;
      let payer: any = null; // Client or Partner
      let payerType: "FISICA" | "JURIDICA" = "JURIDICA";
      let systemName: string | undefined;

      // Helper to format strings
      const cleanDigits = (s: string) => s.replace(/\D/g, "");

      if (receipt.projectId) {
        const project = await storage.getProject(receipt.projectId);
        if (!project) return res.status(404).json({ error: "Projeto não encontrado" });
        companyId = project.companyId;
        
        if (project.clientType === 'partner' && project.partnerId) {
          payer = await storage.getPartner(project.partnerId);
        } else if (project.clientId) {
          payer = await storage.getClient(project.clientId);
        }
      } else if (receipt.contractId) {
        const contract = await storage.getContract(receipt.contractId);
        if (!contract) return res.status(404).json({ error: "Contrato não encontrado" });
        companyId = contract.companyId;
        payer = await storage.getClient(contract.clientId);
      } else if (receipt.systemContractId) {
        const sysContract = await storage.getSystemContract(receipt.systemContractId);
        if (!sysContract) return res.status(404).json({ error: "Contrato de Sistema não encontrado" });
        companyId = sysContract.companyId || undefined; // Handle nullable
        systemName = sysContract.systemName;
        if (sysContract.clientId) {
          payer = await storage.getClient(sysContract.clientId);
        }
      }

      if (!companyId) {
        return res.status(400).json({ error: "Empresa não vinculada a este recibo" });
      }

      if (!payer) {
        return res.status(400).json({ error: "Pagador (Cliente/Parceiro) não encontrado" });
      }

      // 3. Get Company Config for Inter
      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ error: "Empresa não encontrada" });

      if (!company.interClientId || !company.interClientSecret || !company.interCertPath) {
        return res.status(400).json({ error: "Configuração do Boleto Inter incompleta para esta empresa" });
      }

      // 4. Prepare Boleto Data
      const payerDoc = cleanDigits(payer.doc || payer.cnpj || "");
      payerType = payerDoc.length > 11 ? "JURIDICA" : "FISICA";
      
      const boletoData: any = {
        seuNumero: receipt.id.substring(0, 15), // Max 15 chars
        valorNominal: Number(receipt.totalDue),
        // dataVencimento set below
        numDiasAgenda: 30,
        pagador: {
          cpfCnpj: payerDoc,
          tipoPessoa: payerType,
          nome: payer.name.substring(0, 100),
          endereco: payer.street?.substring(0, 90) || payer.address?.substring(0, 90) || "Endereço não informado",
          numero: payer.number || "S/N",
          complemento: payer.complement || "",
          bairro: payer.neighborhood || "Centro",
          cidade: payer.city || "Cidade",
          uf: payer.state || "MG",
          cep: cleanDigits(payer.zipCode || "00000000"),
          email: payer.email || "",
          ddd: payer.phone ? cleanDigits(payer.phone).substring(0, 2) : "",
          telefone: payer.phone ? cleanDigits(payer.phone).substring(2) : ""
        },
        multa: {
            taxa: 2,
            codigo: "PERCENTUAL"
        },
        mora: {
            taxa: 1,
            codigo: "TAXAMENSAL"
        },
        mensagem: {
          linha1: (systemName === 'SimpleDFe' || systemName === 'SimpleDFE') 
              ? "Mensalidade Sistema de Captura de NFe/ NFSe / CTe - SimpleDFe" 
              : `Referente a serviços de ${receipt.refMonth}/${receipt.refYear}`,
          linha2: "",
          linha3: "",
          linha4: "",
          linha5: ""
        },
        beneficiarioFinal: {
          cpfCnpj: cleanDigits(company.doc),
          tipoPessoa: cleanDigits(company.doc).length > 11 ? "JURIDICA" : "FISICA",
          nome: company.name,
          endereco: company.address || "Endereço da Empresa",
          numero: "S/N",
          complemento: "",
          bairro: "Centro",
          cidade: company.city || "Cidade",
          uf: company.state || "UF",
          cep: cleanDigits(company.zipCode || "00000000")
        },
        formasRecebimento: ["BOLETO", "PIX"]
      };

      // Refine Due Date
      let dayDue = 10; // Default
      if (receipt.projectId) {
        const p = await storage.getProject(receipt.projectId);
        // Check if projects table has dayDue (schema snippet showed line 101 as dayDue)
        // If typescript complains, we cast or check schema. Shared schema line 101 says dayDue: integer("day_due")
        if ((p as any).dayDue) dayDue = (p as any).dayDue;
      } else if (receipt.contractId) {
        const c = await storage.getContract(receipt.contractId);
        if (c?.dayDue) dayDue = c.dayDue;
      } else if (receipt.systemContractId) {
        const sc = await storage.getSystemContract(receipt.systemContractId);
        if (sc?.dayDue) dayDue = sc.dayDue;
      }

      // Calculate Due Date:
      // "o Vencimento me desculpe, mas é no mesmo mês de referencia"
      const year = receipt.refYear;
      const month = receipt.refMonth;
      // Format YYYY-MM-DD directly to avoid timezone issues
      boletoData.dataVencimento = `${year}-${String(month).padStart(2, '0')}-${String(dayDue).padStart(2, '0')}`;

      // Add Nota Fiscal Info if available
      const invoices = await storage.getInvoicesByReceiptId(receipt.id);
      const issuedInvoice = invoices.find(inv => inv.status === 'EMITIDA');
      
      if (issuedInvoice) {
        const nfseEmissao = await storage.getNfseEmissaoByInvoiceId(issuedInvoice.id);
        if (nfseEmissao && nfseEmissao.chaveAcesso && nfseEmissao.numero) {
           // Inter API requires exactly 44 digits for chaveNFe. 
           // NFS-e Nacional keys are 50 digits. If we have a mismatch, we skip sending the NF link to avoid error.
           const cleanKey = nfseEmissao.chaveAcesso.replace(/\D/g, '');
           
           if (cleanKey.length === 44) {
               const nfseConfig = await storage.getNfseConfig(companyId);
               
               boletoData.notaFiscal = {
                 chaveNFe: cleanKey,
                 numero: parseInt(nfseEmissao.numero.replace(/\D/g, '')) || 0,
                 serie: nfseConfig?.serieNfse ? parseInt(nfseConfig.serieNfse.replace(/\D/g, '')) : 900,
                 dataEmissao: nfseEmissao.createdAt.toISOString().split('T')[0],
                 parcela: 1,
                 naturezaOperacao: "Venda" 
               };
           } else {
               console.warn(`[Boleto Inter] Skipping Nota Fiscal link: Chave has ${cleanKey.length} digits (expected 44). Key: ${cleanKey}`);
           }
        }
      }
      
      // 5. Call Inter Provider
      const inter = new InterProvider({
        environment: company.interEnvironment || "sandbox",
        clientId: company.interClientId,
        clientSecret: company.interClientSecret,
        certPath: company.interCertPath,
        keyPath: company.interKeyPath || undefined
      });

      try {
        const result = await inter.issueBoleto(boletoData);

        // 6. Update Receipt
        await storage.updateReceipt(receipt.id, {
          boletoSolicitacaoId: result.codigoSolicitacao,
          boletoStatus: "ISSUED",
          status: "BOLETO_EMITIDO"
        });

        res.json({ success: true, codigoSolicitacao: result.codigoSolicitacao });
      } catch (boletoError: any) {
        console.error("Erro detalhado Boleto Inter:", boletoError);
        
        // Log to System Logs as requested
        await storage.createSystemLog({
           level: "ERROR",
           category: "BOLETO_INTER",
           message: `Erro ao emitir boleto para Recibo ${receipt.id}`,
           details: JSON.stringify({
               payload_enviado: boletoData,
               erro_retorno: boletoError.message || "Erro desconhecido",
               stack: boletoError.stack
           }),
           correlationId: receipt.id
        });
        
        throw boletoError;
      }

    } catch (error: any) {
      console.error("Erro ao emitir boleto:", error);
      res.status(500).json({ error: error.message || "Erro ao emitir boleto" });
    }
  });

  app.get("/api/receipts/:id/boleto/pdf", requireAuth, async (req, res) => {
    try {
      const receiptId = req.params.id;
      const receipt = await storage.getReceipt(receiptId);
      
      if (!receipt || !receipt.boletoSolicitacaoId) {
        return res.status(404).json({ error: "Boleto não encontrado para este recibo" });
      }

      // Need company to configure provider
      let companyId: string | undefined;
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

      if (!companyId) return res.status(404).json({ error: "Empresa não encontrada" });
      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ error: "Empresa não encontrada" });

      const inter = new InterProvider({
        environment: company.interEnvironment || "sandbox",
        clientId: company.interClientId!, 
        clientSecret: company.interClientSecret!,
        certPath: company.interCertPath!,
        keyPath: company.interKeyPath || undefined
      });

      const pdfBase64 = await inter.getPdf(receipt.boletoSolicitacaoId);
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=boleto-${receipt.boletoSolicitacaoId}.pdf`);
      res.send(pdfBuffer);

    } catch (error: any) {
      console.error("Erro ao obter PDF do boleto:", error);
      res.status(500).json({ error: "Erro ao obter PDF" });
    }
  });

  // Cancelar Boleto (Liberar para nova emissão)
  app.post("/api/receipts/:id/boleto/cancel", requireAuth, async (req, res) => {
    try {
      const receiptId = req.params.id;
      const receipt = await storage.getReceipt(receiptId);

      if (!receipt) {
        return res.status(404).json({ error: "Recibo não encontrado" });
      }

      // Se boletoStatus não for ISSUED, nem precisa cancelar
      if (receipt.boletoStatus !== 'ISSUED') {
         return res.status(400).json({ error: "Este recibo não possui boleto emitido para cancelar." });
      }

      // Tenta cancelar no Banco Inter (Opcional, mas recomendado se possível)
      // Por enquanto, como o usuário pediu "apenas liberar", vamos focar em limpar o status no banco.
      // Se quiséssemos cancelar no Inter, precisaríamos chamar inter.cancelBoleto(...) se a API suportasse e tivéssemos o motivo.
      
      // Determinar novo status do Recibo
      // Se estava como BOLETO_EMITIDO, volta para o anterior.
      // Se já tem NF emitida, fica NF_EMITIDA. Se tem NF gerada, NF_GERADA. Senão closed ou draft.
      
      let newStatus = receipt.status;
      if (receipt.status === 'BOLETO_EMITIDO') {
         if (receipt.isInvoiceIssued) newStatus = 'NF_EMITIDA';
         else if (receipt.isInvoiceGenerated) newStatus = 'NF_GERADA';
         else newStatus = 'closed'; // Assumindo que estava fechado antes de emitir boleto
      }

      await storage.updateReceipt(receiptId, {
        boletoStatus: 'CANCELLED', // Marca como cancelado no histórico (ou poderia ser NULL para limpar totalmente)
        // boletoSolicitacaoId: null, // Se limparmos, perde o histórico. Melhor manter id mas com status CANCELLED?
        // Mas se mantivermos boletoSolicitacaoId, o getPdf pode tentar baixar boleto cancelado.
        // O ideal para "liberar para novo" é permitir que a UI emita outro.
        // A UI verifica boletoStatus === 'ISSUED'. Se for CANCELLED, libera botão.
        status: newStatus
      });

      res.json({ success: true, message: "Boleto cancelado/liberado com sucesso" });

    } catch (error: any) {
      console.error("Erro ao cancelar boleto:", error);
      res.status(500).json({ error: "Erro ao cancelar boleto" });
    }
  });

  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const [projects, systemContracts, companies, clients] = await Promise.all([
        storage.getProjects(),
        storage.getSystemContracts(),
        storage.getCompanies(),
        storage.getClients(),
      ]);

      const activeProjects = projects.filter((p) => p.active);
      const activeSystems = systemContracts.filter((s) => s.active);

      res.json({
        activeProjects: activeProjects.length,
        activeSystems: activeSystems.length,
        totalCompanies: companies.length,
        totalClients: clients.length,
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  app.get("/api/dashboard/revenue-chart", requireAuth, async (req, res) => {
    try {
      const [receipts, companies, projects, contracts, systemContracts] = await Promise.all([
        storage.getReceipts(),
        storage.getCompanies(),
        storage.getProjects(),
        storage.getContracts(),
        storage.getSystemContracts(),
      ]);

      // Map to find company name easily
      const companyMap = new Map(companies.map(c => [c.id, c.name]));
      
      // Helper to find company ID from receipt
      const getCompanyId = (receipt: any) => {
        if (receipt.projectId) {
          const project = projects.find(p => p.id === receipt.projectId);
          return project?.companyId;
        }
        if (receipt.contractId) {
          const contract = contracts.find(c => c.id === receipt.contractId);
          return contract?.companyId;
        }
        if (receipt.systemContractId) {
          const sysContract = systemContracts.find(s => s.id === receipt.systemContractId);
          return sysContract?.companyId;
        }
        return null;
      };

      // Aggregate data
      // Structure: { "YYYY-MM": { "Company A": 100, "Company B": 200, "Total": 300, date: DateObj } }
      const aggregation: Record<string, any> = {};

      // User requested to include all receipts regardless of status (even drafts)
      // to reflect "expected billing" or simply "what is in receipts"
      // Filter only to ensure it has an amount
      const validReceipts = receipts.filter(r => Number(r.amount) > 0);

      validReceipts.forEach(receipt => {
        const companyId = getCompanyId(receipt);
        if (!companyId) return;
        
        const companyName = companyMap.get(companyId) || "Desconhecida";
        const key = `${receipt.refYear}-${String(receipt.refMonth).padStart(2, '0')}`;
        
        if (!aggregation[key]) {
          aggregation[key] = {
            name: `${receipt.refMonth}/${receipt.refYear}`,
            Total: 0,
            dateVal: new Date(receipt.refYear, receipt.refMonth - 1, 1).getTime() // For sorting
          };
        }
        
        const amount = Number(receipt.amount || 0);
        
        aggregation[key][companyName] = (aggregation[key][companyName] || 0) + amount;
        aggregation[key].Total += amount;
      });

      // Convert to array and sort
      const chartData = Object.values(aggregation).sort((a, b) => a.dateVal - b.dateVal);
      
      // Limit to last 12 months maybe? Or return all.
      // Let's return all for now, frontend can slice.
      
      res.json(chartData);

    } catch (error) {
      console.error("Dashboard chart error:", error);
      res.status(500).json({ error: "Erro ao buscar dados do gráfico" });
    }
  });

  // Companies (Empresas)
  app.get("/api/companies", requireAuth, async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Get companies error:", error);
      res.status(500).json({ error: "Erro ao buscar empresas" });
    }
  });

  app.post("/api/companies", requireAuth, async (req, res) => {
    try {
      const company = await storage.createCompany(req.body);
      res.status(201).json(company);
    } catch (error) {
      console.error("Create company error:", error);
      res.status(500).json({ error: "Erro ao criar empresa" });
    }
  });

  app.patch("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      const company = await storage.updateCompany(req.params.id, req.body);
      if (!company) return res.status(404).json({ error: "Empresa não encontrada" });
      res.json(company);
    } catch (error) {
      console.error("Update company error:", error);
      res.status(500).json({ error: "Erro ao atualizar empresa" });
    }
  });

  app.delete("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteCompany(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete company error:", error);
      res.status(500).json({ error: "Erro ao excluir empresa" });
    }
  });

  app.post("/api/companies/:id/certs", requireAuth, uploadCert.fields([{ name: 'cert', maxCount: 1 }, { name: 'key', maxCount: 1 }]), async (req, res) => {
    try {
      const companyId = req.params.id;
      // @ts-ignore
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const updateData: any = {};

      if (files['cert'] && files['cert'][0]) {
        updateData.interCertPath = files['cert'][0].path;
      }
      if (files['key'] && files['key'][0]) {
        updateData.interKeyPath = files['key'][0].path;
      }

      if (Object.keys(updateData).length > 0) {
        const company = await storage.updateCompany(companyId, updateData);
        res.json({ success: true, company });
      } else {
        res.json({ success: true, message: "Nenhum arquivo enviado" });
      }
    } catch (error) {
      console.error("Upload cert error:", error);
      res.status(500).json({ error: "Erro ao fazer upload dos certificados" });
    }
  });

  // Clients (Clientes)
  app.get("/api/clients", requireAuth, async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      console.error("Get clients error:", error);
      res.status(500).json({ error: "Erro ao buscar clientes" });
    }
  });

  app.post("/api/clients", requireAuth, async (req, res) => {
    try {
      const client = await storage.createClient(req.body);
      res.status(201).json(client);
    } catch (error) {
      console.error("Create client error:", error);
      res.status(500).json({ error: "Erro ao criar cliente" });
    }
  });

  app.patch("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const client = await storage.updateClient(req.params.id, req.body);
      if (!client) return res.status(404).json({ error: "Cliente não encontrado" });
      res.json(client);
    } catch (error) {
      console.error("Update client error:", error);
      res.status(500).json({ error: "Erro ao atualizar cliente" });
    }
  });

  app.delete("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteClient(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete client error:", error);
      res.status(500).json({ error: "Erro ao excluir cliente" });
    }
  });

  // Analysts (Analistas)
  app.get("/api/analysts", requireAuth, async (req, res) => {
    try {
      const analysts = await storage.getAnalysts();
      res.json(analysts);
    } catch (error) {
      console.error("Get analysts error:", error);
      res.status(500).json({ error: "Erro ao buscar analistas" });
    }
  });

  app.post("/api/analysts", requireAuth, async (req, res) => {
    try {
      const analyst = await storage.createAnalyst(req.body);
      res.status(201).json(analyst);
    } catch (error) {
      console.error("Create analyst error:", error);
      res.status(500).json({ error: "Erro ao criar analista" });
    }
  });

  app.patch("/api/analysts/:id", requireAuth, async (req, res) => {
    try {
      const analyst = await storage.updateAnalyst(req.params.id, req.body);
      if (!analyst) return res.status(404).json({ error: "Analista não encontrado" });
      res.json(analyst);
    } catch (error) {
      console.error("Update analyst error:", error);
      res.status(500).json({ error: "Erro ao atualizar analista" });
    }
  });

  app.delete("/api/analysts/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteAnalyst(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete analyst error:", error);
      res.status(500).json({ error: "Erro ao excluir analista" });
    }
  });

  // Partners (Parcerias)
  app.get("/api/partners", requireAuth, async (req, res) => {
    try {
      const partners = await storage.getPartners();
      res.json(partners);
    } catch (error) {
      console.error("Get partners error:", error);
      res.status(500).json({ error: "Erro ao buscar parcerias" });
    }
  });

  app.post("/api/partners", requireAuth, async (req, res) => {
    try {
      const partner = await storage.createPartner(req.body);
      res.status(201).json(partner);
    } catch (error) {
      console.error("Create partner error:", error);
      res.status(500).json({ error: "Erro ao criar parceria" });
    }
  });

  app.patch("/api/partners/:id", requireAuth, async (req, res) => {
    try {
      const partner = await storage.updatePartner(req.params.id, req.body);
      if (!partner) return res.status(404).json({ error: "Parceria não encontrada" });
      res.json(partner);
    } catch (error) {
      console.error("Update partner error:", error);
      res.status(500).json({ error: "Erro ao atualizar parceria" });
    }
  });

  app.delete("/api/partners/:id", requireAuth, async (req, res) => {
    try {
      await storage.deletePartner(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete partner error:", error);
      res.status(500).json({ error: "Erro ao excluir parceria" });
    }
  });

  // System Contracts
  app.get("/api/system-contracts", requireAuth, async (req, res) => {
    try {
      const contracts = await storage.getSystemContracts();
      res.json(contracts);
    } catch (error) {
      console.error("Get system contracts error:", error);
      res.status(500).json({ error: "Erro ao buscar contratos de sistema" });
    }
  });

  app.get("/api/system-contracts/:id", requireAuth, async (req, res) => {
    try {
      const contract = await storage.getSystemContract(req.params.id);
      if (!contract) return res.status(404).json({ error: "Contrato não encontrado" });
      res.json(contract);
    } catch (error) {
      console.error("Get system contract error:", error);
      res.status(500).json({ error: "Erro ao buscar contrato de sistema" });
    }
  });

  app.post("/api/system-contracts", requireAuth, async (req, res) => {
    try {
      console.log("[SystemContracts] Creating with body:", req.body);
      
      // Sync active state based on status if provided
      if (req.body.status) {
        req.body.active = req.body.status === 'ATIVO';
      } else {
        // Default to ATIVO if not provided
        req.body.status = 'ATIVO';
        req.body.active = true;
      }

      const contract = await storage.createSystemContract(req.body);
      res.status(201).json(contract);
    } catch (error) {
      console.error("Create system contract error:", error);
      res.status(500).json({ error: "Erro ao criar contrato de sistema" });
    }
  });

  app.patch("/api/system-contracts/:id", requireAuth, async (req, res) => {
    try {
      console.log(`[SystemContracts] Updating ${req.params.id} with body:`, req.body);
      
      // Sync active state based on status if provided
      if (req.body.status) {
        req.body.active = req.body.status === 'ATIVO';
      }

      const contract = await storage.updateSystemContract(req.params.id, req.body);
      if (!contract) return res.status(404).json({ error: "Contrato não encontrado" });
      res.json(contract);
    } catch (error) {
      console.error("Update system contract error:", error);
      res.status(500).json({ error: "Erro ao atualizar contrato de sistema" });
    }
  });

  app.delete("/api/system-contracts/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteSystemContract(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete system contract error:", error);
      res.status(500).json({ error: "Erro ao excluir contrato de sistema" });
    }
  });

  // Projects
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Get projects error:", error);
      res.status(500).json({ error: "Erro ao buscar projetos" });
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ error: "Projeto não encontrado" });
      res.json(project);
    } catch (error) {
      console.error("Get project error:", error);
      res.status(500).json({ error: "Erro ao buscar projeto" });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      // Sync active state based on status if provided
      if (req.body.status) {
        const isAtivo = req.body.status === 'ATIVO';
        req.body.active = isAtivo;
        
        // If not active, disable billing
        if (!isAtivo) {
          req.body.isBillable = false;
        }
      } else {
        // Default to ATIVO if not provided
        req.body.status = 'ATIVO';
        req.body.active = true;
      }

      const project = await storage.createProject(req.body);
      res.status(201).json(project);
    } catch (error) {
      console.error("Create project error:", error);
      res.status(500).json({ error: "Erro ao criar projeto" });
    }
  });

  app.patch("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      // Sync active state based on status if provided
      if (req.body.status) {
        const isAtivo = req.body.status === 'ATIVO';
        req.body.active = isAtivo;
        
        // If not active, disable billing
        if (!isAtivo) {
          req.body.isBillable = false;
        }
      }

      const project = await storage.updateProject(req.params.id, req.body);
      if (!project) return res.status(404).json({ error: "Projeto não encontrado" });
      res.json(project);
    } catch (error) {
      console.error("Update project error:", error);
      res.status(500).json({ error: "Erro ao atualizar projeto" });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteProject(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete project error:", error);
      res.status(500).json({ error: "Erro ao excluir projeto" });
    }
  });

  // Project Analysts
  app.get("/api/projects/:id/analysts", requireAuth, async (req, res) => {
    try {
      const analysts = await storage.getProjectAnalysts(req.params.id);
      res.json(analysts);
    } catch (error) {
      console.error("Get project analysts error:", error);
      res.status(500).json({ error: "Erro ao buscar analistas do projeto" });
    }
  });

  app.post("/api/project-analysts", requireAuth, async (req, res) => {
    try {
      const relation = await storage.addProjectAnalyst(req.body);
      res.status(201).json(relation);
    } catch (error) {
      console.error("Add project analyst error:", error);
      res.status(500).json({ error: "Erro ao vincular analista ao projeto" });
    }
  });

  app.patch("/api/project-analysts/:id", requireAuth, async (req, res) => {
    try {
      const relation = await storage.updateProjectAnalyst(req.params.id, req.body);
      if (!relation) return res.status(404).json({ error: "Vínculo não encontrado" });
      res.json(relation);
    } catch (error) {
      console.error("Update project analyst error:", error);
      res.status(500).json({ error: "Erro ao atualizar analista do projeto" });
    }
  });

  app.delete("/api/project-analysts/:id", requireAuth, async (req, res) => {
    try {
      await storage.removeProjectAnalyst(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Remove project analyst error:", error);
      res.status(500).json({ error: "Erro ao remover analista do projeto" });
    }
  });

  // Partners
  app.get("/api/partners", requireAuth, async (req, res) => {
    try {
      const partners = await storage.getPartners();
      res.json(partners);
    } catch (error) {
      console.error("Get partners error:", error);
      res.status(500).json({ error: "Erro ao buscar parcerias" });
    }
  });

  app.post("/api/partners", requireAuth, async (req, res) => {
    try {
      const partner = await storage.createPartner(req.body);
      res.status(201).json(partner);
    } catch (error) {
      console.error("Create partner error:", error);
      res.status(500).json({ error: "Erro ao criar parceria" });
    }
  });

  app.patch("/api/partners/:id", requireAuth, async (req, res) => {
    try {
      const partner = await storage.updatePartner(req.params.id, req.body);
      if (!partner) return res.status(404).json({ error: "Parceria não encontrada" });
      res.json(partner);
    } catch (error) {
      console.error("Update partner error:", error);
      res.status(500).json({ error: "Erro ao atualizar parceria" });
    }
  });

  app.delete("/api/partners/:id", requireAuth, async (req, res) => {
    try {
      await storage.deletePartner(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete partner error:", error);
      res.status(500).json({ error: "Erro ao excluir parceria" });
    }
  });

  // Service Catalog (Serviços)
  app.get("/api/service-catalog", requireAuth, async (req, res) => {
    try {
      const catalog = await storage.getServiceCatalog();
      res.json(catalog);
    } catch (error) {
      console.error("Get service catalog error:", error);
      res.status(500).json({ error: "Erro ao buscar catálogo de serviços" });
    }
  });

  app.post("/api/service-catalog", requireAuth, async (req, res) => {
    try {
      const item = await storage.createServiceCatalogItem(req.body);
      res.status(201).json(item);
    } catch (error) {
      console.error("Create service catalog item error:", error);
      res.status(500).json({ error: "Erro ao criar serviço" });
    }
  });

  app.patch("/api/service-catalog/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.updateServiceCatalogItem(req.params.id, req.body);
      if (!item) return res.status(404).json({ error: "Serviço não encontrado" });
      res.json(item);
    } catch (error) {
      console.error("Update service catalog item error:", error);
      res.status(500).json({ error: "Erro ao atualizar serviço" });
    }
  });

  app.delete("/api/service-catalog/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteServiceCatalogItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete service catalog item error:", error);
      res.status(500).json({ error: "Erro ao excluir serviço" });
    }
  });

  // Contracts
  app.get("/api/contracts", requireAuth, async (req, res) => {
    try {
      const contracts = await storage.getContracts();
      res.json(contracts);
    } catch (error) {
      console.error("Get contracts error:", error);
      res.status(500).json({ error: "Erro ao buscar contratos" });
    }
  });

  app.post("/api/contracts", requireAuth, async (req, res) => {
    try {
      const contract = await storage.createContract(req.body);
      res.status(201).json(contract);
    } catch (error) {
      console.error("Create contract error:", error);
      res.status(500).json({ error: "Erro ao criar contrato" });
    }
  });

  app.get("/api/contracts/:id", requireAuth, async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) return res.status(404).json({ error: "Contrato não encontrado" });
      res.json(contract);
    } catch (error) {
      console.error("Get contract error:", error);
      res.status(500).json({ error: "Erro ao buscar contrato" });
    }
  });

  app.patch("/api/contracts/:id", requireAuth, async (req, res) => {
    try {
      const contract = await storage.updateContract(req.params.id, req.body);
      if (!contract) return res.status(404).json({ error: "Contrato não encontrado" });
      res.json(contract);
    } catch (error) {
      console.error("Update contract error:", error);
      res.status(500).json({ error: "Erro ao atualizar contrato" });
    }
  });

  app.delete("/api/contracts/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteContract(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete contract error:", error);
      res.status(500).json({ error: "Erro ao excluir contrato" });
    }
  });

  // Contract Items
  app.get("/api/contracts/:id/items", requireAuth, async (req, res) => {
    try {
      const items = await storage.getContractItems(req.params.id);
      res.json(items);
    } catch (error) {
      console.error("Get contract items error:", error);
      res.status(500).json({ error: "Erro ao buscar itens do contrato" });
    }
  });

  app.post("/api/contracts/:id/items", requireAuth, async (req, res) => {
    try {
      const item = await storage.createContractItem({ ...req.body, contractId: req.params.id });
      res.status(201).json(item);
    } catch (error) {
      console.error("Create contract item error:", error);
      res.status(500).json({ error: "Erro ao criar item do contrato" });
    }
  });

  app.delete("/api/contract-items/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteContractItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete contract item error:", error);
      res.status(500).json({ error: "Erro ao excluir item do contrato" });
    }
  });

  // Services (Contract Items) - Mapped to match frontend expectations
  app.get("/api/contracts/:id/services/:year/:month", requireAuth, async (req, res) => {
    try {
      const items = await storage.getContractItemsByRef(
        req.params.id, 
        parseInt(req.params.year), 
        parseInt(req.params.month)
      );
      res.json(items);
    } catch (error) {
      console.error("Get contract services error:", error);
      res.status(500).json({ error: "Erro ao buscar serviços do contrato" });
    }
  });

  app.post("/api/services", requireAuth, async (req, res) => {
    try {
      const item = await storage.createContractItem(req.body);
      res.status(201).json(item);
    } catch (error) {
      console.error("Create service error:", error);
      res.status(500).json({ error: "Erro ao criar serviço" });
    }
  });

  app.patch("/api/services/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.updateContractItem(req.params.id, req.body);
      if (!item) return res.status(404).json({ error: "Serviço não encontrado" });
      res.json(item);
    } catch (error) {
      console.error("Update service error:", error);
      res.status(500).json({ error: "Erro ao atualizar serviço" });
    }
  });

  app.delete("/api/services/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteContractItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete service error:", error);
      res.status(500).json({ error: "Erro ao excluir serviço" });
    }
  });

  // Receipts
  app.get("/api/receipts", requireAuth, async (req, res) => {
    try {
      const { year, month } = req.query;
      let receipts;
      
      if (year && month) {
        receipts = await storage.getReceiptsByRef(Number(year), Number(month));
      } else {
        receipts = await storage.getReceipts();
      }
      
      // Calculate costs and company name for each receipt
      const enrichedReceipts = await Promise.all(receipts.map(async (receipt) => {
        let totalCost = 0;
        let companyName = "";
        
        if (receipt.projectId) {
          const project = await storage.getProject(receipt.projectId);
          if (project) {
            const company = await storage.getCompany(project.companyId);
            companyName = company?.name || "";
          }

          const timesheetEntries = await storage.getTimesheetEntries(receipt.id);
          const processedFixed = new Set<string>();
          
          totalCost = timesheetEntries.reduce((sum, entry) => {
            if (entry.analystPaymentType === "fixed") {
              const personId = entry.analystId || entry.partnerId;
              // Only add fixed cost once per person per receipt
              if (personId && !processedFixed.has(personId)) {
                processedFixed.add(personId);
                return sum + Number(entry.costRate || 0);
              }
              return sum;
            } else {
              return sum + (Number(entry.hours) * Number(entry.costRate || 0));
            }
          }, 0);
        } else if (receipt.contractId) {
          const contract = await storage.getContract(receipt.contractId);
          if (contract) {
             const company = await storage.getCompany(contract.companyId);
             companyName = company?.name || "";
          }
        } else if (receipt.systemContractId) {
           // For system contracts, company name is stored directly
           const systemContract = await storage.getSystemContract(receipt.systemContractId);
           companyName = systemContract?.companyName || "";
        }
        
        return {
          ...receipt,
          totalCost: totalCost.toString(),
          companyName
        };
      }));
      
      res.json(enrichedReceipts);
    } catch (error) {
      console.error("Get receipts error:", error);
      res.status(500).json({ error: "Erro ao buscar recibos" });
    }
  });

  app.post("/api/receipts", requireAuth, async (req, res) => {
    try {
      const receipt = await storage.createReceipt(req.body);
      res.status(201).json(receipt);
    } catch (error) {
      console.error("Create receipt error:", error);
      res.status(500).json({ error: "Erro ao criar recibo" });
    }
  });

  app.get("/api/receipts/:id", requireAuth, async (req, res) => {
    try {
      const receipt = await storage.getReceipt(req.params.id);
      if (!receipt) return res.status(404).json({ error: "Recibo não encontrado" });
      res.json(receipt);
    } catch (error) {
      console.error("Get receipt error:", error);
      res.status(500).json({ error: "Erro ao buscar recibo" });
    }
  });

  app.patch("/api/receipts/:id", requireAuth, async (req, res) => {
    try {
      const receipt = await storage.updateReceipt(req.params.id, req.body);
      if (!receipt) return res.status(404).json({ error: "Recibo não encontrado" });
      res.json(receipt);
    } catch (error) {
      console.error("Update receipt error:", error);
      res.status(500).json({ error: "Erro ao atualizar recibo" });
    }
  });

  app.post("/api/receipts/generate", requireAuth, async (req, res) => {
    try {
      const { year, month } = req.body;
      if (!year || !month) return res.status(400).json({ error: "Ano e mês são obrigatórios" });

      const contracts = await storage.getContracts();
      const activeContracts = contracts.filter(c => c.status === "active");
      let count = 0;

      // Generate for Contracts
      for (const contract of activeContracts) {
        // Calculate services amount
        const services = await storage.getContractItemsByRef(contract.id, year, month);
        const servicesAmount = services
          .filter(s => s.chargedTo === "CLIENT")
          .reduce((sum, s) => sum + Number(s.amount), 0);
        
        const totalDue = Number(contract.amount) + servicesAmount;

        const existing = await storage.getReceiptByContractAndRef(contract.id, year, month);
        
        if (existing) {
          if (existing.status === "draft") {
             await storage.updateReceipt(existing.id, {
               amount: contract.amount,
               servicesAmount: servicesAmount.toString(),
               totalDue: totalDue.toString()
             });
          }
        } else {
          await storage.createReceipt({
            contractId: contract.id,
            refYear: year,
            refMonth: month,
            amount: contract.amount,
            servicesAmount: servicesAmount.toString(),
            totalDue: totalDue.toString(),
            status: "draft"
          });
          count++;
        }
      }

      // Generate for Active Billable Projects
      const projects = await storage.getProjects();
      const activeProjects = projects.filter(p => p.active && p.isBillable);

      for (const project of activeProjects) {
        const existing = await storage.getReceiptByProjectAndRef(project.id, year, month);

        if (!existing) {
          await storage.createReceipt({
            projectId: project.id,
            refYear: year,
            refMonth: month,
            amount: "0", // Will be calculated based on hours
            servicesAmount: "0",
            totalDue: "0",
            status: "draft"
          });
          count++;
        }
      }

      // Generate for Active System Contracts
      const systemContracts = await storage.getSystemContracts();
      const activeSystemContracts = systemContracts.filter(sc => sc.active);

      for (const systemContract of activeSystemContracts) {
        const existing = await storage.getReceiptBySystemContractAndRef(systemContract.id, year, month);

        if (!existing) {
          await storage.createReceipt({
            systemContractId: systemContract.id,
            refYear: year,
            refMonth: month,
            amount: systemContract.monthlyValue,
            servicesAmount: "0",
            totalDue: systemContract.monthlyValue,
            status: "draft"
          });
          count++;
        }
      }
      
      res.json({ success: true, count });
    } catch (error) {
      console.error("Generate receipts error:", error);
      res.status(500).json({ error: "Erro ao gerar recibos" });
    }
  });

  app.post("/api/receipts/recalculate", requireAuth, async (req, res) => {
    try {
      const { year, month } = req.body;
      if (!year || !month) return res.status(400).json({ error: "Ano e mês são obrigatórios" });

      const receipts = await storage.getReceiptsByRef(Number(year), Number(month));
      let updatedCount = 0;

      for (const receipt of receipts) {
        // Only process project receipts
        if (!receipt.projectId) continue;

        const project = await storage.getProject(receipt.projectId);
        if (!project) continue;

        const timesheets = await storage.getTimesheetEntries(receipt.id);
        const analysts = await storage.getProjectAnalysts(project.id);
        const partners = await storage.getProjectPartners(project.id);
        let hasChanges = false;

        for (const entry of timesheets) {
            let newCostRate = entry.costRate;
            let newBillableRate = entry.billableRate;
            let newAnalystPaymentType = entry.analystPaymentType;
            
            if (entry.analystId) {
                const relation = analysts.find(a => a.analystId === entry.analystId);
                if (relation) {
                    // Update payment type from analyst record
                    newAnalystPaymentType = relation.analyst.paymentType;
                    
                    // Logic for Cost Rate (Pagar)
                    // 1. Try project-specific cost rate
                    let cost = relation.costRate?.toString();
                    
                    // 2. If fixed payment and no project cost, try analyst fixed value
                    if ((!cost || cost === "0") && relation.analyst.paymentType === "fixed") {
                        cost = relation.analyst.fixedValue?.toString();
                    }
                    
                    newCostRate = cost || "0";

                    // Logic for Billable Rate (Receber)
                    // 1. Try project-specific hourly rate
                    const relationRate = relation.hourlyRate?.toString();
                    newBillableRate = relationRate && relationRate !== "0" 
                      ? relationRate 
                      : (project.hourlyRate?.toString() || "0");
                }
            } else if (entry.partnerId) {
                const relation = partners.find(p => p.partnerId === entry.partnerId);
                if (relation) {
                    // Update payment type logic for partners (assuming fixed/hourly from relation)
                    if (relation.valueType === "fixed") {
                        newAnalystPaymentType = "fixed";
                        newCostRate = relation.value?.toString() || "0";
                    } else {
                        newAnalystPaymentType = "hour";
                        newCostRate = relation.value?.toString() || "0";
                    }
                }
            }

            if (newCostRate !== entry.costRate || 
                newBillableRate !== entry.billableRate || 
                newAnalystPaymentType !== entry.analystPaymentType) {
                
                await storage.updateTimesheetEntry(entry.id, {
                    costRate: newCostRate,
                    billableRate: newBillableRate,
                    analystPaymentType: newAnalystPaymentType
                });
                hasChanges = true;
            }
        }
        
        // Recalculate receipt totals
        await recalculateReceiptTotal(receipt.id);
        updatedCount++;
      }

      res.json({ success: true, updatedCount });
    } catch (error) {
      console.error("Recalculate receipts error:", error);
      res.status(500).json({ error: "Erro ao recalcular recibos" });
    }
  });

  app.post("/api/receipts/:id/close", requireAuth, async (req, res) => {
    try {
      const receipt = await storage.getReceipt(req.params.id);
      if (!receipt) return res.status(404).json({ error: "Recibo não encontrado" });

      if (receipt.status !== "draft") {
        return res.status(400).json({ error: "Recibo já está fechado ou pago" });
      }

      const updated = await storage.updateReceipt(receipt.id, { status: "closed" });
      res.json(updated);
    } catch (error) {
      console.error("Close receipt error:", error);
      res.status(500).json({ error: "Erro ao fechar recibo" });
    }
  });

  app.post("/api/receipts/:id/mark-paid", requireAuth, async (req, res) => {
    try {
      const receipt = await storage.getReceipt(req.params.id);
      if (!receipt) return res.status(404).json({ error: "Recibo não encontrado" });

      if (receipt.status === "paid" || receipt.status === "transferred") {
        return res.status(400).json({ error: "Recibo já está pago" });
      }

      // 1. Update receipt status
      const updated = await storage.updateReceipt(receipt.id, { status: "paid" });

      // 2. Create cash transaction (Receita)
      await storage.createCashTransaction({
        type: "IN",
        date: new Date().toISOString().split("T")[0], // Today
        category: "Receita de Contratos",
        description: `Recebimento Ref. ${receipt.refMonth}/${receipt.refYear}`,
        amount: receipt.totalDue,
        receiptId: receipt.id
      });

      res.json(updated);
    } catch (error) {
      console.error("Mark paid receipt error:", error);
      res.status(500).json({ error: "Erro ao marcar recibo como pago" });
    }
  });

  app.post("/api/receipts/:id/reverse-payment", requireAuth, async (req, res) => {
    try {
      const receipt = await storage.getReceipt(req.params.id);
      if (!receipt) return res.status(404).json({ error: "Recibo não encontrado" });

      if (receipt.status !== "paid" && receipt.status !== "transferred") {
        return res.status(400).json({ error: "Recibo não está pago" });
      }

      // 1. Update receipt status back to closed
      const updated = await storage.updateReceipt(receipt.id, { status: "closed" });

      // 2. Remove cash transaction
      await storage.deleteCashTransactionByReceiptAndType(receipt.id, "IN");

      res.json(updated);
    } catch (error) {
      console.error("Reverse payment receipt error:", error);
      res.status(500).json({ error: "Erro ao estornar pagamento" });
    }
  });

  app.delete("/api/receipts/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteReceipt(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete receipt error:", error);
      res.status(500).json({ error: "Erro ao excluir recibo" });
    }
  });

  // Timesheets
  async function recalculateReceiptTotal(receiptId: string) {
    const receipt = await storage.getReceipt(receiptId);
    if (!receipt) return;
    
    // Only recalculate for projects
    if (!receipt.projectId) return;
    
    const timesheets = await storage.getTimesheetEntries(receiptId);
    
    // Sum billable amount (Hours * BillableRate)
    const hoursAmount = timesheets.reduce((sum, t) => sum + (Number(t.hours) * Number(t.billableRate)), 0);
    
    // Update receipt
    const totalDue = hoursAmount + Number(receipt.servicesAmount);
    
    await storage.updateReceipt(receiptId, {
      amount: hoursAmount.toString(),
      totalDue: totalDue.toString()
    });
  }

  app.get("/api/receipts/:id/timesheets", requireAuth, async (req, res) => {
    try {
      const entries = await storage.getTimesheetEntries(req.params.id);
      res.json(entries);
    } catch (error) {
      console.error("Get timesheets error:", error);
      res.status(500).json({ error: "Erro ao buscar apontamentos" });
    }
  });

  app.post("/api/timesheets", requireAuth, async (req, res) => {
    try {
      console.log("[POST /api/timesheets] Body:", req.body);
      const { receiptId, analystId, partnerId, analystPaymentType } = req.body;
      let { costRate, billableRate } = req.body;

      // Auto-fetch rates if not provided
      if (!costRate || !billableRate || billableRate === "0") {
        console.log("[POST /api/timesheets] Auto-fetching rates...");
        const receipt = await storage.getReceipt(receiptId);
        if (receipt && receipt.projectId) {
          const project = await storage.getProject(receipt.projectId);
          
          if (project) {
            let rateFromRelation = "0";

            if (analystId) {
              const analysts = await storage.getProjectAnalysts(project.id);
              console.log(`[POST /api/timesheets] Found ${analysts.length} analysts for project ${project.id}`);
              const relation = analysts.find(a => a.analystId === analystId);
              console.log("[POST /api/timesheets] Relation found:", relation);
              rateFromRelation = relation?.hourlyRate?.toString() || "0";
              console.log("[POST /api/timesheets] Rate from relation:", rateFromRelation);
            } else if (partnerId) {
              const partners = await storage.getProjectPartners(project.id);
              const relation = partners.find(p => p.partnerId === partnerId);
              // Only apply hourly rate if the agreement is hourly
              if (relation?.valueType === "hour") {
                rateFromRelation = relation.value?.toString() || "0";
              }
            }

            // Default billable rate from relation (analyst rate) or project
            if (!billableRate || billableRate === "0") {
              billableRate = rateFromRelation !== "0" ? rateFromRelation : (project.hourlyRate?.toString() || "0");
              console.log("[POST /api/timesheets] Final billableRate:", billableRate);
            }

            // Cost rate not needed as per requirement, setting to 0 if not provided
            if (!costRate) {
              costRate = "0";
            }
          }
        }
      }

      const entry = await storage.createTimesheetEntry({
        ...req.body,
        costRate: costRate?.toString() || "0",
        billableRate: billableRate?.toString() || "0",
        analystPaymentType: analystPaymentType || "hour"
      });
      
      await recalculateReceiptTotal(entry.receiptId);
      res.status(201).json(entry);
    } catch (error) {
      console.error("Create timesheet error:", error);
      res.status(500).json({ error: "Erro ao criar apontamento" });
    }
  });

  app.patch("/api/timesheets/:id", requireAuth, async (req, res) => {
    try {
      const { analystId, partnerId, analystPaymentType } = req.body;
      let { costRate, billableRate } = req.body;
      
      // Get existing entry to check for changes and get context
      const existingEntry = await storage.getTimesheetEntry(req.params.id);
      if (!existingEntry) {
        return res.status(404).json({ error: "Apontamento não encontrado" });
      }

      // If changing person and rates are not provided, auto-fetch them
      if ((analystId || partnerId) && (!costRate || !billableRate || billableRate === "0")) {
        const receipt = await storage.getReceipt(existingEntry.receiptId);
        if (receipt && receipt.projectId) {
          const project = await storage.getProject(receipt.projectId);
          
          if (project) {
            let billableRateFromRelation = "0";
            let costRateFromRelation = "0";
            
            const targetAnalystId = analystId || existingEntry.analystId;
            const targetPartnerId = partnerId || existingEntry.partnerId;

            // If switching to analyst (or updating analyst)
            if (analystId || (targetAnalystId && !partnerId)) {
               const analysts = await storage.getProjectAnalysts(project.id);
               const relation = analysts.find(a => a.analystId === targetAnalystId);
               billableRateFromRelation = relation?.hourlyRate?.toString() || "0";
               costRateFromRelation = relation?.costRate?.toString() || "0";
            } 
            // If switching to partner (or updating partner)
            else if (partnerId || (targetPartnerId && !analystId)) {
              const partners = await storage.getProjectPartners(project.id);
              const relation = partners.find(p => p.partnerId === targetPartnerId);
              if (relation?.valueType === "hour") {
                billableRateFromRelation = relation.value?.toString() || "0";
              }
            }

            // Default billable rate from relation (analyst rate) or project
            if (!billableRate || billableRate === "0") {
              billableRate = billableRateFromRelation !== "0" ? billableRateFromRelation : (project.hourlyRate?.toString() || "0");
            }

            // Cost rate
            if (!costRate || costRate === "0") {
              costRate = costRateFromRelation !== "0" ? costRateFromRelation : "0";
            }
          }
        }
      }

      const updateData = {
        ...req.body,
      };
      
      if (costRate !== undefined) updateData.costRate = costRate.toString();
      if (billableRate !== undefined) updateData.billableRate = billableRate.toString();
      if (analystPaymentType !== undefined) updateData.analystPaymentType = analystPaymentType;

      const entry = await storage.updateTimesheetEntry(req.params.id, updateData);
      await recalculateReceiptTotal(entry.receiptId);
      res.json(entry);
    } catch (error) {
      console.error("Update timesheet error:", error);
      res.status(500).json({ error: "Erro ao atualizar apontamento" });
    }
  });

  app.delete("/api/timesheets/:id", requireAuth, async (req, res) => {
    try {
      const entry = await storage.getTimesheetEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: "Apontamento não encontrado" });
      }

      await storage.deleteTimesheetEntry(req.params.id);
      await recalculateReceiptTotal(entry.receiptId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete timesheet error:", error);
      res.status(500).json({ error: "Erro ao excluir apontamento" });
    }
  });

  // Invoices
  app.post("/api/invoices", requireAuth, async (req, res) => {
    try {
      console.log("POST /api/invoices body:", JSON.stringify(req.body));
      const { receiptId } = req.body;
      if (!receiptId) return res.status(400).json({ error: "receiptId is required" });

      const receipt = await storage.getReceipt(receiptId);
      if (!receipt) return res.status(404).json({ error: "Recibo não encontrado" });

      // Determine Company and Client details
      let companyId: string | null = null;
      let clientId: string | null = null;
      let providerName = "";
      let providerDoc = "";
      let borrowerName = "";
      let borrowerDoc = "";

      if (receipt.contractId) {
        const contract = await storage.getContract(receipt.contractId);
        if (contract) {
          companyId = contract.companyId;
          clientId = contract.clientId;
          
          const company = await storage.getCompany(companyId);
          providerName = company?.name || "";
          providerDoc = company?.doc || "";
          
          const client = await storage.getClient(clientId);
          borrowerName = client?.name || "";
          borrowerDoc = client?.doc || "";
        }
      } else if (receipt.projectId) {
        const project = await storage.getProject(receipt.projectId);
        if (project) {
          companyId = project.companyId;
          const company = await storage.getCompany(companyId);
          providerName = company?.name || "";
          providerDoc = company?.doc || "";

          if (project.clientType === "client" && project.clientId) {
            clientId = project.clientId;
            const client = await storage.getClient(clientId);
            borrowerName = client?.name || "";
            borrowerDoc = client?.doc || "";
          } else if (project.clientType === "partner" && project.partnerId) {
            const partner = await storage.getPartner(project.partnerId);
            borrowerName = partner?.name || "";
            borrowerDoc = partner?.cnpj || "";
          }
        }
      } else if (receipt.systemContractId) {
         const sysContract = await storage.getSystemContract(receipt.systemContractId);
         if (sysContract) {
           // Se tiver companyId vinculado, usa ele. Se não, tenta buscar pelo nome ou deixa em branco.
           if (sysContract.companyId) {
             companyId = sysContract.companyId;
             const company = await storage.getCompany(companyId);
             providerName = company?.name || sysContract.companyName;
             providerDoc = company?.doc || "";
           } else {
             providerName = sysContract.companyName;
             // Tentar encontrar empresa pelo nome
             // TODO: Implementar busca por nome se necessário ou forçar migração
           }

           if (sysContract.clientId) {
             clientId = sysContract.clientId;
             const client = await storage.getClient(clientId);
             borrowerName = client?.name || sysContract.clientName;
             borrowerDoc = client?.doc || "";
           } else {
             borrowerName = sysContract.clientName;
           }
         }
      }

      const amounts = Array.isArray(req.body.amounts) ? req.body.amounts : [receipt.totalDue];
      console.log(`Processing ${amounts.length} invoices with amounts:`, amounts);
      const invoicesCreated = [];

      for (const amount of amounts) {
        const invoice = await storage.createInvoice({
          receiptId,
          companyId: companyId || undefined,
          clientId: clientId || undefined,
          providerName,
          providerDoc,
          borrowerName,
          borrowerDoc,
          amount: amount.toString(), // Ensure string/decimal
          status: "PENDENTE",
        });
        invoicesCreated.push(invoice);
      }

      await storage.updateReceipt(receiptId, { isInvoiceGenerated: true, status: "NF_GERADA", isInvoiceCancelled: false });

      res.json(invoicesCreated.length === 1 ? invoicesCreated[0] : invoicesCreated);
    } catch (error) {
      console.error("Create invoice error:", error);
      res.status(500).json({ error: "Erro ao gerar Nota Fiscal" });
    }
  });

  app.get("/api/invoices", requireAuth, async (req, res) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error) {
      console.error("Get invoices error:", error);
      res.status(500).json({ error: "Erro ao buscar notas fiscais" });
    }
  });

  app.post("/api/invoices/:id/send-email", requireAuth, async (req, res) => {
    try {
      const result = await emailService.sendInvoiceEmail(req.params.id);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json({ error: result.message });
      }
    } catch (error: any) {
      console.error("Send email error:", error);
      res.status(500).json({ error: "Erro ao enviar email" });
    }
  });

  app.post("/api/invoices/batch-delete", requireAuth, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "IDs não fornecidos" });
      }

      // 1. Validate all invoices exist and are not EMITIDA
      const invoicesToDelete = [];
      const receiptIdsToCheck = new Set<string>();

      for (const id of ids) {
        const invoice = await storage.getInvoice(id);
        if (!invoice) continue; // Or throw error? Skip for now.
        
        if (invoice.status === "EMITIDA") {
           // If one is emitted, fail the whole batch or just skip? 
           // Safer to fail to let user know.
           return res.status(400).json({ error: `A nota fiscal ${invoice.number || id} já foi emitida e não pode ser excluída.` });
        }
        invoicesToDelete.push(invoice);
        if (invoice.receiptId) receiptIdsToCheck.add(invoice.receiptId);
      }

      // 2. Delete
      for (const invoice of invoicesToDelete) {
        await storage.deleteInvoice(invoice.id);
      }

      // 3. Update Receipts status
      for (const receiptId of receiptIdsToCheck) {
        const remainingInvoices = await storage.getInvoicesByReceiptId(receiptId);
        if (remainingInvoices.length === 0) {
           const receipt = await storage.getReceipt(receiptId);
           if (receipt && receipt.status !== "paid" && receipt.status !== "transferred") {
              const newStatus = (receipt.boletoStatus === "ISSUED") ? "BOLETO_EMITIDO" : "closed";
              await storage.updateReceipt(receiptId, { isInvoiceGenerated: false, status: newStatus });
           } else {
              await storage.updateReceipt(receiptId, { isInvoiceGenerated: false });
           }
        }
      }

      res.json({ success: true, count: invoicesToDelete.length });
    } catch (error) {
      console.error("Batch delete invoices error:", error);
      res.status(500).json({ error: "Erro ao excluir notas fiscais em lote" });
    }
  });

  app.delete("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) return res.status(404).json({ error: "Nota fiscal não encontrada" });

      if (invoice.status === "EMITIDA") {
        return res.status(400).json({ error: "Não é possível excluir uma nota fiscal emitida" });
      }

      await storage.deleteInvoice(req.params.id);
      
      // Update receipt status
      // Check if there are any other invoices for this receipt
      const remainingInvoices = await storage.getInvoicesByReceiptId(invoice.receiptId);
      if (remainingInvoices.length === 0) {
        // First check if it was paid, if so, keep it paid but isInvoiceGenerated=false
        const receipt = await storage.getReceipt(invoice.receiptId);
        if (receipt && receipt.status !== "paid" && receipt.status !== "transferred") {
           const newStatus = (receipt.boletoStatus === "ISSUED") ? "BOLETO_EMITIDO" : "closed";
           await storage.updateReceipt(invoice.receiptId, { isInvoiceGenerated: false, status: newStatus });
        } else {
           await storage.updateReceipt(invoice.receiptId, { isInvoiceGenerated: false });
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete invoice error:", error);
      res.status(500).json({ error: "Erro ao excluir nota fiscal" });
    }
  });

  // Boleto Invoice Routes
  app.post("/api/invoices/:id/boleto", requireAuth, async (req, res) => {
    try {
      const invoiceId = req.params.id;
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) return res.status(404).json({ error: "Nota fiscal não encontrada" });

      const receipt = await storage.getReceipt(invoice.receiptId);
      if (!receipt) return res.status(404).json({ error: "Recibo vinculado não encontrado" });

      // 1. Determine Company and Payer
      let companyId = invoice.companyId;
      let payer: any = null;
      let payerType: "FISICA" | "JURIDICA" = "JURIDICA";
      let systemName: string | undefined;

      // Se invoice não tem companyId, tenta pegar do receipt
      if (!companyId) {
          if (receipt.projectId) {
            const p = await storage.getProject(receipt.projectId);
            companyId = p?.companyId;
          } else if (receipt.contractId) {
            const c = await storage.getContract(receipt.contractId);
            companyId = c?.companyId;
          } else if (receipt.systemContractId) {
            const sc = await storage.getSystemContract(receipt.systemContractId);
            companyId = sc?.companyId;
            systemName = sc?.systemName;
          }
      }

      if (!companyId) return res.status(400).json({ error: "Empresa não identificada para emissão do boleto" });

      // Determinar Pagador (Tomador)
      if (invoice.clientId) {
          payer = await storage.getClient(invoice.clientId);
      } else {
          // Fallback para lógica do receipt
          if (receipt.projectId) {
              const p = await storage.getProject(receipt.projectId);
              if (p?.clientType === 'partner' && p.partnerId) {
                  payer = await storage.getPartner(p.partnerId);
              } else if (p?.clientId) {
                  payer = await storage.getClient(p.clientId);
              }
          } else if (receipt.contractId) {
              const c = await storage.getContract(receipt.contractId);
              if (c?.clientId) payer = await storage.getClient(c.clientId);
          } else if (receipt.systemContractId) {
              const sc = await storage.getSystemContract(receipt.systemContractId);
              if (sc?.clientId) payer = await storage.getClient(sc.clientId);
          }
      }

      if (!payer) {
          return res.status(400).json({ error: "Pagador (Cliente/Parceiro) não encontrado" });
      }

      // 2. Get Company Config
      const company = await storage.getCompany(companyId);
      if (!company || !company.interClientId || !company.interClientSecret || !company.interCertPath) {
          return res.status(400).json({ error: "Configuração do Boleto Inter incompleta para esta empresa" });
      }

      const cleanDigits = (s: string) => s.replace(/\D/g, "");
      const payerDoc = cleanDigits(payer.doc || payer.cnpj || "");
      payerType = payerDoc.length > 11 ? "JURIDICA" : "FISICA";

      // 3. Prepare Boleto Data
      const amount = invoice.amount ? Number(invoice.amount) : Number(receipt.totalDue);

      // Get NFSe info first to use in message
      const nfseEmissao = await storage.getNfseEmissaoByInvoiceId(invoice.id);
      const nfseNumber = nfseEmissao?.numero ? nfseEmissao.numero.replace(/\D/g, '') : (invoice.number || "Processando");

      const boletoData: any = {
        seuNumero: invoice.id.substring(0, 15),
        valorNominal: amount,
        numDiasAgenda: 30,
        pagador: {
          cpfCnpj: payerDoc,
          tipoPessoa: payerType,
          nome: payer.name.substring(0, 100),
          endereco: payer.street?.substring(0, 90) || payer.address?.substring(0, 90) || "Endereço não informado",
          numero: payer.number || "S/N",
          complemento: payer.complement || "",
          bairro: payer.neighborhood || "Centro",
          cidade: payer.city || "Cidade",
          uf: payer.state || "MG",
          cep: cleanDigits(payer.zipCode || "00000000"),
          email: payer.email || "",
          ddd: payer.phone ? cleanDigits(payer.phone).substring(0, 2) : "",
          telefone: payer.phone ? cleanDigits(payer.phone).substring(2) : ""
        },
        multa: { taxa: 2, codigo: "PERCENTUAL" },
        mora: { taxa: 1, codigo: "TAXAMENSAL" },
        mensagem: {
          linha1: (systemName === 'SimpleDFe' || systemName === 'SimpleDFE') 
              ? "Mensalidade Sistema de Captura de NFe/ NFSe / CTe - SimpleDFe" 
              : (() => {
                  // Lógica para mês anterior (Aplicada a TODOS os tipos: Contratos, Sistemas, Projetos, etc)
                  // Subtrair 1 mês do mês de referência
                  // Ex: refMonth = 3 (Março), refYear = 2026 -> Anterior = Fevereiro/2026
                  let prevMonth = receipt.refMonth - 1;
                  let prevYear = receipt.refYear;
                  
                  if (prevMonth === 0) {
                     prevMonth = 11; // Dezembro (índice 11)
                     prevYear--;
                  } else {
                     prevMonth--; // Ajustar para índice 0-11
                  }

                  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                  const monthName = monthNames[prevMonth];
                  
                  return `Referente a Serviços Prestados no mês de ${monthName}/${prevYear}`;
              })(),
          linha2: `Nota Fiscal Número ${nfseNumber}`,
          linha3: "",
          linha4: "",
          linha5: ""
        },
        beneficiarioFinal: {
          cpfCnpj: cleanDigits(company.doc),
          tipoPessoa: cleanDigits(company.doc).length > 11 ? "JURIDICA" : "FISICA",
          nome: company.name,
          endereco: company.address || "Endereço da Empresa",
          numero: "S/N",
          complemento: "",
          bairro: "Centro",
          cidade: company.city || "Cidade",
          uf: company.state || "UF",
          cep: cleanDigits(company.zipCode || "00000000")
        },
        formasRecebimento: ["BOLETO", "PIX"]
      };

      // Calculate Due Date
      let dayDue = 10;
      if (receipt.projectId) {
        const p = await storage.getProject(receipt.projectId);
        if ((p as any).dayDue) dayDue = (p as any).dayDue;
      } else if (receipt.contractId) {
        const c = await storage.getContract(receipt.contractId);
        if (c?.dayDue) dayDue = c.dayDue;
      } else if (receipt.systemContractId) {
        const sc = await storage.getSystemContract(receipt.systemContractId);
        if (sc?.dayDue) dayDue = sc.dayDue;
      }
      
      const year = receipt.refYear;
      const month = receipt.refMonth;
      boletoData.dataVencimento = `${year}-${String(month).padStart(2, '0')}-${String(dayDue).padStart(2, '0')}`;

      // Add Nota Fiscal Info if available
      if (nfseEmissao && nfseEmissao.chaveAcesso && nfseEmissao.numero) {
           const cleanKey = nfseEmissao.chaveAcesso.replace(/\D/g, '');
           if (cleanKey.length === 44) {
               const nfseConfig = await storage.getNfseConfig(companyId);
               boletoData.notaFiscal = {
                 chaveNFe: cleanKey,
                 numero: parseInt(nfseEmissao.numero.replace(/\D/g, '')) || 0,
                 serie: nfseConfig?.serieNfse ? parseInt(nfseConfig.serieNfse.replace(/\D/g, '')) : 900,
                 dataEmissao: nfseEmissao.createdAt.toISOString().split('T')[0],
                 parcela: 1,
                 naturezaOperacao: "Venda" 
               };
           }
      }

      const inter = new InterProvider({
        environment: company.interEnvironment || "sandbox",
        clientId: company.interClientId,
        clientSecret: company.interClientSecret,
        certPath: company.interCertPath,
        keyPath: company.interKeyPath || undefined
      });

      const result = await inter.issueBoleto(boletoData);

      await storage.updateInvoice(invoice.id, {
        boletoSolicitacaoId: result.codigoSolicitacao,
        boletoStatus: "ISSUED"
      });

      res.json({ success: true, codigoSolicitacao: result.codigoSolicitacao });

    } catch (error: any) {
      console.error("Erro ao emitir boleto da invoice:", error);
      res.status(500).json({ error: error.message || "Erro ao emitir boleto" });
    }
  });

  app.get("/api/invoices/:id/boleto/pdf", requireAuth, async (req, res) => {
    try {
      const invoiceId = req.params.id;
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice || !invoice.boletoSolicitacaoId) {
        return res.status(404).json({ error: "Boleto não encontrado para esta nota fiscal" });
      }

      let companyId = invoice.companyId;
      if (!companyId) {
          const receipt = await storage.getReceipt(invoice.receiptId);
          if (receipt) {
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
      }

      if (!companyId) return res.status(404).json({ error: "Empresa não encontrada" });
      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ error: "Empresa não encontrada" });

      const inter = new InterProvider({
        environment: company.interEnvironment || "sandbox",
        clientId: company.interClientId!, 
        clientSecret: company.interClientSecret!,
        certPath: company.interCertPath!,
        keyPath: company.interKeyPath || undefined
      });

      const pdfBase64 = await inter.getPdf(invoice.boletoSolicitacaoId);
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=boleto-${invoice.boletoSolicitacaoId}.pdf`);
      res.send(pdfBuffer);

    } catch (error: any) {
      console.error("Erro ao obter PDF do boleto:", error);
      res.status(500).json({ error: "Erro ao obter PDF" });
    }
  });

  app.post("/api/invoices/:id/boleto/cancel", requireAuth, async (req, res) => {
    try {
      const invoiceId = req.params.id;
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) return res.status(404).json({ error: "Nota fiscal não encontrada" });

      if (invoice.boletoStatus !== 'ISSUED') {
         return res.status(400).json({ error: "Esta nota fiscal não possui boleto emitido para cancelar." });
      }

      await storage.updateInvoice(invoiceId, {
        boletoStatus: 'CANCELLED'
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Erro ao cancelar boleto:", error);
      res.status(500).json({ error: "Erro ao cancelar boleto" });
    }
  });

  // NFS-e Config (Tatuí)
  app.post("/api/nfse/config", requireAuth, upload.single('certificado'), async (req, res) => {
    try {
      const data = req.body;

      // Se houve upload de arquivo, converter para Base64
      if (req.file) {
        data.certificado = req.file.buffer.toString('base64');
      }

      // Converter campos numéricos/booleanos que podem vir como string do FormData
      if (data.ultimoNumeroNfse) data.ultimoNumeroNfse = Number(data.ultimoNumeroNfse);
      
      // Tratar decimal (aliquotaIss)
      if (data.aliquotaIss === "") {
        data.aliquotaIss = null;
      }

      if (data.issRetido === "true") data.issRetido = true;
      if (data.issRetido === "false") data.issRetido = false;
      
      // Tratar companyId vazio como undefined para não violar constraint ou lógica de busca
      if (data.companyId === "") delete data.companyId;

      const logData = { ...data };
      if (logData.certificado && logData.certificado.length > 100) {
        logData.certificado = logData.certificado.substring(0, 20) + "...(truncated)";
      }
      console.log("Upserting NFSe config:", logData); // Debug logging

      const config = await storage.upsertNfseConfig(data);
      res.json(config);
    } catch (error) {
      console.error("Upsert NFSe config error:", error);
      res.status(500).json({ error: "Erro ao salvar configuração NFS-e" });
    }
  });

  app.get("/api/nfse/config", requireAuth, async (req, res) => {
    try {
      const companyId = req.query.companyId as string | undefined;
      const config = await storage.getNfseConfig(companyId);
      res.json(config || {});
    } catch (error) {
      console.error("Get NFSe config error:", error);
      res.status(500).json({ error: "Erro ao buscar configuração NFS-e" });
    }
  });

  // NFS-e Operations
  app.get("/api/nfse/emissoes", requireAuth, async (req, res) => {
    try {
      const emissoes = await storage.getNfseEmissoes();
      res.json(emissoes);
    } catch (error) {
      console.error("Get NFSe emissoes error:", error);
      res.status(500).json({ error: "Erro ao buscar emissões NFS-e" });
    }
  });

  // Create NFS-e Lote (Batch)
  app.post("/api/nfse/lotes", requireAuth, async (req, res) => {
    try {
      const { itens } = req.body;
      
      if (!Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ error: "Lista de itens inválida" });
      }

      // 1. Create Lote
      const lote = await storage.createNfseLote({
         status: "PROCESSANDO"
      });

      const emissoes = [];

      // 2. Create Emissions
      for (const item of itens) {
         // Sanitizar valores decimais se necessário
         if (item.valor) item.valor = String(item.valor);
         
         const emissao = await storage.createNfseEmissao({
            ...item,
            loteId: lote.id,
            status: "PENDENTE"
         });
         emissoes.push(emissao);
      }
      
      res.status(201).json({ lote, emissoes });
    } catch (error) {
      console.error("Create NFSe lote error:", error);
      res.status(500).json({ error: "Erro ao criar lote de NFS-e" });
    }
  });

  // Process specific NFS-e emission
  app.post("/api/nfse/emissoes/:id/processar", requireAuth, async (req, res) => {
      try {
          const result = await nfseProvider.emitirNfse(req.params.id);
          if (result.success) {
              res.json(result);
          } else {
              res.status(400).json(result);
          }
      } catch (error: any) {
          console.error("Process NFSe emission error:", error);
          res.status(500).json({ error: error.message });
      }
  });

  app.post("/api/nfse/emissoes/:id/cancelar", requireAuth, async (req, res) => {
      try {
          const { motivo } = req.body;
          const result = await nfseProvider.cancelarNfse(req.params.id, motivo);
          if (result.success) {
              res.json(result);
          } else {
              res.status(400).json(result);
          }
      } catch (error: any) {
          res.status(500).json({ error: error.message });
      }
  });

  // Rota para correção manual de status (Emergency/Fix)
  app.patch("/api/nfse/emissoes/:id", requireAuth, async (req, res) => {
      try {
          console.log(`[PATCH /api/nfse/emissoes/${req.params.id}] Payload recebido:`, req.body);
          const { status, chaveAcesso, numeroNfse, erroMensagem } = req.body;
          const updateData: any = {};
          
          // Allow manual override of status and key
          if (status) updateData.status = status;
          
          // Chave de acesso e numeroNfse devem ser atualizados mesmo se forem string vazia (para limpar se necessário)
          // Mas normalmente queremos setar um valor. O problema é se vier undefined.
          // Se vier null ou "", assumimos que é para limpar ou setar vazio.
          if (chaveAcesso !== undefined) updateData.chaveAcesso = chaveAcesso;
          if (numeroNfse !== undefined) updateData.numero = numeroNfse;
          
          if (erroMensagem !== undefined) updateData.erroMensagem = erroMensagem;
          
          updateData.updatedAt = new Date();

          console.log(`[PATCH /api/nfse/emissoes/${req.params.id}] Dados para update:`, updateData);

          const emissao = await storage.updateNfseEmissao(req.params.id, updateData);
          
          // Sincronizar status da Invoice se necessário
          if (emissao && emissao.origemTipo === 'INVOICE') {
             if (status === 'EMITIDA') {
                 // Se tem chave e numero, garante que a invoice também receba (opcional, mas bom pra consistência visual)
                 await storage.updateInvoice(emissao.origemId, { status: "EMITIDA", number: numeroNfse || undefined });
             } else if (status === 'CANCELADA') {
                 await storage.updateInvoice(emissao.origemId, { status: "CANCELADA" });
             }
          }
          
          res.json(emissao);
      } catch (error: any) {
          console.error("Manual update NFSe error:", error);
          res.status(500).json({ error: error.message });
      }
  });

  app.get("/api/nfse/emissoes/:id/xml", requireAuth, async (req, res) => {
      try {
          const xml = await nfseProvider.downloadXml(req.params.id);
          if (xml) {
              res.header('Content-Type', 'application/xml');
              res.send(xml);
          } else {
              res.status(404).json({ error: "XML não encontrado" });
          }
      } catch (error: any) {
          res.status(500).json({ error: error.message });
      }
  });

  app.get("/api/nfse/emissoes/:id/danfse", requireAuth, async (req, res) => {
      try {
          const emissao = await storage.getNfseEmissao(req.params.id);
          if (emissao && emissao.chaveAcesso) {
             let companyId: string | undefined;
             if (emissao.origemTipo === 'INVOICE') {
                const invoice = await storage.getInvoice(emissao.origemId);
                if (invoice) companyId = invoice.companyId;
             }
             const config = await storage.getNfseConfig(companyId);
             const url = nfseProvider.getDanfseUrl(emissao.chaveAcesso, config?.ambiente || 'homologacao');
             res.json({ url });
          } else {
             res.status(404).json({ error: "Chave de acesso não disponível" });
          }
      } catch (error: any) {
          res.status(500).json({ error: error.message });
      }
  });

  app.get("/api/nfse/emissoes/:id/danfse/proxy", requireAuth, async (req, res) => {
      let url = '';
      try {
          const emissao = await storage.getNfseEmissao(req.params.id);
          if (!emissao || !emissao.chaveAcesso) {
             return res.status(404).json({ error: "Nota fiscal ou chave de acesso não encontrada" });
          }

          let companyId: string | undefined;
          if (emissao.origemTipo === 'INVOICE') {
            const invoice = await storage.getInvoice(emissao.origemId);
            if (invoice) companyId = invoice.companyId;
          }
          const config = await storage.getNfseConfig(companyId);
          url = nfseProvider.getDanfseUrl(emissao.chaveAcesso, config?.ambiente || 'homologacao');

          console.log(`Proxying DANFSe from: ${url}`);

          const agent = await nfseProvider.getHttpsAgent(companyId);

          // 1. Baixar PDF direto da URL oficial (ADN)
          try {
              const buffer = await nfseProvider.getDanfsePdf(emissao.chaveAcesso, companyId);
              
              console.log(`[Proxy] Sucesso ao baixar PDF da URL oficial.`);
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Length', buffer.length);
              // inline = visualizar no navegador, attachment = forçar download
              const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
              res.setHeader('Content-Disposition', `${disposition}; filename=danfse-${emissao.chaveAcesso}.pdf`);
              return res.send(buffer);
          } catch (error: any) {
              console.error(`[Proxy] Erro ao baixar PDF da URL oficial: ${error.message}`);
              throw error;
          }

      } catch (error: any) {
          console.error("Erro no proxy DANFSE:", error.message);
          
          if (error.response) {
             console.error("Status:", error.response.status);
             console.error("Data:", error.response.data ? error.response.data.toString() : 'No data');
          }
          res.status(500).json({ 
             error: "Erro ao baixar o PDF da DANFSE. Verifique se o certificado está correto e válido.",
             details: error.message,
             url: error.config?.url
          });
      }
  });

  // System Logs
  app.get("/api/system-logs", requireAuth, async (_req, res) => {
    try {
      const logs = await storage.getSystemLogs();
      res.json(logs);
    } catch (error) {
      console.error("Get system logs error:", error);
      res.status(500).json({ error: "Erro ao buscar logs do sistema" });
    }
  });

  app.delete("/api/system-logs", requireAuth, async (_req, res) => {
    try {
      await storage.clearSystemLogs();
      res.json({ success: true });
    } catch (error) {
      console.error("Clear system logs error:", error);
      res.status(500).json({ error: "Erro ao limpar logs do sistema" });
    }
  });


  // Projects
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Get projects error:", error);
      res.status(500).json({ error: "Erro ao buscar projetos" });
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ error: "Projeto não encontrado" });
      res.json(project);
    } catch (error) {
      console.error("Get project error:", error);
      res.status(500).json({ error: "Erro ao buscar projeto" });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const project = await storage.createProject(req.body);
      res.status(201).json(project);
    } catch (error) {
      console.error("Create project error:", error);
      res.status(500).json({ error: "Erro ao criar projeto" });
    }
  });

  app.patch("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const project = await storage.updateProject(req.params.id, req.body);
      if (!project) return res.status(404).json({ error: "Projeto não encontrado" });
      res.json(project);
    } catch (error) {
      console.error("Update project error:", error);
      res.status(500).json({ error: "Erro ao atualizar projeto" });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteProject(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete project error:", error);
      res.status(500).json({ error: "Erro ao excluir projeto" });
    }
  });

  // Project Analysts
  app.get("/api/projects/:id/analysts", requireAuth, async (req, res) => {
    try {
      const analysts = await storage.getProjectAnalysts(req.params.id);
      res.json(analysts);
    } catch (error) {
      console.error("Get project analysts error:", error);
      res.status(500).json({ error: "Erro ao buscar analistas do projeto" });
    }
  });

  app.post("/api/project-analysts", requireAuth, async (req, res) => {
    try {
      const relation = await storage.addProjectAnalyst(req.body);
      res.status(201).json(relation);
    } catch (error) {
      console.error("Add project analyst error:", error);
      res.status(500).json({ error: "Erro ao vincular analista ao projeto" });
    }
  });

  app.delete("/api/project-analysts/:id", requireAuth, async (req, res) => {
    try {
      await storage.removeProjectAnalyst(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Remove project analyst error:", error);
      res.status(500).json({ error: "Erro ao remover analista do projeto" });
    }
  });

  // Project Partners
  app.get("/api/projects/:id/partners", requireAuth, async (req, res) => {
    try {
      const partners = await storage.getProjectPartners(req.params.id);
      res.json(partners);
    } catch (error) {
      console.error("Get project partners error:", error);
      res.status(500).json({ error: "Erro ao buscar parceiros do projeto" });
    }
  });

  app.post("/api/project-partners", requireAuth, async (req, res) => {
    try {
      const relation = await storage.addProjectPartner(req.body);
      res.status(201).json(relation);
    } catch (error) {
      console.error("Add project partner error:", error);
      res.status(500).json({ error: "Erro ao vincular parceiro ao projeto" });
    }
  });

  app.delete("/api/project-partners/:id", requireAuth, async (req, res) => {
    try {
      await storage.removeProjectPartner(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Remove project partner error:", error);
      res.status(500).json({ error: "Erro ao remover parceiro do projeto" });
    }
  });

  return httpServer;
}
