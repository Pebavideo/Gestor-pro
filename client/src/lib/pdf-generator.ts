import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatCurrencyPDF = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  taxAmount: number;
  netProfit: number;
  currentTaxRate: number;
}

interface TransactionData {
  description: string;
  date: string | Date;
  type: string;
  amount: number;
}

interface EmployeeData {
  name: string;
  position: string;
  salary: number;
  salaryType: string;
  createdAt: string | Date;
}

export function generateDashboardPDF(
  summary: FinancialSummary,
  transactions: TransactionData[],
  filterLabel: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date();

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Gestor de Empresas Pro", 14, 20);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Relatorio Financeiro", 14, 28);

  doc.setFontSize(9);
  doc.text(`Periodo: ${filterLabel}`, 14, 35);
  doc.text(`Gerado em: ${format(now, "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 41);

  doc.setDrawColor(200);
  doc.line(14, 45, pageWidth - 14, 45);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Resumo Financeiro", 14, 54);

  const summaryData = [
    ["Faturamento Bruto", formatCurrencyPDF(summary.totalIncome / 100)],
    ["Despesas Totais", formatCurrencyPDF(summary.totalExpenses / 100)],
    [`Impostos (${summary.currentTaxRate}%)`, formatCurrencyPDF(summary.taxAmount / 100)],
    ["Lucro Liquido", formatCurrencyPDF(summary.netProfit / 100)],
  ];

  autoTable(doc, {
    startY: 58,
    head: [["Indicador", "Valor"]],
    body: summaryData,
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 14, right: 14 },
  });

  const afterSummaryY = (doc as any).lastAutoTable.finalY + 12;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Transacoes", 14, afterSummaryY);

  const txRows = transactions.map((tx) => [
    tx.description,
    format(new Date(tx.date), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    tx.type === "income" ? "Entrada" : "Saida",
    `${tx.type === "income" ? "+" : "-"}${formatCurrencyPDF(tx.amount / 100)}`,
  ]);

  autoTable(doc, {
    startY: afterSummaryY + 4,
    head: [["Descricao", "Data", "Tipo", "Valor"]],
    body: txRows,
    theme: "striped",
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 65 },
      3: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 2) {
        if (data.cell.raw === "Entrada") {
          data.cell.styles.textColor = [39, 174, 96];
        } else {
          data.cell.styles.textColor = [231, 76, 60];
        }
      }
      if (data.section === "body" && data.column.index === 3) {
        const raw = String(data.cell.raw);
        if (raw.startsWith("+")) {
          data.cell.styles.textColor = [39, 174, 96];
        } else {
          data.cell.styles.textColor = [231, 76, 60];
        }
      }
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Pagina ${i} de ${pageCount} - Gestor de Empresas Pro`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  doc.save(`relatorio-financeiro-${format(now, "yyyy-MM-dd")}.pdf`);
}

export function generateTeamPDF(employees: EmployeeData[], totalPayroll: number) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date();

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Gestor de Empresas Pro", 14, 20);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Relatorio de Equipe", 14, 28);

  doc.setFontSize(9);
  doc.text(`Gerado em: ${format(now, "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 35);

  doc.setDrawColor(200);
  doc.line(14, 39, pageWidth - 14, 39);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Resumo da Equipe", 14, 48);

  const avgSalary = employees.length > 0 ? totalPayroll / employees.length / 100 : 0;
  const summaryData = [
    ["Total de Funcionarios", String(employees.length)],
    ["Folha Mensal", formatCurrencyPDF(totalPayroll / 100)],
    ["Salario Medio", formatCurrencyPDF(avgSalary)],
  ];

  autoTable(doc, {
    startY: 52,
    head: [["Indicador", "Valor"]],
    body: summaryData,
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 14, right: 14 },
  });

  const afterSummaryY = (doc as any).lastAutoTable.finalY + 12;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Lista de Funcionarios", 14, afterSummaryY);

  const empRows = employees.map((emp, idx) => [
    String(idx + 1),
    emp.name,
    emp.position,
    format(new Date(emp.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    emp.salaryType === "daily" ? "Diaria" : "Mensal",
    formatCurrencyPDF(emp.salary / 100),
  ]);

  autoTable(doc, {
    startY: afterSummaryY + 4,
    head: [["#", "Nome", "Cargo", "Data de Admissao", "Tipo", "Salario"]],
    body: empRows,
    theme: "striped",
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      5: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Pagina ${i} de ${pageCount} - Gestor de Empresas Pro`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  doc.save(`relatorio-equipe-${format(now, "yyyy-MM-dd")}.pdf`);
}

