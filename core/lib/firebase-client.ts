import { getApps, getApp, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

export function firebaseClientConfig(): FirebaseOptions {
  const env = (k: string): string => {
    const v = process.env[k];
    if (!v) throw new Error(`${k} não definida. Preencha em .env.local.`);
    return v;
  };
  return {
    apiKey: env("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: env("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: env("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: env("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: env("NEXT_PUBLIC_FIREBASE_APP_ID"),
  };
}

const app = () => (getApps().length ? getApp() : initializeApp(firebaseClientConfig()));
export const getFirebaseAuth = (): Auth => getAuth(app());
export const getFirebaseDb = (): Firestore => getFirestore(app());
