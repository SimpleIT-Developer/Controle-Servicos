import { Building2, FileText, Receipt, TrendingUp, AlertCircle, Users, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

interface DashboardStats {
  activeContracts: number;
  totalCompanies: number;
  totalClients: number;
  openReceipts: number;
  paidReceipts: number;
  monthlyRevenue: string;
}

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend,
  variant = "default" 
}: { 
  title: string; 
  value: string | number; 
  description?: string; 
  icon: any;
  trend?: string;
  variant?: "default" | "warning" | "success";
}) {
  const bgColors = {
    default: "bg-primary/10 text-primary",
    warning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    success: "bg-green-500/10 text-green-600 dark:text-green-400",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-md ${bgColors[variant]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span className="text-xs text-green-500">{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-32 mt-2" />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema - {currentMonth}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : stats ? (
          <>
            <StatCard
              title="Receita Mensal"
              value={`R$ ${stats.monthlyRevenue}`}
              description="Total recebido no mês"
              icon={TrendingUp}
              variant="success"
            />
            <StatCard
              title="Contratos Ativos"
              value={stats.activeContracts}
              description="Total de contratos vigentes"
              icon={FileText}
            />
            <StatCard
              title="Recibos em Aberto"
              value={stats.openReceipts}
              description="Aguardando pagamento"
              icon={AlertCircle}
              variant="warning"
            />
            <StatCard
              title="Recibos Pagos"
              value={stats.paidReceipts}
              description="Pagos neste mês"
              icon={CheckCircle}
              variant="success"
            />
          </>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : stats ? (
          <>
            <StatCard
              title="Empresas"
              value={stats.totalCompanies}
              description="Empresas cadastradas"
              icon={Building2}
            />
            <StatCard
              title="Clientes"
              value={stats.totalClients}
              description="Clientes cadastrados"
              icon={Users}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
