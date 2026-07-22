import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

/**
 * Credencial da service account do projeto `globalconsultorias`, em JSON.
 *
 * O Cloud Run roda no projeto `opus-sec`, entao o acesso e cross-project e a
 * credencial precisa ser explicita — nao ha Application Default util aqui.
 */
function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT nao definida. Gere a chave em " +
        "Firebase Console > Configuracoes do projeto > Contas de servico e " +
        "cole o JSON inteiro na variavel.",
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT nao e um JSON valido.");
  }
}

let cached: App | undefined;

export function firebaseApp(): App {
  if (!cached) {
    cached = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount()) });
  }
  return cached;
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}
