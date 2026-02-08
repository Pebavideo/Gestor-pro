import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  passwordHash: varchar("password_hash").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationCode: varchar("verification_code"),
  verificationCodeExpiresAt: timestamp("verification_code_expires_at"),
  role: varchar("role").notNull().default("operador"),
  store: varchar("store"),
  cnpjCpf: varchar("cnpj_cpf"),
  companyName: varchar("company_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ROLE_OPTIONS = [
  { value: "master", label: "Master" },
  { value: "gerente", label: "Gerente" },
  { value: "operador", label: "Operador" },
] as const;

export function getRoleLabel(value: string | null | undefined): string {
  if (!value) return "Operador";
  const found = ROLE_OPTIONS.find((o) => o.value === value);
  return found ? found.label : value;
}

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
