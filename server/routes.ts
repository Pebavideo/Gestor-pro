import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertEmployeeSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes, isAuthenticated, getUserId } from "./auth";

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Nao autenticado." });
  const role = await storage.getUserRole(userId);
  if (role !== "admin") {
    return res.status(403).json({ message: "Acesso negado. Apenas administradores podem realizar esta acao." });
  }
  next();
}

async function requireVerified(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Nao autenticado." });
  const { db } = await import("./db");
  const { users } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.emailVerified) {
    return res.status(403).json({ message: "E-mail nao verificado." });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  setupAuth(app);
  registerAuthRoutes(app);

  app.get(api.transactions.list.path, isAuthenticated, requireVerified, async (req, res) => {
    const userId = getUserId(req);
    const transactions = await storage.getTransactions(userId);
    res.json(transactions);
  });

  app.post(api.transactions.create.path, isAuthenticated, requireVerified, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.transactions.create.input.parse(req.body);
      const transaction = await storage.createTransaction(input, userId);
      res.status(201).json(transaction);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.transactions.delete.path, isAuthenticated, requireVerified, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
    
    const userId = getUserId(req);
    const deleted = await storage.deleteTransaction(id, userId);
    if (!deleted) return res.status(404).json({ message: "Transacao nao encontrada" });
    res.status(204).send();
  });

  app.get(api.settings.get.path, isAuthenticated, requireVerified, async (req, res) => {
    const userId = getUserId(req);
    const settings = await storage.getSettings(userId);
    res.json(settings);
  });

  app.patch(api.settings.update.path, isAuthenticated, requireVerified, requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.settings.update.input.parse(req.body);
      const settings = await storage.updateSettings(input, userId);
      res.json(settings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.summary.get.path, isAuthenticated, requireVerified, async (req, res) => {
    const userId = getUserId(req);
    const transactions = await storage.getTransactions(userId);
    const settings = await storage.getSettings(userId);
    const taxRate = parseFloat(settings.taxRate) || 0;

    let totalIncome = 0;
    let totalExpenses = 0;

    for (const t of transactions) {
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpenses += t.amount;
      }
    }

    const taxAmount = Math.round(totalIncome * (taxRate / 100));
    const netProfit = totalIncome - totalExpenses - taxAmount;

    res.json({
      totalIncome,
      totalExpenses,
      taxAmount,
      netProfit,
      currentTaxRate: taxRate
    });
  });

  app.get("/api/user/role", isAuthenticated, requireVerified, async (req, res) => {
    const userId = getUserId(req);
    const role = await storage.getUserRole(userId);
    res.json({ role });
  });

  app.patch("/api/user/role", isAuthenticated, requireVerified, requireAdmin, async (req, res) => {
    const { userId, role } = req.body;
    if (!userId || !["admin", "operator"].includes(role)) {
      return res.status(400).json({ message: "userId e role sao obrigatorios" });
    }
    await storage.setUserRole(userId, role);
    res.json({ message: "Perfil atualizado" });
  });

  // ====== Employee Routes ======
  app.get("/api/employees", isAuthenticated, requireVerified, async (req, res) => {
    const userId = getUserId(req);
    const emps = await storage.getEmployees(userId);
    res.json(emps);
  });

  app.post("/api/employees", isAuthenticated, requireVerified, requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(input, userId);
      res.status(201).json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.patch("/api/employees/:id", isAuthenticated, requireVerified, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
      const userId = getUserId(req);
      const input = insertEmployeeSchema.partial().parse(req.body);
      const employee = await storage.updateEmployee(id, input, userId);
      if (!employee) return res.status(404).json({ message: "Funcionario nao encontrado" });
      res.json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.delete("/api/employees/:id", isAuthenticated, requireVerified, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
    const userId = getUserId(req);
    const deleted = await storage.deleteEmployee(id, userId);
    if (!deleted) return res.status(404).json({ message: "Funcionario nao encontrado" });
    res.status(204).send();
  });

  app.post("/api/employees/:id/pay", isAuthenticated, requireVerified, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
    const userId = getUserId(req);
    const tx = await storage.processPayrollForEmployee(id, userId);
    if (!tx) return res.status(404).json({ message: "Funcionario nao encontrado" });
    res.status(201).json({ message: `Pagamento lancado para o funcionario.`, transaction: tx });
  });

  app.post("/api/employees/payroll", isAuthenticated, requireVerified, requireAdmin, async (req, res) => {
    const userId = getUserId(req);
    const emps = await storage.getEmployees(userId);
    if (emps.length === 0) {
      return res.status(400).json({ message: "Nenhum funcionario cadastrado para processar folha de pagamento." });
    }
    const txs = await storage.processPayroll(userId);
    res.status(201).json({ message: `Folha de pagamento processada. ${txs.length} lancamento(s) criado(s).`, transactions: txs });
  });

  app.patch("/api/user/make-admin", isAuthenticated, requireVerified, async (req, res) => {
    const userId = getUserId(req);
    const role = await storage.getUserRole(userId);
    if (role === "admin") {
      return res.json({ message: "Ja e admin", role: "admin" });
    }

    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const { eq, and, ne, sql } = await import("drizzle-orm");

    const existingAdmins = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.role, "admin"), ne(users.id, userId)));

    if (Number(existingAdmins[0].count) > 0) {
      return res.status(403).json({ message: "Ja existe um administrador." });
    }

    await db.update(users)
      .set({ role: "admin" })
      .where(eq(users.id, userId));

    return res.json({ message: "Primeiro usuario promovido a admin", role: "admin" });
  });

  return httpServer;
}
