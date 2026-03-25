"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Check,
  Building2,
  ChevronsUpDown,
  ChevronDown,
  FileDown,
  FileText,
  Loader2,
  MapPinned,
  Presentation,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/core/lib/utils";
import type {
  FonteColetaStatus,
  RelatorioFundeb,
  ReceitasFundeb,
  SistemaHabilitacao,
} from "./types";
import {
  calcularCronogramaVAAF,
  calcularProjecaoPorMultiplicador,
  calcularReceitas,
  createEmptyCensoEscolar,
  createDefaultFontes,
  formatCurrency,
  formatInteger,
  formatPercent,
  hydrateRelatorioFundeb,
  toNumber,
  validarCodigoIBGE,
} from "./utils/calculos";
import {
  generateLevantamentoFundebPdf,
  generateLevantamentoFundebPdfAutonomo,
  generateLevantamentoFundebPdfPackageAutonomo,
  type LevantamentoFundebAutonomoParams,
  type TipoRelatorio,
} from "./utils/generate-levantamento-fundeb-pdf";

const REPORT_ELEMENT_ID = "levantamento-fundeb-preview";

const STATUS_OPTIONS = [
  "Nao informado",
  "Senha Ativa",
  "Habilitado",
  "Senha Expirada",
  "Senha Inativa",
] as const;

interface MunicipioSuggestion {
  codigo_ibge: string;
  nome: string;
  uf: string;
  regiao: string;
}

interface MunicipioCompletoResponse {
  data?: {
    dados_basicos?: {
      codigo_ibge?: string;
      nome?: string;
      uf?: string;
      regiao?: string;
    };
    educacao?: {
      indicadores_aprendizagem?: {
        disponivel?: boolean;
      };
    };
    fiscal?: {
      fundeb?: {
        disponivel?: boolean;
        fonte?: string;
        receita?: {
          receita_total_prevista?: number;
        };
      };
      siconfi?: {
        disponivel?: boolean;
      };
    };
    relatorio_fundeb?: RelatorioFundeb;
  };
  success?: boolean;
  error?: string;
}

function getBadgeVariant(status: FonteColetaStatus["status"]) {
  if (status === "automatico") {
    return "active" as const;
  }
  if (status === "estimado") {
    return "warning" as const;
  }
  if (status === "indisponivel") {
    return "error" as const;
  }
  return "warning" as const;
}

function getSistemaVariant(situacao: string) {
  if (situacao === "Senha Ativa" || situacao === "Habilitado") {
    return "active" as const;
  }
  if (situacao === "Senha Expirada") {
    return "warning" as const;
  }
  if (situacao === "Senha Inativa") {
    return "error" as const;
  }
  return "default" as const;
}

function numberInputValue(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  return Number.isFinite(value) ? String(value) : "";
}

function buildFontesFromSyncApi(payload?: MunicipioCompletoResponse["data"]): FonteColetaStatus[] {
  const fundebDisponivel = payload?.fiscal?.fundeb?.disponivel ?? false;
  const fundebFonte = payload?.fiscal?.fundeb?.fonte;
  const inepDisponivel = (payload?.relatorio_fundeb?.censoEscolar?.totalMatriculas ?? 0) > 0;
  const qeduDisponivel = payload?.educacao?.indicadores_aprendizagem?.disponivel ?? false;
  const siconfiDisponivel = payload?.fiscal?.siconfi?.disponivel ?? false;
  const fundebEstimado = fundebFonte?.toLowerCase().includes("estimativa calibrada") ?? false;
  const pddeDisponivel = (payload?.relatorio_fundeb?.pdde ?? []).some((item) => item.valor > 0);
  const sistemas = payload?.relatorio_fundeb?.sistemas ?? [];
  const sistemasPublicos =
    sistemas.some((item) => /consulta publica|credencial|pdde info/i.test(item.situacao)) ||
    (payload?.relatorio_fundeb?.situacaoPAR ?? "").toLowerCase() !== "nao informado";

  return [
    {
      id: "ibge",
      label: "IBGE",
      status: "automatico",
      descricao: "Busca, identificacao territorial e codigo IBGE resolvidos automaticamente pela API interna do Sync.",
    },
    {
      id: "fnde-siconfi",
      label: "FNDE / SICONFI",
      status: siconfiDisponivel || fundebDisponivel ? (fundebEstimado ? "estimado" : "automatico") : "manual",
      descricao:
        siconfiDisponivel
          ? `FUNDEB e bloco fiscal carregados automaticamente com SICONFI/Tesouro e base anual (${fundebFonte ?? "Sync"}).`
          : fundebEstimado
          ? `Linha de base FUNDEB estimada automaticamente a partir de INEP, IBGE e contexto VAAT (${fundebFonte ?? "Sync"}).`
          : fundebDisponivel
          ? `Receitas FUNDEB preenchidas automaticamente pela base oficial (${fundebFonte ?? "FNDE"}).`
          : "Receitas FUNDEB e fiscal ainda exigem complemento manual ate integracao completa da base anual.",
    },
    {
      id: "simec",
      label: "MEC / FNDE Operacional",
      status: sistemasPublicos ? "estimado" : "manual",
      descricao: sistemasPublicos
        ? "Consultas publicas do FNDE e evidencias operacionais foram enriquecidas automaticamente. Status internos detalhados de SIMEC/Habilita ainda dependem de credencial do ente."
        : "Compatibilidade local preparada; dados seguem em fallback ate portar a coleta publica e os acessos autenticados para o Sync.",
    },
    {
      id: "inep-qedu",
      label: "INEP / QEdu",
      status: qeduDisponivel || inepDisponivel ? "automatico" : "manual",
      descricao: qeduDisponivel
        ? "Aprendizagem, IDEB, aprovacao e distorcao foram carregados automaticamente por divulgacao oficial do INEP, sem depender do scraping direto do QEdu."
        : inepDisponivel
        ? "Censo escolar consolidado da rede publica carregado automaticamente pela base interna do INEP, em recorte comparavel ao QEdu."
        : "Estrutura pronta para automacao; indicadores e censo ainda usam placeholders nesta fase.",
    },
    {
      id: "pdde-fnde",
      label: "PDDE / FNDE",
      status: pddeDisponivel ? "automatico" : sistemasPublicos ? "estimado" : "manual",
      descricao: pddeDisponivel
        ? "PDDE Info consolidado automaticamente com base na consulta publica do FNDE para o municipio."
        : sistemasPublicos
        ? "Consulta publica do PDDE Info localizada, mas o valor monetario ainda nao foi consolidado automaticamente neste recorte."
        : "PDDE ainda sem consolidacao automatica neste municipio.",
    },
  ];
}

function PreviewSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 space-y-1">
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        {description ? <p className="text-sm text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SummaryMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--sync-text-tertiary)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--sync-text-primary)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--sync-text-secondary)]">{helper}</p>
    </div>
  );
}

function PreviewTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-slate-100 text-left text-slate-700">
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-slate-200 px-4 py-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white text-slate-700">
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`} className="odd:bg-white even:bg-slate-50/70">
              {row.map((cell, cellIndex) => (
                <td key={`cell-${rowIndex}-${cellIndex}`} className="border-t border-slate-200 px-4 py-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyTableMessage({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">{text}</p>;
}

function buildProjectionLabel(relatorio: RelatorioFundeb) {
  if (relatorio.projecaoComercial) {
    return "Projecao Rocha Prime";
  }

  return relatorio.upsideCondicionado ? "Ganho recuperavel" : "Projecao recuperavel";
}

function getLevantamentoProjection(relatorio: RelatorioFundeb) {
  return relatorio.projecaoComercial ?? relatorio.projecaoRecuperavel ?? relatorio.projecao;
}

function getPrefeitoDisplay(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === "nao informado") {
    return "A ser confirmado pela Secretaria Municipal";
  }

  return normalized;
}

function getPartidoDisplay(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === "nao informado") {
    return "—";
  }

  return normalized;
}

export function LevantamentoFundebPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [municipioQuery, setMunicipioQuery] = useState("");
  const [municipioUf, setMunicipioUf] = useState("");
  const [municipioSuggestions, setMunicipioSuggestions] = useState<MunicipioSuggestion[]>([]);
  const [isSearchingMunicipio, setIsSearchingMunicipio] = useState(false);
  const [codigoIbge, setCodigoIbge] = useState("");
  const [exercicio, setExercicio] = useState(String(new Date().getFullYear()));
  const [fontes, setFontes] = useState<FonteColetaStatus[]>(createDefaultFontes());
  const [relatorio, setRelatorio] = useState<RelatorioFundeb | null>(null);
  const [loading, setLoading] = useState(false);

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingAutonomous, setExportingAutonomous] = useState(false);

  const hasCodigoIbge = validarCodigoIBGE(codigoIbge);
  const hasNameSearch = municipioQuery.trim().length >= 2 && municipioUf.trim().length === 2;
  const canExport = !!relatorio && !loading && !exportingPdf && !exportingAutonomous;
  const canExportAutonomous = !loading && !exportingPdf && !exportingAutonomous && (hasCodigoIbge || hasNameSearch);

  useEffect(() => {
    const query = municipioQuery.trim();

    if (query.length < 2) {
      setMunicipioSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearchingMunicipio(true);

      try {
        const params = new URLSearchParams({ q: query });
        if (municipioUf.trim()) {
          params.set("uf", municipioUf.trim().toUpperCase());
        }

        const response = await fetch(`/api/municipios/buscar?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Falha ao buscar municipios.");
        }

        setMunicipioSuggestions(payload.data ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMunicipioSuggestions([]);
        }
      } finally {
        setIsSearchingMunicipio(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [municipioQuery, municipioUf]);

  async function handleLoadMunicipio() {
    if (!hasCodigoIbge && !hasNameSearch) {
      toast.error("Informe um codigo IBGE valido ou selecione um municipio pela busca automatica.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/municipio/completo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          hasCodigoIbge
            ? { codigo_ibge: codigoIbge, exercicio: Number(exercicio) }
            : { nome: municipioQuery.trim(), uf: municipioUf.trim().toUpperCase(), exercicio: Number(exercicio) },
        ),
      });

      const payload = (await response.json()) as MunicipioCompletoResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel carregar o municipio.");
      }

      const relatorioFundeb = payload.data?.relatorio_fundeb;
      if (!relatorioFundeb) {
        throw new Error("A API interna nao retornou o relatorio FUNDEB.");
      }

      setRelatorio(relatorioFundeb);
      setFontes(buildFontesFromSyncApi(payload.data));
      setCodigoIbge(payload.data?.dados_basicos?.codigo_ibge ?? relatorioFundeb.identificacao.codigoIBGE);
      setMunicipioQuery(payload.data?.dados_basicos?.nome ?? relatorioFundeb.identificacao.municipioNome);
      setMunicipioUf(payload.data?.dados_basicos?.uf ?? relatorioFundeb.identificacao.uf);
      toast.success(`Levantamento iniciado para ${relatorioFundeb.identificacao.municipio}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar o levantamento.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectMunicipio(option: MunicipioSuggestion) {
    setMunicipioQuery(option.nome);
    setMunicipioUf(option.uf);
    setCodigoIbge(option.codigo_ibge);
    setSearchOpen(false);
  }

  function buildAutonomousRequest(): LevantamentoFundebAutonomoParams | null {
    if (hasCodigoIbge) {
      return {
        codigo_ibge: codigoIbge,
        exercicio: Number(exercicio),
      };
    }

    if (hasNameSearch) {
      return {
        nome: municipioQuery.trim(),
        uf: municipioUf.trim().toUpperCase(),
        exercicio: Number(exercicio),
      };
    }

    return null;
  }

  async function handleExportPdf(tipo: TipoRelatorio = "levantamento") {
    if (!relatorio) {
      return;
    }

    setExportingPdf(true);
    try {
      await generateLevantamentoFundebPdf(relatorio, tipo);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel exportar o PDF.";
      toast.error(message);
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleExportAutonomousPdf(tipo: TipoRelatorio = "levantamento") {
    const params = buildAutonomousRequest();

    if (!params) {
      toast.error("Informe um codigo IBGE valido ou selecione um municipio para exportacao autonoma.");
      return;
    }

    setExportingAutonomous(true);
    try {
      await generateLevantamentoFundebPdfAutonomo(params, tipo);
      toast.success("PDF autonomo gerado com sucesso.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel gerar o PDF autonomo.";
      toast.error(message);
    } finally {
      setExportingAutonomous(false);
    }
  }

  async function handleExportAutonomousPackage() {
    const params = buildAutonomousRequest();

    if (!params) {
      toast.error("Informe um codigo IBGE valido ou selecione um municipio para gerar o pacote autonomo.");
      return;
    }

    setExportingAutonomous(true);
    try {
      await generateLevantamentoFundebPdfPackageAutonomo(params);
      toast.success("Pacote autonomo disparado: diagnostico, executiva e comparativa.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel gerar o pacote autonomo.";
      toast.error(message);
    } finally {
      setExportingAutonomous(false);
    }
  }

  function rehydrateWithDerivedFields(base: RelatorioFundeb) {
    const receitas = calcularReceitas(base.receitas);
    const multiplicadorBase =
      base.perfilComercial?.multiplicador ?? base.projecaoComercial?.multiplicadorAplicado ?? null;
    const metodologiaComercial =
      base.projecaoComercial?.metodologia ??
      (base.perfilComercial
        ? `Benchmark comercial Rocha Prime (${base.perfilComercial.faixa}) baseado em score ${base.perfilComercial.score.toFixed(2)}.`
        : undefined);
    const projecaoComercial =
      multiplicadorBase && receitas.totalReceitas > 0
        ? calcularProjecaoPorMultiplicador(receitas, multiplicadorBase, metodologiaComercial, {
            perfilComercial: base.perfilComercial,
          })
        : null;
    const cronogramaBase = projecaoComercial ?? base.projecaoRecuperavel ?? base.projecao;
    const rest = {
      ...base,
    } as Partial<RelatorioFundeb> & {
      identificacao: RelatorioFundeb["identificacao"];
    };
    delete rest.projecao;
    delete rest.projecaoRecuperavel;
    delete rest.projecaoComercial;
    delete rest.upsideCondicionado;
    delete rest.cronogramaVAAF;

    return hydrateRelatorioFundeb({
      ...rest,
      receitas,
      projecaoComercial,
      cronogramaVAAF: calcularCronogramaVAAF(
        cronogramaBase.vaafProjetado,
        receitas.totalReceitas,
      ),
    });
  }

  function updateRelatorio(updater: (current: RelatorioFundeb) => RelatorioFundeb) {
    setRelatorio((current) => {
      if (!current) {
        return current;
      }

      return rehydrateWithDerivedFields(updater(current));
    });
  }

  function updateReceitaField(field: keyof Omit<ReceitasFundeb, "totalReceitas">, value: string) {
    updateRelatorio((current) => ({
      ...current,
      receitas: {
        ...current.receitas,
        [field]: toNumber(value),
      },
    }));
  }

  function updateSistema(index: number, situacao: SistemaHabilitacao["situacao"]) {
    updateRelatorio((current) => ({
      ...current,
      sistemas: current.sistemas.map((sistema, systemIndex) =>
        systemIndex === index ? { ...sistema, situacao } : sistema,
      ),
    }));
  }

  const revenueRows = useMemo(() => {
    if (!relatorio) {
      return [];
    }

    const total = relatorio.receitas.totalReceitas || 1;

    return [
      ["Receita de Contribuicao Municipal", relatorio.receitas.receitaContribuicaoMunicipal],
      ["Complementacao VAAF", relatorio.receitas.complementacaoVAAF],
      ["Complementacao VAAT", relatorio.receitas.complementacaoVAAT],
      ["Complementacao VAAR", relatorio.receitas.complementacaoVAAR],
      ["Total Geral de Receitas Previstas", relatorio.receitas.totalReceitas],
    ].map(([label, value]) => [
      label,
      formatCurrency(value as number),
      `${(((value as number) / total) * 100).toFixed(2)}%`,
    ]);
  }, [relatorio]);

  const activeProjection = relatorio ? getLevantamentoProjection(relatorio) : null;
  const projectionLabel = relatorio ? buildProjectionLabel(relatorio) : "Projecao";

  const projectionRows = useMemo(() => {
    if (!relatorio) {
      return [];
    }

    const projection = getLevantamentoProjection(relatorio);

    return [
      ["VAAF", projection.vaafAtual, projection.vaafProjetado, projection.vaafGanho],
      ["VAAT", projection.vaatAtual, projection.vaatProjetado, projection.vaatGanho],
      ["VAAR", projection.vaarAtual, projection.vaarProjetado, projection.vaarGanho],
      ["TOTAL", projection.totalAtual, projection.totalProjetado, projection.totalGanho],
    ].map(([label, atual, projetado, ganho]) => [
      label,
      formatCurrency(atual as number),
      formatCurrency(projetado as number),
      <span
        key={`${label}-ganho`}
        className={(ganho as number) >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}
      >
        {formatCurrency(ganho as number)}
      </span>,
    ]);
  }, [relatorio]);

  const technicalProjectionRows = useMemo(() => {
    if (!relatorio?.projecaoComercial || !relatorio.projecaoRecuperavel) {
      return [];
    }

    return [
      [
        "VAAF",
        relatorio.projecaoRecuperavel.vaafAtual,
        relatorio.projecaoRecuperavel.vaafProjetado,
        relatorio.projecaoRecuperavel.vaafGanho,
      ],
      [
        "VAAT",
        relatorio.projecaoRecuperavel.vaatAtual,
        relatorio.projecaoRecuperavel.vaatProjetado,
        relatorio.projecaoRecuperavel.vaatGanho,
      ],
      [
        "VAAR",
        relatorio.projecaoRecuperavel.vaarAtual,
        relatorio.projecaoRecuperavel.vaarProjetado,
        relatorio.projecaoRecuperavel.vaarGanho,
      ],
      [
        "TOTAL",
        relatorio.projecaoRecuperavel.totalAtual,
        relatorio.projecaoRecuperavel.totalProjetado,
        relatorio.projecaoRecuperavel.totalGanho,
      ],
    ].map(([label, atual, projetado, ganho]) => [
      label,
      formatCurrency(atual as number),
      formatCurrency(projetado as number),
      formatCurrency(ganho as number),
    ]);
  }, [relatorio]);

  const cronogramaRows = useMemo(() => {
    if (!relatorio || !activeProjection) {
      return [];
    }

    return [
      ...calcularCronogramaVAAF(activeProjection.vaafProjetado, activeProjection.totalAtual).map((item) => [
        item.mes,
        formatCurrency(item.valorProjetado),
        `${item.percentual.toFixed(1)}%`,
      ]),
      [
        <strong key="annual-label">Total anual VAAF</strong>,
        <strong key="annual-value">
          {formatCurrency(
            calcularCronogramaVAAF(activeProjection.vaafProjetado, activeProjection.totalAtual).reduce(
              (acc, item) => acc + item.valorProjetado,
              0,
            ),
          )}
        </strong>,
        <strong key="annual-pct">100%</strong>,
      ],
    ];
  }, [activeProjection, relatorio]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Levantamento de Cidades FUNDEB"
        description="Novo modulo para diagnostico estrategico educacional por codigo IBGE, com formulas validadas, fallbacks operacionais e exportacao em PDF."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={!canExport}>
                {exportingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                Exportar PDF
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Escolha o tipo de relatorio</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-3 py-2.5"
                onSelect={() => handleExportPdf("levantamento")}
                disabled={!canExport}
              >
                <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                <div>
                  <p className="font-medium">Diagnostico Estrategico</p>
                  <p className="text-xs text-muted-foreground">Relatorio tecnico completo — A4</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-3 py-2.5"
                onSelect={() => handleExportPdf("executiva")}
                disabled={!canExport}
              >
                <Presentation className="h-4 w-4 shrink-0 text-indigo-600" />
                <div>
                  <p className="font-medium">Apresentacao Executiva</p>
                  <p className="text-xs text-muted-foreground">7 paginas 16:9 — foco comercial</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-3 py-2.5"
                onSelect={() => handleExportPdf("comparativa")}
                disabled={!canExport}
              >
                <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-medium">Analise Comparativa</p>
                  <p className="text-xs text-muted-foreground">3 paginas A4 — exercicios {Number(exercicio) - 1} x {exercicio}</p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-4 w-4 text-[var(--sync-accent)]" />
                Busca Base
              </CardTitle>
              <CardDescription>
                Use a busca automatica do Sync para localizar o municipio por nome/UF ou informe o codigo IBGE. O carregamento completo passa pelas APIs internas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--sync-text-primary)]">Municipio</label>
                  <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={searchOpen}
                        className="w-full justify-between"
                      >
                        {municipioQuery
                          ? `${municipioQuery}${municipioUf ? ` / ${municipioUf}` : ""}`
                          : "Buscar municipio pelo Sync..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Digite o nome do municipio..."
                          value={municipioQuery}
                          onValueChange={setMunicipioQuery}
                        />
                        <div className="border-b border-[var(--sync-border-subtle)] px-3 py-2">
                          <Input
                            value={municipioUf}
                            onChange={(event) => setMunicipioUf(event.target.value.toUpperCase().slice(0, 2))}
                            placeholder="UF"
                            className="h-9"
                            maxLength={2}
                          />
                        </div>
                        <CommandList>
                          {isSearchingMunicipio ? (
                            <div className="flex items-center gap-2 px-3 py-4 text-sm text-[var(--sync-text-secondary)]">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Buscando municipios...
                            </div>
                          ) : null}
                          <CommandEmpty>Nenhum municipio encontrado.</CommandEmpty>
                          <CommandGroup heading="Resultados">
                            {municipioSuggestions.map((option) => (
                              <CommandItem
                                key={option.codigo_ibge}
                                value={`${option.nome}-${option.uf}-${option.codigo_ibge}`}
                                onSelect={() => handleSelectMunicipio(option)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    codigoIbge === option.codigo_ibge ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{option.nome} / {option.uf}</span>
                                  <span className="text-xs text-[var(--sync-text-tertiary)]">
                                    IBGE {option.codigo_ibge} · {option.regiao}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-[var(--sync-text-secondary)]">A busca usa `/api/municipios/buscar`, que encapsula a consulta territorial dentro do próprio Sync.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--sync-text-primary)]">Codigo IBGE</label>
                  <Input
                    value={codigoIbge}
                    onChange={(event) => setCodigoIbge(event.target.value.replace(/\D/g, "").slice(0, 7))}
                    placeholder="Ex.: 4202008"
                    inputMode="numeric"
                  />
                  <p className="text-xs text-[var(--sync-text-secondary)]">Aceita 6 ou 7 digitos. Se voce selecionar o municipio acima, esse campo e preenchido automaticamente.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--sync-text-primary)]">Exercicio</label>
                  <Input
                    value={exercicio}
                    onChange={(event) => setExercicio(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="2026"
                    inputMode="numeric"
                  />
                </div>
              </div>
              </div>

              <div className="space-y-2">
                <Button className="w-full gap-2" onClick={handleLoadMunicipio} disabled={loading || exportingAutonomous}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPinned className="h-4 w-4" />}
                  {loading ? "Carregando municipio..." : "Iniciar levantamento"}
                </Button>
                <Button
                  variant="default"
                  className="w-full gap-2"
                  onClick={() => handleExportAutonomousPdf("levantamento")}
                  disabled={!canExportAutonomous}
                >
                  {exportingAutonomous ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {exportingAutonomous ? "Gerando PDF autonomo..." : "Gerar diagnostico autonomo"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleExportAutonomousPackage}
                  disabled={!canExportAutonomous}
                >
                  {exportingAutonomous ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  {exportingAutonomous ? "Gerando pacote autonomo..." : "Gerar pacote autonomo"}
                </Button>
                <p className="text-xs text-[var(--sync-text-secondary)]">
                  O pacote autonomo dispara diagnostico, executiva e comparativa direto do servidor, sem depender do preview carregado.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--sync-accent)]" />
                Fontes e Fallbacks
              </CardTitle>
              <CardDescription>
                Estrutura alinhada ao documento de implementacao. As fontes nao integradas ficam explicitas e editaveis no fluxo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {fontes.map((fonte) => (
                <div key={fonte.id} className="rounded-2xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--sync-text-primary)]">{fonte.label}</p>
                    <Badge variant={getBadgeVariant(fonte.status)}>{fonte.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-[var(--sync-text-secondary)]">{fonte.descricao}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {relatorio ? (
            <>
              <Card className="border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[var(--sync-accent)]" />
                    Identificacao do Municipio
                  </CardTitle>
                  <p className="text-sm text-[var(--sync-text-secondary)]">
                    Localização via IBGE, Censo Escolar INEP e Executivo Eleito via TSE.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--sync-text-primary)]">Municipio</label>
                    <Input
                      value={relatorio.identificacao.municipioNome}
                      onChange={(event) =>
                        updateRelatorio((current) => ({
                          ...current,
                          identificacao: {
                            ...current.identificacao,
                            municipioNome: event.target.value,
                            municipio: `${event.target.value} - ${current.identificacao.uf}`,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--sync-text-primary)]">UF</label>
                    <Input
                      value={relatorio.identificacao.uf}
                      onChange={(event) =>
                        updateRelatorio((current) => ({
                          ...current,
                          identificacao: {
                            ...current.identificacao,
                            uf: event.target.value.toUpperCase().slice(0, 2),
                            municipio: `${current.identificacao.municipioNome} - ${event.target.value.toUpperCase().slice(0, 2)}`,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--sync-text-primary)]">Prefeito(a)</label>
                    <Input
                      value={relatorio.identificacao.prefeito}
                      onChange={(event) =>
                        updateRelatorio((current) => ({
                          ...current,
                          identificacao: {
                            ...current.identificacao,
                            prefeito: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--sync-text-primary)]">Partido</label>
                    <Input
                      value={relatorio.identificacao.partido}
                      onChange={(event) =>
                        updateRelatorio((current) => ({
                          ...current,
                          identificacao: {
                            ...current.identificacao,
                            partido: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-[var(--sync-accent)]" />
                    Financeiro e Ajustes Rapidos
                  </CardTitle>
                  <CardDescription>
                    Os calculos seguem o modelo validado no `.md`: fator 1.7209 para municipios sem complementacao e multiplicadores VAAF/VAAT/VAAR quando houver repasse da Uniao.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--sync-text-primary)]">Receita de contribuicao municipal</label>
                      <Input
                        value={numberInputValue(relatorio.receitas.receitaContribuicaoMunicipal)}
                        onChange={(event) => updateReceitaField("receitaContribuicaoMunicipal", event.target.value)}
                        inputMode="decimal"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--sync-text-primary)]">Complementacao VAAF</label>
                      <Input
                        value={numberInputValue(relatorio.receitas.complementacaoVAAF)}
                        onChange={(event) => updateReceitaField("complementacaoVAAF", event.target.value)}
                        inputMode="decimal"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--sync-text-primary)]">Complementacao VAAT</label>
                      <Input
                        value={numberInputValue(relatorio.receitas.complementacaoVAAT)}
                        onChange={(event) => updateReceitaField("complementacaoVAAT", event.target.value)}
                        inputMode="decimal"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--sync-text-primary)]">Complementacao VAAR</label>
                      <Input
                        value={numberInputValue(relatorio.receitas.complementacaoVAAR)}
                        onChange={(event) => updateReceitaField("complementacaoVAAR", event.target.value)}
                        inputMode="decimal"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--sync-text-primary)]">Situacao atual do PAR</label>
                      <Input
                        value={relatorio.situacaoPAR}
                        onChange={(event) =>
                          updateRelatorio((current) => ({
                            ...current,
                            situacaoPAR: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--sync-text-primary)]">Total de escolas</label>
                      <Input
                        value={numberInputValue(relatorio.censoEscolar?.totalEscolas)}
                        onChange={(event) =>
                          updateRelatorio((current) => ({
                            ...current,
                            censoEscolar: {
                              ...(current.censoEscolar ?? createEmptyCensoEscolar()),
                              totalEscolas: toNumber(event.target.value),
                            },
                          }))
                        }
                        inputMode="numeric"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--sync-text-primary)]">Total de matriculas</label>
                      <Input
                        value={numberInputValue(relatorio.censoEscolar?.totalMatriculas)}
                        onChange={(event) =>
                          updateRelatorio((current) => ({
                            ...current,
                            censoEscolar: {
                              ...(current.censoEscolar ?? createEmptyCensoEscolar()),
                              totalMatriculas: toNumber(event.target.value),
                            },
                          }))
                        }
                        inputMode="numeric"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--sync-text-primary)]">Total de docentes</label>
                      <Input
                        value={numberInputValue(relatorio.censoEscolar?.totalDocentes)}
                        onChange={(event) =>
                          updateRelatorio((current) => ({
                            ...current,
                            censoEscolar: {
                              ...(current.censoEscolar ?? createEmptyCensoEscolar()),
                              totalDocentes: toNumber(event.target.value),
                            },
                          }))
                        }
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-[var(--sync-text-primary)]">Sistemas MEC / FNDE</p>
                    <div className="grid gap-3">
                      {relatorio.sistemas.map((sistema, index) => (
                        <div
                          key={`${sistema.instituicao}-${sistema.sistema}`}
                          className="grid gap-3 rounded-2xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-3 md:grid-cols-[1fr_180px]"
                        >
                          <div>
                            <p className="text-sm font-medium text-[var(--sync-text-primary)]">
                              {sistema.instituicao} / {sistema.sistema}
                            </p>
                            <p className="text-xs text-[var(--sync-text-secondary)]">Ajuste manual ate integracao do scraping do SIMEC.</p>
                          </div>
                          <select
                            value={sistema.situacao}
                            onChange={(event) => updateSistema(index, event.target.value)}
                            className="h-10 rounded-xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)] px-3 text-sm text-[var(--sync-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sync-accent-muted)]"
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        <div className="space-y-6">
          {!relatorio ? (
            <EmptyState
              icon={<MapPinned className="h-10 w-10 text-[var(--sync-text-tertiary)]" />}
              title="Aguardando levantamento"
              description="Carregue um municipio pelo codigo IBGE para gerar o preview do diagnostico estrategico educacional."
            />
          ) : (
            <>
              {relatorio.perfilComercial ? (
                <Card className="border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]/60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-[var(--sync-accent)]" />
                      Benchmark Comercial
                    </CardTitle>
                    <CardDescription>
                      Score calibrado com base nas auditorias dos relatórios comerciais e nas bases oficiais do FNDE, INEP e IBGE.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <SummaryMetric
                        label="Score"
                        value={relatorio.perfilComercial.score.toFixed(2)}
                        helper="Indice sintetico de aderencia ao padrao comercial."
                      />
                      <SummaryMetric
                        label="Faixa"
                        value={relatorio.perfilComercial.faixa}
                        helper="Classificacao do potencial comercial observado."
                      />
                      <SummaryMetric
                        label="Multiplicador"
                        value={`${relatorio.perfilComercial.multiplicador.toFixed(2)}x`}
                        helper="Multiplicador aplicado sobre a receita total atual."
                      />
                      <SummaryMetric
                        label="Confianca"
                        value={`${(relatorio.perfilComercial.confianca * 100).toFixed(2)}%`}
                        helper="Cobertura de indicadores disponiveis para o municipio."
                      />
                    </div>

                    <div className="rounded-2xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-4">
                      <p className="text-sm font-medium text-[var(--sync-text-primary)]">Fatores predominantes</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {relatorio.perfilComercial.fatores.map((fator) => (
                          <Badge key={fator}>
                            {fator}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-4">
                      <p className="text-sm font-medium text-[var(--sync-text-primary)]">Camada estadual</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <SummaryMetric
                          label="UF"
                          value={relatorio.perfilComercial.camadaEstadual.uf}
                          helper={relatorio.perfilComercial.camadaEstadual.fundoEstadual}
                        />
                        <SummaryMetric
                          label="Amostra UF"
                          value={String(relatorio.perfilComercial.camadaEstadual.amostraHistorica)}
                          helper="Quantidade de casos historicos validados nesta UF."
                        />
                        <SummaryMetric
                          label="Residuo medio"
                          value={
                            relatorio.perfilComercial.camadaEstadual.residuoMedioHistorico !== null
                              ? `${relatorio.perfilComercial.camadaEstadual.residuoMedioHistorico.toFixed(2)}%`
                              : "-"
                          }
                          helper="Desvio medio historico observado nesta UF."
                        />
                        <SummaryMetric
                          label="Ajuste UF"
                          value={
                            relatorio.perfilComercial.camadaEstadual.ajusteMultiplicadorAplicado !== 0
                              ? `${relatorio.perfilComercial.camadaEstadual.ajusteMultiplicadorAplicado.toFixed(2)}x`
                              : "0.00x"
                          }
                          helper={
                            relatorio.perfilComercial.camadaEstadual.ajusteAtivo
                              ? "Correcao estadual aplicada ao multiplicador."
                              : "Sem correcao ativa por falta de estabilidade estatistica."
                          }
                        />
                      </div>
                      <p className="mt-4 text-sm text-[var(--sync-text-secondary)]">
                        {relatorio.perfilComercial.camadaEstadual.observacao}
                      </p>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                      <div className="rounded-2xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-4">
                        <p className="text-sm font-medium text-[var(--sync-text-primary)]">Variaveis oficiais do Fundeb</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {relatorio.perfilComercial.camadaEstadual.variaveisOficiais.map((item) => (
                            <Badge key={item}>{item}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-4">
                        <p className="text-sm font-medium text-[var(--sync-text-primary)]">Proxies analiticas</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {relatorio.perfilComercial.camadaEstadual.proxiesAnaliticas.map((item) => (
                            <Badge key={item}>{item}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-4">
                        <p className="text-sm font-medium text-[var(--sync-text-primary)]">Ajustes comerciais</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {relatorio.perfilComercial.camadaEstadual.ajustesComerciais.map((item) => (
                            <Badge key={item}>{item}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryMetric
                  label="Total Atual"
                  value={formatCurrency(activeProjection?.totalAtual ?? 0)}
                  helper="Receita FUNDEB estimada na linha de base."
                />
                <SummaryMetric
                  label={`${projectionLabel} Projetado`}
                  value={formatCurrency(activeProjection?.totalProjetado ?? 0)}
                  helper={
                    relatorio.projecaoComercial
                      ? "Cenario potencial calibrado pelo benchmark comercial Rocha Prime."
                      : relatorio.upsideCondicionado
                        ? "Estimativa principal baseada no ganho recuperavel com evidencia atual."
                        : "Aplicacao direta das formulas validadas."
                  }
                />
                <SummaryMetric
                  label={relatorio.projecaoComercial ? "Ganho Potencial" : "Ganho Recuperavel"}
                  value={formatCurrency(activeProjection?.totalGanho ?? 0)}
                  helper={
                    relatorio.projecaoComercial
                      ? "Incremento potencial estimado pela metodologia comercial do levantamento."
                      : "Incremento monetizado apenas com base no que ja esta evidenciado."
                  }
                />
                <SummaryMetric
                  label="Ganho Percentual"
                  value={formatPercent(activeProjection?.ganhoPercentual ?? 0)}
                  helper={`Comparativo entre linha de base e ${projectionLabel.toLowerCase()}.`}
                />
              </div>

              {relatorio.projecaoComercial && relatorio.projecaoRecuperavel ? (
                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">
                  Camada recuperavel ja evidenciada nas bases atuais: {formatCurrency(relatorio.projecaoRecuperavel.totalGanho)} ({formatPercent(relatorio.projecaoRecuperavel.ganhoPercentual)}).
                  No levantamento principal, o headline volta a seguir a projecao comercial Rocha Prime; a comparativa fica reservada para a leitura anual entre exercicios.
                </div>
              ) : relatorio.upsideCondicionado ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                  Upside condicionado adicional identificado: {formatCurrency(relatorio.upsideCondicionado.ganhoAdicional)} ({formatPercent(relatorio.upsideCondicionado.ganhoPercentual)}).
                  Esse valor nao integra o headline principal e depende de validacao documental, regularizacao sistemica e eventual recalculo oficial.
                </div>
              ) : null}

              <div id={REPORT_ELEMENT_ID} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl">
                <section className="bg-[radial-gradient(circle_at_top_right,_#3b82f6,_#0f172a_55%,_#020617)] px-8 py-14 text-white">
                  <div className="max-w-4xl space-y-8">
                    <Badge className="w-fit border-white/20 bg-white/10 text-white">Documento confidencial</Badge>
                    <div className="space-y-4">
                      <p className="text-sm uppercase tracking-[0.35em] text-blue-100">Rocha Prime Servicos Especializados</p>
                      <h2 className="max-w-3xl text-4xl font-semibold leading-tight">
                        Diagnostico Estrategico Educacional
                      </h2>
                      <p className="max-w-2xl text-lg text-blue-100">
                        Relatorio tecnico para levantamento de potencial FUNDEB, situacao de sistemas MEC/FNDE e consolidacao inicial de indicadores do municipio.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-blue-100">Municipio</p>
                        <p className="mt-2 text-xl font-semibold">{relatorio.identificacao.municipio}</p>
                      </div>
                      <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-blue-100">Exercicio</p>
                        <p className="mt-2 text-xl font-semibold">{relatorio.identificacao.exercicio}</p>
                      </div>
                      <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-blue-100">Gerado em</p>
                        <p className="mt-2 text-xl font-semibold">{relatorio.geradoEm}</p>
                      </div>
                    </div>
                  </div>
                </section>
                <div className="space-y-8 bg-slate-50 px-6 py-6 md:px-8 md:py-8">
                  <PreviewSection title="Carta de Apresentacao" description="Abertura institucional do relatorio.">
                    <div className="space-y-4 text-sm leading-7 text-slate-700">
                      <p>
                        Ilmo(a). Sr(a). <strong>{getPrefeitoDisplay(relatorio.identificacao.prefeito)}</strong>
                        <br />
                        Prefeito(a) Municipal de <strong>{relatorio.identificacao.municipioNome}</strong>
                      </p>
                      <p>
                        Encaminhamos o presente diagnostico estrategico educacional com foco no potencial de incremento das receitas do FUNDEB, no saneamento de sistemas do MEC/FNDE e na organizacao do conjunto minimo de dados para tomada de decisao.
                      </p>
                      <p>
                        Esta versao foi estruturada para operar com coleta automatica do IBGE e com fallbacks operacionais nas fontes ainda nao integradas, permitindo que a equipe avance no levantamento da cidade sem depender de trabalho manual disperso.
                      </p>
                      <p>Paulo Rocha - Rocha Prime Servicos Especializados</p>
                    </div>
                  </PreviewSection>

                  <PreviewSection
                    title="Parte I - Analise Financeira FUNDEB"
                    description="Diagnostico inicial das receitas e da projecao Rocha Prime para o exercicio informado."
                  >
                    <div className="space-y-6">
                      <PreviewTable
                        headers={["Campo", "Valor"]}
                        rows={[
                          ["Municipio", relatorio.identificacao.municipio],
                          ["Codigo IBGE", relatorio.identificacao.codigoIBGE],
                          ["Prefeito(a)", getPrefeitoDisplay(relatorio.identificacao.prefeito)],
                          ["Partido", getPartidoDisplay(relatorio.identificacao.partido)],
                          ["Exercicio", relatorio.identificacao.exercicio],
                          ["Fonte", relatorio.identificacao.fonte],
                          ["Mesorregiao", relatorio.identificacao.mesorregiao],
                          ["Microrregiao", relatorio.identificacao.microrregiao],
                          ["Metodo principal", projectionLabel],
                          ["Metodologia", activeProjection?.metodologia ?? "Nao informado"],
                          [
                            "Multiplicador aplicado",
                            activeProjection?.multiplicadorAplicado
                              ? `${activeProjection.multiplicadorAplicado.toFixed(2)}x`
                              : "Nao informado",
                          ],
                        ]}
                      />

                      <PreviewTable
                        headers={["Componente", "Valor Previsto", "% do Total"]}
                        rows={revenueRows}
                      />

                      <PreviewTable
                        headers={["Componente", "Valor Atual", "Valor Projetado", "Ganho"]}
                        rows={projectionRows}
                      />

                      {relatorio.perfilComercial ? (
                        <PreviewTable
                          headers={["Indicador Comercial", "Valor"]}
                          rows={[
                            ["Score comercial", relatorio.perfilComercial.score.toFixed(2)],
                            ["Faixa", relatorio.perfilComercial.faixa],
                            ["Confianca", `${(relatorio.perfilComercial.confianca * 100).toFixed(2)}%`],
                            [
                              "FUNDEB per capita",
                              relatorio.perfilComercial.fundebPerCapita !== null
                                ? formatCurrency(relatorio.perfilComercial.fundebPerCapita)
                                : "-",
                            ],
                            [
                              "Matriculas municipais por habitante",
                              relatorio.perfilComercial.matriculasMunicipaisPorHabitante !== null
                                ? `${relatorio.perfilComercial.matriculasMunicipaisPorHabitante.toFixed(2)}%`
                                : "-",
                            ],
                            [
                              "Educacao infantil municipal por habitante",
                              relatorio.perfilComercial.educacaoInfantilMunicipalPorHabitante !== null
                                ? `${relatorio.perfilComercial.educacaoInfantilMunicipalPorHabitante.toFixed(2)}%`
                                : "-",
                            ],
                            [
                              "Creche municipal por habitante",
                              relatorio.perfilComercial.crecheMunicipalPorHabitante !== null
                                ? `${relatorio.perfilComercial.crecheMunicipalPorHabitante.toFixed(2)}%`
                                : "-",
                            ],
                            ["Habilitacao VAAT", relatorio.perfilComercial.habilitacaoVaat],
                            ["Pendencia VAAT", relatorio.perfilComercial.pendenciaVaat ?? "-"],
                            ["UF / fundo estadual", `${relatorio.perfilComercial.camadaEstadual.uf} / ${relatorio.perfilComercial.camadaEstadual.fundoEstadual}`],
                            [
                              "Residuo medio historico da UF",
                              relatorio.perfilComercial.camadaEstadual.residuoMedioHistorico !== null
                                ? `${relatorio.perfilComercial.camadaEstadual.residuoMedioHistorico.toFixed(2)}%`
                                : "-",
                            ],
                            [
                              "Ajuste estadual aplicado",
                              `${relatorio.perfilComercial.camadaEstadual.ajusteMultiplicadorAplicado.toFixed(2)}x`,
                            ],
                          ]}
                        />
                      ) : null}

                      {technicalProjectionRows.length ? (
                        <PreviewTable
                          headers={["Camada Recuperavel", "Valor Atual", "Valor Projetado", "Ganho"]}
                          rows={technicalProjectionRows}
                        />
                      ) : null}

                      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
                        <p className="text-xs uppercase tracking-[0.22em] text-emerald-700">
                          {relatorio.projecaoComercial ? "Valor total projetado com otimizacao" : "Valor total com ganho recuperavel"}
                        </p>
                        <p className="mt-3 text-4xl font-semibold text-emerald-900">
                          {formatCurrency(activeProjection?.totalProjetado ?? 0)}
                        </p>
                        <p className="mt-2 text-sm text-emerald-800">
                          {relatorio.projecaoComercial ? "Ganho potencial estimado" : "Ganho recuperavel estimado"}: {formatCurrency(activeProjection?.totalGanho ?? 0)} ({formatPercent(activeProjection?.ganhoPercentual ?? 0)})
                        </p>
                      </div>

                      <PreviewTable
                        headers={["Mes", "Valor Projetado", "% do Total"]}
                        rows={cronogramaRows}
                      />
                    </div>
                  </PreviewSection>

                  <PreviewSection title="Parte II - Situacao Educacional MEC / SIMEC" description="Estrutura operacional prevista no documento, com status visiveis e espaco para enriquecimento gradual das fontes.">
                    <div className="space-y-6">
                      <PreviewTable
                        headers={["Instituicao", "Sistema", "Situacao"]}
                        rows={relatorio.sistemas.map((sistema) => [
                          sistema.instituicao,
                          sistema.sistema,
                          <Badge key={`${sistema.instituicao}-${sistema.sistema}`} variant={getSistemaVariant(sistema.situacao)}>
                            {sistema.situacao}
                          </Badge>,
                        ])}
                      />

                      {relatorio.obrasPAC2.length ? (
                        <PreviewTable
                          headers={["Tipo de Obra", "Aprov.", "Execucao", "Canceladas", "Concluidas", "Total"]}
                          rows={relatorio.obrasPAC2.map((obra) => [
                            obra.tipo,
                            obra.aprovadas ?? "-",
                            obra.execucao ?? "-",
                            obra.canceladas ?? "-",
                            obra.concluidas ?? "-",
                            obra.total ?? "-",
                          ])}
                        />
                      ) : (
                        <EmptyTableMessage text="Sem grade tipologica consolidada de obras para esta cidade nesta rodada. Evidencias publicas oficiais permanecem nas observacoes operacionais abaixo." />
                      )}

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <strong>Situacao atual do PAR:</strong> {relatorio.situacaoPAR || "Nao informado"}
                      </div>

                      {relatorio.observacoesOperacionais.length ? (
                        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                          <p className="font-semibold">Observacoes operacionais publicas</p>
                          <ul className="mt-2 space-y-1 pl-5">
                            {relatorio.observacoesOperacionais.map((item, index) => (
                              <li key={`${item}-${index}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <PreviewTable
                        headers={["Tipo de Veiculo", "Qtd.", "Valor"]}
                        rows={relatorio.caminhoEscola.map((veiculo) => [
                          veiculo.tipo,
                          veiculo.quantidade ?? "-",
                          veiculo.valor !== null ? formatCurrency(veiculo.valor) : "-",
                        ])}
                      />

                      <PreviewTable
                        headers={["Ano", "Recursos Repassados"]}
                        rows={relatorio.pdde.map((item) => [item.ano, formatCurrency(item.valor)])}
                      />
                    </div>
                  </PreviewSection>

                  <PreviewSection title="Parte III - IDEB, Censo Escolar e Resumo Comparativo" description="Blocos finais para consolidacao do potencial financeiro e do contexto educacional do municipio.">
                    <div className="space-y-6">
                      {relatorio.idebAnosIniciais.length ? (
                        <PreviewTable
                          headers={["Ano", "Meta Projetada", "IDEB Verificado"]}
                          rows={relatorio.idebAnosIniciais.map((item) => [
                            item.ano,
                            item.metaProjetada ?? "-",
                            item.idebVerificado ?? "-",
                          ])}
                        />
                      ) : (
                        <EmptyTableMessage text="Nenhum dado disponivel para IDEB - anos iniciais." />
                      )}

                      {relatorio.idebAnosFinais.length ? (
                        <PreviewTable
                          headers={["Ano", "Meta Projetada", "IDEB Verificado"]}
                          rows={relatorio.idebAnosFinais.map((item) => [
                            item.ano,
                            item.metaProjetada ?? "-",
                            item.idebVerificado ?? "-",
                          ])}
                        />
                      ) : (
                        <EmptyTableMessage text="Nenhum dado disponivel para IDEB - anos finais." />
                      )}

                      {relatorio.censoEscolar ? (
                        <>
                          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                            <strong>Fonte do censo:</strong> {relatorio.censoEscolar.fonte}
                            {relatorio.censoEscolar.anoReferencia ? ` (${relatorio.censoEscolar.anoReferencia})` : ""}
                          </div>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Escolas</p>
                              <p className="mt-2 text-3xl font-semibold text-slate-900">
                                {formatInteger(relatorio.censoEscolar.totalEscolas)}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Matriculas</p>
                              <p className="mt-2 text-3xl font-semibold text-slate-900">
                                {formatInteger(relatorio.censoEscolar.totalMatriculas)}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Docentes</p>
                              <p className="mt-2 text-3xl font-semibold text-slate-900">
                                {formatInteger(relatorio.censoEscolar.totalDocentes)}
                              </p>
                            </div>
                          </div>

                          <PreviewTable
                            headers={["Etapa", "Quantidade"]}
                            rows={[
                              ["Educacao Infantil", relatorio.censoEscolar.matriculasEtapa.educacaoInfantil],
                              ["Ensino Fundamental", relatorio.censoEscolar.matriculasEtapa.ensinoFundamental],
                              ["Ensino Medio", relatorio.censoEscolar.matriculasEtapa.ensinoMedio],
                              ["EJA", relatorio.censoEscolar.matriculasEtapa.eja],
                              ["Educacao Especial", relatorio.censoEscolar.matriculasEtapa.educacaoEspecial],
                            ]}
                          />

                          <PreviewTable
                            headers={["Detalhamento da rede", "Quantidade"]}
                            rows={[
                              ["Creche", relatorio.censoEscolar.matriculasDetalhadas.creche],
                              ["Pre-escola", relatorio.censoEscolar.matriculasDetalhadas.preEscola],
                              ["Anos iniciais", relatorio.censoEscolar.matriculasDetalhadas.anosIniciais],
                              ["Anos finais", relatorio.censoEscolar.matriculasDetalhadas.anosFinais],
                            ]}
                          />

                          <PreviewTable
                            headers={["Tempo integral", "Matriculas"]}
                            rows={[
                              ["Rede publica total", relatorio.censoEscolar.tempoIntegral.total ?? "-"],
                              ["Educacao Infantil", relatorio.censoEscolar.tempoIntegral.educacaoInfantil ?? "-"],
                              ["Creche", relatorio.censoEscolar.tempoIntegral.creche ?? "-"],
                              ["Pre-escola", relatorio.censoEscolar.tempoIntegral.preEscola ?? "-"],
                              ["Ensino Fundamental", relatorio.censoEscolar.tempoIntegral.ensinoFundamental ?? "-"],
                              ["Anos iniciais", relatorio.censoEscolar.tempoIntegral.anosIniciais ?? "-"],
                              ["Anos finais", relatorio.censoEscolar.tempoIntegral.anosFinais ?? "-"],
                              ["Ensino Medio", relatorio.censoEscolar.tempoIntegral.ensinoMedio ?? "-"],
                              ["EJA", relatorio.censoEscolar.tempoIntegral.eja ?? "-"],
                              ["Educacao Especial", relatorio.censoEscolar.tempoIntegral.educacaoEspecial ?? "-"],
                            ]}
                          />

                          <PreviewTable
                            headers={["Ciclo", "Docentes"]}
                            rows={[
                              [
                                "Fundamental - anos iniciais e finais",
                                relatorio.censoEscolar.docentesCiclo.fundamentalIniciaisFinais,
                              ],
                              ["Ensino Medio", relatorio.censoEscolar.docentesCiclo.ensinoMedio],
                            ]}
                          />
                        </>
                      ) : (
                        <EmptyTableMessage text="Dados do Censo Escolar nao disponiveis para este municipio no momento." />
                      )}

                      <div className="rounded-3xl border border-emerald-200 bg-emerald-600 p-6 text-white">
                        <p className="text-xs uppercase tracking-[0.22em] text-emerald-100">
                          {relatorio.projecaoComercial ? "Ganho potencial total estimado" : "Ganho recuperavel total estimado"}
                        </p>
                        <p className="mt-3 text-5xl font-semibold">{formatCurrency(activeProjection?.totalGanho ?? 0)}</p>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50">
                          Equivalente a {formatPercent(activeProjection?.ganhoPercentual ?? 0)} de aumento sobre o total atual de {formatCurrency(activeProjection?.totalAtual ?? 0)}.
                          {relatorio.projecaoComercial && relatorio.projecaoRecuperavel
                            ? ` A camada recuperavel ja evidenciada nas bases oficiais permanece em ${formatCurrency(relatorio.projecaoRecuperavel.totalGanho)}, usada como piso tecnico da operacao.`
                            : relatorio.upsideCondicionado
                              ? " O valor principal acima reflete apenas o ganho recuperavel com evidencia atual. O benchmark comercial segue como upside condicionado e depende de validacao documental."
                            : " Nesta primeira versao, o modulo preserva a metodologia oficial do levantamento descrito em `IMPLEMENTACAO_RELATORIO_FUNDEB.md`."}
                        </p>
                      </div>
                    </div>
                  </PreviewSection>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
