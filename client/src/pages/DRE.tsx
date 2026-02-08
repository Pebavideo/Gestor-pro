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
import { CalendarDays, FileDown, Mail, TrendingUp, TrendingDown, ArrowDown, ArrowUp, Store, Eye } from "lucide-react";
import { generateDREPDF, openEmailDRE } from "@/lib/pdf-generator";
import { STORE_OPTIONS, getStoreLabel, getCategoryLabel } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

type PeriodMode = "monthly" | "quarterly" | "annual" | "custom";
type ViewMode = "realizado" | "previsto" | "comparativo";

interface DRELine {
  label: string;
  value: number;
  previstoValue?: number;
  level: number;
  isBold?: boolean;
  isTotal?: boolean;
  color?: "positive" | "negative" | "neutral" | "highlight";
}

export default function DRE() {
  const { data: transactions, isLoading: txLoading } = useTransactions();
  const { data: settingsData, isLoading: settingsLoading } = useSettings();
  const { isOperador, userStore, isMaster } = useAuth();

  const [periodMode, setPeriodMode] = useState<PeriodMode>("monthly");
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth()));
  const [selectedQuarter, setSelectedQuarter] = useState<string>("1");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("realizado");

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

  const filteredByStore = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx) => {
      if (selectedStore !== "all" && tx.store !== selectedStore) return false;
      return true;
    });
  }, [transactions, selectedStore]);

  const realizadoTx = useMemo(() => {
    return filteredByStore.filter((tx) => {
      if (tx.status !== "pago") return false;
      const payDate = tx.paymentDate ? new Date(tx.paymentDate) : new Date(tx.date);
      return payDate >= dateFrom && payDate <= dateTo;
    });
  }, [filteredByStore, dateFrom, dateTo]);

  const previstoTx = useMemo(() => {
    return filteredByStore.filter((tx) => {
      const refDate = tx.dueDate ? new Date(tx.dueDate) : new Date(tx.date);
      return refDate >= dateFrom && refDate <= dateTo;
    });
  }, [filteredByStore, dateFrom, dateTo]);

  function computeDRE(txList: typeof realizadoTx) {
    const taxRate = settingsData ? parseFloat(settingsData.taxRate) || 0 : 0;

    let receitaBruta = 0;
    const receitaByCategory: Record<string, number> = {};
    const despesaByCategory: Record<string, number> = {};

    for (const tx of txList) {
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
  }

  const dreRealizado = useMemo(() => computeDRE(realizadoTx), [realizadoTx, settingsData]);
  const drePrevisto = useMemo(() => computeDRE(previstoTx), [previstoTx, settingsData]);

  const dreData = viewMode === "previsto" ? drePrevisto : dreRealizado;

  const dreLines: DRELine[] = useMemo(() => {
    const lines: DRELine[] = [];
    const isComp = viewMode === "comparativo";
    const isPrev = viewMode === "previsto";
    const primary = isPrev ? drePrevisto : dreRealizado;

    lines.push({
      label: "Receita Bruta de Vendas",
      value: primary.receitaBruta,
      previstoValue: isComp ? drePrevisto.receitaBruta : undefined,
      level: 0, isBold: true, color: "positive",
    });

    const allReceitaCats = new Set([
      ...Object.keys(dreRealizado.receitaByCategory),
      ...Object.keys(drePrevisto.receitaByCategory),
    ]);
    for (const cat of Array.from(allReceitaCats).sort()) {
      lines.push({
        label: getCategoryLabel(cat) || "Outros",
        value: isPrev ? (drePrevisto.receitaByCategory[cat] || 0) : (dreRealizado.receitaByCategory[cat] || 0),
        previstoValue: isComp ? (drePrevisto.receitaByCategory[cat] || 0) : undefined,
        level: 2, color: "neutral",
      });
    }

    lines.push({
      label: `(-) Impostos sobre Receita (${primary.taxRate}%)`,
      value: -primary.impostos,
      previstoValue: isComp ? -drePrevisto.impostos : undefined,
      level: 1, color: "negative",
    });
    lines.push({
      label: "(=) Receita Liquida",
      value: primary.receitaLiquida,
      previstoValue: isComp ? drePrevisto.receitaLiquida : undefined,
      level: 0, isBold: true, isTotal: true,
      color: primary.receitaLiquida >= 0 ? "positive" : "negative",
    });

    lines.push({
      label: "(-) Despesas Totais",
      value: -primary.totalDespesas,
      previstoValue: isComp ? -drePrevisto.totalDespesas : undefined,
      level: 0, isBold: true, color: "negative",
    });

    const allDespesaCats = new Set([
      ...Object.keys(dreRealizado.despesaByCategory),
      ...Object.keys(drePrevisto.despesaByCategory),
    ]);
    for (const cat of Array.from(allDespesaCats).sort()) {
      lines.push({
        label: getCategoryLabel(cat) || "Outros",
        value: isPrev ? -(drePrevisto.despesaByCategory[cat] || 0) : -(dreRealizado.despesaByCategory[cat] || 0),
        previstoValue: isComp ? -(drePrevisto.despesaByCategory[cat] || 0) : undefined,
        level: 2, color: "neutral",
      });
    }

    lines.push({
      label: "(=) Lucro Liquido do Exercicio",
      value: primary.lucroLiquido,
      previstoValue: isComp ? drePrevisto.lucroLiquido : undefined,
      level: 0, isBold: true, isTotal: true,
      color: primary.lucroLiquido >= 0 ? "positive" : "negative",
    });

    return lines;
  }, [dreRealizado, drePrevisto, viewMode]);

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

  const isComp = viewMode === "comparativo";

  if (isOperador) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="p-8 text-center max-w-md">
          <p className="text-muted-foreground">Voce nao tem permissao para acessar o DRE.</p>
        </Card>
      </div>
    );
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

          <div className="flex items-center gap-2 border-t border-border/50 pt-3 flex-wrap">
            <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground shrink-0">Visao:</span>
            <div className="flex items-center gap-1">
              <Button
                variant={viewMode === "realizado" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("realizado")}
                className="toggle-elevate"
                data-testid="dre-btn-realizado"
              >
                Realizado
              </Button>
              <Button
                variant={viewMode === "previsto" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("previsto")}
                className="toggle-elevate"
                data-testid="dre-btn-previsto"
              >
                Previsto
              </Button>
              <Button
                variant={viewMode === "comparativo" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("comparativo")}
                className="toggle-elevate"
                data-testid="dre-btn-comparativo"
              >
                Previsto vs Realizado
              </Button>
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
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base" data-testid="dre-table-title">
              Demonstrativo - {filterLabel}
            </h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {viewMode === "realizado" ? "Realizado" : viewMode === "previsto" ? "Previsto" : "Comparativo"}
            </Badge>
          </div>
          {storeLabel && (
            <p className="text-sm font-semibold text-primary mt-1" data-testid="dre-store-label">
              Loja: {storeLabel}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerado em {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </p>
        </div>

        {isComp && (
          <div className="flex items-center justify-end gap-4 px-4 py-2 bg-muted/20 border-b border-border/30 text-xs text-muted-foreground font-medium">
            <span className="flex-1" />
            <span className="w-[110px] text-right">Realizado</span>
            <span className="w-[110px] text-right">Previsto</span>
            <span className="w-[80px] text-right">Diferenca</span>
          </div>
        )}

        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 w-full bg-muted/50 animate-pulse rounded-md" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {dreLines.map((line, idx) => {
              const displayValue = line.value;
              const colorClass = line.isTotal
                ? (displayValue >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")
                : line.color === "negative"
                  ? "text-rose-500 dark:text-rose-400"
                  : line.color === "positive"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-foreground";

              const bgClass = line.isTotal
                ? (displayValue >= 0 ? "bg-emerald-50/50 dark:bg-emerald-500/5" : "bg-rose-50/50 dark:bg-rose-500/5")
                : "";

              const diff = isComp && line.previstoValue !== undefined
                ? line.value - line.previstoValue
                : 0;

              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between px-4 py-3 gap-4 ${bgClass} ${line.level === 2 ? "pl-10" : line.level === 1 ? "pl-6" : "pl-4"}`}
                  data-testid={`dre-line-${idx}`}
                >
                  <span className={`text-sm flex-1 ${line.isBold ? "font-semibold" : ""} ${line.isTotal ? "text-base" : ""}`}>
                    {line.label}
                  </span>

                  {isComp ? (
                    <div className="flex items-center gap-4">
                      <span className={`font-mono text-sm text-right w-[110px] ${line.isBold ? "font-bold" : "font-medium"} ${colorClass}`}>
                        {formatCurrency(Math.abs(displayValue) / 100)}
                      </span>
                      <span className={`font-mono text-sm text-right w-[110px] ${line.isBold ? "font-bold" : "font-medium"} text-muted-foreground`}>
                        {line.previstoValue !== undefined ? formatCurrency(Math.abs(line.previstoValue) / 100) : "-"}
                      </span>
                      <span className={`font-mono text-xs text-right w-[80px] ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                        {diff !== 0 ? (diff > 0 ? "+" : "") + formatCurrency(Math.abs(diff) / 100) : "-"}
                      </span>
                    </div>
                  ) : (
                    <span className={`font-mono text-sm ${line.isBold ? "font-bold" : "font-medium"} ${colorClass} ${line.isTotal ? "text-base" : ""}`}>
                      {formatCurrency(Math.abs(displayValue) / 100)}
                    </span>
                  )}
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
