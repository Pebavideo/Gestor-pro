import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactions, useDeleteTransaction, formatCurrency } from "@/hooks/use-transactions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, ArrowUpRight, ArrowDownRight, Inbox } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function TransactionTable() {
  const { data: transactions, isLoading } = useTransactions();
  const { mutate: deleteTx, isPending: isDeleting } = useDeleteTransaction();

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
        <h3 className="text-lg font-semibold text-foreground">Nenhuma transação encontrada</h3>
        <p className="max-w-xs mx-auto mt-2">Comece adicionando suas vendas e despesas para ver o fluxo de caixa.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-[40%] pl-6">Descrição</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id} className="group hover:bg-muted/30 border-border/50 transition-colors">
              <TableCell className="font-medium pl-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {tx.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <span className="font-display font-medium text-base">{tx.description}</span>
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
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                      : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}
                  `}
                >
                  {tx.type === 'income' ? 'Entrada' : 'Saída'}
                </Badge>
              </TableCell>
              <TableCell className={`text-right font-mono font-medium ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount / 100)}
              </TableCell>
              <TableCell className="text-right pr-6">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. O registro será removido permanentemente dos cálculos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => deleteTx(tx.id)}
                        disabled={isDeleting}
                        className="bg-destructive hover:bg-destructive/90 rounded-xl"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
