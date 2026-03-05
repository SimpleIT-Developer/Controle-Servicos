import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "@/hooks/use-auth";
import { Switch, Route } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider } from "@/components/ui/sidebar";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import Companies from "@/pages/companies";
import Clients from "@/pages/clients";
import Analysts from "@/pages/analysts";
import Partners from "@/pages/partners";
import ServiceCatalog from "@/pages/service-catalog";
import Contracts from "@/pages/contracts";
import Receipts from "@/pages/receipts";
import Cash from "@/pages/cash";
import Invoices from "@/pages/invoices";
import NfseConfigPage from "@/pages/nfse-config";
import RevenueReportPage from "@/pages/reports/revenue";
import SystemLogsPage from "@/pages/system-logs";
import SystemContractsPage from "@/pages/system-contracts";
import PrintReceiptPage from "@/pages/print-receipt";
import { AppSidebar } from "@/components/app-sidebar";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-8">
          <Component />
        </main>
      </div>
    </SidebarProvider>
  );
}

function PrintRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={AuthPage} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/companies" component={() => <ProtectedRoute component={Companies} />} />
      <Route path="/projects" component={() => <ProtectedRoute component={Projects} />} />
      <Route path="/projects/partners" component={() => <ProtectedRoute component={() => <Projects mode="partner" />} />} />
      <Route path="/projects/systems" component={() => <ProtectedRoute component={SystemContractsPage} />} />
      <Route path="/clients" component={() => <ProtectedRoute component={Clients} />} />
      <Route path="/analysts" component={() => <ProtectedRoute component={Analysts} />} />
      <Route path="/partners" component={() => <ProtectedRoute component={Partners} />} />
      <Route path="/service-catalog" component={() => <ProtectedRoute component={ServiceCatalog} />} />
      <Route path="/contracts" component={() => <ProtectedRoute component={Contracts} />} />
      <Route path="/receipts" component={() => <ProtectedRoute component={Receipts} />} />
      <Route path="/receipts/:id/print" component={() => <PrintRoute component={PrintReceiptPage} />} />
      <Route path="/cash" component={() => <ProtectedRoute component={Cash} />} />
      <Route path="/invoices" component={() => <ProtectedRoute component={Invoices} />} />
      <Route path="/nfse/config" component={() => <ProtectedRoute component={NfseConfigPage} />} />
      <Route path="/system/logs" component={() => <ProtectedRoute component={SystemLogsPage} />} />
      <Route path="/reports/revenue" component={() => <ProtectedRoute component={RevenueReportPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
