import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogScrollArea, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UsersRound } from "lucide-react";
import { STORE_OPTIONS, getStoreLabel } from "@shared/schema";
import { getRoleLabel } from "@shared/models/auth";

interface ManagedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  store: string | null;
  emailVerified: boolean;
}

export function UserManagementDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: allUsers = [], isLoading } = useQuery<ManagedUser[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  async function updateUserRole(userId: string, role: string, store: string | null) {
    try {
      const res = await fetch("/api/user/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role, store }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Usuario atualizado", description: "Cargo e unidade salvos." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2" data-testid="button-open-user-management">
          <UsersRound className="h-4 w-4" />
          Gerenciar Usuarios
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Usuarios e Acessos</DialogTitle>
        </DialogHeader>
        <DialogScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando...</div>
          ) : allUsers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Nenhum usuario encontrado.</div>
          ) : (
            <div className="space-y-1.5 pb-4">
              {allUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-2 p-2 rounded-md border border-border/50"
                  data-testid={`user-row-${u.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate" data-testid={`text-user-name-${u.id}`}>
                        {u.firstName || ""} {u.lastName || ""}
                      </p>
                      {!u.emailVerified && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 shrink-0">N/V</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <Select
                    value={u.role}
                    onValueChange={(newRole) => {
                      const newStore = newRole === "master" ? null : u.store;
                      updateUserRole(u.id, newRole, newStore);
                    }}
                  >
                    <SelectTrigger className="w-[120px] shrink-0" data-testid={`select-role-${u.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="master">Master</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="operador">Operador</SelectItem>
                    </SelectContent>
                  </Select>
                  {u.role !== "master" ? (
                    <Select
                      value={u.store || "none"}
                      onValueChange={(newStore) => {
                        updateUserRole(u.id, u.role, newStore === "none" ? null : newStore);
                      }}
                    >
                      <SelectTrigger className="w-[150px] shrink-0" data-testid={`select-store-${u.id}`}>
                        <SelectValue placeholder="Unidade..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem unidade</SelectItem>
                        {STORE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="w-[150px] shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogScrollArea>
      </DialogContent>
    </Dialog>
  );
}
