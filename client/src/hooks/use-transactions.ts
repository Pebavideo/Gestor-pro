import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { InsertTransaction, InsertSettings, Transaction, Settings } from "@shared/schema";

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);

export function useTransactions() {
  return useQuery({
    queryKey: [api.transactions.list.path],
    queryFn: async () => {
      const res = await fetch(api.transactions.list.path, { credentials: "include" });
      // Nao mascara 401 como "sem transacoes" - um 401 aqui geralmente e uma
      // corrida transitoria do token (ver client/src/lib/firebase.ts), e
      // virar [] silenciosamente ficava cacheado como se fosse dado real
      // (staleTime e "para sempre" nas queries de leitura).
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return await res.json() as Transaction[];
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertTransaction) => {
      const validated = api.transactions.create.input.parse(data);
      const res = await fetch(api.transactions.create.path, {
        method: api.transactions.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message);
        }
        if (res.status === 401) throw new Error("Sessao expirada. Faca login novamente.");
        throw new Error("Failed to create transaction");
      }
      return await res.json() as Transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.summary.get.path] });
      toast({
        title: "Transacao registrada",
        description: "A movimentacao foi salva com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertTransaction> }) => {
      const res = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (res.status === 403) throw new Error("Apenas administradores podem editar transacoes.");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao atualizar transacao");
      }
      return await res.json() as Transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.summary.get.path] });
      toast({
        title: "Transacao atualizada",
        description: "Os dados foram salvos com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const url = buildUrl(api.transactions.delete.path, { id });
      const res = await fetch(url, { method: api.transactions.delete.method, credentials: "include" });
      if (res.status === 403) {
        throw new Error("Apenas administradores podem excluir transacoes.");
      }
      if (!res.ok && res.status !== 404) throw new Error("Failed to delete transaction");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.summary.get.path] });
      toast({
        title: "Transacao removida",
        description: "O registro foi excluido permanentemente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useToggleReconciled() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/transactions/${id}/reconcile`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.status === 403) throw new Error("Apenas administradores podem conciliar transacoes.");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao conciliar");
      }
      return await res.json() as Transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });
}

export function useMarkAsPaid() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, paymentDate }: { id: string; paymentDate?: string }) => {
      const res = await fetch(`/api/transactions/${id}/mark-paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentDate }),
        credentials: "include",
      });
      if (res.status === 403) throw new Error("Apenas administradores podem liquidar transacoes.");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao liquidar");
      }
      return await res.json() as Transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.summary.get.path] });
      toast({ title: "Transacao liquidada", description: "Status atualizado para Pago/Recebido." });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });
}

export function useImportCSV() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rows: any[]) => {
      const res = await fetch("/api/transactions/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao importar");
      }
      return await res.json() as { message: string; count: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.summary.get.path] });
      toast({ title: "Importacao concluida", description: data.message });
    },
    onError: (error) => {
      toast({ title: "Erro na importacao", description: error.message, variant: "destructive" });
    },
  });
}

export function useSummary() {
  return useQuery({
    queryKey: [api.summary.get.path],
    queryFn: async () => {
      const res = await fetch(api.summary.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return api.summary.get.responses[200].parse(await res.json());
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: [api.settings.get.path],
    queryFn: async () => {
      const res = await fetch(api.settings.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch settings");
      return await res.json() as Settings;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertSettings) => {
      const validated = api.settings.update.input.parse(data);
      const res = await fetch(api.settings.update.path, {
        method: api.settings.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (res.status === 403) {
        throw new Error("Apenas administradores podem alterar configuracoes.");
      }
      if (!res.ok) throw new Error("Failed to update settings");
      return await res.json() as Settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.settings.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.summary.get.path] });
      toast({
        title: "Configuracoes atualizadas",
        description: "A nova aliquota de imposto foi aplicada.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
