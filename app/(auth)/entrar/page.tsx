"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { useAuth } from "@/core/providers/auth-provider";

import { DialogoRedefinirSenha } from "./dialogo-redefinir-senha";

/** Destino após autenticar. O painel é servido pelo grupo de rotas `(sync)`. */
const ROTA_POS_LOGIN = "/painel";

/** Bases oficiais que o sistema consulta. Mono porque são dados, não enfeite. */
const BASES = "IBGE · FNDE · INEP · TSE · SICONFI · QEdu";

const CLASSES_ROTULO_CAMPO =
  "font-mono text-[11px] font-semibold uppercase tracking-[0.9px] text-muted";

/**
 * Códigos do Firebase Auth que chegam em inglês e merecem texto de gente.
 * Credencial inválida, usuário inexistente e senha errada compartilham a mesma
 * frase de propósito: distinguir os casos revelaria quais e-mails têm conta.
 */
const MENSAGENS_POR_CODIGO: Record<string, string> = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/invalid-email": "E-mail em formato inválido.",
  "auth/user-disabled": "Esta conta foi desativada. Contate um administrador.",
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
  const [manterConectado, setManterConectado] = useState(false);
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroAuth, setErroAuth] = useState<string | null>(null);
  const [redefinindo, setRedefinindo] = useState(false);

  // Erros de preenchimento só aparecem depois da primeira tentativa. Marcar o
  // campo em vermelho enquanto a pessoa ainda está digitando o e-mail é acusar
  // antes de deixar terminar.
  const [validou, setValidou] = useState(false);

  const refEmail = useRef<HTMLInputElement>(null);
  const refSenha = useRef<HTMLInputElement>(null);

  const erroEmail = (() => {
    const texto = email.trim();
    if (!texto) return "Informe o e-mail institucional.";
    if (!texto.includes("@") || !texto.includes(".") || texto.length < 6) {
      return "E-mail incompleto — confira o endereço.";
    }
    return null;
  })();
  const erroSenha = senha.length === 0 ? "Informe a senha." : null;

  // Bounce do já-autenticado. A sessão do Firebase vive no armazenamento do
  // browser, então o servidor não sabe se há usuário logado: quem manda para o
  // painel é o cliente. É isso que faz a raiz do site (que aponta para /entrar)
  // pousar no painel quando a sessão já existe.
  useEffect(() => {
    if (!loading && user) router.replace(ROTA_POS_LOGIN);
  }, [loading, user, router]);

  const aoEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (enviando) return;

    setValidou(true);
    // O foco vai para o primeiro campo inválido: sem isso, quem usa leitor de
    // tela ouve que há um erro mas não descobre onde.
    if (erroEmail) {
      refEmail.current?.focus();
      return;
    }
    if (erroSenha) {
      refSenha.current?.focus();
      return;
    }

    setEnviando(true);
    setErroAuth(null);
    setSenhaVisivel(false); // não deixar a senha exposta na transição
    try {
      await signIn(email, senha, manterConectado);
      // Sem `setEnviando(false)` e sem redirect aqui, de propósito. Quem navega
      // é o `useEffect` acima, quando o `onAuthStateChanged` do provider
      // preencher `user` — navegar antes disso faria a guarda de `(sync)` ver
      // `user === null` e devolver para `/entrar`. Até lá o botão segue em
      // "Entrando…": feedback honesto e trava contra um segundo submit.
    } catch (erro) {
      setErroAuth(mensagemDeErro(erro));
      setEnviando(false);
    }
  };

  // Enquanto a sessão é resolvida — e no instante entre reconhecer o usuário e
  // o redirect acontecer — o formulário não deve piscar na tela.
  if (loading || user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-scaffold-tinted px-4 font-sans">
        <p className={CLASSES_ROTULO_CAMPO}>Verificando sessão…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-scaffold-tinted px-6 py-10 font-sans lg:py-16">
      {/* Uma entrada só, e ela respeita "reduzir movimento" pela variante do
          Tailwind: quem pediu para não ter efeito recebe o estado final direto. */}
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1220px] flex-col items-center justify-center gap-14 motion-safe:animate-[entrada_520ms_cubic-bezier(0.22,1,0.36,1)_both] lg:flex-row lg:items-center lg:justify-between lg:gap-[88px]">
        <PainelDeBoasVindas />

        <div className="w-full max-w-[420px] shrink-0">
          <div className="rounded-card border border-line bg-card p-8">
            <h2 className="text-[20px] font-bold tracking-[-0.6px] text-title">Entrar</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-soft">
              Use as credenciais da sua consultoria.
            </p>

            {erroAuth && (
              <BannerDeErro mensagem={erroAuth} aoRecuperar={() => setRedefinindo(true)} />
            )}

            <form className="mt-5" onSubmit={aoEnviar} noValidate>
              <label htmlFor="email" className={CLASSES_ROTULO_CAMPO}>
                E-mail
              </label>
              <input
                ref={refEmail}
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(evento) => setEmail(evento.target.value)}
                aria-invalid={validou && erroEmail !== null}
                aria-describedby="erro-email"
                placeholder="nome@consultoria.com.br"
                className={`${CLASSES_CAMPO} ${validou && erroEmail ? "border-error" : "border-line-input"}`}
              />
              {/* A linha de erro é reservada desde o primeiro frame: validar
                  passa a marcar o campo sem mover o botão sob o cursor. */}
              <p id="erro-email" className={CLASSES_LINHA_ERRO}>
                {validou && erroEmail}
              </p>

              <label htmlFor="senha" className={CLASSES_ROTULO_CAMPO}>
                Senha
              </label>
              <div className="relative">
                <input
                  ref={refSenha}
                  id="senha"
                  name="senha"
                  type={senhaVisivel ? "text" : "password"}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(evento) => setSenha(evento.target.value)}
                  aria-invalid={validou && erroSenha !== null}
                  aria-describedby="erro-senha"
                  // Espaço à direita para o texto não correr por baixo do olho.
                  className={`${CLASSES_CAMPO} pr-12 ${validou && erroSenha ? "border-error" : "border-line-input"}`}
                />
                <button
                  type="button"
                  onClick={() => setSenhaVisivel((visivel) => !visivel)}
                  // O botão não entra na tabulação entre os campos: quem navega
                  // por teclado quer ir do e-mail à senha ao envio. O olho segue
                  // alcançável, só não no meio do caminho.
                  tabIndex={-1}
                  aria-pressed={senhaVisivel}
                  className="absolute right-1 top-0 flex h-12 w-11 items-center justify-center rounded-control text-soft transition-colors hover:text-title"
                >
                  <IconeOlho aberto={!senhaVisivel} />
                  <span className="sr-only">{senhaVisivel ? "Ocultar senha" : "Mostrar senha"}</span>
                </button>
              </div>
              <p id="erro-senha" className={CLASSES_LINHA_ERRO}>
                {validou && erroSenha}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-x-3">
                <label className="flex h-12 cursor-pointer items-center gap-2.5 text-[13px] text-body">
                  <input
                    type="checkbox"
                    checked={manterConectado}
                    onChange={(evento) => setManterConectado(evento.target.checked)}
                    className="size-[18px] cursor-pointer accent-primary-strong"
                  />
                  Manter conectado
                </label>
                <button
                  type="button"
                  onClick={() => setRedefinindo(true)}
                  className="h-12 rounded-control px-1 text-[13px] font-semibold text-primary-strong transition-colors hover:text-title"
                >
                  Esqueci a senha
                </button>
              </div>

              <button
                type="submit"
                disabled={enviando}
                aria-busy={enviando}
                className="mt-3 h-12 w-full rounded-control bg-primary-strong text-[15px] font-semibold tracking-[-0.1px] text-white transition-colors hover:bg-primary-deep disabled:cursor-not-allowed disabled:bg-primary-dim"
              >
                {enviando ? "Entrando…" : "Entrar"}
              </button>
            </form>
          </div>

          <RodapeDeAmbiente />
        </div>
      </div>

      <DialogoRedefinirSenha
        aberto={redefinindo}
        emailInicial={email.trim()}
        aoFechar={() => setRedefinindo(false)}
      />
    </main>
  );
}

