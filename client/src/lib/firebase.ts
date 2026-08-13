import { initializeApp, getApps } from "firebase/app";
import { getAuth, onIdTokenChanged, GoogleAuthProvider } from "firebase/auth";
import { queryClient } from "./queryClient";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Provider de "Entrar com Google" - forca a tela de selecao de conta
// sempre (mesmo que so haja uma conta logada no navegador), para o
// usuario nunca ficar preso na ultima conta usada.
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Promise que resolve assim que o Firebase termina de restaurar (ou nao) a
// sessao persistida no IndexedDB. No primeiro load da pagina, auth.currentUser
// comeca como null mesmo com uma sessao valida - sem esperar isso, a
// primeira chamada a /api/auth/user sai sem token, volta 401, e o app
// deduz "deslogado" antes do Firebase terminar de restaurar a sessao real.
export const authReady = auth.authStateReady();

// Sempre que o token mudar (login, logout, refresh automatico, ou a
// restauracao inicial da sessao), busca de novo os dados de auth - assim o
// app nunca fica "preso" mostrando o estado de antes da mudanca.
onIdTokenChanged(auth, () => {
  queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  queryClient.invalidateQueries({ queryKey: ["/api/user/role"] });
});

// Todas as telas/hooks do app usam fetch("/api/...") diretamente (nao passam
// por um wrapper unico). Para nao precisar alterar cada chamada, interceptamos
// o fetch global e anexamos "Authorization: Bearer <idToken>" em toda
// requisicao para a nossa API quando ha um usuario logado.
const originalFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();

  if (url.startsWith("/api")) {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    if (token) {
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return originalFetch(input, { ...init, headers });
    }
  }

  return originalFetch(input, init);
};
