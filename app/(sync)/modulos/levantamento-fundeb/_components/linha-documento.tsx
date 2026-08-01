"use client";

import { DownloadIcon, LoaderIcon } from "lucide-react";

/**
 * Um documento por linha, não por card.
 *
 * São doze documentos. Em card de 200px eles ocupavam quatro fileiras e ~800px
 * de altura para dizer doze nomes — a tela virava catálogo, e escolher exigia
 * rolar. Em linha o mesmo conteúdo cabe de uma vez: nome, tamanho medido e
 * botão sempre na mesma coluna, que é o que deixa comparar e disparar rápido.
 */
interface LinhaDocumentoProps {
  icone: React.ElementType;
  nome: string;
  paginas: number;
  /** Substitui "N pg" quando o volume é função do município (dossiês). */
  medida?: string;
  descricao: string;
  variante: "primario" | "secundario";
  gerando: boolean;
  desabilitado: boolean;
  onGerar: () => void;
}

export function LinhaDocumento({
  icone: Icone,
  nome,
  paginas,
  medida,
  descricao,
  variante,
  gerando,
  desabilitado,
  onGerar,
}: LinhaDocumentoProps) {
  return (
    <div className="group flex items-center gap-3 border-b border-[#F4F4F8] px-3 py-2 transition-colors last:border-0 hover:bg-[#FAFAFC]">
      <span className="flex size-[28px] shrink-0 items-center justify-center rounded-[9px] border border-white/90 bg-gradient-to-br from-[#EEE7F9] to-[#E2EDFA]">
        <Icone className="size-[14px] text-[#16181D]" />
      </span>

      <div className="w-[230px] shrink-0">
        <div className="truncate text-[12.5px] font-semibold text-[#16181D]" title={nome}>
          {nome}
        </div>
        <div className="truncate font-mono text-[9.5px] text-[#A2A6B2]">
          {medida ?? `${paginas} páginas`}
        </div>
      </div>

      <p
        className="hidden min-w-0 flex-1 truncate text-[11.5px] text-[#767A86] xl:block"
        title={descricao}
      >
        {descricao}
      </p>

      <button
        type="button"
        onClick={onGerar}
        disabled={desabilitado || gerando}
        aria-busy={gerando}
        aria-label={`Gerar ${nome}`}
        className={`ml-auto inline-flex h-[30px] w-[104px] shrink-0 items-center justify-center gap-[6px] rounded-full text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          variante === "primario"
            ? "bg-[#16181D] text-white hover:bg-[#2C2F38]"
            : "bg-[#F2F1F7] text-[#3B3F4A] hover:bg-[#ECEBF2]"
        }`}
      >
        {gerando ? (
          <>
            <LoaderIcon className="size-[13px] animate-spin" />
            Gerando…
          </>
        ) : (
          <>
            <DownloadIcon className="size-[13px]" />
            Gerar PDF
          </>
        )}
      </button>
    </div>
  );
}
