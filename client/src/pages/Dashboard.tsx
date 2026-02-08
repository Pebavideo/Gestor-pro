import { useState, useMemo } from "react";
import { useTransactions, formatCurrency } from "@/hooks/use-transactions";
import { useSettings } from "@/hooks/use-transactions";
import { useAuth } from "@/hooks/use-auth";
import { StatsCard } from "@/components/StatsCard";
import { CreateTransactionDialog } from "@/components/CreateTransactionDialog";
import { TransactionTable } from "@/components/TransactionTable";
import { TrendingUp, TrendingDown, Landmark, Wallet, CalendarDays } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function Dashboard() {
  const { data: transactions, isLoading: txLoading } = useTransactions();
  const { data: settingsData, isLoading: settingsLoading } = useSettings();
  const { isAdmin } = useAuth();

  const now = new Date();
  const [filterValue, setFilterValue] = useState("all");

  const monthFilter = useMemo(() => {
    if (filterValue === "all") return null;
    const [y, m] = filterValue.split("-").map(Number);
    return { year: y, month: m };
  }, [filterValue]);

  const availableMonths = useMemo(() => {
    if (!transactions) return [];
    const set = new Map<string, { year: number; month: number }>();
    for (const tx of transactions) {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!set.has(key)) {
        set.set(key, { year: d.getFullYear(), month: d.getMonth() });
      }
    }
    return Array.from(set.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [transactions]);

  const summary = useMemo(() => {
    if (!transactions) return { totalIncome: 0, totalExpenses: 0, taxAmount: 0, netProfit: 0, currentTaxRate: 0 };
    const taxRate = settingsData ? parseFloat(settingsData.taxRate) || 0 : 0;
    const filtered = monthFilter
      ? transactions.filter((tx) => {
          const d = new Date(tx.date);
          return d.getFullYear() === monthFilter.year && d.getMonth() === monthFilter.month;
        })
      : transactions;

    let totalIncome = 0;
    let totalExpenses = 0;
    for (const t of filtered) {
      if (t.type === "income") totalIncome += t.amount;
      else totalExpenses += t.amount;
    }
    const taxAmount = Math.round(totalIncome * (taxRate / 100));
    const netProfit = totalIncome - totalExpenses - taxAmount;
    return { totalIncome, totalExpenses, taxAmount, netProfit, currentTaxRate: taxRate };
  }, [transactions, settingsData, monthFilter]);

  const isLoading = txLoading || settingsLoading;

  const filterLabel = monthFilter
    ? `${MONTH_NAMES[monthFilter.month]} ${monthFilter.year}`
    : "Todos os meses";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">Painel Financeiro</h2>
          <p className="text-muted-foreground mt-1">Acompanhe suas receitas, despesas e resultados.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Select value={filterValue} onValueChange={setFilterValue}>
              <SelectTrigger className="w-[180px]" data-testid="select-month-filter">
                <SelectValue placeholder="Filtrar por mes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-month-all">Todos os meses</SelectItem>
                {availableMonths.map((m) => (
                  <SelectItem key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`} data-testid={`option-month-${m.year}-${m.month}`}>
                    {MONTH_NAMES[m.month]} {m.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CreateTransactionDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Faturamento Bruto"
          value={summary.totalIncome / 100}
          icon={TrendingUp}
          colorClass="text-emerald-500"
          trend={filterLabel}
          trendColor="neutral"
          isLoading={isLoading}
        />
        <StatsCard
          title="Despesas Totais"
          value={summary.totalExpenses / 100}
          icon={TrendingDown}
          colorClass="text-rose-500"
          trend={filterLabel}
          trendColor="neutral"
          isLoading={isLoading}
        />
        <StatsCard
          title="Impostos"
          value={summary.taxAmount / 100}
          icon={Landmark}
          colorClass="text-amber-500"
          trend={`Aliquota: ${summary.currentTaxRate}%`}
          trendColor="neutral"
          isLoading={isLoading}
        />
        <StatsCard
          title="Lucro Liquido"
          value={summary.netProfit / 100}
          icon={Wallet}
          colorClass="text-blue-600"
          trend={filterLabel}
          trendColor="neutral"
          isLoading={isLoading}
        />
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Transacoes {monthFilter ? `- ${MONTH_NAMES[monthFilter.month]} ${monthFilter.year}` : "Recentes"}</h3>
          <p className="text-muted-foreground text-sm mt-1">Gerencie suas entradas e saidas.</p>
        </div>
        <TransactionTable monthFilter={monthFilter} />
      </div>
    </div>
  );
}
