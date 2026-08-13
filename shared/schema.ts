import { z } from "zod";

export * from "./models/auth";

export const CATEGORY_OPTIONS = [
  { value: "alimentacao", label: "Alimentacao" },
  { value: "impostos", label: "Impostos" },
  { value: "salarios", label: "Salarios" },
  { value: "vendas", label: "Vendas" },
  { value: "servicos", label: "Servicos" },
  { value: "investimentos", label: "Investimentos" },
  { value: "transporte", label: "Transporte" },
  { value: "aluguel", label: "Aluguel" },
  { value: "materiais", label: "Materiais" },
  { value: "manutencao", label: "Manutencao" },
  { value: "marketing", label: "Marketing" },
  { value: "outros", label: "Outros" },
] as const;

export function getCategoryLabel(value: string | null | undefined): string {
  if (!value) return "";
  const found = CATEGORY_OPTIONS.find((o) => o.value === value);
  return found ? found.label : value;
}

export const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago/Recebido" },
] as const;

export function getStatusLabel(value: string | null | undefined): string {
  if (!value) return "Pago/Recebido";
  const found = STATUS_OPTIONS.find((o) => o.value === value);
  return found ? found.label : value;
}

export const RECURRENCE_OPTIONS = [
  { value: "mensal", label: "Mensal" },
  { value: "quinzenal", label: "Quinzenal" },
] as const;

export const STORE_OPTIONS = [
  { value: "fazenda", label: "Fazenda" },
  { value: "loja_manel", label: "Loja do Manel" },
  { value: "loja_maria", label: "Loja da Maria" },
  { value: "mercado_ze", label: "Mercado do Ze" },
] as const;

export function getStoreLabel(value: string | null | undefined): string {
  if (!value) return "";
  const found = STORE_OPTIONS.find((o) => o.value === value);
  return found ? found.label : value;
}

// ---------------------------------------------------------------------------
// Entidades Firestore. Cada documento vive em sua propria colecao; "id" e o
// id do documento no Firestore (string), nao mais um serial numerico do
// Postgres. Campos booleanos continuam representados como numero 0/1, como
// no schema original, para nao alterar nenhuma comparacao existente no client.
// ---------------------------------------------------------------------------

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  category: string | null;
  store: string | null;
  status: string;
  dueDate: Date | null;
  paymentDate: Date | null;
  isRecurring: number;
  recurrenceFrequency: string | null;
  recurrenceCount: number | null;
  recurrenceGroupId: string | null;
  userId: string;
  date: Date;
  reconciled: number;
}

export const insertTransactionSchema = z.object({
  description: z.string(),
  amount: z.number(),
  type: z.string(),
  category: z.string().nullable().optional(),
  store: z.string().nullable().optional(),
  status: z.string().default("pago"),
  dueDate: z.coerce.date().nullable().optional(),
  paymentDate: z.coerce.date().nullable().optional(),
  isRecurring: z.number().default(0),
  recurrenceFrequency: z.string().nullable().optional(),
  recurrenceCount: z.number().nullable().optional(),
  recurrenceGroupId: z.string().nullable().optional(),
  date: z.coerce.date().optional(),
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export interface Settings {
  id: string;
  userId: string;
  taxRate: string;
}

export const insertSettingsSchema = z.object({
  taxRate: z.union([z.string(), z.number()]).transform((v) => String(v)),
});
export type InsertSettings = z.infer<typeof insertSettingsSchema>;

export interface Employee {
  id: string;
  name: string;
  position: string;
  salary: number;
  salaryType: string;
  store: string;
  userId: string;
  active: number;
  createdAt: Date;
}

export const insertEmployeeSchema = z.object({
  name: z.string(),
  position: z.string(),
  salary: z.number(),
  salaryType: z.string().default("monthly"),
  store: z.string().default("fazenda"),
  createdAt: z.coerce.date().optional(),
});
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export interface Product {
  id: string;
  name: string;
  specification: string | null;
  unit: string;
  store: string | null;
  quantity: number;
  price: number;
  userId: string;
  active: number;
  createdAt: Date;
}

export const insertProductSchema = z.object({
  name: z.string(),
  specification: z.string().nullable().optional(),
  unit: z.string().default("UN"),
  store: z.string().nullable().optional(),
  quantity: z.number().default(0),
  price: z.number(),
  createdAt: z.coerce.date().optional(),
});
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type FinancialSummary = {
  totalIncome: number;
  totalExpenses: number;
  taxAmount: number;
  netProfit: number;
  currentTaxRate: number;
};
