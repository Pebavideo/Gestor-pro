// Camada de dados Firestore do client (sem servidor no meio - plano Spark).
// Mesma forma de documento que server/storage.ts usava (agora removido do
// caminho de producao), so que lida direto pelo Web SDK. Toda a
// autorizacao (quem le/escreve o que) fica em firestore.rules, nao aqui.
import {
  collection,
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Transaction, Employee, Product, Settings } from "@shared/schema";
import type { User } from "@shared/models/auth";

export function tsToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

function converter<T extends { id: string }>(
  fromData: (id: string, data: DocumentData) => T,
): FirestoreDataConverter<T> {
  return {
    toFirestore: (value: T) => {
      const { id, ...rest } = value as T & { id: string };
      return rest as DocumentData;
    },
    fromFirestore: (snap: QueryDocumentSnapshot, options?: SnapshotOptions) =>
      fromData(snap.id, snap.data(options)),
  };
}

export const transactionConverter = converter<Transaction>((id, data) => ({
  id,
  description: data.description,
  amount: Number.isFinite(data.amount) ? data.amount : 0,
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
}));

export const employeeConverter = converter<Employee>((id, data) => ({
  id,
  name: data.name,
  position: data.position,
  salary: Number.isFinite(data.salary) ? data.salary : 0,
  salaryType: data.salaryType ?? "monthly",
  store: data.store ?? "fazenda",
  userId: data.userId,
  active: data.active ?? 1,
  createdAt: tsToDate(data.createdAt) ?? new Date(),
}));

export const productConverter = converter<Product>((id, data) => ({
  id,
  name: data.name,
  specification: data.specification ?? null,
  unit: data.unit ?? "UN",
  store: data.store ?? null,
  quantity: Number.isFinite(data.quantity) ? data.quantity : 0,
  price: Number.isFinite(data.price) ? data.price : 0,
  userId: data.userId,
  active: data.active ?? 1,
  createdAt: tsToDate(data.createdAt) ?? new Date(),
}));

export const settingsConverter = converter<Settings>((id, data) => ({
  id,
  userId: data.userId ?? id,
  taxRate: data.taxRate ?? "15",
}));

export const userConverter = converter<User>((id, data) => ({
  id,
  email: data.email,
  firstName: data.firstName ?? null,
  lastName: data.lastName ?? null,
  profileImageUrl: data.profileImageUrl ?? null,
  emailVerified: !!data.emailVerified,
  role: data.role ?? "operador",
  store: data.store ?? null,
  cnpjCpf: data.cnpjCpf ?? null,
  companyName: data.companyName ?? null,
  active: data.active ?? 1,
  lastAccessAt: tsToDate(data.lastAccessAt),
  createdAt: tsToDate(data.createdAt),
  updatedAt: tsToDate(data.updatedAt),
}));

export const transactionsCol = () => collection(db, "transactions").withConverter(transactionConverter);
export const employeesCol = () => collection(db, "employees").withConverter(employeeConverter);
export const productsCol = () => collection(db, "products").withConverter(productConverter);
export const settingsCol = () => collection(db, "settings").withConverter(settingsConverter);
export const usersCol = () => collection(db, "users").withConverter(userConverter);
