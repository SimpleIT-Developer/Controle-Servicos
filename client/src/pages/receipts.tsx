import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Receipt, Search, Loader2, Check, DollarSign, Send, FileCheck, RefreshCw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Receipt as ReceiptType, Contract, Property, Tenant, Landlord } from "@shared/schema";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Rascunho", variant: "outline" },
  closed: { label: "Fechado", variant: "secondary" },
  paid: { label: "Pago", variant: "default" },
  transferred: { label: "Repassado", variant: "default" },
};

const months = [
  { value: "1", label: "Janeiro" }, { value: "2", label: "Fevereiro" }, { value: "3", label: "Março" },
  { value: "4", label: "Abril" }, { value: "5", label: "Maio" }, { value: "6", label: "Junho" },
  { value: "7", label: "Julho" }, { value: "8", label: "Agosto" }, { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" }, { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
];

export default function ReceiptsPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptType | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { toast } = useToast();

  const { data: receipts, isLoading } = useQuery<ReceiptType[]>({ 
    queryKey: ["/api/receipts", filterYear, filterMonth],
    queryFn: async () => {
      const res = await fetch(`/api/receipts?year=${filterYear}&month=${filterMonth}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch receipts");
      return res.json();
    }
  });
  const { data: contracts } = useQuery<Contract[]>({ queryKey: ["/api/contracts"] });
  const { data: properties } = useQuery<Property[]>({ queryKey: ["/api/properties"] });
  const { data: tenants } = useQuery<Tenant[]>({ queryKey: ["/api/tenants"] });
  const { data: landlords } = useQuery<Landlord[]>({ queryKey: ["/api/landlords"] });

  const generateMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/receipts/generate", { year: filterYear, month: filterMonth }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({ title: "Sucesso", description: "Recibos gerados com sucesso." });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const closeReceiptMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/receipts/${id}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      setIsDetailOpen(false);
      toast({ title: "Sucesso", description: "Recibo fechado com sucesso." });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/receipts/${id}/mark-paid`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash"] });
      setIsDetailOpen(false);
      toast({ title: "Sucesso", description: "Pagamento registrado com sucesso." });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const createTransferMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/receipts/${id}/create-transfer`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      setIsDetailOpen(false);
      toast({ title: "Sucesso", description: "Repasse gerado com sucesso." });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/receipts/${id}/create-invoice`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsDetailOpen(false);
      toast({ title: "Sucesso", description: "Nota fiscal gerada com sucesso." });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const getContractInfo = (contractId: string) => {
    const contract = contracts?.find((c) => c.id === contractId);
    if (!contract) return { property: "-", tenant: "-", landlord: "-" };
    const property = properties?.find((p) => p.id === contract.propertyId);
    const tenant = tenants?.find((t) => t.id === contract.tenantId);
    const landlord = landlords?.find((l) => l.id === contract.landlordId);
    return { property: property?.title || "-", tenant: tenant?.name || "-", landlord: landlord?.name || "-" };
  };

  const openDetail = (receipt: ReceiptType) => {
    setSelectedReceipt(receipt);
    setIsDetailOpen(true);
  };

  const isPending = generateMutation.isPending || closeReceiptMutation.isPending || markPaidMutation.isPending || createTransferMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recibos do Mês</h1>
          <p className="text-muted-foreground">Gerencie os recibos mensais dos contratos</p>
        </div>
        <Button onClick={() => generateMutation.mutate()} disabled={isPending} data-testid="button-generate-receipts">
          {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Gerar Recibos do Mês
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Lista de Recibos
              </CardTitle>
              <CardDescription>{receipts?.length || 0} recibos encontrados</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(parseInt(v))}>
                <SelectTrigger className="w-32" data-testid="select-filter-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="number" className="w-24" value={filterYear} onChange={(e) => setFilterYear(parseInt(e.target.value))} data-testid="input-filter-year" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : receipts && receipts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imóvel</TableHead>
                    <TableHead className="hidden md:table-cell">Locatário</TableHead>
                    <TableHead>Aluguel</TableHead>
                    <TableHead>Total Locatário</TableHead>
                    <TableHead className="hidden lg:table-cell">Total Locador</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((receipt) => {
                    const info = getContractInfo(receipt.contractId);
                    return (
                      <TableRow key={receipt.id} data-testid={`row-receipt-${receipt.id}`}>
                        <TableCell className="font-medium">{info.property}</TableCell>
                        <TableCell className="hidden md:table-cell">{info.tenant}</TableCell>
                        <TableCell>R$ {Number(receipt.rentAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-medium text-green-600 dark:text-green-400">
                          R$ {Number(receipt.tenantTotalDue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          R$ {Number(receipt.landlordTotalDue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusLabels[receipt.status]?.variant || "secondary"}>
                            {statusLabels[receipt.status]?.label || receipt.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => openDetail(receipt)} data-testid={`button-view-receipt-${receipt.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum recibo encontrado</h3>
              <p className="text-sm text-muted-foreground">Clique em "Gerar Recibos do Mês" para criar os recibos dos contratos ativos.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Recibo</DialogTitle>
            <DialogDescription>
              {selectedReceipt && `Referência: ${String(selectedReceipt.refMonth).padStart(2, "0")}/${selectedReceipt.refYear}`}
            </DialogDescription>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Imóvel:</span>
                  <span className="font-medium">{getContractInfo(selectedReceipt.contractId).property}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Locatário:</span>
                  <span>{getContractInfo(selectedReceipt.contractId).tenant}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Locador:</span>
                  <span>{getContractInfo(selectedReceipt.contractId).landlord}</span>
                </div>
              </div>
              <Separator />
              <div className="grid gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Aluguel:</span>
                  <span>R$ {Number(selectedReceipt.rentAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa Administração ({Number(selectedReceipt.adminFeePercent)}%):</span>
                  <span>R$ {Number(selectedReceipt.adminFeeAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Serviços (Locatário):</span>
                  <span>R$ {Number(selectedReceipt.servicesTenantTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Serviços (Locador):</span>
                  <span>R$ {Number(selectedReceipt.servicesLandlordTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <Separator />
              <div className="grid gap-2">
                <div className="flex justify-between font-medium">
                  <span>Total a pagar (Locatário):</span>
                  <span className="text-green-600 dark:text-green-400">R$ {Number(selectedReceipt.tenantTotalDue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Total a repassar (Locador):</span>
                  <span>R$ {Number(selectedReceipt.landlordTotalDue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge variant={statusLabels[selectedReceipt.status]?.variant || "secondary"}>
                  {statusLabels[selectedReceipt.status]?.label || selectedReceipt.status}
                </Badge>
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {selectedReceipt?.status === "draft" && (
              <Button onClick={() => closeReceiptMutation.mutate(selectedReceipt.id)} disabled={isPending} data-testid="button-close-receipt">
                <Check className="mr-2 h-4 w-4" />
                Fechar Recibo
              </Button>
            )}
            {selectedReceipt?.status === "closed" && (
              <Button onClick={() => markPaidMutation.mutate(selectedReceipt.id)} disabled={isPending} data-testid="button-mark-paid">
                <DollarSign className="mr-2 h-4 w-4" />
                Marcar como Pago
              </Button>
            )}
            {selectedReceipt?.status === "paid" && (
              <>
                <Button onClick={() => createTransferMutation.mutate(selectedReceipt.id)} disabled={isPending} variant="outline" data-testid="button-create-transfer">
                  <Send className="mr-2 h-4 w-4" />
                  Gerar Repasse
                </Button>
                <Button onClick={() => createInvoiceMutation.mutate(selectedReceipt.id)} disabled={isPending} variant="outline" data-testid="button-create-invoice">
                  <FileCheck className="mr-2 h-4 w-4" />
                  Emitir NF
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
