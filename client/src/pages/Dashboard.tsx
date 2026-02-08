import { useSummary } from "@/hooks/use-transactions";
import { useAuth } from "@/hooks/use-auth";
import { StatsCard } from "@/components/StatsCard";
import { CreateTransactionDialog } from "@/components/CreateTransactionDialog";
import { TransactionTable } from "@/components/TransactionTable";
import { TrendingUp, TrendingDown, Landmark, Wallet } from "lucide-react";

export default function Dashboard() {
  const { data: summary, isLoading } = useSummary();
  const { isAdmin } = useAuth();

  const taxRate = summary?.currentTaxRate || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">Painel Financeiro</h2>
          <p className="text-muted-foreground mt-1">Acompanhe suas receitas, despesas e resultados.</p>
        </div>
        <CreateTransactionDialog />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Transacoes Recentes</h3>
          <p className="text-muted-foreground text-sm mt-1">Gerencie suas entradas e saidas.</p>
        </div>
        <TransactionTable />
      </div>
    </div>
  );
}
