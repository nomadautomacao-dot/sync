"use client";

import { useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  SearchIcon,
  CheckCircle2Icon,
  BoltIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  CheckIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";

import { useAuth } from "@/core/providers/auth-provider";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { createCity } from "@/core/lib/cities-firestore";

interface NovoLevantamentoWizardProps {
  onClose: () => void;
}

interface Municipio {
  nome: string;
  uf: string;
  ibge: string;
  matriculas: string;
  escolas: string;
  chip: string;
  chipTexto: string;
  chipFundo: string;
}

const MUNICIPIOS_SUGESTOES: Municipio[] = [
  {
    nome: "Senhor do Bonfim",
    uf: "BA",
    ibge: "2930105",
    matriculas: "14.203",
    escolas: "58",
    chip: "novo",
    chipTexto: "#5A5E6A",
    chipFundo: "#EFEFF4",
  },
  {
    nome: "Cristalina",
    uf: "GO",
    ibge: "5206206",
    matriculas: "11.688",
    escolas: "42",
    chip: "na carteira",
    chipTexto: "#8A3A50",
    chipFundo: "#FBE9EE",
  },
  {
    nome: "Águas Lindas de Goiás",
    uf: "GO",
    ibge: "5200258",
    matriculas: "10.914",
    escolas: "39",
    chip: "na carteira",
    chipTexto: "#8A3A50",
    chipFundo: "#FBE9EE",
  },
  {
    nome: "Senador José Porfírio",
    uf: "PA",
    ibge: "1507805",
    matriculas: "8.442",
    escolas: "31",
    chip: "proposta",
    chipTexto: "#8A5A00",
    chipFundo: "#FBF0D9",
  },
  {
    nome: "Miradouro",
    uf: "MG",
    ibge: "3142304",
    matriculas: "4.170",
    escolas: "17",
    chip: "estudo",
    chipTexto: "#1F6A47",
    chipFundo: "#E4F4EC",
  },
];

const METODOLOGIAS = [
  {
    nome: "Projeção recuperável",
    desc: "Ganho realista via correção de matrículas e habilitação VAAT/VAAR. É o número da proposta.",
  },
  {
    nome: "Benchmark",
    desc: "Compara com municípios semelhantes que otimizaram o fundo. Usado como teto de referência.",
  },
];

const SECOES = [
  { nome: "Cronograma VAAF mensal", fonte: "FNDE · portaria 2026" },
  { nome: "IDEB histórico e metas", fonte: "INEP · 2015–2023" },
  { nome: "Censo escolar detalhado", fonte: "INEP · censo 2025" },
  { nome: "Obras PAC2 e frota escolar", fonte: "FNDE · SIMEC" },
];

const PASSOS_GERACAO = [
  "Consultando FNDE — receitas e complementações",
  "Consultando INEP — censo escolar 2025",
  "Calculando projeção VAAF · VAAT · VAAR",
  "Formatando relatório dirigido",
];

export function NovoLevantamentoWizard({ onClose }: NovoLevantamentoWizardProps) {
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [munSel, setMunSel] = useState<number>(0);
  const [busca, setBusca] = useState("");
  const [exercicioSel, setExercicioSel] = useState<number>(1); // 0=2025, 1=2026
  const [recorteSel, setRecorteSel] = useState<number>(0); // 0=Municipal, 1=Pública, 2=Total
  const [metodoSel, setMetodoSel] = useState<number>(0);
  const [secoesOn, setSecoesOn] = useState<boolean[]>([true, true, true, false]);
  const [progresso, setProgresso] = useState<number>(-1);

  const mun = MUNICIPIOS_SUGESTOES[munSel];

  const { user } = useAuth();

  const iniciarGeracao = async () => {
    setProgresso(0);
    let step = 0;
    const interval = setInterval(async () => {
      step += 1;
      setProgresso(step);
      if (step >= 4) {
        clearInterval(interval);
        if (user?.groupId && mun) {
          try {
            const db = getFirebaseDb();
            await createCity(db, user.groupId, {
              name: mun.nome,
              uf: mun.uf,
              codigoIbge: mun.ibge,
              stage: "technical_diagnostic",
              estimatedAnnualRevenue: 8410000,
            });
          } catch (e) {
            console.error("Erro ao salvar municipio no Firestore:", e);
          }
        }
      }
    }, 850);
  };

  const toggleSecao = (index: number) => {
    setSecoesOn((prev) => prev.map((val, i) => (i === index ? !val : val)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16181D]/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-[820px] max-w-full overflow-hidden rounded-[18px] border border-white/95 bg-white/95 p-[22px] shadow-[0_14px_36px_rgba(22,24,29,.12)] backdrop-blur-xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-[#767A86] transition-colors hover:bg-[#F2F1F7] hover:text-[#16181D]"
        >
          <XIcon className="size-4" />
        </button>

        {/* Wizard Header */}
        <div className="flex items-center gap-[14px]">
          <button
            type="button"
            onClick={etapa > 1 ? () => setEtapa((etapa - 1) as 1 | 2) : onClose}
            className="flex size-[38px] items-center justify-center rounded-full border border-white/95 bg-white/88 shadow-[0_6px_16px_rgba(22,24,29,.07)] transition-colors hover:bg-white"
          >
            <ArrowLeftIcon className="size-[18px] text-[#16181D]" />
          </button>

          <div>
            <h2 className="text-[21px] font-bold tracking-[-0.7px] text-[#16181D]">
              Novo levantamento FUNDEB
            </h2>
            <p className="font-mono text-[10.5px] text-[#767A86]">
              exercício 2026 · bases oficiais FNDE · INEP · SICONFI
            </p>
          </div>

          <div className="flex-1" />

          {/* Stepper pills */}
          <div className="flex gap-[6px]">
            {["Município", "Parâmetros", "Gerar"].map((nome, i) => {
              const numEtapa = i + 1;
              const ativa = etapa === numEtapa;
              const feita = etapa > numEtapa;

              return (
                <div
                  key={nome}
                  className={`flex items-center gap-[7px] rounded-[18px] border border-white/90 p-[6px_13px_6px_7px] ${
                    ativa ? "bg-white" : "bg-white/50"
                  }`}
                >
                  <div
                    className={`flex size-[20px] items-center justify-center rounded-full font-mono text-[10px] font-semibold ${
                      ativa || feita ? "bg-[#16181D] text-white" : "bg-[#ECEBF2] text-[#767A86]"
                    }`}
                  >
                    {feita ? "✓" : numEtapa}
                  </div>
                  <span
                    className={`text-[12px] font-semibold ${
                      ativa ? "text-[#16181D]" : "text-[#767A86]"
                    }`}
                  >
                    {nome}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-5" />

        {/* ── ETAPA 1: ESCOLHA O MUNICÍPIO ────────────────────────────────── */}
        {etapa === 1 && (
          <div className="rounded-[18px] border border-white/95 bg-white/88 p-[22px] shadow-[0_14px_36px_rgba(22,24,29,.06)]">
            <h3 className="text-[15px] font-bold tracking-[-0.3px] text-[#16181D]">
              Escolha o município
            </h3>
            <p className="mt-[3px] text-[12.5px] text-[#767A86]">
              Qualquer um dos 5.570 municípios. Os dados são consultados nas bases oficiais na hora.
            </p>

            <div className="h-4" />

            <div className="flex h-[46px] items-center gap-[10px] rounded-[24px] border border-white/90 bg-[#F2F1F7] px-[16px]">
              <SearchIcon className="size-[18px] text-[#A2A6B2]" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome do município ou código IBGE…"
                className="flex-1 bg-transparent text-[13.5px] text-[#16181D] outline-none placeholder:text-[#A2A6B2]"
              />
            </div>

            <div className="h-4" />

            <div className="px-[4px] font-mono text-[9.5px] font-semibold tracking-[1.3px] text-[#A2A6B2]">
              SUGESTÕES · REGIÃO DA CARTEIRA
            </div>

            <div className="h-2" />

            <div className="flex flex-col gap-[4px]">
              {MUNICIPIOS_SUGESTOES.filter((m) =>
                m.nome.toLowerCase().includes(busca.toLowerCase()) || m.ibge.includes(busca)
              ).map((m, i) => {
                const indexReal = MUNICIPIOS_SUGESTOES.indexOf(m);
                const selecionado = munSel === indexReal;

                return (
                  <div
                    key={m.ibge}
                    onClick={() => setMunSel(indexReal)}
                    className={`flex items-center gap-[12px] rounded-[12px] border p-[11px_14px] cursor-pointer transition-all ${
                      selecionado
                        ? "border-[#D9D7E2] bg-[#F2F1F7]"
                        : "border-transparent bg-transparent hover:bg-[#F7F6FA]"
                    }`}
                  >
                    <div
                      className={`flex size-[30px] items-center justify-center rounded-[10px] font-mono text-[11px] font-semibold ${
                        selecionado ? "bg-[#16181D] text-white" : "bg-[#F2F1F7] text-[#5A5E6A]"
                      }`}
                    >
                      {m.uf}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-[#16181D]">{m.nome}</p>
                      <p className="mt-[1px] font-mono text-[10px] text-[#767A86]">
                        IBGE {m.ibge} · {m.matriculas} matrículas · {m.escolas} escolas
                      </p>
                    </div>

                    <span
                      className="rounded-[12px] px-[9px] py-[3px] font-mono text-[10px] font-semibold whitespace-nowrap"
                      style={{ color: m.chipTexto, backgroundColor: m.chipFundo }}
                    >
                      {m.chip}
                    </span>

                    {selecionado && <CheckCircle2Icon className="size-[18px] text-[#16181D]" />}
                  </div>
                );
              })}
            </div>

            <div className="h-[18px]" />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setEtapa(2)}
                className="flex h-[44px] items-center gap-[8px] rounded-[24px] bg-[#16181D] px-[22px] text-white transition-colors hover:bg-[#2C2F38]"
              >
                <span className="text-[13.5px] font-semibold text-white">Continuar</span>
                <ArrowRightIcon className="size-[17px] text-white" />
              </button>
            </div>
          </div>
        )}

        {/* ── ETAPA 2: PARÂMETROS ────────────────────────────────────────── */}
        {etapa === 2 && (
          <div className="rounded-[18px] border border-white/95 bg-white/88 p-[22px] shadow-[0_14px_36px_rgba(22,24,29,.06)]">
            <h3 className="text-[15px] font-bold tracking-[-0.3px] text-[#16181D]">
              Parâmetros da projeção
            </h3>
            <p className="mt-[3px] text-[12.5px] text-[#767A86]">
              {mun.nome} · {mun.uf} · os padrões abaixo seguem a metodologia da consultoria.
            </p>

            <div className="h-5" />

            <div className="grid grid-cols-2 gap-[22px]">
              {/* Coluna Esquerda */}
              <div>
                <div className="font-mono text-[9.5px] font-semibold tracking-[1.3px] text-[#A2A6B2]">
                  EXERCÍCIO
                </div>
                <div className="h-2" />
                <div className="flex w-fit rounded-[20px] bg-[#F2F1F7] p-[3px]">
                  {["2025", "2026"].map((ano, i) => (
                    <button
                      key={ano}
                      type="button"
                      onClick={() => setExercicioSel(i)}
                      className={`rounded-[17px] px-[18px] py-[7px] font-mono text-[12px] transition-all ${
                        exercicioSel === i
                          ? "bg-white font-semibold text-[#16181D] shadow-[0_3px_8px_rgba(22,24,29,.1)]"
                          : "font-normal text-[#767A86]"
                      }`}
                    >
                      {ano}
                    </button>
                  ))}
                </div>

                <div className="h-5" />

                <div className="font-mono text-[9.5px] font-semibold tracking-[1.3px] text-[#A2A6B2]">
                  RECORTE DO CENSO
                </div>
                <div className="h-2" />
                <div className="flex flex-wrap gap-[6px]">
                  {["Municipal", "Pública", "Total"].map((nome, i) => (
                    <button
                      key={nome}
                      type="button"
                      onClick={() => setRecorteSel(i)}
                      className={`rounded-[18px] px-[14px] py-[8px] text-[12.5px] font-semibold transition-all ${
                        recorteSel === i
                          ? "border border-[#16181D] bg-white text-[#16181D]"
                          : "border border-[#ECEDF2] bg-transparent text-[#767A86]"
                      }`}
                    >
                      {nome}
                    </button>
                  ))}
                </div>

                <div className="h-5" />

                <div className="font-mono text-[9.5px] font-semibold tracking-[1.3px] text-[#A2A6B2]">
                  METODOLOGIA
                </div>
                <div className="h-2" />
                <div className="flex flex-col gap-[6px]">
                  {METODOLOGIAS.map((mt, i) => (
                    <div
                      key={mt.nome}
                      onClick={() => setMetodoSel(i)}
                      className={`flex items-start gap-[10px] rounded-[12px] border p-[12px_14px] cursor-pointer transition-all ${
                        metodoSel === i
                          ? "border-[#D9D7E2] bg-[#F2F1F7]"
                          : "border-[#ECEDF2] bg-transparent"
                      }`}
                    >
                      <div
                        className={`mt-[1px] size-[16px] shrink-0 rounded-full border ${
                          metodoSel === i
                            ? "border-[5px] border-[#16181D] bg-white"
                            : "border-[2px] border-[#C9CBD4] bg-white"
                        }`}
                      />
                      <div>
                        <p className="text-[13px] font-semibold text-[#16181D]">{mt.nome}</p>
                        <p className="mt-[2px] text-[11.5px] leading-[1.4] text-[#767A86]">
                          {mt.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna Direita: Seções */}
              <div>
                <div className="font-mono text-[9.5px] font-semibold tracking-[1.3px] text-[#A2A6B2]">
                  SEÇÕES DO RELATÓRIO
                </div>
                <div className="h-2" />
                <div className="flex flex-col">
                  {SECOES.map((sec, i) => (
                    <div
                      key={sec.nome}
                      onClick={() => toggleSecao(i)}
                      className="flex items-center gap-[11px] border-b border-[#F0F1F5] p-[12px_4px] cursor-pointer"
                    >
                      <FileSpreadsheetIcon className="size-[17px] text-[#767A86]" />
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-[#16181D]">{sec.nome}</p>
                        <p className="mt-[1px] font-mono text-[9.5px] text-[#A2A6B2]">{sec.fonte}</p>
                      </div>
                      {/* Custom Switch */}
                      <div
                        className={`relative h-[21px] w-[36px] shrink-0 rounded-[20px] transition-colors duration-150 ${
                          secoesOn[i] ? "bg-[#16181D]" : "bg-[#C9CBD4]"
                        }`}
                      >
                        <span
                          className={`absolute top-[2px] size-[17px] rounded-full bg-white shadow-[0_1px_3px_rgba(22,24,29,.2)] transition-all duration-150 ${
                            secoesOn[i] ? "left-[17px]" : "left-[2px]"
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-5" />

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setEtapa(1)}
                className="flex h-[44px] items-center gap-[7px] rounded-[24px] bg-[#F2F1F7] px-[18px] transition-colors hover:bg-[#ECEBF2]"
              >
                <ArrowLeftIcon className="size-[17px] text-[#3B3F4A]" />
                <span className="text-[13.5px] font-semibold text-[#3B3F4A]">Voltar</span>
              </button>

              <button
                type="button"
                onClick={() => setEtapa(3)}
                className="flex h-[44px] items-center gap-[8px] rounded-[24px] bg-[#16181D] px-[22px] text-white transition-colors hover:bg-[#2C2F38]"
              >
                <span className="text-[13.5px] font-semibold text-white">Revisar e gerar</span>
                <ArrowRightIcon className="size-[17px] text-white" />
              </button>
            </div>
          </div>
        )}

        {/* ── ETAPA 3: REVISÃO & GERAR ───────────────────────────────────── */}
        {etapa === 3 && (
          <div className="rounded-[18px] border border-white/95 bg-white/88 p-[22px] shadow-[0_14px_36px_rgba(22,24,29,.06)]">
            {progresso < 4 ? (
              <>
                <h3 className="text-[15px] font-bold tracking-[-0.3px] text-[#16181D]">Revisão</h3>
                <div className="h-[14px]" />

                <div className="rounded-[14px] bg-[#F7F6FA] p-[6px_16px]">
                  {[
                    { rotulo: "MUNICÍPIO", valor: `${mun.nome} · ${mun.uf} · IBGE ${mun.ibge}` },
                    { rotulo: "EXERCÍCIO", valor: ["2025", "2026"][exercicioSel] },
                    { rotulo: "RECORTE DO CENSO", valor: ["Municipal", "Pública", "Total"][recorteSel] },
                    { rotulo: "METODOLOGIA", valor: METODOLOGIAS[metodoSel].nome },
                    { rotulo: "SEÇÕES", valor: `${secoesOn.filter(Boolean).length} de 4 incluídas` },
                  ].map((rs) => (
                    <div
                      key={rs.rotulo}
                      className="flex items-baseline justify-between border-b border-[#EFEFF4] py-[10px] last:border-none"
                    >
                      <span className="font-mono text-[10px] font-semibold tracking-[1px] text-[#A2A6B2]">
                        {rs.rotulo}
                      </span>
                      <span className="text-[13px] font-semibold text-[#16181D]">{rs.valor}</span>
                    </div>
                  ))}
                </div>

                <div className="h-[18px]" />

                {progresso < 0 ? (
                  <div className="flex justify-between">
                    <button
                      type="button"
                      onClick={() => setEtapa(2)}
                      className="flex h-[44px] items-center gap-[7px] rounded-[24px] bg-[#F2F1F7] px-[18px] transition-colors hover:bg-[#ECEBF2]"
                    >
                      <ArrowLeftIcon className="size-[17px] text-[#3B3F4A]" />
                      <span className="text-[13.5px] font-semibold text-[#3B3F4A]">Voltar</span>
                    </button>

                    <button
                      type="button"
                      onClick={iniciarGeracao}
                      className="flex h-[46px] items-center gap-[9px] rounded-[26px] bg-[#16181D] px-[26px] text-white shadow-[0_12px_26px_rgba(22,24,29,.2)] transition-colors hover:bg-[#2C2F38]"
                    >
                      <BoltIcon className="size-[18px] text-white" />
                      <span className="text-[14px] font-semibold text-white">Gerar levantamento</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-[4px]">
                    {PASSOS_GERACAO.map((nome, i) => {
                      const feito = progresso > i;
                      const ativo = progresso === i;

                      return (
                        <div
                          key={nome}
                          className={`flex items-center gap-[11px] py-[9px] px-[4px] transition-opacity ${
                            feito || ativo ? "opacity-100" : "opacity-45"
                          }`}
                        >
                          {feito ? (
                            <CheckCircle2Icon className="size-[17px] text-[#1F6A47]" />
                          ) : ativo ? (
                            <Loader2Icon className="size-[17px] animate-spin text-[#16181D]" />
                          ) : (
                            <span className="size-[17px] rounded-full border border-[#C9CBD4]" />
                          )}
                          <span
                            className={`flex-1 text-[13px] ${
                              ativo ? "font-semibold text-[#16181D]" : "font-normal text-[#16181D]"
                            }`}
                          >
                            {nome}
                          </span>
                          <span className="font-mono text-[10px] text-[#A2A6B2]">
                            {feito ? "ok" : ativo ? "…" : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* CONCLUÍDO */
              <div>
                <div className="flex flex-col items-center p-[10px_0_6px] text-center">
                  <div className="flex size-[52px] items-center justify-center rounded-full bg-gradient-to-br from-[#E4F4EC] to-[#E9F5E4]">
                    <CheckCircle2Icon className="size-[26px] text-[#1F6A47]" />
                  </div>
                  <div className="h-3" />
                  <h3 className="text-[18px] font-bold tracking-[-0.5px] text-[#16181D]">
                    Levantamento pronto
                  </h3>
                  <p className="mt-[3px] font-mono text-[10.5px] text-[#767A86]">
                    {mun.nome} · lote 2026-07 · v1 · 4 min 12 s
                  </p>
                </div>

                <div className="h-[18px]" />

                <div className="grid grid-cols-3 gap-[12px]">
                  <div className="rounded-[14px] bg-[#F7F6FA] p-[15px_16px]">
                    <div className="font-mono text-[9.5px] font-semibold tracking-[1.1px] text-[#A2A6B2]">
                      TOTAL ATUAL
                    </div>
                    <div className="h-2" />
                    <div className="font-mono text-[24px] font-semibold tracking-[-1.2px] text-[#16181D] tabular-nums">
                      R$ 8,41M
                    </div>
                  </div>

                  <div className="rounded-[14px] bg-gradient-to-br from-[#EEE7F9] to-[#E2EDFA] p-[15px_16px]">
                    <div className="font-mono text-[9.5px] font-semibold tracking-[1.1px] text-[#5A5E6A]">
                      TOTAL PROJETADO
                    </div>
                    <div className="h-2" />
                    <div className="font-mono text-[24px] font-semibold tracking-[-1.2px] text-[#16181D] tabular-nums">
                      R$ 9,24M
                    </div>
                  </div>

                  <div className="rounded-[14px] bg-gradient-to-br from-[#E4F4EC] to-[#E9F5E4] p-[15px_16px]">
                    <div className="font-mono text-[9.5px] font-semibold tracking-[1.1px] text-[#1F6A47]">
                      GANHO RECUPERÁVEL
                    </div>
                    <div className="h-2" />
                    <div className="font-mono text-[24px] font-semibold tracking-[-1.2px] text-[#1F6A47] tabular-nums">
                      +R$ 828,7K
                    </div>
                  </div>
                </div>

                <div className="h-[18px]" />

                <div className="flex justify-center gap-[10px]">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-[44px] items-center gap-[8px] rounded-[24px] bg-[#16181D] px-[20px] text-white transition-colors hover:bg-[#2C2F38]"
                  >
                    <DownloadIcon className="size-[17px] text-white" />
                    <span className="text-[13.5px] font-semibold text-white">Baixar PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-[44px] items-center gap-[8px] rounded-[24px] bg-[#F2F1F7] px-[20px] text-[#3B3F4A] transition-colors hover:bg-[#ECEBF2]"
                  >
                    <FileTextIcon className="size-[17px] text-[#3B3F4A]" />
                    <span className="text-[13.5px] font-semibold text-[#3B3F4A]">Criar proposta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEtapa(1);
                      setProgresso(-1);
                    }}
                    className="flex h-[44px] items-center rounded-[24px] px-[18px] text-[#767A86] transition-colors hover:bg-[#F2F1F7]"
                  >
                    <span className="text-[13.5px] font-semibold text-[#767A86]">Novo levantamento</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
