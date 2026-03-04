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
import { Plus, Pencil, Trash2, Handshake, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { formatCNPJ, formatPhone } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { insertPartnerSchema, type Partner, type InsertPartner } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PartnersPage() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: partners, isLoading } = useQuery<Partner[]>({
    queryKey: ["/api/partners"],
  });

  const filteredPartners = partners?.filter(partner => 
    partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    partner.cnpj.includes(searchTerm)
  );

  const form = useForm<InsertPartner>({
    resolver: zodResolver(insertPartnerSchema),
    defaultValues: {
      name: "",
      cnpj: "",
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
    },
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

  const { formState: { errors } } = form;

  const createMutation = useMutation({
    mutationFn: async (data: InsertPartner) => {
      const res = await apiRequest("POST", "/api/partners", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      setIsOpen(false);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Parceria criada com sucesso.",
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
    mutationFn: async (data: InsertPartner) => {
      if (!editingPartner) return;
      const res = await apiRequest("PATCH", `/api/partners/${editingPartner.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      setIsOpen(false);
      setEditingPartner(null);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Parceria atualizada com sucesso.",
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
      await apiRequest("DELETE", `/api/partners/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({
        title: "Sucesso",
        description: "Parceria excluída com sucesso.",
      });
    },
  });

  const onSubmit = (data: InsertPartner) => {
    if (editingPartner) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    form.reset(partner);
    setIsOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta parceria?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Parcerias</h1>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setEditingPartner(null);
            form.reset({
              name: "",
              cnpj: "",
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
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Parceria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingPartner ? "Editar Parceria" : "Nova Parceria"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Parceiro *</Label>
                  <Input id="name" {...form.register("name")} className={errors.name ? "border-red-500" : ""} />
                  {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Controller
                    control={form.control}
                    name="cnpj"
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="cnpj"
                        onChange={(e) => {
                          field.onChange(formatCNPJ(e.target.value));
                        }}
                        maxLength={18}
                        className={errors.cnpj ? "border-red-500" : ""}
                      />
                    )}
                  />
                  {errors.cnpj && <p className="text-sm text-red-500">{errors.cnpj.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" {...form.register("email")} />
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
                  {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CNPJ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : filteredPartners?.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="Nenhuma parceria encontrada"
          description="Cadastre sua primeira parceria clicando no botão acima."
        />
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPartners?.map((partner) => (
                <TableRow key={partner.id}>
                  <TableCell className="font-medium">{partner.name}</TableCell>
                  <TableCell>{partner.cnpj}</TableCell>
                  <TableCell>{partner.email || "-"}</TableCell>
                  <TableCell>{partner.phone || "-"}</TableCell>
                  <TableCell>{partner.city ? `${partner.city}/${partner.state}` : "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(partner)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(partner.id)}>
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
