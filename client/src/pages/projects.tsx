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
import { Plus, Pencil, Trash2, Briefcase, Search, Users, X, Check, Banknote, Play, Pause, XCircle, MoreVertical } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { insertProjectSchema, type Project, type InsertProject, type Company, type Client, type Partner, type Analyst, type ProjectAnalyst, type ServiceCatalog } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Textarea } from "@/components/ui/textarea";

// Componente para gerenciar analistas do projeto
function ProjectAnalystsManager({ project, onClose }: { project: Project; onClose: () => void }) {
  const { toast } = useToast();
  const [selectedAnalystId, setSelectedAnalystId] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [costRate, setCostRate] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: projectAnalysts, isLoading: isLoadingPA } = useQuery<(ProjectAnalyst & { analyst: Analyst })[]>({
    queryKey: [`/api/projects/${project.id}/analysts`],
  });

  const { data: analysts } = useQuery<Analyst[]>({
    queryKey: ["/api/analysts"],
  });

  const addAnalystMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/project-analysts", {
        projectId: project.id,
        analystId: selectedAnalystId,
        role: role,
        hourlyRate: hourlyRate || null,
        costRate: costRate || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/analysts`] });
      setSelectedAnalystId("");
      setRole("");
      setHourlyRate("");
      setCostRate("");
      toast({ title: "Sucesso", description: "Analista vinculado com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const updateAnalystMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/project-analysts/${id}`, {
        role: role,
        hourlyRate: hourlyRate || null,
        costRate: costRate || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/analysts`] });
      setEditingId(null);
      setSelectedAnalystId("");
      setRole("");
      setHourlyRate("");
      setCostRate("");
      toast({ title: "Sucesso", description: "Vínculo atualizado com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const removeAnalystMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/project-analysts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/analysts`] });
      toast({ title: "Sucesso", description: "Analista removido com sucesso." });
    },
  });

  const handleEdit = (pa: ProjectAnalyst & { analyst: Analyst }) => {
    setEditingId(pa.id);
    setSelectedAnalystId(pa.analystId);
    setRole(pa.role || "");
    setHourlyRate(pa.hourlyRate ? pa.hourlyRate.toString() : "");
    setCostRate(pa.costRate ? pa.costRate.toString() : "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setSelectedAnalystId("");
    setRole("");
    setHourlyRate("");
    setCostRate("");
  };

  // Filter analysts not already in the project (unless editing)
  const availableAnalysts = analysts?.filter(a => 
    editingId ? a.id === selectedAnalystId : !projectAnalysts?.some(pa => pa.analystId === a.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-2">
          <Label>Analista</Label>
          <Select 
            value={selectedAnalystId} 
            onValueChange={setSelectedAnalystId}
            disabled={!!editingId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um analista" />
            </SelectTrigger>
            <SelectContent>
              {availableAnalysts?.map((analyst) => (
                <SelectItem key={analyst.id} value={analyst.id}>
                  {analyst.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-2">
          <Label>Papel (Opcional)</Label>
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex: Desenvolvedor" />
        </div>
        <div className="flex-1 space-y-2">
          <Label>Valor Receber</Label>
          <Input 
            type="number" 
            step="0.01"
            value={hourlyRate} 
            onChange={e => setHourlyRate(e.target.value)} 
            placeholder="0.00" 
          />
        </div>
        <div className="flex-1 space-y-2">
          <Label>Valor Pagar</Label>
          <Input 
            type="number" 
            step="0.01"
            value={costRate} 
            onChange={e => setCostRate(e.target.value)} 
            placeholder="0.00" 
          />
        </div>
        {editingId ? (
          <div className="flex gap-1">
            <Button onClick={() => updateAnalystMutation.mutate(editingId)} variant="default" size="icon">
              <Check className="h-4 w-4" />
            </Button>
            <Button onClick={handleCancelEdit} variant="outline" size="icon">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button onClick={() => addAnalystMutation.mutate()} disabled={!selectedAnalystId}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Valor Receber</TableHead>
              <TableHead>Valor Pagar</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectAnalysts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum analista vinculado.
                </TableCell>
              </TableRow>
            ) : (
              projectAnalysts?.map((pa) => (
                <TableRow key={pa.id}>
                  <TableCell>{pa.analyst.name}</TableCell>
                  <TableCell>{pa.role || "-"}</TableCell>
                  <TableCell>
                    {pa.hourlyRate 
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(pa.hourlyRate))
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {pa.costRate 
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(pa.costRate))
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(pa)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeAnalystMutation.mutate(pa.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function ProjectsPage({ mode = "client" }: { mode?: "client" | "partner" }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isAnalystsOpen, setIsAnalystsOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [managingProject, setManagingProject] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: partners } = useQuery<Partner[]>({
    queryKey: ["/api/partners"],
  });

  const { data: serviceCatalog } = useQuery<ServiceCatalog[]>({
    queryKey: ["/api/service-catalog"],
  });

  const filteredProjects = projects?.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    if (mode === "client") return matchesSearch && project.clientType === "client";
    if (mode === "partner") return matchesSearch && project.clientType === "partner";
    return matchesSearch;
  });

  const form = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      companyId: "",
      clientType: mode,
      clientId: "",
      partnerId: "",
      supplierId: "",
      hourlyRate: "0",
      supplierHourlyRate: "0",
      active: true,
      billingEmails: "",
      responsibleContact: "",
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsOpen(false);
      form.reset();
      toast({ title: "Sucesso", description: "Projeto criado com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      if (!editingProject) return;
      const res = await apiRequest("PATCH", `/api/projects/${editingProject.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsOpen(false);
      setEditingProject(null);
      form.reset();
      toast({ title: "Sucesso", description: "Projeto atualizado com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Sucesso",
        description: "Projeto excluído com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir projeto",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/projects/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Sucesso",
        description: "Status do projeto atualizado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status do projeto",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertProject) => {
    const formattedData = {
      ...data,
      clientId: data.clientType === 'client' && data.clientId ? data.clientId : null,
      partnerId: data.clientType === 'partner' && data.partnerId ? data.partnerId : null,
      supplierId: data.clientType === 'partner' && data.supplierId ? data.supplierId : null,
      hourlyRate: data.clientType === 'partner' ? data.hourlyRate : null,
      supplierHourlyRate: data.clientType === 'partner' ? data.supplierHourlyRate : null,
      endDate: data.endDate ? data.endDate : null,
    };
    
    if (editingProject) {
      updateMutation.mutate(formattedData);
    } else {
      createMutation.mutate(formattedData);
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    form.reset({
      ...project,
      startDate: project.startDate.toString(), // Ensure string format
      endDate: project.endDate ? project.endDate.toString() : null,
      supplierId: project.supplierId || "",
      hourlyRate: project.hourlyRate ? project.hourlyRate.toString() : "0",
      supplierHourlyRate: project.supplierHourlyRate ? project.supplierHourlyRate.toString() : "0",
      active: project.active ?? true,
      billingEmails: project.billingEmails || "",
      responsibleContact: project.responsibleContact || "",
      serviceCatalogId: project.serviceCatalogId || "",
      dayDue: project.dayDue || null,
    });
    setIsOpen(true);
  };

  const handleManageAnalysts = (project: Project) => {
    setManagingProject(project);
    setIsAnalystsOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este projeto?")) {
      deleteMutation.mutate(id);
    }
  };

  const getCompanyName = (id: string) => companies?.find(c => c.id === id)?.name || "N/A";
  const getClientName = (project: Project) => {
    if (project.clientType === "partner") {
      return partners?.find(p => p.id === project.partnerId)?.name || "N/A (Parceiro)";
    }
    return clients?.find(c => c.id === project.clientId)?.name || "N/A (Cliente)";
  };

  const getSupplierName = (project: Project) => {
    return partners?.find(p => p.id === project.supplierId)?.name || "-";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Projetos {mode === "client" ? "de Clientes" : mode === "partner" ? "de Parcerias" : ""}</h1>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setEditingProject(null);
            form.reset({
              name: "",
              description: "",
              companyId: "",
              clientType: mode,
              clientId: "",
              partnerId: "",
              startDate: new Date().toISOString().split('T')[0],
              endDate: null,
              billingEmails: "",
              responsibleContact: "",
              serviceCatalogId: "",
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
            <DialogHeader className="px-6 py-4 border-b">
              <DialogTitle>{editingProject ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 px-6 py-4">
            <form id="project-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Configurações Gerais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/20">
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
                  <Label htmlFor="active">Projeto Ativo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Controller
                    control={form.control}
                    name="isBillable"
                    render={({ field }) => (
                      <Switch
                        id="isBillable"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <Label htmlFor="isBillable">Gera Fatura?</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dayDue">Dia de Vencimento</Label>
                  <Input 
                    id="dayDue" 
                    type="number"
                    min="1"
                    max="31"
                    className="h-8"
                    placeholder="Dia (1-31)"
                    {...form.register("dayDue", { valueAsNumber: true })} 
                  />
                </div>
              </div>

              {/* Informações Básicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Projeto</Label>
                  <Input id="name" {...form.register("name")} />
                  {form.formState.errors.name && <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyId">Empresa</Label>
                  <Controller
                    control={form.control}
                    name="companyId"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {companies?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {form.formState.errors.companyId && <p className="text-sm text-red-500">{form.formState.errors.companyId.message}</p>}
                </div>
              </div>

              {/* Tipo e Vínculos */}
              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Configuração do Cliente/Parceiro</h3>
                
                {!mode && (
                  <div className="space-y-2">
                    <Label>Tipo de Relacionamento</Label>
                    <Controller
                      control={form.control}
                      name="clientType"
                      render={({ field }) => (
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-row space-x-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="client" id="r1" />
                            <Label htmlFor="r1">Cliente Direto</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="partner" id="r2" />
                            <Label htmlFor="r2">Parceiro</Label>
                          </div>
                        </RadioGroup>
                      )}
                    />
                  </div>
                )}

                {form.watch("clientType") === "client" ? (
                  <div className="space-y-2" key="client-select-container">
                    <Label htmlFor="clientId">Cliente</Label>
                    <Controller
                      control={form.control}
                      name="clientId"
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o cliente..." />
                          </SelectTrigger>
                          <SelectContent>
                            {clients?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                            {(!clients || clients.length === 0) && (
                              <SelectItem value="no-clients" disabled>Nenhum cliente cadastrado</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.clientId && <p className="text-sm text-red-500">{form.formState.errors.clientId.message}</p>}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2" key="partner-select-container">
                      <Label htmlFor="partnerId">Parceiro (Cliente Final)</Label>
                      <Controller
                        control={form.control}
                        name="partnerId"
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o cliente..." />
                            </SelectTrigger>
                            <SelectContent>
                              {partners?.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                              {(!partners || partners.length === 0) && (
                                <SelectItem value="no-partners" disabled>Nenhum parceiro cadastrado</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {form.formState.errors.partnerId && <p className="text-sm text-red-500">{form.formState.errors.partnerId.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="supplierId">Parceiro (Fornecedor)</Label>
                      <Controller
                        control={form.control}
                        name="supplierId"
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o fornecedor..." />
                            </SelectTrigger>
                            <SelectContent>
                              {partners?.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hourlyRate">Valor Hora (Receber)</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        id="hourlyRate" 
                        {...form.register("hourlyRate")} 
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="supplierHourlyRate">Valor Hora (Pagar)</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        id="supplierHourlyRate" 
                        {...form.register("supplierHourlyRate")} 
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2 p-3 bg-muted rounded-md border flex justify-between items-center">
                      <span className="text-sm font-medium">Margem de Lucro Estimada:</span>
                      <span className={`font-bold text-lg ${(parseFloat(form.watch("hourlyRate")?.toString() || "0") - parseFloat(form.watch("supplierHourlyRate")?.toString() || "0")) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          (parseFloat(form.watch("hourlyRate")?.toString() || "0") - parseFloat(form.watch("supplierHourlyRate")?.toString() || "0"))
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Datas e Detalhes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Data Início</Label>
                  <Input type="date" id="startDate" {...form.register("startDate")} />
                  {form.formState.errors.startDate && <p className="text-sm text-red-500">{form.formState.errors.startDate.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Data Fim</Label>
                  <Input type="date" id="endDate" {...form.register("endDate")} value={form.watch("endDate") || ""} />
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
                  <Label htmlFor="billingEmails">Emails para Cobrança</Label>
                  <Input 
                    id="billingEmails" 
                    placeholder="email1@empresa.com, email2@empresa.com" 
                    {...form.register("billingEmails")} 
                  />
                  <p className="text-[0.8rem] text-muted-foreground">
                    Separe múltiplos emails com vírgula.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsibleContact">Contato Responsável</Label>
                  <Input 
                    id="responsibleContact" 
                    placeholder="Nome do contato responsável no cliente" 
                    {...form.register("responsibleContact")} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" {...form.register("description")} className="min-h-[100px]" />
              </div>
            </form>
            </ScrollArea>
            <DialogFooter className="px-6 py-4 border-t bg-muted/20">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button type="submit" form="project-form" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar Projeto"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isAnalystsOpen} onOpenChange={setIsAnalystsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Analistas - {managingProject?.name}</DialogTitle>
          </DialogHeader>
          {managingProject && (
            <ProjectAnalystsManager project={managingProject} onClose={() => setIsAnalystsOpen(false)} />
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Listagem de Projetos</CardTitle>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar projetos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">Carregando...</div>
          ) : filteredProjects?.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Nenhum projeto encontrado"
              description="Comece criando um novo projeto."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  {mode === 'partner' ? (
                    <>
                      <TableHead>Parceiro (Cliente)</TableHead>
                      <TableHead>Parceiro (Fornecedor)</TableHead>
                      <TableHead>Margem</TableHead>
                    </>
                  ) : (
                    <TableHead>Cliente</TableHead>
                  )}
                  <TableHead>Fatura</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects?.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>{getCompanyName(project.companyId)}</TableCell>
                    {mode === 'partner' ? (
                      <>
                        <TableCell>{getClientName(project)}</TableCell>
                        <TableCell>{getSupplierName(project)}</TableCell>
                        <TableCell className={(Number(project.hourlyRate || 0) - Number(project.supplierHourlyRate || 0)) >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                            Number(project.hourlyRate || 0) - Number(project.supplierHourlyRate || 0)
                          )}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell>{getClientName(project)}</TableCell>
                    )}
                    <TableCell>
                      {project.isBillable ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 border-transparent text-white">
                          <Banknote className="h-3 w-3 mr-1" />
                          Sim
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Não
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {project.status ? (
                        <Badge variant={
                          project.status === "ATIVO" ? "default" :
                          project.status === "INATIVO" ? "secondary" :
                          "destructive"
                        }>
                          {project.status}
                        </Badge>
                      ) : (
                        <Badge variant={project.active ? "default" : "secondary"}>
                          {project.active ? "Ativo" : "Inativo"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right flex justify-end gap-2 items-center">
                      <Button variant="outline" size="icon" onClick={() => handleManageAnalysts(project)} title="Gerenciar Analistas">
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleEdit(project)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" title="Mais Ações">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {project.status !== 'ATIVO' && (
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: 'ATIVO' })}>
                              <Play className="mr-2 h-4 w-4" /> Reabrir / Ativar
                            </DropdownMenuItem>
                          )}
                          {project.status === 'ATIVO' && (
                            <>
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: 'INATIVO' })}>
                                <Pause className="mr-2 h-4 w-4" /> Inativar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: 'ENCERRADO' })} className="text-destructive focus:text-destructive">
                                <XCircle className="mr-2 h-4 w-4" /> Encerrar
                              </DropdownMenuItem>
                            </>
                          )}
                          {/* Fallback for projects without status set yet (using active flag) */}
                          {!project.status && project.active && (
                             <>
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: 'INATIVO' })}>
                                <Pause className="mr-2 h-4 w-4" /> Inativar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: 'ENCERRADO' })} className="text-destructive focus:text-destructive">
                                <XCircle className="mr-2 h-4 w-4" /> Encerrar
                              </DropdownMenuItem>
                            </>
                          )}
                          {!project.status && !project.active && (
                             <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: 'ATIVO' })}>
                               <Play className="mr-2 h-4 w-4" /> Reabrir / Ativar
                             </DropdownMenuItem>
                          )}
                          
                          {/* Allow ending inactive projects */}
                          {project.status === 'INATIVO' && (
                             <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: 'ENCERRADO' })} className="text-destructive focus:text-destructive">
                                <XCircle className="mr-2 h-4 w-4" /> Encerrar
                              </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button variant="destructive" size="icon" onClick={() => handleDelete(project.id)} title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}