export function generateWhatsAppMessage(
  type: "transaction" | "payment",
  data: {
    description: string;
    amount: number;
    date?: string | Date;
    employeeName?: string;
    txType?: string;
  }
): string {
  const amountFormatted = formatCurrencyPDF(data.amount / 100);
  const dateFormatted = data.date
    ? format(new Date(data.date), "dd/MM/yyyy HH:mm", { locale: ptBR })
    : format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });

  if (type === "transaction") {
    const label = data.txType === "income" ? "Receita" : "Despesa";
    return encodeURIComponent(
      `*Gestor de Empresas Pro*\n` +
      `--------------------\n` +
      `*Comprovante de ${label}*\n\n` +
      `Descricao: ${data.description}\n` +
      `Valor: ${amountFormatted}\n` +
      `Tipo: ${label}\n` +
      `Data: ${dateFormatted}\n` +
      `--------------------\n` +
      `_Documento gerado automaticamente_`
    );
  }

  return encodeURIComponent(
    `*Gestor de Empresas Pro*\n` +
    `--------------------\n` +
    `*Comprovante de Pagamento*\n\n` +
    `Funcionario: ${data.employeeName || data.description}\n` +
    `Valor: ${amountFormatted}\n` +
    `Data: ${dateFormatted}\n` +
    `--------------------\n` +
    `_Documento gerado automaticamente_`
  );
}

export function openWhatsApp(message: string) {
  window.open(`https://wa.me/?text=${message}`, "_blank");
}

export function openEmailDashboard(
  summary: FinancialSummary,
  transactions: TransactionData[],
  filterLabel: string
) {
  const subject = `Relatorio Financeiro - ${filterLabel} - Gestor de Empresas Pro`;
  const lines = [
    "GESTOR DE EMPRESAS PRO",
    `Relatorio Financeiro - ${filterLabel}`,
    `Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    "",
    "=== RESUMO FINANCEIRO ===",
    `Faturamento Bruto: ${formatCurrencyPDF(summary.totalIncome / 100)}`,
    `Despesas Totais: ${formatCurrencyPDF(summary.totalExpenses / 100)}`,
    `Impostos (${summary.currentTaxRate}%): ${formatCurrencyPDF(summary.taxAmount / 100)}`,
    `Lucro Liquido: ${formatCurrencyPDF(summary.netProfit / 100)}`,
    "",
    `=== TRANSACOES (${transactions.length}) ===`,
  ];
  for (const tx of transactions) {
    const d = format(new Date(tx.date), "dd/MM/yyyy HH:mm", { locale: ptBR });
    const tipo = tx.type === "income" ? "Entrada" : "Saida";
    const sinal = tx.type === "income" ? "+" : "-";
    lines.push(`${d} | ${tipo} | ${tx.description} | ${sinal}${formatCurrencyPDF(tx.amount / 100)}`);
  }
  lines.push("", "---", "Gestor de Empresas Pro - Documento gerado automaticamente");
  const body = lines.join("\n");
  window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_self");
}

export function openEmailTeam(employees: EmployeeData[], totalPayroll: number) {
  const subject = "Relatorio de Equipe - Gestor de Empresas Pro";
  const lines = [
    "GESTOR DE EMPRESAS PRO",
    "Relatorio de Equipe",
    `Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    "",
    "=== RESUMO ===",
    `Total de Funcionarios: ${employees.length}`,
    `Folha Mensal: ${formatCurrencyPDF(totalPayroll / 100)}`,
    "",
    "=== LISTA DE FUNCIONARIOS ===",
  ];
  employees.forEach((emp, idx) => {
    const d = format(new Date(emp.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR });
    const typeLabel = emp.salaryType === "daily" ? "Diaria" : "Mensal";
    lines.push(`${idx + 1}. ${emp.name} | ${emp.position} | ${typeLabel} | Admissao: ${d} | Salario: ${formatCurrencyPDF(emp.salary / 100)}`);
  });
  lines.push("", "---", "Gestor de Empresas Pro - Documento gerado automaticamente");
  const body = lines.join("\n");
  window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_self");
}

interface DRELineData {
  label: string;
  value: number;
  level: number;
  isBold?: boolean;
  isTotal?: boolean;
  color?: string;
}

interface DREComputedData {
  receitaBruta: number;
  impostos: number;
  receitaLiquida: number;
  cpv: number;
  lucroBruto: number;
  despesasSalarios: number;
  despesasOutras: number;
  totalDespesasOp: number;
  lucroLiquido: number;
  taxRate: number;
}

