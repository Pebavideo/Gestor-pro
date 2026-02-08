import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactions, useDeleteTransaction, useUpdateTransaction, formatCurrency } from "@/hooks/use-transactions";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput, parseBRL, centsToFormatted } from "@/components/CurrencyInput";
import { Trash2, ArrowUpRight, ArrowDownRight, Inbox, Pencil, Share2 } from "lucide-react";
import { generateWhatsAppMessage, openWhatsApp } from "@/lib/pdf-generator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import type { Transaction } from "@shared/schema";

export function TransactionTable({ monthFilter }: { monthFilter?: { year: number; month: number | null } | null }) {
  const { data: transactions, isLoading } = useTransactions();
  const { mutate: deleteTx, isPending: isDeleting } = useDeleteTransaction();
  const updateMutation = useUpdateTransaction();
  const { isAdmin } = useAuth();

  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");

  const openEdit = (tx: Transaction) => {
    setEditTx(tx);
    setEditDescription(tx.description);
    setEditAmount(centsToFormatted(tx.amount));
  };

  const submitEdit = () => {
    if (!editTx) return;
    const amountCents = Math.round(parseBRL(editAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;
    updateMutation.mutate(
      { id: editTx.id, data: { description: editDescription, amount: amountCents } },
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
              <TableHead className="w-[40%] pl-6">Descricao</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-[120px] text-right pr-6">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((tx) => (
              <TableRow key={tx.id} className="hover:bg-muted/30 border-border/50 transition-colors" data-testid={`row-transaction-${tx.id}`}>
                <TableCell className="font-medium pl-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10'}`}>
                      {tx.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    </div>
                    <span className="font-medium text-base" data-testid={`text-description-${tx.id}`}>{tx.description}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-sm">
                  <div>{format(new Date(tx.date), "dd MMM yyyy", { locale: ptBR })}</div>
                  <div className="text-xs text-muted-foreground/70">{format(new Date(tx.date), "HH:mm")}</div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={`
                      font-medium px-2.5 py-0.5 rounded-lg border-0
                      ${tx.type === 'income'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}
                    `}
                  >
                    {tx.type === 'income' ? 'Entrada' : 'Saida'}
                  </Badge>
                </TableCell>
                <TableCell className={`text-right font-mono font-medium ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount / 100)}
                </TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex items-center justify-end gap-1">
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
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="sm:hidden space-y-3">
        {filtered.map((tx) => (
          <Card key={tx.id} className="p-4" data-testid={`card-row-transaction-${tx.id}`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg shrink-0 ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10'}`}>
                {tx.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-medium text-base truncate" data-testid={`card-text-description-${tx.id}`}>{tx.description}</span>
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
                <div className="text-sm text-muted-foreground font-mono mt-1">
                  {format(new Date(tx.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
                <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                  <span className={`font-mono font-medium text-base ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount / 100)}
                  </span>
                  <div className="flex items-center gap-1">
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
        ))}
      </div>

      <Dialog open={!!editTx} onOpenChange={(open) => { if (!open) setEditTx(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Transacao</DialogTitle>
            <DialogDescription>Altere a descricao ou o valor desta transacao.</DialogDescription>
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
