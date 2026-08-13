import { db } from "./firebase";
import type {
  Transaction, InsertTransaction,
  Settings, InsertSettings,
  Employee, InsertEmployee,
  Product, InsertProduct,
} from "@shared/schema";
import type { User } from "@shared/models/auth";
import { randomUUID } from "crypto";
import type { Query, DocumentData, DocumentSnapshot, Timestamp } from "firebase-admin/firestore";

export interface UserContext {
  userId: string;
  role: string;
  store: string | null;
}

export interface IStorage {
  getTransactions(ctx: UserContext): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction, ctx: UserContext): Promise<Transaction>;
  createTransactionWithRecurrence(transaction: InsertTransaction, ctx: UserContext): Promise<Transaction[]>;
  updateTransaction(id: string, data: Partial<InsertTransaction>, ctx: UserContext): Promise<Transaction | null>;
  deleteTransaction(id: string, ctx: UserContext): Promise<boolean>;
  getTransaction(id: string): Promise<Transaction | undefined>;

  toggleReconciled(id: string, ctx: UserContext): Promise<Transaction | null>;
  markAsPaid(id: string, ctx: UserContext, paymentDate?: Date): Promise<Transaction | null>;

  getSettings(userId: string): Promise<Settings>;
  updateSettings(settings: InsertSettings, userId: string): Promise<Settings>;

  getUserRole(userId: string): Promise<string>;
  setUserRole(userId: string, role: string): Promise<void>;
  getUserContext(userId: string): Promise<UserContext>;

  getEmployees(ctx: UserContext): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee, ctx: UserContext): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>, ctx: UserContext): Promise<Employee | null>;
  deleteEmployee(id: string, ctx: UserContext): Promise<boolean>;
  processPayroll(ctx: UserContext): Promise<Transaction[]>;
  processPayrollForEmployee(employeeId: string, ctx: UserContext): Promise<Transaction | null>;

  getProducts(ctx: UserContext): Promise<Product[]>;
  createProduct(product: InsertProduct, ctx: UserContext): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>, ctx: UserContext): Promise<Product | null>;
  deleteProduct(id: string, ctx: UserContext): Promise<boolean>;
  decrementProductStock(id: string, quantity: number, ctx: UserContext): Promise<Product | null>;

  updateUserProfile(userId: string, data: { cnpjCpf?: string; companyName?: string; firstName?: string; lastName?: string; profileImageUrl?: string }): Promise<void>;
  getAllUsers(): Promise<User[]>;
  updateUserRoleAndStore(userId: string, role: string, store: string | null): Promise<void>;
}

const transactionsCol = () => db.collection("transactions");
const employeesCol = () => db.collection("employees");
const productsCol = () => db.collection("products");
const settingsCol = () => db.collection("settings");
const usersCol = () => db.collection("users");

// Converte Timestamp do Firestore (ou Date/undefined) em Date | null, mantendo
// o mesmo formato que o client sempre recebeu do Postgres via drizzle.
function tsToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as Timestamp).toDate === "function") return (value as Timestamp).toDate();
  return new Date(value as string);
}

function docToTransaction(doc: DocumentSnapshot<DocumentData>): Transaction {
  const data = doc.data()!;
  return {
    id: doc.id,
    description: data.description,
    amount: data.amount,
    type: data.type,
    category: data.category ?? null,
    store: data.store ?? null,
    status: data.status ?? "pago",
    dueDate: tsToDate(data.dueDate),
    paymentDate: tsToDate(data.paymentDate),
    isRecurring: data.isRecurring ?? 0,
    recurrenceFrequency: data.recurrenceFrequency ?? null,
    recurrenceCount: data.recurrenceCount ?? null,
    recurrenceGroupId: data.recurrenceGroupId ?? null,
    userId: data.userId,
    date: tsToDate(data.date) ?? new Date(),
    reconciled: data.reconciled ?? 0,
  };
}

function docToEmployee(doc: DocumentSnapshot<DocumentData>): Employee {
  const data = doc.data()!;
  return {
    id: doc.id,
    name: data.name,
    position: data.position,
    salary: data.salary,
    salaryType: data.salaryType ?? "monthly",
    store: data.store ?? "fazenda",
    userId: data.userId,
    active: data.active ?? 1,
    createdAt: tsToDate(data.createdAt) ?? new Date(),
  };
}

function docToProduct(doc: DocumentSnapshot<DocumentData>): Product {
  const data = doc.data()!;
  return {
    id: doc.id,
    name: data.name,
    specification: data.specification ?? null,
    unit: data.unit ?? "UN",
    store: data.store ?? null,
    quantity: data.quantity ?? 0,
    price: data.price,
    userId: data.userId,
    active: data.active ?? 1,
    createdAt: tsToDate(data.createdAt) ?? new Date(),
  };
}

