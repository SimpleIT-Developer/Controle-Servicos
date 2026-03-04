import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, FileCheck, Loader2, Check, AlertCircle, FileText, Trash2, Ban, Download, RefreshCw, Eye, Printer, Wrench, Mail, Barcode, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/empty-state";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Invoice, Company, Client, Receipt, Contract, NfseEmissao, SystemContract } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  draft: { label: "Rascunho", variant: "outline", icon: FileText },
  issued: { label: "Emitida", variant: "default", icon: Check },
  error: { label: "Erro", variant: "destructive", icon: AlertCircle },
  cancelled: { label: "Cancelada", variant: "secondary", icon: Ban },
  PENDENTE: { label: "Pendente", variant: "secondary", icon: Loader2 },
  ENVIANDO: { label: "Enviando", variant: "secondary", icon: Loader2 },
  EMITIDA: { label: "NFS-e Emitida", variant: "default", icon: Check },
  CANCELADA: { label: "NFS-e Cancelada", variant: "secondary", icon: Ban },
  FALHOU: { label: "Falha Emissão", variant: "destructive", icon: AlertCircle },
  BOLETO_EMITIDO: { label: "Boleto Emitido", variant: "default", icon: Barcode },
};

export default function InvoicesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmissao, setSelectedEmissao] = useState<NfseEmissao | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isManualFixOpen, setIsManualFixOpen] = useState(false);
  const [manualFixEmissao, setManualFixEmissao] = useState<NfseEmissao | null>(null);
  
  // Form States for Manual Fix
  const [manualStatus, setManualStatus] = useState("");
  const [manualNumero, setManualNumero] = useState("");
  const [manualChave, setManualChave] = useState("");
  const [manualErro, setManualErro] = useState("");
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/invoices/batch-delete", { ids });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({ title: "Sucesso", description: `${data.count} notas fiscais excluídas.` });
      setSelectedInvoices([]);
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const toggleSelectAll = () => {
    // Filter out non-deletable invoices (EMITIDA)
    const deletableInvoices = filteredInvoices?.filter(i => {
       const emissao = getNfseEmissao(i.id);
       const status = emissao ? emissao.status : i.status;
       return status !== "EMITIDA";
    }) || [];

    const deletableIds = deletableInvoices.map(i => i.id);
    
    // Check if all *deletable* invoices are currently selected
    const allDeletableSelected = deletableIds.length > 0 && deletableIds.every(id => selectedInvoices.includes(id));

    if (allDeletableSelected) {
      // Unselect all deletable ones (keep others if any? No, clear all is safer/simpler UX usually, 
      // but if we want to toggle group, we usually clear selection)
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(deletableIds);
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedInvoices.includes(id)) {
      setSelectedInvoices(selectedInvoices.filter(i => i !== id));
    } else {
      setSelectedInvoices([...selectedInvoices, id]);
    }
  };


  const manualUpdateNfseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/nfse/emissoes/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfse/emissoes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Sucesso", description: "Status atualizado manualmente." });
      setIsManualFixOpen(false);
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const issueBoletoMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/invoices/${id}/boleto`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Sucesso", description: "Boleto emitido com sucesso" });
    },
    onError: (error: any) => toast({ title: "Erro ao emitir boleto", description: error.message, variant: "destructive" }),
  });

  const cancelBoletoMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/invoices/${id}/boleto/cancel`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Sucesso", description: "Boleto cancelado/liberado com sucesso" });
    },
    onError: (error: any) => toast({ title: "Erro ao cancelar boleto", description: error.message, variant: "destructive" }),
  });

  const { data: invoices, isLoading: isLoadingInvoices } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: companies, isLoading: isLoadingCompanies } = useQuery<Company[]>({ queryKey: ["/api/companies"] });
  const { data: clients, isLoading: isLoadingClients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: receipts, isLoading: isLoadingReceipts } = useQuery<Receipt[]>({ queryKey: ["/api/receipts"] });
  const { data: contracts, isLoading: isLoadingContracts } = useQuery<Contract[]>({ queryKey: ["/api/contracts"] });
  const { data: emissoes, isLoading: isLoadingEmissoes } = useQuery<NfseEmissao[]>({ queryKey: ["/api/nfse/emissoes"] });

  const isLoading = isLoadingInvoices || isLoadingCompanies || isLoadingClients || isLoadingReceipts || isLoadingContracts || isLoadingEmissoes;

  const getCompanyName = (invoice: Invoice) => {
    return invoice.providerName || companies?.find(c => c.id === invoice.companyId)?.name || "-";
  };
  
  const processNfseMutation = useMutation({
    mutationFn: async (emissaoId: string) => {
      const res = await apiRequest("POST", `/api/nfse/emissoes/${emissaoId}/processar`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfse/emissoes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      if (data.success) {
        toast({ title: "Sucesso", description: "NFS-e emitida com sucesso!" });
      } else {
        toast({ title: "Falha", description: data.message || "Erro ao emitir NFS-e", variant: "destructive" });
      }
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("POST", `/api/invoices/${invoiceId}/send-email`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Sucesso", description: data.message });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({ title: "Sucesso", description: "Nota fiscal excluída com sucesso." });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const cancelInvoiceMutation = useMutation({
    mutationFn: async ({ emissaoId, motivo }: { emissaoId: string; motivo: string }) => {
      const res = await apiRequest("POST", `/api/nfse/emissoes/${emissaoId}/cancelar`, { motivo });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nfse/emissoes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({ title: "Sucesso", description: "Pedido de cancelamento enviado." });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const handleCancelClick = (emissaoId: string) => {
    const motivo = prompt("Por favor, informe o motivo do cancelamento:");
    if (motivo) {
        cancelInvoiceMutation.mutate({ emissaoId, motivo });
    }
  };

  const handleViewDetails = (emissao: NfseEmissao) => {
    setSelectedEmissao(emissao);
    setIsDetailsOpen(true);
  };

  const issueInvoiceMutation = useMutation({
    mutationFn: async (invoice: Invoice) => {
      // 1. Criar emissão
      // Tenta encontrar o cliente pelo ID ou pelo nome (fallback) para garantir que temos o documento
      let client = invoice.clientId ? clients?.find(c => c.id === invoice.clientId) : null;
      if (!client && invoice.borrowerName) {
         // Normaliza para comparação (remove espaços extras, lowercase)
         const searchName = invoice.borrowerName.trim().toLowerCase();
         client = clients?.find(c => c.name.trim().toLowerCase() === searchName || c.name.toLowerCase().includes(searchName));
      }

      const company = invoice.companyId ? companies?.find(c => c.id === invoice.companyId) : null;
      const receipt = receipts?.find(r => r.id === invoice.receiptId);
      const contract = contracts?.find(c => c.id === receipt?.contractId);
      
      const tomadorDoc = client?.doc || invoice.borrowerDoc || "";

      if (!tomadorDoc) {
        throw new Error(`Documento (CPF/CNPJ) do tomador não encontrado para ${client?.name || invoice.borrowerName}. Verifique o cadastro do cliente.`);
      }

      const payload = {
        origemId: invoice.id,
        origemTipo: "INVOICE",
        valor: invoice.amount,
        tomadorNome: client?.name || invoice.borrowerName || "Desconhecido",
        tomadorCpfCnpj: tomadorDoc, 
        discriminacao: `Serviços prestados - Ref: ${receipt?.refMonth}/${receipt?.refYear} - ${contract?.description || 'Serviços de Tecnologia'}`
      };

      // Use Batch endpoint for consistency
      const res = await apiRequest("POST", "/api/nfse/lotes", { itens: [payload] });
      const data = await res.json(); // { lote, emissoes: [] }
      const emissao = data.emissoes?.[0];

      // 2. Processar imediatamente (simulando worker) if needed, but worker handles PENDENTE.
      // However, for UX feedback, we can trigger it.
      if (emissao && emissao.id) {
        await processNfseMutation.mutateAsync(emissao.id);
      }
      return emissao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfse/emissoes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const getClientName = (invoice: Invoice) => {
    if (invoice.clientId) {
      const client = clients?.find((c) => c.id === invoice.clientId);
      return client?.name || invoice.borrowerName || "-";
    }
    return invoice.borrowerName || "-";
  };
  
  const getReceiptInfo = (receiptId: string) => {
    const receipt = receipts?.find((r) => r.id === receiptId);
    if (!receipt) return { contract: "-", ref: "-" };
    const contract = contracts?.find((c) => c.id === receipt.contractId);
    return {
      contract: contract?.description || "-",
      ref: `${String(receipt.refMonth).padStart(2, "0")}/${receipt.refYear}`,
    };
  };

  const getNfseEmissao = (invoiceId: string) => {
    return emissoes?.find(e => e.origemId === invoiceId && e.origemTipo === "INVOICE");
  };

  const filteredInvoices = invoices?.filter((i) => {
    const client = getClientName(i);
    const company = getCompanyName(i);
    const receipt = getReceiptInfo(i.receiptId);
    
    const matchesSearch = (
      client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.contract.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.number?.includes(searchTerm)
    );

    const emissao = getNfseEmissao(i.id);
    let displayStatus = emissao ? emissao.status : i.status;
    // Se tiver boleto emitido e status não for de erro/cancelamento, considera como boleto emitido para filtro
    if (i.boletoStatus === 'ISSUED' && !['FALHOU', 'CANCELADA', 'error', 'cancelled'].includes(displayStatus)) {
         displayStatus = 'BOLETO_EMITIDO';
    }

    const matchesStatus = statusFilter === "all" || displayStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const draftCount = invoices?.filter((i) => i.status === "draft" || i.status === "PENDENTE").length || 0;
  const issuedCount = invoices?.filter((i) => i.status === "issued" || i.status === "EMITIDA" || (getNfseEmissao(i.id)?.status === 'EMITIDA')).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notas Fiscais</h1>
          <p className="text-muted-foreground">Gerencie a emissão de notas fiscais</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rascunhos</CardTitle>
            <div className="p-2 rounded-md bg-yellow-500/10">
              <FileText className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftCount}</div>
            <p className="text-xs text-muted-foreground">Aguardando emissão</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Emitidas</CardTitle>
            <div className="p-2 rounded-md bg-green-500/10">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{issuedCount}</div>
            <p className="text-xs text-muted-foreground">Notas emitidas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                Lista de Notas Fiscais
              </CardTitle>
              <CardDescription>{invoices?.length || 0} notas registradas</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                {selectedInvoices.length > 0 && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => {
                        if (confirm(`Tem certeza que deseja excluir ${selectedInvoices.length} notas fiscais?`)) {
                            batchDeleteMutation.mutate(selectedInvoices);
                        }
                    }}
                    disabled={batchDeleteMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir Selecionadas ({selectedInvoices.length})
                  </Button>
                )}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" data-testid="input-search-invoices" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(statusLabels).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredInvoices && filteredInvoices.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox 
                        checked={
                          filteredInvoices && 
                          filteredInvoices.length > 0 && 
                          filteredInvoices.filter(i => {
                            const e = getNfseEmissao(i.id);
                            return (e ? e.status : i.status) !== "EMITIDA";
                          }).length > 0 &&
                          filteredInvoices.filter(i => {
                            const e = getNfseEmissao(i.id);
                            return (e ? e.status : i.status) !== "EMITIDA";
                          }).every(i => selectedInvoices.includes(i.id))
                        }
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">Contrato</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="hidden lg:table-cell">Número NF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const client = getClientName(invoice);
                    const company = getCompanyName(invoice);
                    const receipt = getReceiptInfo(invoice.receiptId);
                    const emissao = getNfseEmissao(invoice.id);
                    
                    // Lógica de Status para Exibição
                    let displayStatus = emissao ? emissao.status : invoice.status;
                    const isBoletoIssued = invoice.boletoStatus === 'ISSUED';
                    const isNfseIssued = displayStatus === 'EMITIDA';
                    
                    // Se boleto emitido, mas NF não, status é Boleto Emitido
                    // Se ambos, queremos mostrar ambos (tratado na renderização)
                    // Para fins de filtro e lógica de botões, precisamos manter o displayStatus consistente
                    
                    const StatusIcon = statusLabels[displayStatus]?.icon || FileText;
                    const isDeletable = displayStatus !== "EMITIDA";
                    
                    return (
                      <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                        <TableCell>
                           <Checkbox 
                              checked={selectedInvoices.includes(invoice.id)}
                              onCheckedChange={() => toggleSelect(invoice.id)}
                              aria-label={`Select invoice ${invoice.number}`}
                              disabled={!isDeletable}
                           />
                        </TableCell>
                        <TableCell className="font-medium max-w-[150px] truncate" title={typeof company === 'string' ? company : ''}>{company}</TableCell>
                        <TableCell className="max-w-[150px] truncate" title={typeof client === 'string' ? client : ''}>{client}</TableCell>
                        <TableCell className="hidden md:table-cell max-w-[150px] truncate" title={receipt.contract}>{receipt.contract}</TableCell>
                        <TableCell>{receipt.ref}</TableCell>
                        <TableCell className="font-medium">R$ {Number(invoice.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-sm">{emissao?.numero || invoice.number || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {/* Badge de Boleto */}
                            {isBoletoIssued && (
                              <Badge variant="default" className="gap-1 w-fit bg-amber-600 hover:bg-amber-700">
                                <Barcode className="h-3 w-3" />
                                Boleto Emitido
                              </Badge>
                            )}

                            {/* Badge de Email Enviado */}
                            {invoice.emailStatus === 'SENT' && (
                              <Badge variant="outline" className="gap-1 w-fit text-green-600 border-green-200 bg-green-50">
                                <Mail className="h-3 w-3" />
                                Enviado em {invoice.emailSentAt ? new Date(invoice.emailSentAt).toLocaleDateString() : 'Sim'}
                              </Badge>
                            )}

                            {/* Badge de Status NFS-e (Mostra se não for boleto emitido OU se for NF emitida/erro/cancelada) */}
                            {(!isBoletoIssued || isNfseIssued || ['FALHOU', 'CANCELADA', 'error', 'cancelled'].includes(displayStatus)) && (
                              <Badge variant={statusLabels[displayStatus]?.variant || "secondary"} className="gap-1 w-fit">
                                <StatusIcon className="h-3 w-3" />
                                {statusLabels[displayStatus]?.label || displayStatus}
                              </Badge>
                            )}
                            
                            {displayStatus === "FALHOU" && emissao?.erroMensagem && (
                              <span className="text-xs text-destructive block mt-1 truncate max-w-[200px]" title={emissao.erroMensagem}>{emissao.erroMensagem}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {/* Ação Primária: Emitir NF (se pendente/falha) */}
                            {(!emissao || ["PENDENTE", "FALHOU", "ENVIANDO", "PROCESSANDO", "draft", "error"].includes(displayStatus)) && (
                                <Button
                                  size="sm"
                                  onClick={() => issueInvoiceMutation.mutate(invoice)}
                                  disabled={issueInvoiceMutation.isPending || processNfseMutation.isPending}
                                  data-testid={`button-issue-invoice-${invoice.id}`}
                                >
                                  {processNfseMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Emitir NF"
                                  )}
                                </Button>
                            )}

                            {/* Ação de Boleto (Visível se emitido ou se NF emitida) */}
                            <Button
                                size="sm"
                                variant="outline"
                                className={`h-8 w-8 p-0 ${invoice.boletoStatus === 'ISSUED' ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-blue-600 hover:text-blue-700 hover:bg-blue-50"}`}
                                onClick={() => {
                                   if (invoice.boletoStatus === 'ISSUED') {
                                     window.open(`/api/invoices/${invoice.id}/boleto/pdf`, '_blank');
                                   } else {
                                     if (confirm("Deseja emitir o boleto para esta Nota Fiscal pelo Banco Inter?")) {
                                       issueBoletoMutation.mutate(invoice.id);
                                     }
                                   }
                                }}
                                title={invoice.boletoStatus === 'ISSUED' ? "Ver Boleto" : "Emitir Boleto Inter"}
                                disabled={issueBoletoMutation.isPending}
                            >
                                {issueBoletoMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Barcode className="h-4 w-4" />
                                )}
                            </Button>

                            {invoice.boletoStatus === 'ISSUED' && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                  onClick={() => {
                                    if (confirm("Deseja cancelar/liberar este boleto para nova emissão?")) {
                                      cancelBoletoMutation.mutate(invoice.id);
                                    }
                                  }}
                                  disabled={cancelBoletoMutation.isPending}
                                  title="Cancelar/Liberar Boleto"
                                >
                                  {cancelBoletoMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
                            )}
                            
                            {emissao?.status === "EMITIDA" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => sendEmailMutation.mutate(invoice.id)}
                                  title={invoice.emailStatus === 'SENT' ? "Reenviar Email" : "Enviar Email para Cliente"}
                                  disabled={sendEmailMutation.isPending}
                                >
                                  {sendEmailMutation.isPending && sendEmailMutation.variables === invoice.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Mail className="h-4 w-4" />
                                  )}
                                </Button>
                                
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                  onClick={() => handleViewDetails(emissao)}
                                  title="Ver Detalhes (Chave, Retorno)"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                  onClick={() => window.open(`/api/nfse/emissoes/${emissao.id}/xml`, '_blank')}
                                  title="Baixar XML"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                {emissao.chaveAcesso && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50 border-purple-200"
                                        title="Imprimir DANFSe"
                                      >
                                        <Printer className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => window.open(`/api/nfse/emissoes/${emissao.id}/danfse/proxy`, '_blank')}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Visualizar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                          const link = document.createElement('a');
                                          link.href = `/api/nfse/emissoes/${emissao.id}/danfse/proxy?download=true`;
                                          link.download = `DANFSE_${emissao.chaveAcesso}.pdf`;
                                          document.body.appendChild(link);
                                          link.click();
                                          document.body.removeChild(link);
                                      }}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Download
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                                {emissao.pdfUrl && (
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                      onClick={() => window.open(emissao.pdfUrl || '', '_blank')}
                                      title="Baixar PDF"
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => {
                                       setManualFixEmissao(emissao);
                                       setManualStatus(emissao.status);
                                       setManualNumero(emissao.numero || "");
                                       setManualChave(emissao.chaveAcesso || "");
                                       setManualErro(emissao.erroMensagem || "");
                                       setIsManualFixOpen(true);
                                     }}
                                  title="Correção Manual"
                                >
                                  <Wrench className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                  onClick={() => handleCancelClick(emissao.id)}
                                  title="Cancelar NFS-e"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              </>
                            )}

                            {(["draft", "error", "PENDENTE", "FALHOU", "ENVIANDO", "PROCESSANDO", "CANCELADA", "cancelled"].includes(displayStatus)) && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm("Tem certeza que deseja excluir esta nota fiscal?")) {
                                    deleteInvoiceMutation.mutate(invoice.id);
                                  }
                                }}
                                disabled={deleteInvoiceMutation.isPending}
                                title="Excluir NF"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={FileCheck}
              title="Nenhuma nota fiscal encontrada"
              description="As notas fiscais são geradas a partir dos recibos pagos."
            />
          )}
        </CardContent>
      </Card>


      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Emissão NFS-e</DialogTitle>
            <DialogDescription>
                Informações retornadas pela API Nacional
            </DialogDescription>
          </DialogHeader>
          
          {selectedEmissao && (
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-muted-foreground">Status</label>
                        <p className="font-semibold">{selectedEmissao.status}</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-muted-foreground">Número NFS-e</label>
                        <p className="font-semibold">{selectedEmissao.numero || "-"}</p>
                    </div>
                    <div className="col-span-2">
                        <label className="text-sm font-medium text-muted-foreground">Chave de Acesso</label>
                        <div className="flex items-center gap-2">
                             <code className="bg-muted p-2 rounded text-sm w-full break-all">
                                {selectedEmissao.chaveAcesso || "Não disponível"}
                             </code>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-muted-foreground">Data Emissão</label>
                        <p>{new Date(selectedEmissao.updatedAt).toLocaleString()}</p>
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium text-muted-foreground">Retorno da API (Raw)</label>
                    <div className="bg-muted p-4 rounded-md overflow-x-auto mt-1">
                        <pre className="text-xs whitespace-pre-wrap">
                            {selectedEmissao.apiResponseRaw ? 
                                (selectedEmissao.apiResponseRaw.startsWith('{') ? 
                                    JSON.stringify(JSON.parse(selectedEmissao.apiResponseRaw), null, 2) : 
                                    selectedEmissao.apiResponseRaw
                                ) 
                            : "Sem dados brutos"}
                        </pre>
                    </div>
                </div>

                {selectedEmissao.apiRequestRaw && (
                    <div>
                        <label className="text-sm font-medium text-muted-foreground">Requisição Enviada (Raw)</label>
                         <div className="bg-muted p-4 rounded-md overflow-x-auto mt-1">
                            <pre className="text-xs whitespace-pre-wrap">
                                {selectedEmissao.apiRequestRaw}
                            </pre>
                        </div>
                    </div>
                )}

                {selectedEmissao.cancelamentoXmlResponse && (
                    <div className="border-t pt-4 mt-4">
                        <h4 className="font-semibold mb-2 text-destructive">Dados do Cancelamento</h4>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Retorno do Cancelamento (Raw)</label>
                            <div className="bg-muted p-4 rounded-md overflow-x-auto mt-1">
                                <pre className="text-xs whitespace-pre-wrap">
                                    {selectedEmissao.cancelamentoXmlResponse.startsWith('{') ? 
                                        JSON.stringify(JSON.parse(selectedEmissao.cancelamentoXmlResponse), null, 2) : 
                                        selectedEmissao.cancelamentoXmlResponse
                                    }
                                </pre>
                            </div>
                        </div>
                    </div>
                )}

                {selectedEmissao.cancelamentoXmlRequest && (
                    <div>
                        <label className="text-sm font-medium text-muted-foreground">Requisição de Cancelamento (Raw)</label>
                         <div className="bg-muted p-4 rounded-md overflow-x-auto mt-1">
                            <pre className="text-xs whitespace-pre-wrap">
                                {selectedEmissao.cancelamentoXmlRequest}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={isManualFixOpen} onOpenChange={setIsManualFixOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correção Manual de Status</DialogTitle>
            <DialogDescription>
              Ajuste manualmente o status e dados da NFS-e caso tenha ocorrido divergência.
            </DialogDescription>
          </DialogHeader>
          {manualFixEmissao && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label>Status</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value)}
                >
                  <option value="PENDENTE">PENDENTE</option>
                  <option value="PROCESSANDO">PROCESSANDO</option>
                  <option value="EMITIDA">EMITIDA</option>
                  <option value="CANCELADA">CANCELADA</option>
                  <option value="FALHOU">FALHOU</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label>Número NFS-e</label>
                <Input 
                  value={manualNumero}
                  onChange={(e) => setManualNumero(e.target.value)}
                  placeholder="Ex: 1234" 
                />
              </div>
              <div className="grid gap-2">
                <label>Chave de Acesso</label>
                <Input 
                  value={manualChave}
                  onChange={(e) => setManualChave(e.target.value)}
                  placeholder="Chave de Acesso da NFS-e" 
                />
              </div>
               <div className="grid gap-2">
                <label>Mensagem de Erro (Opcional)</label>
                <Input 
                  value={manualErro}
                  onChange={(e) => setManualErro(e.target.value)}
                  placeholder="Limpar mensagem de erro" 
                />
              </div>
              <Button 
                onClick={() => {
                  console.log("Iniciando correção manual...", {
                    id: manualFixEmissao.id,
                    data: { 
                      status: manualStatus, 
                      numeroNfse: manualNumero, 
                      chaveAcesso: manualChave, 
                      erroMensagem: manualErro 
                    }
                  });
                  manualUpdateNfseMutation.mutate({
                    id: manualFixEmissao.id,
                    data: { 
                      status: manualStatus, 
                      numeroNfse: manualNumero, 
                      chaveAcesso: manualChave, 
                      erroMensagem: manualErro 
                    }
                  });
                }}
                disabled={manualUpdateNfseMutation.isPending}
              >
                {manualUpdateNfseMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Correção"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
