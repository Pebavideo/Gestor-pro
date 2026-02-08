import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactions, formatCurrency } from "@/hooks/use-transactions";
import { useSettings } from "@/hooks/use-transactions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, FileDown, Mail, TrendingUp, TrendingDown, ArrowDown, ArrowUp, Store } from "lucide-react";
import { generateDREPDF, openEmailDRE } from "@/lib/pdf-generator";
import { STORE_OPTIONS, getStoreLabel } from "@/components/CreateTransactionDialog";
import { getCategoryLabel } from "@shared/schema";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

type PeriodMode = "monthly" | "quarterly" | "annual" | "custom";

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

  const [periodMode, setPeriodMode] = useState<PeriodMode>("monthly");
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth()));
  const [selectedQuarter, setSelectedQuarter] = useState<string>("1");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [selectedStore, setSelectedStore] = useState<string>("all");

  const availableYears = useMemo(() => {
    if (!transactions) return [new Date().getFullYear()];
    const years = new Set<number>();
    for (const tx of transactions) {
      years.add(new Date(tx.date).getFullYear());
    }
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  const { dateFrom, dateTo, filterLabel } = useMemo(() => {
    const year = parseInt(selectedYear);
    let from: Date;
    let to: Date;
    let label: string;

    switch (periodMode) {
      case "monthly": {
        const month = parseInt(selectedMonth);
        const ref = new Date(year, month, 1);
        from = startOfMonth(ref);
        to = endOfMonth(ref);
        label = `${MONTH_NAMES[month]} ${year}`;
        break;
      }
      case "quarterly": {
        const q = parseInt(selectedQuarter);
        const qMonth = (q - 1) * 3;
        const ref = new Date(year, qMonth, 1);
        from = startOfQuarter(ref);
        to = endOfQuarter(ref);
        label = `${q}o Trimestre ${year}`;
        break;
      }
      case "annual": {
        const ref = new Date(year, 0, 1);
        from = startOfYear(ref);
        to = endOfYear(ref);
        label = `Ano ${year}`;
        break;
      }
      case "custom": {
        from = customFrom ? new Date(customFrom + "T00:00:00") : new Date(year, 0, 1);
        to = customTo ? new Date(customTo + "T23:59:59") : new Date();
        label = `${format(from, "dd/MM/yyyy")} a ${format(to, "dd/MM/yyyy")}`;
        break;
      }
    }

    return { dateFrom: from, dateTo: to, filterLabel: label };
  }, [periodMode, selectedYear, selectedMonth, selectedQuarter, customFrom, customTo]);

  const storeLabel = selectedStore !== "all" ? getStoreLabel(selectedStore) : null;

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx) => {
      const d = new Date(tx.date);
      if (d < dateFrom || d > dateTo) return false;
      if (selectedStore !== "all" && tx.store !== selectedStore) return false;
      return true;
    });
  }, [transactions, dateFrom, dateTo, selectedStore]);

  const dreData = useMemo(() => {
    const taxRate = settingsData ? parseFloat(settingsData.taxRate) || 0 : 0;

    let receitaBruta = 0;
    const receitaByCategory: Record<string, number> = {};
    const despesaByCategory: Record<string, number> = {};

    for (const tx of filteredTransactions) {
      const cat = tx.category || "outros";
      if (tx.type === "income") {
        receitaBruta += tx.amount;
        receitaByCategory[cat] = (receitaByCategory[cat] || 0) + tx.amount;
      } else {
        despesaByCategory[cat] = (despesaByCategory[cat] || 0) + tx.amount;
      }
    }

    const totalDespesas = Object.values(despesaByCategory).reduce((s, v) => s + v, 0);
    const impostos = Math.round(receitaBruta * (taxRate / 100));
    const receitaLiquida = receitaBruta - impostos;
    const lucroLiquido = receitaLiquida - totalDespesas;

    return {
      receitaBruta,
      receitaByCategory,
      impostos,
      receitaLiquida,
      despesaByCategory,
      totalDespesas,
      lucroLiquido,
      taxRate,
    };
  }, [filteredTransactions, settingsData]);

  const dreLines: DRELine[] = useMemo(() => {
    const lines: DRELine[] = [];

    lines.push({ label: "Receita Bruta de Vendas", value: dreData.receitaBruta, level: 0, isBold: true, color: "positive" });

    const receitaCats = Object.entries(dreData.receitaByCategory).sort((a, b) => b[1] - a[1]);
    for (const [cat, val] of receitaCats) {
      lines.push({ label: getCategoryLabel(cat) || "Outros", value: val, level: 2, color: "neutral" });
    }

    lines.push({ label: `(-) Impostos sobre Receita (${dreData.taxRate}%)`, value: -dreData.impostos, level: 1, color: "negative" });
    lines.push({ label: "(=) Receita Liquida", value: dreData.receitaLiquida, level: 0, isBold: true, isTotal: true, color: dreData.receitaLiquida >= 0 ? "positive" : "negative" });

    lines.push({ label: "(-) Despesas Totais", value: -dreData.totalDespesas, level: 0, isBold: true, color: "negative" });

    const despesaCats = Object.entries(dreData.despesaByCategory).sort((a, b) => b[1] - a[1]);
    for (const [cat, val] of despesaCats) {
      lines.push({ label: getCategoryLabel(cat) || "Outros", value: -val, level: 2, color: "neutral" });
    }

    lines.push({ label: "(=) Lucro Liquido do Exercicio", value: dreData.lucroLiquido, level: 0, isBold: true, isTotal: true, color: dreData.lucroLiquido >= 0 ? "positive" : "negative" });

    return lines;
  }, [dreData]);

  const isLoading = txLoading || settingsLoading;

  const dreExportData = {
    receitaBruta: dreData.receitaBruta,
    impostos: dreData.impostos,
    receitaLiquida: dreData.receitaLiquida,
    cpv: 0,
    lucroBruto: dreData.receitaLiquida,
    despesasSalarios: 0,
    despesasOutras: dreData.totalDespesas,
    totalDespesasOp: dreData.totalDespesas,
    lucroLiquido: dreData.lucroLiquido,
    taxRate: dreData.taxRate,
  };

  function handleExportPDF() {
    generateDREPDF(dreLines, filterLabel, dreExportData, storeLabel);
  }

  function handleEmail() {
    openEmailDRE(dreLines, filterLabel, dreExportData, storeLabel);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-dre-title">
            DRE - Demonstrativo de Resultados
          </h2>
          <p className="text-muted-foreground mt-1">Demonstracao do Resultado do Exercicio por categorias.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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

      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={periodMode} onValueChange={(v) => setPeriodMode(v as PeriodMode)}>
              <SelectTrigger className="w-[140px]" data-testid="dre-select-period-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="quarterly">Trimestral</SelectItem>
                <SelectItem value="annual">Anual</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {periodMode !== "custom" && (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px]" data-testid="dre-select-year">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)} data-testid={`dre-option-year-${y}`}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {periodMode === "monthly" && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[130px]" data-testid="dre-select-month">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, idx) => (
                    <SelectItem key={idx} value={String(idx)} data-testid={`dre-option-month-${idx}`}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {periodMode === "quarterly" && (
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="w-[140px]" data-testid="dre-select-quarter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1o Trimestre</SelectItem>
                  <SelectItem value="2">2o Trimestre</SelectItem>
                  <SelectItem value="3">3o Trimestre</SelectItem>
                  <SelectItem value="4">4o Trimestre</SelectItem>
                </SelectContent>
              </Select>
            )}

            {periodMode === "custom" && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground shrink-0">De:</Label>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-[140px]"
                    data-testid="dre-input-date-from"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground shrink-0">Ate:</Label>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-[140px]"
                    data-testid="dre-input-date-to"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-1 ml-auto">
              <Store className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className="w-[150px]" data-testid="dre-select-store">
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
          </div>
        </div>
      </Card>

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
                {isLoading ? "..." : formatCurrency((dreData.totalDespesas + dreData.impostos) / 100)}
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