const CLASSES_LINHA_ERRO = "mb-1 mt-1.5 min-h-[18px] text-[12px] text-error-dark";

/** O `#8A94A6` da borda é o token de campo: 3:1 no branco, como pede a WCAG 1.4.11. */
const CLASSES_CAMPO =
  "mt-2 h-12 w-full rounded-control border bg-card px-4 text-[15px] text-title outline-none transition-colors placeholder:text-muted focus:border-primary";

/**
 * Coluna de endereçamento: diz o que o sistema faz e cita as bases que ele
 * consulta. Nenhum número — a tela pública de login não é lugar para métrica
 * que ninguém pode conferir.
 */
function PainelDeBoasVindas() {
  return (
    <div className="flex w-full max-w-[620px] flex-col items-center text-center lg:items-start lg:text-left">
      {/* Abaixo do layout dividido, só a marca sobrevive. Manter a manchete no
          celular empurraria o formulário para fora da primeira tela: numa tela
          de login, quem chegou já decidiu entrar — o discurso é para a coluna
          larga, onde ele não custa nada. */}
      <div className="flex flex-col items-center gap-3.5 lg:flex-row lg:gap-[18px]">
        <Image
          src="/global-sync-icon.png"
          alt=""
          width={76}
          height={76}
          priority
          className="size-16 rounded-[16px] lg:size-[76px]"
        />
        <div>
          {/* O `h1` é a marca, não a manchete: é o único título presente nos
              dois layouts. A manchete abaixo é texto de display — some no
              celular, e um `h1` que aparece só em certas larguras deixaria a
              tela sem título justamente onde ela é mais estreita. */}
          <h1 className="text-[26px] font-bold leading-none tracking-[-1px] text-title lg:text-[30px]">
            Global Sync
          </h1>
          <p className="mt-1.5 text-[12px] text-soft lg:text-[14px]">
            Global Services Consultorias
          </p>
        </div>
      </div>

      <div className="hidden lg:contents">
        {/* A manchete é o que o produto faz. Saudação por horário é enfeite:
            ocupa o lugar de maior peso da tela sem dizer nada sobre o sistema. */}
        <p className="mt-12 text-balance text-[56px] font-bold leading-[1.06] tracking-[-2.4px] text-title">
          Do dado bruto ao documento assinado.
        </p>

        <p className="mt-5 max-w-[540px] text-pretty text-[18px] leading-[1.6] text-body">
          Levantamentos FUNDEB, kits de inexigibilidade, contratos e o pipeline comercial, num
          lugar só.
        </p>

        <p className="mt-12 font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-soft">
          Bases consultadas
        </p>
        <p className="mt-2.5 font-mono text-[13px] text-soft">{BASES}</p>
      </div>
    </div>
  );
}

