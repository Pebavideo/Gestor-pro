import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKeyRaw) {
    // Desenvolvimento local: credenciais explicitas da service account
    // (.env, veja .env.example). Chaves privadas em .env vem com "\n"
    // literal (escapado) - precisa virar quebra de linha real.
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey: privateKeyRaw.replace(/\\n/g, "\n") }),
      storageBucket,
    });
  }

  // Rodando dentro do proprio Google Cloud (Cloud Functions/Cloud Run do
  // mesmo projeto Firebase): usa as credenciais padrao do ambiente
  // (Application Default Credentials via a service account anexada),
  // sem precisar de nenhuma chave explicita.
  return initializeApp({ storageBucket });
}

const app = getAdminApp();

export const db: Firestore = getFirestore(app);
export const adminAuth: Auth = getAuth(app);
export const bucket = getStorage(app).bucket();
