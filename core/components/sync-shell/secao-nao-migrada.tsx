import Link from "next/link";

interface SecaoNaoMigradaProps {
  /** Nome da seção como aparece na navegação. */
  titulo: string;
  /** O que a seção deve fazer quando existir, em uma frase. */
  resumo: string;
  /**
   * Conteúdo que a seção **já** oferece, apesar de não ter sido migrada.
   * Renderiza abaixo do aviso. Usado por Ajustes, que ainda é placeholder mas
   * já hospeda ferramentas de desenvolvimento.
   */
  children?: React.ReactNode;
}

/**
 * Tela das seções que ainda não foram construídas.
 *
 * Existe para que a navegação inteira seja percorrível: o usuário clica em
 * qualquer item da sidebar, o shell responde, e a tela diz com honestidade que
 * aquela parte ainda não existe — em vez de dar 404.
 *
 * Usada hoje por `/ajustes` e `/caixa`. Não é andaime esquecido: é o marcador
 * do trabalho que falta, e some quando a seção for construída.
 */
export function SecaoNaoMigrada({ titulo, resumo, children }: SecaoNaoMigradaProps) {
  return (
    <div className="mx-auto max-w-[560px] px-8 py-16">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-soft">
        Não implementado
      </p>
      <h1 className="mt-3 text-[23px] font-bold tracking-[-0.7px] text-title">{titulo}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-soft">{resumo}</p>

      <div className="mt-6 rounded-[14px] border border-line bg-white p-5">
        <p className="text-[14px] leading-relaxed text-soft">
          Esta seção ainda não foi construída na interface nova. A versão anterior vivia no app
          Flutter, que foi removido do repositório — a referência, se precisar dela, está no
          histórico do git.
        </p>
      </div>

      {children && <div className="mt-6">{children}</div>}

      <Link
        href="/painel"
        className="mt-6 inline-flex h-11 items-center bg-[#16181D] text-white rounded-[20px] hover:bg-[#2C2F38] px-5 text-[15px] font-semibold transition-colors"
      >
        Voltar ao painel
      </Link>
    </div>
  );
}
