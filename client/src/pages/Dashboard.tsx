import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactions, formatCurrency } from "@/hooks/use-transactions";
import { useSettings } from "@/hooks/use-transactions";
import { useAuth } from "@/hooks/use-auth";
import { StatsCard } from "@/components/StatsCard";
import { CreateTransactionDialog } from "@/components/CreateTransactionDialog";
import { TransactionTable } from "@/components/TransactionTable";
import { TrendingUp, TrendingDown, Landmark, Wallet, CalendarDays, FileDown, Printer } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { generateDashboardPDF, printTable } from "@/lib/pdf-generator";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function Dashboard() {
  const { data: transactions, isLoading: txLoading } = useTransactions();
  const { data: settingsData, isLoading: settingsLoading } = useSettings();
  const { isAdmin } = useAuth();

  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const availableYears = useMemo(() => {
    if (!transactions) return [];
    const years = new Set<number>();
    for (const tx of transactions) {
      years.add(new Date(tx.date).getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  const availableMonthsForYear = useMemo(() => {
    if (!transactions || selectedYear === "all") return [];
    const year = parseInt(selectedYear);
    const months = new Set<number>();
    for (const tx of transactions) {
      const d = new Date(tx.date);
      if (d.getFullYear() === year) {
        months.add(d.getMonth());
      }
    }
    return Array.from(months).sort((a, b) => a - b);
  }, [transactions, selectedYear]);

  const monthFilter = useMemo(() => {
    if (selectedYear === "all") return null;
    if (selectedMonth === "all") return { year: parseInt(selectedYear), month: null };
    return { year: parseInt(selectedYear), month: parseInt(selectedMonth) };
  }, [selectedYear, selectedMonth]);

  function handleYearChange(value: string) {
    setSelectedYear(value);
    setSelectedMonth("all");
  }

  const summary = useMemo(() => {
    if (!transactions) return { totalIncome: 0, totalExpenses: 0, taxAmount: 0, netProfit: 0, currentTaxRate: 0 };
    const taxRate = settingsData ? parseFloat(settingsData.taxRate) || 0 : 0;
    const filtered = monthFilter
      ? transactions.filter((tx) => {
          const d = new Date(tx.date);
          if (d.getFullYear() !== monthFilter.year) return false;
          if (monthFilter.month !== null && d.getMonth() !== monthFilter.month) return false;
          return true;
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
    ? monthFilter.month !== null
      ? `${MONTH_NAMES[monthFilter.month]} ${monthFilter.year}`
      : `${monthFilter.year}`
    : "Todos os periodos";

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (!monthFilter) return transactions;
    return transactions.filter((tx) => {
      const d = new Date(tx.date);
      if (d.getFullYear() !== monthFilter.year) return false;
      if (monthFilter.month !== null && d.getMonth() !== monthFilter.month) return false;
      return true;
    });
  }, [transactions, monthFilter]);

  function handleExportPDF() {
    generateDashboardPDF(summary, filteredTransactions, filterLabel);
  }

  function handlePrint() {
    printTable(`Relatorio Financeiro - ${filterLabel}`, "printable-transactions");
  }

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
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger className="w-[120px]" data-testid="select-year-filter">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-year-all">Todos</SelectItem>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)} data-testid={`option-year-${y}`}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedYear !== "all" && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[140px]" data-testid="select-month-filter">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-month-all">Todos os meses</SelectItem>
                  {availableMonthsForYear.map((m) => (
                    <SelectItem key={m} value={String(m)} data-testid={`option-month-${m}`}>
                      {MONTH_NAMES[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <CreateTransactionDialog />
          <Button
            variant="outline"
            size="icon"
            onClick={handleExportPDF}
            disabled={isLoading || !transactions?.length}
            data-testid="button-export-pdf"
            title="Exportar PDF"
          >
            <FileDown className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrint}
            disabled={isLoading || !transactions?.length}
            data-testid="button-print-dashboard"
            title="Imprimir"
          >
            <Printer className="h-4 w-4" />
          </Button>
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
          <h3 className="text-lg font-semibold">Transacoes {monthFilter ? `- ${monthFilter.month !== null ? MONTH_NAMES[monthFilter.month] + " " : ""}${monthFilter.year}` : "Recentes"}</h3>
          <p className="text-muted-foreground text-sm mt-1">Gerencie suas entradas e saidas.</p>
        </div>
        <TransactionTable monthFilter={monthFilter} />
      </div>

      <div id="printable-transactions" className="hidden">
        <table>
          <thead>
            <tr>
              <th>Descricao</th>
              <th>Data</th>
              <th>Tipo</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx) => (
              <tr key={tx.id}>
                <td>{tx.description}</td>
                <td>{format(new Date(tx.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</td>
                <td className={tx.type === "income" ? "income" : "expense"}>
                  {tx.type === "income" ? "Entrada" : "Saida"}
                </td>
                <td className={tx.type === "income" ? "income" : "expense"}>
                  {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount / 100)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
