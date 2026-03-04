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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Building2, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { formatCNPJ, formatPhone } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { insertCompanySchema, type Company, type InsertCompany } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function CompaniesPage() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const filteredCompanies = companies?.filter(company => 
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (company.tradeName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.doc.includes(searchTerm)
  );

  const form = useForm<InsertCompany>({
    resolver: zodResolver(insertCompanySchema),
    defaultValues: {
      name: "",
      tradeName: "",
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
      bank: "",
      branch: "",
      account: "",
      pixKeyType: undefined,
      pixKey: "",
      interEnvironment: "sandbox",
      interClientId: "",
      interClientSecret: "",
      interCertPath: "",
    },
  });

  const { formState: { errors } } = form;

  const createMutation = useMutation({
    mutationFn: async (data: InsertCompany) => {
      const res = await apiRequest("POST", "/api/companies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsOpen(false);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Empresa criada com sucesso.",
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
    mutationFn: async (data: InsertCompany) => {
      if (!editingCompany) return;
      const res = await apiRequest("PATCH", `/api/companies/${editingCompany.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsOpen(false);
      setEditingCompany(null);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Empresa atualizada com sucesso.",
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

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    
    try {
      const response = await fetch(`/api/cep/${cleanCep}`);
      const data = await response.json();
      
      if (response.ok) {
        form.setValue("street", data.street);
        form.setValue("neighborhood", data.neighborhood);
        form.setValue("city", data.city);
        form.setValue("state", data.state);
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Sucesso",
        description: "Empresa excluída com sucesso.",
      });
    },
  });

  const uploadCerts = async (companyId: string) => {
    if (!certFile && !keyFile) return;
    
    const formData = new FormData();
    if (certFile) formData.append('cert', certFile);
    if (keyFile) formData.append('key', keyFile);

    try {
        const res = await fetch(`/api/companies/${companyId}/certs`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error("Falha no upload");
        toast({
            title: "Certificados",
            description: "Certificados enviados com sucesso.",
        });
    } catch (error) {
        console.error("Erro ao enviar certificados:", error);
        toast({
            title: "Erro",
            description: "Erro ao enviar certificados.",
            variant: "destructive"
        });
    }
  };

  const onSubmit = async (data: InsertCompany) => {
    try {
      if (editingCompany) {
        await updateMutation.mutateAsync(data);
        await uploadCerts(editingCompany.id);
      } else {
        const newCompany = await createMutation.mutateAsync(data);
        if (newCompany && newCompany.id) {
          await uploadCerts(newCompany.id);
        }
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    form.reset(company);
    setIsOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta empresa?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setEditingCompany(null);
            setCertFile(null);
            setKeyFile(null);
            form.reset({
              name: "",
              tradeName: "",
              doc: "",
              address: "",
              phone: "",
              email: "",
              city: "",
              state: "",
              zipCode: "",
              bank: "",
              branch: "",
              account: "",
              pixKeyType: undefined,
              pixKey: "",
              interEnvironment: "sandbox",
              interClientId: "",
              interClientSecret: "",
              interCertPath: "",
              interKeyPath: "",
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{editingCompany ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.error("Form errors:", errors);
              const errorMessages = Object.entries(errors)
                .map(([key, error]) => `${key}: ${error?.message}`)
                .join(", ");
              
              toast({
                title: "Erro de validação",
                description: `Campos com erro: ${errorMessages}`,
                variant: "destructive",
              });
            })} className="space-y-4">
              
              <Tabs defaultValue="geral" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="geral">Dados Gerais</TabsTrigger>
                  <TabsTrigger value="financeiro">Dados Bancários</TabsTrigger>
                  <TabsTrigger value="integracoes">Integrações</TabsTrigger>
                </TabsList>

                <TabsContent value="geral" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Razão Social *</Label>
                      <Input id="name" {...form.register("name")} className={errors.name ? "border-red-500" : ""} />
                      {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tradeName">Nome Fantasia</Label>
                      <Input id="tradeName" {...form.register("tradeName")} />
                      {errors.tradeName && <p className="text-sm text-red-500">{errors.tradeName.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="doc">CNPJ *</Label>
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
                            className={errors.doc ? "border-red-500" : ""}
                          />
                        )}
                      />
                      {errors.doc && <p className="text-sm text-red-500">{errors.doc.message}</p>}
                    </div>
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
                      {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
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
                </TabsContent>

                <TabsContent value="financeiro" className="space-y-4 mt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bank">Banco</Label>
                      <Input id="bank" {...form.register("bank")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch">Agência</Label>
                      <Input id="branch" {...form.register("branch")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account">Conta</Label>
                      <Input id="account" {...form.register("account")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="pixKeyType">Tipo Chave PIX</Label>
                      <Controller
                        control={form.control}
                        name="pixKeyType"
                        render={({ field }) => (
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || undefined}
                          >
                            <SelectTrigger id="pixKeyType" className={errors.pixKeyType ? "border-red-500" : ""}>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cpf">CPF</SelectItem>
                              <SelectItem value="cnpj">CNPJ</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="phone">Telefone</SelectItem>
                              <SelectItem value="random">Chave Aleatória</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.pixKeyType && <p className="text-sm text-red-500">{errors.pixKeyType.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pixKey">Chave PIX</Label>
                      <Input id="pixKey" {...form.register("pixKey")} className={errors.pixKey ? "border-red-500" : ""} />
                      {errors.pixKey && <p className="text-sm text-red-500">{errors.pixKey.message}</p>}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="integracoes" className="space-y-4 mt-4">
                  <h3 className="mb-4 font-medium">Configuração Boleto Inter</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="interEnvironment">Ambiente</Label>
                      <Controller
                        control={form.control}
                        name="interEnvironment"
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || "sandbox"}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o ambiente" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sandbox">Sandbox</SelectItem>
                              <SelectItem value="production">Produção</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="interClientId">Client ID</Label>
                      <Input id="interClientId" {...form.register("interClientId")} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="interClientSecret">Client Secret</Label>
                      <Input id="interClientSecret" type="password" {...form.register("interClientSecret")} />
                    </div>
                    <div className="space-y-2 col-span-2">
                       <Label>Certificados de Autenticação</Label>
                       <div className="grid grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20">
                          <div className="space-y-2">
                              <Label htmlFor="certFile" className="text-xs font-medium">Certificado (.crt)</Label>
                              <Input 
                                  id="certFile" 
                                  type="file" 
                                  accept=".crt,.pem,.cer" 
                                  onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                                  className="text-xs" 
                              />
                              {editingCompany?.interCertPath && (
                                  <p className="text-xs text-muted-foreground truncate" title={editingCompany.interCertPath}>
                                      Salvo: ...{editingCompany.interCertPath.slice(-30)}
                                  </p>
                              )}
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="keyFile" className="text-xs font-medium">Chave Privada (.key)</Label>
                              <Input 
                                  id="keyFile" 
                                  type="file" 
                                  accept=".key,.pem" 
                                  onChange={(e) => setKeyFile(e.target.files?.[0] || null)}
                                  className="text-xs" 
                              />
                              {editingCompany?.interKeyPath && (
                                  <p className="text-xs text-muted-foreground truncate" title={editingCompany.interKeyPath}>
                                      Salvo: ...{editingCompany.interKeyPath.slice(-30)}
                                  </p>
                              )}
                          </div>
                       </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button variant="outline" type="button" onClick={() => setIsOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} onClick={() => console.log("Save button clicked")}>
                  {editingCompany ? "Salvar" : "Criar"}
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
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Lista de Empresas</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {filteredCompanies?.length || 0} empresas cadastradas
                </p>
              </div>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ..."
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
                <TableHead>Nome Fantasia</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredCompanies?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <EmptyState 
                      icon={Building2}
                      title={searchTerm ? "Nenhuma empresa encontrada" : "Nenhuma empresa cadastrada"}
                      description={searchTerm ? "Tente buscar com outros termos." : "Comece adicionando uma nova empresa."}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies?.map((company) => (
                  <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>{company.tradeName || "-"}</TableCell>
                      <TableCell>{formatCNPJ(company.doc)}</TableCell>
                      <TableCell>{company.city} - {company.state}</TableCell>
                      <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(company)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(company.id)}>
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
