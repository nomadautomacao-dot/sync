import { getApps, getApp, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Lê cada variável por acesso literal — `process.env.NEXT_PUBLIC_X` escrito por
 * extenso. O Next só substitui essa forma ao montar o bundle do cliente; um
 * acesso por chave dinâmica (`process.env[k]`) não é inlinado e chega vazio no
 * browser, ainda que funcione no Node. Não troque por loop nem por string montada.
 */
export function firebaseClientConfig(): FirebaseOptions {
  return {
    apiKey: obrigatoria("NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: obrigatoria(
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    ),
    projectId: obrigatoria(
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    ),
    storageBucket: obrigatoria(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    ),
    messagingSenderId: obrigatoria(
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ),
    appId: obrigatoria("NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };
}

/** Falha citando o nome da chave — é o que orienta quem for configurar o ambiente. */
function obrigatoria(nome: string, valor: string | undefined): string {
  if (!valor) throw new Error(`${nome} não definida. Preencha em .env.local.`);
  return valor;
}

const app = () => (getApps().length ? getApp() : initializeApp(firebaseClientConfig()));
export const getFirebaseAuth = (): Auth => getAuth(app());
export const getFirebaseDb = (): Firestore => getFirestore(app());
