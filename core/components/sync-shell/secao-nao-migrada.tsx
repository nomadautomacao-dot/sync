import Link from "next/link";

interface SecaoNaoMigradaProps {
  /** Nome da seção como aparece na navegação. */
  titulo: string;
  /** Fase do plano de migração que traz esta seção. */
  fase: number;
  /** O que a seção faz hoje no app Flutter, em uma frase. */
  resumo: string;
}

/**
 * Tela das seções que ainda não foram portadas do Flutter.
 *
 * Existe para que a navegação inteira seja percorrível durante a migração: o
 * usuário clica em qualquer item da sidebar, o shell responde, e a tela diz com
 * honestidade que aquela parte ainda não existe em React — em vez de dar 404 ou
 * de abrir o app antigo (que está trancado).
 *
 * Cada uma destas rotas é o arquivo que a fase correspondente vai substituir
 * pelo conteúdo real. Não é andaime esquecido: é o marcador do trabalho que
 * falta, e some quando a seção for portada.
 */
export function SecaoNaoMigrada({ titulo, fase, resumo }: SecaoNaoMigradaProps) {
  return (
    <div className="mx-auto max-w-[560px] px-8 py-16">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-soft">
        Fase {fase} da migração
      </p>
      <h1 className="mt-3 text-[23px] font-bold tracking-[-0.7px] text-title">{titulo}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-soft">{resumo}</p>

      <div className="mt-6 rounded-[14px] border border-line bg-white p-5">
        <p className="text-[14px] leading-relaxed text-soft">
          Esta seção ainda não foi migrada para a interface nova. Ela continua implementada no app
          Flutter, que está fora do ar durante a migração — o código segue no repositório e é a
          referência usada para portar cada tela.
        </p>
      </div>

      <Link
        href="/painel"
        className="mt-6 inline-flex h-11 items-center rounded-[10px] bg-primary-strong px-5 text-[15px] font-semibold text-white transition-colors hover:bg-primary-deep"
      >
        Voltar ao painel
      </Link>
    </div>
  );
}
