// Script de uso unico, rodado LOCALMENTE (nunca em producao/deploy) com as
// credenciais do Admin SDK do .env local. Promove um usuario ja logado ao
// menos uma vez (Google Sign-In ja criou o perfil dele no Firestore) para
// "master". Sem servidor confiavel em producao, essa e a forma segura de
// bootstrapar o primeiro administrador - regras do Firestore nao conseguem
// fazer essa verificacao sozinhas.
//
// Uso: npm run promote-to-master -- seuemail@gmail.com
import "dotenv/config";
import { adminAuth, db } from "../server/firebase";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Uso: npm run promote-to-master -- seuemail@gmail.com");
    process.exit(1);
  }

  const userRecord = await adminAuth.getUserByEmail(email).catch(() => null);
  if (!userRecord) {
    console.error(`Nenhum usuario do Firebase Auth encontrado com o e-mail "${email}".`);
    console.error("Faca login pelo menos uma vez no app com essa conta antes de rodar este script.");
    process.exit(1);
  }

  const ref = db.collection("users").doc(userRecord.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`O usuario "${email}" ainda nao tem perfil no Firestore. Faca login no app primeiro.`);
    process.exit(1);
  }

  await ref.update({ role: "master", updatedAt: new Date() });
  console.log(`OK: ${email} agora e master.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
