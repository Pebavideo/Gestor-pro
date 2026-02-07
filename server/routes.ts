import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
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

  app.patch("/api/user/make-admin", isAuthenticated, requireVerified, async (req, res) => {
    const userId = getUserId(req);
    const role = await storage.getUserRole(userId);
    if (role === "admin") {
      return res.json({ message: "Ja e admin", role: "admin" });
    }

    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const { eq, sql } = await import("drizzle-orm");

    await db.update(users)
      .set({ role: "admin" })
      .where(eq(users.id, userId))
      .returning();
    
    const adminCount = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, "admin"));
    
    if (Number(adminCount[0].count) > 1) {
      await db.update(users).set({ role: "operator" }).where(eq(users.id, userId));
      return res.status(403).json({ message: "Ja existe um administrador." });
    }
    
    return res.json({ message: "Primeiro usuario promovido a admin", role: "admin" });
  });

  return httpServer;
}
