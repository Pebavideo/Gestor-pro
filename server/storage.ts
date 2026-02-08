import { db } from "./db";
import { 
  transactions, settings, users, employees,
  type Transaction, type InsertTransaction, 
  type Settings, type InsertSettings,
  type Employee, type InsertEmployee
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

  getEmployees(userId: string): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee, userId: string): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>, userId: string): Promise<Employee | null>;
  deleteEmployee(id: number, userId: string): Promise<boolean>;
  processPayroll(userId: string): Promise<Transaction[]>;
  processPayrollForEmployee(employeeId: number, userId: string): Promise<Transaction | null>;
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

  async getEmployees(userId: string): Promise<Employee[]> {
    return await db.select().from(employees)
      .where(and(eq(employees.userId, userId), eq(employees.active, 1)))
      .orderBy(desc(employees.createdAt));
  }

  async createEmployee(employee: InsertEmployee, userId: string): Promise<Employee> {
    const [created] = await db
      .insert(employees)
      .values({ ...employee, userId })
      .returning();
    return created;
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>, userId: string): Promise<Employee | null> {
    const [existing] = await db.select().from(employees)
      .where(and(eq(employees.id, id), eq(employees.userId, userId)));
    if (!existing) return null;
    const [updated] = await db
      .update(employees)
      .set(employee)
      .where(eq(employees.id, id))
      .returning();
    return updated;
  }

  async deleteEmployee(id: number, userId: string): Promise<boolean> {
    const [existing] = await db.select().from(employees)
      .where(and(eq(employees.id, id), eq(employees.userId, userId)));
    if (!existing) return false;
    await db.update(employees).set({ active: 0 }).where(eq(employees.id, id));
    return true;
  }

  async processPayroll(userId: string): Promise<Transaction[]> {
    const activeEmployees = await this.getEmployees(userId);
    const created: Transaction[] = [];
    for (const emp of activeEmployees) {
      const [tx] = await db
        .insert(transactions)
        .values({
          description: `Salario - ${emp.name}`,
          amount: emp.salary,
          type: "expense",
          userId,
        })
        .returning();
      created.push(tx);
    }
    return created;
  }

  async processPayrollForEmployee(employeeId: number, userId: string): Promise<Transaction | null> {
    const [emp] = await db.select().from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.userId, userId), eq(employees.active, 1)));
    if (!emp) return null;
    const [tx] = await db
      .insert(transactions)
      .values({
        description: `Salario - ${emp.name}`,
        amount: emp.salary,
        type: "expense",
        userId,
      })
      .returning();
    return tx;
  }
}

export const storage = new DatabaseStorage();