/** Aviso de falha de autenticação, com a saída para quem ficou de fora. */
function BannerDeErro({ mensagem, aoRecuperar }: { mensagem: string; aoRecuperar: () => void }) {
  return (
    // `role="alert"` faz o leitor de tela anunciar a falha; sem isso a tela
    // muda em silêncio para quem não vê.
    <div
      role="alert"
      className="mt-5 flex gap-2.5 rounded-control border border-error-border bg-error-light p-3.5"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-px size-[18px] shrink-0 fill-error-dark">
        <path d="M10 1.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8Zm0 4a.9.9 0 0 1 .9.9v4.2a.9.9 0 0 1-1.8 0V6.5a.9.9 0 0 1 .9-.9Zm0 8.9a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1Z" />
      </svg>
      <div>
        <p className="text-[12px] leading-relaxed text-error-dark">{mensagem}</p>
        {/* Um erro de login sem rota de saída é um beco: a mesma tela, a mesma
            senha, de novo. */}
        <button
          type="button"
          onClick={aoRecuperar}
          className="mt-1 text-[12px] font-semibold text-error-dark underline underline-offset-2"
        >
          Receber link para redefinir a senha
        </button>
      </div>
    </div>
  );
}

/**
 * Rodapé: estado do ambiente e assinatura. Sem host — o endereço do servidor
 * não diz nada a quem usa e informa demais a quem sonda.
 */
function RodapeDeAmbiente() {
  const producao = process.env.NODE_ENV === "production";
  return (
    <p className="mt-5 flex items-center justify-center gap-2 font-mono text-[11px] text-soft">
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${producao ? "bg-success-dot" : "bg-soft"}`}
      />
      {producao ? "Ambiente de produção" : "Ambiente local"} · © {new Date().getFullYear()} Global
      Sync
    </p>
  );
}

function IconeOlho({ aberto }: { aberto: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5 fill-none stroke-current stroke-[1.5]">
      <path d="M1.8 10S4.9 4.6 10 4.6 18.2 10 18.2 10 15.1 15.4 10 15.4 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.6" />
      {!aberto && <path d="M3.2 3.2 16.8 16.8" strokeLinecap="round" />}
    </svg>
  );
}
