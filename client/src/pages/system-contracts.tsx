import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Monitor, Search, Check, X, Play, Pause, XCircle, MoreVertical } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { insertSystemContractSchema, type SystemContract, type InsertSystemContract, type Company, type Client, type ServiceCatalog } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const availableSystems = [
  "SimpleDFe"
];

export default function SystemContractsPage() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<SystemContract | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: contracts, isLoading } = useQuery<SystemContract[]>({
    queryKey: ["/api/system-contracts"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: serviceCatalog } = useQuery<ServiceCatalog[]>({
    queryKey: ["/api/service-catalog"],
  });

  const filteredContracts = contracts?.filter(contract => {
    const matchesSearch = 
      contract.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.systemName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const form = useForm<InsertSystemContract>({
    resolver: zodResolver(insertSystemContractSchema),
    defaultValues: {
      companyName: "",
      clientName: "",
      systemName: "SimpleDFe",
      monthlyValue: "0",
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
      active: true,
      billingEmails: "",
      responsibleContact: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertSystemContract) => {
      const res = await apiRequest("POST", "/api/system-contracts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-contracts"] });
      setIsOpen(false);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Contrato de sistema criado com sucesso.",
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
    mutationFn: async (data: InsertSystemContract & { id: string }) => {
      const { id, ...rest } = data;
      const res = await apiRequest("PATCH", `/api/system-contracts/${id}`, rest);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-contracts"] });
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
      await apiRequest("DELETE", `/api/system-contracts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-contracts"] });
      toast({
        title: "Sucesso",
        description: "Contrato removido com sucesso.",
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/system-contracts/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-contracts"] });
      toast({
        title: "Sucesso",
        description: "Status do contrato atualizado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status do contrato",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertSystemContract) => {
    const formattedData = {
      ...data,
      serviceCatalogId: (data.serviceCatalogId === "" || data.serviceCatalogId === "none") ? null : data.serviceCatalogId,
    };

    if (editingContract) {
      updateMutation.mutate({ ...formattedData, id: editingContract.id });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  const handleEdit = (contract: SystemContract) => {
    setEditingContract(contract);
    form.reset({
      companyName: contract.companyName,
      clientName: contract.clientName,
      systemName: contract.systemName,
      monthlyValue: contract.monthlyValue.toString(),
      startDate: contract.startDate,
      endDate: contract.endDate,
      active: contract.active,
      billingEmails: contract.billingEmails || "",
      responsibleContact: contract.responsibleContact || "",
      serviceCatalogId: contract.serviceCatalogId || "",
      dayDue: contract.dayDue || null,
    });
    setIsOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setEditingContract(null);
      form.reset({
        companyName: "",
        clientName: "",
        systemName: "SimpleDFe",
        monthlyValue: "0",
        active: true,
        billingEmails: "",
        responsibleContact: "",
        serviceCatalogId: "",
        dayDue: null,
        startDate: new Date().toISOString().split('T')[0],
        endDate: null,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Contratos de Sistemas</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os contratos de sistemas (SimpleDFe) e suas mensalidades.
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Contrato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
            <DialogHeader className="px-6 py-4 border-b">
              <DialogTitle>{editingContract ? "Editar Contrato" : "Novo Contrato de Sistema"}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 px-6 py-4">
            <form id="contract-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Configurações Gerais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/20">
                <div className="flex items-center space-x-2">
                  <Controller
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <Switch
                        id="active"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <Label htmlFor="active">Contrato Ativo</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dayDue">Dia de Vencimento</Label>
                  <Input 
                    type="number"
                    min="1"
                    max="31"
                    className="h-8"
                    {...form.register("dayDue", { valueAsNumber: true })} 
                    placeholder="Dia de vencimento (1-31)" 
                  />
                  <p className="text-[0.8rem] text-muted-foreground">
                    Usado para calcular a data de vencimento nas cobranças.
                  </p>
                </div>
              </div>

              {/* Informações do Contrato */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Controller
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <Select 
                        value={field.value} 
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {companies?.map((company) => (
                            <SelectItem key={company.id} value={company.name}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {form.formState.errors.companyName && (
                    <p className="text-sm text-destructive">{form.formState.errors.companyName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Controller
                    control={form.control}
                    name="clientName"
                    render={({ field }) => (
                      <Select 
                        value={field.value} 
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clients?.map((client) => (
                            <SelectItem key={client.id} value={client.name}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {form.formState.errors.clientName && (
                    <p className="text-sm text-destructive">{form.formState.errors.clientName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Sistema</Label>
                  <Controller
                    control={form.control}
                    name="systemName"
                    render={({ field }) => (
                      <Select 
                        value={field.value} 
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o sistema" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSystems.map((sys) => (
                            <SelectItem key={sys} value={sys}>
                              {sys}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {form.formState.errors.systemName && (
                    <p className="text-sm text-destructive">{form.formState.errors.systemName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Valor Mensal</Label>
                  <Input 
                    {...form.register("monthlyValue")} 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                  />
                </div>
              </div>

              {/* Vigência */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-lg p-4">
                <div className="space-y-2">
                  <Label>Início do Contrato</Label>
                  <Input 
                    type="date" 
                    {...form.register("startDate")} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Final do Contrato</Label>
                  <Input 
                    type="date" 
                    {...form.register("endDate")} 
                    value={form.watch("endDate") || ""}
                  />
                </div>
              </div>

              {/* Cobrança e Contato */}
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label htmlFor="serviceCatalogId">Serviço do Catálogo (Descrição no Email)</Label>
                  <Controller
                    control={form.control}
                    name="serviceCatalogId"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um serviço..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {serviceCatalog?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-[0.8rem] text-muted-foreground">
                    A descrição deste serviço será usada no email de cobrança (substituindo "serviços prestados").
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Emails para Cobrança</Label>
                  <Input 
                    {...form.register("billingEmails")} 
                    placeholder="email1@empresa.com, email2@empresa.com" 
                  />
                  <p className="text-[0.8rem] text-muted-foreground">
                    Separe múltiplos emails com vírgula. Se vazio, será usado o email do cliente.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Contato Responsável</Label>
                  <Input 
                    {...form.register("responsibleContact")} 
                    placeholder="Nome do contato responsável no cliente" 
                  />
                </div>
              </div>
            </form>
            </ScrollArea>
            <DialogFooter className="px-6 py-4 border-t bg-muted/20">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
              <Button type="submit" form="contract-form" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingContract ? "Salvar Alterações" : "Criar Contrato"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contratos..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredContracts?.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="Nenhum contrato encontrado"
          description="Nenhum contrato de sistema corresponde aos filtros atuais."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sistema</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor Mensal</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts?.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">{contract.systemName}</TableCell>
                  <TableCell>{contract.companyName}</TableCell>
                  <TableCell>{contract.clientName}</TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(contract.monthlyValue))}
                  </TableCell>
                  <TableCell>
                    {new Date(contract.startDate).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                  {contract.status ? (
                    <Badge variant={
                      contract.status === "ATIVO" ? "default" :
                      contract.status === "INATIVO" ? "secondary" :
                      "destructive"
                    }>
                      {contract.status}
                    </Badge>
                  ) : (
                    <Badge variant={contract.active ? "default" : "secondary"}>
                      {contract.active ? "Ativo" : "Inativo"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(contract)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" title="Mais Ações">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {contract.status !== 'ATIVO' && (
                          <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: contract.id, status: 'ATIVO' })}>
                            <Play className="mr-2 h-4 w-4" /> Reabrir / Ativar
                          </DropdownMenuItem>
                        )}
                        {contract.status === 'ATIVO' && (
                          <>
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: contract.id, status: 'INATIVO' })}>
                              <Pause className="mr-2 h-4 w-4" /> Inativar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: contract.id, status: 'ENCERRADO' })} className="text-destructive focus:text-destructive">
                              <XCircle className="mr-2 h-4 w-4" /> Encerrar
                            </DropdownMenuItem>
                          </>
                        )}
                         {/* Fallback for contracts without status set yet (using active flag) */}
                        {!contract.status && contract.active && (
                           <>
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: contract.id, status: 'INATIVO' })}>
                              <Pause className="mr-2 h-4 w-4" /> Inativar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: contract.id, status: 'ENCERRADO' })} className="text-destructive focus:text-destructive">
                              <XCircle className="mr-2 h-4 w-4" /> Encerrar
                            </DropdownMenuItem>
                          </>
                        )}
                        {!contract.status && !contract.active && (
                           <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: contract.id, status: 'ATIVO' })}>
                             <Play className="mr-2 h-4 w-4" /> Reabrir / Ativar
                           </DropdownMenuItem>
                        )}
                        
                        {/* Allow ending inactive contracts */}
                        {contract.status === 'INATIVO' && (
                           <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: contract.id, status: 'ENCERRADO' })} className="text-destructive focus:text-destructive">
                              <XCircle className="mr-2 h-4 w-4" /> Encerrar
                            </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(contract.id)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
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
