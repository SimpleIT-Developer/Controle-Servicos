import { useQuery } from "@tanstack/react-query";
import { useParams, useSearch } from "wouter";
import { Loader2, Printer, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import type { Receipt, Contract, Client, Company, ContractItem, SystemContract, Project, Partner } from "@shared/schema";
import { useEffect, useState } from "react";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useToast } from "@/hooks/use-toast";

export default function PrintReceiptPage() {
  const { id } = useParams();
  const search = useSearch();
  const { toast } = useToast();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const searchParams = new URLSearchParams(search);
  const type = searchParams.get("type") as "client" | "company" | null;

  const { data: receipt, isLoading: isLoadingReceipt, isError: isReceiptError } = useQuery<Receipt>({
    queryKey: [`/api/receipts/${id}`],
  });

  // Calculate display date (1 month before reference date)
  const getDisplayDate = () => {
    if (!receipt) return { month: 0, year: 0 };
    let month = receipt.refMonth - 1;
    let year = receipt.refYear;
    if (month === 0) {
      month = 12;
      year = year - 1;
    }
    return { month, year };
  };

  const { month: displayMonth, year: displayYear } = getDisplayDate();
  const displayDateStr = `${String(displayMonth).padStart(2, "0")}/${displayYear}`;

  const { data: contract, isLoading: isLoadingContract } = useQuery<Contract>({
    queryKey: [`/api/contracts/${receipt?.contractId}`],
    enabled: !!receipt?.contractId,
  });

  const { data: systemContract, isLoading: isLoadingSystemContract } = useQuery<SystemContract>({
    queryKey: [`/api/system-contracts/${receipt?.systemContractId}`],
    enabled: !!receipt?.systemContractId,
  });

  const { data: project, isLoading: isLoadingProject } = useQuery<Project>({
    queryKey: [`/api/projects/${receipt?.projectId}`],
    enabled: !!receipt?.projectId,
  });

  const { data: clients } = useQuery<Client[]>({ 
    queryKey: ["/api/clients"], 
    enabled: !!contract || !!systemContract || !!project
  });
  
  const { data: companies } = useQuery<Company[]>({ 
    queryKey: ["/api/companies"], 
    enabled: !!contract || !!systemContract || !!project
  });

  const { data: partners } = useQuery<Partner[]>({ 
    queryKey: ["/api/partners"], 
    enabled: !!project
  });

  const { data: services, isLoading: isLoadingServices } = useQuery<ContractItem[]>({
    queryKey: ["contract-services", receipt?.contractId, receipt?.refYear, receipt?.refMonth],
    queryFn: async () => {
      if (!receipt || !receipt.contractId) return [];
      const res = await fetch(`/api/contracts/${receipt.contractId}/services/${receipt.refYear}/${receipt.refMonth}`);
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
    enabled: !!receipt?.contractId,
  });

  useEffect(() => {
    if (receipt && (contract || systemContract || project) && clients && companies && (services || systemContract || project)) {
      document.title = `Recibo - ${type === "client" ? "Cliente" : "Empresa"} - ${displayDateStr}`;
    }
  }, [receipt, contract, systemContract, project, clients, companies, services, type, displayDateStr]);

  if (isLoadingReceipt) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando recibo...</span>
      </div>
    );
  }

  if (isReceiptError || !receipt) {
    return <div className="p-8 text-center text-red-500">Recibo não encontrado.</div>;
  }

  if (isLoadingContract || isLoadingSystemContract || isLoadingProject) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando dados do contrato/projeto...</span>
      </div>
    );
  }

  if (!contract && !systemContract && !project) {
    return <div className="p-8 text-center text-red-500">Contrato/Projeto não encontrado.</div>;
  }

  if (!clients || !companies || (isLoadingServices && contract)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando dados complementares...</span>
      </div>
    );
  }

  let client: Client | undefined;
  let company: Company | undefined;

  if (contract) {
    client = clients.find(t => t.id === contract.clientId);
    company = companies.find(l => l.id === contract.companyId);
  } else if (systemContract) {
    // Try to find by name, or construct a partial object
    client = clients.find(t => t.name === systemContract.clientName) || {
      name: systemContract.clientName,
      doc: "",
      address: "",
      city: "",
      state: "",
      zipCode: ""
    } as Client;
    
    company = companies.find(l => l.name === systemContract.companyName) || {
      name: systemContract.companyName,
      doc: "",
      address: "",
      city: "",
      state: "",
      zipCode: ""
    } as Company;
  } else if (project) {
    company = companies.find(c => c.id === project.companyId);
    
    if (project.clientId) {
       client = clients.find(c => c.id === project.clientId);
     } else if (project.partnerId && partners) {
       const partner = partners.find(p => p.id === project.partnerId);
       if (partner) {
         // Adapt Partner to Client interface for display
         client = {
           id: partner.id,
           name: partner.name,
           doc: partner.cnpj,
           address: partner.address || "",
           city: partner.city || "",
           state: partner.state || "",
           zipCode: partner.zipCode || "",
           type: "consultoria", // default
           hourlyRate: "0",
           createdAt: new Date(),
           street: partner.street,
           number: partner.number,
           complement: partner.complement,
           neighborhood: partner.neighborhood,
           phone: partner.phone,
           email: partner.email
         } as unknown as Client;
       }
     }
   }

  if (!client || !company) {
    return <div className="p-8 text-center text-red-500">Dados do contrato incompletos (Cliente ou Empresa não encontrados).</div>;
  }

  // Filter items based on type
  const items: Array<{ description: string; value: number; type: "credit" | "debit" }> = [];

  if (systemContract) {
    // System Contract Logic - Simple
    items.push({
      description: `Mensalidade Sistema ${systemContract.systemName}`,
      value: Number(receipt.amount),
      type: type === "client" ? "debit" : "credit"
    });
  } else if (project) {
     // Project Logic - Simple Total
     items.push({
      description: `Serviços de Consultoria - Projeto: ${project.name}`,
      value: Number(receipt.totalDue),
      type: type === "client" ? "debit" : "credit"
    });
  } else {
    // Existing Project Contract Logic
    if (type === "client") {
    // Client View
    // 1. Base Amount (Debit)
    items.push({
      description: "Valor do Contrato",
      value: Number(receipt.amount), // Use receipt amount which is snapshotted
      type: "debit"
    });

    // 2. Services/Adjustments
    services?.forEach(s => {
      const amount = Number(s.amount);
      
      // If charged to Client
      if (s.chargedTo === "CLIENT") {
        if (amount > 0) {
          items.push({ description: s.description, value: amount, type: "debit" });
        } else {
          items.push({ description: s.description, value: Math.abs(amount), type: "credit" });
        }
      }
      
      // If charged to Company but passed through to Client
      if (s.chargedTo === "COMPANY" && s.passThrough) {
        items.push({ 
          description: `${s.description} (Repasse)`, 
          value: amount, 
          type: "debit" 
        });
      }
    });
  } else {
    // Company View
    // 1. Base Amount (Credit) - Revenue
    items.push({
      description: "Valor do Contrato",
      value: Number(receipt.amount),
      type: "credit"
    });

    // 2. Services/Adjustments
    services?.forEach(s => {
      const amount = Number(s.amount);
      
      // If charged to Company (Expense)
      if (s.chargedTo === "COMPANY") {
        if (amount > 0) {
          items.push({ description: s.description, value: amount, type: "debit" });
        } else {
           // Negative expense is a credit? Or adjustment? Assuming amount is cost.
           // If amount < 0, it's a credit to the company.
           items.push({ description: s.description, value: Math.abs(amount), type: "credit" });
        }
      }

      // If charged to Client but passed through (Credit to Company? No, company paid for it, client pays company)
      // If Company paid (expense) and Client pays back (revenue)
      // Effectively neutral for company cash flow eventually, but in this receipt:
      // It's a deduction from what company receives? Or addition?
      // Logic: Company receives Rent. 
      // Company pays for repair (Debit).
      // Client reimburses (Credit).
      
      if (s.chargedTo === "COMPANY" && s.passThrough) {
         // This logic depends on how "passThrough" is handled in the system.
         // Usually: Expense for Company, and Revenue from Client.
         // In the receipt to Company (Extrato de Repasse):
         // + Aluguel
         // - Taxa de Adm (not implemented yet?)
         // - Despesa (Reparo)
         // + Reembolso de Reparo (se cobrado do inquilino)
         
         // For now simplify: Show as Credit if it's being reimbursed
         items.push({ 
           description: `Reembolso: ${s.description}`, 
           value: amount, 
           type: "credit" 
         });
      }
    });
  }
  }

  const totalCredits = items.filter(i => i.type === "credit").reduce((sum, i) => sum + i.value, 0);
  const totalDebits = items.filter(i => i.type === "debit").reduce((sum, i) => sum + i.value, 0);
  const total = type === "client" ? totalDebits - totalCredits : totalCredits - totalDebits;

  const handleWhatsAppShare = async () => {
    try {
      setIsGeneratingPdf(true);
      const element = document.getElementById('receipt-content');
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        logging: false,
        useCORS: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const fileName = `Recibo_${receipt.id.slice(0, 8)}.pdf`;

      // Try to share file using Web Share API
      try {
        const blob = pdf.output('blob');
        const file = new File([blob], fileName, { type: 'application/pdf' });
        
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Recibo de Serviços',
            text: `Olá, segue o Recibo de Serviços referente a ${displayDateStr}.`
          });
          toast({
            title: "Sucesso",
            description: "Arquivo compartilhado com sucesso!",
          });
        } else {
          throw new Error("Sharing not supported");
        }
      } catch (shareError) {
        // Fallback: Download and open WhatsApp Web
        pdf.save(fileName);
        
        const text = `Olá, segue o Recibo de Serviços referente a ${displayDateStr}. (Arquivo PDF baixado automaticamente)`;
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');

        toast({
          title: "PDF Baixado",
          description: "O PDF foi salvo no seu dispositivo. Anexe-o manualmente na conversa do WhatsApp.",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Erro",
        description: "Falha ao gerar o PDF. Tente imprimir manualmente.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white min-h-screen">
      <div className="flex justify-between items-start mb-8 no-print gap-4">
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir / Salvar PDF
        </Button>
        <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleWhatsAppShare} 
              disabled={isGeneratingPdf}
              className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
            >
            {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
            WhatsApp (PDF)
            </Button>
        </div>
      </div>

      <div id="receipt-content" className="border rounded-lg p-8 space-y-8 bg-white">
        {/* Header */}
        <div className="flex justify-between items-start border-b pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">RECIBO DE SERVIÇOS</h1>
            <p className="text-muted-foreground">Mês de Referência: {displayDateStr}</p>
          </div>
          <div className="text-right space-y-1">
            <div className="font-bold text-xl">Nº {receipt.id.slice(0, 8)}</div>
            <div className="text-sm text-muted-foreground">Emissão: {new Date(receipt.createdAt).toLocaleDateString("pt-BR")}</div>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm uppercase text-muted-foreground">Prestador / Empresa</h3>
            <div className="p-4 bg-muted/20 rounded-lg">
              <div className="font-bold">{company.tradeName || company.name}</div>
              <div className="text-sm">{company.doc}</div>
              <div className="text-sm">{company.address}</div>
              <div className="text-sm">{company.city} - {company.state}</div>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-sm uppercase text-muted-foreground">Tomador / Cliente</h3>
            <div className="p-4 bg-muted/20 rounded-lg">
              <div className="font-bold">{client.name}</div>
              <div className="text-sm">{client.doc}</div>
              <div className="text-sm">{client.address}</div>
              <div className="text-sm">{client.city} - {client.state}</div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div>
          <h3 className="font-semibold text-sm uppercase text-muted-foreground mb-2">Demonstrativo</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right w-[150px]">Tipo</TableHead>
                <TableHead className="text-right w-[150px]">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">
                    {item.type === "credit" ? (
                      <span className="text-green-600">Crédito</span>
                    ) : (
                      <span className="text-red-600">Débito</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    R$ {item.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-bold">
                <TableCell colSpan={2} className="text-right">Total a {type === "client" ? "Pagar" : "Receber"}</TableCell>
                <TableCell className="text-right font-mono text-lg">
                  R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="border-t pt-8 mt-12 text-center text-sm text-muted-foreground">
          <p>Este documento serve como comprovante de prestação de serviços para o período informado.</p>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none; }
          body { background: white; }
          .max-w-4xl { max-width: none; padding: 0; }
          .min-h-screen { min-height: auto; }
        }
      `}</style>
    </div>
  );
}
