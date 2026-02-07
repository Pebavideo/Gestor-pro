import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactions, useDeleteTransaction, formatCurrency } from "@/hooks/use-transactions";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, ArrowUpRight, ArrowDownRight, Inbox } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function TransactionTable() {
  const { data: transactions, isLoading } = useTransactions();
  const { mutate: deleteTx, isPending: isDeleting } = useDeleteTransaction();
  const { isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="space-y-4 p-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 w-full bg-muted/50 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Inbox className="w-8 h-8 opacity-50" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Nenhuma transacao encontrada</h3>
        <p className="max-w-xs mx-auto mt-2">Comece adicionando suas vendas e despesas para ver o fluxo de caixa.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-[40%] pl-6">Descricao</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            {isAdmin && <TableHead className="w-[50px]"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id} className="group hover:bg-muted/30 border-border/50 transition-colors" data-testid={`row-transaction-${tx.id}`}>
              <TableCell className="font-medium pl-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10'}`}>
                    {tx.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <span className="font-medium text-base" data-testid={`text-description-${tx.id}`}>{tx.description}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-sm">
                {format(new Date(tx.date), "dd MMM yyyy", { locale: ptBR })}
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
              {isAdmin && (
                <TableCell className="text-right pr-6">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
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
                          className="bg-destructive hover:bg-destructive/90 rounded-xl"
                          data-testid={`button-confirm-delete-${tx.id}`}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
