"use client";

import Link from "next/link";
import {
  ArrowUpOutlined,
  BankOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Empty,
  Flex,
  List,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  theme,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";

import { formatCurrency, type CityAccount } from "@/core/lib/city-types";
import type {
  CityReport,
  CityReportSnapshot,
} from "@/modules/cidades/reports-types";

const { Text, Title } = Typography;

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

/** Uma linha da tabela de composição VAAF/VAAT/VAAR. */
interface SupplementRow {
  label: string;
  current: number | null;
  projected: number | null;
  gain: number | null;
}

export function FundebDataTab({
  city,
  reports,
  pending,
  selected,
  onSelect,
}: FundebDataTabProps) {
  const { token } = theme.useToken();

  if (pending) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }

  const reportsWithData = reports.filter((report) => report.snapshot);
  const active =
    (selected?.snapshot ? selected : undefined) ?? reportsWithData[0];

  if (!active?.snapshot) {
    return (
      <Card>
        <Empty
          image={Empty.PRESENTED_IMAGE_DEFAULT}
          description={
            <Space direction="vertical" size={4} style={{ maxWidth: 460 }}>
              <Text strong>Ficha FUNDEB ainda não disponível</Text>
              <Text type="secondary">
                Gere o primeiro levantamento para preencher receitas,
                projeções, VAAF, VAAT, VAAR, Censo Escolar, habilitação e
                parâmetros técnicos desta cidade.
              </Text>
            </Space>
          }
        >
          <Link href={`/modulos/levantamento-fundeb?ibge=${city.codigoIbge}`}>
            <Button type="primary" icon={<RocketOutlined />}>
              Gerar levantamento FUNDEB
            </Button>
          </Link>
        </Empty>
      </Card>
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

  const supplements: SupplementRow[] = [
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

  const supplementColumns: TableColumnsType<SupplementRow> = [
    { title: "Modalidade", dataIndex: "label", key: "label" },
    {
      title: "Atual",
      dataIndex: "current",
      key: "current",
      align: "right",
      render: (value: number | null) => (
        <span style={{ fontFamily: "var(--font-sync-mono)" }}>
          {formatOptionalCurrency(value)}
        </span>
      ),
    },
    {
      title: "Projetado",
      dataIndex: "projected",
      key: "projected",
      align: "right",
      render: (value: number | null) => (
        <span style={{ fontFamily: "var(--font-sync-mono)" }}>
          {formatOptionalCurrency(value)}
        </span>
      ),
    },
    {
      title: "Ganho",
      dataIndex: "gain",
      key: "gain",
      align: "right",
      render: (value: number | null) => (
        <span
          style={{
            fontFamily: "var(--font-sync-mono)",
            color: token.colorSuccess,
            fontWeight: 600,
          }}
        >
          {formatOptionalCurrency(value)}
        </span>
      ),
    },
  ];

  return (
    <Flex vertical gap={14}>
      <Card size="small">
        <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
          <Flex align="center" gap={12}>
            <Flex
              align="center"
              justify="center"
              style={{
                width: 42,
                height: 42,
                flex: "0 0 auto",
                borderRadius: token.borderRadiusLG,
                background: token.colorSuccessBg,
                color: token.colorSuccess,
              }}
            >
              <BankOutlined style={{ fontSize: 19 }} />
            </Flex>
            <div>
              <Title level={5} style={{ margin: 0 }}>
                Ficha do levantamento FUNDEB
              </Title>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {city.name} · exercício {active.exercise} ·{" "}
                {sections.length} blocos preservados
              </Text>
            </div>
          </Flex>
          <Flex align="flex-end" gap={10} wrap="wrap">
            <Flex vertical gap={4}>
              <Text
                type="secondary"
                style={{
                  fontFamily: "var(--font-sync-mono)",
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                }}
              >
                Versão consultada
              </Text>
              <Select
                value={active.id}
                onChange={(value) => onSelect(value)}
                style={{ minWidth: 220 }}
                options={reportsWithData.map((report) => ({
                  value: report.id,
                  label: `${report.exercise} · ${formatDate(report.generatedAt)}`,
                }))}
              />
            </Flex>
            {active.downloadUrl && (
              <Button
                href={active.downloadUrl}
                target="_blank"
                rel="noreferrer"
                icon={<ArrowUpOutlined />}
              >
                Abrir PDF
              </Button>
            )}
          </Flex>
        </Flex>
      </Card>

      <Card style={{ background: token.colorBgSpotlight, border: "none" }}>
        <Row gutter={[24, 20]} align="middle">
          <Col
            xs={24}
            md={9}
            style={{
              borderRight: "1px solid rgba(255,255,255,.1)",
              paddingRight: 24,
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,.6)",
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              Potencial recuperável identificado
            </Text>
            <div
              style={{
                marginTop: 4,
                color: token.colorTextLightSolid,
                fontFamily: "var(--font-sync-mono)",
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: -1,
              }}
            >
              {formatOptionalCurrency(gain)}
            </div>
            <Text style={{ color: token.colorSuccess, fontSize: 11 }}>
              {gainPercentage === null
                ? "Percentual não informado"
                : `+${formatNumber(gainPercentage)}% sobre a base atual`}
            </Text>
          </Col>
          <Col xs={24} md={15}>
            <Row gutter={16}>
              <Col span={8}>
                <HeroMetric
                  label="Receita atual"
                  value={formatOptionalCurrency(current)}
                />
              </Col>
              <Col span={8}>
                <HeroMetric
                  label="Receita projetada"
                  value={formatOptionalCurrency(projected)}
                />
              </Col>
              <Col span={8}>
                <HeroMetric
                  label="Matrículas consideradas"
                  value={formatOptionalInteger(enrollments)}
                />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Row gutter={[14, 14]}>
        <Col xs={24} xl={13}>
          <Card
            title="Composição das complementações"
            size="small"
            extra={
              <Text type="secondary" style={{ fontSize: 10 }}>
                Valores atuais, projeção e ganho por modalidade
              </Text>
            }
          >
            <Table<SupplementRow>
              rowKey="label"
              size="small"
              pagination={false}
              dataSource={supplements}
              columns={supplementColumns}
            />
          </Card>
        </Col>

        <Col xs={24} xl={11}>
          <Card
            title="Identificação do levantamento"
            size="small"
            extra={
              <Text type="secondary" style={{ fontSize: 10 }}>
                Campos informados nesta versão
              </Text>
            }
          >
            <Descriptions
              size="small"
              column={1}
              items={[
                ["Responsável técnico", parameters?.responsavelTecnico],
                ["Órgão demandante", parameters?.orgaoDemandante],
                ["Secretário(a) de Educação", parameters?.secretarioEducacao],
                ["Número do processo", parameters?.numeroProcesso],
                ["Período de referência", parameters?.periodoReferencia],
                ["Cenário da análise", parameters?.cenarioAnalise],
              ].map(([label, value]) => ({
                key: label as string,
                label: label as string,
                children: formatInfoValue(value),
              }))}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[14, 14]}>
        <Col xs={24} xl={11}>
          <Card
            title="Rede educacional considerada"
            size="small"
            extra={
              <Text type="secondary" style={{ fontSize: 10 }}>
                Censo Escolar{censusYear ? ` · ${censusYear}` : ""}
              </Text>
            }
          >
            <Row
              style={{
                background: token.colorFillTertiary,
                borderRadius: token.borderRadiusLG,
                padding: "14px 4px",
              }}
            >
              <Col span={8}>
                <HeroMetric
                  dark={false}
                  label="Matrículas municipais"
                  value={formatOptionalInteger(enrollments)}
                />
              </Col>
              <Col span={8}>
                <HeroMetric
                  dark={false}
                  label="Escolas municipais"
                  value={formatOptionalInteger(schools)}
                />
              </Col>
              <Col span={8}>
                <HeroMetric
                  dark={false}
                  label="Docentes municipais"
                  value={formatOptionalInteger(teachers)}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} xl={13}>
          <Card
            title="Habilitação e perfil técnico"
            size="small"
            extra={
              <SafetyCertificateOutlined
                style={{ color: token.colorTextTertiary }}
              />
            }
          >
            <Descriptions
              size="small"
              column={2}
              items={[
                ["Habilitação VAAT", profile?.habilitacaoVaat],
                ["Pendência identificada", profile?.pendenciaVaat],
                [
                  "Score de viabilidade",
                  firstNumber(profile?.score) === null
                    ? null
                    : `${formatNumber(firstNumber(profile?.score)!)} pontos`,
                ],
                [
                  "Confiança da análise",
                  firstNumber(profile?.confianca) === null
                    ? null
                    : `${formatNumber(firstNumber(profile?.confianca)!)}%`,
                ],
              ].map(([label, value]) => ({
                key: label as string,
                label: label as string,
                children: formatInfoValue(value),
              }))}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="Base completa e auditável"
        size="small"
        extra={
          <Text
            type="secondary"
            style={{ fontFamily: "var(--font-sync-mono)", fontSize: 10 }}
          >
            {active.snapshot.schemaVersion
              ? `JSON v${active.snapshot.schemaVersion}`
              : "JSON legado"}{" "}
            · {formatDate(active.generatedAt)}
          </Text>
        }
      >
        <Text type="secondary" style={{ fontSize: 10.5 }}>
          Todos os campos do JSON original permanecem disponíveis por bloco.
        </Text>
        <Collapse
          style={{ marginTop: 12 }}
          size="small"
          defaultActiveKey={sections[0] ? [sections[0].id] : []}
          items={sections.map((section) => ({
            key: section.id,
            label: (
              <Space direction="vertical" size={0}>
                <Text strong style={{ fontSize: 11 }}>
                  {section.title}
                </Text>
                <Text
                  type="secondary"
                  style={{ fontFamily: "var(--font-sync-mono)", fontSize: 9 }}
                >
                  {section.source} · {describeValue(section.value)}
                </Text>
              </Space>
            ),
            children: <DataNode value={section.value} />,
          }))}
        />
      </Card>
    </Flex>
  );
}

/** Métrica curta, reaproveitada no card escuro e no bloco de rede
 * educacional. Usa os tokens do tema — nunca cor solta — para se adaptar aos
 * dois fundos (claro e o `colorBgSpotlight` escuro do card de destaque). */
function HeroMetric({
  label,
  value,
  dark = true,
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  const { token } = theme.useToken();
  return (
    <div>
      <Text
        style={{
          display: "block",
          fontSize: 9,
          fontWeight: 600,
          color: dark ? "rgba(255,255,255,.5)" : token.colorTextTertiary,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          display: "block",
          marginTop: 4,
          fontFamily: "var(--font-sync-mono)",
          fontSize: 15,
          fontWeight: 600,
          color: dark ? token.colorTextLightSolid : token.colorText,
        }}
      >
        {value}
      </Text>
    </div>
  );
}

/**
 * Nó recursivo do JSON auditável. Troca o antigo `<details>` aninhado por
 * `Descriptions` para os campos-folha de um bloco e `Collapse` (`ghost`) para
 * os campos que ainda têm objeto dentro — mesma navegação, sem CSS próprio.
 */
function DataNode({ value, field = "" }: { value: unknown; field?: string }) {
  if (!value || typeof value !== "object") {
    return (
      <Text style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11.5 }}>
        {formatDataValue(value, field)}
      </Text>
    );
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return (
        <Text type="secondary" style={{ fontSize: 11 }}>
          Sem registros
        </Text>
      );
    }
    if (value.every((item) => !item || typeof item !== "object")) {
      return (
        <List
          size="small"
          dataSource={value}
          renderItem={(item, index) => (
            <List.Item key={index} style={{ padding: "4px 0", border: "none" }}>
              <Text style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11.5 }}>
                {formatDataValue(item, field)}
              </Text>
            </List.Item>
          )}
        />
      );
    }
    return (
      <Collapse
        ghost
        size="small"
        items={value.map((item, index) => ({
          key: index,
          label: (
            <Text strong style={{ fontSize: 11 }}>
              {`Item ${index + 1}`}
            </Text>
          ),
          children: <DataNode value={item} field={field} />,
        }))}
      />
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) {
    return (
      <Text type="secondary" style={{ fontSize: 11 }}>
        Sem registros
      </Text>
    );
  }

  const leafEntries = entries.filter(
    ([, nested]) => !nested || typeof nested !== "object",
  );
  const nestedEntries = entries.filter(
    ([, nested]) => nested && typeof nested === "object",
  );

  return (
    <Space direction="vertical" size={10} style={{ width: "100%" }}>
      {leafEntries.length > 0 && (
        <Descriptions
          size="small"
          column={1}
          items={leafEntries.map(([key, nested]) => ({
            key,
            label: humanizeKey(key),
            children: (
              <Text style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11.5 }}>
                {formatDataValue(nested, key)}
              </Text>
            ),
          }))}
        />
      )}
      {nestedEntries.length > 0 && (
        <Collapse
          ghost
          size="small"
          items={nestedEntries.map(([key, nested]) => ({
            key,
            label: (
              <Space size={6}>
                <Text strong style={{ fontSize: 11 }}>
                  {humanizeKey(key)}
                </Text>
                <Text
                  type="secondary"
                  style={{ fontFamily: "var(--font-sync-mono)", fontSize: 10 }}
                >
                  · {describeValue(nested)}
                </Text>
              </Space>
            ),
            children: <DataNode value={nested} field={key} />,
          }))}
        />
      )}
    </Space>
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

  for (const [key, value] of Object.entries(snapshot.additionalData ?? {})) {
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
    if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(date.getTime())) {
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
