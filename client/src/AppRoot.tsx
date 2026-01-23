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
import Properties from "@/pages/properties";
import Tenants from "@/pages/tenants";
import Owners from "@/pages/landlords";
import Contracts from "@/pages/contracts";
import Maintenance from "@/pages/services";
import Providers from "@/pages/providers";
import Receipts from "@/pages/receipts";
import Cash from "@/pages/cash";
import Transfers from "@/pages/transfers";
import Invoices from "@/pages/invoices";
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

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/properties" component={() => <ProtectedRoute component={Properties} />} />
      <Route path="/tenants" component={() => <ProtectedRoute component={Tenants} />} />
      <Route path="/landlords" component={() => <ProtectedRoute component={Owners} />} />
      <Route path="/contracts" component={() => <ProtectedRoute component={Contracts} />} />
      <Route path="/services" component={() => <ProtectedRoute component={Maintenance} />} />
      <Route path="/providers" component={() => <ProtectedRoute component={Providers} />} />
      <Route path="/receipts" component={() => <ProtectedRoute component={Receipts} />} />
      <Route path="/cash" component={() => <ProtectedRoute component={Cash} />} />
      <Route path="/transfers" component={() => <ProtectedRoute component={Transfers} />} />
      <Route path="/invoices" component={() => <ProtectedRoute component={Invoices} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppRoot() {
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

export default AppRoot;
