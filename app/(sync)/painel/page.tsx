"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  HistoryOutlined,
  PlusOutlined,
  RightOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { ProCard, ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import {
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Segmented,
  Statistic,
  Tag,
  Typography,
  theme,
} from "antd";

import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import { listCities } from "@/core/lib/cities-firestore";
import { listCityReports } from "@/modules/cidades/city-reports-firestore";
import {
  STAGE_LABELS,
  formatCurrency,
  formatCurrencyCompact,
  stagePastelTone,
  type CityAccount,
} from "@/core/lib/city-types";
import { NovoLevantamentoWizard } from "@/core/components/novo-levantamento-wizard";

const FONTE_NUMERO = "var(--font-sync-mono)";

interface LinhaDoPainel extends CityAccount {
  lucroProjetado: number;
  isQualificado: boolean;
}

export default function PainelPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { token } = theme.useToken();
  const [periodoView, setPeriodoView] = useState<string>("Estágios");
  const [filtroEstagio, setFiltroEstagio] = useState<string>("qualificados");
  const [wizardAberto, setWizardAberto] = useState(false);

  // 1. Consulta real de cidades no Firestore
  const {
    data: cities = [],
    isLoading: loadingCities,
    refetch: refetchCities,
  } = useQuery({
    queryKey: ["dashboard-cities-real", user?.groupId],
    queryFn: async () => {
      if (!user?.groupId) return [];
      const db = getFirebaseDb();
      return await listCities(db, user.groupId);
    },
    enabled: !!user?.groupId,
  });

  // 2. Consulta real de relatórios emitidos no Firestore
  const {
    data: reports = [],
    isLoading: loadingReports,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ["dashboard-reports-real", user?.groupId],
    queryFn: async () => {
      if (!user?.groupId) return [];
      const db = getFirebaseDb();
      return await listCityReports(db, user.groupId);
    },
    enabled: !!user?.groupId,
  });

  const isLoading = loadingCities || loadingReports;
  const totalCidades = cities.length;
  const nomeUsuario = user?.name || user?.email?.split("@")[0] || "Usuário";

  // Agrupamento entre PIPELINE QUALIFICADO (Contratos e Negociações/Reuniões) e EXPLORATÓRIO (Diagnósticos Técnicos com baixa conversão ~10%)
  const contratadas = useMemo(
    () => cities.filter((c) => ["contractual", "implementation", "assisted_operation", "fidelized"].includes(c.stage)),
    [cities]
  );

  const emProposta = useMemo(
    () => cities.filter((c) => ["proposal_presented", "negotiation", "verbal_approval"].includes(c.stage)),
    [cities]
  );

  const emDiagnosticoExploratorio = useMemo(
    () => cities.filter((c) => ["technical_diagnostic", "institutional_validation"].includes(c.stage)),
    [cities]
  );

  const emMapeamento = useMemo(
    () => cities.filter((c) => ["mapping", "first_contact"].includes(c.stage)),
    [cities]
  );

  // Receita QUALIFICADA (Somente cidades com contrato ou reuniões/propostas avançadas)
  const receitaQualificada = useMemo(() => {
    return [...contratadas, ...emProposta].reduce((sum, c) => sum + (c.estimatedAnnualRevenue || 0), 0);
  }, [contratadas, emProposta]);

  // Receita EXPLORATÓRIA (Diagnósticos prévios em volume)
  const receitaExploratoria = useMemo(() => {
    return [...emDiagnosticoExploratorio, ...emMapeamento].reduce((sum, c) => sum + (c.estimatedAnnualRevenue || 0), 0);
  }, [emDiagnosticoExploratorio, emMapeamento]);

  const lucroQualificadoEst = receitaQualificada * 0.35;

  // Radar de Reuniões Marcadas e Próximos Passos Urgentes
  const pendingActions = useMemo(() => {
    const now = new Date();
    return cities
      .filter((c) => c.nextStepDueDate || c.nextStepDescription)
      .map((c) => {
        let status: "overdue" | "today" | "upcoming" = "upcoming";
        let daysDiff = 999;
        if (c.nextStepDueDate) {
          const due = new Date(c.nextStepDueDate);
          daysDiff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff < 0) status = "overdue";
          else if (daysDiff === 0) status = "today";
        }

        const isQualificado = ["contractual", "implementation", "assisted_operation", "fidelized", "proposal_presented", "negotiation", "verbal_approval"].includes(c.stage);

        return { city: c, status, daysDiff, isQualificado };
      })
      .sort((a, b) => {
        // Prioriza qualificadas primeiro, depois prazos mais próximos
        if (a.isQualificado !== b.isQualificado) return a.isQualificado ? -1 : 1;
        return a.daysDiff - b.daysDiff;
      });
  }, [cities]);

  // Quebra por estágios destacando o pipeline comercial qualificado
  const stageBreakdown = useMemo(() => {
    const stages = [
      { key: "contractual", label: "Contratos Vigentes", color: token.colorSuccess, cities: contratadas, qualificado: true },
      { key: "proposal_presented", label: "Reuniões / Propostas", color: token.colorPrimary, cities: emProposta, qualificado: true },
      { key: "technical_diagnostic", label: "Diag. Exploratório (~10% conv.)", color: token.colorWarning, cities: emDiagnosticoExploratorio, qualificado: false },
      { key: "mapping", label: "Prospecção Inicial", color: token.colorInfo, cities: emMapeamento, qualificado: false },
    ];

    const totalCalculo = receitaQualificada + receitaExploratoria;

    return stages.map((s) => {
      const revenue = s.cities.reduce((acc, c) => acc + (c.estimatedAnnualRevenue || 0), 0);
      const count = s.cities.length;
      return {
        ...s,
        revenue,
        count,
        pct: totalCalculo > 0 ? Math.round((revenue / totalCalculo) * 100) : 0,
      };
    });
  }, [contratadas, emProposta, emDiagnosticoExploratorio, emMapeamento, receitaQualificada, receitaExploratoria, token]);

  // Atividade mensal baseada em eventos reais de emissão ou atualização no ano atual
  const monthlyActivity = useMemo(() => {
    const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    const counts = new Array(12).fill(0);
    const currentYear = new Date().getFullYear();

    reports.forEach((r) => {
      if (r.generatedAt) {
        const d = new Date(r.generatedAt);
        if (!isNaN(d.getTime()) && d.getFullYear() === currentYear) {
          counts[d.getMonth()] += 1;
        }
      }
    });

    cities.forEach((c) => {
      if (c.lastActivityAt) {
        const d = new Date(c.lastActivityAt);
        if (!isNaN(d.getTime()) && d.getFullYear() === currentYear) {
          counts[d.getMonth()] += 1;
        }
      }
    });

    const maxCount = Math.max(...counts, 1);
    const currentMonthIndex = new Date().getMonth();

    return months.map((nome, i) => ({
      nome,
      count: counts[i],
      altura: `${Math.max(10, Math.round((counts[i] / maxCount) * 100))}%`,
      isCurrentMonth: i === currentMonthIndex,
    }));
  }, [reports, cities]);

  // Filtragem da tabela priorizando os municípios qualificados por padrão
  const cidadesFiltradas = useMemo(() => {
    let result = cities;
    if (filtroEstagio === "qualificados") {
      result = result.filter((c) =>
        ["contractual", "implementation", "assisted_operation", "fidelized", "proposal_presented", "negotiation", "verbal_approval"].includes(c.stage)
      );
    } else if (filtroEstagio === "contratos") {
      result = result.filter((c) => ["contractual", "implementation", "assisted_operation", "fidelized"].includes(c.stage));
    } else if (filtroEstagio === "propostas") {
      result = result.filter((c) => ["proposal_presented", "negotiation", "verbal_approval"].includes(c.stage));
    } else if (filtroEstagio === "exploratorios") {
      result = result.filter((c) => ["technical_diagnostic", "institutional_validation", "mapping", "first_contact"].includes(c.stage));
    }
    return result.map((c) => ({
      ...c,
      lucroProjetado: (c.estimatedAnnualRevenue || 0) * 0.35,
      isQualificado: ["contractual", "implementation", "assisted_operation", "fidelized", "proposal_presented", "negotiation", "verbal_approval"].includes(c.stage),
    }));
  }, [cities, filtroEstagio]);

  const dataAtualFormatada = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const colunas: ProColumns<LinhaDoPainel>[] = [
    {
      title: "Município",
      dataIndex: "name",
      ellipsis: true,
      search: false,
      sorter: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
      render: (_, linha) => (
        <Flex align="center" gap={8}>
          <Link href={`/cidades/${linha.id}`} style={{ fontWeight: 600, color: token.colorText }}>
            {linha.name}
          </Link>
          <Tag style={{ fontSize: 10, margin: 0, paddingInline: 6 }}>{linha.uf}</Tag>
          {linha.isQualificado && (
            <Tag color="purple" style={{ fontSize: 9.5, margin: 0, paddingInline: 6 }}>
              Qualificado
            </Tag>
          )}
        </Flex>
      ),
    },
    {
      title: "Estágio no Pipeline",
      dataIndex: "stage",
      width: 170,
      search: false,
      render: (_, linha) => {
        const tom = stagePastelTone(linha.stage);
        return (
          <Tag style={{ background: tom.bg, color: tom.text, border: "none", borderRadius: 999 }}>
            {STAGE_LABELS[linha.stage] ?? linha.stage}
          </Tag>
        );
      },
    },
    {
      title: "Reunião / Próxima Ação",
      dataIndex: "nextStepDescription",
      ellipsis: true,
      search: false,
      render: (_, linha) => {
        if (!linha.nextStepDescription && !linha.nextStepDueDate) {
          return <Typography.Text type="secondary" style={{ fontSize: 12 }}>—</Typography.Text>;
        }
        const due = linha.nextStepDueDate ? new Date(linha.nextStepDueDate) : null;
        const overdue = due && due < new Date();
        return (
          <Flex vertical gap={2}>
            <Typography.Text ellipsis style={{ fontSize: 12, fontWeight: linha.isQualificado ? 600 : 400 }}>
              {linha.nextStepDescription || "Reunião / acompanhamento comercial"}
            </Typography.Text>
            {linha.nextStepDueDate && (
              <Typography.Text
                style={{
                  fontFamily: FONTE_NUMERO,
                  fontSize: 10,
                  color: overdue ? token.colorErrorText : token.colorTextDescription,
                  fontWeight: overdue ? 600 : 400,
                }}
              >
                {overdue ? "Atrasado desde " : "Data: "}
                {new Date(linha.nextStepDueDate).toLocaleDateString("pt-BR")}
              </Typography.Text>
            )}
          </Flex>
        );
      },
    },
    {
      title: "Receita Est. Anual",
      dataIndex: "estimatedAnnualRevenue",
      align: "right",
      width: 150,
      search: false,
      sorter: (a, b) => (a.estimatedAnnualRevenue || 0) - (b.estimatedAnnualRevenue || 0),
      render: (_, linha) => (
        <span style={{ fontFamily: FONTE_NUMERO, fontWeight: linha.isQualificado ? 700 : 400 }}>
          {formatCurrency(linha.estimatedAnnualRevenue || 0)}
        </span>
      ),
    },
    {
      title: "Lucro Proj. (35%)",
      dataIndex: "lucroProjetado",
      align: "right",
      width: 140,
      search: false,
      sorter: (a, b) => a.lucroProjetado - b.lucroProjetado,
      render: (_, linha) => (
        <span style={{ fontFamily: FONTE_NUMERO, color: token.colorSuccessText, fontWeight: 600 }}>
          {formatCurrencyCompact(linha.lucroProjetado)}
        </span>
      ),
    },
    {
      title: "",
      width: 44,
      align: "center",
      search: false,
      render: (_, linha) => (
        <Button
          type="text"
          size="small"
          icon={<RightOutlined style={{ color: token.colorTextQuaternary }} />}
          onClick={() => router.push(`/cidades/${linha.id}`)}
          aria-label={`Ver ${linha.name}`}
        />
      ),
    },
  ];

  return (
    <>
      <Flex vertical gap={16}>
        {/* ── Topo: boas-vindas e ações rápidas ──────────────────────────── */}
        <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Painel Executivo · {nomeUsuario}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {dataAtualFormatada} · Foco em Municípios Qualificados & Reuniões
            </Typography.Text>
          </div>

          <Flex align="center" gap={10}>
            <Button icon={<HistoryOutlined />} onClick={() => router.push("/caixa")}>
              Trilha de Caixa
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setWizardAberto(true)}
            >
              Novo Município
            </Button>
          </Flex>
        </Flex>

        {/* ── Linha 1: KPIs Focados no Pipeline Qualificado ──────────────── */}
        <ProCard gutter={[16, 16]} wrap ghost>
          <ProCard colSpan={{ xs: 24, sm: 12, lg: 6 }}>
            <Statistic
              title="Receita Qualificada"
              value={formatCurrencyCompact(receitaQualificada)}
              prefix={<RiseOutlined style={{ color: token.colorSuccessText }} />}
              styles={{ content: { fontFamily: FONTE_NUMERO, fontWeight: 700 } }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {contratadas.length} contratos + {emProposta.length} em reunião/negociação
            </Typography.Text>
          </ProCard>

          <ProCard colSpan={{ xs: 24, sm: 12, lg: 6 }}>
            <Statistic
              title="Lucro Projetado (Qualificado)"
              value={formatCurrencyCompact(lucroQualificadoEst)}
              prefix={<SafetyCertificateOutlined style={{ color: token.colorInfo }} />}
              styles={{ content: { fontFamily: FONTE_NUMERO, fontWeight: 700 } }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              Estimativa de 35% de margem no pipeline real
            </Typography.Text>
          </ProCard>

          <ProCard colSpan={{ xs: 24, sm: 12, lg: 6 }}>
            <Statistic
              title="Reuniões & Propostas"
              value={emProposta.length + contratadas.length}
              prefix={<CalendarOutlined style={{ color: token.colorPrimary }} />}
              suffix={<span style={{ fontSize: 11, color: token.colorTextTertiary }}>qualificadas</span>}
              styles={{ content: { fontFamily: FONTE_NUMERO, fontWeight: 600 } }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              Cidades em negociação ativa ou fechadas
            </Typography.Text>
          </ProCard>

          <ProCard colSpan={{ xs: 24, sm: 12, lg: 6 }}>
            <Statistic
              title="Diagnósticos Exploratórios"
              value={emDiagnosticoExploratorio.length}
              prefix={<FileTextOutlined style={{ color: token.colorWarning }} />}
              suffix={<span style={{ fontSize: 11, color: token.colorTextTertiary }}>estudos</span>}
              styles={{ content: { fontFamily: FONTE_NUMERO, fontWeight: 600 } }}
            />
            <Tag color="warning" style={{ fontSize: 10, margin: 0 }}>
              Fase prévia (~10% conversão)
            </Tag>
          </ProCard>
        </ProCard>

        {/* ── Linha 2: Distribuição do Pipeline & Agenda de Reuniões ─────── */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card
              size="small"
              title="Distribuição do Pipeline Comercial"
              extra={
                <Segmented
                  size="small"
                  value={periodoView}
                  onChange={setPeriodoView}
                  options={["Estágios", "Atividade"]}
                />
              }
            >
              {periodoView === "Estágios" ? (
                <Flex vertical gap={16} style={{ padding: "8px 0" }}>
                  {/* Barra proporcional visual */}
                  <Flex
                    gap={3}
                    style={{
                      height: 16,
                      borderRadius: 8,
                      overflow: "hidden",
                      background: token.colorFillTertiary,
                    }}
                  >
                    {stageBreakdown.map(
                      (s) =>
                        s.pct > 0 && (
                          <div
                            key={s.key}
                            title={`${s.label}: ${formatCurrency(s.revenue)} (${s.pct}%)`}
                            style={{
                              width: `${s.pct}%`,
                              background: s.color,
                              cursor: "pointer",
                              opacity: s.qualificado ? 1 : 0.6,
                            }}
                          />
                        )
                    )}
                  </Flex>

                  {/* Detalhamento com destaque para o pipeline qualificado */}
                  <Row gutter={[12, 12]}>
                    {stageBreakdown.map((s) => (
                      <Col key={s.key} xs={12} sm={6}>
                        <Card
                          size="small"
                          style={{
                            background: s.qualificado ? token.colorFillAlter : token.colorFillQuaternary,
                            border: s.qualificado ? `1px solid ${token.colorBorderSecondary}` : "none",
                            borderRadius: token.borderRadius,
                          }}
                        >
                          <Flex align="center" gap={6} style={{ marginBottom: 4 }}>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: s.color,
                              }}
                            />
                            <Typography.Text strong={s.qualificado} style={{ fontSize: 11 }}>
                              {s.label}
                            </Typography.Text>
                          </Flex>
                          <Typography.Text
                            style={{
                              fontFamily: FONTE_NUMERO,
                              fontSize: 13,
                              fontWeight: s.qualificado ? 700 : 500,
                              display: "block",
                            }}
                          >
                            {formatCurrencyCompact(s.revenue)}
                          </Typography.Text>
                          <Typography.Text type="secondary" style={{ fontSize: 10 }}>
                            {s.count} mun. ({s.pct}%)
                          </Typography.Text>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </Flex>
              ) : (
                <Flex vertical gap={12} style={{ padding: "8px 0" }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Volume de movimentações e emissões de dossiês em 2026 por mês:
                  </Typography.Text>

                  <Flex align="flex-end" gap={8} style={{ height: 140, paddingTop: 10 }}>
                    {monthlyActivity.map((m) => (
                      <Flex
                        key={m.nome}
                        vertical
                        align="center"
                        justify="flex-end"
                        gap={6}
                        style={{ height: "100%", flex: 1 }}
                      >
                        <div
                          title={`${m.nome}: ${m.count} atividades`}
                          style={{
                            width: "100%",
                            height: m.altura,
                            borderRadius: 6,
                            background: m.isCurrentMonth
                              ? token.colorPrimary
                              : m.count > 0
                                ? token.colorInfo
                                : token.colorFillTertiary,
                            opacity: m.count > 0 ? 0.9 : 0.4,
                            transition: "all 0.3s",
                          }}
                        />
                        <span
                          style={{
                            fontFamily: FONTE_NUMERO,
                            fontSize: 9.5,
                            fontWeight: m.isCurrentMonth ? 700 : 400,
                            color: m.isCurrentMonth ? token.colorPrimary : token.colorTextTertiary,
                          }}
                        >
                          {m.nome}
                        </span>
                      </Flex>
                    ))}
                  </Flex>
                </Flex>
              )}
            </Card>
          </Col>

          {/* Agenda de Reuniões & Próximos Passos Reais */}
          <Col xs={24} lg={10}>
            <Card
              size="small"
              title="Agenda de Reuniões & Próximos Passos"
              extra={
                <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>
                  {pendingActions.filter((p) => p.isQualificado).length} qualificadas
                </Tag>
              }
              style={{ height: "100%" }}
            >
              {pendingActions.length > 0 ? (
                <Flex vertical gap={10}>
                  {pendingActions.slice(0, 4).map(({ city, status, daysDiff, isQualificado }) => (
                    <Flex
                      key={city.id}
                      align="center"
                      justify="space-between"
                      style={{
                        padding: "9px 12px",
                        borderRadius: token.borderRadiusLG,
                        background:
                          status === "overdue"
                            ? token.colorErrorBg
                            : status === "today"
                              ? token.colorWarningBg
                              : isQualificado
                                ? token.colorFillSecondary
                                : token.colorFillTertiary,
                        border: isQualificado ? `1px solid ${token.colorPrimaryBorder}` : "none",
                        cursor: "pointer",
                      }}
                      onClick={() => router.push(`/cidades/${city.id}`)}
                    >
                      <Flex align="center" gap={10} style={{ minWidth: 0, flex: 1 }}>
                        {status === "overdue" ? (
                          <WarningOutlined style={{ color: token.colorError, fontSize: 16 }} />
                        ) : status === "today" ? (
                          <ClockCircleOutlined style={{ color: token.colorWarning, fontSize: 16 }} />
                        ) : (
                          <CalendarOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />
                        )}

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <Flex align="center" gap={6}>
                            <Typography.Text strong ellipsis style={{ fontSize: 12.5 }}>
                              {city.name} ({city.uf})
                            </Typography.Text>
                            {isQualificado && (
                              <Tag color="purple" style={{ fontSize: 8.5, paddingInline: 4, margin: 0 }}>
                                Reunião / Proposta
                              </Tag>
                            )}
                          </Flex>
                          <Typography.Text type="secondary" ellipsis style={{ fontSize: 11, display: "block" }}>
                            {city.nextStepDescription || "Reunião de apresentação / negociação"}
                          </Typography.Text>
                        </div>
                      </Flex>

                      <Tag
                        color={status === "overdue" ? "error" : status === "today" ? "warning" : "default"}
                        style={{ fontFamily: FONTE_NUMERO, fontSize: 10, margin: 0 }}
                      >
                        {status === "overdue"
                          ? `Atrasado ${Math.abs(daysDiff)}d`
                          : status === "today"
                            ? "Vence Hoje"
                            : `em ${daysDiff}d`}
                      </Tag>
                    </Flex>
                  ))}
                </Flex>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Nenhuma reunião ou ação agendada."
                  style={{ padding: "20px 0" }}
                />
              )}
            </Card>
          </Col>
        </Row>

        {/* ── Linha 3: Tabela de Cidades da Carteira ────────────────────── */}
        <ProTable<LinhaDoPainel>
          headerTitle="Municípios da Carteira"
          rowKey="id"
          size="small"
          cardBordered
          loading={isLoading}
          dataSource={cidadesFiltradas}
          columns={colunas}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          search={false}
          options={{ reload: () => { refetchCities(); refetchReports(); }, density: false, setting: false }}
          dateFormatter="string"
          toolbar={{
            menu: {
              type: "tab",
              activeKey: filtroEstagio,
              onChange: (key) => setFiltroEstagio(key as string),
              items: [
                { key: "qualificados", label: `Qualificados & Reuniões (${contratadas.length + emProposta.length})` },
                { key: "contratos", label: `Contratados (${contratadas.length})` },
                { key: "propostas", label: `Reuniões / Propostas (${emProposta.length})` },
                { key: "exploratorios", label: `Exploratórios / Estudos (${emDiagnosticoExploratorio.length + emMapeamento.length})` },
                { key: "todos", label: `Todos os Municípios (${totalCidades})` },
              ],
            },
            actions: [
              <Button
                key="nova"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setWizardAberto(true)}
              >
                Novo Município
              </Button>,
            ],
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Flex vertical align="center" gap={4}>
                    <Typography.Text strong>
                      Nenhum município cadastrado neste filtro
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12, maxWidth: 400 }}>
                      Adicione um município ou selecione outra aba de filtro para visualizar sua carteira.
                    </Typography.Text>
                  </Flex>
                }
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setWizardAberto(true)}>
                  Adicionar primeiro município
                </Button>
              </Empty>
            ),
          }}
        />
      </Flex>

      {wizardAberto && (
        <NovoLevantamentoWizard
          onClose={() => {
            setWizardAberto(false);
            refetchCities();
            refetchReports();
          }}
        />
      )}
    </>
  );
}
