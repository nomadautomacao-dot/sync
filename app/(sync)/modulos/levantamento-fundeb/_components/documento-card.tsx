"use client";

import { DownloadIcon, LoaderIcon } from "lucide-react";

interface DocumentoCardProps {
  icone: React.ElementType;
  nome: string;
  paginas: number;
  /**
   * Substitui o "N pg" do canto quando o tamanho não é fixo. Os dossiês
   * extensos têm volume em função do município — 20 escolas em Ibateguara,
   * 508 em Manaus —, e anunciar um número fixo ali seria mentira.
   */
  medida?: string;
  descricao: string;
  /** O que o documento cobre — some no mobile, onde o card já é longo. */
  conteudo: string[];
  /**
   * `primario` recebe o pill escuro. O Raio-X é o passo que antecede a conversa
   * de fundo e o Diagnóstico é o aprofundamento: a ordem de leitura vira peso
   * visual em vez de ficar só num comentário do código.
   */
  variante: "primario" | "secundario";
  gerando: boolean;
  desabilitado: boolean;
  onGerar: () => void;
}

export function DocumentoCard({
  icone: Icone,
  nome,
  paginas,
  medida,
  descricao,
  conteudo,
  variante,
  gerando,
  desabilitado,
  onGerar,
}: DocumentoCardProps) {
  const primario = variante === "primario";

  return (
    <section className="flex flex-col rounded-[16px] border border-white/95 bg-white/88 p-[18px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
      <div className="flex items-center gap-[10px]">
        <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[12px] border border-white/90 bg-gradient-to-br from-[#EEE7F9] to-[#E2EDFA]">
          <Icone className="size-[16px] text-[#16181D]" />
        </span>

        <h2 className="flex-1 text-[14.5px] font-bold tracking-[-0.3px] text-[#16181D]">{nome}</h2>

        <span className="shrink-0 font-mono text-[10.5px] text-[#A2A6B2]">{medida ?? `${paginas} pg`}</span>
      </div>

      <p className="mt-[10px] text-[12px] leading-relaxed text-[#767A86]">{descricao}</p>

      <ul className="mt-[12px] hidden flex-wrap gap-[6px] sm:flex">
        {conteudo.map((item) => (
          <li
            key={item}
            className="rounded-[14px] bg-[#F7F6FA] px-[9px] py-[4px] text-[11px] text-[#5A5E6A]"
          >
            {item}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onGerar}
        disabled={desabilitado || gerando}
        aria-busy={gerando}
        className={`mt-[16px] inline-flex h-[38px] w-full items-center justify-center gap-[8px] rounded-[20px] text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          primario
            ? "bg-[#16181D] text-white shadow-[0_6px_16px_rgba(22,24,29,.14)] hover:bg-[#2C2F38]"
            : "bg-[#F2F1F7] text-[#3B3F4A] hover:bg-[#ECEBF2]"
        }`}
      >
        {gerando ? (
          <>
            <LoaderIcon className="size-[14px] animate-spin" />
            Gerando…
          </>
        ) : (
          <>
            <DownloadIcon className="size-[14px]" />
            Gerar PDF
          </>
        )}
      </button>
    </section>
  );
}
