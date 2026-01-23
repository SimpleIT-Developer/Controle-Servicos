import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, FileCheck, Loader2, Check, AlertCircle, FileText, Trash2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Invoice, Landlord, Receipt, Contract, Property } from "@shared/schema";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  draft: { label: "Rascunho", variant: "outline", icon: FileText },
  issued: { label: "Emitida", variant: "default", icon: Check },
  error: { label: "Erro", variant: "destructive", icon: AlertCircle },
  cancelled: { label: "Cancelada", variant: "secondary", icon: Ban },
};

export default function InvoicesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: invoices, isLoading } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: landlords } = useQuery<Landlord[]>({ queryKey: ["/api/landlords"] });
  const { data: receipts } = useQuery<Receipt[]>({ queryKey: ["/api/receipts"] });
  const { data: contracts } = useQuery<Contract[]>({ queryKey: ["/api/contracts"] });
  const { data: properties } = useQuery<Property[]>({ queryKey: ["/api/properties"] });

  const issueInvoiceMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/invoices/${id}/issue`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({ title: "Sucesso", description: "Nota fiscal emitida com sucesso (mock)." });
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
    mutationFn: async (id: string) => apiRequest("POST", `/api/invoices/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Sucesso", description: "Nota fiscal cancelada com sucesso." });
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
  const issuedCount = invoices?.filter((i) => i.status === "issued").length || 0;

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
                    <TableHead>Locador</TableHead>
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
                    const StatusIcon = statusLabels[invoice.status]?.icon || FileText;
                    return (
                      <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                        <TableCell className="font-medium">{landlord}</TableCell>
                        <TableCell className="hidden md:table-cell">{receipt.property}</TableCell>
                        <TableCell>{receipt.ref}</TableCell>
                        <TableCell className="font-medium">R$ {Number(invoice.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-sm">{invoice.number || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={statusLabels[invoice.status]?.variant || "secondary"} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {statusLabels[invoice.status]?.label || invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {invoice.status === "draft" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => issueInvoiceMutation.mutate(invoice.id)}
                                  disabled={issueInvoiceMutation.isPending}
                                  data-testid={`button-issue-invoice-${invoice.id}`}
                                >
                                  {issueInvoiceMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck className="mr-2 h-4 w-4" />}
                                  Emitir NF
                                </Button>
                              </>
                            )}
                            
                            {invoice.status === "issued" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
                                onClick={() => {
                                  if (confirm("Tem certeza que deseja cancelar esta nota fiscal?")) {
                                    cancelInvoiceMutation.mutate(invoice.id);
                                  }
                                }}
                                disabled={cancelInvoiceMutation.isPending}
                                title="Cancelar NF"
                              >
                                {cancelInvoiceMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                                Cancelar
                              </Button>
                            )}

                            {["draft", "error", "cancelled"].includes(invoice.status) && (
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
                          {invoice.status === "error" && invoice.errorMessage && (
                            <span className="text-xs text-destructive block mt-1">{invoice.errorMessage}</span>
                          )}
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
    </div>
  );
}
