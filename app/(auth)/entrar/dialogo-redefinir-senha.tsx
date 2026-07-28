"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { useAuth } from "@/core/providers/auth-provider";

interface DialogoRedefinirSenhaProps {
  aberto: boolean;
  /** E-mail já digitado no login, para não pedir duas vezes a mesma coisa. */
  emailInicial: string;
  aoFechar: () => void;
}

/**
 * Redefinição de senha.
 *
 * A resposta é a mesma exista ou não a conta: dizer "e-mail não cadastrado"
 * numa tela pública entrega a lista de usuários a quem estiver sondando. Quem
 * engole o `user-not-found` é o provider; aqui a mensagem de sucesso é redigida
 * no condicional ("se houver uma conta...") para não prometer o que não sabe.
 *
 * É um `<dialog>` nativo, e não uma `<div>` com `role="dialog"`: o browser já
 * traz prisão de foco, `Esc` para fechar e inércia do resto da página. Reimplementar
 * isso à mão é como se perde teclado e leitor de tela.
 */
export function DialogoRedefinirSenha({
  aberto,
  emailInicial,
  aoFechar,
}: DialogoRedefinirSenhaProps) {
  const { sendPasswordReset } = useAuth();
  const referencia = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState(emailInicial);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // `showModal()` é o que ativa prisão de foco e backdrop; o atributo `open` no
  // JSX abriria o diálogo sem nada disso.
  useEffect(() => {
    const dialogo = referencia.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) {
      setEmail(emailInicial);
      setEnviado(false);
      setErro(null);
      dialogo.showModal();
    } else if (!aberto && dialogo.open) {
      dialogo.close();
    }
  }, [aberto, emailInicial]);

  const aoEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const endereco = email.trim();
    if (!endereco.includes("@") || !endereco.includes(".")) {
      setErro("Informe um e-mail válido.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await sendPasswordReset(endereco);
      setEnviado(true);
    } catch {
      setErro("Não foi possível enviar agora. Verifique sua conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <dialog
      ref={referencia}
      // `close` cobre as saídas que não passam pelos botões: Esc e clique no backdrop.
      onClose={aoFechar}
      onClick={(evento) => {
        // O alvo é o próprio <dialog> apenas quando o clique cai no backdrop —
        // qualquer clique no conteúdo tem um filho como alvo.
        if (evento.target === referencia.current) aoFechar();
      }}
      aria-labelledby="titulo-redefinir"
      // `m-auto` não é cosmético: o preflight do Tailwind zera a margem de todo
      // elemento, e é justamente o `margin:auto` do UA que centra um <dialog>
      // modal. Sem ele o diálogo encosta no canto superior esquerdo.
      className="m-auto w-[calc(100vw-2rem)] max-w-[420px] bg-white/97 backdrop-blur-[14px] border border-white rounded-[18px] shadow-[0_24px_60px_rgba(22,24,29,.18)] p-0 backdrop:bg-[#16181D]/25"
    >
      <div className="p-7">
        <h2 id="titulo-redefinir" className="text-[20px] font-bold tracking-[-0.6px] text-[#16181D]">
          {enviado ? "Verifique seu e-mail" : "Redefinir senha"}
        </h2>

        {enviado ? (
          <>
            <p role="status" className="mt-2 text-[13px] leading-relaxed text-[#767A86]">
              Se houver uma conta para <span className="font-mono text-[#16181D]">{email.trim()}</span>,
              o link de redefinição chega em alguns minutos. Confira também a caixa de spam.
            </p>
            <button
              type="button"
              onClick={aoFechar}
              className="mt-6 h-12 w-full bg-[#16181D] rounded-[20px] text-[15px] font-semibold text-white transition-colors hover:bg-[#2C2F38]"
            >
              Fechar
            </button>
          </>
        ) : (
          <form onSubmit={aoEnviar} noValidate>
            <p className="mt-2 text-[13px] leading-relaxed text-[#767A86]">
              Enviamos um link para você criar uma senha nova.
            </p>

            <label
              htmlFor="email-redefinir"
              className="mt-6 block font-mono text-[11px] font-semibold uppercase tracking-[0.9px] text-[#A2A6B2]"
            >
              E-mail
            </label>
            <input
              id="email-redefinir"
              type="email"
              autoComplete="email"
              value={email}
              // Espaço colado no fim de um e-mail copiado é a causa mais comum
              // de "não recebi o link".
              onChange={(evento) => setEmail(evento.target.value.replace(/\s/g, ""))}
              aria-invalid={erro !== null}
              aria-describedby={erro ? "erro-redefinir" : undefined}
              placeholder="nome@consultoria.com.br"
              className={`mt-2 h-12 w-full rounded-[24px] border bg-[#F2F1F7] border-white/90 px-4 text-[15px] text-[#16181D] outline-none transition-colors placeholder:text-[#A2A6B2] focus:bg-white focus:ring-2 focus:ring-[#16181D] focus:border-[#16181D] ${
                erro ? "border-[#991B1B] bg-[#FFE5E5] focus:border-[#991B1B] focus:ring-[#991B1B]/20" : ""
              }`}
            />
            {/* A linha de erro existe desde o primeiro render: sem ela, o erro
                aparece e empurra os botões para baixo enquanto o dedo desce. */}
            <p id="erro-redefinir" role="alert" className="mt-1.5 min-h-[18px] text-[12px] text-[#991B1B]">
              {erro}
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={aoFechar}
                disabled={enviando}
                className="h-12 bg-[#F2F1F7] rounded-[20px] px-5 text-[15px] font-semibold text-[#16181D] transition-colors hover:bg-[#E5E4EA] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando}
                aria-busy={enviando}
                className="h-12 bg-[#16181D] rounded-[20px] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#2C2F38] disabled:bg-[#4A4E5A]"
              >
                {enviando ? "Enviando…" : "Enviar link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
