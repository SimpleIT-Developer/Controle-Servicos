import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, FileText, Search, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertContractSchema, type Contract, type Company, type Client, type InsertContract } from "@shared/schema";
import { format } from "date-fns";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  active: { label: "Ativo", variant: "default" },
  inactive: { label: "Inativo", variant: "secondary" },
  terminated: { label: "Encerrado", variant: "destructive" },
};

export default function ContractsPage() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: contracts, isLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<InsertContract>({
    resolver: zodResolver(insertContractSchema),
    defaultValues: {
      companyId: "",
      clientId: "",
      description: "",
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: "",
      dayDue: 5,
      amount: "0",
      status: "active",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertContract) => {
      const res = await apiRequest("POST", "/api/contracts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setIsOpen(false);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Contrato criado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertContract) => {
      if (!editingContract) return;
      const res = await apiRequest("PATCH", `/api/contracts/${editingContract.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setIsOpen(false);
      setEditingContract(null);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Contrato atualizado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/contracts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({
        title: "Sucesso",
        description: "Contrato excluído com sucesso.",
      });
    },
  });

  const onSubmit = (data: InsertContract) => {
    // Ensure numbers are handled correctly by the schema validation
    const formattedData = {
      ...data,
      dayDue: Number(data.dayDue),
    };
    
    if (editingContract) {
      updateMutation.mutate(formattedData);
    } else {
      createMutation.mutate(formattedData);
    }
  };

  const handleEdit = (contract: Contract) => {
    setEditingContract(contract);
    form.reset({
      ...contract,
      endDate: contract.endDate || undefined,
      billingEmails: contract.billingEmails || "",
    });
    setIsOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este contrato?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredContracts = contracts?.filter(contract => 
    contract.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    companies?.find(c => c.id === contract.companyId)?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    clients?.find(c => c.id === contract.clientId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contratos</h1>
          <p className="text-muted-foreground">Gerencie os contratos de prestação de serviços</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setEditingContract(null);
            form.reset({
              companyId: "",
              clientId: "",
              description: "",
              startDate: format(new Date(), "yyyy-MM-dd"),
              endDate: "",
              dayDue: 5,
              amount: "0",
              status: "active",
              billingEmails: "",
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Contrato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingContract ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyId">Empresa</Label>
                  <Select onValueChange={(value) => form.setValue("companyId", value)} defaultValue={form.getValues("companyId")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies?.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientId">Cliente</Label>
                  <Select onValueChange={(value) => form.setValue("clientId", value)} defaultValue={form.getValues("clientId")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="description">Descrição do Contrato</Label>
                  <Input id="description" {...form.register("description")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Data Início</Label>
                  <Input type="date" id="startDate" {...form.register("startDate")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Data Fim (Opcional)</Label>
                  <Input type="date" id="endDate" {...form.register("endDate")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dayDue">Dia Vencimento</Label>
                  <Input type="number" min="1" max="31" id="dayDue" {...form.register("dayDue")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor Mensal (R$)</Label>
                  <Input type="number" step="0.01" id="amount" {...form.register("amount")} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="billingEmails">Emails para Cobrança</Label>
                  <Input 
                    id="billingEmails" 
                    placeholder="email1@empresa.com, email2@empresa.com" 
                    {...form.register("billingEmails")} 
                  />
                  <p className="text-[0.8rem] text-muted-foreground">
                    Separe múltiplos emails com vírgula. Se vazio, será usado o email do cliente.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select onValueChange={(value: "active" | "inactive" | "terminated") => form.setValue("status", value)} defaultValue={form.getValues("status")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="terminated">Encerrado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" type="button" onClick={() => setIsOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingContract ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar contratos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredContracts && filteredContracts.length === 0 ? (
          <EmptyState 
            icon={FileText}
            title={searchTerm ? "Nenhum contrato encontrado" : "Nenhum contrato cadastrado"}
            description={searchTerm ? "Tente buscar com outros termos." : "Comece adicionando um novo contrato."}
          />
        ) : (
          filteredContracts?.map((contract) => {
          const company = companies?.find(c => c.id === contract.companyId);
          const client = clients?.find(c => c.id === contract.clientId);
          
          return (
            <Card key={contract.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium line-clamp-1">
                    {contract.description}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {company?.tradeName || company?.name}
                  </p>
                </div>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">R$ {Number(contract.amount).toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cliente: {client?.name}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    contract.status === 'active' ? 'bg-green-100 text-green-700' :
                    contract.status === 'inactive' ? 'bg-gray-100 text-gray-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {statusLabels[contract.status]?.label || contract.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Vence dia {contract.dayDue}
                  </span>
                </div>
                <div className="mt-4 flex justify-end space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(contract)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(contract.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        }))}
      </div>
    </div>
  );
}
