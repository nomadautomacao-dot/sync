/**
 * Concede groupId e groupRole a um usuario do Firebase Auth.
 *
 * Uso: npm run firebase:claims -- <email> <groupId> <groupRole>
 * Ex.: npm run firebase:claims -- maria@globalcompany.com.br grupo-1 owner
 *
 * As claims so entram em vigor no proximo ID token: o cliente precisa chamar
 * getIdToken(true) ou refazer login.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";

const GROUP_ROLES = ["owner", "admin", "member", "viewer"];

function loadEnvFile(file) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // arquivo ausente e aceitavel
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const [email, groupId, groupRole] = process.argv.slice(2);

if (!email || !groupId || !groupRole) {
  console.error("Uso: npm run firebase:claims -- <email> <groupId> <groupRole>");
  process.exit(1);
}

if (!GROUP_ROLES.includes(groupRole)) {
  console.error(`groupRole invalido: ${groupRole}. Use um de: ${GROUP_ROLES.join(", ")}`);
  process.exit(1);
}

const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
if (!raw) {
  console.error("FIREBASE_SERVICE_ACCOUNT nao definida no .env ou .env.local.");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(raw);
} catch {
  console.error("FIREBASE_SERVICE_ACCOUNT nao e um JSON valido. Cole o conteudo inteiro da chave, em uma linha.");
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();

let user;
try {
  user = await auth.getUserByEmail(email);
} catch (err) {
  if (err.code === "auth/user-not-found") {
    console.error(`Usuario ${email} nao existe no Firebase Auth. Crie-o primeiro em Authentication > Users.`);
  } else {
    console.error(`Falha ao consultar o Firebase: ${err.message}`);
  }
  process.exit(1);
}

await auth.setCustomUserClaims(user.uid, { groupId, groupRole });

console.log(`OK: ${email} (${user.uid}) -> groupId=${groupId} groupRole=${groupRole}`);
console.log("O usuario precisa refazer login ou chamar getIdToken(true) para o token novo valer.");
