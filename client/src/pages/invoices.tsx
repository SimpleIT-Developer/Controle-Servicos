import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, FileCheck, Loader2, Check, AlertCircle, FileText, Trash2, Ban, Download, RefreshCw, Eye, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Invoice, Landlord, Receipt, Contract, Property, NfseEmissao } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  draft: { label: "Rascunho", variant: "outline", icon: FileText },
  issued: { label: "Emitida", variant: "default", icon: Check },
  error: { label: "Erro", variant: "destructive", icon: AlertCircle },
  cancelled: { label: "Cancelada", variant: "secondary", icon: Ban },
  PENDENTE: { label: "Pendente", variant: "secondary", icon: Loader2 },
  ENVIANDO: { label: "Enviando", variant: "secondary", icon: Loader2 },
  EMITIDA: { label: "NFS-e Emitida", variant: "default", icon: Check },
  FALHOU: { label: "Falha Emissão", variant: "destructive", icon: AlertCircle },
};

export default function InvoicesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmissao, setSelectedEmissao] = useState<NfseEmissao | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: invoices, isLoading: isLoadingInvoices } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: landlords, isLoading: isLoadingLandlords } = useQuery<Landlord[]>({ queryKey: ["/api/landlords"] });
  const { data: receipts, isLoading: isLoadingReceipts } = useQuery<Receipt[]>({ queryKey: ["/api/receipts"] });
  const { data: contracts, isLoading: isLoadingContracts } = useQuery<Contract[]>({ queryKey: ["/api/contracts"] });
  const { data: properties, isLoading: isLoadingProperties } = useQuery<Property[]>({ queryKey: ["/api/properties"] });
  const { data: emissoes, isLoading: isLoadingEmissoes } = useQuery<NfseEmissao[]>({ queryKey: ["/api/nfse/emissoes"] });

  const isLoading = isLoadingInvoices || isLoadingLandlords || isLoadingReceipts || isLoadingContracts || isLoadingProperties || isLoadingEmissoes;

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
      const landlord = landlords?.find(l => l.id === invoice.landlordId);
      const receipt = receipts?.find(r => r.id === invoice.receiptId);
      const contract = contracts?.find(c => c.id === receipt?.contractId);
      const property = properties?.find(p => p.id === contract?.propertyId);
      
      const payload = {
        origemId: invoice.id,
        origemTipo: "INVOICE",
        valor: invoice.amount,
        tomadorNome: landlord?.name || "Desconhecido",
        tomadorCpfCnpj: landlord?.doc || "", 
        discriminacao: `Serviço de administração de imóveis - Ref: ${receipt?.refMonth}/${receipt?.refYear} - ${property?.address || ''}`
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
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const getLandlordName = (landlordId: string) => landlords?.find((l) => l.id === landlordId)?.name || "-";

  const getReceiptInfo = (receiptId: string) => {
    const receipt = receipts?.find((r) => r.id === receiptId);
    if (!receipt) return { property: "-", ref: "-" };
    const contract = contracts?.find((c) => c.id === receipt.contractId);
    const property = properties?.find((p) => p.id === contract?.propertyId);
    return {
      property: property?.title || "-",
      ref: `${String(receipt.refMonth).padStart(2, "0")}/${receipt.refYear}`,
    };
  };

  const getNfseEmissao = (invoiceId: string) => {
    return emissoes?.find(e => e.origemId === invoiceId && e.origemTipo === "INVOICE");
  };

  const filteredInvoices = invoices?.filter((i) => {
    const landlord = getLandlordName(i.landlordId);
    const receipt = getReceiptInfo(i.receiptId);
    return (
      landlord.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.property.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.number?.includes(searchTerm)
    );
  });

  const draftCount = invoices?.filter((i) => i.status === "draft").length || 0;
  const issuedCount = invoices?.filter((i) => i.status === "issued" || (getNfseEmissao(i.id)?.status === 'EMITIDA')).length || 0;

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
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" data-testid="input-search-invoices" />
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
                    <TableHead>Proprietário</TableHead>
                    <TableHead className="hidden md:table-cell">Imóvel</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="hidden lg:table-cell">Número NF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const landlord = getLandlordName(invoice.landlordId);
                    const receipt = getReceiptInfo(invoice.receiptId);
                    const emissao = getNfseEmissao(invoice.id);
                    
                    // Prioriza status da emissão NFS-e se existir, senão usa status da invoice
                    const displayStatus = emissao ? emissao.status : invoice.status;
                    const StatusIcon = statusLabels[displayStatus]?.icon || FileText;
                    
                    return (
                      <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                        <TableCell className="font-medium">{landlord}</TableCell>
                        <TableCell className="hidden md:table-cell">{receipt.property}</TableCell>
                        <TableCell>{receipt.ref}</TableCell>
                        <TableCell className="font-medium">R$ {Number(invoice.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-sm">{emissao?.numeroNfse || invoice.number || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={statusLabels[displayStatus]?.variant || "secondary"} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {statusLabels[displayStatus]?.label || displayStatus}
                          </Badge>
                          {displayStatus === "FALHOU" && emissao?.erroMensagem && (
                            <span className="text-xs text-destructive block mt-1 truncate max-w-[200px]" title={emissao.erroMensagem}>{emissao.erroMensagem}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {(!emissao || emissao.status === "PENDENTE" || emissao.status === "FALHOU") && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => issueInvoiceMutation.mutate(invoice)}
                                  disabled={issueInvoiceMutation.isPending || processNfseMutation.isPending}
                                  data-testid={`button-issue-invoice-${invoice.id}`}
                                >
                                  {(issueInvoiceMutation.isPending || processNfseMutation.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (emissao?.status === "FALHOU" ? <RefreshCw className="mr-2 h-4 w-4" /> : <FileCheck className="mr-2 h-4 w-4" />)}
                                  {emissao?.status === "FALHOU" ? "Reprocessar" : "Emitir NF"}
                                </Button>
                              </>
                            )}
                            
                            {emissao?.status === "EMITIDA" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                  onClick={() => handleViewDetails(emissao)}
                                  title="Ver Detalhes (Chave, Retorno)"
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  Detalhes
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                  onClick={() => window.open(`/api/nfse/emissoes/${emissao.id}/xml`, '_blank')}
                                  title="Baixar XML"
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  XML
                                </Button>
                                {emissao.chaveAcesso && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 border-purple-200"
                                      onClick={() => window.open(`/api/nfse/danfse/${emissao.chaveAcesso}`, '_blank')}
                                      title="Imprimir DANFSe"
                                    >
                                      <Printer className="mr-2 h-4 w-4" />
                                      DANFSe
                                    </Button>
                                )}
                                {emissao.pdfUrl && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                      onClick={() => window.open(emissao.pdfUrl || '', '_blank')}
                                      title="Baixar PDF"
                                    >
                                      <FileText className="mr-2 h-4 w-4" />
                                      PDF
                                    </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                  onClick={() => handleCancelClick(emissao.id)}
                                  title="Cancelar NFS-e"
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Cancelar
                                </Button>
                              </>
                            )}

                            {(!emissao && ["draft", "error"].includes(invoice.status)) && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileCheck className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Nenhuma nota fiscal encontrada</h3>
              <p className="text-sm text-muted-foreground">As notas fiscais são geradas a partir dos recibos pagos.</p>
            </div>
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
                        <p className="font-semibold">{selectedEmissao.numeroNfse || "-"}</p>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
