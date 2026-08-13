import { useState, useMemo, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactions, useImportCSV, formatCurrency } from "@/hooks/use-transactions";
import { useSettings } from "@/hooks/use-transactions";
import { useAuth } from "@/hooks/use-auth";
import { StatsCard } from "@/components/StatsCard";
import { CreateTransactionDialog } from "@/components/CreateTransactionDialog";
import { TransactionTable } from "@/components/TransactionTable";
import { TrendingUp, TrendingDown, Landmark, Wallet, CalendarDays, FileDown, Printer, Mail, Upload, Trash2, AlertTriangle, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogScrollArea } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { generateDashboardPDF, printTable, openEmailDashboard, openEmailDueAccounts } from "@/lib/pdf-generator";
import { useToast } from "@/hooks/use-toast";
import { CATEGORY_OPTIONS, getCategoryLabel } from "@shared/schema";
import { parseMoneyString, parseLooseDate, normalizeCsvType } from "@shared/csv-utils";

// Detecta o delimitador pelo cabecalho (extratos BR normalmente usam ";"
// porque "," e o separador decimal) e faz o split respeitando campos entre
// aspas, em vez de partir tudo por [;,] junto - que quebrava valores com
// virgula decimal em arquivos ja delimitados por ";".
function detectDelimiter(headerLine: string): string {
  return headerLine.includes(";") ? ";" : ",";
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

interface CSVPreviewRow {
  description: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  category: string;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function Dashboard() {
  const { data: transactions, isLoading: txLoading, isError: txError, refetch: refetchTx } = useTransactions();
  const { data: settingsData, isLoading: settingsLoading, isError: settingsError } = useSettings();
  const { canManage, isOperador } = useAuth();
  const importCSV = useImportCSV();
  const { toast } = useToast();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<CSVPreviewRow[] | null>(null);
  const [csvPreviewOpen, setCsvPreviewOpen] = useState(false);

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
    const parsedTaxRate = settingsData ? parseFloat(settingsData.taxRate) : NaN;
    const taxRate = Number.isFinite(parsedTaxRate) ? parsedTaxRate : 0;
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
    // So contabiliza o que ja foi pago/recebido (igual a DRE) - transacoes
    // pendentes nao sao receita/despesa realizada ainda.
    for (const t of filtered) {
      if (t.status !== "pago") continue;
      const amount = Number.isFinite(t.amount) ? t.amount : 0;
      if (t.type === "income") totalIncome += amount;
      else totalExpenses += amount;
    }
    const taxAmount = Math.round(totalIncome * (taxRate / 100));
    const netProfit = totalIncome - totalExpenses - taxAmount;
    return { totalIncome, totalExpenses, taxAmount, netProfit, currentTaxRate: taxRate };
  }, [transactions, settingsData, monthFilter]);

  const alertSummary = useMemo(() => {
    if (!transactions) return { overdueTotal: 0, overdueCount: 0, dueSoonTotal: 0, dueSoonCount: 0 };
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    let overdueTotal = 0, overdueCount = 0, dueSoonTotal = 0, dueSoonCount = 0;
    for (const tx of transactions) {
      if (tx.status !== "pendente" || !tx.dueDate) continue;
      const due = new Date(tx.dueDate);
      due.setHours(0, 0, 0, 0);
      if (due < now) {
        overdueTotal += tx.amount;
        overdueCount++;
      } else if (due <= sevenDaysLater) {
        dueSoonTotal += tx.amount;
        dueSoonCount++;
      }
    }
    return { overdueTotal, overdueCount, dueSoonTotal, dueSoonCount };
  }, [transactions]);

  function handleEmailDueAccounts() {
    if (!transactions) return;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const overdue = transactions.filter((tx) => {
      if (tx.status !== "pendente" || !tx.dueDate) return false;
      const due = new Date(tx.dueDate);
      due.setHours(0, 0, 0, 0);
      return due < now;
    });

    const dueSoon = transactions.filter((tx) => {
      if (tx.status !== "pendente" || !tx.dueDate) return false;
      const due = new Date(tx.dueDate);
      due.setHours(0, 0, 0, 0);
      return due >= now && due <= sevenDaysLater;
    });

    openEmailDueAccounts(dueSoon, overdue);
  }

  const isLoading = txLoading || settingsLoading;
  // Enquanto os dados nao carregam de verdade, os cards mostram o skeleton
  // em vez de um "R$ 0,00" que pareceria um valor real (mesmo tratamento
  // dado a loading, ja que os dois casos nao tem numero confiavel ainda).
  const statsUnavailable = isLoading || txError || settingsError;

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

  function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split("\n").filter((l) => l.trim());
        if (lines.length < 2) {
          toast({ title: "Arquivo vazio", description: "O arquivo CSV nao contem dados.", variant: "destructive" });
          return;
        }
        const delimiter = detectDelimiter(lines[0]);
        const headers = splitCsvLine(lines[0], delimiter).map((h) => h.toLowerCase().replace(/"/g, ""));
        const parsedRows: CSVPreviewRow[] = [];
        let skippedCount = 0;
        for (let i = 1; i < lines.length; i++) {
          const values = splitCsvLine(lines[i], delimiter).map((v) => v.replace(/"/g, ""));
          if (values.length < 2) { skippedCount++; continue; }
          const row: any = {};
          headers.forEach((h, idx) => { row[h] = values[idx] || ""; });

          const description = String(row.description || row.descricao || row.historico || "Importacao CSV").trim();
          const rawAmount = row.amount || row.valor || row.value || "0";
          const amount = Math.abs(Math.round(parseMoneyString(rawAmount) * 100));
          if (amount === 0) { skippedCount++; continue; }

          let type: "income" | "expense" = normalizeCsvType(row.type, row.tipo) ?? "expense";
          if (!row.type && !row.tipo && parseMoneyString(rawAmount) > 0) {
            // Sem coluna de tipo: usa o sinal do valor (extratos com
            // valores negativos para saida sao comuns).
            type = "income";
          }

          const parsedDate = parseLooseDate(row.date || row.data);
          const dateStr = format(parsedDate ?? new Date(), "yyyy-MM-dd");

          const category = row.category || row.categoria || "outros";

          parsedRows.push({ description, amount, type, date: dateStr, category });
        }
        if (skippedCount > 0) {
          toast({
            title: "Algumas linhas foram ignoradas",
            description: `${skippedCount} linha(s) sem valor valido nao foram importadas.`,
          });
        }

        if (parsedRows.length === 0) {
          toast({ title: "Sem dados", description: "Nenhuma transacao valida encontrada no arquivo.", variant: "destructive" });
          return;
        }

        setCsvPreview(parsedRows);
        setCsvPreviewOpen(true);
      } catch {
        toast({ title: "Erro", description: "Nao foi possivel ler o arquivo CSV.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleConfirmCSVImport() {
    if (!csvPreview || csvPreview.length === 0) return;
    const rows = csvPreview.map((r) => ({
      description: r.description,
      amount_cents: r.amount,
      type: r.type,
      date: r.date,
      category: r.category !== "none" ? r.category : undefined,
    }));
    importCSV.mutate(rows, {
      onSuccess: () => {
        setCsvPreviewOpen(false);
        setCsvPreview(null);
      },
    });
  }

  function removeCSVRow(index: number) {
    if (!csvPreview) return;
    const updated = csvPreview.filter((_, i) => i !== index);
    if (updated.length === 0) {
      setCsvPreviewOpen(false);
      setCsvPreview(null);
    } else {
      setCsvPreview(updated);
    }
  }

  function updateCSVRowCategory(index: number, category: string) {
    if (!csvPreview) return;
    const updated = [...csvPreview];
    updated[index] = { ...updated[index], category };
    setCsvPreview(updated);
  }

  function updateCSVRowType(index: number, type: "income" | "expense") {
    if (!csvPreview) return;
    const updated = [...csvPreview];
    updated[index] = { ...updated[index], type };
    setCsvPreview(updated);
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
          {canManage && (
            <>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVImport}
                className="hidden"
                data-testid="input-csv-import"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => csvInputRef.current?.click()}
                disabled={importCSV.isPending}
                data-testid="button-import-csv"
                title="Importar Extrato CSV"
              >
                <Upload className="h-4 w-4" />
              </Button>
            </>
          )}
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
          <Button
            variant="outline"
            size="icon"
            onClick={() => openEmailDashboard(summary, filteredTransactions, filterLabel)}
            disabled={isLoading || !transactions?.length}
            data-testid="button-email-dashboard"
            title="Enviar por E-mail"
          >
            <Mail className="h-4 w-4" />
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
          isLoading={statsUnavailable}
        />
        <StatsCard
          title="Despesas Totais"
          value={summary.totalExpenses / 100}
          icon={TrendingDown}
          colorClass="text-rose-500"
          trend={filterLabel}
          trendColor="neutral"
          isLoading={statsUnavailable}
        />
        <StatsCard
          title="Impostos"
          value={summary.taxAmount / 100}
          icon={Landmark}
          colorClass="text-amber-500"
          trend={`Aliquota: ${summary.currentTaxRate}%`}
          trendColor="neutral"
          isLoading={statsUnavailable}
        />
        <StatsCard
          title="Lucro Liquido"
          value={summary.netProfit / 100}
          icon={Wallet}
          colorClass="text-blue-600"
          trend={filterLabel}
          trendColor="neutral"
          isLoading={statsUnavailable}
        />
      </div>

      {(alertSummary.overdueCount > 0 || alertSummary.dueSoonCount > 0) && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {alertSummary.overdueCount > 0 && (
              <Card className="p-4 border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-500/5" data-testid="card-overdue-alert">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-500/20">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">Total Vencido</p>
                    <p className="text-lg font-bold text-red-800 dark:text-red-300 font-mono" data-testid="text-overdue-total">
                      {formatCurrency(alertSummary.overdueTotal / 100)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 shrink-0">
                    {alertSummary.overdueCount} {alertSummary.overdueCount === 1 ? "conta" : "contas"}
                  </Badge>
                </div>
              </Card>
            )}
            {alertSummary.dueSoonCount > 0 && (
              <Card className="p-4 border-l-4 border-l-orange-500 bg-orange-50/50 dark:bg-orange-500/5" data-testid="card-due-soon-alert">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-500/20">
                    <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-400">A Vencer (7 dias)</p>
                    <p className="text-lg font-bold text-orange-800 dark:text-orange-300 font-mono" data-testid="text-due-soon-total">
                      {formatCurrency(alertSummary.dueSoonTotal / 100)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 shrink-0">
                    {alertSummary.dueSoonCount} {alertSummary.dueSoonCount === 1 ? "conta" : "contas"}
                  </Badge>
                </div>
              </Card>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEmailDueAccounts}
              data-testid="button-email-due-accounts"
              title="Enviar alerta de contas por e-mail"
            >
              <Mail className="h-4 w-4 mr-2" />
              Enviar Alerta por E-mail
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Transacoes {monthFilter ? `- ${monthFilter.month !== null ? MONTH_NAMES[monthFilter.month] + " " : ""}${monthFilter.year}` : "Recentes"}</h3>
          <p className="text-muted-foreground text-sm mt-1">Gerencie suas entradas e saidas.</p>
        </div>
        <TransactionTable monthFilter={monthFilter} />
      </div>

      <Dialog open={csvPreviewOpen} onOpenChange={(open) => { if (!open) { setCsvPreviewOpen(false); setCsvPreview(null); } }}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Revisar Importacao CSV</DialogTitle>
            <DialogDescription>
              {csvPreview?.length || 0} transacao(es) encontrada(s). Revise, altere categorias/tipo e confirme.
            </DialogDescription>
          </DialogHeader>
          <DialogScrollArea className="max-h-[55dvh]">
            {csvPreview && csvPreview.length > 0 && (
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descricao</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvPreview.map((row, idx) => (
                      <TableRow key={idx} data-testid={`csv-preview-row-${idx}`}>
                        <TableCell className="text-sm max-w-[160px] truncate">{row.description}</TableCell>
                        <TableCell className="font-mono text-xs">{row.date}</TableCell>
                        <TableCell>
                          <Select value={row.type} onValueChange={(v) => updateCSVRowType(idx, v as "income" | "expense")}>
                            <SelectTrigger className="w-[100px]" data-testid={`csv-select-type-${idx}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="income">Entrada</SelectItem>
                              <SelectItem value="expense">Saida</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={row.category} onValueChange={(v) => updateCSVRowCategory(idx, v)}>
                            <SelectTrigger className="w-[120px]" data-testid={`csv-select-category-${idx}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma</SelectItem>
                              {CATEGORY_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className={`text-right font-mono font-medium ${row.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                          {row.type === "income" ? "+" : "-"}{formatCurrency(row.amount / 100)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeCSVRow(idx)} data-testid={`csv-remove-row-${idx}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {csvPreview && csvPreview.length > 0 && (
              <div className="sm:hidden space-y-3">
                {csvPreview.map((row, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-2" data-testid={`csv-preview-card-${idx}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{row.description}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeCSVRow(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{row.date}</span>
                      <span className={`font-mono font-medium text-sm ${row.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                        {row.type === "income" ? "+" : "-"}{formatCurrency(row.amount / 100)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={row.type} onValueChange={(v) => updateCSVRowType(idx, v as "income" | "expense")}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Entrada</SelectItem>
                          <SelectItem value="expense">Saida</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={row.category} onValueChange={(v) => updateCSVRowCategory(idx, v)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {CATEGORY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCsvPreviewOpen(false); setCsvPreview(null); }} data-testid="button-cancel-csv-import">
              Cancelar
            </Button>
            <Button onClick={handleConfirmCSVImport} disabled={importCSV.isPending} data-testid="button-confirm-csv-import">
              {importCSV.isPending ? "Importando..." : `Importar ${csvPreview?.length || 0} Transacao(es)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
