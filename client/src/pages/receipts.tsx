import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Receipt, Search, Loader2, Check, DollarSign, Send, FileCheck, RefreshCw, Eye, AlertCircle, RotateCcw, Printer, Plus, Barcode, XCircle, Trash2, Pencil, TrendingUp, TrendingDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/empty-state";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { decimalToTime, timeToDecimal } from "@/lib/utils";
import type { Receipt as ReceiptType, Contract, Client, Company, ContractItem, Analyst, Project, Partner, TimesheetEntry, ProjectAnalyst, ProjectPartner, SystemContract } from "@shared/schema";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Pendente", variant: "outline" },
  closed: { label: "Fechado", variant: "secondary" },
  paid: { label: "Pago", variant: "default" },
  transferred: { label: "Repassado", variant: "default" },
  NF_GERADA: { label: "NF Gerada", variant: "default" },
  NF_EMITIDA: { label: "NF Emitida", variant: "default" },
  BOLETO_EMITIDO: { label: "Boleto Emitido", variant: "default" },
};

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

function GenerateInvoiceDialog({
  receipt,
  open,
  onOpenChange,
  onSuccess
}: {
  receipt: ReceiptType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"total" | "partial">("total");
  const [splits, setSplits] = useState(2);
  const [splitValues, setSplitValues] = useState<string[]>(["0", "0"]);
  const [nonIssuedAmount, setNonIssuedAmount] = useState<string>("0");
  const { toast } = useToast();

  useEffect(() => {
    if (open && receipt) {
      // Only initialize if not already initialized or if we want to reset on open
      // We can check if mode is default to decide, but safer to just rely on open transition
      setMode("total");
      setSplits(2);
      setNonIssuedAmount("0");
      const half = (Number(receipt.totalDue) / 2).toFixed(2);
      setSplitValues([half, half]);
    }
  }, [open]); // Removed receipt from dependencies to prevent reset on background updates

  const recalculateSplits = (count: number, nonIssued: number) => {
    if (!receipt) return;
    
    const totalToSplit = Math.max(0, Number(receipt.totalDue) - nonIssued);
    
    if (count === 1) {
      // Logic for "Total" mode but with non-issued amount
      // Actually "Total" mode usually means 1 NF. 
      // If we have non-issued amount, "Total" means "One NF with the remaining amount".
      // But in this function we mostly handle the array for "partial".
      // Let's just return the array.
    }

    const part = (totalToSplit / count).toFixed(2);
    const parts = Array(count).fill(part);
    
    // Adjust rounding
    const sum = parts.reduce((a, b) => a + Number(b), 0);
    const diff = totalToSplit - sum;
    
    if (Math.abs(diff) > 0.001) {
      parts[count - 1] = (Number(parts[count - 1]) + diff).toFixed(2);
    }
    
    setSplitValues(parts);
  };

  const handleSplitsChange = (count: number) => {
    setSplits(count);
    recalculateSplits(count, Number(nonIssuedAmount));
  };

  const handleNonIssuedChange = (value: string) => {
    setNonIssuedAmount(value);
    recalculateSplits(splits, Number(value));
  };

  const handleValueChange = (index: number, value: string) => {
    const newValues = [...splitValues];
    newValues[index] = value;
    setSplitValues(newValues);
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!receipt) return;
      
      const nonIssued = Number(nonIssuedAmount);
      const totalDue = Number(receipt.totalDue);
      
      let amounts: number[] = [];

      if (mode === "total") {
        // If "Total" mode, we generate ONE invoice with (Total - NonIssued)
        amounts = [totalDue - nonIssued];
      } else {
        // Partial mode
        amounts = splitValues.map(v => Number(v));
      }

      // Validation
      const sumAmounts = amounts.reduce((a, b) => a + b, 0);
      const totalCheck = sumAmounts + nonIssued;
      
      if (Math.abs(totalCheck - totalDue) > 0.05) {
        throw new Error(`A soma das parcelas (R$ ${sumAmounts.toFixed(2)}) + Valor Não Emitido (R$ ${nonIssued.toFixed(2)}) deve ser igual ao total do recibo (R$ ${totalDue.toFixed(2)})`);
      }
      
      // Filter out zero amounts if any (though usually shouldn't happen unless intentional)
      // But user might want to generate 0 value invoice? Unlikely.
      if (amounts.some(a => a <= 0)) {
         throw new Error("Os valores das Notas Fiscais devem ser maiores que zero.");
      }

      const data = {
        receiptId: receipt.id,
        amounts: amounts
      };

      console.log("Generating invoices with data:", data); // Debug log

      const res = await apiRequest("POST", "/api/invoices", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nfse/emissoes"] });
      toast({ title: "Sucesso", description: "Nota(s) Fiscal(is) gerada(s) com sucesso!" });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  if (!receipt) return null;

  const total = Number(receipt.totalDue);
  const nonIssued = Number(nonIssuedAmount);
  
  // Validation display logic
  let currentSum = 0;
  if (mode === "total") {
    currentSum = total - nonIssued;
  } else {
    currentSum = splitValues.reduce((a, b) => a + Number(b), 0);
  }
  
  const totalCheck = currentSum + nonIssued;
  const remaining = total - totalCheck;
  const isValid = Math.abs(remaining) < 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Gerar Nota Fiscal</DialogTitle>
          <DialogDescription>
            Defina como a Nota Fiscal será gerada para o recibo de R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
             <Label>Valor Não Emitido (Opcional)</Label>
             <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">R$</span>
                <Input 
                  type="number" 
                  step="0.01" 
                  className="pl-9" 
                  value={nonIssuedAmount} 
                  onChange={(e) => handleNonIssuedChange(e.target.value)}
                />
             </div>
             <p className="text-xs text-muted-foreground">
               Valor que será deduzido do total a ser emitido em NF.
             </p>
          </div>

          <Separator />

          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "total" | "partial")}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="total" id="r-total" />
              <Label htmlFor="r-total">
                Nota Única 
                {nonIssued > 0 && ` (R$ ${(total - nonIssued).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="partial" id="r-partial" />
              <Label htmlFor="r-partial">Parcelado (Várias NFs)</Label>
            </div>
          </RadioGroup>

          {mode === "partial" && (
            <div className="space-y-4 pl-6 border-l-2 border-muted ml-1">
              <div className="space-y-2">
                <Label>Quantidade de Notas</Label>
                <Select value={splits.toString()} onValueChange={(v) => handleSplitsChange(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n} Notas</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valores das Notas</Label>
                {splitValues.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-6">{idx + 1}ª</span>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-2.5 text-muted-foreground">R$</span>
                      <Input 
                        type="number" 
                        step="0.01" 
                        className="pl-8" 
                        value={val} 
                        onChange={(e) => handleValueChange(idx, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className={`text-sm text-right font-medium ${!isValid ? "text-red-500" : "text-green-600"}`}>
            {isValid 
              ? "Total confere" 
              : `Diferença: R$ ${remaining.toFixed(2)}`}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending || !isValid}>
            {generateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gerar NF(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddServiceDialog({ 
  contractId, 
  year, 
  month, 
  onSuccess,
  serviceToEdit,
  trigger
}: { 
  contractId: string, 
  year: number, 
  month: number, 
  onSuccess: () => void,
  serviceToEdit?: ContractItem,
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"service" | "adjustment">("adjustment");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [chargedTo, setChargedTo] = useState<"CLIENT" | "COMPANY">("CLIENT");
  const [passThrough, setPassThrough] = useState(false);
  const [analystId, setAnalystId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      if (serviceToEdit) {
        setType(serviceToEdit.analystId ? "service" : "adjustment");
        setDescription(serviceToEdit.description);
        setAmount(serviceToEdit.amount.toString());
        setChargedTo(serviceToEdit.chargedTo as "CLIENT" | "COMPANY");
        setPassThrough(serviceToEdit.passThrough);
        setAnalystId(serviceToEdit.analystId || "");
      } else {
        // Reset for add mode
        setType("adjustment");
        setDescription("");
        setAmount("");
        setChargedTo("CLIENT");
        setPassThrough(false);
        setAnalystId("");
      }
    }
  }, [open, serviceToEdit]);

  const { data: analysts } = useQuery<Analyst[]>({ 
    queryKey: ["/api/analysts"],
    enabled: open && type === "service"
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        contractId,
        description,
        amount: Number(amount),
        chargedTo,
        passThrough,
        refYear: year,
        refMonth: month,
        analystId: type === "service" ? analystId : null,
      };
      
      if (serviceToEdit) {
        return apiRequest("PATCH", `/api/services/${serviceToEdit.id}`, data);
      } else {
        return apiRequest("POST", "/api/services", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-services"] });
      setOpen(false);
      if (!serviceToEdit) {
        setDescription("");
        setAmount("");
        setAnalystId("");
      }
      onSuccess();
      toast({ 
        title: "Sucesso", 
        description: serviceToEdit ? "Item atualizado com sucesso." : "Item adicionado com sucesso." 
      });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <Plus className="h-3 w-3" />
            Adicionar Item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{serviceToEdit ? "Editar Item" : "Adicionar Item ao Recibo"}</DialogTitle>
          <DialogDescription>
            {serviceToEdit ? "Edite os detalhes do serviço ou ajuste." : "Adicione um serviço ou ajuste para este mês. Será necessário regerar o recibo."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)} disabled={!!serviceToEdit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adjustment">Ajuste (Crédito/Débito)</SelectItem>
                  <SelectItem value="service">Serviço (Com Analista)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder={type === "service" ? "Ex: Manutenção Elétrica" : "Ex: Desconto Acordado"}
              required 
            />
          </div>

          {type === "service" && (
            <div className="space-y-2">
              <Label>Analista</Label>
              <Select value={analystId} onValueChange={setAnalystId} required={type === "service"}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o analista" />
                </SelectTrigger>
                <SelectContent>
                  {analysts?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cobrar de</Label>
              <Select value={chargedTo} onValueChange={(v: any) => setChargedTo(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLIENT">Cliente</SelectItem>
                  <SelectItem value="COMPANY">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2 pt-8">
              <Checkbox 
                id="passThrough" 
                checked={passThrough} 
                onCheckedChange={(c) => setPassThrough(!!c)} 
              />
              <Label htmlFor="passThrough" className="cursor-pointer">
                Repassar valor?
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Componente para exibir os detalhes dos serviços/ajustes
function ReceiptServicesDetail({ receiptId, contractId, year, month, storedClientTotal, storedCompanyTotal }: { 
  receiptId: string, 
  contractId: string, 
  year: number, 
  month: number,
  storedClientTotal: number,
  storedCompanyTotal: number
}) {
  const { data: services, isLoading } = useQuery<ContractItem[]>({
    queryKey: ["contract-services", contractId, year, month],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/services/${year}/${month}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
    enabled: !!contractId && !!year && !!month,
  });

  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/services/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-services"] });
      toast({ title: "Sucesso", description: "Item removido com sucesso." });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="py-2 text-center text-sm text-muted-foreground">Carregando detalhes...</div>;

  // Calculate totals regardless of whether services exist (for mismatch check)
  const liveClientTotal = (services || [])
    .filter(s => s.chargedTo === "CLIENT")
    .reduce((sum, s) => sum + Number(s.amount), 0);
    
  const liveCompanyTotal = (services || [])
    .filter(s => s.chargedTo === "COMPANY")
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const hasMismatch = 
    Math.abs(liveClientTotal - storedClientTotal) > 0.01 || 
    Math.abs(liveCompanyTotal - storedCompanyTotal) > 0.01;

  const analystServices = services?.filter(s => !!s.analystId) || [];
  const adjustments = services?.filter(s => !s.analystId) || [];

  return (
    <div className="space-y-4 pt-2">
      <div className="flex justify-between items-center border-b pb-1">
        <h4 className="text-sm font-medium text-muted-foreground">Serviços e Ajustes</h4>
        <AddServiceDialog 
          contractId={contractId} 
          year={year} 
          month={month} 
          onSuccess={() => {
            // Optional: trigger anything else needed on success
          }} 
        />
      </div>

      {hasMismatch && (
        <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>
            Os valores dos serviços mudaram. <strong>Regere o recibo</strong> para atualizar os totais.
          </span>
        </div>
      )}

      {(!services || services.length === 0) && (
        <EmptyState
          icon={Receipt}
          title="Nenhum serviço ou ajuste"
          description="Nenhum serviço ou ajuste lançado para este mês."
          className="py-8 border-none"
        />
      )}

      {analystServices.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Serviços / Contas</h4>
          <Table>
            <TableHeader>
              <TableRow className="h-8 hover:bg-transparent">
                <TableHead className="h-8 py-0 pl-2">Descrição</TableHead>
                <TableHead className="h-8 py-0 w-[100px]">Cobrar de</TableHead>
                <TableHead className="h-8 py-0 w-[140px] whitespace-nowrap">Repassar para</TableHead>
                <TableHead className="h-8 py-0 text-right w-[100px]">Valor</TableHead>
                <TableHead className="h-8 py-0 w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analystServices.map(service => (
                <TableRow key={service.id} className="h-8 group">
                  <TableCell className="py-1 pl-2 font-medium">{service.description}</TableCell>
                  <TableCell className="py-1">
                    <Badge variant="outline" className="text-[10px] h-5 px-1 font-normal">
                      {service.chargedTo === "CLIENT" ? "Cliente" : "Empresa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1">
                    {service.passThrough && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1 font-normal bg-blue-50 text-blue-700 hover:bg-blue-100">
                        {service.chargedTo === "CLIENT" ? "Empresa" : "Cliente"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-1 text-right font-medium">
                    R$ {Number(service.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="py-1 text-right flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <AddServiceDialog 
                      contractId={contractId} 
                      year={year} 
                      month={month} 
                      onSuccess={() => {}}
                      serviceToEdit={service}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-6 w-6 mr-1" title="Editar">
                          <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => deleteMutation.mutate(service.id)}
                      disabled={deleteMutation.isPending}
                      title="Excluir"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {adjustments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Ajustes / Créditos / Débitos</h4>
          <Table>
            <TableHeader>
              <TableRow className="h-8 hover:bg-transparent">
                <TableHead className="h-8 py-0 pl-2">Descrição</TableHead>
                <TableHead className="h-8 py-0 w-[100px] whitespace-nowrap">Aplicar em</TableHead>
                <TableHead className="h-8 py-0 text-right w-[100px]">Valor</TableHead>
                <TableHead className="h-8 py-0 w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.map(adj => (
                <TableRow key={adj.id} className="h-8 group">
                  <TableCell className="py-1 pl-2 font-medium">{adj.description}</TableCell>
                  <TableCell className="py-1">
                    <Badge variant="outline" className="text-[10px] h-5 px-1 font-normal">
                      {adj.chargedTo === "CLIENT" ? "Cliente" : "Empresa"}
                    </Badge>
                  </TableCell>
                  <TableCell className={`py-1 text-right font-medium ${Number(adj.amount) < 0 ? "text-green-600" : "text-red-600"}`}>
                    R$ {Number(adj.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="py-1 text-right flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <AddServiceDialog 
                      contractId={contractId} 
                      year={year} 
                      month={month} 
                      onSuccess={() => {}}
                      serviceToEdit={adj}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-6 w-6 mr-1" title="Editar">
                          <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => deleteMutation.mutate(adj.id)}
                      disabled={deleteMutation.isPending}
                      title="Excluir"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function TimesheetDialog({ 
  receiptId, 
  projectId, 
  onSuccess,
  entryToEdit,
  trigger
}: { 
  receiptId: string, 
  projectId: string, 
  onSuccess: () => void,
  entryToEdit?: TimesheetEntry,
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false);
  const [personType, setPersonType] = useState<"analyst" | "partner">("analyst");
  const [analystId, setAnalystId] = useState<string>("");
  const [partnerId, setPartnerId] = useState<string>("");
  const [inputHours, setInputHours] = useState("");
  const [inputMinutes, setInputMinutes] = useState("");
  const [billableRate, setBillableRate] = useState("");
  const [costRate, setCostRate] = useState("");
  const [analystPaymentType, setAnalystPaymentType] = useState<string>("hour");
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  const { data: projectAnalysts } = useQuery<(ProjectAnalyst & { analyst: Analyst })[]>({
    queryKey: [`/api/projects/${projectId}/analysts`],
    enabled: open
  });

  const { data: projectPartners } = useQuery<(ProjectPartner & { partner: Partner })[]>({
    queryKey: [`/api/projects/${projectId}/partners`],
    enabled: open
  });

  useEffect(() => {
    if (open) {
      if (entryToEdit) {
        setPersonType(entryToEdit.partnerId ? "partner" : "analyst");
        setAnalystId(entryToEdit.analystId || "");
        setPartnerId(entryToEdit.partnerId || "");
        
        const timeStr = decimalToTime(entryToEdit.hours);
        const [h, m] = timeStr.split(":");
        setInputHours(h);
        setInputMinutes(m);
        
        setBillableRate(entryToEdit.billableRate?.toString() || "");
        setCostRate(entryToEdit.costRate?.toString() || "");
        setAnalystPaymentType(entryToEdit.analystPaymentType || "hour");
        setDescription(entryToEdit.description || "");
      } else {
        setPersonType("analyst");
        setAnalystId("");
        setPartnerId("");
        setInputHours("");
        setInputMinutes("");
        setBillableRate("");
        setCostRate("");
        setAnalystPaymentType("hour");
        setDescription("");
      }
    }
  }, [open, entryToEdit]);

  // Auto-fill rates when person changes (only for new entries or when explicit change happens)
  useEffect(() => {
    if (entryToEdit) return; // Don't auto-overwrite on edit unless manually requested (could be improved)
    
    if (personType === "analyst" && analystId && projectAnalysts) {
      const relation = projectAnalysts.find(a => a.analystId === analystId);
      if (relation) {
        setBillableRate(relation.hourlyRate?.toString() || "");
        
        // Verifica se o analista tem pagamento fixo
        if (relation.analyst.paymentType === "fixed" && relation.analyst.fixedValue) {
          setCostRate(relation.analyst.fixedValue.toString());
          setAnalystPaymentType("fixed");
        } else {
          setCostRate(relation.costRate?.toString() || "");
          setAnalystPaymentType("hour");
        }
      }
    } else if (personType === "partner" && partnerId && projectPartners) {
      const relation = projectPartners.find(p => p.partnerId === partnerId);
      if (relation && relation.valueType === "hour") {
        setBillableRate(relation.value?.toString() || "");
        setCostRate(""); // Partners usually don't have cost rate in this context? Or maybe they do.
        setAnalystPaymentType("hour");
      }
    }
  }, [personType, analystId, partnerId, projectAnalysts, projectPartners, entryToEdit]);

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        receiptId,
        analystId: personType === "analyst" ? analystId : null,
        partnerId: personType === "partner" ? partnerId : null,
        hours: timeToDecimal(inputHours, inputMinutes),
        billableRate: billableRate || "0",
        costRate: costRate || "0",
        analystPaymentType,
        description,
      };
      
      if (entryToEdit) {
        return apiRequest("PATCH", `/api/timesheets/${entryToEdit.id}`, data);
      } else {
        return apiRequest("POST", "/api/timesheets", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt-timesheets", receiptId] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      setOpen(false);
      if (!entryToEdit) {
        setInputHours("");
        setInputMinutes("");
        setBillableRate("");
        setCostRate("");
        setDescription("");
      }
      onSuccess();
      toast({ 
        title: "Sucesso", 
        description: entryToEdit ? "Apontamento atualizado." : "Apontamento criado." 
      });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (personType === "analyst" && !analystId) {
      toast({ title: "Erro", description: "Selecione um analista", variant: "destructive" });
      return;
    }
    if (personType === "partner" && !partnerId) {
      toast({ title: "Erro", description: "Selecione um parceiro", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <Plus className="h-3 w-3" />
            Apontar Horas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{entryToEdit ? "Editar Apontamento" : "Novo Apontamento"}</DialogTitle>
          <DialogDescription>
            Registre as horas trabalhadas neste projeto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Tipo de Profissional</Label>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <input 
                  type="radio" 
                  id="r-analyst" 
                  checked={personType === "analyst"} 
                  onChange={() => setPersonType("analyst")}
                  className="accent-primary"
                  disabled={!!entryToEdit}
                />
                <Label htmlFor="r-analyst">Analista</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="radio" 
                  id="r-partner" 
                  checked={personType === "partner"} 
                  onChange={() => setPersonType("partner")}
                  className="accent-primary"
                  disabled={!!entryToEdit}
                />
                <Label htmlFor="r-partner">Parceiro</Label>
              </div>
            </div>
          </div>

          {personType === "analyst" ? (
            <div className="space-y-2">
              <Label>Analista</Label>
              <Select value={analystId} onValueChange={setAnalystId} disabled={!!entryToEdit}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {projectAnalysts?.map(a => (
                    <SelectItem key={a.analystId} value={a.analystId}>{a.analyst.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
             <div className="space-y-2">
              <Label>Parceiro</Label>
              <Select value={partnerId} onValueChange={setPartnerId} disabled={!!entryToEdit}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {projectPartners?.map(p => (
                    <SelectItem key={p.partnerId} value={p.partnerId}>{p.partner.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-4 space-y-2">
              <Label>Tempo (HH:MM)</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  min="0"
                  value={inputHours} 
                  onChange={e => setInputHours(e.target.value)} 
                  placeholder="HH"
                  className="text-center flex-1"
                />
                <span className="text-muted-foreground font-bold">:</span>
                <Input 
                  type="number" 
                  min="0"
                  max="59"
                  value={inputMinutes} 
                  onChange={e => setInputMinutes(e.target.value)} 
                  placeholder="MM"
                  className="text-center flex-1"
                />
              </div>
            </div>
            <div className="col-span-4 space-y-2">
              <Label className="whitespace-nowrap">Valor Hora Receber</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={billableRate} 
                onChange={e => setBillableRate(e.target.value)} 
                placeholder="0.00"
              />
            </div>
            <div className="col-span-4 space-y-2">
              <Label className="whitespace-nowrap">Valor Hora Pagar</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={costRate} 
                onChange={e => setCostRate(e.target.value)} 
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição (Opcional)</Label>
            <Input 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Ex: Desenvolvimento Frontend"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TimesheetDetail({ receiptId, projectId }: { receiptId: string, projectId: string }) {
  const { toast } = useToast();
  const { data: entries, isLoading } = useQuery<(TimesheetEntry & { analyst?: Analyst, partner?: Partner })[]>({
    queryKey: ["receipt-timesheets", receiptId],
    queryFn: async () => {
      const res = await fetch(`/api/receipts/${receiptId}/timesheets`);
      if (!res.ok) throw new Error("Failed to fetch timesheets");
      return res.json();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/timesheets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt-timesheets", receiptId] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({ title: "Sucesso", description: "Apontamento removido." });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="py-2 text-center text-sm text-muted-foreground">Carregando apontamentos...</div>;

  const totalHours = entries?.reduce((acc, e) => acc + Number(e.hours), 0) || 0;
  const totalCost = entries?.reduce((acc, e) => {
    // Se o pagamento for fixo, soma apenas o valor de custo (mensal) e não multiplica por horas
    if (e.analystPaymentType === "fixed") {
      return acc + Number(e.costRate || 0);
    }
    return acc + (Number(e.hours) * Number(e.costRate || 0));
  }, 0) || 0;
  const totalBillable = entries?.reduce((acc, e) => acc + (Number(e.hours) * Number(e.billableRate)), 0) || 0;

  return (
    <div className="space-y-4 pt-2">
      <div className="flex justify-between items-center border-b pb-1">
        <h4 className="text-sm font-medium text-muted-foreground">Apontamento de Horas</h4>
        <TimesheetDialog 
          receiptId={receiptId} 
          projectId={projectId}
          onSuccess={() => {}} 
        />
      </div>

      {(!entries || entries.length === 0) && (
         <EmptyState
          icon={Check}
          title="Nenhum apontamento"
          description="Registre as horas trabalhadas para calcular o faturamento."
          className="py-8 border-none"
        />
      )}

      {entries && entries.length > 0 && (
        <div className="space-y-2">
          <Table>
            <TableHeader>
              <TableRow className="h-8 hover:bg-transparent">
                <TableHead className="h-8 py-0 pl-2">Profissional</TableHead>
                <TableHead className="h-8 py-0">Descrição</TableHead>
                <TableHead className="h-8 py-0 text-right">Horas</TableHead>
                <TableHead className="h-8 py-0 text-right">Valor Hora</TableHead>
                <TableHead className="h-8 py-0 text-right">Total Receber</TableHead>
                <TableHead className="h-8 py-0 text-right">Valor Pagar</TableHead>
                <TableHead className="h-8 py-0 text-right">Total Pagar</TableHead>
                <TableHead className="h-8 py-0 w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(entry => (
                <TableRow key={entry.id} className="h-8 group">
                  <TableCell className="py-1 pl-2 font-medium">
                    {entry.analyst?.name || entry.partner?.name || "-"}
                    <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1 font-normal">
                      {entry.analystId ? "Analista" : "Parceiro"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1 text-xs text-muted-foreground">{entry.description}</TableCell>
                  <TableCell className="py-1 text-right">{decimalToTime(entry.hours)}</TableCell>
                  <TableCell className="py-1 text-right text-xs text-muted-foreground">R$ {Number(entry.billableRate).toFixed(2)}</TableCell>
                  <TableCell className="py-1 text-right text-green-600 font-medium">
                    R$ {(Number(entry.hours) * Number(entry.billableRate)).toFixed(2)}
                  </TableCell>
                  <TableCell className="py-1 text-right text-xs text-muted-foreground">R$ {Number(entry.costRate || 0).toFixed(2)}</TableCell>
                  <TableCell className="py-1 text-right text-red-600 font-medium">
                    R$ {(entry.analystPaymentType === "fixed" 
                        ? Number(entry.costRate || 0) 
                        : (Number(entry.hours) * Number(entry.costRate || 0))
                       ).toFixed(2)}
                  </TableCell>
                   <TableCell className="py-1 text-right flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <TimesheetDialog 
                      receiptId={receiptId} 
                      projectId={projectId}
                      onSuccess={() => {}}
                      entryToEdit={entry}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-6 w-6 mr-1" title="Editar">
                          <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => deleteMutation.mutate(entry.id)}
                      disabled={deleteMutation.isPending}
                      title="Excluir"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-medium">
                <TableCell colSpan={2} className="pl-2">Totais</TableCell>
                <TableCell className="text-right">{decimalToTime(totalHours)}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right text-green-700">R$ {totalBillable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right text-red-700">R$ {totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

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
  const [invoiceReceipt, setInvoiceReceipt] = useState<ReceiptType | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { toast } = useToast();

  const { data: receipts, isLoading } = useQuery<(ReceiptType & { outdated?: boolean; hasTransfer?: boolean; totalCost?: string; companyName?: string })[]>({ 
    queryKey: ["/api/receipts", filterYear, filterMonth],
    queryFn: async () => {
      const res = await fetch(`/api/receipts?year=${filterYear}&month=${filterMonth}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch receipts");
      return res.json();
    }
  });
  const { data: contracts } = useQuery<Contract[]>({ queryKey: ["/api/contracts"] });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: companies } = useQuery<Company[]>({ queryKey: ["/api/companies"] });
  const { data: projects } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { data: partners } = useQuery<Partner[]>({ queryKey: ["/api/partners"] });
  const { data: systemContracts } = useQuery<SystemContract[]>({ queryKey: ["/api/system-contracts"] });

  const generateMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/receipts/generate", { year: filterYear, month: filterMonth }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({ title: "Sucesso", description: "Recibos gerados com sucesso." });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/receipts/recalculate", { year: filterYear, month: filterMonth });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({ title: "Sucesso", description: `${data.updatedCount} recibos recalculados com sucesso.` });
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

  const reversePaymentMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/receipts/${id}/reverse-payment`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash"] });
      setIsDetailOpen(false);
      toast({ title: "Sucesso", description: "Pagamento estornado com sucesso." });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const deleteReceiptMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/receipts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      setIsDetailOpen(false);
      toast({ title: "Sucesso", description: "Recibo excluído com sucesso." });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const issueBoletoMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/receipts/${id}/boleto`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({ title: "Sucesso", description: "Boleto emitido com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao emitir boleto", description: error.message, variant: "destructive" });
    }
  });

  const cancelBoletoMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/receipts/${id}/boleto/cancel`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({ title: "Sucesso", description: "Boleto liberado para nova emissão!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao cancelar boleto", description: error.message, variant: "destructive" });
    }
  });

  const handleOpenDetail = (receipt: ReceiptType) => {
    setSelectedReceipt(receipt);
    setIsDetailOpen(true);
  };

  const getSourceDescription = (receipt: ReceiptType) => {
    if (receipt.contractId) {
      const contract = contracts?.find(c => c.id === receipt.contractId);
      if (!contract) return "Contrato não encontrado";
      const company = companies?.find(c => c.id === contract.companyId);
      return `${contract.description} - ${company?.tradeName || company?.name}`;
    } else if (receipt.projectId) {
      const project = projects?.find(p => p.id === receipt.projectId);
      if (!project) return "Projeto não encontrado";
      return `PROJ: ${project.name}`;
    } else if (receipt.systemContractId) {
      const systemContract = systemContracts?.find(sc => sc.id === receipt.systemContractId);
      if (!systemContract) return "Contrato Sistema não encontrado";
      return `SIST: ${systemContract.systemName} - ${systemContract.companyName}`;
    }
    return "-";
  };

  const getClientName = (receipt: ReceiptType) => {
    if (receipt.contractId) {
      const contract = contracts?.find(c => c.id === receipt.contractId);
      if (!contract) return "-";
      const client = clients?.find(t => t.id === contract.clientId);
      return client?.name || "-";
    } else if (receipt.projectId) {
      const project = projects?.find(p => p.id === receipt.projectId);
      if (!project) return "-";
      
      if (project.clientId) {
        const client = clients?.find(c => c.id === project.clientId);
        return client?.name || "-";
      } else if (project.partnerId) {
        const partner = partners?.find(p => p.id === project.partnerId);
        return partner?.name || "-";
      }
    } else if (receipt.systemContractId) {
      const systemContract = systemContracts?.find(sc => sc.id === receipt.systemContractId);
      return systemContract?.clientName || "-";
    }
    return "-";
  };

  const filteredReceipts = receipts?.filter(receipt => {
    // Status Filter
    if (statusFilter !== "all") {
      // Logic to handle virtual statuses
      if (statusFilter === 'BOLETO_EMITIDO') {
        // Show if explicitly BOLETO_EMITIDO OR if boleto is ISSUED
        if (receipt.status !== 'BOLETO_EMITIDO' && receipt.boletoStatus !== 'ISSUED') return false;
      } else if (statusFilter === 'NF_EMITIDA') {
        // Show if explicitly NF_EMITIDA OR if invoice is ISSUED
        if (receipt.status !== 'NF_EMITIDA' && !receipt.isInvoiceIssued) return false;
      } else if (statusFilter === 'NF_GERADA') {
        // Show if explicitly NF_GERADA OR if invoice generated but not issued
        // Also exclude if it is already NF_EMITIDA (unless user wants to see all generated?)
        // Usually NF_GERADA implies "Generated but not yet Issued"
        if (receipt.status !== 'NF_GERADA' && !(receipt.isInvoiceGenerated && !receipt.isInvoiceIssued)) return false;
      } else {
        // Default strict equality for other statuses (draft, closed, paid, transferred)
        if (receipt.status !== statusFilter) return false;
      }
    }

    // Company Filter
    if (companyFilter !== "all") {
      let companyId: string | undefined;
      if (receipt.contractId) {
        const contract = contracts?.find(c => c.id === receipt.contractId);
        companyId = contract?.companyId;
      } else if (receipt.projectId) {
        const project = projects?.find(p => p.id === receipt.projectId);
        companyId = project?.companyId;
      } else if (receipt.systemContractId) {
        const systemContract = systemContracts?.find(sc => sc.id === receipt.systemContractId);
        companyId = systemContract?.companyId;
      }
      
      if (companyId !== companyFilter) return false;
    }

    // Search Filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const source = getSourceDescription(receipt).toLowerCase();
      const client = getClientName(receipt).toLowerCase();
      const companyName = (receipt.companyName || "").toLowerCase();
      const total = receipt.totalDue.toString();
      const status = (statusLabels[receipt.status]?.label || "").toLowerCase();
      
      if (
        !source.includes(term) &&
        !client.includes(term) &&
        !companyName.includes(term) &&
        !total.includes(term) &&
        !status.includes(term)
      ) {
        return false;
      }
    }

    return true;
  });

  const totalReceber = filteredReceipts?.reduce((acc, r) => acc + Number(r.totalDue), 0) || 0;
  const totalPagar = filteredReceipts?.reduce((acc, r) => acc + Number((r as any).totalCost || 0), 0) || 0;
  const lucro = totalReceber - totalPagar;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recibos e Cobranças</h1>
          <p className="text-muted-foreground">Gerencie os recebimentos mensais dos contratos</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterMonth.toString()} onValueChange={(v) => setFilterMonth(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterYear.toString()} onValueChange={(v) => setFilterYear(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => recalculateMutation.mutate()} disabled={recalculateMutation.isPending}>
            {recalculateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            Recalcular Valores
          </Button>
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Gerar Mês
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total a Receber
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {isLoading ? <Skeleton className="h-8 w-24" /> : `R$ ${totalReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            </div>
            <p className="text-xs text-muted-foreground">
              Soma de todos os recibos do mês
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total a Pagar
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {isLoading ? <Skeleton className="h-8 w-24" /> : `R$ ${totalPagar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            </div>
            <p className="text-xs text-muted-foreground">
              Custos com analistas e parceiros
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Lucro Estimado
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {isLoading ? <Skeleton className="h-8 w-24" /> : `R$ ${lucro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            </div>
            <p className="text-xs text-muted-foreground">
              Resultado final do período
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 mb-4 items-end">
         <div className="space-y-2 flex-1">
            <Label>Busca</Label>
            <div className="relative">
               <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
               <Input 
                 placeholder="Buscar por cliente, projeto, valor..." 
                 className="pl-8" 
                 value={searchTerm} 
                 onChange={e => setSearchTerm(e.target.value)} 
               />
            </div>
         </div>
         <div className="space-y-2 w-[200px]">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
               <SelectTrigger>
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(statusLabels).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value.label}</SelectItem>
                  ))}
               </SelectContent>
            </Select>
         </div>
         <div className="space-y-2 w-[250px]">
            <Label>Empresa</Label>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
               <SelectTrigger>
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {companies?.map(c => (
                     <SelectItem key={c.id} value={c.id}>{c.tradeName || c.name}</SelectItem>
                  ))}
               </SelectContent>
            </Select>
         </div>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Recibos de {months.find(m => m.value == filterMonth.toString())?.label}/{filterYear}</CardTitle>
            <CardDescription>
              Lista de recibos gerados para o período selecionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : receipts?.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Nenhum recibo encontrado"
                description="Nenhum recibo encontrado para este período. Clique em 'Gerar Mês' para criar os recibos baseados nos contratos ativos."
              />
            ) : filteredReceipts?.length === 0 ? (
               <EmptyState
                icon={Search}
                title="Nenhum resultado encontrado"
                description="Tente ajustar os filtros ou a busca para encontrar o que procura."
                className="py-8 border-none"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contrato / Projeto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">TOTAL A RECEBER</TableHead>
                    <TableHead className="text-right">TOTAL A PAGAR</TableHead>
                    <TableHead className="text-right">LUCRO</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts?.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell>{receipt.companyName || "-"}</TableCell>
                      <TableCell className="font-medium">
                        {getSourceDescription(receipt)}
                        {receipt.outdated && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertCircle className="h-4 w-4 text-yellow-500 ml-2 inline" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Valores desatualizados. Regere o recibo.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      <TableCell>{getClientName(receipt)}</TableCell>
                      <TableCell className="font-bold text-right text-green-700">R$ {Number(receipt.totalDue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="font-medium text-right text-red-700">R$ {Number((receipt as any).totalCost || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="font-bold text-right text-blue-700">R$ {(Number(receipt.totalDue) - Number((receipt as any).totalCost || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          <Badge variant={statusLabels[receipt.status]?.variant as any || "outline"}>
                            {statusLabels[receipt.status]?.label || statusLabels['draft'].label}
                          </Badge>
                          
                          {receipt.boletoStatus === 'ISSUED' && receipt.status !== 'BOLETO_EMITIDO' && (
                             <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">
                                Boleto Emitido
                             </Badge>
                          )}

                          {receipt.isInvoiceIssued && receipt.status !== 'NF_EMITIDA' && (
                             <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">
                                NF Emitida
                             </Badge>
                          )}

                          {receipt.isInvoiceGenerated && !receipt.isInvoiceIssued && receipt.status !== 'NF_GERADA' && (
                             <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200">
                                NF Gerada
                             </Badge>
                          )}
                          
                          {(receipt as any).isInvoiceCancelled && receipt.status !== "NF_GERADA" && receipt.status !== "NF_EMITIDA" && (
                            <Badge variant="destructive">
                              NF Cancelada
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {['closed', 'paid', 'BOLETO_EMITIDO', 'NF_GERADA', 'NF_EMITIDA'].includes(receipt.status) && (
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               onClick={() => setInvoiceReceipt(receipt)} 
                               disabled={receipt.isInvoiceGenerated}
                               title={receipt.isInvoiceGenerated ? "NF já gerada" : "Gerar Nota Fiscal"}
                             >
                               <FileText className={`h-4 w-4 ${receipt.isInvoiceGenerated ? "text-green-600" : ""}`} />
                             </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDetail(receipt)} title="Ver Detalhes">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" asChild title="Imprimir">
                             <a href={`/receipts/${receipt.id}/print?type=client`} target="_blank">
                              <Printer className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button 
                             variant="ghost" 
                             size="icon" 
                             onClick={() => {
                               if (receipt.boletoStatus === 'ISSUED') {
                                 window.open(`/api/receipts/${receipt.id}/boleto/pdf`, '_blank');
                               } else {
                                 if (confirm("Deseja emitir o boleto pelo Banco Inter?")) {
                                   issueBoletoMutation.mutate(receipt.id);
                                 }
                               }
                             }}
                             title={receipt.boletoStatus === 'ISSUED' ? "Ver Boleto" : "Emitir Boleto Inter"}
                           >
                             <Barcode className={`h-4 w-4 ${receipt.boletoStatus === 'ISSUED' ? "text-green-600" : ""}`} />
                           </Button>

                           {receipt.boletoStatus === 'ISSUED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm("Deseja cancelar/liberar este boleto para nova emissão?")) {
                                    cancelBoletoMutation.mutate(receipt.id);
                                  }
                                }}
                                title="Cancelar/Liberar Boleto"
                                disabled={cancelBoletoMutation.isPending}
                              >
                                {cancelBoletoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 text-red-500" />}
                              </Button>
                           )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Recibo</DialogTitle>
            <DialogDescription>
              Gerencie os itens adicionais e o status do recibo.
            </DialogDescription>
          </DialogHeader>

          {selectedReceipt && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Origem</Label>
                  <div className="font-medium">{getSourceDescription(selectedReceipt)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Cliente</Label>
                  <div className="font-medium">{getClientName(selectedReceipt)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Valor Base</Label>
                  <div className="font-medium">R$ {Number(selectedReceipt.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total a Receber</Label>
                  <div className="font-bold text-lg text-primary">R$ {Number(selectedReceipt.totalDue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                </div>
              </div>

              <Separator />

              {selectedReceipt.contractId ? (
                <ReceiptServicesDetail 
                  receiptId={selectedReceipt.id}
                  contractId={selectedReceipt.contractId}
                  year={selectedReceipt.refYear}
                  month={selectedReceipt.refMonth}
                  storedClientTotal={Number(selectedReceipt.servicesAmount)}
                  storedCompanyTotal={0} // TODO: Add field for company total if needed
                />
              ) : selectedReceipt.projectId ? (
                <TimesheetDetail 
                  receiptId={selectedReceipt.id}
                  projectId={selectedReceipt.projectId}
                />
              ) : selectedReceipt.systemContractId ? (
                <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                  <p className="font-medium">Mensalidade de Sistema</p>
                  <p className="text-sm mt-1">Este recibo é referente a uma mensalidade fixa de contrato de sistema.</p>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <p>Tipo de recibo não suportado.</p>
                </div>
              )}

              <Separator />

              <div className="flex justify-between items-center bg-muted/50 p-4 rounded-lg">
                <div className="space-y-1">
                  <div className="text-sm font-medium flex items-center gap-2">
                    Status Atual: 
                    <div className="flex flex-col gap-1 items-start">
                      <Badge variant={statusLabels[selectedReceipt.status]?.variant as any || "outline"}>
                         {statusLabels[selectedReceipt.status]?.label || statusLabels['draft'].label}
                      </Badge>

                      {selectedReceipt.boletoStatus === 'ISSUED' && selectedReceipt.status !== 'BOLETO_EMITIDO' && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">
                             Boleto Emitido
                          </Badge>
                       )}

                       {selectedReceipt.isInvoiceIssued && selectedReceipt.status !== 'NF_EMITIDA' && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">
                             NF Emitida
                          </Badge>
                       )}

                       {selectedReceipt.isInvoiceGenerated && !selectedReceipt.isInvoiceIssued && selectedReceipt.status !== 'NF_GERADA' && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200">
                             NF Gerada
                          </Badge>
                       )}
                       
                       {(selectedReceipt as any).isInvoiceCancelled && (
                          <Badge variant="destructive">
                            NF Cancelada
                          </Badge>
                       )}
                    </div>
                  </div>
                  {selectedReceipt.status === 'draft' && <p className="text-xs text-muted-foreground">Recibos em rascunho podem ser alterados.</p>}
                </div>
                
                <div className="flex gap-2">
                  {selectedReceipt.status === 'draft' && (
                    <>
                      <Button variant="destructive" size="sm" onClick={() => deleteReceiptMutation.mutate(selectedReceipt.id)} disabled={deleteReceiptMutation.isPending}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </Button>
                      <Button variant="default" size="sm" onClick={() => closeReceiptMutation.mutate(selectedReceipt.id)} disabled={closeReceiptMutation.isPending}>
                        <Check className="mr-2 h-4 w-4" />
                        Fechar Recibo
                      </Button>
                    </>
                  )}

                  {(selectedReceipt.status === 'closed' || selectedReceipt.status === 'paid' || selectedReceipt.status === 'BOLETO_EMITIDO' || selectedReceipt.status === 'NF_GERADA' || selectedReceipt.status === 'NF_EMITIDA') && (
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => setInvoiceReceipt(selectedReceipt)} 
                      disabled={selectedReceipt.isInvoiceGenerated}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      {selectedReceipt.isInvoiceGenerated ? "NF Gerada" : "Gerar NF"}
                    </Button>
                  )}
                  
                  {(selectedReceipt.status === 'closed' || selectedReceipt.status === 'BOLETO_EMITIDO' || selectedReceipt.status === 'NF_GERADA' || selectedReceipt.status === 'NF_EMITIDA') && (
                    <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => markPaidMutation.mutate(selectedReceipt.id)} disabled={markPaidMutation.isPending}>
                      <DollarSign className="mr-2 h-4 w-4" />
                      Receber Pagamento
                    </Button>
                  )}

                  {selectedReceipt.status === 'paid' && (
                    <Button variant="outline" size="sm" onClick={() => reversePaymentMutation.mutate(selectedReceipt.id)} disabled={reversePaymentMutation.isPending}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Estornar Pagamento
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <GenerateInvoiceDialog 
        receipt={invoiceReceipt} 
        open={!!invoiceReceipt} 
        onOpenChange={(open) => !open && setInvoiceReceipt(null)} 
        onSuccess={() => setInvoiceReceipt(null)}
      />
    </div>
  );
}
