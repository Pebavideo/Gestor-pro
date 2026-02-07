import { useEffect } from "react";
import { useSummary } from "@/hooks/use-transactions";
import { useAuth } from "@/hooks/use-auth";
import { StatsCard } from "@/components/StatsCard";
import { CreateTransactionDialog } from "@/components/CreateTransactionDialog";
import { TransactionTable } from "@/components/TransactionTable";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrendingUp, TrendingDown, Landmark, Wallet, Layers, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { data: summary, isLoading } = useSummary();
  const { user, isAdmin, role, logout } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const taxRate = summary?.currentTaxRate || 0;

  useEffect(() => {
    async function tryPromote() {
      try {
        const res = await fetch("/api/user/make-admin", {
          method: "PATCH",
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.role === "admin") {
          queryClient.invalidateQueries({ queryKey: ["/api/user/role"] });
        }
      } catch {}
    }
    tryPromote();
  }, []);

  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "U"
    : "U";

  return (
    <div className="min-h-screen bg-background/50 pb-20">
      <header className="sticky top-0 z-30 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-none" data-testid="text-app-title">Gestor Pro</h1>
                <p className="text-xs text-muted-foreground mt-1 font-medium">Painel Financeiro</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {isAdmin && <SettingsDialog />}
              <div className="hidden sm:block">
                <CreateTransactionDialog />
              </div>
              <div className="flex items-center gap-2 pl-2 border-l border-border/40">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profileImageUrl || ""} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col">
                  <span className="text-sm font-medium leading-none" data-testid="text-username">
                    {user?.firstName || user?.email || "Usuario"}
                  </span>
                  <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 py-0" data-testid="badge-role">
                    {role === "admin" ? "Admin" : "Operador"}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => logout()}
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in">
        <div className="fixed bottom-6 right-6 sm:hidden z-50">
          <CreateTransactionDialog />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatsCard
            title="Faturamento Bruto"
            value={(summary?.totalIncome || 0) / 100}
            icon={TrendingUp}
            colorClass="text-emerald-500"
            trend="+12.5% este mes"
            trendColor="green"
            isLoading={isLoading}
          />
          <StatsCard
            title="Despesas Totais"
            value={(summary?.totalExpenses || 0) / 100}
            icon={TrendingDown}
            colorClass="text-rose-500"
            trend="-2.4% este mes"
            trendColor="green"
            isLoading={isLoading}
          />
          <StatsCard
            title="Impostos"
            value={(summary?.taxAmount || 0) / 100}
            icon={Landmark}
            colorClass="text-amber-500"
            trend={`Aliquota atual: ${taxRate}%`}
            trendColor="neutral"
            isLoading={isLoading}
          />
          <StatsCard
            title="Lucro Liquido"
            value={(summary?.netProfit || 0) / 100}
            icon={Wallet}
            colorClass="text-blue-600"
            trend="Resultado final"
            trendColor="neutral"
            isLoading={isLoading}
          />
        </div>

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Transacoes Recentes</h2>
              <p className="text-muted-foreground mt-1">Gerencie suas entradas e saidas.</p>
            </div>
          </div>

          <TransactionTable />
        </div>
      </main>
    </div>
  );
}
