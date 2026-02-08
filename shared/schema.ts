import { pgTable, text, serial, integer, timestamp, numeric, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
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

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  category: text("category"),
  store: text("store"),
  userId: varchar("user_id").notNull(),
  date: timestamp("date").defaultNow().notNull(),
  reconciled: integer("reconciled").notNull().default(0),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  taxRate: numeric("tax_rate").notNull().default("15"),
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: text("position").notNull(),
  salary: integer("salary").notNull(),
  salaryType: text("salary_type").notNull().default("monthly"),
  userId: varchar("user_id").notNull(),
  active: integer("active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  specification: text("specification"),
  unit: text("unit").notNull().default("UN"),
  store: text("store"),
  quantity: integer("quantity").notNull().default(0),
  price: integer("price").notNull(),
  userId: varchar("user_id").notNull(),
  active: integer("active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmployeeSchema = createInsertSchema(employees).pick({
  name: true,
  position: true,
  salary: true,
  salaryType: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).pick({
  name: true,
  specification: true,
  unit: true,
  store: true,
  quantity: true,
  price: true,
  createdAt: true,
});

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  description: true,
  amount: true,
  type: true,
  category: true,
  store: true,
});

export const insertSettingsSchema = createInsertSchema(settings).pick({
  taxRate: true,
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;

export type FinancialSummary = {
  totalIncome: number;
  totalExpenses: number;
  taxAmount: number;
  netProfit: number;
  currentTaxRate: number;
};
