import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactions, formatCurrency } from "@/hooks/use-transactions";
import { useSettings } from "@/hooks/use-transactions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, FileDown, Mail, TrendingUp, TrendingDown, ArrowDown, ArrowUp, Store } from "lucide-react";
import { generateDREPDF, openEmailDRE } from "@/lib/pdf-generator";
import { STORE_OPTIONS, getStoreLabel } from "@/components/CreateTransactionDialog";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

interface DRELine {
  label: string;
  value: number;
  level: number;
  isBold?: boolean;
  isTotal?: boolean;
  color?: "positive" | "negative" | "neutral" | "highlight";
}

export default function DRE() {
  const { data: transactions, isLoading: txLoading } = useTransactions();
  const { data: settingsData, isLoading: settingsLoading } = useSettings();

  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedStore, setSelectedStore] = useState<string>("all");

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
      if (d.getFullYear() === year) months.add(d.getMonth());
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

  const storeLabel = selectedStore !== "all" ? getStoreLabel(selectedStore) : null;

  const filterLabel = [
    monthFilter
      ? monthFilter.month !== null
        ? `${MONTH_NAMES[monthFilter.month]} ${monthFilter.year}`
        : `${monthFilter.year}`
      : "Todos os periodos",
    storeLabel ? `Loja: ${storeLabel}` : null,
  ].filter(Boolean).join(" | ");

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx) => {
      if (monthFilter) {
        const d = new Date(tx.date);
        if (d.getFullYear() !== monthFilter.year) return false;
        if (monthFilter.month !== null && d.getMonth() !== monthFilter.month) return false;
      }
      if (selectedStore !== "all" && tx.store !== selectedStore) return false;
      return true;
    });
  }, [transactions, monthFilter, selectedStore]);

  const dreData = useMemo(() => {
    const taxRate = settingsData ? parseFloat(settingsData.taxRate) || 0 : 0;

    let receitaBruta = 0;
    let cpv = 0;
    let despesasSalarios = 0;
    let despesasOutras = 0;

    for (const tx of filteredTransactions) {
      if (tx.type === "income") {
        receitaBruta += tx.amount;
      } else {
        const descLower = tx.description.toLowerCase();
        if (descLower.startsWith("pagamento ") || descLower.includes("salario") || descLower.includes("folha")) {
          despesasSalarios += tx.amount;
        } else if (descLower.includes("produto") || descLower.includes("estoque") || descLower.includes("compra") || descLower.includes("mercadoria")) {
          cpv += tx.amount;
        } else {
          despesasOutras += tx.amount;
        }
      }
    }

    const impostos = Math.round(receitaBruta * (taxRate / 100));
    const receitaLiquida = receitaBruta - impostos;
    const lucroBruto = receitaLiquida - cpv;
    const totalDespesasOp = despesasSalarios + despesasOutras;
    const lucroLiquido = lucroBruto - totalDespesasOp;

    return {
      receitaBruta,
      impostos,
      receitaLiquida,
      cpv,
      lucroBruto,
      despesasSalarios,
      despesasOutras,
      totalDespesasOp,
      lucroLiquido,
      taxRate,
    };
  }, [filteredTransactions, settingsData]);

  const dreLines: DRELine[] = [
    { label: "Receita Bruta de Vendas", value: dreData.receitaBruta, level: 0, isBold: true, color: "positive" },
    { label: `(-) Impostos sobre Receita (${dreData.taxRate}%)`, value: -dreData.impostos, level: 1, color: "negative" },
    { label: "(=) Receita Liquida", value: dreData.receitaLiquida, level: 0, isBold: true, isTotal: true, color: dreData.receitaLiquida >= 0 ? "positive" : "negative" },
    { label: "(-) Custo dos Produtos Vendidos (CPV)", value: -dreData.cpv, level: 1, color: "negative" },
    { label: "(=) Lucro Bruto", value: dreData.lucroBruto, level: 0, isBold: true, isTotal: true, color: dreData.lucroBruto >= 0 ? "positive" : "negative" },
    { label: "(-) Despesas Operacionais", value: -dreData.totalDespesasOp, level: 1, isBold: true, color: "negative" },
    { label: "Salarios e Encargos", value: -dreData.despesasSalarios, level: 2, color: "neutral" },
    { label: "Outras Despesas Operacionais", value: -dreData.despesasOutras, level: 2, color: "neutral" },
    { label: "(=) Lucro Liquido do Exercicio", value: dreData.lucroLiquido, level: 0, isBold: true, isTotal: true, color: dreData.lucroLiquido >= 0 ? "positive" : "negative" },
  ];

  const isLoading = txLoading || settingsLoading;

  function handleExportPDF() {
    generateDREPDF(dreLines, filterLabel, dreData, storeLabel);
  }

  function handleEmail() {
    openEmailDRE(dreLines, filterLabel, dreData, storeLabel);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-dre-title">
            DRE - Demonstrativo de Resultados
          </h2>
          <p className="text-muted-foreground mt-1">Demonstracao do Resultado do Exercicio simplificada.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger className="w-[120px]" data-testid="dre-select-year">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="dre-option-year-all">Todos</SelectItem>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)} data-testid={`dre-option-year-${y}`}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedYear !== "all" && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[140px]" data-testid="dre-select-month">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="dre-option-month-all">Todos os meses</SelectItem>
                  {availableMonthsForYear.map((m) => (
                    <SelectItem key={m} value={String(m)} data-testid={`dre-option-month-${m}`}>
                      {MONTH_NAMES[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Store className="h-4 w-4 text-muted-foreground ml-1" />
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-[160px]" data-testid="dre-select-store">
                <SelectValue placeholder="Loja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="dre-option-store-all">Todas as lojas</SelectItem>
                {STORE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} data-testid={`dre-option-store-${opt.value}`}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleExportPDF}
            disabled={isLoading || !transactions?.length}
            data-testid="dre-button-export-pdf"
            title="Exportar PDF"
          >
            <FileDown className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleEmail}
            disabled={isLoading || !transactions?.length}
            data-testid="dre-button-email"
            title="Enviar por E-mail"
          >
            <Mail className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Receita Bruta</p>
              <p className="text-lg font-bold text-emerald-600" data-testid="dre-receita-bruta">
                {isLoading ? "..." : formatCurrency(dreData.receitaBruta / 100)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/10">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Despesas Totais</p>
              <p className="text-lg font-bold text-rose-600" data-testid="dre-despesas-totais">
                {isLoading ? "..." : formatCurrency((dreData.cpv + dreData.totalDespesasOp + dreData.impostos) / 100)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${dreData.lucroLiquido >= 0 ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10'}`}>
              {dreData.lucroLiquido >= 0 ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lucro Liquido</p>
              <p className={`text-lg font-bold ${dreData.lucroLiquido >= 0 ? 'text-blue-600' : 'text-rose-600'}`} data-testid="dre-lucro-liquido">
                {isLoading ? "..." : formatCurrency(dreData.lucroLiquido / 100)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/30">
          <h3 className="font-semibold text-base" data-testid="dre-table-title">
            Demonstrativo - {filterLabel}
          </h3>
          {storeLabel && (
            <p className="text-sm font-semibold text-primary mt-1" data-testid="dre-store-label">
              Loja: {storeLabel}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerado em {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 w-full bg-muted/50 animate-pulse rounded-md" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {dreLines.map((line, idx) => {
              const isNeg = line.value < 0;
              const isPos = line.value > 0;
              const colorClass = line.isTotal
                ? line.color === "positive"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
                : line.color === "negative"
                  ? "text-rose-500 dark:text-rose-400"
                  : line.color === "positive"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-foreground";

              const bgClass = line.isTotal
                ? line.color === "positive"
                  ? "bg-emerald-50/50 dark:bg-emerald-500/5"
                  : "bg-rose-50/50 dark:bg-rose-500/5"
                : "";

              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between px-4 py-3 gap-4 ${bgClass} ${line.level === 2 ? "pl-10" : line.level === 1 ? "pl-6" : "pl-4"}`}
                  data-testid={`dre-line-${idx}`}
                >
                  <span className={`text-sm ${line.isBold ? "font-semibold" : ""} ${line.isTotal ? "text-base" : ""}`}>
                    {line.label}
                  </span>
                  <span className={`font-mono text-sm ${line.isBold ? "font-bold" : "font-medium"} ${colorClass} ${line.isTotal ? "text-base" : ""}`}>
                    {formatCurrency(Math.abs(line.value) / 100)}
                    {line.value !== 0 && (
                      <span className="ml-1 text-xs">
                        {isNeg ? "" : isPos ? "" : ""}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && dreData.lucroLiquido !== 0 && (
          <div className={`p-4 border-t-2 ${dreData.lucroLiquido >= 0 ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-500/10' : 'border-rose-500 bg-rose-50/80 dark:bg-rose-500/10'}`}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                {dreData.lucroLiquido >= 0 ? (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                    LUCRO
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400">
                    PREJUIZO
                  </Badge>
                )}
                <span className="text-sm font-medium">
                  {dreData.lucroLiquido >= 0
                    ? "A empresa apresenta resultado positivo no periodo."
                    : "A empresa apresenta prejuizo no periodo."}
                </span>
              </div>
              <span className={`font-mono font-bold text-lg ${dreData.lucroLiquido >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {formatCurrency(Math.abs(dreData.lucroLiquido) / 100)}
              </span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
