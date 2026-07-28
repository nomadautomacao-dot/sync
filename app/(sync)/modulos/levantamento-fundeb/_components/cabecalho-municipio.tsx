"use client";

import Link from "next/link";
import { PlusIcon, RefreshCwIcon } from "lucide-react";

interface CabecalhoMunicipioProps {
  nome: string;
  uf: string;
  codigoIbge: string;
  mesorregiao?: string;
  regiao?: string;
  prefeito?: string;
  partido?: string;
  onTrocar: () => void;
}

/** O IBGE devolve a string literal quando não tem o dado — não é nome de gestor. */
function informado(valor?: string): boolean {
  if (!valor) return false;
  const limpo = valor.trim().toLowerCase();
  return limpo !== "" && limpo !== "nao informado" && limpo !== "não informado";
}

/**
 * Identificação do município no topo da bancada.
 *
 * As ações que não produzem documento moram aqui — trocar de município e mandar
 * a cidade para o pipeline comercial. Os documentos ficam nos cards de saída,
 * para que a fileira de geração contenha só o que gera arquivo.
 */
export function CabecalhoMunicipio({
  nome,
  uf,
  codigoIbge,
  mesorregiao,
  regiao,
  prefeito,
  partido,
  onTrocar,
}: CabecalhoMunicipioProps) {
  const localizacao = [
    informado(mesorregiao) ? mesorregiao : null,
    informado(regiao) ? `Região ${regiao}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="rounded-[16px] border border-white/95 bg-white/88 p-[18px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-[12px]">
          <span className="flex size-[44px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#16181D] to-[#3B3F4A] font-mono text-[13px] font-semibold text-white">
            {uf}
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-[8px]">
              <h1 className="text-[19px] font-bold tracking-[-0.5px] text-[#16181D]">{nome}</h1>
              <span className="rounded-[14px] bg-[#F2F1F7] px-[8px] py-[3px] font-mono text-[10.5px] font-semibold text-[#5A5E6A]">
                IBGE {codigoIbge}
              </span>
            </div>

            <p className="mt-[3px] text-[12px] text-[#767A86]">
              {localizacao || "Localização não informada"}
              {informado(prefeito) && (
                <>
                  {" · "}
                  <span className="text-[#3B3F4A]">{prefeito}</span>
                  {informado(partido) && ` (${partido})`}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-[8px]">
          <button
            type="button"
            onClick={onTrocar}
            className="inline-flex h-[38px] items-center gap-[7px] rounded-[20px] px-[14px] text-[12.5px] font-semibold text-[#3B3F4A] transition-colors hover:bg-[#F7F6FA]"
          >
            <RefreshCwIcon className="size-[14px] text-[#A2A6B2]" />
            Trocar município
          </button>

          <Link
            href="/pipeline"
            className="inline-flex h-[38px] items-center gap-[7px] rounded-[20px] bg-[#F2F1F7] px-[14px] text-[12.5px] font-semibold text-[#3B3F4A] transition-colors hover:bg-[#ECEBF2]"
          >
            <PlusIcon className="size-[14px]" />
            Enviar ao pipeline
          </Link>
        </div>
      </div>
    </section>
  );
}