function docToUser(doc: DocumentSnapshot<DocumentData>): User {
  const data = doc.data()!;
  return {
    id: doc.id,
    email: data.email,
    firstName: data.firstName ?? null,
    lastName: data.lastName ?? null,
    profileImageUrl: data.profileImageUrl ?? null,
    emailVerified: !!data.emailVerified,
    role: data.role ?? "operador",
    store: data.store ?? null,
    cnpjCpf: data.cnpjCpf ?? null,
    companyName: data.companyName ?? null,
    createdAt: tsToDate(data.createdAt),
    updatedAt: tsToDate(data.updatedAt),
  };
}

export class DatabaseStorage implements IStorage {

  async getUserContext(userId: string): Promise<UserContext> {
    if (!userId) return { userId, role: "operador", store: null };
    const doc = await usersCol().doc(userId).get();
    const data = doc.data();
    return {
      userId,
      role: data?.role || "operador",
      store: data?.store || null,
    };
  }

  private applyStoreFilter(query: Query, ctx: UserContext): Query {
    if (ctx.role === "master") return query;
    return query.where("store", "==", ctx.store || "__none__");
  }

  async getTransactions(ctx: UserContext): Promise<Transaction[]> {
    let query: Query = transactionsCol().where("userId", "==", ctx.userId);
    query = this.applyStoreFilter(query, ctx);
    const snap = await query.orderBy("date", "desc").get();
    return snap.docs.map(docToTransaction);
  }

  async createTransaction(insertTransaction: InsertTransaction, ctx: UserContext): Promise<Transaction> {
    const storeVal = ctx.role !== "master" && ctx.store ? ctx.store : insertTransaction.store;
    const data = {
      ...insertTransaction,
      store: storeVal || null,
      category: insertTransaction.category ?? null,
      dueDate: insertTransaction.dueDate ?? null,
      paymentDate: insertTransaction.paymentDate ?? null,
      recurrenceFrequency: insertTransaction.recurrenceFrequency ?? null,
      recurrenceCount: insertTransaction.recurrenceCount ?? null,
      recurrenceGroupId: insertTransaction.recurrenceGroupId ?? null,
      date: insertTransaction.date ?? new Date(),
      userId: ctx.userId,
      reconciled: 0,
    };
    const ref = await transactionsCol().add(data);
    return { id: ref.id, ...data } as Transaction;
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
    const storeVal = ctx.role !== "master" && ctx.store ? ctx.store : insertTransaction.store;
    const baseDueDate = insertTransaction.dueDate ? new Date(insertTransaction.dueDate) : new Date();

    const batch = db.batch();
    const created: Transaction[] = [];

    for (let i = 0; i < count; i++) {
      const dueDate = new Date(baseDueDate);
      if (frequency === "mensal") {
        dueDate.setMonth(dueDate.getMonth() + i);
      } else if (frequency === "quinzenal") {
        dueDate.setDate(dueDate.getDate() + (i * 15));
      }

      const txDate = i === 0 ? (insertTransaction.date || new Date()) : dueDate;

      const data = {
        ...insertTransaction,
        userId: ctx.userId,
        store: storeVal || null,
        category: insertTransaction.category ?? null,
        dueDate,
        date: txDate,
        status: i === 0 ? (insertTransaction.status || "pendente") : "pendente",
        paymentDate: i === 0 ? (insertTransaction.paymentDate ?? null) : null,
        isRecurring: 1,
        recurrenceFrequency: frequency,
        recurrenceCount: count,
        recurrenceGroupId: groupId,
        description: `${insertTransaction.description} (${i + 1}/${count})`,
        reconciled: 0,
      };

      const ref = transactionsCol().doc();
      batch.set(ref, data);
      created.push({ id: ref.id, ...data } as Transaction);
    }

    await batch.commit();
    return created;
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const doc = await transactionsCol().doc(id).get();
    if (!doc.exists) return undefined;
    return docToTransaction(doc);
  }

  private async getOwnedTransactionDoc(id: string, ctx: UserContext): Promise<DocumentSnapshot<DocumentData> | null> {
    const doc = await transactionsCol().doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    if (data.userId !== ctx.userId) return null;
    if (ctx.role !== "master" && ctx.store && data.store !== ctx.store) return null;
    return doc;
  }

  async updateTransaction(id: string, data: Partial<InsertTransaction>, ctx: UserContext): Promise<Transaction | null> {
    const existing = await this.getOwnedTransactionDoc(id, ctx);
    if (!existing) return null;
    await transactionsCol().doc(id).update(data as { [k: string]: unknown });
    const updated = await transactionsCol().doc(id).get();
    return docToTransaction(updated);
  }

