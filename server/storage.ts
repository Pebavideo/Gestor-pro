import { db } from "./db";
import { 
  transactions, settings, users,
  type Transaction, type InsertTransaction, 
  type Settings, type InsertSettings
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import type { User } from "@shared/models/auth";

export interface IStorage {
  getTransactions(userId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction, userId: string): Promise<Transaction>;
  deleteTransaction(id: number, userId: string): Promise<boolean>;
  getTransaction(id: number): Promise<Transaction | undefined>;
  
  getSettings(userId: string): Promise<Settings>;
  updateSettings(settings: InsertSettings, userId: string): Promise<Settings>;

  getUserRole(userId: string): Promise<string>;
  setUserRole(userId: string, role: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getTransactions(userId: string): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));
  }

  async createTransaction(insertTransaction: InsertTransaction, userId: string): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values({ ...insertTransaction, userId })
      .returning();
    return transaction;
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    return tx;
  }

  async deleteTransaction(id: number, userId: string): Promise<boolean> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!tx) return false;
    if (tx.userId !== userId) return false;
    await db.delete(transactions).where(eq(transactions.id, id));
    return true;
  }

  async getSettings(userId: string): Promise<Settings> {
    const [existing] = await db.select().from(settings)
      .where(eq(settings.userId, userId))
      .limit(1);
    if (existing) return existing;
    
    const [created] = await db
      .insert(settings)
      .values({ taxRate: "15", userId })
      .returning();
    return created;
  }

  async updateSettings(newSettings: InsertSettings, userId: string): Promise<Settings> {
    const current = await this.getSettings(userId);
    const [updated] = await db
      .update(settings)
      .set(newSettings)
      .where(eq(settings.id, current.id))
      .returning();
    return updated;
  }

  async getUserRole(userId: string): Promise<string> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user?.role || "operator";
  }

  async setUserRole(userId: string, role: string): Promise<void> {
    await db.update(users).set({ role }).where(eq(users.id, userId));
  }
}

export const storage = new DatabaseStorage();
