import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, writeBatch, runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { transactionsCol, productsCol } from "@/lib/firestore-collections";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { insertTransactionSchema, insertSettingsSchema } from "@shared/schema";
import type { InsertTransaction, InsertSettings, Transaction, Settings } from "@shared/schema";

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);

function friendlyError(err: unknown, permissionMessage: string): string {
  const code = (err as { code?: string })?.code;
  if (code === "permission-denied") return permissionMessage;
  return (err as { message?: string })?.message || "Ocorreu um erro. Tente novamente.";
}

interface Ctx {
  userId: string;
  role: string;
  store: string | null;
}

function useCtx(): Ctx | null {
  const { user, role, userStore } = useAuth();
  if (!user) return null;
  return { userId: user.id, role, store: userStore };
}

export function useTransactions() {
  const ctx = useCtx();
  return useQuery<Transaction[]>({
    queryKey: ["transactions", ctx?.userId, ctx?.role, ctx?.store],
    queryFn: async () => {
      if (!ctx) return [];
      const clauses = [where("userId", "==", ctx.userId)];
      if (ctx.role !== "master") {
        clauses.push(where("store", "==", ctx.store || "__none__"));
      }
      const q = query(transactionsCol(), ...clauses, orderBy("date", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data());
    },
    enabled: !!ctx,
  });
}

export function useCreateTransaction() {
  const ctx = useCtx();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: InsertTransaction & { productId?: string; productQty?: number }) => {
      if (!ctx) throw new Error("Nao autenticado.");
      const { productId, productQty, ...rest } = payload as any;
      const parsed = insertTransactionSchema.parse(rest);

      if (productId && parsed.type === "income") {
        const qty = productQty && productQty > 0 ? productQty : 1;
        await runTransaction(db, async (tx) => {
          const prodRef = doc(db, "products", String(productId));
          const prodSnap = await tx.get(prodRef);
          if (!prodSnap.exists()) throw new Error("Produto nao encontrado.");
          const prod = prodSnap.data();
          const currentQty = Number.isFinite(prod.quantity) ? prod.quantity : 0;
          if (currentQty < qty) throw new Error("Estoque insuficiente ou produto nao encontrado.");
          tx.update(prodRef, { quantity: currentQty - qty });
        });
      }

      const storeVal = ctx.role !== "master" && ctx.store ? ctx.store : parsed.store;
      const base = {
        description: parsed.description,
        amount: parsed.amount,
        type: parsed.type,
        category: parsed.category ?? null,
        store: storeVal || null,
        status: parsed.status,
        dueDate: parsed.dueDate ?? null,
        paymentDate: parsed.paymentDate ?? null,
        isRecurring: parsed.isRecurring,
        recurrenceFrequency: parsed.recurrenceFrequency ?? null,
        recurrenceCount: parsed.recurrenceCount ?? null,
        recurrenceGroupId: parsed.recurrenceGroupId ?? null,
        date: parsed.date ?? new Date(),
        userId: ctx.userId,
        reconciled: 0,
      };

      if (parsed.isRecurring === 1 && parsed.recurrenceFrequency && (parsed.recurrenceCount || 0) > 1) {
        const count = parsed.recurrenceCount!;
        const groupId = crypto.randomUUID();
        const baseDueDate = parsed.dueDate ? new Date(parsed.dueDate) : new Date();
        const batch = writeBatch(db);
        let first: Transaction | null = null;

        for (let i = 0; i < count; i++) {
          const dueDate = new Date(baseDueDate);
          if (parsed.recurrenceFrequency === "mensal") dueDate.setMonth(dueDate.getMonth() + i);
          else if (parsed.recurrenceFrequency === "quinzenal") dueDate.setDate(dueDate.getDate() + i * 15);

          const rowData = {
            ...base,
            dueDate,
            date: i === 0 ? (parsed.date || new Date()) : dueDate,
            status: i === 0 ? (parsed.status || "pendente") : "pendente",
            paymentDate: i === 0 ? base.paymentDate : null,
            isRecurring: 1,
            recurrenceFrequency: parsed.recurrenceFrequency,
            recurrenceCount: count,
            recurrenceGroupId: groupId,
            description: `${parsed.description} (${i + 1}/${count})`,
          };
          const ref = doc(collection(db, "transactions"));
          batch.set(ref, rowData);
          if (i === 0) first = { id: ref.id, ...rowData } as unknown as Transaction;
        }
        await batch.commit();
        return first!;
      }

      const ref = doc(collection(db, "transactions"));
      await setDoc(ref, base);
      return { id: ref.id, ...base } as unknown as Transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Transacao registrada", description: "A movimentacao foi salva com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertTransaction> }) => {
      try {
        await updateDoc(doc(db, "transactions", id), data as Record<string, any>);
      } catch (err) {
        throw new Error(friendlyError(err, "Apenas administradores podem editar transacoes."));
      }
      const snap = await getDoc(doc(transactionsCol(), id));
      return snap.data();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: "Transacao atualizada", description: "Os dados foram salvos com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await deleteDoc(doc(db, "transactions", id));
      } catch (err) {
        throw new Error(friendlyError(err, "Apenas administradores podem excluir transacoes."));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: "Transacao removida", description: "O registro foi excluido permanentemente." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });
}

