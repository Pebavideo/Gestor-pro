import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import Dashboard from "@/pages/Dashboard";
import TeamManagement from "@/pages/TeamManagement";
import Products from "@/pages/Products";
import DRE from "@/pages/DRE";
import AuthPage from "@/pages/AuthPage";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import NotFound from "@/pages/not-found";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Layers, LayoutDashboard, Users, Package, LogOut, BarChart3 } from "lucide-react";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ProfileDialog } from "@/components/ProfileDialog";
import { UserManagementDialog } from "@/components/UserManagementDialog";
import { SiteFooter } from "@/components/SiteFooter";
import { getStoreLabel } from "@shared/schema";
import { getRoleLabel } from "@shared/models/auth";

function AppSidebar() {
  const { user, isMaster, isGerente, isOperador, role, userStore, logout } = useAuth();
  const [location, navigate] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "U"
    : "U";

  const navItems = [
    { path: "/", label: "Painel Financeiro", icon: LayoutDashboard, testId: "dashboard", visible: true },
    { path: "/dre", label: "DRE", icon: BarChart3, testId: "dre", visible: !isOperador },
    { path: "/produtos", label: "Produtos", icon: Package, testId: "products", visible: true },
    { path: "/equipe", label: "Gestao de Equipe", icon: Users, testId: "team", visible: true },
  ];

  const handleNav = (path: string) => {
    navigate(path);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const roleColor = isMaster ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
    isGerente ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" :
    "bg-muted text-muted-foreground";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none" data-testid="text-app-title">Gestor Pro</h1>
            <p className="text-[11px] text-sidebar-foreground/60 mt-0.5">Gestao Empresarial</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegacao</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.filter(item => item.visible).map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      size="lg"
                      onClick={() => handleNav(item.path)}
                      data-testid={`nav-${item.testId}`}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="text-base">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        {isMaster && <SettingsDialog />}
        {isMaster && <UserManagementDialog />}
        <ProfileDialog />
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profileImageUrl || ""} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-username">
              {user?.firstName || user?.email || "Usuario"}
            </p>
            <div className="flex items-center gap-1 flex-wrap">
              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${roleColor}`} data-testid="badge-role">
                {getRoleLabel(role)}
              </Badge>
              {userStore && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0" data-testid="badge-user-store">
                  {getStoreLabel(userStore)}
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { logout(); if (isMobile) setOpenMobile(false); }} data-testid="button-logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function AppLayout() {
  // O primeiro usuario master nao e mais auto-promovido por uma rota de
  // API (nao ha servidor confiavel pra isso sem abrir uma brecha de
  // seguranca nas regras do Firestore). Rode
  // "npm run promote-to-master -- <email>" uma vez, localmente, apos o
  // primeiro login.

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-2 p-2 border-b border-border/40">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto flex flex-col">
            <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 flex-1">
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/dre" component={DRE} />
                <Route path="/produtos" component={Products} />
                <Route path="/equipe" component={TeamManagement} />
                <Route component={NotFound} />
              </Switch>
            </div>
            <SiteFooter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const [location] = useLocation();
  const { isAuthenticated, isVerified, isLoading } = useAuth();

  // Paginas legais sao publicas - acessiveis mesmo sem login (ex: antes de
  // se cadastrar), sem esperar o carregamento de autenticacao.
  if (location === "/privacidade") return <Privacy />;
  if (location === "/termos") return <Terms />;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isVerified) {
    return <AuthPage />;
  }

  return <AppLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
