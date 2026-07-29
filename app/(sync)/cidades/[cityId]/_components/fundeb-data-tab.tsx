"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRightIcon,
  DatabaseIcon,
  FileTextIcon,
  LandmarkIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "lucide-react";

import { Button } from "@/core/components/ui/button";
import { formatCurrency, type CityAccount } from "@/core/lib/city-types";
import type {
  CityReport,
  CityReportSnapshot,
} from "@/modules/cidades/reports-types";

import styles from "./fundeb-data-tab.module.css";

interface FundebDataTabProps {
  city: CityAccount;
  reports: CityReport[];
  pending: boolean;
  selected?: CityReport;
  onSelect: (id: string) => void;
}

interface SnapshotSection {
  id: string;
  title: string;
  source: "Relatório FUNDEB" | "Base consolidada" | "JSON da geração";
  value: unknown;
}

const SECTION_LABELS: Record<string, string> = {
  identificacao: "Identificação municipal",
  receitas: "Receitas FUNDEB",
  projecao: "Projeção técnica",
  projecaoRecuperavel: "Projeção recuperável",
  projecaoComercial: "Projeção comercial",
  censoEscolar: "Censo Escolar",
  perfilComercial: "Perfil e viabilidade comercial",
  cronogramaVAAF: "Cronograma VAAF",
  idebAnosIniciais: "IDEB — anos iniciais",
  idebAnosFinais: "IDEB — anos finais",
  obrasPAC2: "Obras PAC2",
  caminhoEscola: "Caminho da Escola",
  observacoesOperacionais: "Observações operacionais",
  metadata: "Metadados e atualização",
  dados_basicos: "Dados básicos",
  prefeito: "Prefeito",
  partido: "Partido",
  secretario_educacao: "Secretaria de Educação",
  demografia: "Demografia",
  educacao: "Educação e aprendizagem",
  fiscal: "Fiscal, SICONFI e FUNDEB",
  simec_obras_publicas: "SIMEC e obras públicas",
  oportunidades: "Oportunidades identificadas",
  analise_ia: "Análise executiva",
  score_viabilidade: "Score de viabilidade",
  comparativo_fundeb: "Comparativo FUNDEB",
  fontes_utilizadas: "Fontes utilizadas",
  municipio: "Município na base oficial",
  relatorio_dirigido_base: "Diagnóstico dirigido e conformidade",
};

const REPORT_ORDER = [
  "identificacao",
  "receitas",
  "projecaoRecuperavel",
  "projecaoComercial",
  "projecao",
  "censoEscolar",
  "perfilComercial",
  "cronogramaVAAF",
  "idebAnosIniciais",
  "idebAnosFinais",
  "obrasPAC2",
  "caminhoEscola",
  "observacoesOperacionais",
];

const PAYLOAD_ORDER = [
  "dados_basicos",
  "demografia",
  "educacao",
  "fiscal",
  "simec_obras_publicas",
  "relatorio_dirigido_base",
  "comparativo_fundeb",
  "oportunidades",
  "analise_ia",
  "score_viabilidade",
  "prefeito",
  "partido",
  "secretario_educacao",
  "fontes_utilizadas",
  "metadata",
];

