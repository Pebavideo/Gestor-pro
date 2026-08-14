import { initializeApp, getApps } from "firebase/app";
import { getAuth, onIdTokenChanged, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
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

// Sem servidor (plano Spark): o client fala direto com o Firestore/Storage,
// autorizacao garantida pelas regras de seguranca (firestore.rules /
// storage.rules), nao mais por um backend confiavel.
export const db = getFirestore(app);
export const storage = getStorage(app);

// Provider de "Entrar com Google" - forca a tela de selecao de conta
// sempre (mesmo que so haja uma conta logada no navegador), para o
// usuario nunca ficar preso na ultima conta usada.
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Promise que resolve assim que o Firebase termina de restaurar (ou nao) a
// sessao persistida no IndexedDB. No primeiro load da pagina,
// auth.currentUser comeca como null mesmo com uma sessao valida - sem
// esperar isso, a primeira leitura do perfil sairia sem usuario e o app
// deduziria "deslogado" antes do Firebase terminar de restaurar a sessao.
export const authReady = auth.authStateReady();

// Sempre que o token mudar (login, logout, refresh automatico, ou a
// restauracao inicial da sessao), busca de novo os dados de auth - assim o
// app nunca fica "preso" mostrando o estado de antes da mudanca.
onIdTokenChanged(auth, () => {
  queryClient.invalidateQueries({ queryKey: ["auth-user"] });
});
