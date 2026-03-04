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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Wrench, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertServiceCatalogSchema, type ServiceCatalog, type InsertServiceCatalog } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ServiceCatalogPage() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceCatalog | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: catalog, isLoading } = useQuery<ServiceCatalog[]>({
    queryKey: ["/api/service-catalog"],
  });

  const filteredCatalog = catalog?.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const form = useForm<InsertServiceCatalog>({
    resolver: zodResolver(insertServiceCatalogSchema),
    defaultValues: {
      name: "",
      description: "",
      nationalTaxationCode: "",
      nbsCode: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertServiceCatalog) => {
      const res = await apiRequest("POST", "/api/service-catalog", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-catalog"] });
      setIsOpen(false);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Serviço criado com sucesso.",
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
    mutationFn: async (data: InsertServiceCatalog) => {
      if (!editingItem) return;
      const res = await apiRequest("PATCH", `/api/service-catalog/${editingItem.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-catalog"] });
      setIsOpen(false);
      setEditingItem(null);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Serviço atualizado com sucesso.",
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
      await apiRequest("DELETE", `/api/service-catalog/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-catalog"] });
      toast({
        title: "Sucesso",
        description: "Serviço excluído com sucesso.",
      });
    },
  });

  const onSubmit = (data: InsertServiceCatalog) => {
    if (editingItem) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (item: ServiceCatalog) => {
    setEditingItem(item);
    form.reset(item);
    setIsOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este serviço?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Catálogo de Serviços</h1>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setEditingItem(null);
            form.reset({
              name: "",
              description: "",
              nationalTaxationCode: "",
              nbsCode: "",
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Serviço
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Serviço</Label>
                <Input id="name" {...form.register("name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" {...form.register("description")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nationalTaxationCode">Código Tributação Nacional</Label>
                  <Input 
                    id="nationalTaxationCode" 
                    placeholder="Ex: 11.01" 
                    {...form.register("nationalTaxationCode")} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nbsCode">Código NBS</Label>
                  <Input 
                    id="nbsCode" 
                    placeholder="Ex: 1.05.01"
                    {...form.register("nbsCode")} 
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" type="button" onClick={() => setIsOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingItem ? "Salvar" : "Criar"}
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
              <Wrench className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Catálogo de Serviços</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {filteredCatalog?.length || 0} serviços cadastrados
                </p>
              </div>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, descrição..."
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
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredCatalog?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8">
                    <EmptyState 
                      icon={Wrench}
                      title={searchTerm ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado"}
                      description={searchTerm ? "Tente buscar com outros termos." : "Comece adicionando um novo serviço."}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredCatalog?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="max-w-md truncate" title={item.description || ""}>{item.description || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
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
