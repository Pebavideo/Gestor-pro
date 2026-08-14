import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, authReady, db } from "@/lib/firebase";
import { usersCol } from "@/lib/firestore-collections";
import type { User } from "@shared/models/auth";

async function fetchUser(): Promise<User | null> {
  // Espera o Firebase terminar de restaurar a sessao do IndexedDB antes de
  // ler o perfil - senao a primeira checagem apos reload achataria que
  // ninguem esta logado.
  await authReady;
  const fbUser = auth.currentUser;
  if (!fbUser) return null;

  const ref = doc(usersCol(), fbUser.uid);
  let snap = await getDoc(ref);

  if (!snap.exists()) {
    // Primeiro login (sempre via Google Sign-In) - ainda nao existe
    // perfil no Firestore, provisiona agora com os dados que o Google ja
    // verificou (e-mail, nome, foto).
    const fullName = (fbUser.displayName || "").trim();
    const [firstName, ...rest] = fullName ? fullName.split(/\s+/) : [null];
    await setDoc(doc(db, "users", fbUser.uid), {
      email: fbUser.email || "",
      firstName: firstName || null,
      lastName: rest.length ? rest.join(" ") : null,
      profileImageUrl: fbUser.photoURL || null,
      emailVerified: true,
      role: "operador",
      store: null,
      cnpjCpf: null,
      companyName: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    snap = await getDoc(ref);
  }

  return snap.data() ?? null;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["auth-user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await signOut(auth);
    },
    onSuccess: () => {
      queryClient.setQueryData(["auth-user"], null);
    },
  });

  const role = user?.role || "operador";
  const userStore = user?.store || null;

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
