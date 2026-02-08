import { db } from "./db";
import { 
  transactions, settings, users, employees, products,
  type Transaction, type InsertTransaction, 
  type Settings, type InsertSettings,
  type Employee, type InsertEmployee,
  type Product, type InsertProduct
} from "@shared/schema";
import { eq, desc, and, sql, or, isNull } from "drizzle-orm";
import type { User } from "@shared/models/auth";
import { randomUUID } from "crypto";

export interface UserContext {
  userId: string;
  role: string;
  store: string | null;
}

export interface IStorage {
  getTransactions(ctx: UserContext): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction, ctx: UserContext): Promise<Transaction>;
  createTransactionWithRecurrence(transaction: InsertTransaction, ctx: UserContext): Promise<Transaction[]>;
  updateTransaction(id: number, data: Partial<InsertTransaction>, ctx: UserContext): Promise<Transaction | null>;
  deleteTransaction(id: number, ctx: UserContext): Promise<boolean>;
  getTransaction(id: number): Promise<Transaction | undefined>;
  
  toggleReconciled(id: number, ctx: UserContext): Promise<Transaction | null>;
  markAsPaid(id: number, ctx: UserContext, paymentDate?: Date): Promise<Transaction | null>;

  getSettings(userId: string): Promise<Settings>;
  updateSettings(settings: InsertSettings, userId: string): Promise<Settings>;

  getUserRole(userId: string): Promise<string>;
  setUserRole(userId: string, role: string): Promise<void>;
  getUserContext(userId: string): Promise<UserContext>;

  getEmployees(ctx: UserContext): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee, ctx: UserContext): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>, ctx: UserContext): Promise<Employee | null>;
  deleteEmployee(id: number, ctx: UserContext): Promise<boolean>;
  processPayroll(ctx: UserContext): Promise<Transaction[]>;
  processPayrollForEmployee(employeeId: number, ctx: UserContext): Promise<Transaction | null>;

  getProducts(ctx: UserContext): Promise<Product[]>;
  createProduct(product: InsertProduct, ctx: UserContext): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>, ctx: UserContext): Promise<Product | null>;
  deleteProduct(id: number, ctx: UserContext): Promise<boolean>;
  decrementProductStock(id: number, quantity: number, ctx: UserContext): Promise<Product | null>;

  updateUserProfile(userId: string, data: { cnpjCpf?: string; companyName?: string; firstName?: string; lastName?: string }): Promise<void>;
  getAllUsers(): Promise<User[]>;
  updateUserRoleAndStore(userId: string, role: string, store: string | null): Promise<void>;
}

export class DatabaseStorage implements IStorage {