export function FundebDataTab({
  city,
  reports,
  pending,
  selected,
  onSelect,
}: FundebDataTabProps) {
  if (pending) {
    return (
      <div className={styles.loadingState}>
        <LoaderCircleIcon className={styles.loadingIcon} />
      </div>
    );
  }

  const reportsWithData = reports.filter((report) => report.snapshot);
  const active =
    (selected?.snapshot ? selected : undefined) ?? reportsWithData[0];

  if (!active?.snapshot) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>
          <DatabaseIcon aria-hidden="true" />
        </span>
        <h2>Ficha FUNDEB ainda não disponível</h2>
        <p>
          Gere o primeiro levantamento para preencher receitas, projeções,
          VAAF, VAAT, VAAR, Censo Escolar, habilitação e parâmetros técnicos
          desta cidade.
        </p>
        <Button
          asChild
          className={styles.emptyAction}
        >
          <Link href={`/modulos/levantamento-fundeb?ibge=${city.codigoIbge}`}>
            <SparklesIcon aria-hidden="true" />
            Gerar levantamento FUNDEB
          </Link>
        </Button>
      </div>
    );
  }

  const sections = snapshotSections(active.snapshot);
  const reportData = active.snapshot.reportData ?? {};
  const revenues = recordField(reportData, "receitas");
  const projection =
    active.snapshot.projecaoRecuperavel ??
    recordField(reportData, "projecaoRecuperavel") ??
    active.snapshot.projecao ??
    recordField(reportData, "projecao");
  const census =
    active.snapshot.censoEscolar ?? recordField(reportData, "censoEscolar");
  const profile =
    active.snapshot.perfilComercial ??
    recordField(reportData, "perfilComercial");
  const parameters = recordField(reportData, "parametros");

  const current = firstNumber(
    projection?.totalAtual,
    revenues?.totalReceitas,
  );
  const projected = firstNumber(projection?.totalProjetado);
  const gain = firstNumber(projection?.totalGanho);
  const gainPercentage = firstNumber(projection?.ganhoPercentual);
  const enrollments = firstNumber(
    census?.totalMatriculasMunicipais,
    census?.totalMatriculas,
  );
  const schools = firstNumber(
    census?.totalEscolasMunicipais,
    census?.totalEscolas,
  );
  const teachers = firstNumber(
    census?.totalDocentesMunicipais,
    census?.totalDocentes,
  );
  const censusYear = firstNumber(census?.anoReferencia);

  const supplements = [
    {
      label: "VAAF",
      current: firstNumber(
        projection?.vaafAtual,
        revenues?.complementacaoVAAF,
      ),
      projected: firstNumber(projection?.vaafProjetado),
      gain: firstNumber(projection?.vaafGanho),
    },
    {
      label: "VAAT",
      current: firstNumber(
        projection?.vaatAtual,
        revenues?.complementacaoVAAT,
      ),
      projected: firstNumber(projection?.vaatProjetado),
      gain: firstNumber(projection?.vaatGanho),
    },
    {
      label: "VAAR",
      current: firstNumber(
        projection?.vaarAtual,
        revenues?.complementacaoVAAR,
      ),
      projected: firstNumber(projection?.vaarProjetado),
      gain: firstNumber(projection?.vaarGanho),
    },
  ];

  return (
    <div className={styles.workspace}>
      <section className={styles.toolbar}>
        <div className={styles.toolbarIdentity}>
          <span className={styles.toolbarIcon}>
            <LandmarkIcon aria-hidden="true" />
          </span>
          <div>
            <h2>Ficha do levantamento FUNDEB</h2>
            <p>
              {city.name} · exercício {active.exercise} ·{" "}
              {sections.length} blocos preservados
            </p>
          </div>
        </div>
        <div className={styles.toolbarActions}>
          <label className={styles.versionField}>
            <span>Versão consultada</span>
            <select
              value={active.id}
              onChange={(event) => onSelect(event.target.value)}
            >
              {reportsWithData.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.exercise} · {formatDate(report.generatedAt)}
                </option>
              ))}
            </select>
          </label>
          {active.downloadUrl && (
            <a
              href={active.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.pdfButton}
            >
              Abrir PDF
              <ArrowUpRightIcon aria-hidden="true" />
            </a>
          )}
        </div>
      </section>

      <section className={styles.financialHero}>
        <div className={styles.heroLead}>
          <span className={styles.heroLeadIcon}>
            <TrendingUpIcon aria-hidden="true" />
          </span>
          <div>
            <p>Potencial recuperável identificado</p>
            <strong>{formatOptionalCurrency(gain)}</strong>
            <span>
              {gainPercentage === null
                ? "Percentual não informado"
                : `+${formatNumber(gainPercentage)}% sobre a base atual`}
            </span>
          </div>
        </div>
        <div className={styles.heroMetrics}>
          <FundebMetric
            label="Receita atual"
            value={formatOptionalCurrency(current)}
          />
          <FundebMetric
            label="Receita projetada"
            value={formatOptionalCurrency(projected)}
          />
          <FundebMetric
            label="Matrículas consideradas"
            value={formatOptionalInteger(enrollments)}
          />
        </div>
      </section>

      <div className={styles.primaryGrid}>
        <section className={styles.panel}>
          <PanelHeader
            icon={<LandmarkIcon aria-hidden="true" />}
            title="Composição das complementações"
            description="Valores atuais, projeção e ganho por modalidade."
          />
          <div className={styles.supplementTable}>
            <div className={styles.supplementHeader}>
              <span>Modalidade</span>
              <span>Atual</span>
              <span>Projetado</span>
              <span>Ganho</span>
            </div>
            {supplements.map((supplement) => (
              <div key={supplement.label} className={styles.supplementRow}>
                <strong>{supplement.label}</strong>
                <span data-label="Atual">
                  {formatOptionalCurrency(supplement.current)}
                </span>
                <span data-label="Projetado">
                  {formatOptionalCurrency(supplement.projected)}
                </span>
                <span data-label="Ganho" className={styles.positiveValue}>
                  {formatOptionalCurrency(supplement.gain)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <PanelHeader
            icon={<FileTextIcon aria-hidden="true" />}
            title="Identificação do levantamento"
            description="Campos informados para esta versão do relatório."
          />
          <dl className={styles.fieldsGrid}>
            <InfoField
              label="Responsável técnico"
              value={parameters?.responsavelTecnico}
            />
            <InfoField
              label="Órgão demandante"
              value={parameters?.orgaoDemandante}
            />
            <InfoField
              label="Secretário(a) de Educação"
              value={parameters?.secretarioEducacao}
            />
            <InfoField
              label="Número do processo"
              value={parameters?.numeroProcesso}
            />
            <InfoField
              label="Período de referência"
              value={parameters?.periodoReferencia}
            />
            <InfoField
              label="Cenário da análise"
              value={parameters?.cenarioAnalise}
            />
          </dl>
        </section>
      </div>

      <div className={styles.secondaryGrid}>
        <section className={styles.panel}>
          <PanelHeader
            icon={<DatabaseIcon aria-hidden="true" />}
            title="Rede educacional considerada"
            description={`Censo Escolar${censusYear ? ` · ${censusYear}` : ""}.`}
          />
          <div className={styles.networkMetrics}>
            <FundebMetric
              label="Matrículas municipais"
              value={formatOptionalInteger(enrollments)}
            />
            <FundebMetric
              label="Escolas municipais"
              value={formatOptionalInteger(schools)}
            />
            <FundebMetric
              label="Docentes municipais"
              value={formatOptionalInteger(teachers)}
            />
          </div>
        </section>

        <section className={styles.panel}>
          <PanelHeader
            icon={<ShieldCheckIcon aria-hidden="true" />}
            title="Habilitação e perfil técnico"
            description="Sinais operacionais preservados na geração."
          />
          <dl className={styles.statusList}>
            <InfoField
              label="Habilitação VAAT"
              value={profile?.habilitacaoVaat}
            />
            <InfoField
              label="Pendência identificada"
              value={profile?.pendenciaVaat}
            />
            <InfoField
              label="Score de viabilidade"
              value={
                firstNumber(profile?.score) === null
                  ? null
                  : `${formatNumber(firstNumber(profile?.score)!)} pontos`
              }
            />
            <InfoField
              label="Confiança da análise"
              value={
                firstNumber(profile?.confianca) === null
                  ? null
                  : `${formatNumber(firstNumber(profile?.confianca)!)}%`
              }
            />
          </dl>
        </section>
      </div>

      <section className={styles.dataArchive}>
        <div className={styles.archiveHeader}>
          <div>
            <h3>Base completa e auditável</h3>
            <p>
              Todos os campos do JSON original permanecem disponíveis por
              bloco.
            </p>
          </div>
          <span>
            {active.snapshot.schemaVersion
              ? `JSON v${active.snapshot.schemaVersion}`
              : "JSON legado"}{" "}
            · {formatDate(active.generatedAt)}
          </span>
        </div>
        <div className={styles.archiveSections}>
          {sections.map((section, index) => (
            <details key={section.id} open={index === 0}>
              <summary>
                <div>
                  <strong>{section.title}</strong>
                  <span>
                    {section.source} · {describeValue(section.value)}
                  </span>
                </div>
                <i aria-hidden="true">+</i>
              </summary>
              <div className={styles.archiveContent}>
                <DataNode value={section.value} />
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function snapshotSections(snapshot: CityReportSnapshot): SnapshotSection[] {
  const reportData =
    snapshot.reportData ??
    compactRecord({
      identificacao: snapshot.identificacao,
      projecao: snapshot.projecao,
      projecaoRecuperavel: snapshot.projecaoRecuperavel,
      censoEscolar: snapshot.censoEscolar,
      perfilComercial: snapshot.perfilComercial,
    });
  const payload = snapshot.sourcePayload ?? {};
  const sections: SnapshotSection[] = [];

  for (const [key, value] of orderedEntries(reportData, REPORT_ORDER)) {
    if (!hasData(value)) continue;
    sections.push({
      id: `report-${key}`,
      title: SECTION_LABELS[key] ?? humanizeKey(key),
      source: "Relatório FUNDEB",
      value,
    });
  }

  for (const [key, value] of orderedEntries(payload, PAYLOAD_ORDER)) {
    if (key === "relatorio_fundeb" || !hasData(value)) continue;
    sections.push({
      id: `payload-${key}`,
      title: SECTION_LABELS[key] ?? humanizeKey(key),
      source: "Base consolidada",
      value,
    });
  }

  if (hasData(snapshot.municipalityData)) {
    sections.push({
      id: "snapshot-municipality",
      title: SECTION_LABELS.municipio,
      source: "Base consolidada",
      value: snapshot.municipalityData,
    });
  }

  if (
    snapshot.opportunities?.length &&
    !Object.prototype.hasOwnProperty.call(payload, "oportunidades")
  ) {
    sections.push({
      id: "snapshot-opportunities",
      title: SECTION_LABELS.oportunidades,
      source: "Base consolidada",
      value: snapshot.opportunities,
    });
  }

  for (const [key, value] of Object.entries(
    snapshot.additionalData ?? {},
  )) {
    if (!hasData(value)) continue;
    sections.push({
      id: `additional-${key}`,
      title: SECTION_LABELS[key] ?? humanizeKey(key),
      source: "Base consolidada",
      value,
    });
  }

  if (hasData(snapshot.generation)) {
    sections.unshift({
      id: "generation-metadata",
      title: "Identificação da geração",
      source: "JSON da geração",
      value: snapshot.generation,
    });
  }

  if (hasData(snapshot.generationContext)) {
    sections.push({
      id: "generation-context",
      title: "Contexto exato da geração",
      source: "JSON da geração",
      value: snapshot.generationContext,
    });
  }

  return sections;
}

function DataNode({
  value,
  field = "",
  depth = 0,
}: {
  value: unknown;
  field?: string;
  depth?: number;
}) {
  if (!value || typeof value !== "object") {
    return (
      <span className="font-mono text-[10px] font-semibold text-[#3B3F4A]">
        {formatDataValue(value, field)}
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return <span className="text-[10px] text-[#A2A6B2]">Sem registros</span>;
    }
    if (value.every((item) => !item || typeof item !== "object")) {
      return (
        <ul className="space-y-1.5">
          {value.map((item, index) => (
            <li
              key={`${String(item)}-${index}`}
              className="flex gap-2 text-[10px] text-[#3B3F4A]"
            >
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#93B8F2]" />
              <span>{formatDataValue(item, field)}</span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <details
            key={index}
            className="rounded-[11px] border border-[#ECEEF3] bg-white"
          >
            <summary className="cursor-pointer px-3 py-2 text-[9.5px] font-bold text-[#5A5E6A]">
              Item {index + 1}
            </summary>
            <div className="border-t border-[#F0F1F5] p-3">
              <DataNode value={item} field={field} depth={depth + 1} />
            </div>
          </details>
        ))}
      </div>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) {
    return <span className="text-[10px] text-[#A2A6B2]">Sem registros</span>;
  }

  return (
    <dl className="divide-y divide-[#ECEEF3]">
      {entries.map(([key, nested]) => {
        const nestedObject = nested && typeof nested === "object";
        return (
          <div
            key={key}
            className={`${nestedObject ? "block py-2.5" : "grid grid-cols-[minmax(120px,.8fr)_minmax(0,1.2fr)] gap-4 py-2"} ${
              depth > 0 ? "px-2" : ""
            }`}
          >
            {nestedObject ? (
              <details>
                <summary className="cursor-pointer text-[9.5px] font-bold text-[#5A5E6A]">
                  {humanizeKey(key)}{" "}
                  <span className="font-mono font-normal text-[#A2A6B2]">
                    · {describeValue(nested)}
                  </span>
                </summary>
                <div className="mt-2 border-l border-[#DCDDE4] pl-3">
                  <DataNode value={nested} field={key} depth={depth + 1} />
                </div>
              </details>
            ) : (
              <>
                <dt className="text-[9.5px] text-[#767A86]">
                  {humanizeKey(key)}
                </dt>
                <dd className="min-w-0 break-words text-right font-mono text-[9.5px] font-semibold text-[#3B3F4A]">
                  {formatDataValue(nested, key)}
                </dd>
              </>
            )}
          </div>
        );
      })}
    </dl>
  );
}

function PanelHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <header className={styles.panelHeader}>
      <span>{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </header>
  );
}

function FundebMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className={styles.infoField}>
      <dt>{label}</dt>
      <dd>{formatInfoValue(value)}</dd>
    </div>
  );
}

function orderedEntries(
  value: Record<string, unknown>,
  order: string[],
): [string, unknown][] {
  const index = new Map(order.map((key, position) => [key, position]));
  return Object.entries(value).sort(([a], [b]) => {
    const aOrder = index.get(a) ?? order.length;
    const bOrder = index.get(b) ?? order.length;
    return aOrder === bOrder
      ? humanizeKey(a).localeCompare(humanizeKey(b), "pt-BR")
      : aOrder - bOrder;
  });
}

function compactRecord(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, candidate]) => hasData(candidate)),
  );
}

function hasData(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function describeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `${value.length} ${value.length === 1 ? "registro" : "registros"}`;
  }
  if (value && typeof value === "object") {
    const count = Object.keys(value).length;
    return `${count} ${count === 1 ? "campo" : "campos"}`;
  }
  return "1 campo";
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-zà-ÿ])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\bibge\b/gi, "IBGE")
    .replace(/\bfundeb\b/gi, "FUNDEB")
    .replace(/\bvaaf\b/gi, "VAAF")
    .replace(/\bvaat\b/gi, "VAAT")
    .replace(/\bvaar\b/gi, "VAAR")
    .replace(/\bideb\b/gi, "IDEB")
    .replace(/\bsiconfi\b/gi, "SICONFI")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatDataValue(value: unknown, field: string): string {
  if (value === null || value === undefined || value === "") return "N/D";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") {
    const normalizedField = field.toLocaleLowerCase("pt-BR");
    if (
      /percentual|porcent|percent|_pct|taxa_|cobertura/.test(normalizedField)
    ) {
      return `${new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 2,
      }).format(value)}%`;
    }
    if (
      /receita|valor|ganho|recurso|despesa|rcl|pib|caixa|passivo|patrimonio|vaaf|vaat|vaar/.test(
        normalizedField,
      )
    ) {
      return formatCurrency(value);
    }
    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (typeof value === "string") {
    const date = new Date(value);
    if (
      /^\d{4}-\d{2}-\d{2}T/.test(value) &&
      !Number.isNaN(date.getTime())
    ) {
      return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
    }
    return value;
  }
  return String(value);
}

function recordField(
  object: Record<string, unknown> | undefined,
  field: string,
): Record<string, unknown> | undefined {
  const value = object?.[field];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatInfoValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Não informado";
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return formatNumber(value);
  return String(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatOptionalInteger(value: number | null): string {
  return value === null
    ? "N/D"
    : new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 0,
      }).format(value);
}

function formatOptionalCurrency(value: number | null): string {
  return value === null ? "N/D" : formatCurrency(value);
}

function formatDate(value?: string): string {
  if (!value) return "agora";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(".", "");
}
