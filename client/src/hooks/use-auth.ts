import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
    return { role: "operador", store: null };
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
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
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