export function generateDREPDF(
  dreLines: DRELineData[],
  filterLabel: string,
  dreData: DREComputedData
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date();

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Gestor de Empresas Pro", 14, 20);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("DRE - Demonstrativo de Resultados", 14, 28);

  doc.setFontSize(9);
  doc.text(`Periodo: ${filterLabel}`, 14, 35);
  doc.text(`Gerado em: ${format(now, "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 41);

  doc.setDrawColor(200);
  doc.line(14, 45, pageWidth - 14, 45);

  const rows = dreLines.map((line) => {
    const indent = line.level === 2 ? "      " : line.level === 1 ? "   " : "";
    const val = formatCurrencyPDF(Math.abs(line.value) / 100);
    return [indent + line.label, line.value < 0 ? `(${val})` : val];
  });

  autoTable(doc, {
    startY: 50,
    head: [["Descricao", "Valor (R$)"]],
    body: rows,
    theme: "plain",
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 14, right: 14 },
    didParseCell: (data: any) => {
      if (data.section === "body") {
        const line = dreLines[data.row.index];
        if (!line) return;
        if (line.isBold) data.cell.styles.fontStyle = "bold";
        if (line.isTotal) {
          data.cell.styles.fontSize = 11;
          if (line.color === "positive") {
            data.cell.styles.textColor = [39, 174, 96];
          } else if (line.color === "negative") {
            data.cell.styles.textColor = [231, 76, 60];
          }
        } else if (line.color === "negative" && data.column.index === 1) {
          data.cell.styles.textColor = [231, 76, 60];
        } else if (line.color === "positive" && data.column.index === 1) {
          data.cell.styles.textColor = [39, 174, 96];
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const resultLabel = dreData.lucroLiquido >= 0 ? "RESULTADO: LUCRO" : "RESULTADO: PREJUIZO";
  const resultColor: [number, number, number] = dreData.lucroLiquido >= 0 ? [39, 174, 96] : [231, 76, 60];

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...resultColor);
  doc.text(resultLabel, 14, finalY);
  doc.text(formatCurrencyPDF(Math.abs(dreData.lucroLiquido) / 100), pageWidth - 14, finalY, { align: "right" });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Pagina ${i} de ${pageCount} - Gestor de Empresas Pro`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  doc.save(`dre-${format(now, "yyyy-MM-dd")}.pdf`);
}

export function openEmailDRE(
  dreLines: DRELineData[],
  filterLabel: string,
  dreData: DREComputedData
) {
  const subject = `DRE - ${filterLabel} - Gestor de Empresas Pro`;
  const lines = [
    "GESTOR DE EMPRESAS PRO",
    `DRE - Demonstrativo de Resultados`,
    `Periodo: ${filterLabel}`,
    `Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    "",
    "=== DEMONSTRATIVO ===",
  ];
  for (const dl of dreLines) {
    const indent = dl.level === 2 ? "      " : dl.level === 1 ? "   " : "";
    const val = formatCurrencyPDF(Math.abs(dl.value) / 100);
    const sign = dl.value < 0 ? `(${val})` : val;
    lines.push(`${indent}${dl.label}: ${sign}`);
  }
  lines.push("");
  const resultLabel = dreData.lucroLiquido >= 0 ? "RESULTADO: LUCRO" : "RESULTADO: PREJUIZO";
  lines.push(`${resultLabel}: ${formatCurrencyPDF(Math.abs(dreData.lucroLiquido) / 100)}`);
  lines.push("", "---", "Gestor de Empresas Pro - Documento gerado automaticamente");
  const body = lines.join("\n");
  window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_self");
}

export function printTable(title: string, elementId: string) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - Gestor de Empresas Pro</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; padding: 20px; color: #333; }
        .print-header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #2980b9; padding-bottom: 16px; }
        .print-header h1 { font-size: 22px; color: #2980b9; margin-bottom: 4px; }
        .print-header h2 { font-size: 16px; color: #555; font-weight: normal; }
        .print-header .date { font-size: 11px; color: #888; margin-top: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        thead th { background: #2980b9; color: white; text-align: left; padding: 10px 12px; font-size: 12px; }
        thead th:last-child { text-align: right; }
        tbody td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
        tbody td:last-child { text-align: right; }
        tbody tr:nth-child(even) { background: #f8f9fa; }
        .income { color: #27ae60; font-weight: 600; }
        .expense { color: #e74c3c; font-weight: 600; }
        .footer { text-align: center; margin-top: 24px; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
        @media print { body { padding: 10px; } }
      </style>
    </head>
    <body>
      <div class="print-header">
        <h1>Gestor de Empresas Pro</h1>
        <h2>${title}</h2>
        <p class="date">Impresso em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
      </div>
      ${element.innerHTML}
      <div class="footer">Gestor de Empresas Pro - Documento para impressao</div>
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 300);
}