  async deleteTransaction(id: string, ctx: UserContext): Promise<boolean> {
    const existing = await this.getOwnedTransactionDoc(id, ctx);
    if (!existing) return false;
    await transactionsCol().doc(id).delete();
    return true;
  }

  async toggleReconciled(id: string, ctx: UserContext): Promise<Transaction | null> {
    const existing = await this.getOwnedTransactionDoc(id, ctx);
    if (!existing) return null;
    const newVal = existing.data()!.reconciled === 1 ? 0 : 1;
    await transactionsCol().doc(id).update({ reconciled: newVal });
    const updated = await transactionsCol().doc(id).get();
    return docToTransaction(updated);
  }

  async markAsPaid(id: string, ctx: UserContext, paymentDate?: Date): Promise<Transaction | null> {
    const existing = await this.getOwnedTransactionDoc(id, ctx);
    if (!existing) return null;
    await transactionsCol().doc(id).update({ status: "pago", paymentDate: paymentDate || new Date() });
    const updated = await transactionsCol().doc(id).get();
    return docToTransaction(updated);
  }

  async getSettings(userId: string): Promise<Settings> {
    const ref = settingsCol().doc(userId);
    const doc = await ref.get();
    if (doc.exists) {
      const data = doc.data()!;
      return { id: userId, userId, taxRate: data.taxRate ?? "15" };
    }
    await ref.set({ userId, taxRate: "15" });
    return { id: userId, userId, taxRate: "15" };
  }

  async updateSettings(newSettings: InsertSettings, userId: string): Promise<Settings> {
    await this.getSettings(userId);
    await settingsCol().doc(userId).update({ taxRate: newSettings.taxRate });
    return { id: userId, userId, taxRate: newSettings.taxRate };
  }

  async getUserRole(userId: string): Promise<string> {
    const doc = await usersCol().doc(userId).get();
    return doc.data()?.role || "operador";
  }

  async setUserRole(userId: string, role: string): Promise<void> {
    await usersCol().doc(userId).update({ role });
  }

  async getEmployees(ctx: UserContext): Promise<Employee[]> {
    let query: Query = employeesCol().where("userId", "==", ctx.userId).where("active", "==", 1);
    if (ctx.role !== "master" && ctx.store) {
      query = query.where("store", "==", ctx.store);
    }
    const snap = await query.orderBy("createdAt", "desc").get();
    return snap.docs.map(docToEmployee);
  }

  async createEmployee(employee: InsertEmployee, ctx: UserContext): Promise<Employee> {
    const storeVal = ctx.role !== "master" && ctx.store ? ctx.store : employee.store;
    const data = {
      ...employee,
      store: storeVal || "fazenda",
      userId: ctx.userId,
      active: 1,
      createdAt: employee.createdAt ?? new Date(),
    };
    const ref = await employeesCol().add(data);
    return { id: ref.id, ...data } as Employee;
  }

  private async getOwnedEmployeeDoc(id: string, ctx: UserContext): Promise<DocumentSnapshot<DocumentData> | null> {
    const doc = await employeesCol().doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    if (data.userId !== ctx.userId) return null;
    if (ctx.role !== "master" && ctx.store && data.store !== ctx.store) return null;
    return doc;
  }

  async updateEmployee(id: string, employee: Partial<InsertEmployee>, ctx: UserContext): Promise<Employee | null> {
    const existing = await this.getOwnedEmployeeDoc(id, ctx);
    if (!existing) return null;
    await employeesCol().doc(id).update(employee as { [k: string]: unknown });
    const updated = await employeesCol().doc(id).get();
    return docToEmployee(updated);
  }

  async deleteEmployee(id: string, ctx: UserContext): Promise<boolean> {
    const existing = await this.getOwnedEmployeeDoc(id, ctx);
    if (!existing) return false;
    await employeesCol().doc(id).update({ active: 0 });
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
    if (activeEmployees.length === 0) return [];

    const batch = db.batch();
    const created: Transaction[] = [];
    for (const emp of activeEmployees) {
      const data = {
        description: this.getPaymentDescription(emp.name, emp.salaryType),
        amount: emp.salary,
        type: "expense",
        category: "salarios",
        store: emp.store,
        status: "pago",
        dueDate: null,
        paymentDate: new Date(),
        isRecurring: 0,
        recurrenceFrequency: null,
        recurrenceCount: null,
        recurrenceGroupId: null,
        userId: ctx.userId,
        date: new Date(),
        reconciled: 0,
      };
      const ref = transactionsCol().doc();
      batch.set(ref, data);
      created.push({ id: ref.id, ...data } as Transaction);
    }
    await batch.commit();
    return created;
  }

