"use client";

import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { clientUserFromClaims, type ClientUser } from "@/core/lib/client-session";
import { getFirebaseAuth } from "@/core/lib/firebase-client";
import { gravarUltimoEmail, lerUltimoEmail } from "@/core/lib/ultimo-email";

/**
 * Claims do token, com a rede como preferência e o cache como rede de proteção.
 *
 * Devolve `null` quando nem o cache serve — token expirado e sem sinal. Quem
 * chama trata isso como "não deu para saber", nunca como "não tem acesso".
 */
async function claimsComQuedaParaCache(
  fbUser: FirebaseUser,
): Promise<Record<string, unknown> | null> {
  try {
    return (await fbUser.getIdTokenResult(true)).claims;
  } catch {
    try {
      return (await fbUser.getIdTokenResult()).claims;
    } catch {
      return null;
    }
  }
}

interface AuthCtx {
  user: ClientUser | null;
  loading: boolean;
  /**
   * `manterConectado` é o padrão (`true`): quem entrou uma vez não digita a
   * senha de novo. Passar `false` é a exceção — máquina emprestada.
   */
  signIn: (email: string, password: string, manterConectado?: boolean) => Promise<void>;
  /** Entrar com a conta Google. Autoriza quem já tem `groupId`, e mais ninguém. */
  signInWithGoogle: (manterConectado?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  /** Último e-mail que entrou com sucesso — a tela de login vem preenchida. */
  ultimoEmail: string;
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
  // Leitura preguiçosa: `localStorage` não existe no servidor, e a forma
  // `useState(fn)` só chama `fn` na montagem — no cliente, portanto.
  //
  // No servidor este valor sai vazio, e isso não vira erro de hidratação porque
  // ninguém o desenha antes de a sessão ser resolvida: enquanto `loading` é
  // `true` a tela de login mostra "Verificando sessão…", igual dos dois lados,
  // e o formulário que consome o e-mail só monta no render seguinte.
  const [ultimoEmail, setUltimoEmail] = useState(lerUltimoEmail);

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
        // `true` força o refresh do token para trazer claims recém-atribuídas —
        // e forçar exige rede. Enquanto a sessão morria com a aba isso era
        // seguro, porque logo antes alguém tinha acabado de autenticar online.
        // Agora a sessão volta a cada abertura do app, inclusive num notebook
        // sem sinal dentro de uma prefeitura: sem a rede, a promessa rejeita
        // dentro do callback, `loading` nunca vira `false` e o app fica preso
        // no esqueleto para sempre. O token em cache responde a isso — vale até
        // expirar (1h) e traz as claims da última vez que houve rede.
        const claims = await claimsComQuedaParaCache(fbUser);
        if (!claims) {
          // Não é "sem acesso", é "não deu para saber". A diferença importa:
          // deslogar aqui apagaria a sessão gravada e cobraria a senha de volta
          // assim que a rede voltasse — o oposto do que a persistência promete.
          // Fica sem `user` (a guarda manda para /entrar) e a sessão do Firebase
          // fica de pé, pronta para resolver sozinha na próxima abertura.
          setUser(null);
          setLoading(false);
          return;
        }
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

  const signIn = async (email: string, password: string, manterConectado = true) => {
    const auth = getFirebaseAuth();
    // Antes do login, sempre: a persistência escolhida decide onde o Firebase
    // grava a sessão, e trocá-la depois não move a que já foi gravada.
    // `LOCAL` é o padrão — a sessão sobrevive a fechar a aba e a reabrir o app
    // desktop, que é o uso real (a mesma pessoa, na mesma máquina, todo dia).
    // `SESSION` morre com a aba e fica como escolha explícita de quem está numa
    // máquina emprestada, ao desmarcar "Manter sessão ativa neste dispositivo".
    await setPersistence(auth, manterConectado ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const { claims } = await cred.user.getIdTokenResult(true);
    // Sem groupId não há acesso: desloga em vez de deixar uma sessão inútil de pé.
    if (!claims.groupId) {
      await fbSignOut(auth);
      throw new Error("Sua conta ainda não tem acesso configurado. Contate um administrador.");
    }
    // Só depois do acesso confirmado: e-mail sem acesso não merece ser lembrado.
    gravarUltimoEmail(email);
    setUltimoEmail(email.trim());
  };

  /**
   * Entrar com a conta Google.
   *
   * ## O acesso continua sendo concedido por e-mail, não pelo Google
   *
   * Autenticar não é autorizar. Quem entra com Google prova que é dona daquele
   * e-mail — e mais nada. Quem decide se ela usa o Sync continua sendo a claim
   * `groupId`, atribuída em Pessoas › Acesso ao sistema. Sem essa separação,
   * qualquer conta Google do mundo viraria usuária do sistema.
   *
   * ## Por que a ordem não importa
   *
   * O projeto está configurado com uma conta por e-mail (`allowDuplicateEmails`
   * desligado), e o Google verifica a posse do endereço. Então o Firebase liga
   * o provedor à conta que já existir com aquele e-mail, mantendo o mesmo `uid`
   * — e as claims junto. Tanto faz a administradora liberar antes e a pessoa
   * entrar depois, quanto o contrário: `/api/acessos` procura por e-mail antes
   * de criar.
   *
   * A consequência prática é o cuidado com **qual** conta Google a pessoa
   * escolhe: entrar com a pessoal em vez da institucional produz um e-mail
   * diferente, sem claim, e um "sem acesso" que parece defeito. Daí o
   * `select_account` — a escolha é sempre explícita, mesmo para quem já tem uma
   * sessão Google aberta no navegador.
   */
  const signInWithGoogle = async (manterConectado = true) => {
    const auth = getFirebaseAuth();
    await setPersistence(
      auth,
      manterConectado ? browserLocalPersistence : browserSessionPersistence,
    );

    const provedor = new GoogleAuthProvider();
    provedor.setCustomParameters({ prompt: "select_account" });

    const cred = await signInWithPopup(auth, provedor);
    const { claims } = await cred.user.getIdTokenResult(true);

    if (!claims.groupId) {
      const email = cred.user.email ?? "essa conta";
      await fbSignOut(auth);
      // A mensagem diz o e-mail porque é a informação que resolve: é ele que a
      // administradora precisa cadastrar, e é com ele que a pessoa descobre que
      // entrou com a conta errada.
      throw new Error(
        `${email} ainda não tem acesso ao Sync. Peça a liberação para uma administradora — ` +
          "o cadastro precisa usar exatamente esse e-mail.",
      );
    }

    if (cred.user.email) {
      gravarUltimoEmail(cred.user.email);
      setUltimoEmail(cred.user.email);
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
    <Ctx.Provider
      value={{ user, loading, signIn, signInWithGoogle, signOut, sendPasswordReset, ultimoEmail }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fora de AuthProvider");
  return ctx;
}
