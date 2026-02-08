import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage, type UserContext } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertEmployeeSchema, insertProductSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes, isAuthenticated, getUserId } from "./auth";

async function getCtx(req: Request): Promise<UserContext> {
  const userId = getUserId(req);
  return storage.getUserContext(userId);
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

async function requireMaster(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Nao autenticado." });
  const role = await storage.getUserRole(userId);
  if (role !== "master") {
    return res.status(403).json({ message: "Acesso negado. Apenas o Master pode realizar esta acao." });
  }
  next();
}

async function requireMasterOrGerente(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Nao autenticado." });
  const role = await storage.getUserRole(userId);
  if (role !== "master" && role !== "gerente") {
    return res.status(403).json({ message: "Acesso negado. Apenas Master ou Gerente podem realizar esta acao." });
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
    const ctx = await getCtx(req);
    const txs = await storage.getTransactions(ctx);
    res.json(txs);
  });

  app.post(api.transactions.create.path, isAuthenticated, requireVerified, async (req, res) => {
    try {
      const ctx = await getCtx(req);
      const { productId, productQty, ...txData } = req.body;

      if (txData.dueDate && typeof txData.dueDate === "string") {
        txData.dueDate = new Date(txData.dueDate);
      }
      if (txData.paymentDate && typeof txData.paymentDate === "string") {
        txData.paymentDate = new Date(txData.paymentDate);
      }

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
        const result = await storage.decrementProductStock(pid, qty, ctx);
        if (!result) {
          return res.status(400).json({ message: "Estoque insuficiente ou produto nao encontrado." });
        }
      }

      if (input.isRecurring === 1 && input.recurrenceFrequency && (input.recurrenceCount || 0) > 1) {
        const created = await storage.createTransactionWithRecurrence(input, ctx);
        res.status(201).json(created[0]);
      } else {
        const transaction = await storage.createTransaction(input, ctx);
        res.status(201).json(transaction);
      }
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

  app.patch("/api/transactions/:id", isAuthenticated, requireVerified, requireMasterOrGerente, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
      const ctx = await getCtx(req);

      const body = { ...req.body };
      if (body.dueDate && typeof body.dueDate === "string") {
        body.dueDate = new Date(body.dueDate);
      }
      if (body.paymentDate && typeof body.paymentDate === "string") {
        body.paymentDate = new Date(body.paymentDate);
      }

      const input = api.transactions.create.input.partial().parse(body);
      const updated = await storage.updateTransaction(id, input, ctx);
      if (!updated) return res.status(404).json({ message: "Transacao nao encontrada" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.patch("/api/transactions/:id/mark-paid", isAuthenticated, requireVerified, requireMasterOrGerente, async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
    const ctx = await getCtx(req);
    const paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
    const updated = await storage.markAsPaid(id, ctx, paymentDate);
    if (!updated) return res.status(404).json({ message: "Transacao nao encontrada" });
    res.json(updated);
  });

  app.patch("/api/transactions/:id/reconcile", isAuthenticated, requireVerified, requireMasterOrGerente, async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
    const ctx = await getCtx(req);
    const updated = await storage.toggleReconciled(id, ctx);
    if (!updated) return res.status(404).json({ message: "Transacao nao encontrada" });
    res.json(updated);
  });

  app.post("/api/transactions/import-csv", isAuthenticated, requireVerified, requireMasterOrGerente, async (req, res) => {
    try {
      const ctx = await getCtx(req);
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "Nenhum dado encontrado no arquivo." });
      }
      const created: any[] = [];
      for (const row of rows) {
        const description = String(row.description || row.descricao || row.historico || "Importacao CSV").trim();

        let amount: number;
        if (row.amount_cents !== undefined && row.amount_cents !== null) {
          amount = Math.abs(Math.round(Number(row.amount_cents)));
        } else {
          let rawAmount = row.amount || row.valor || row.value || "0";
          if (typeof rawAmount === "string") {
            rawAmount = rawAmount.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
          }
          amount = Math.abs(Math.round(parseFloat(rawAmount) * 100));
        }
        if (isNaN(amount) || amount === 0) continue;

        let type = "expense";
        if (row.type === "income" || row.tipo === "entrada" || row.tipo === "receita") {
          type = "income";
        } else if (row.type === "expense" || row.tipo === "saida" || row.tipo === "despesa") {
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

        const category = row.category || row.categoria || null;
        const storeVal = ctx.role !== "master" && ctx.store ? ctx.store : (row.store || row.loja || null);

        const [tx] = await (await import("./db")).db
          .insert((await import("@shared/schema")).transactions)
          .values({
            description, amount, type, category, store: storeVal, userId: ctx.userId, date: dateVal,
            status: "pago",
            paymentDate: dateVal,
          })
          .returning();
        created.push(tx);
      }
      res.status(201).json({ message: `${created.length} transacao(es) importada(s) com sucesso.`, count: created.length });
    } catch (err) {
      console.error("CSV import error:", err);
      res.status(500).json({ message: "Erro ao importar arquivo." });
    }
  });

  app.delete(api.transactions.delete.path, isAuthenticated, requireVerified, requireMasterOrGerente, async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
    
    const ctx = await getCtx(req);
    const deleted = await storage.deleteTransaction(id, ctx);
    if (!deleted) return res.status(404).json({ message: "Transacao nao encontrada" });
    res.status(204).send();
  });

  app.get(api.settings.get.path, isAuthenticated, requireVerified, async (req, res) => {
    const userId = getUserId(req);
    const settings = await storage.getSettings(userId);
    res.json(settings);
  });

  app.patch(api.settings.update.path, isAuthenticated, requireVerified, requireMaster, async (req, res) => {
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
    const ctx = await getCtx(req);
    if (ctx.role === "operador") {
      return res.json({
        totalIncome: 0,
        totalExpenses: 0,
        taxAmount: 0,
        netProfit: 0,
        currentTaxRate: 0,
      });
    }
    const txs = await storage.getTransactions(ctx);
    const settings = await storage.getSettings(ctx.userId);
    const taxRate = parseFloat(settings.taxRate) || 0;

    let totalIncome = 0;
    let totalExpenses = 0;

    for (const t of txs) {
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
    const ctx = await storage.getUserContext(userId);
    res.json({ role: ctx.role, store: ctx.store });
  });

  app.patch("/api/user/role", isAuthenticated, requireVerified, requireMaster, async (req, res) => {
    const { userId, role, store } = req.body;
    if (!userId || !["master", "gerente", "operador"].includes(role)) {
      return res.status(400).json({ message: "userId e role sao obrigatorios" });
    }
    await storage.updateUserRoleAndStore(userId, role, store || null);
    res.json({ message: "Perfil atualizado" });
  });

  app.patch("/api/user/profile", isAuthenticated, requireVerified, async (req, res) => {
    const userId = getUserId(req);
    const { cnpjCpf, companyName, firstName, lastName } = req.body;
    await storage.updateUserProfile(userId, { cnpjCpf, companyName, firstName, lastName });
    res.json({ message: "Perfil atualizado" });
  });

  app.get("/api/users", isAuthenticated, requireVerified, requireMaster, async (req, res) => {
    const allUsers = await storage.getAllUsers();
    res.json(allUsers.map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      store: u.store,
      cnpjCpf: u.cnpjCpf,
      companyName: u.companyName,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
    })));
  });

  app.get("/api/employees", isAuthenticated, requireVerified, async (req, res) => {
    const ctx = await getCtx(req);
    const emps = await storage.getEmployees(ctx);
    res.json(emps);
  });

  app.post("/api/employees", isAuthenticated, requireVerified, requireMasterOrGerente, async (req, res) => {
    try {
      const ctx = await getCtx(req);
      const { createdAt, salaryType, store, ...rest } = req.body;
      const input = insertEmployeeSchema.omit({ createdAt: true, salaryType: true, store: true }).parse(rest);
      const employeeData: any = { ...input };
      if (createdAt) {
        employeeData.createdAt = new Date(createdAt);
      }
      if (salaryType && !["monthly", "daily"].includes(salaryType)) {
        return res.status(400).json({ message: "Tipo de salario invalido. Use 'monthly' ou 'daily'." });
      }
      employeeData.salaryType = salaryType || "monthly";
      employeeData.store = store || ctx.store || "fazenda";
      const employee = await storage.createEmployee(employeeData, ctx);
      res.status(201).json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.patch("/api/employees/:id", isAuthenticated, requireVerified, requireMasterOrGerente, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
      const ctx = await getCtx(req);
      const { salaryType, store, ...rest } = req.body;
      const input: any = insertEmployeeSchema.partial().omit({ salaryType: true, store: true }).parse(rest);
      if (salaryType !== undefined) {
        if (!["monthly", "daily"].includes(salaryType)) {
          return res.status(400).json({ message: "Tipo de salario invalido. Use 'monthly' ou 'daily'." });
        }
        input.salaryType = salaryType;
      }
      if (store !== undefined) {
        input.store = store;
      }
      const employee = await storage.updateEmployee(id, input, ctx);
      if (!employee) return res.status(404).json({ message: "Funcionario nao encontrado" });
      res.json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.delete("/api/employees/:id", isAuthenticated, requireVerified, requireMasterOrGerente, async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
    const ctx = await getCtx(req);
    const deleted = await storage.deleteEmployee(id, ctx);
    if (!deleted) return res.status(404).json({ message: "Funcionario nao encontrado" });
    res.status(204).send();
  });

  app.post("/api/employees/:id/pay", isAuthenticated, requireVerified, requireMasterOrGerente, async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
    const ctx = await getCtx(req);
    const tx = await storage.processPayrollForEmployee(id, ctx);
    if (!tx) return res.status(404).json({ message: "Funcionario nao encontrado" });
    res.status(201).json({ message: `Pagamento lancado para o funcionario.`, transaction: tx });
  });

  app.post("/api/employees/payroll", isAuthenticated, requireVerified, requireMasterOrGerente, async (req, res) => {
    const ctx = await getCtx(req);
    const emps = await storage.getEmployees(ctx);
    if (emps.length === 0) {
      return res.status(400).json({ message: "Nenhum funcionario cadastrado para processar folha de pagamento." });
    }
    const txs = await storage.processPayroll(ctx);
    res.status(201).json({ message: `Folha de pagamento processada. ${txs.length} lancamento(s) criado(s).`, transactions: txs });
  });

  app.get("/api/products", isAuthenticated, requireVerified, async (req, res) => {
    const ctx = await getCtx(req);
    const prods = await storage.getProducts(ctx);
    res.json(prods);
  });

  app.post("/api/products", isAuthenticated, requireVerified, async (req, res) => {
    try {
      const ctx = await getCtx(req);
      const { createdAt, ...rest } = req.body;
      const input = insertProductSchema.omit({ createdAt: true }).parse(rest);
      const productData: any = { ...input };
      if (createdAt) {
        productData.createdAt = new Date(createdAt);
      }
      const product = await storage.createProduct(productData, ctx);
      res.status(201).json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.patch("/api/products/:id", isAuthenticated, requireVerified, requireMasterOrGerente, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
      const ctx = await getCtx(req);
      const input = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, input, ctx);
      if (!product) return res.status(404).json({ message: "Produto nao encontrado" });
      res.json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.delete("/api/products/:id", isAuthenticated, requireVerified, requireMasterOrGerente, async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(404).json({ message: "ID invalido" });
    const ctx = await getCtx(req);
    const deleted = await storage.deleteProduct(id, ctx);
    if (!deleted) return res.status(404).json({ message: "Produto nao encontrado" });
    res.status(204).send();
  });

  app.patch("/api/user/make-admin", isAuthenticated, requireVerified, async (req, res) => {
    const userId = getUserId(req);
    const role = await storage.getUserRole(userId);
    if (role === "master") {
      return res.json({ message: "Ja e master", role: "master" });
    }

    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const { eq, and, ne, sql } = await import("drizzle-orm");

    const existingMasters = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.role, "master"), ne(users.id, userId)));

    if (Number(existingMasters[0].count) > 0) {
      return res.status(403).json({ message: "Ja existe um Master." });
    }

    await db.update(users)
      .set({ role: "master" })
      .where(eq(users.id, userId));

    return res.json({ message: "Primeiro usuario promovido a master", role: "master" });
  });

  app.get("/api/notifications/due-today", isAuthenticated, requireVerified, async (req, res) => {
    const ctx = await getCtx(req);
    const allTx = await storage.getTransactions(ctx);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueTodayTx = allTx.filter((tx) => {
      if (tx.status !== "pendente" || !tx.dueDate) return false;
      const due = new Date(tx.dueDate);
      due.setHours(0, 0, 0, 0);
      return due.getTime() === today.getTime();
    });

    const overdueTx = allTx.filter((tx) => {
      if (tx.status !== "pendente" || !tx.dueDate) return false;
      const due = new Date(tx.dueDate);
      due.setHours(0, 0, 0, 0);
      return due < today;
    });

    res.json({ dueToday: dueTodayTx, overdue: overdueTx });
  });

  return httpServer;
}