  async getUserContext(userId: string): Promise<UserContext> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return {
      userId,
      role: user?.role || "operador",
      store: user?.store || null,
    };
  }

  private storeFilter(storeColumn: any, ctx: UserContext) {
    if (ctx.role === "master") return undefined;
    if (ctx.store) return eq(storeColumn, ctx.store);
    return eq(storeColumn, "__none__");
  }

  async getTransactions(ctx: UserContext): Promise<Transaction[]> {
    if (ctx.role === "master") {
      return await db.select().from(transactions)
        .where(eq(transactions.userId, ctx.userId))
        .orderBy(desc(transactions.date));
    }
    const filter = this.storeFilter(transactions.store, ctx);
    return await db.select().from(transactions)
      .where(and(eq(transactions.userId, ctx.userId), filter))
      .orderBy(desc(transactions.date));
  }

  async createTransaction(insertTransaction: InsertTransaction, ctx: UserContext): Promise<Transaction> {
    const storeVal = ctx.role !== "master" && ctx.store ? ctx.store : insertTransaction.store;
    const [transaction] = await db
      .insert(transactions)
      .values({ ...insertTransaction, store: storeVal || null, userId: ctx.userId })
      .returning();
    return transaction;
  }

  async createTransactionWithRecurrence(insertTransaction: InsertTransaction, ctx: UserContext): Promise<Transaction[]> {
    const isRecurring = insertTransaction.isRecurring === 1;
    const frequency = insertTransaction.recurrenceFrequency;
    const count = insertTransaction.recurrenceCount || 1;

    if (!isRecurring || !frequency || count <= 1) {
      const tx = await this.createTransaction(insertTransaction, ctx);
      return [tx];
    }

    const groupId = randomUUID();
    const created: Transaction[] = [];
    const storeVal = ctx.role !== "master" && ctx.store ? ctx.store : insertTransaction.store;

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
          userId: ctx.userId,
          store: storeVal || null,
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

  async updateTransaction(id: number, data: Partial<InsertTransaction>, ctx: UserContext): Promise<Transaction | null> {
    const conditions = [eq(transactions.id, id), eq(transactions.userId, ctx.userId)];
    if (ctx.role !== "master" && ctx.store) {
      conditions.push(eq(transactions.store, ctx.store));
    }
    const [existing] = await db.select().from(transactions).where(and(...conditions));
    if (!existing) return null;
    const [updated] = await db
      .update(transactions)
      .set(data)
      .where(eq(transactions.id, id))
      .returning();
    return updated;
  }

  async deleteTransaction(id: number, ctx: UserContext): Promise<boolean> {
    const conditions = [eq(transactions.id, id), eq(transactions.userId, ctx.userId)];
    if (ctx.role !== "master" && ctx.store) {
      conditions.push(eq(transactions.store, ctx.store));
    }
    const [tx] = await db.select().from(transactions).where(and(...conditions));
    if (!tx) return false;
    await db.delete(transactions).where(eq(transactions.id, id));
    return true;
  }

  async toggleReconciled(id: number, ctx: UserContext): Promise<Transaction | null> {
    const conditions = [eq(transactions.id, id), eq(transactions.userId, ctx.userId)];
    if (ctx.role !== "master" && ctx.store) {
      conditions.push(eq(transactions.store, ctx.store));
    }
    const [existing] = await db.select().from(transactions).where(and(...conditions));
    if (!existing) return null;
    const newVal = existing.reconciled === 1 ? 0 : 1;
    const [updated] = await db
      .update(transactions)
      .set({ reconciled: newVal })
      .where(eq(transactions.id, id))
      .returning();
    return updated;
  }

  async markAsPaid(id: number, ctx: UserContext, paymentDate?: Date): Promise<Transaction | null> {
    const conditions = [eq(transactions.id, id), eq(transactions.userId, ctx.userId)];
    if (ctx.role !== "master" && ctx.store) {
      conditions.push(eq(transactions.store, ctx.store));
    }
    const [existing] = await db.select().from(transactions).where(and(...conditions));
    if (!existing) return null;
    const [updated] = await db
      .update(transactions)
      .set({ status: "pago", paymentDate: paymentDate || new Date() })
      .where(eq(transactions.id, id))
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
    return user?.role || "operador";
  }

  async setUserRole(userId: string, role: string): Promise<void> {
    await db.update(users).set({ role }).where(eq(users.id, userId));
  }

  async getEmployees(ctx: UserContext): Promise<Employee[]> {
    if (ctx.role === "master") {
      return await db.select().from(employees)
        .where(and(eq(employees.userId, ctx.userId), eq(employees.active, 1)))
        .orderBy(desc(employees.createdAt));
    }
    const conditions = [eq(employees.userId, ctx.userId), eq(employees.active, 1)];
    if (ctx.store) {
      conditions.push(eq(employees.store, ctx.store));
    }
    return await db.select().from(employees)
      .where(and(...conditions))
      .orderBy(desc(employees.createdAt));
  }

  async createEmployee(employee: InsertEmployee, ctx: UserContext): Promise<Employee> {
    const storeVal = ctx.role !== "master" && ctx.store ? ctx.store : employee.store;
    const [created] = await db
      .insert(employees)
      .values({ ...employee, store: storeVal || "fazenda", userId: ctx.userId })
      .returning();
    return created;
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>, ctx: UserContext): Promise<Employee | null> {
    const conditions = [eq(employees.id, id), eq(employees.userId, ctx.userId)];
    if (ctx.role !== "master" && ctx.store) {
      conditions.push(eq(employees.store, ctx.store));
    }
    const [existing] = await db.select().from(employees).where(and(...conditions));
    if (!existing) return null;
    const [updated] = await db
      .update(employees)
      .set(employee)
      .where(eq(employees.id, id))
      .returning();
    return updated;
  }

  async deleteEmployee(id: number, ctx: UserContext): Promise<boolean> {
    const conditions = [eq(employees.id, id), eq(employees.userId, ctx.userId)];
    if (ctx.role !== "master" && ctx.store) {
      conditions.push(eq(employees.store, ctx.store));
    }
    const [existing] = await db.select().from(employees).where(and(...conditions));
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

  async processPayroll(ctx: UserContext): Promise<Transaction[]> {
    const activeEmployees = await this.getEmployees(ctx);
    const created: Transaction[] = [];
    for (const emp of activeEmployees) {
      const [tx] = await db
        .insert(transactions)
        .values({
          description: this.getPaymentDescription(emp.name, emp.salaryType),
          amount: emp.salary,
          type: "expense",
          category: "salarios",
          store: emp.store,
          status: "pago",
          paymentDate: new Date(),
          userId: ctx.userId,
        })
        .returning();
      created.push(tx);
    }
    return created;
  }

  async processPayrollForEmployee(employeeId: number, ctx: UserContext): Promise<Transaction | null> {
    const conditions = [eq(employees.id, employeeId), eq(employees.userId, ctx.userId), eq(employees.active, 1)];
    if (ctx.role !== "master" && ctx.store) {
      conditions.push(eq(employees.store, ctx.store));
    }
    const [emp] = await db.select().from(employees).where(and(...conditions));
    if (!emp) return null;
    const [tx] = await db
      .insert(transactions)
      .values({
        description: this.getPaymentDescription(emp.name, emp.salaryType),
        amount: emp.salary,
        type: "expense",
        category: "salarios",
        store: emp.store,
        status: "pago",
        paymentDate: new Date(),
        userId: ctx.userId,
      })
      .returning();
    return tx;
  }

  async getProducts(ctx: UserContext): Promise<Product[]> {
    if (ctx.role === "master") {
      return await db.select().from(products)
        .where(and(eq(products.userId, ctx.userId), eq(products.active, 1)))
        .orderBy(desc(products.createdAt));
    }
    const conditions = [eq(products.userId, ctx.userId), eq(products.active, 1)];
    if (ctx.store) {
      conditions.push(eq(products.store, ctx.store));
    }
    return await db.select().from(products)
      .where(and(...conditions))
      .orderBy(desc(products.createdAt));
  }

  async createProduct(product: InsertProduct, ctx: UserContext): Promise<Product> {
    const storeVal = ctx.role !== "master" && ctx.store ? ctx.store : product.store;
    const [created] = await db
      .insert(products)
      .values({ ...product, store: storeVal || null, userId: ctx.userId })
      .returning();
    return created;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>, ctx: UserContext): Promise<Product | null> {
    const conditions = [eq(products.id, id), eq(products.userId, ctx.userId), eq(products.active, 1)];
    if (ctx.role !== "master" && ctx.store) {
      conditions.push(eq(products.store, ctx.store));
    }
    const [existing] = await db.select().from(products).where(and(...conditions));
    if (!existing) return null;
    const [updated] = await db
      .update(products)
      .set(product)
      .where(and(eq(products.id, id), eq(products.userId, ctx.userId)))
      .returning();
    return updated;
  }

  async deleteProduct(id: number, ctx: UserContext): Promise<boolean> {
    const conditions = [eq(products.id, id), eq(products.userId, ctx.userId)];
    if (ctx.role !== "master" && ctx.store) {
      conditions.push(eq(products.store, ctx.store));
    }
    const [existing] = await db.select().from(products).where(and(...conditions));
    if (!existing) return false;
    await db.update(products).set({ active: 0 }).where(eq(products.id, id));
    return true;
  }

  async decrementProductStock(id: number, quantity: number, ctx: UserContext): Promise<Product | null> {
    const conditions = [eq(products.id, id), eq(products.userId, ctx.userId), eq(products.active, 1)];
    if (ctx.role !== "master" && ctx.store) {
      conditions.push(eq(products.store, ctx.store));
    }
    const [existing] = await db.select().from(products).where(and(...conditions));
    if (!existing || existing.quantity < quantity) return null;
    const [updated] = await db
      .update(products)
      .set({ quantity: sql`${products.quantity} - ${quantity}` })
      .where(and(eq(products.id, id), eq(products.userId, ctx.userId)))
      .returning();
    return updated;
  }

  async updateUserProfile(userId: string, data: { cnpjCpf?: string; companyName?: string; firstName?: string; lastName?: string }): Promise<void> {
    await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserRoleAndStore(userId: string, role: string, store: string | null): Promise<void> {
    await db.update(users).set({ role, store, updatedAt: new Date() }).where(eq(users.id, userId));
  }
}

export const storage = new DatabaseStorage();
