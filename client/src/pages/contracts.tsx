import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, FileText, Loader2, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Contract, Property, Landlord, Tenant } from "@shared/schema";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  active: { label: "Ativo", variant: "default" },
  inactive: { label: "Inativo", variant: "secondary" },
  terminated: { label: "Encerrado", variant: "destructive" },
};

export default function ContractsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: contracts, isLoading } = useQuery<Contract[]>({ queryKey: ["/api/contracts"] });
  const { data: properties } = useQuery<Property[]>({ queryKey: ["/api/properties"] });
  const { data: landlords } = useQuery<Landlord[]>({ queryKey: ["/api/landlords"] });
  const { data: tenants } = useQuery<Tenant[]>({ queryKey: ["/api/tenants"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/contracts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setIsDialogOpen(false);
      toast({ title: "Sucesso", description: "Contrato cadastrado com sucesso." });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/contracts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setIsDialogOpen(false);
      setEditingContract(null);
      toast({ title: "Sucesso", description: "Contrato atualizado com sucesso." });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/contracts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Sucesso", description: "Contrato excluído com sucesso." });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      propertyId: formData.get("propertyId") as string,
      landlordId: formData.get("landlordId") as string,
      tenantId: formData.get("tenantId") as string,
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
      dueDay: parseInt(formData.get("dueDay") as string),
      rentAmount: formData.get("rentAmount") as string,
      adminFeePercent: formData.get("adminFeePercent") as string,
      status: formData.get("status") as string,
    };

    if (editingContract) {
      updateMutation.mutate({ id: editingContract.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getPropertyTitle = (id: string) => properties?.find((p) => p.id === id)?.title || "-";
  const getLandlordName = (id: string) => landlords?.find((l) => l.id === id)?.name || "-";
  const getTenantName = (id: string) => tenants?.find((t) => t.id === id)?.name || "-";

  const filteredContracts = contracts?.filter((c) =>
    getPropertyTitle(c.propertyId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    getTenantName(c.tenantId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (date: string) => new Date(date).toLocaleDateString("pt-BR");
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contratos de Locação</h1>
          <p className="text-muted-foreground">Gerencie os contratos de aluguel</p>
        </div>
        <Button onClick={() => { setEditingContract(null); setIsDialogOpen(true); }} data-testid="button-new-contract">
          <Plus className="mr-2 h-4 w-4" />
          Novo Contrato
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Lista de Contratos
              </CardTitle>
              <CardDescription>{contracts?.length || 0} contratos cadastrados</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" data-testid="input-search-contracts" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredContracts && filteredContracts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imóvel</TableHead>
                    <TableHead className="hidden md:table-cell">Locatário</TableHead>
                    <TableHead className="hidden lg:table-cell">Período</TableHead>
                    <TableHead>Aluguel</TableHead>
                    <TableHead className="hidden md:table-cell">Taxa Adm.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract) => (
                    <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`}>
                      <TableCell className="font-medium">{getPropertyTitle(contract.propertyId)}</TableCell>
                      <TableCell className="hidden md:table-cell">{getTenantName(contract.tenantId)}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          R$ {Number(contract.rentAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{Number(contract.adminFeePercent)}%</TableCell>
                      <TableCell>
                        <Badge variant={statusLabels[contract.status]?.variant || "secondary"}>
                          {statusLabels[contract.status]?.label || contract.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => { setEditingContract(contract); setIsDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(contract.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum contrato encontrado</h3>
              <p className="text-sm text-muted-foreground">Comece adicionando um novo contrato.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContract ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
            <DialogDescription>{editingContract ? "Atualize os dados do contrato." : "Preencha os dados do novo contrato."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="propertyId">Imóvel *</Label>
              <Select name="propertyId" defaultValue={editingContract?.propertyId || ""} required>
                <SelectTrigger data-testid="select-contract-property">
                  <SelectValue placeholder="Selecione o imóvel..." />
                </SelectTrigger>
                <SelectContent>
                  {properties?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.code} - {p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="landlordId">Locador *</Label>
                <Select name="landlordId" defaultValue={editingContract?.landlordId || ""} required>
                  <SelectTrigger data-testid="select-contract-landlord">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {landlords?.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenantId">Locatário *</Label>
                <Select name="tenantId" defaultValue={editingContract?.tenantId || ""} required>
                  <SelectTrigger data-testid="select-contract-tenant">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Início *</Label>
                <Input id="startDate" name="startDate" type="date" defaultValue={editingContract?.startDate || ""} required data-testid="input-contract-start" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Fim *</Label>
                <Input id="endDate" name="endDate" type="date" defaultValue={editingContract?.endDate || ""} required data-testid="input-contract-end" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dueDay">Dia Vencimento *</Label>
                <Input id="dueDay" name="dueDay" type="number" min="1" max="31" defaultValue={editingContract?.dueDay || 5} required data-testid="input-contract-due" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rentAmount">Aluguel (R$) *</Label>
                <Input id="rentAmount" name="rentAmount" type="number" step="0.01" defaultValue={editingContract?.rentAmount || ""} required data-testid="input-contract-rent" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminFeePercent">Taxa Adm. (%) *</Label>
                <Input id="adminFeePercent" name="adminFeePercent" type="number" step="0.01" defaultValue={editingContract?.adminFeePercent || 10} required data-testid="input-contract-fee" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select name="status" defaultValue={editingContract?.status || "active"}>
                <SelectTrigger data-testid="select-contract-status">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="terminated">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-contract">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingContract ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
