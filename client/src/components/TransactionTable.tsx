import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactions, useDeleteTransaction, useUpdateTransaction, useToggleReconciled, useMarkAsPaid, formatCurrency } from "@/hooks/use-transactions";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput, parseBRL, centsToFormatted } from "@/components/CurrencyInput";
import { Trash2, ArrowUpRight, ArrowDownRight, Inbox, Pencil, Share2, CheckCircle2, Circle, DollarSign, AlertTriangle, Clock } from "lucide-react";
import { generateWhatsAppMessage, openWhatsApp } from "@/lib/pdf-generator";
import { STORE_OPTIONS, getStoreLabel } from "@/components/CreateTransactionDialog";
import { CATEGORY_OPTIONS, getCategoryLabel, getStatusLabel } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import type { Transaction } from "@shared/schema";

function getTrafficLightClass(tx: Transaction): { bg: string; border: string; label: string } {
  if (tx.status === "pago") {
    return { bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-l-emerald-500", label: "paid" };
  }
  if (tx.status === "pendente" && tx.dueDate) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(tx.dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { bg: "bg-red-50 dark:bg-red-500/10", border: "border-l-red-500", label: "overdue" };
    }
    if (diffDays <= 3) {
      return { bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-l-orange-500", label: "due_soon" };
    }
  }
  return { bg: "", border: "border-l-transparent", label: "pending" };
}

function StatusBadge({ tx }: { tx: Transaction }) {
  const light = getTrafficLightClass(tx);
  if (tx.status === "pago") {
    return (
      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] px-1.5 py-0">
        Pago
      </Badge>
    );
  }
  if (light.label === "overdue") {
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 text-[10px] px-1.5 py-0">
        Vencida
      </Badge>
    );
  }
  if (light.label === "due_soon") {
    return (
      <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 text-[10px] px-1.5 py-0">
        Vence em breve
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400 text-[10px] px-1.5 py-0">
      Pendente
    </Badge>
  );
}

