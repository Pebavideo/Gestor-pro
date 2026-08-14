import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { usersCol } from "@/lib/firestore-collections";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogScrollArea, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UsersRound } from "lucide-react";
import { STORE_OPTIONS, getStoreLabel } from "@shared/schema";
import type { User } from "@shared/models/auth";

export function UserManagementDialog() {
  const { toast } = useToast();
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: allUsers = [], isLoading } = useQuery<User[]>({
    queryKey: ["users-list"],
    queryFn: async () => {
      const q = query(usersCol(), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data());
    },
    enabled: open,
  });

  async function updateUserRole(userId: string, role: string, store: string | null) {
    try {
      await updateDoc(doc(db, "users", userId), { role, store, updatedAt: new Date() });
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
      if (userId === me?.id) {
        queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      }
      toast({ title: "Usuario atualizado", description: "Cargo e unidade salvos." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao atualizar usuario", variant: "destructive" });
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Usuarios e Acessos</DialogTitle>
        </DialogHeader>
        <DialogScrollArea className="max-h-[60dvh]">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando...</div>
          ) : allUsers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Nenhum usuario encontrado.</div>
          ) : (
            <div className="space-y-1.5 pb-4">
              {allUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-md border border-border/50"
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
                  <div className="flex items-center gap-2">
                    <Select
                      value={u.role}
                      onValueChange={(newRole) => {
                        const newStore = newRole === "master" ? null : u.store;
                        updateUserRole(u.id, newRole, newStore);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[120px] shrink-0" data-testid={`select-role-${u.id}`}>
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
                        <SelectTrigger className="w-full sm:w-[150px] shrink-0" data-testid={`select-store-${u.id}`}>
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
                      <div className="hidden sm:block w-[150px] shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogScrollArea>
      </DialogContent>
    </Dialog>
  );
}
