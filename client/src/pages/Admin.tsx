import { useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";
import { usersCol } from "@/lib/firestore-collections";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Users, UserCheck, UserX, CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getRoleLabel } from "@shared/models/auth";
import type { User } from "@shared/models/auth";

function formatDate(d: Date | null): string {
  if (!d) return "-";
  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export default function Admin() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const q = query(usersCol(), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setError(false);
        setUsers(snap.docs.map((d) => d.data()));
      },
      () => setError(true),
    );
    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    const list = users || [];
    const now = new Date();
    const activeCount = list.filter((u) => u.active !== 0).length;
    const inactiveCount = list.length - activeCount;
    const thisMonthCount = list.filter(
      (u) => u.createdAt && u.createdAt.getFullYear() === now.getFullYear() && u.createdAt.getMonth() === now.getMonth(),
    ).length;
    return { total: list.length, activeCount, inactiveCount, thisMonthCount };
  }, [users]);

  const isLoading = users === null && !error;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-admin-title">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Painel do Super Admin
          </h2>
          <p className="text-muted-foreground mt-1">Visao geral de todos os lojistas cadastrados no sistema.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Lojistas</p>
              <p className="text-2xl font-bold" data-testid="text-admin-total">{isLoading ? "..." : stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <UserCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contas Ativas</p>
              <p className="text-2xl font-bold" data-testid="text-admin-active">{isLoading ? "..." : stats.activeCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10">
              <UserX className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contas Inativas</p>
              <p className="text-2xl font-bold" data-testid="text-admin-inactive">{isLoading ? "..." : stats.inactiveCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <CalendarPlus className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cadastros no Mes</p>
              <p className="text-2xl font-bold" data-testid="text-admin-month">{isLoading ? "..." : stats.thisMonthCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-4 p-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-full bg-muted/50 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <UserX className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Nao foi possivel carregar os lojistas</h3>
          <p className="max-w-xs mx-auto mt-2">Verifique sua conexao e tente novamente.</p>
        </div>
      ) : (
        <>
          <div className="hidden sm:block rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="pl-6">Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead>Ultimo Acesso</TableHead>
                  <TableHead className="text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users || []).map((u) => (
                  <TableRow key={u.id} className="hover:bg-muted/30 border-border/50 transition-colors" data-testid={`row-lojista-${u.id}`}>
                    <TableCell className="pl-6 font-medium" data-testid={`text-lojista-name-${u.id}`}>
                      {u.firstName || ""} {u.lastName || ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm" data-testid={`text-lojista-email-${u.id}`}>
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{getRoleLabel(u.role)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm" data-testid={`text-lojista-created-${u.id}`}>
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm" data-testid={`text-lojista-lastaccess-${u.id}`}>
                      {formatDate(u.lastAccessAt)}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Badge
                        variant="secondary"
                        className={
                          u.active !== 0
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                        }
                        data-testid={`badge-lojista-status-${u.id}`}
                      >
                        {u.active !== 0 ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="sm:hidden space-y-3">
            {(users || []).map((u) => (
              <Card key={u.id} className="p-4" data-testid={`card-lojista-${u.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate" data-testid={`text-lojista-name-${u.id}`}>
                      {u.firstName || ""} {u.lastName || ""}
                    </p>
                    <p className="text-xs text-muted-foreground truncate" data-testid={`text-lojista-email-${u.id}`}>{u.email}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      u.active !== 0
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 shrink-0"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 shrink-0"
                    }
                    data-testid={`badge-lojista-status-${u.id}`}
                  >
                    {u.active !== 0 ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="mt-3 pt-3 border-t border-border/50 space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Cargo</span>
                    <Badge variant="secondary" className="text-xs">{getRoleLabel(u.role)}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Cadastro</span>
                    <span data-testid={`text-lojista-created-${u.id}`}>{formatDate(u.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Ultimo acesso</span>
                    <span data-testid={`text-lojista-lastaccess-${u.id}`}>{formatDate(u.lastAccessAt)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
