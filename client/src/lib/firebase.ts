import { initializeApp, getApps } from "firebase/app";
import { getAuth, onIdTokenChanged } from "firebase/auth";

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

// Mantem um token em cache (renovado automaticamente pelo SDK do Firebase)
// so para nao precisar de round-trip assincrono quando nao ha usuario ainda.
onIdTokenChanged(auth, () => {
  // no-op: so garante que o SDK mantenha o token sempre fresco em background.
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
