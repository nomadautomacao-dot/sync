"use client";

import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { clientUserFromClaims, type ClientUser } from "@/core/lib/client-session";
import { getFirebaseAuth } from "@/core/lib/firebase-client";

interface AuthCtx {
  user: ClientUser | null;
  loading: boolean;
  signIn: (email: string, password: string, manterConectado?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  /** Dispara o e-mail de redefinição. Silencioso sobre a conta existir ou não. */
  sendPasswordReset: (email: string) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/** Sessão do cliente: espelha o estado do Firebase Auth em um ClientUser. */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);

  // onAuthStateChanged devolve o unsubscribe; o effect o retorna direto para
  // que o React desinscreva na desmontagem. Nada de async aqui — uma função
  // async devolveria uma Promise e o cleanup se perderia em silêncio.
  useEffect(
    () =>
      onAuthStateChanged(getFirebaseAuth(), async (fbUser) => {
        if (!fbUser) {
          setUser(null);
          setLoading(false);
          return;
        }
        // `true` força o refresh do token para trazer claims recém-atribuídas.
        const { claims } = await fbUser.getIdTokenResult(true);
        const mapped = clientUserFromClaims(claims, { uid: fbUser.uid, email: fbUser.email });
        setUser(mapped);
        setLoading(false);
        // Mesma regra do signIn, aplicada também às sessões que chegam prontas
        // (claim revogada, login em outra aba): sem groupId não há acesso, então
        // não se deixa a sessão do Firebase viva por baixo de um app deslogado.
        // Converge: o signOut dispara este callback de novo com fbUser === null,
        // que cai no ramo acima — e aquele ramo nunca desloga, então para ali.
        // O estado já foi zerado antes do await, logo nem uma falha de rede no
        // signOut deixa `loading` pendurado.
        if (!mapped) await fbSignOut(getFirebaseAuth());
      }),
    [],
  );

  const signIn = async (email: string, password: string, manterConectado = false) => {
    const auth = getFirebaseAuth();
    // Antes do login, sempre: a persistência escolhida decide onde o Firebase
    // grava a sessão, e trocá-la depois não move a que já foi gravada.
    // `SESSION` morre com a aba — o padrão certo para um notebook levado a uma
    // prefeitura. `LOCAL` é a escolha explícita de quem está na própria máquina.
    await setPersistence(auth, manterConectado ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const { claims } = await cred.user.getIdTokenResult(true);
    // Sem groupId não há acesso: desloga em vez de deixar uma sessão inútil de pé.
    if (!claims.groupId) {
      await fbSignOut(auth);
      throw new Error("Sua conta ainda não tem acesso configurado. Contate um administrador.");
    }
  };

  const signOut = () => fbSignOut(getFirebaseAuth());

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
    } catch (erro) {
      // `user-not-found` não sobe: confirmar quais e-mails têm conta numa tela
      // pública é enumeração de usuários. Quem chamou responde igual nos dois
      // casos. Qualquer outra falha (rede, e-mail malformado, cota) é real e
      // precisa chegar à tela.
      const codigo =
        typeof erro === "object" && erro !== null && "code" in erro ? erro.code : "";
      if (codigo !== "auth/user-not-found") throw erro;
    }
  };

  return (
    <Ctx.Provider value={{ user, loading, signIn, signOut, sendPasswordReset }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fora de AuthProvider");
  return ctx;
}
