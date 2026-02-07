import { useSummary } from "@/hooks/use-transactions";
import { StatsCard } from "@/components/StatsCard";
import { CreateTransactionDialog } from "@/components/CreateTransactionDialog";
import { TransactionTable } from "@/components/TransactionTable";
import { SettingsDialog } from "@/components/SettingsDialog";
import { TrendingUp, TrendingDown, Landmark, Wallet, Layers } from "lucide-react";

export default function Dashboard() {
  const { data: summary, isLoading } = useSummary();

  // Calculate trends/percentages for display (mocked logic or derived)
  const taxRate = summary?.currentTaxRate || 0;

  return (
    <div className="min-h-screen bg-background/50 pb-20">
      {/* Header Section */}
      <header className="sticky top-0 z-30 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold leading-none">Gestor Pro</h1>
                <p className="text-xs text-muted-foreground mt-1 font-medium">Painel Financeiro</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SettingsDialog />
              <div className="hidden sm:block">
                <CreateTransactionDialog />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in">
        {/* Mobile Floating Action Button */}
        <div className="fixed bottom-6 right-6 sm:hidden z-50">
          <CreateTransactionDialog />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatsCard
            title="Faturamento Bruto"
            value={(summary?.totalIncome || 0) / 100}
            icon={TrendingUp}
            colorClass="text-emerald-500"
            trend="+12.5% este mês"
            trendColor="green"
            isLoading={isLoading}
          />
          <StatsCard
            title="Despesas Totais"
            value={(summary?.totalExpenses || 0) / 100}
            icon={TrendingDown}
            colorClass="text-rose-500"
            trend="-2.4% este mês"
            trendColor="green" // Positive because expenses went down (logic example)
            isLoading={isLoading}
          />
          <StatsCard
            title="Impostos"
            value={(summary?.taxAmount || 0) / 100}
            icon={Landmark}
            colorClass="text-amber-500"
            trend={`Alíquota atual: ${taxRate}%`}
            trendColor="neutral"
            isLoading={isLoading}
          />
          <StatsCard
            title="Lucro Líquido"
            value={(summary?.netProfit || 0) / 100}
            icon={Wallet}
            colorClass="text-blue-600"
            trend="Resultado final"
            trendColor="neutral"
            isLoading={isLoading}
          />
        </div>

        {/* Main Content Area */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-display font-bold tracking-tight">Transações Recentes</h2>
              <p className="text-muted-foreground mt-1">Gerencie suas entradas e saídas.</p>
            </div>
            {/* Could add filters/search here later */}
          </div>

          <TransactionTable />
        </div>
      </main>
    </div>
  );
}
