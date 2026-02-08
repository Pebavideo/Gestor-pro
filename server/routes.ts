import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertEmployeeSchema, insertProductSchema } from "@shared/schema";
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
      const { productId, productQty, ...txData } = req.body;
      const input = api.transactions.create.input.parse(txData);

      if (productId && input.type === "income") {
        const pid = typeof productId === "number" ? productId : parseInt(productId);
        const qty = typeof productQty === "number" ? productQty : parseInt(productQty) || 1;
        if (isNaN(pid) || pid <= 0) {
          return res.status(400).json({ message: "ID do produto invalido." });
        }
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ message: "Quantidade deve ser maior que zero." });
        }
        const result = await storage.decrementProductStock(pid, qty, userId);
        if (!result) {
          return res.status(400).json({ message: "Estoque insuficiente ou produto nao encontrado." });
        }
      }

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

  app.patch("/api/transactions/:id", isAuthenticated, requireVerified, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
      const userId = getUserId(req);
      const input = api.transactions.create.input.partial().parse(req.body);
      const updated = await storage.updateTransaction(id, input, userId);
      if (!updated) return res.status(404).json({ message: "Transacao nao encontrada" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.patch("/api/transactions/:id/reconcile", isAuthenticated, requireVerified, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
    const userId = getUserId(req);
    const updated = await storage.toggleReconciled(id, userId);
    if (!updated) return res.status(404).json({ message: "Transacao nao encontrada" });
    res.json(updated);
  });

  app.post("/api/transactions/import-csv", isAuthenticated, requireVerified, requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "Nenhum dado encontrado no arquivo." });
      }
      const created: any[] = [];
      for (const row of rows) {
        const description = String(row.description || row.descricao || row.historico || "Importacao CSV").trim();
        let rawAmount = row.amount || row.valor || row.value || "0";
        if (typeof rawAmount === "string") {
          rawAmount = rawAmount.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
        }
        const amount = Math.abs(Math.round(parseFloat(rawAmount) * 100));
        if (isNaN(amount) || amount === 0) continue;

        let type = "expense";
        if (row.type === "income" || row.tipo === "entrada" || row.tipo === "receita" ||
            (typeof rawAmount === "string" && !rawAmount.startsWith("-")) ||
            parseFloat(String(row.amount || row.valor || row.value || "0").replace(/[R$\s.]/g, "").replace(",", ".")) > 0) {
          if (row.type === "income" || row.tipo === "entrada" || row.tipo === "receita") {
            type = "income";
          }
        }
        if (row.type === "expense" || row.tipo === "saida" || row.tipo === "despesa") {
          type = "expense";
        }

        let dateVal = new Date();
        if (row.date || row.data) {
          const rawDate = String(row.date || row.data);
          const parts = rawDate.split("/");
          if (parts.length === 3) {
            dateVal = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          } else {
            const parsed = new Date(rawDate);
            if (!isNaN(parsed.getTime())) dateVal = parsed;
          }
        }

        const [tx] = await (await import("./db")).db
          .insert((await import("@shared/schema")).transactions)
          .values({ description, amount, type, userId, date: dateVal })
          .returning();
        created.push(tx);
      }
      res.status(201).json({ message: `${created.length} transacao(es) importada(s) com sucesso.`, count: created.length });
    } catch (err) {
      console.error("CSV import error:", err);
      res.status(500).json({ message: "Erro ao importar arquivo." });
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
      const { createdAt, salaryType, ...rest } = req.body;
      const input = insertEmployeeSchema.omit({ createdAt: true, salaryType: true }).parse(rest);
      const employeeData: any = { ...input };
      if (createdAt) {
        employeeData.createdAt = new Date(createdAt);
      }
      if (salaryType && !["monthly", "daily"].includes(salaryType)) {
        return res.status(400).json({ message: "Tipo de salario invalido. Use 'monthly' ou 'daily'." });
      }
      employeeData.salaryType = salaryType || "monthly";
      const employee = await storage.createEmployee(employeeData, userId);
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
      const { salaryType, ...rest } = req.body;
      const input: any = insertEmployeeSchema.partial().omit({ salaryType: true }).parse(rest);
      if (salaryType !== undefined) {
        if (!["monthly", "daily"].includes(salaryType)) {
          return res.status(400).json({ message: "Tipo de salario invalido. Use 'monthly' ou 'daily'." });
        }
        input.salaryType = salaryType;
      }
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

  // ====== Product Routes ======
  app.get("/api/products", isAuthenticated, requireVerified, async (req, res) => {
    const userId = getUserId(req);
    const prods = await storage.getProducts(userId);
    res.json(prods);
  });

  app.post("/api/products", isAuthenticated, requireVerified, requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { createdAt, ...rest } = req.body;
      const input = insertProductSchema.omit({ createdAt: true }).parse(rest);
      const productData: any = { ...input };
      if (createdAt) {
        productData.createdAt = new Date(createdAt);
      }
      const product = await storage.createProduct(productData, userId);
      res.status(201).json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.patch("/api/products/:id", isAuthenticated, requireVerified, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
      const userId = getUserId(req);
      const input = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, input, userId);
      if (!product) return res.status(404).json({ message: "Produto nao encontrado" });
      res.json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.delete("/api/products/:id", isAuthenticated, requireVerified, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
    const userId = getUserId(req);
    const deleted = await storage.deleteProduct(id, userId);
    if (!deleted) return res.status(404).json({ message: "Produto nao encontrado" });
    res.status(204).send();
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
