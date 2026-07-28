"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { EyeIcon, EyeOffIcon, LoaderIcon, LockKeyholeIcon, MailIcon, ShieldAlertIcon, AlertTriangleIcon } from "lucide-react";

import packageJson from "@/package.json";
import { useAuth } from "@/core/providers/auth-provider";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";

import { DialogoRedefinirSenha } from "./dialogo-redefinir-senha";

const ROTA_POS_LOGIN = "/painel";
const VERSAO_APP = `v${packageJson.version}`;

const MENSAGENS_POR_CODIGO: Record<string, string> = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/invalid-email": "E-mail em formato inválido.",
  "auth/user-disabled": "Esta conta foi desativada. Contate o suporte interno.",
  "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.",
  "auth/network-request-failed": "Falha de conexão. Verifique sua rede e tente de novo.",
};

function mensagemDeErro(erro: unknown): string {
  const codigo =
    typeof erro === "object" && erro !== null && "code" in erro && typeof erro.code === "string"
      ? erro.code
      : "";
  return (
    MENSAGENS_POR_CODIGO[codigo] ??
    (erro instanceof Error ? erro.message : "Não foi possível autenticar.")
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
  const [validou, setValidou] = useState(false);

  // Status dinâmico da API
  const [statusApi, setStatusApi] = useState<{ ok: boolean; carregando: boolean }>({
    ok: true,
    carregando: true,
  });

  const refEmail = useRef<HTMLInputElement>(null);
  const refSenha = useRef<HTMLInputElement>(null);

  // Checagem de saúde da API
  useEffect(() => {
    let ativo = true;
    const checarSaude = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (ativo) {
          setStatusApi({ ok: res.ok, carregando: false });
        }
      } catch {
        if (ativo) {
          setStatusApi({ ok: false, carregando: false });
        }
      }
    };

    checarSaude();
    const intervalo = setInterval(checarSaude, 20000);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, []);

  const erroEmail = (() => {
    const texto = email.trim();
    if (!texto) return "Informe o e-mail institucional.";
    if (!texto.includes("@") || !texto.includes(".") || texto.length < 6) {
      return "E-mail incompleto — confira o endereço.";
    }
    return null;
  })();
  const erroSenha = senha.length === 0 ? "Informe a senha." : null;

  useEffect(() => {
    if (!loading && user) router.replace(ROTA_POS_LOGIN);
  }, [loading, user, router]);

  const aoEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (enviando) return;

    setValidou(true);
    if (erroEmail) { refEmail.current?.focus(); return; }
    if (erroSenha) { refSenha.current?.focus(); return; }

    setEnviando(true);
    setErroAuth(null);
    setSenhaVisivel(false);
    try {
      await signIn(email.trim(), senha, manterConectado);
    } catch (erro) {
      setErroAuth(mensagemDeErro(erro));
      setEnviando(false);
    }
  };

  if (loading || user) {
    return (
      <main className="flex h-screen w-screen items-center justify-center overflow-hidden font-sans">
        <div className="flex items-center gap-3 rounded-[18px] border border-white/95 bg-white/[.88] px-5 py-3.5 shadow-[0_14px_36px_rgba(22,24,29,.07)] backdrop-blur-xl">
          <LoaderIcon className="size-4 animate-spin text-[#16181D]" />
          <span className="font-mono text-xs font-semibold text-[#5A5E6A]">Verificando sessão…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen w-screen flex-col justify-between overflow-hidden font-sans text-[#16181D] selection:bg-[#F2F1F7] selection:text-[#16181D]">
      {/* ── Topbar estilo Apple Frosted Glass ───────────────────────────── */}
      <header className="shrink-0 h-16 border border-white/90 bg-white/[.82] backdrop-blur-[14px] rounded-[40px] mx-4 mt-4 px-6 lg:px-12 z-20 flex items-center">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center rounded-control bg-white p-1 border border-[#F0F1F5]/60 shadow-2xs">
              <Image
                src="/global-sync-icon.png"
                alt="Global Sync"
                width={28}
                height={28}
                priority
                className="size-7 shrink-0 rounded-md"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-[#16181D]">Global Sync</span>
              <span className="rounded-full border border-white/90 bg-[#F2F1F7] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#767A86]">
                {VERSAO_APP}
              </span>
            </div>
          </div>

          {/* Badge Dinâmico de Status (Versão dinâmica + status limpo) */}
          <div className="hidden items-center gap-4 text-xs font-medium text-[#767A86] sm:flex">
            {statusApi.carregando ? (
              <span className="flex items-center gap-2 rounded-full border border-white/90 bg-[#F2F1F7] px-3 py-1 text-[#767A86] font-semibold">
                <LoaderIcon className="size-3 animate-spin text-[#A2A6B2]" />
                Checando sistema…
              </span>
            ) : statusApi.ok ? (
              <span className="flex items-center gap-2 rounded-full border border-white/90 bg-[#F2F1F7] px-3 py-1 text-[#5A5E6A] font-semibold">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34C388] opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-[#34C388]" />
                </span>
                Sistemas Operacionais
              </span>
            ) : (
              <span className="flex items-center gap-2 rounded-full border border-white/90 bg-[#FFE5E5] px-3 py-1 text-[#991B1B] font-semibold">
                <AlertTriangleIcon className="size-3.5 text-[#991B1B]" />
                Instabilidade na Rede
              </span>
            )}

            <span className="text-[#A2A6B2]">|</span>
            <span className="font-semibold text-[#16181D]">Global Company Consultorias</span>
          </div>
        </div>
      </header>

      {/* ── Conteúdo Central: Card de Login Suave & Elegante ────────────── */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[420px] bg-white/[.88] backdrop-blur-xl border border-white/95 rounded-[18px] shadow-[0_14px_36px_rgba(22,24,29,.07)] p-8 transition-all">
          {/* Logo & Título */}
          <div className="flex flex-col items-center text-center">
            {/* `p-1.5` e não `p-2`: com 56px de caixa, 8px de padding e 1px de
                borda de cada lado sobram 38px de conteúdo para um ícone de 40px
                — o flex esmagava só a largura, e é isso que o Next reporta como
                "width modified, but not the other". Com 6px sobram 42px. */}
            <div className="relative flex size-14 items-center justify-center rounded-[18px] bg-white/[.82] p-1.5 border border-white/90 shadow-[0_14px_36px_rgba(22,24,29,.07)]">
              <Image
                src="/global-sync-icon.png"
                alt="Global Sync"
                width={40}
                height={40}
                priority
                className="size-10 shrink-0 rounded-control"
              />
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#16181D]">
              Acessar o Global Sync
            </h1>
            <p className="mt-1 text-xs font-medium text-[#767A86]">
              Global Company Consultorias
            </p>
          </div>

          {erroAuth && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-3 rounded-[24px] border border-white/90 bg-[#FFE5E5] p-3.5"
            >
              <ShieldAlertIcon className="mt-0.5 size-4 shrink-0 text-[#991B1B]" />
              <div className="flex-1">
                <p className="text-xs font-semibold leading-snug text-[#991B1B]">{erroAuth}</p>
                <button
                  type="button"
                  onClick={() => setRedefinindo(true)}
                  className="mt-1 text-[11px] font-bold text-[#991B1B] underline underline-offset-2 hover:opacity-80"
                >
                  Esqueci minha senha
                </button>
              </div>
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={aoEnviar} noValidate>
            {/* Campo E-mail */}
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.9px] text-[#767A86]"
              >
                E-mail institucional
              </Label>
              <div className="relative">
                <MailIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#A2A6B2]" />
                <Input
                  ref={refEmail}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={validou && erroEmail !== null}
                  aria-describedby="erro-email"
                  placeholder="usuario@globalcompany.com.br"
                  className={`h-11 bg-[#F2F1F7] border border-white/90 rounded-[24px] pl-10 text-xs font-semibold text-[#16181D] placeholder:text-[#A2A6B2] placeholder:font-normal focus:bg-white focus:ring-2 focus:ring-[#16181D] focus:border-[#16181D] transition-all ${
                    validou && erroEmail ? "border-[#991B1B] focus:border-[#991B1B] focus:ring-[#991B1B]/20 bg-[#FFE5E5]" : ""
                  }`}
                />
              </div>
              {validou && erroEmail && (
                <p id="erro-email" className="text-[11px] font-semibold text-[#991B1B]">
                  {erroEmail}
                </p>
              )}
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="senha"
                  className="font-mono text-[10px] font-semibold uppercase tracking-[0.9px] text-[#767A86]"
                >
                  Senha
                </Label>
                <button
                  type="button"
                  onClick={() => setRedefinindo(true)}
                  className="text-xs font-semibold text-[#16181D] hover:underline focus:outline-hidden focus:ring-2 focus:ring-[#16181D]/30 rounded-full"
                >
                  Esqueceu?
                </button>
              </div>
              <div className="relative">
                <LockKeyholeIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#A2A6B2]" />
                <Input
                  ref={refSenha}
                  id="senha"
                  name="senha"
                  type={senhaVisivel ? "text" : "password"}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  aria-invalid={validou && erroSenha !== null}
                  aria-describedby="erro-senha"
                  className={`h-11 bg-[#F2F1F7] border border-white/90 rounded-[24px] pl-10 pr-11 text-xs font-semibold text-[#16181D] focus:bg-white focus:ring-2 focus:ring-[#16181D] focus:border-[#16181D] transition-all ${
                    validou && erroSenha ? "border-[#991B1B] focus:border-[#991B1B] focus:ring-[#991B1B]/20 bg-[#FFE5E5]" : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setSenhaVisivel((v) => !v)}
                  tabIndex={-1}
                  aria-pressed={senhaVisivel}
                  className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-[#767A86] transition-colors hover:text-[#16181D]"
                >
                  {senhaVisivel ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                  <span className="sr-only">{senhaVisivel ? "Ocultar senha" : "Mostrar senha"}</span>
                </button>
              </div>
              {validou && erroSenha && (
                <p id="erro-senha" className="text-[11px] font-semibold text-[#991B1B]">
                  {erroSenha}
                </p>
              )}
            </div>

            {/* Checkbox Manter Conectado */}
            <div className="pt-1">
              <label className="flex cursor-pointer items-center justify-center gap-2.5 text-xs font-semibold text-[#5A5E6A]">
                <input
                  type="checkbox"
                  checked={manterConectado}
                  onChange={(e) => setManterConectado(e.target.checked)}
                  className="size-4 rounded-sm border-[#A2A6B2] accent-[#16181D]"
                />
                Manter sessão ativa neste dispositivo
              </label>
            </div>

            {/* Botão de Submit */}
            <Button
              type="submit"
              disabled={enviando}
              aria-busy={enviando}
              className="mt-2 h-11 w-full bg-[#16181D] text-white rounded-[24px] text-xs font-semibold tracking-tight shadow-[0_12px_26px_rgba(22,24,29,.2)] transition-all hover:bg-[#2C2F38] disabled:bg-[#4A4E5A]"
            >
              {enviando ? (
                <span className="flex items-center gap-2">
                  <LoaderIcon className="size-4 animate-spin" />
                  Autenticando…
                </span>
              ) : (
                "Acessar Console"
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-[#F2F1F7] pt-4 text-center">
            <p className="font-mono text-[11px] text-[#A2A6B2]">
              Uso exclusivo de colaboradores autorizados.
            </p>
          </div>
        </div>
      </div>

      {/* ── Rodapé Limpo & Centralizado ─────────────────────────────────── */}
      <footer className="shrink-0 h-12 px-6 text-xs font-medium text-[#767A86] flex items-center justify-center">
        <p>© {new Date().getFullYear()} Global Company Consultorias. Todos os direitos reservados.</p>
      </footer>

      <DialogoRedefinirSenha
        aberto={redefinindo}
        emailInicial={email.trim()}
        aoFechar={() => setRedefinindo(false)}
      />
    </main>
  );
}
