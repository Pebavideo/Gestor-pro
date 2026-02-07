import { pgTable, text, serial, integer, timestamp, numeric, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  userId: varchar("user_id").notNull(),
  date: timestamp("date").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  taxRate: numeric("tax_rate").notNull().default("15"),
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  description: true,
  amount: true,
  type: true,
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
