import { Building2, Home, Users, UserCheck, Wrench, FileText, Receipt, DollarSign, Send, FileCheck, LogOut } from "lucide-react";
import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";

const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Imóveis", url: "/properties", icon: Building2 },
  { title: "Locadores", url: "/landlords", icon: Users },
  { title: "Locatários", url: "/tenants", icon: UserCheck },
  { title: "Prestadores", url: "/providers", icon: Wrench },
  { title: "Contratos", url: "/contracts", icon: FileText },
  { title: "Serviços", url: "/services", icon: Wrench },
];

const financialItems = [
  { title: "Recibos", url: "/receipts", icon: Receipt },
  { title: "Caixa", url: "/cash", icon: DollarSign },
  { title: "Repasses", url: "/transfers", icon: Send },
  { title: "Notas Fiscais", url: "/invoices", icon: FileCheck },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">Imobiliária</span>
            <span className="text-xs text-sidebar-foreground/70">Simples</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.url.replace("/", "") || "dashboard"}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">Financeiro</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financialItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.url.replace("/", "")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-sidebar-foreground">{user?.name || "Admin"}</span>
            <span className="text-xs text-sidebar-foreground/60">{user?.email}</span>
          </div>
          <SidebarMenuButton onClick={logout} className="w-auto p-2" data-testid="button-logout">
            <LogOut className="h-4 w-4" />
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
