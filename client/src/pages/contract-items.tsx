import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Loader2, ArrowLeft, ListTodo } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Contract, ContractItem, Company, Client, Analyst } from "@shared/schema";
import { format } from "date-fns";

export default function ContractItemsPage() {
  const { id } = useParams();
  const [_, setLocation] = useLocation();

  const { data: contract, isLoading: isLoadingContract } = useQuery<Contract>({
    queryKey: [`/api/contracts/${id}`],
  });

  const { data: items, isLoading: isLoadingItems } = useQuery<ContractItem[]>({
    queryKey: [`/api/contracts/${id}/items`], // Note: We might need to implement this endpoint or use existing query
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${id}/items`);
      if (!res.ok) throw new Error("Failed to fetch contract items");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: company } = useQuery<Company>({
    queryKey: [`/api/companies/${contract?.companyId}`],
    enabled: !!contract?.companyId,
  });

  const { data: client } = useQuery<Client>({
    queryKey: [`/api/clients/${contract?.clientId}`],
    enabled: !!contract?.clientId,
  });

  const { data: analysts } = useQuery<Analyst[]>({
    queryKey: ["/api/analysts"],
  });

  if (isLoadingContract || isLoadingItems) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contract) {
    return <div className="p-8 text-center">Contrato não encontrado.</div>;
  }

  const getAnalystName = (analystId: string | null) => {
    if (!analystId) return "-";
    return analysts?.find(a => a.id === analystId)?.name || "Desconhecido";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/contracts")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Histórico de Serviços do Contrato</h1>
          <p className="text-muted-foreground">
            {contract.description} - {company?.name} / {client?.name}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Itens Lançados</CardTitle>
          <CardDescription>
            Lista de todos os serviços e ajustes lançados neste contrato.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!items || items.length === 0 ? (
            <EmptyState 
              icon={ListTodo}
              title="Nenhum item lançado"
              description="Nenhum serviço ou ajuste foi lançado para este contrato."
              className="border-0 py-8"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Ref.</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Cobrar de</TableHead>
                  <TableHead>Analista</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Repasse</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.sort((a, b) => {
                  if (a.refYear !== b.refYear) return b.refYear - a.refYear;
                  return b.refMonth - a.refMonth;
                }).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {String(item.refMonth).padStart(2, '0')}/{item.refYear}
                    </TableCell>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {item.chargedTo === "CLIENT" ? "Cliente" : "Empresa"}
                      </Badge>
                    </TableCell>
                    <TableCell>{getAnalystName(item.analystId)}</TableCell>
                    <TableCell className="text-right">
                      R$ {Number(item.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.passThrough ? <Badge variant="secondary">Sim</Badge> : "-"}
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
