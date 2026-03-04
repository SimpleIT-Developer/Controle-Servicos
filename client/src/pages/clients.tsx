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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { formatCNPJ, formatPhone } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller, useWatch } from "react-hook-form";
import { insertClientSchema, type Client, type InsertClient } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ClientsPage() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const filteredClients = clients?.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.doc.includes(searchTerm) ||
    (client.email || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const form = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: "",
      doc: "",
      address: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      phone: "",
      email: "",
      city: "",
      state: "",
      zipCode: "",
      type: "consultoria",
      hourlyRate: "0",
    },
  });

  const clientType = useWatch({
    control: form.control,
    name: "type",
  });

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        form.setValue("street", data.logradouro);
        form.setValue("neighborhood", data.bairro);
        form.setValue("city", data.localidade);
        form.setValue("state", data.uf);
        form.setFocus("number");
      } else {
          toast({
              title: "CEP não encontrado",
              description: "Verifique o CEP informado.",
              variant: "destructive",
          });
      }
    } catch (error) {
      console.error("Erro ao buscar CEP", error);
      toast({
          title: "Erro",
          description: "Falha ao buscar endereço pelo CEP.",
          variant: "destructive",
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      const res = await apiRequest("POST", "/api/clients", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsOpen(false);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Cliente criado com sucesso.",
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
    mutationFn: async (data: InsertClient) => {
      if (!editingClient) return;
      const res = await apiRequest("PATCH", `/api/clients/${editingClient.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsOpen(false);
      setEditingClient(null);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Cliente atualizado com sucesso.",
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
      await apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Sucesso",
        description: "Cliente excluído com sucesso.",
      });
    },
  });

  const onSubmit = (data: InsertClient) => {
    if (editingClient) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    form.reset(client);
    setIsOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este cliente?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setEditingClient(null);
            form.reset({
              name: "",
              doc: "",
              address: "",
              phone: "",
              email: "",
              city: "",
              state: "",
              zipCode: "",
              type: "consultoria",
              hourlyRate: "0",
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome / Razão Social</Label>
                  <Input id="name" {...form.register("name")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc">CPF / CNPJ</Label>
                  <Controller
                    control={form.control}
                    name="doc"
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="doc"
                        onChange={(e) => {
                          field.onChange(formatCNPJ(e.target.value));
                        }}
                        maxLength={18}
                      />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo de Cliente</Label>
                  <Controller
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="consultoria">Consultoria</SelectItem>
                          <SelectItem value="sistema">Sistema</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                {clientType === "consultoria" && (
                  <div className="space-y-2">
                    <Label htmlFor="hourlyRate">Valor Hora Praticado</Label>
                    <Input 
                      id="hourlyRate" 
                      type="number" 
                      step="0.01" 
                      {...form.register("hourlyRate")} 
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Controller
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="phone"
                        value={field.value || ""}
                        onChange={(e) => {
                          field.onChange(formatPhone(e.target.value));
                        }}
                        maxLength={15}
                      />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" {...form.register("email")} />
                </div>
                <div className="col-span-2 space-y-4 border rounded-md p-4 bg-muted/20">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Endereço</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="col-span-1 md:col-span-3 space-y-2">
                      <Label htmlFor="zipCode">CEP</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="zipCode" 
                          {...form.register("zipCode")} 
                          maxLength={9}
                          placeholder="00000-000"
                          onBlur={(e) => fetchAddressByCep(e.target.value)}
                        />
                        <Button 
                          type="button" 
                          variant="secondary" 
                          size="icon"
                          onClick={() => fetchAddressByCep(form.getValues("zipCode") || "")}
                          title="Buscar CEP"
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="col-span-1 md:col-span-9 space-y-2">
                      <Label htmlFor="street">Rua / Logradouro</Label>
                      <Input id="street" {...form.register("street")} />
                    </div>

                    <div className="col-span-1 md:col-span-3 space-y-2">
                      <Label htmlFor="number">Número</Label>
                      <Input id="number" {...form.register("number")} />
                    </div>
                    
                    <div className="col-span-1 md:col-span-4 space-y-2">
                      <Label htmlFor="complement">Complemento</Label>
                      <Input id="complement" {...form.register("complement")} />
                    </div>

                     <div className="col-span-1 md:col-span-5 space-y-2">
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input id="neighborhood" {...form.register("neighborhood")} />
                    </div>

                    <div className="col-span-1 md:col-span-9 space-y-2">
                      <Label htmlFor="city">Cidade</Label>
                      <Input id="city" {...form.register("city")} />
                    </div>
                    
                    <div className="col-span-1 md:col-span-3 space-y-2">
                      <Label htmlFor="state">UF</Label>
                      <Input id="state" {...form.register("state")} maxLength={2} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" type="button" onClick={() => setIsOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingClient ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Lista de Clientes</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {filteredClients?.length || 0} clientes cadastrados
                </p>
              </div>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor/h</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredClients?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <EmptyState 
                      icon={Users}
                      title={searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                      description={searchTerm ? "Tente buscar com outros termos." : "Comece adicionando um novo cliente."}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients?.map((client) => (
                  <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{formatCNPJ(client.doc)}</TableCell>
                      <TableCell>{client.email || "-"}</TableCell>
                      <TableCell>{formatPhone(client.phone)}</TableCell>
                      <TableCell className="capitalize">{client.type}</TableCell>
                      <TableCell>
                        {client.type === "consultoria" && client.hourlyRate 
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(client.hourlyRate))
                          : "-"}
                      </TableCell>
                      <TableCell>{client.city} - {client.state}</TableCell>
                      <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(client)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
