"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUpIcon,
  ClockIcon,
  FileTextIcon,
  CheckCircle2Icon,
  FilterIcon,
  DownloadIcon,
  ChevronRightIcon,
  PlusIcon,
  Building2Icon,
} from "lucide-react";

import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import { listCities } from "@/core/lib/cities-firestore";
import { STAGE_LABELS, formatCurrency, formatCurrencyCompact, type StageKey } from "@/core/lib/city-types";
import { NovoLevantamentoWizard } from "@/core/components/novo-levantamento-wizard";

const MESES = [
  { nome: "JAN", altura: "44%", grad: "linear-gradient(180deg, #E5D9F6, #DDE7F8)" },
  { nome: "FEV", altura: "52%", grad: "linear-gradient(180deg, #E5D9F6, #DDE7F8)" },
  { nome: "MAR", altura: "47%", grad: "linear-gradient(180deg, #E5D9F6, #DDE7F8)" },
  { nome: "ABR", altura: "63%", grad: "linear-gradient(180deg, #E5D9F6, #DDE7F8)" },
  { nome: "MAI", altura: "58%", grad: "linear-gradient(180deg, #E5D9F6, #DDE7F8)" },
  { nome: "JUN", altura: "74%", grad: "linear-gradient(180deg, #E5D9F6, #DDE7F8)" },
  { nome: "JUL", altura: "69%", grad: "linear-gradient(180deg, #C9A6EF, #93B8F2)" },
  { nome: "AGO", altura: "88%", grad: "linear-gradient(180deg, #C9A6EF, #93B8F2)" },
  { nome: "SET", altura: "100%", grad: "linear-gradient(180deg, #C9A6EF, #93B8F2)" },
  { nome: "OUT", altura: "34%", grad: "linear-gradient(180deg, #ECEBF2, #F2F1F7)" },
  { nome: "NOV", altura: "30%", grad: "linear-gradient(180deg, #ECEBF2, #F2F1F7)" },
  { nome: "DEZ", altura: "26%", grad: "linear-gradient(180deg, #ECEBF2, #F2F1F7)" },
];

function obtermEstagioBadgeStyle(stage: StageKey) {
  switch (stage) {
    case "contractual":
    case "implementation":
    case "assisted_operation":
    case "fidelized":
      return { chipTexto: "#8A3A50", chipFundo: "#FBE9EE", chipPonto: "#F5A3B5", label: "contrato" };
    case "proposal_presented":
    case "negotiation":
    case "verbal_approval":
      return { chipTexto: "#8A5A00", chipFundo: "#FBF0D9", chipPonto: "#F7C77E", label: "proposta" };
    case "technical_diagnostic":
    case "institutional_validation":
      return { chipTexto: "#1F6A47", chipFundo: "#E4F4EC", chipPonto: "#8FD3B6", label: "estudo" };
    default:
      return { chipTexto: "#2C4E82", chipFundo: "#E2EDFA", chipPonto: "#93B8F2", label: "contato" };
  }
}

