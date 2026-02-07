import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
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

async function fetchRole(): Promise<string> {
  const response = await fetch("/api/user/role", {
    credentials: "include",
  });

  if (!response.ok) {
    return "operator";
  }

  const data = await response.json();
  return data.role;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const { data: role } = useQuery<string>({
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

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isVerified: !!user?.emailVerified,
    role: role || "operator",
    isAdmin: role === "admin",
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
