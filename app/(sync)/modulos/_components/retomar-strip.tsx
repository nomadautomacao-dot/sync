import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import {
  STAGE_LABELS,
  formatCurrencyCompact,
  stagePastelTone,
  type CityAccount,
} from "@/core/lib/city-types";

interface RetomarStripProps {
  cidades: CityAccount[];
  /** Quantas cidades mostrar. */
  limite?: number;
}

/** Mais recente primeiro; cidade sem atividade registrada vai para o fim. */
function porAtividadeRecente(a: CityAccount, b: CityAccount): number {
  const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
  const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
  return tb - ta;
}

function atividadeRelativa(iso?: string): string | null {
  if (!iso) return null;
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return null;

  const dias = Math.floor((Date.now() - quando.getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return quando.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/**
 * As últimas cidades da carteira, como atalho para a bancada.
 *
 * Existe porque rodar dois municípios seguidos hoje custa digitar o nome de cada
 * um do zero. O clique abre o levantamento com o município já carregado.
 *
 * Sem cidades na carteira, o componente não renderiza nada — a ausência de dado
 * some da tela em vez de virar um bloco vazio.
 */
export function RetomarStrip({ cidades, limite = 6 }: RetomarStripProps) {
  const recentes = [...cidades].sort(porAtividadeRecente).slice(0, limite);
  if (recentes.length === 0) return null;

  return (
    <section className="rounded-[16px] border border-white/95 bg-white/88 p-[18px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[15px] font-bold tracking-[-0.3px] text-[#16181D]">
          Retomar de onde parou
        </h2>
        <Link
          href="/pipeline"
          className="font-mono text-[10.5px] text-[#767A86] transition-colors hover:text-[#16181D]"
        >
          ver carteira
        </Link>
      </div>

      <p className="mt-[3px] text-[12px] text-[#767A86]">
        Abre o levantamento com o município já carregado.
      </p>

      <ul className="mt-[14px] space-y-[2px]">
        {recentes.map((cidade) => {
          const tom = stagePastelTone(cidade.stage);
          const atividade = atividadeRelativa(cidade.lastActivityAt);

          return (
            <li key={cidade.id}>
              <Link
                href={`/modulos/levantamento-fundeb?ibge=${cidade.codigoIbge}`}
                className="flex items-center gap-3 rounded-[12px] px-[10px] py-[9px] transition-colors hover:bg-[#F7F6FA]"
              >
                <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#F2F1F7] font-mono text-[10.5px] font-semibold text-[#3B3F4A]">
                  {cidade.uf}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold tracking-[-0.2px] text-[#16181D]">
                    {cidade.name}
                  </span>
                  {atividade && (
                    <span className="block font-mono text-[10.5px] text-[#A2A6B2]">
                      {atividade}
                    </span>
                  )}
                </span>

                <span
                  className="hidden shrink-0 items-center gap-[6px] rounded-[14px] px-[9px] py-[4px] text-[10.5px] font-semibold sm:inline-flex"
                  style={{ background: tom.bg, color: tom.text }}
                >
                  <span
                    className="size-[6px] shrink-0 rounded-full"
                    style={{ background: tom.dot }}
                  />
                  {STAGE_LABELS[cidade.stage]}
                </span>

                <span className="hidden w-[92px] shrink-0 text-right font-mono text-[12px] text-[#3B3F4A] md:block">
                  {formatCurrencyCompact(cidade.estimatedAnnualRevenue)}
                </span>

                <ChevronRightIcon className="size-[15px] shrink-0 text-[#A2A6B2]" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
