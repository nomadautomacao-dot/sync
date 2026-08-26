import { getApps, getApp, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

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
export const getFirebaseStorage = (): FirebaseStorage => getStorage(app());

let firestore: Firestore | null = null;

/**
 * O Firestore com cache que sobrevive a fechar o app.
 *
 * Era `getFirestore()` puro, que guarda tudo em memória: fechou a janela,
 * perdeu. Isso não é hipótese neste produto — a consultora abre o app dentro de
 * uma prefeitura, digita o relatório da reunião ali mesmo e o sinal é ruim. A
 * escrita ficava na fila da memória e ia embora com o processo, sem aviso. Um
 * relatório perdido assim não gera reclamação: gera alguém que nunca mais
 * confia no app.
 *
 * Com cache persistente a escrita vai para o IndexedDB primeiro e sobe quando
 * houver rede, ainda que dias depois.
 *
 * Duas armadilhas contornadas aqui:
 *
 * 1. **Não há IndexedDB no servidor.** O mesmo módulo é importado em Server
 *    Components, e `persistentLocalCache` ali quebraria a renderização.
 * 2. **`initializeFirestore` só pode ser chamada uma vez por app**, e estoura
 *    se já houver instância — o que acontece a cada recarga do HMR em
 *    desenvolvimento. A queda para `getFirestore()` é esse caso, não erro.
 */
export const getFirebaseDb = (): Firestore => {
  if (firestore) return firestore;

  if (typeof window === "undefined") {
    firestore = getFirestore(app());
    return firestore;
  }

  try {
    firestore = initializeFirestore(app(), {
      // Multi-aba: o navegador abre várias, e sem coordenação só a primeira
      // ganharia cache.
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    firestore = getFirestore(app());
  }

  return firestore;
};
