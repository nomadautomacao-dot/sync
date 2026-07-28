import { AlertTriangleIcon, BarChart3Icon, GraduationCapIcon } from "lucide-react";

import type { CensoEscolar, PerfilComercial, ProjecaoFundeb } from "./tipos";

interface PainelCensoProps {
  censo?: CensoEscolar;
  perfil?: PerfilComercial;
  projecao?: ProjecaoFundeb;
}

function numero(valor?: number): string {
  return (valor ?? 0).toLocaleString("pt-BR");
}

export function PainelCenso({ censo, perfil, projecao }: PainelCensoProps) {
  /* As etapas moram em `matriculasEtapa`, não na raiz do censo — ler da raiz é o
     que zerava educação infantil e ensino fundamental. */
  const etapa = censo?.matriculasEtapa;

  const indicadores = [
    { rotulo: "Matrículas", valor: numero(censo?.totalMatriculas), destaque: true },
    { rotulo: "Escolas municipais", valor: numero(censo?.totalEscolas), destaque: true },
    { rotulo: "Educação infantil", valor: numero(etapa?.educacaoInfantil), destaque: false },
    { rotulo: "Ensino fundamental", valor: numero(etapa?.ensinoFundamental), destaque: false },
  ];

  return (
    <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
      <section className="rounded-[16px] border border-white/95 bg-white/88 p-[18px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
        <div className="flex items-center gap-[9px]">
          <GraduationCapIcon className="size-[16px] text-[#A2A6B2]" />
          <h2 className="text-[14.5px] font-bold tracking-[-0.3px] text-[#16181D]">
            Censo Escolar INEP
          </h2>
        </div>

        <dl className="mt-[16px] grid grid-cols-2 gap-x-[18px] gap-y-[16px]">
          {indicadores.map((indicador) => (
            <div key={indicador.rotulo}>
              <dt className="text-[11.5px] text-[#767A86]">{indicador.rotulo}</dt>
              <dd
                className={`mt-[3px] font-mono font-semibold leading-none text-[#16181D] ${
                  indicador.destaque ? "text-[24px] tracking-[-1.2px]" : "text-[15px]"
                }`}
              >
                {indicador.valor}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-[16px] border border-white/95 bg-white/88 p-[18px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-[9px]">
            <BarChart3Icon className="size-[16px] text-[#A2A6B2]" />
            <h2 className="text-[14.5px] font-bold tracking-[-0.3px] text-[#16181D]">Metodologia</h2>
          </div>

          {perfil?.faixa && (
            <span className="shrink-0 rounded-[14px] bg-[#F2F1F7] px-[9px] py-[4px] font-mono text-[10.5px] font-semibold text-[#5A5E6A]">
              {perfil.faixa}
              {typeof perfil.score === "number" && ` · ${perfil.score.toFixed(2)}`}
            </span>
          )}
        </div>

        <p className="mt-[14px] text-[12.5px] leading-relaxed text-[#5A5E6A]">
          {projecao?.metodologia ||
            "Diagnóstico automatizado pelo cruzamento de dados oficiais do FNDE com o Censo Escolar INEP."}
        </p>

        {typeof projecao?.multiplicadorAplicado === "number" && (
          <p className="mt-[10px] font-mono text-[11.5px] text-[#767A86]">
            Multiplicador aplicado: {projecao.multiplicadorAplicado.toFixed(2)}×
          </p>
        )}

        <p className="mt-[14px] rounded-[12px] bg-[#F7F6FA] p-[12px] text-[11.5px] leading-relaxed text-[#767A86]">
          A estimativa é uma leitura possível do próximo ciclo a partir da receita atual e dos
          pontos de conferência do FUNDEB. Não substitui a validação nas bases oficiais.
        </p>

        {projecao?.ressalva && (
          <p className="mt-[10px] flex items-start gap-[8px] rounded-[12px] bg-[#FBF0D9] p-[12px] text-[11.5px] leading-relaxed text-[#8A5A00]">
            <AlertTriangleIcon className="mt-[1px] size-[13px] shrink-0" />
            {projecao.ressalva}
          </p>
        )}
      </section>
    </div>
  );
}
