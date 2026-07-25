"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useAuth } from "@/core/providers/auth-provider";

/** Destino após autenticar. O painel é servido pelo grupo de rotas `(sync)`. */
const ROTA_POS_LOGIN = "/painel";

const CLASSES_ROTULO =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.9px] text-[#6B7280]";

const CLASSES_CAMPO =
  "h-12 w-full rounded-[10px] border border-[#D8DEE6] bg-white px-3.5 text-[15px] text-[#111827] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#049598] focus:shadow-[0_0_0_1px_#049598]";

/**
 * Códigos do Firebase Auth que chegam em inglês e merecem texto de gente.
 * Credencial inválida, usuário inexistente e senha errada compartilham a mesma
 * frase de propósito: distinguir os casos revelaria quais e-mails têm conta.
 */
const MENSAGENS_POR_CODIGO: Record<string, string> = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.",
  "auth/network-request-failed": "Falha de conexão. Verifique sua rede e tente de novo.",
};

function mensagemDeErro(erro: unknown): string {
  const codigo =
    typeof erro === "object" && erro !== null && "code" in erro && typeof erro.code === "string"
      ? erro.code
      : "";
  // O fallback é o `message` cru de propósito: é ele que preserva a frase do
  // provider ("Sua conta ainda não tem acesso configurado...") e evita engolir
  // o diagnóstico de um erro que ainda não conhecemos.
  return (
    MENSAGENS_POR_CODIGO[codigo] ??
    (erro instanceof Error ? erro.message : "Não foi possível entrar.")
  );
}

export default function EntrarPage() {
  const router = useRouter();
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Bounce do já-autenticado. A sessão do Firebase vive no IndexedDB do browser,
  // então o servidor não sabe se há usuário logado: quem manda para o painel é
  // o cliente. É isso que faz a raiz do site (que aponta para /entrar) pousar
  // no painel quando a sessão já existe.
  useEffect(() => {
    if (!loading && user) router.replace(ROTA_POS_LOGIN);
  }, [loading, user, router]);

  const aoEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (enviando) return;
    setEnviando(true);
    try {
      await signIn(email, senha);
      // Sem `setEnviando(false)` no sucesso de propósito: o botão fica travado
      // até a navegação levar esta tela embora, evitando um segundo submit.
      router.replace(ROTA_POS_LOGIN);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
      setEnviando(false);
    }
  };

  // Enquanto a sessão é resolvida — e no instante entre reconhecer o usuário e
  // o redirect acontecer — o formulário não deve piscar na tela.
  if (loading || user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#EEF1F6] px-4 font-sans">
        <p className={CLASSES_ROTULO}>Verificando sessão…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(160deg,#F5F9F9_0%,#E7F1F0_58%,#EFF4F4_100%)] px-4 py-12 font-sans">
      <div className="flex w-full max-w-[420px] flex-col items-center">
        <h1 className="text-[23px] font-bold tracking-[-0.7px] text-[#111827]">Global Sync</h1>
        <p className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-[#6B7280]">
          Global Services Consultorias
        </p>

        <div className="mt-7 w-full rounded-[14px] border border-[#E2E8F0] bg-white p-8">
          <h2 className="text-[20px] font-bold tracking-[-0.6px] text-[#111827]">
            Acesse sua conta
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#4B5563]">
            Credenciais institucionais da consultoria.
          </p>

          <form className="mt-7 flex flex-col gap-4" onSubmit={aoEnviar}>
            <div className="flex flex-col gap-1.5">
              <label className={CLASSES_ROTULO} htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                className={CLASSES_CAMPO}
                placeholder="consultor@globalsync.com.br"
                value={email}
                onChange={(evento) => setEmail(evento.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={CLASSES_ROTULO} htmlFor="senha">
                Senha
              </label>
              <input
                id="senha"
                name="senha"
                type="password"
                autoComplete="current-password"
                required
                className={CLASSES_CAMPO}
                value={senha}
                onChange={(evento) => setSenha(evento.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
              aria-busy={enviando}
              className="mt-2 h-12 w-full rounded-[10px] bg-[#049598] text-[15px] font-semibold tracking-[-0.1px] text-white transition-colors hover:bg-[#036B69] disabled:cursor-not-allowed disabled:bg-[#5FA3A0]"
            >
              {enviando ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
