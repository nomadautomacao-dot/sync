import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

export interface DocumentoDoModulo {
  nome: string;
  paginas: number;
}

interface ModuleCardProps {
  /** Rota da tela do módulo. */
  href: string;
  icone: React.ElementType;
  nome: string;
  /** Uma frase sobre o que o módulo faz. */
  descricao: string;
  /** Bases oficiais que o módulo cruza, já formatadas. */
  fontes: string;
  /** O que o módulo entrega — é o que dá corpo ao card. */
  documentos: DocumentoDoModulo[];
}

/**
 * Card de um módulo no hub.
 *
 * Ele lista os documentos que o módulo produz em vez de só nomear o módulo.
 * Essa é a diferença entre um card e um botão inflado: com um módulo só na
 * grade, é o conteúdo do rodapé que impede o card de parecer órfão.
 */
export function ModuleCard({
  href,
  icone: Icone,
  nome,
  descricao,
  fontes,
  documentos,
}: ModuleCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-[16px] border border-white/95 bg-white/88 p-[20px] shadow-[0_10px_26px_rgba(22,24,29,.05)] transition-all duration-200 hover:-translate-y-[1px] hover:border-white hover:shadow-[0_18px_40px_rgba(22,24,29,.09)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-[40px] shrink-0 items-center justify-center rounded-[14px] border border-white/90 bg-gradient-to-br from-[#EEE7F9] to-[#E2EDFA]">
          <Icone className="size-[19px] text-[#16181D]" />
        </div>

        <span className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-[#F2F1F7] text-[#A2A6B2] transition-colors group-hover:bg-[#16181D] group-hover:text-white">
          <ArrowRightIcon className="size-[14px]" />
        </span>
      </div>

      <h2 className="mt-[14px] text-[15px] font-bold tracking-[-0.3px] text-[#16181D]">
        {nome}
      </h2>
      <p className="mt-[5px] text-[12px] leading-relaxed text-[#767A86]">{descricao}</p>

      <div className="mt-[16px] border-t border-[#F0F1F5] pt-[14px]">
        <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[1.3px] text-[#A2A6B2]">
          Entrega
        </p>

        <ul className="mt-[9px] space-y-[7px]">
          {documentos.map((doc) => (
            <li key={doc.nome} className="flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] font-semibold text-[#3B3F4A]">{doc.nome}</span>
              <span className="font-mono text-[10.5px] text-[#A2A6B2]">{doc.paginas} pg</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-[14px] text-[11px] leading-relaxed text-[#A2A6B2]">{fontes}</p>
    </Link>
  );
}