export function TransactionTable({ monthFilter }: { monthFilter?: { year: number; month: number | null } | null }) {
  const { data: transactions, isLoading } = useTransactions();
  const { mutate: deleteTx, isPending: isDeleting } = useDeleteTransaction();
  const updateMutation = useUpdateTransaction();
  const reconcileMutation = useToggleReconciled();
  const markPaidMutation = useMarkAsPaid();
  const { isAdmin } = useAuth();

  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editStore, setEditStore] = useState("none");
  const [editCategory, setEditCategory] = useState("none");
  const [editStatus, setEditStatus] = useState("pago");
  const [editDueDate, setEditDueDate] = useState("");

  const openEdit = (tx: Transaction) => {
    setEditTx(tx);
    setEditDescription(tx.description);
    setEditAmount(centsToFormatted(tx.amount));
    setEditStore(tx.store || "none");
    setEditCategory(tx.category || "none");
    setEditStatus(tx.status || "pago");
    setEditDueDate(tx.dueDate ? format(new Date(tx.dueDate), "yyyy-MM-dd") : "");
  };

  const submitEdit = () => {
    if (!editTx) return;
    const amountCents = Math.round(parseBRL(editAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;
    const storeVal = editStore && editStore !== "none" ? editStore : null;
    const categoryVal = editCategory && editCategory !== "none" ? editCategory : null;
    const data: any = { description: editDescription, amount: amountCents, store: storeVal, category: categoryVal, status: editStatus };
    if (editStatus === "pendente" && editDueDate) {
      data.dueDate = editDueDate;
    }
    updateMutation.mutate(
      { id: editTx.id, data },
      { onSuccess: () => setEditTx(null) }
    );
  };

  const filtered = transactions
    ? monthFilter
      ? transactions.filter((tx) => {
          const d = new Date(tx.date);
          if (d.getFullYear() !== monthFilter.year) return false;
          if (monthFilter.month !== null && d.getMonth() !== monthFilter.month) return false;
          return true;
        })
      : transactions
    : [];

  if (isLoading) {
    return (
      <div className="space-y-4 p-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 w-full bg-muted/50 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Inbox className="w-8 h-8 opacity-50" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Nenhuma transacao encontrada</h3>
        <p className="max-w-xs mx-auto mt-2">
          {monthFilter
            ? "Nenhuma movimentacao registrada neste periodo."
            : "Comece adicionando suas vendas e despesas para ver o fluxo de caixa."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden sm:block rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="w-[30%] pl-6">Descricao</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Conciliada</TableHead>
              <TableHead className="w-[140px] text-right pr-6">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((tx) => {
              const light = getTrafficLightClass(tx);
              return (
                <TableRow key={tx.id} className={`hover:bg-muted/30 border-border/50 transition-colors border-l-4 ${light.border}`} data-testid={`row-transaction-${tx.id}`}>
                  <TableCell className="font-medium pl-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10'}`}>
                        {tx.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="font-medium text-base" data-testid={`text-description-${tx.id}`}>{tx.description}</span>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {tx.category && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0" data-testid={`badge-category-${tx.id}`}>
                              {getCategoryLabel(tx.category)}
                            </Badge>
                          )}
                          {tx.store && (
                            <span className="text-xs text-muted-foreground" data-testid={`text-store-${tx.id}`}>
                              {getStoreLabel(tx.store)}
                            </span>
                          )}
                          {tx.isRecurring === 1 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                              Recorrente
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    <div>{format(new Date(tx.date), "dd/MM/yyyy", { locale: ptBR })}</div>
                    <div className="text-xs text-muted-foreground/70">{format(new Date(tx.date), "HH:mm")}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tx={tx} />
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {tx.dueDate ? (
                      <span className={light.label === "overdue" ? "text-red-600 font-medium" : light.label === "due_soon" ? "text-orange-600 font-medium" : "text-muted-foreground"}>
                        {format(new Date(tx.dueDate), "dd/MM/yyyy")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-medium ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount / 100)}
                  </TableCell>
                  <TableCell className="text-center">
                    {isAdmin ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => reconcileMutation.mutate(tx.id)}
                        disabled={reconcileMutation.isPending}
                        data-testid={`button-reconcile-${tx.id}`}
                        title={tx.reconciled ? "Marcar como nao conciliada" : "Marcar como conciliada"}
                      >
                        {tx.reconciled ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </Button>
                    ) : (
                      tx.reconciled ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground mx-auto" />
                      )
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-1">
                      {isAdmin && tx.status === "pendente" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => markPaidMutation.mutate({ id: tx.id })}
                          disabled={markPaidMutation.isPending}
                          data-testid={`button-mark-paid-${tx.id}`}
                          title="Marcar como Pago/Recebido"
                        >
                          <DollarSign className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const msg = generateWhatsAppMessage("transaction", {
                            description: tx.description,
                            amount: tx.amount,
                            date: tx.date,
                            txType: tx.type,
                          });
                          openWhatsApp(msg);
                        }}
                        data-testid={`button-share-transaction-${tx.id}`}
                        title="Compartilhar via WhatsApp"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(tx)}
                            data-testid={`button-edit-transaction-${tx.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-delete-${tx.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir transacao?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acao nao pode ser desfeita. O registro sera removido permanentemente dos calculos.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteTx(tx.id)}
                                  disabled={isDeleting}
                                  className="bg-destructive rounded-xl"
                                  data-testid={`button-confirm-delete-${tx.id}`}
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="sm:hidden space-y-3">
        {filtered.map((tx) => {
          const light = getTrafficLightClass(tx);
          return (
            <Card key={tx.id} className={`p-4 border-l-4 ${light.border}`} data-testid={`card-row-transaction-${tx.id}`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10'}`}>
                  {tx.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium text-base truncate" data-testid={`card-text-description-${tx.id}`}>
                      {tx.description}
                      {tx.store && (
                        <span className="ml-1 text-xs text-muted-foreground font-normal">
                          ({getStoreLabel(tx.store)})
                        </span>
                      )}
                    </span>
                    <StatusBadge tx={tx} />
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {tx.category && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0" data-testid={`card-badge-category-${tx.id}`}>
                        {getCategoryLabel(tx.category)}
                      </Badge>
                    )}
                    {tx.isRecurring === 1 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                        Recorrente
                      </Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className={`
                        font-medium px-2.5 py-0.5 rounded-lg border-0 shrink-0
                        ${tx.type === 'income'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}
                      `}
                    >
                      {tx.type === 'income' ? 'Entrada' : 'Saida'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-sm text-muted-foreground font-mono">
                      {format(new Date(tx.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                    {tx.dueDate && (
                      <span className={`text-xs font-mono ${light.label === "overdue" ? "text-red-600 font-medium" : light.label === "due_soon" ? "text-orange-600 font-medium" : "text-muted-foreground"}`}>
                        Venc: {format(new Date(tx.dueDate), "dd/MM/yyyy")}
                      </span>
                    )}
                    {tx.reconciled ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] px-1.5 py-0">
                        Conciliada
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                    <span className={`font-mono font-medium text-base ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount / 100)}
                    </span>
                    <div className="flex items-center gap-1">
                      {isAdmin && tx.status === "pendente" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => markPaidMutation.mutate({ id: tx.id })}
                          disabled={markPaidMutation.isPending}
                          data-testid={`card-button-mark-paid-${tx.id}`}
                          title="Liquidar"
                        >
                          <DollarSign className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => reconcileMutation.mutate(tx.id)}
                          disabled={reconcileMutation.isPending}
                          data-testid={`card-button-reconcile-${tx.id}`}
                          title={tx.reconciled ? "Desmarcar conciliacao" : "Conciliar"}
                        >
                          {tx.reconciled ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const msg = generateWhatsAppMessage("transaction", {
                            description: tx.description,
                            amount: tx.amount,
                            date: tx.date,
                            txType: tx.type,
                          });
                          openWhatsApp(msg);
                        }}
                        data-testid={`card-button-share-transaction-${tx.id}`}
                        title="Compartilhar via WhatsApp"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(tx)}
                            data-testid={`card-button-edit-transaction-${tx.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`card-button-delete-${tx.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir transacao?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acao nao pode ser desfeita. O registro sera removido permanentemente dos calculos.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteTx(tx.id)}
                                  disabled={isDeleting}
                                  className="bg-destructive rounded-xl"
                                  data-testid={`card-button-confirm-delete-${tx.id}`}
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editTx} onOpenChange={(open) => { if (!open) setEditTx(null); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Transacao</DialogTitle>
            <DialogDescription>Altere os dados desta transacao.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-tx-description">Descricao</Label>
              <Input
                id="edit-tx-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                data-testid="input-edit-transaction-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tx-amount">Valor (R$)</Label>
              <CurrencyInput
                id="edit-tx-amount"
                value={editAmount}
                onChange={setEditAmount}
                data-testid="input-edit-transaction-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pago">Pago/Recebido</SelectItem>
                  <SelectItem value="pendente">Pendente/Agendado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editStatus === "pendente" && (
              <div className="space-y-2">
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  data-testid="input-edit-due-date"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger data-testid="select-edit-category">
                  <SelectValue placeholder="Selecionar categoria..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Loja / Origem</Label>
              <Select value={editStore} onValueChange={setEditStore}>
                <SelectTrigger data-testid="select-edit-store">
                  <SelectValue placeholder="Selecionar loja..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {STORE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTx(null)} data-testid="button-cancel-edit-transaction">
              Cancelar
            </Button>
            <Button
              onClick={submitEdit}
              disabled={updateMutation.isPending || !editDescription.trim() || !editAmount}
              data-testid="button-submit-edit-transaction"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
