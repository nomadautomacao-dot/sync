import { formatCurrency } from "@/core/lib/city-types";

import type { ProjecaoFundeb } from "./tipos";

interface PainelProjecaoProps {
  projecao?: ProjecaoFundeb;
  /** A camada já evidenciada nas bases oficiais, ao lado do cenário otimizado. */
  recuperavel?: ProjecaoFundeb;
}

interface LinhaComponente {
  rotulo: string;
  sigla: string;
  atual?: number;
  projetado?: number;
  ganho?: number;
}

export function PainelProjecao({ projecao, recuperavel }: PainelProjecaoProps) {
  const linhas: LinhaComponente[] = [
    {
      sigla: "VAAF",
      rotulo: "Valor Aluno Ano Fundo",
      atual: projecao?.vaafAtual,
      projetado: projecao?.vaafProjetado,
      ganho: projecao?.vaafGanho,
    },
    {
      sigla: "VAAT",
      rotulo: "Valor Aluno Ano Total",
      atual: projecao?.vaatAtual,
      projetado: projecao?.vaatProjetado,
      ganho: projecao?.vaatGanho,
    },
    {
      sigla: "VAAR",
      rotulo: "Vinculado a Resultados",
      atual: projecao?.vaarAtual,
      projetado: projecao?.vaarProjetado,
      ganho: projecao?.vaarGanho,
    },
  ];

  const ganhoTotal = projecao?.totalGanho ?? 0;
  const ganhoPercentual = projecao?.ganhoPercentual ?? 0;

  return (
    <div className="flex flex-col gap-[14px]">
      {/* Manchete: o número que a consultoria vende. Tudo em volta desce de peso
          para que ele seja o primeiro a ser lido. */}
      <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-[1.4fr_1fr]">
        <section className="relative overflow-hidden rounded-[16px] border border-white/95 bg-white/88 p-[20px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
          <div className="pointer-events-none absolute -right-[80px] -top-[80px] size-[220px] rounded-full bg-[radial-gradient(circle,_rgba(201,166,239,.22),_transparent_70%)]" />

          <div className="relative">
            <p className="text-[12px] text-[#767A86]">Potencial de incremento anual</p>

            <p className="mt-[10px] font-mono text-[34px] font-semibold leading-none tracking-[-1.8px] text-[#16181D]">
              {ganhoTotal > 0 ? "+" : ""}
              {formatCurrency(ganhoTotal)}
            </p>

            <div className="mt-[14px] flex flex-wrap items-center gap-[8px]">
              <span className="inline-flex items-center gap-[6px] rounded-[14px] bg-[#DFF2E7] px-[9px] py-[4px] text-[11px] font-semibold text-[#1F6A47]">
                <span className="size-[6px] rounded-full bg-[#8FD3B6]" />
                {ganhoPercentual > 0 ? "+" : ""}
                {ganhoPercentual.toFixed(1)}% sobre o cenário atual
              </span>
              <span className="text-[11.5px] text-[#A2A6B2]">cenário otimizado</span>
            </div>

            <div className="mt-[16px] flex flex-wrap gap-x-[28px] gap-y-[8px] border-t border-[#F0F1F5] pt-[14px]">
              <div>
                <p className="text-[11px] text-[#A2A6B2]">Receita atual</p>
                <p className="mt-[2px] font-mono text-[13px] text-[#3B3F4A]">
                  {formatCurrency(projecao?.totalAtual ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#A2A6B2]">Receita projetada</p>
                <p className="mt-[2px] font-mono text-[13px] font-semibold text-[#16181D]">
                  {formatCurrency(projecao?.totalProjetado ?? 0)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[16px] border border-white/95 bg-white/88 p-[20px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
          <p className="text-[12px] text-[#767A86]">Camada recuperável</p>

          <p className="mt-[10px] font-mono text-[24px] font-semibold leading-none tracking-[-1.2px] text-[#16181D]">
            +{formatCurrency(recuperavel?.totalGanho ?? 0)}
          </p>

          <p className="mt-[12px] font-mono text-[11.5px] text-[#767A86]">
            +{(recuperavel?.ganhoPercentual ?? 0).toFixed(1)}%
          </p>

          <p className="mt-[14px] border-t border-[#F0F1F5] pt-[14px] text-[11.5px] leading-relaxed text-[#A2A6B2]">
            Já evidenciada nas bases oficiais atuais, sem depender do cenário otimizado.
          </p>
        </section>
      </div>

      {/* Componente × atual × projetado × variação — espelha a página "Projeção"
          do relatório impresso. */}
      <section className="overflow-hidden rounded-[16px] border border-white/95 bg-white/88 shadow-[0_10px_26px_rgba(22,24,29,.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#F0F1F5] font-mono text-[9.5px] font-semibold uppercase tracking-[1.3px] text-[#A2A6B2]">
                <th className="px-[18px] py-[12px] font-normal">Componente</th>
                <th className="px-[18px] py-[12px] text-right font-normal">Atual</th>
                <th className="px-[18px] py-[12px] text-right font-normal">Projetado</th>
                <th className="px-[18px] py-[12px] text-right font-normal">Variação</th>
              </tr>
            </thead>

            <tbody>
              {linhas.map((linha) => (
                <tr
                  key={linha.sigla}
                  className="border-b border-[#F0F1F5] transition-colors last:border-none hover:bg-[#F7F6FA]"
                >
                  <td className="px-[18px] py-[12px]">
                    <span className="text-[12.5px] font-semibold text-[#16181D]">{linha.sigla}</span>
                    <span className="ml-[8px] text-[11.5px] text-[#A2A6B2]">{linha.rotulo}</span>
                  </td>
                  <td className="px-[18px] py-[12px] text-right font-mono text-[12.5px] text-[#5A5E6A]">
                    {formatCurrency(linha.atual ?? 0)}
                  </td>
                  <td className="px-[18px] py-[12px] text-right font-mono text-[12.5px] font-semibold text-[#16181D]">
                    {formatCurrency(linha.projetado ?? 0)}
                  </td>
                  <td className="px-[18px] py-[12px] text-right font-mono text-[12.5px] font-semibold text-[#1F6A47]">
                    {(linha.ganho ?? 0) > 0 ? "+" : ""}
                    {formatCurrency(linha.ganho ?? 0)}
                  </td>
                </tr>
              ))}

              <tr className="bg-[#F7F6FA]">
                <td className="px-[18px] py-[12px] text-[12.5px] font-semibold text-[#16181D]">
                  Receita total
                </td>
                <td className="px-[18px] py-[12px] text-right font-mono text-[12.5px] font-semibold text-[#3B3F4A]">
                  {formatCurrency(projecao?.totalAtual ?? 0)}
                </td>
                <td className="px-[18px] py-[12px] text-right font-mono text-[12.5px] font-semibold text-[#16181D]">
                  {formatCurrency(projecao?.totalProjetado ?? 0)}
                </td>
                <td className="px-[18px] py-[12px] text-right font-mono text-[12.5px] font-semibold text-[#1F6A47]">
                  {ganhoTotal > 0 ? "+" : ""}
                  {formatCurrency(ganhoTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
