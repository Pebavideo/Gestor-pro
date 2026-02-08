import { db } from "./db";
import { 
  transactions, settings, users, employees, products,
  type Transaction, type InsertTransaction, 
  type Settings, type InsertSettings,
  type Employee, type InsertEmployee,
  type Product, type InsertProduct
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import type { User } from "@shared/models/auth";
import { randomUUID } from "crypto";

export interface IStorage {
  getTransactions(userId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction, userId: string): Promise<Transaction>;
  createTransactionWithRecurrence(transaction: InsertTransaction, userId: string): Promise<Transaction[]>;
  updateTransaction(id: number, data: Partial<InsertTransaction>, userId: string): Promise<Transaction | null>;
  deleteTransaction(id: number, userId: string): Promise<boolean>;
  getTransaction(id: number): Promise<Transaction | undefined>;
  
  toggleReconciled(id: number, userId: string): Promise<Transaction | null>;
  markAsPaid(id: number, userId: string, paymentDate?: Date): Promise<Transaction | null>;

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

  getProducts(userId: string): Promise<Product[]>;
  createProduct(product: InsertProduct, userId: string): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>, userId: string): Promise<Product | null>;
  deleteProduct(id: number, userId: string): Promise<boolean>;
  decrementProductStock(id: number, quantity: number, userId: string): Promise<Product | null>;
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

  async createTransactionWithRecurrence(insertTransaction: InsertTransaction, userId: string): Promise<Transaction[]> {
    const isRecurring = insertTransaction.isRecurring === 1;
    const frequency = insertTransaction.recurrenceFrequency;
    const count = insertTransaction.recurrenceCount || 1;

    if (!isRecurring || !frequency || count <= 1) {
      const tx = await this.createTransaction(insertTransaction, userId);
      return [tx];
    }

    const groupId = randomUUID();
    const created: Transaction[] = [];

    const baseDueDate = insertTransaction.dueDate ? new Date(insertTransaction.dueDate) : new Date();

    for (let i = 0; i < count; i++) {
      const dueDate = new Date(baseDueDate);
      if (frequency === "mensal") {
        dueDate.setMonth(dueDate.getMonth() + i);
      } else if (frequency === "quinzenal") {
        dueDate.setDate(dueDate.getDate() + (i * 15));
      }

      const txDate = i === 0 ? (insertTransaction.date || new Date()) : dueDate;

      const [tx] = await db
        .insert(transactions)
        .values({
          ...insertTransaction,
          userId,
          dueDate,
          date: txDate,
          status: i === 0 ? (insertTransaction.status || "pendente") : "pendente",
          paymentDate: i === 0 ? insertTransaction.paymentDate : null,
          isRecurring: 1,
          recurrenceFrequency: frequency,
          recurrenceCount: count,
          recurrenceGroupId: groupId,
          description: `${insertTransaction.description} (${i + 1}/${count})`,
        })
        .returning();
      created.push(tx);
    }

    return created;
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    return tx;
  }

  async updateTransaction(id: number, data: Partial<InsertTransaction>, userId: string): Promise<Transaction | null> {
    const [existing] = await db.select().from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    if (!existing) return null;
    const [updated] = await db
      .update(transactions)
      .set(data)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning();
    return updated;
  }

  async deleteTransaction(id: number, userId: string): Promise<boolean> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!tx) return false;
    if (tx.userId !== userId) return false;
    await db.delete(transactions).where(eq(transactions.id, id));
    return true;
  }

  async toggleReconciled(id: number, userId: string): Promise<Transaction | null> {
    const [existing] = await db.select().from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    if (!existing) return null;
    const newVal = existing.reconciled === 1 ? 0 : 1;
    const [updated] = await db
      .update(transactions)
      .set({ reconciled: newVal })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning();
    return updated;
  }

  async markAsPaid(id: number, userId: string, paymentDate?: Date): Promise<Transaction | null> {
    const [existing] = await db.select().from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    if (!existing) return null;
    const [updated] = await db
      .update(transactions)
      .set({ status: "pago", paymentDate: paymentDate || new Date() })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning();
    return updated;
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

  private getPaymentDescription(empName: string, salaryType: string): string {
    const now = new Date();
    const monthNames = [
      "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const month = monthNames[now.getMonth()];
    const year = now.getFullYear();
    const typeLabel = salaryType === "daily" ? "Diaria" : "Mensal";
    return `Pagamento ${empName} - ${typeLabel} - Referente a ${month}/${year}`;
  }

  async processPayroll(userId: string): Promise<Transaction[]> {
    const activeEmployees = await this.getEmployees(userId);
    const created: Transaction[] = [];
    for (const emp of activeEmployees) {
      const [tx] = await db
        .insert(transactions)
        .values({
          description: this.getPaymentDescription(emp.name, emp.salaryType),
          amount: emp.salary,
          type: "expense",
          category: "salarios",
          status: "pago",
          paymentDate: new Date(),
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
        description: this.getPaymentDescription(emp.name, emp.salaryType),
        amount: emp.salary,
        type: "expense",
        category: "salarios",
        status: "pago",
        paymentDate: new Date(),
        userId,
      })
      .returning();
    return tx;
  }

  async getProducts(userId: string): Promise<Product[]> {
    return await db.select().from(products)
      .where(and(eq(products.userId, userId), eq(products.active, 1)))
      .orderBy(desc(products.createdAt));
  }

  async createProduct(product: InsertProduct, userId: string): Promise<Product> {
    const [created] = await db
      .insert(products)
      .values({ ...product, userId })
      .returning();
    return created;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>, userId: string): Promise<Product | null> {
    const [existing] = await db.select().from(products)
      .where(and(eq(products.id, id), eq(products.userId, userId), eq(products.active, 1)));
    if (!existing) return null;
    const [updated] = await db
      .update(products)
      .set(product)
      .where(and(eq(products.id, id), eq(products.userId, userId)))
      .returning();
    return updated;
  }

  async deleteProduct(id: number, userId: string): Promise<boolean> {
    const [existing] = await db.select().from(products)
      .where(and(eq(products.id, id), eq(products.userId, userId)));
    if (!existing) return false;
    await db.update(products).set({ active: 0 }).where(eq(products.id, id));
    return true;
  }

  async decrementProductStock(id: number, quantity: number, userId: string): Promise<Product | null> {
    const [existing] = await db.select().from(products)
      .where(and(eq(products.id, id), eq(products.userId, userId), eq(products.active, 1)));
    if (!existing || existing.quantity < quantity) return null;
    const [updated] = await db
      .update(products)
      .set({ quantity: sql`${products.quantity} - ${quantity}` })
      .where(and(eq(products.id, id), eq(products.userId, userId)))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