  async processPayrollForEmployee(employeeId: string, ctx: UserContext): Promise<Transaction | null> {
    const doc = await employeesCol().doc(employeeId).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    if (data.userId !== ctx.userId || data.active !== 1) return null;
    if (ctx.role !== "master" && ctx.store && data.store !== ctx.store) return null;

    const emp = docToEmployee(doc);
    const txData = {
      description: this.getPaymentDescription(emp.name, emp.salaryType),
      amount: emp.salary,
      type: "expense",
      category: "salarios",
      store: emp.store,
      status: "pago",
      dueDate: null,
      paymentDate: new Date(),
      isRecurring: 0,
      recurrenceFrequency: null,
      recurrenceCount: null,
      recurrenceGroupId: null,
      userId: ctx.userId,
      date: new Date(),
      reconciled: 0,
    };
    const ref = await transactionsCol().add(txData);
    return { id: ref.id, ...txData } as Transaction;
  }

  async getProducts(ctx: UserContext): Promise<Product[]> {
    let query: Query = productsCol().where("userId", "==", ctx.userId).where("active", "==", 1);
    if (ctx.role !== "master" && ctx.store) {
      query = query.where("store", "==", ctx.store);
    }
    const snap = await query.orderBy("createdAt", "desc").get();
    return snap.docs.map(docToProduct);
  }

  async createProduct(product: InsertProduct, ctx: UserContext): Promise<Product> {
    const storeVal = ctx.role !== "master" && ctx.store ? ctx.store : product.store;
    const data = {
      ...product,
      specification: product.specification ?? null,
      store: storeVal || null,
      userId: ctx.userId,
      active: 1,
      createdAt: product.createdAt ?? new Date(),
    };
    const ref = await productsCol().add(data);
    return { id: ref.id, ...data } as Product;
  }

  private async getOwnedProductDoc(id: string, ctx: UserContext, requireActive = true): Promise<DocumentSnapshot<DocumentData> | null> {
    const doc = await productsCol().doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    if (data.userId !== ctx.userId) return null;
    if (requireActive && data.active !== 1) return null;
    if (ctx.role !== "master" && ctx.store && data.store !== ctx.store) return null;
    return doc;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>, ctx: UserContext): Promise<Product | null> {
    const existing = await this.getOwnedProductDoc(id, ctx);
    if (!existing) return null;
    await productsCol().doc(id).update(product as { [k: string]: unknown });
    const updated = await productsCol().doc(id).get();
    return docToProduct(updated);
  }

  async deleteProduct(id: string, ctx: UserContext): Promise<boolean> {
    const existing = await this.getOwnedProductDoc(id, ctx, false);
    if (!existing) return false;
    await productsCol().doc(id).update({ active: 0 });
    return true;
  }

  async decrementProductStock(id: string, quantity: number, ctx: UserContext): Promise<Product | null> {
    const ref = productsCol().doc(id);
    try {
      return await db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (!doc.exists) return null;
        const data = doc.data()!;
        if (data.userId !== ctx.userId || data.active !== 1) return null;
        if (ctx.role !== "master" && ctx.store && data.store !== ctx.store) return null;
        if ((data.quantity ?? 0) < quantity) return null;
        const newQuantity = data.quantity - quantity;
        tx.update(ref, { quantity: newQuantity });
        return {
          id: doc.id,
          name: data.name,
          specification: data.specification ?? null,
          unit: data.unit ?? "UN",
          store: data.store ?? null,
          quantity: newQuantity,
          price: data.price,
          userId: data.userId,
          active: data.active ?? 1,
          createdAt: tsToDate(data.createdAt) ?? new Date(),
        } as Product;
      });
    } catch {
      return null;
    }
  }

  async updateUserProfile(userId: string, data: { cnpjCpf?: string; companyName?: string; firstName?: string; lastName?: string; profileImageUrl?: string }): Promise<void> {
    // Firestore nao aceita "undefined" como valor (diferente do drizzle, que
    // ignora chaves undefined no SET) - filtramos antes de enviar.
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    await usersCol().doc(userId).update({ ...clean, updatedAt: new Date() });
  }

  async getAllUsers(): Promise<User[]> {
    const snap = await usersCol().orderBy("createdAt", "desc").get();
    return snap.docs.map(docToUser);
  }

  async updateUserRoleAndStore(userId: string, role: string, store: string | null): Promise<void> {
    await usersCol().doc(userId).update({ role, store, updatedAt: new Date() });
  }
}

export const storage = new DatabaseStorage();
