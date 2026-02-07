
import { pgTable, text, serial, integer, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(), // Stored in cents (e.g., 1000 = R$ 10,00)
  type: text("type").notNull(), // 'income' (entrada) or 'expense' (saida)
  date: timestamp("date").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  taxRate: numeric("tax_rate").notNull().default("15"), // Percentage (e.g. 15)
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  description: true,
  amount: true,
  type: true,
  date: true,
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
