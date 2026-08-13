// Usuario armazenado no Firestore (colecao "users", doc id = uid do Firebase Auth).
// Autenticacao (senha, verificacao de e-mail) e responsabilidade do Firebase Auth;
// aqui ficam apenas os dados de perfil/permissao usados pelo app.
export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  emailVerified: boolean;
  role: string;
  store: string | null;
  cnpjCpf: string | null;
  companyName: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type UpsertUser = Partial<User> & { id: string; email: string };

export const ROLE_OPTIONS = [
  { value: "master", label: "Master" },
  { value: "gerente", label: "Gerente" },
  { value: "operador", label: "Operador" },
] as const;

export function getRoleLabel(value: string | null | undefined): string {
  if (!value) return "Operador";
  const found = ROLE_OPTIONS.find((o) => o.value === value);
  return found ? found.label : value;
}