export default function PainelPage() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<number>(1); // 0=Mês, 1=Trimestre, 2=Ano
  const [wizardAberto, setWizardAberto] = useState(false);

  const { data: cities = [], isLoading, refetch } = useQuery({
    queryKey: ["dashboard-cities-real", user?.groupId],
    queryFn: async () => {
      if (!user?.groupId) return [];
      const db = getFirebaseDb();
      return await listCities(db, user.groupId);
    },
    enabled: !!user?.groupId,
  });

  const totalCidades = cities.length;
  const nomeUsuario = user?.name || user?.email?.split("@")[0] || "Usuário";

  // Métricas Reais
  const contratoCount = cities.filter((c) =>
    ["contractual", "implementation", "assisted_operation", "fidelized"].includes(c.stage)
  ).length;

  const propostaCount = cities.filter((c) =>
    ["proposal_presented", "negotiation", "verbal_approval"].includes(c.stage)
  ).length;

  const estudoCount = cities.filter((c) =>
    ["technical_diagnostic", "institutional_validation"].includes(c.stage)
  ).length;

  const contatoCount = cities.filter((c) =>
    ["mapping", "first_contact"].includes(c.stage)
  ).length;

  const totalReceita = cities.reduce((sum, c) => sum + (c.estimatedAnnualRevenue || 0), 0);
  const totalLucro = totalReceita * 0.35;

  const pendenciasCount = cities.filter(
    (c) => c.stage === "paused" || (c.nextStepDueDate && new Date(c.nextStepDueDate) < new Date())
  ).length;

  // Calculo de porcentagem para barra de progresso
  const pctContrato = totalCidades > 0 ? Math.round((contratoCount / totalCidades) * 100) : 0;
  const pctProposta = totalCidades > 0 ? Math.round((propostaCount / totalCidades) * 100) : 0;
  const pctEstudo = totalCidades > 0 ? Math.round((estudoCount / totalCidades) * 100) : 0;
  const pctContato = totalCidades > 0 ? Math.max(0, 100 - pctContrato - pctProposta - pctEstudo) : 0;

  // Data formatada real
  const dataAtualFormatada = new Date().toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <div className="flex flex-col gap-[14px]">
        {/* ── Topo: Boas-vindas ─────────────────────────────────────────── */}
        <div className="flex items-baseline justify-between px-[4px] pt-[4px]">
          <h1 className="text-[21px] font-bold tracking-[-0.7px] text-[#16181D]">
            Olá, {nomeUsuario}!
          </h1>
          <div className="font-mono text-[11px] text-[#767A86]">
            {dataAtualFormatada} · exercício 2026
          </div>
        </div>

        {/* ── Linha 1: KPIs (Grid 4 colunas) ──────────────────────────────── */}
        <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-[1fr_1.6fr_1fr_1fr]">
          {/* Card 1: Municípios Ativos */}
          <div className="rounded-[16px] border border-white/95 bg-white/88 p-[18px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
            <div className="text-[12px] text-[#767A86]">Municípios ativos</div>
            <div className="h-[10px]" />
            <div className="flex items-baseline gap-[6px]">
              <span className="font-mono text-[34px] font-semibold leading-none tracking-[-1.8px] text-[#16181D]">
                {totalCidades}
              </span>
              <span className="text-[11.5px] text-[#A2A6B2]">na carteira</span>
            </div>
            <div className="h-[12px]" />
            <div className="text-[11.5px] text-[#767A86]">
              {contratoCount} com contrato vigente
            </div>
          </div>

          {/* Card 2: Distribuição do Pipeline */}
          <div className="rounded-[16px] border border-white/95 bg-white/88 p-[18px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-[#767A86]">Distribuição do pipeline</span>
              <span className="font-mono text-[10.5px] text-[#A2A6B2]">
                {totalCidades} municípios
              </span>
            </div>
            <div className="h-[16px]" />

            {/* Barra de Progresso Segmentada Dinâmica */}
            <div className="flex h-[14px] overflow-hidden rounded-[8px] gap-[3px] bg-[#F2F1F7]">
              {pctContrato > 0 && (
                <div
                  style={{ width: `${pctContrato}%` }}
                  className="cursor-pointer bg-gradient-to-r from-[#F5A3B5] to-[#F7B99B]"
                  title={`Contrato: ${contratoCount}`}
                />
              )}
              {pctProposta > 0 && (
                <div
                  style={{ width: `${pctProposta}%` }}
                  className="cursor-pointer bg-gradient-to-r from-[#F7C77E] to-[#F5D89B]"
                  title={`Proposta: ${propostaCount}`}
                />
              )}
              {pctEstudo > 0 && (
                <div
                  style={{ width: `${pctEstudo}%` }}
                  className="cursor-pointer bg-gradient-to-r from-[#8FD3B6] to-[#A9DFC6]"
                  title={`Estudo: ${estudoCount}`}
                />
              )}
              {pctContato > 0 && (
                <div
                  style={{ width: `${pctContato}%` }}
                  className="cursor-pointer bg-gradient-to-r from-[#93B8F2] to-[#B5CDF6]"
                  title={`Contato: ${contatoCount}`}
                />
              )}
            </div>

            <div className="h-[14px]" />
            <div className="flex flex-wrap gap-[18px] text-[11.5px] text-[#5A5E6A]">
              <div className="flex items-center gap-[6px]">
                <span className="size-[8px] rounded-[3px] bg-[#F5A3B5]" />
                <span className="font-mono font-semibold">{contratoCount}</span> Contrato
              </div>
              <div className="flex items-center gap-[6px]">
                <span className="size-[8px] rounded-[3px] bg-[#F7C77E]" />
                <span className="font-mono font-semibold">{propostaCount}</span> Proposta
              </div>
              <div className="flex items-center gap-[6px]">
                <span className="size-[8px] rounded-[3px] bg-[#8FD3B6]" />
                <span className="font-mono font-semibold">{estudoCount}</span> Estudo
              </div>
              <div className="flex items-center gap-[6px]">
                <span className="size-[8px] rounded-[3px] bg-[#93B8F2]" />
                <span className="font-mono font-semibold">{contatoCount}</span> Contato
              </div>
            </div>
          </div>

          {/* Card 3: Lucro Projetado */}
          <div className="rounded-[16px] border border-white/95 bg-gradient-to-br from-white/92 via-white/95 to-[#F3EEFB] p-[18px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
            <div className="text-[12px] text-[#767A86]">Lucro projetado</div>
            <div className="h-[10px]" />
            <div className="flex items-baseline gap-[4px]">
              <span className="font-mono text-[34px] font-semibold leading-none tracking-[-1.8px] text-[#16181D]">
                {formatCurrencyCompact(totalLucro)}
              </span>
            </div>
            <div className="h-[12px]" />
            <div className="flex items-center gap-[5px]">
              <TrendingUpIcon className="size-[15px] text-[#1F6A47]" />
              <span className="font-mono text-[11.5px] font-semibold text-[#1F6A47]">
                Margem est. 35%
              </span>
              <span className="text-[11.5px] text-[#767A86]">da receita</span>
            </div>
          </div>

          {/* Card 4: Pendências */}
          <div className="rounded-[16px] border border-white/95 bg-white/88 p-[18px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
            <div className="text-[12px] text-[#767A86]">Pendências</div>
            <div className="h-[10px]" />
            <div className="font-mono text-[34px] font-semibold leading-none tracking-[-1.8px] text-[#16181D]">
              {pendenciasCount}
            </div>
            <div className="h-[12px]" />
            <div className="inline-flex items-center gap-[5px] rounded-[6px] bg-[#FBF0D9] px-[8px] py-[3px]">
              <ClockIcon className="size-[13px] text-[#8A5A00]" />
              <span className="font-mono text-[10.5px] font-semibold text-[#8A5A00]">
                {pendenciasCount > 0 ? `${pendenciasCount} em atenção` : "Nenhuma pendência"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Linha 2: Gráfico + Radar (Grid 1.7fr 1fr) ─────────────────────── */}
        <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-[1.7fr_1fr]">
          {/* Gráfico Receita no Ano */}
          <div className="rounded-[16px] border border-white/95 bg-white/88 p-[18px_20px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[14.5px] font-bold tracking-[-0.3px] text-[#16181D]">
                  Receita no ano
                </h2>
                <p className="mt-[2px] text-[12px] text-[#767A86]">
                  Tendência mensal consolidada ·{" "}
                  <span className="font-mono text-[11.5px]">
                    {formatCurrencyCompact(totalReceita)} acum.
                  </span>
                </p>
              </div>

              {/* Time period switcher pills */}
              <div className="flex rounded-[20px] bg-[#F2F1F7] p-[3px]">
                {["Mês", "Trimestre", "Ano"].map((nome, i) => (
                  <button
                    key={nome}
                    type="button"
                    onClick={() => setPeriodo(i)}
                    className={`rounded-[17px] px-[14px] py-[6px] text-[11.5px] transition-all ${
                      periodo === i
                        ? "bg-white font-semibold text-[#16181D] shadow-[0_3px_8px_rgba(22,24,29,.1)]"
                        : "font-normal text-[#767A86]"
                    }`}
                  >
                    {nome}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[20px]" />

            {/* Gráfico de Barras Mensal */}
            <div className="flex h-[150px] items-end gap-[9px]">
              {MESES.map((m) => (
                <div
                  key={m.nome}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-[6px]"
                >
                  <div
                    style={{ height: m.altura, background: m.grad }}
                    className="w-full rounded-[7px] cursor-pointer transition-all hover:brightness-95"
                  />
                  <span className="font-mono text-[9.5px] text-[#A2A6B2]">{m.nome}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Radar Executivo */}
          <div className="rounded-[16px] border border-white/95 bg-white/88 p-[18px_20px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[14.5px] font-bold tracking-[-0.3px] text-[#16181D]">
                Radar executivo
              </h2>
              <span className="font-mono text-[10.5px] text-[#A2A6B2]">hoje</span>
            </div>

            <div className="h-[14px]" />

            <div className="flex flex-col gap-[9px]">
              <div className="flex cursor-pointer items-start gap-[10px] rounded-[12px] border border-white/90 bg-gradient-to-br from-[#FBF3DE] to-[#FBEDE0] p-[12px]">
                <ClockIcon className="size-[17px] shrink-0 text-[#8A5A00]" />
                <div>
                  <p className="text-[12.5px] font-semibold text-[#16181D]">
                    {totalCidades > 0 ? `${totalCidades} municípios monitorados` : "Nenhum município monitorado"}
                  </p>
                  <p className="mt-[2px] font-mono text-[10.5px] text-[#767A86]">
                    bases FNDE · INEP · SICONFI sincronizadas
                  </p>
                </div>
              </div>

              <div className="flex cursor-pointer items-start gap-[10px] rounded-[12px] border border-white/90 bg-gradient-to-br from-[#E2EDFA] to-[#EAE7F8] p-[12px]">
                <FileTextIcon className="size-[17px] shrink-0 text-[#2C4E82]" />
                <div>
                  <p className="text-[12.5px] font-semibold text-[#16181D]">
                    Projeção anual de receita
                  </p>
                  <p className="mt-[2px] font-mono text-[10.5px] text-[#767A86]">
                    {formatCurrency(totalReceita)} em carteira
                  </p>
                </div>
              </div>

              <div className="flex cursor-pointer items-start gap-[10px] rounded-[12px] border border-white/90 bg-gradient-to-br from-[#E4F4EC] to-[#E9F5E4] p-[12px]">
                <CheckCircle2Icon className="size-[17px] shrink-0 text-[#1F6A47]" />
                <div>
                  <p className="text-[12.5px] font-semibold text-[#16181D]">
                    Status das bases oficiais
                  </p>
                  <p className="mt-[2px] font-mono text-[10.5px] text-[#767A86]">
                    VAAT 2026 · dados atualizados
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Linha 3: Tabela Cidades com Maior Projeção ───────────────────── */}
        <div className="overflow-hidden rounded-[16px] border border-white/95 bg-white/88 shadow-[0_10px_26px_rgba(22,24,29,.05)]">
          <div className="flex items-center justify-between p-[16px_20px]">
            <div className="flex items-baseline gap-[10px]">
              <h2 className="text-[14.5px] font-bold tracking-[-0.3px] text-[#16181D]">
                Cidades com maior projeção
              </h2>
              <span className="font-mono text-[10.5px] text-[#A2A6B2]">
                {totalCidades} municípios
              </span>
            </div>

            <div className="flex gap-[8px]">
              <button
                type="button"
                onClick={() => setWizardAberto(true)}
                className="flex h-[32px] items-center gap-[6px] rounded-[18px] bg-[#16181D] px-[14px] text-[12px] font-bold text-white transition-colors hover:bg-[#2C2F38]"
              >
                <PlusIcon className="size-[15px]" />
                Novo Município
              </button>
            </div>
          </div>

          {/* Cabeçalho da Tabela */}
          <div className="grid grid-cols-[1.8fr_.45fr_1.1fr_1.1fr_1.1fr_.7fr_.3fr] border-b border-[#F0F1F5] px-[8px] font-mono text-[9.5px] font-semibold tracking-[1px] text-[#A2A6B2] uppercase">
            <div className="p-[8px_12px]">Município</div>
            <div className="p-[8px_6px]">UF</div>
            <div className="p-[8px_6px]">Estágio</div>
            <div className="p-[8px_6px] text-right">Receita Est.</div>
            <div className="p-[8px_6px] text-right">Lucro Proj.</div>
            <div className="p-[8px_6px] text-right">Margem</div>
            <div />
          </div>

          {/* Linhas da Tabela Reais de Firestore */}
          <div className="p-[0_8px_8px]">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-[#767A86]">
                Carregando carteira de municípios…
              </div>
            ) : cities.length > 0 ? (
              cities.map((c) => {
                const estagioStyle = obtermEstagioBadgeStyle(c.stage);
                const receita = c.estimatedAnnualRevenue || 0;
                const lucro = receita * 0.35;

                return (
                  <Link
                    key={c.id}
                    href="/pipeline"
                    className="grid grid-cols-[1.8fr_.45fr_1.1fr_1.1fr_1.1fr_.7fr_.3fr] items-center rounded-[12px] transition-colors hover:bg-[#F7F6FA]"
                  >
                    <div className="p-[12px] text-[13.5px] font-semibold text-[#16181D]">
                      {c.name}
                    </div>
                    <div className="p-[12px_6px] font-mono text-[12px] text-[#767A86]">
                      {c.uf}
                    </div>
                    <div className="p-[12px_6px]">
                      <span
                        className="inline-flex items-center gap-[6px] rounded-[14px] px-[10px] py-[4px] font-mono text-[10.5px] font-semibold"
                        style={{
                          color: estagioStyle.chipTexto,
                          backgroundColor: estagioStyle.chipFundo,
                        }}
                      >
                        <span
                          className="size-[6px] rounded-full"
                          style={{ backgroundColor: estagioStyle.chipPonto }}
                        />
                        {STAGE_LABELS[c.stage] || estagioStyle.label}
                      </span>
                    </div>
                    <div className="p-[12px_6px] font-mono text-[12.5px] text-[#5A5E6A] text-right tabular-nums">
                      {formatCurrencyCompact(receita)}
                    </div>
                    <div className="p-[12px_6px] font-mono text-[12.5px] font-semibold text-[#16181D] text-right tabular-nums">
                      {formatCurrencyCompact(lucro)}
                    </div>
                    <div className="p-[12px_6px] font-mono text-[12.5px] text-right tabular-nums text-[#1F6A47]">
                      35,0%
                    </div>
                    <div className="text-center">
                      <ChevronRightIcon className="inline size-[17px] text-[#C9CBD4]" />
                    </div>
                  </Link>
                );
              })
            ) : (
              /* Empty State quando não há dados em Firestore */
              <div className="flex flex-col items-center justify-center p-[40px_20px] text-center">
                <div className="flex size-[48px] items-center justify-center rounded-full bg-[#F2F1F7]">
                  <Building2Icon className="size-[22px] text-[#767A86]" />
                </div>
                <h3 className="mt-3 text-[14px] font-bold text-[#16181D]">
                  Nenhum município cadastrado na carteira ainda
                </h3>
                <p className="mt-1 max-w-[380px] text-[12px] text-[#767A86]">
                  Adicione o seu primeiro município para iniciar o levantamento financeiro e acompanhamento no pipeline.
                </p>
                <button
                  type="button"
                  onClick={() => setWizardAberto(true)}
                  className="mt-4 flex h-[38px] items-center gap-[6px] rounded-[20px] bg-[#16181D] px-[18px] text-[12.5px] font-bold text-white shadow-2xs transition-colors hover:bg-[#2C2F38]"
                >
                  <PlusIcon className="size-[16px]" />
                  Adicionar Primeiro Município
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {wizardAberto && (
        <NovoLevantamentoWizard
          onClose={() => {
            setWizardAberto(false);
            refetch();
          }}
        />
      )}
    </>
  );
}
