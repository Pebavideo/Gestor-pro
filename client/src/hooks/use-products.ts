import { useQuery } from "@tanstack/react-query";
import { query, where, orderBy, getDocs } from "firebase/firestore";
import { productsCol } from "@/lib/firestore-collections";
import { useAuth } from "@/hooks/use-auth";
import type { Product } from "@shared/schema";

// Compartilhado entre Products.tsx e CreateTransactionDialog.tsx - mesma
// consulta (userId + ativos + loja), pra nao arriscar duas implementacoes
// do filtro de acesso divergindo entre si.
export function useProducts() {
  const { user, isMaster, userStore } = useAuth();
  return useQuery<Product[]>({
    queryKey: ["products", user?.id, isMaster, userStore],
    queryFn: async () => {
      if (!user) return [];
      const clauses = [where("userId", "==", user.id), where("active", "==", 1)];
      if (!isMaster && userStore) clauses.push(where("store", "==", userStore));
      const q = query(productsCol(), ...clauses, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data());
    },
    enabled: !!user,
  });
}
