import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut } from "firebase/auth";
import { auth, authReady } from "@/lib/firebase";

interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  store: string | null;
  cnpjCpf: string | null;
  companyName: string | null;
  emailVerified: boolean;
  profileImageUrl: string | null;
}

async function fetchUser(): Promise<AuthUser | null> {
  // Espera o Firebase terminar de restaurar a sessao do IndexedDB antes de
  // perguntar pro servidor quem esta logado - senao a primeira checagem
  // sai sem token e o app conclui erroneamente que ninguem esta logado.
  await authReady;
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

interface RoleData {
  role: string;
  store: string | null;
}

async function fetchRole(): Promise<RoleData> {
  const response = await fetch("/api/user/role", {
    credentials: "include",
  });

  if (!response.ok) {
    // Deixa o react-query registrar isso como erro (data fica undefined) em
    // vez de fingir que o usuario e "operador" - o fallback pro role real
    // do useAuth (abaixo) ja cobre esse caso sem precisar inventar um valor.
    throw new Error("Falha ao buscar cargo do usuario.");
  }

  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const { data: roleData } = useQuery<RoleData>({
    queryKey: ["/api/user/role"],
    queryFn: fetchRole,
    enabled: !!user && user.emailVerified,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Best-effort: revoga o refresh token no servidor antes de encerrar a
      // sessao localmente (a fonte da verdade do login e o Firebase Auth).
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      await signOut(auth);
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.removeQueries({ queryKey: ["/api/user/role"] });
    },
  });

  const role = roleData?.role || user?.role || "operador";
  const userStore = roleData?.store || user?.store || null;

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isVerified: !!user?.emailVerified,
    role,
    userStore,
    isMaster: role === "master",
    isGerente: role === "gerente",
    isOperador: role === "operador",
    isAdmin: role === "master",
    canManage: role === "master" || role === "gerente",
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
