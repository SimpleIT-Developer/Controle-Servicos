import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import PropertiesPage from "@/pages/properties";
import LandlordsPage from "@/pages/landlords";
import TenantsPage from "@/pages/tenants";
import ProvidersPage from "@/pages/providers";
import ContractsPage from "@/pages/contracts";
import ServicesPage from "@/pages/services";
import ReceiptsPage from "@/pages/receipts";
import CashPage from "@/pages/cash";
import TransfersPage from "@/pages/transfers";
import InvoicesPage from "@/pages/invoices";
import { Loader2 } from "lucide-react";

function AuthenticatedRoutes() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/properties" component={PropertiesPage} />
      <Route path="/landlords" component={LandlordsPage} />
      <Route path="/tenants" component={TenantsPage} />
      <Route path="/providers" component={ProvidersPage} />
      <Route path="/contracts" component={ContractsPage} />
      <Route path="/services" component={ServicesPage} />
      <Route path="/receipts" component={ReceiptsPage} />
      <Route path="/cash" component={CashPage} />
      <Route path="/transfers" component={TransfersPage} />
      <Route path="/invoices" component={InvoicesPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user && location !== "/login") {
    return <LoginPage />;
  }

  if (location === "/login" && !user) {
    return <LoginPage />;
  }

  if (location === "/login" && user) {
    window.location.href = "/";
    return null;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-2">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <AuthenticatedRoutes />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