export function useToggleReconciled() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const ref = doc(transactionsCol(), id);
      const existing = await getDoc(ref);
      const newVal = existing.data()?.reconciled === 1 ? 0 : 1;
      try {
        await updateDoc(doc(db, "transactions", id), { reconciled: newVal });
      } catch (err) {
        throw new Error(friendlyError(err, "Apenas administradores podem conciliar transacoes."));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });
}

export function useMarkAsPaid() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, paymentDate }: { id: string; paymentDate?: string }) => {
      try {
        await updateDoc(doc(db, "transactions", id), {
          status: "pago",
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        });
      } catch (err) {
        throw new Error(friendlyError(err, "Apenas administradores podem liquidar transacoes."));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: "Transacao liquidada", description: "Status atualizado para Pago/Recebido." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });
}

export function useImportCSV() {
  const ctx = useCtx();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rows: { description: string; amount_cents: number; type: string; date: string; category?: string }[]) => {
      if (!ctx) throw new Error("Nao autenticado.");
      let count = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const batch = writeBatch(db);
        for (const row of chunk) {
          const ref = doc(collection(db, "transactions"));
          const dateVal = new Date(row.date);
          batch.set(ref, {
            description: row.description,
            amount: Math.abs(Math.round(row.amount_cents)),
            type: row.type,
            category: row.category || null,
            store: ctx.role !== "master" && ctx.store ? ctx.store : null,
            userId: ctx.userId,
            date: isNaN(dateVal.getTime()) ? new Date() : dateVal,
            status: "pago",
            paymentDate: isNaN(dateVal.getTime()) ? new Date() : dateVal,
            dueDate: null,
            isRecurring: 0,
            recurrenceFrequency: null,
            recurrenceCount: null,
            recurrenceGroupId: null,
            reconciled: 0,
          });
          count++;
        }
        await batch.commit();
      }
      return { message: `${count} transacao(es) importada(s) com sucesso.`, count };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: "Importacao concluida", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Erro na importacao", description: error.message, variant: "destructive" });
    },
  });
}

export function useSettings() {
  const ctx = useCtx();
  return useQuery<Settings>({
    queryKey: ["settings", ctx?.userId],
    queryFn: async () => {
      if (!ctx) throw new Error("Nao autenticado.");
      const ref = doc(db, "settings", ctx.userId);
      let snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { userId: ctx.userId, taxRate: "15" });
        snap = await getDoc(ref);
      }
      const data = snap.data()!;
      return { id: ctx.userId, userId: data.userId ?? ctx.userId, taxRate: data.taxRate ?? "15" };
    },
    enabled: !!ctx,
  });
}

export function useUpdateSettings() {
  const ctx = useCtx();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertSettings) => {
      if (!ctx) throw new Error("Nao autenticado.");
      const validated = insertSettingsSchema.parse(data);
      try {
        await setDoc(doc(db, "settings", ctx.userId), { userId: ctx.userId, taxRate: validated.taxRate }, { merge: true });
      } catch (err) {
        throw new Error(friendlyError(err, "Apenas administradores podem alterar configuracoes."));
      }
      return { id: ctx.userId, userId: ctx.userId, taxRate: validated.taxRate };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({
        title: "Configuracoes atualizadas",
        description: "A nova aliquota de imposto foi aplicada.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
