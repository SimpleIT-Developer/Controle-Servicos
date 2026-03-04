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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, UserCheck, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { insertAnalystSchema, type Analyst, type InsertAnalyst } from "@shared/schema";
import { formatPhone } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AnalystsPage() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingAnalyst, setEditingAnalyst] = useState<Analyst | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: analysts, isLoading } = useQuery<Analyst[]>({
    queryKey: ["/api/analysts"],
  });

  const filteredAnalysts = analysts?.filter(analyst => 
    analyst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (analyst.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (analyst.role || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const form = useForm<InsertAnalyst>({
    resolver: zodResolver(insertAnalystSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      role: "",
      paymentType: "hourly",
      fixedValue: "0",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertAnalyst) => {
      const res = await apiRequest("POST", "/api/analysts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analysts"] });
      setIsOpen(false);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Analista criado com sucesso.",
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
    mutationFn: async (data: InsertAnalyst) => {
      if (!editingAnalyst) return;
      const res = await apiRequest("PATCH", `/api/analysts/${editingAnalyst.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analysts"] });
      setIsOpen(false);
      setEditingAnalyst(null);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Analista atualizado com sucesso.",
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
      await apiRequest("DELETE", `/api/analysts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analysts"] });
      toast({
        title: "Sucesso",
        description: "Analista excluído com sucesso.",
      });
    },
  });

  const onSubmit = (data: InsertAnalyst) => {
    if (editingAnalyst) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (analyst: Analyst) => {
    setEditingAnalyst(analyst);
    form.reset({
      ...analyst,
      fixedValue: analyst.fixedValue?.toString() || "0",
    });
    setIsOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este analista?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Analistas</h1>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setEditingAnalyst(null);
            form.reset({
              name: "",
              email: "",
              phone: "",
              role: "",
              paymentType: "hourly",
              fixedValue: "0",
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Analista
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingAnalyst ? "Editar Analista" : "Novo Analista"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" {...form.register("name")} />
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
              <div className="space-y-2">
                <Label htmlFor="role">Cargo / Função</Label>
                <Input id="role" {...form.register("role")} />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Pagamento</Label>
                <Controller
                  control={form.control}
                  name="paymentType"
                  render={({ field }) => (
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="hourly" id="r1" />
                        <Label htmlFor="r1">Por Hora</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fixed" id="r2" />
                        <Label htmlFor="r2">Valor Fixo Mensal</Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </div>

              {form.watch("paymentType") === "fixed" && (
                <div className="space-y-2">
                  <Label htmlFor="fixedValue">Valor Fixo (R$)</Label>
                  <Input 
                    id="fixedValue" 
                    type="number" 
                    step="0.01" 
                    {...form.register("fixedValue")} 
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button variant="outline" type="button" onClick={() => setIsOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingAnalyst ? "Salvar" : "Criar"}
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
              <UserCheck className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Lista de Analistas</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {filteredAnalysts?.length || 0} analistas cadastrados
                </p>
              </div>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email, cargo..."
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
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cargo / Função</TableHead>
                <TableHead>Tipo Pagamento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredAnalysts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <EmptyState 
                      icon={UserCheck}
                      title={searchTerm ? "Nenhum analista encontrado" : "Nenhum analista cadastrado"}
                      description={searchTerm ? "Tente buscar com outros termos." : "Comece adicionando um novo analista."}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredAnalysts?.map((analyst) => (
                  <TableRow key={analyst.id}>
                    <TableCell className="font-medium">{analyst.name}</TableCell>
                    <TableCell>{analyst.email || "-"}</TableCell>
                    <TableCell>{formatPhone(analyst.phone)}</TableCell>
                    <TableCell>{analyst.role || "-"}</TableCell>
                    <TableCell>
                      {analyst.paymentType === "fixed" 
                        ? `Fixo: R$ ${Number(analyst.fixedValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` 
                        : "Por Hora"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(analyst)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(analyst.id)}>
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
