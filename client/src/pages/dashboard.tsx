import { Building2, FileText, Layout, Users, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface DashboardStats {
  activeProjects: number;
  activeSystems: number;
  totalCompanies: number;
  totalClients: number;
}

interface RevenueData {
  name: string;
  Total: number;
  [key: string]: number | string; // For dynamic company names
}

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  variant = "default" 
}: { 
  title: string; 
  value: string | number; 
  description?: string; 
  icon: any;
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
  const { data: stats, isLoading: isLoadingStats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: chartData, isLoading: isLoadingChart } = useQuery<RevenueData[]>({
    queryKey: ["/api/dashboard/revenue-chart"],
  });

  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Extract unique keys (companies) from chart data, excluding 'name', 'Total', 'dateVal'
  const companyKeys = chartData 
    ? Array.from(new Set(chartData.flatMap(Object.keys))).filter(k => k !== 'name' && k !== 'Total' && k !== 'dateVal')
    : [];
  
  // Assign colors to companies dynamically or use a palette
  const colors = [
    "#2563eb", // blue-600
    "#16a34a", // green-600
    "#db2777", // pink-600
    "#ea580c", // orange-600
    "#7c3aed", // violet-600
    "#0891b2", // cyan-600
    "#ca8a04", // yellow-600
    "#dc2626", // red-600
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-md shadow-md p-3 text-popover-foreground text-sm">
          <p className="font-semibold mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              entry.name !== 'Total' && (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: entry.color }} 
                  />
                  <span className="text-muted-foreground flex-1">{entry.name}:</span>
                  <span className="font-medium tabular-nums">
                    {Number(entry.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              )
            ))}
            {/* Show Total Summary if multiple companies */}
            {payload.length > 1 && (
               <div className="pt-2 mt-2 border-t flex items-center justify-between font-bold">
                 <span>Total:</span>
                 <span className="tabular-nums">
                   {payload.reduce((sum: number, entry: any) => sum + (entry.name !== 'Total' ? Number(entry.value) : 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                 </span>
               </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema - {currentMonth}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoadingStats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : stats ? (
          <>
            <StatCard
              title="Contratos Ativos"
              value={stats.activeProjects}
              description="Projetos (Clientes, Parcerias)"
              icon={FileText}
            />
            <StatCard
              title="Sistemas Ativos"
              value={stats.activeSystems}
              description="Contratos de Sistemas"
              icon={Monitor}
            />
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

      <div className="grid gap-4 md:grid-cols-1">
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle>Faturamento Mensal por Empresa</CardTitle>
                <p className="text-sm text-muted-foreground">Evolução da receita nos últimos meses</p>
            </CardHeader>
            <CardContent className="pl-0">
                {isLoadingChart ? (
                    <div className="h-[400px] w-full flex items-center justify-center">
                        <Skeleton className="h-[350px] w-full" />
                    </div>
                ) : chartData && chartData.length > 0 ? (
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis 
                                  dataKey="name" 
                                  stroke="#888888" 
                                  fontSize={12} 
                                  tickLine={false} 
                                  axisLine={false} 
                                />
                                <YAxis 
                                  stroke="#888888" 
                                  fontSize={12} 
                                  tickLine={false} 
                                  axisLine={false}
                                  tickFormatter={(value) => `R$ ${value}`} 
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                {companyKeys.map((company, index) => (
                                    <Bar 
                                        key={company} 
                                        dataKey={company} 
                                        stackId="a" 
                                        fill={colors[index % colors.length]} 
                                        radius={index === companyKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                        maxBarSize={60}
                                    />
                                ))}
                                {/* Total is implicitly handled by stack, but kept for data consistency if needed elsewhere */}
                                <Bar dataKey="Total" fill="#000000" hide={true} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                        Nenhum dado de faturamento disponível
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
