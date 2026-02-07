
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Transactions
  app.get(api.transactions.list.path, async (req, res) => {
    const transactions = await storage.getTransactions();
    res.json(transactions);
  });

  app.post(api.transactions.create.path, async (req, res) => {
    try {
      const input = api.transactions.create.input.parse(req.body);
      const transaction = await storage.createTransaction(input);
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

  app.delete(api.transactions.delete.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(404).json({ message: "Invalid ID" });
    
    await storage.deleteTransaction(id);
    res.status(204).send();
  });

  // Settings
  app.get(api.settings.get.path, async (req, res) => {
    const settings = await storage.getSettings();
    res.json(settings);
  });

  app.patch(api.settings.update.path, async (req, res) => {
    try {
      const input = api.settings.update.input.parse(req.body);
      const settings = await storage.updateSettings(input);
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

  // Summary
  app.get(api.summary.get.path, async (req, res) => {
    const transactions = await storage.getTransactions();
    const settings = await storage.getSettings();
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

    // Calculations based on the Python logic
    // tax = total_entradas * (taxa_imposto / 100)
    // profit = total_entradas - total_saidas - impostos
    
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

  await seedData();

  return httpServer;
}

// Helper to seed some initial data if empty
async function seedData() {
  const transactions = await storage.getTransactions();
  if (transactions.length === 0) {
    // Add same example data as the python script
    // {"descricao": "Venda de Produto A", "valor": 1500.00, "tipo": "entrada"},
    // {"descricao": "Venda de Serviço B", "valor": 2000.00, "tipo": "entrada"},
    // {"descricao": "Aluguel Escritório", "valor": 800.00, "tipo": "saida"},
    // {"descricao": "Internet e Energia", "valor": 250.00, "tipo": "saida"},
    
    await storage.createTransaction({
      description: "Venda de Produto A",
      amount: 150000,
      type: "income",
    });
    
    await storage.createTransaction({
      description: "Venda de Serviço B",
      amount: 200000,
      type: "income",
    });

    await storage.createTransaction({
      description: "Aluguel Escritório",
      amount: 80000,
      type: "expense",
    });

    await storage.createTransaction({
      description: "Internet e Energia",
      amount: 25000,
      type: "expense",
    });
  }
}
