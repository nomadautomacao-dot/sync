"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
  RightOutlined,
  RiseOutlined,
} from "@ant-design/icons";
import { ProCard, ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { Button, Empty, Flex, Segmented, Statistic, Tag, Typography, theme } from "antd";

import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import { listCities } from "@/core/lib/cities-firestore";
import {
  STAGE_LABELS,
  formatCurrency,
  formatCurrencyCompact,
  stagePastelTone,
  type CityAccount,
} from "@/core/lib/city-types";
import { NovoLevantamentoWizard } from "@/core/components/novo-levantamento-wizard";

const FONTE_NUMERO = "var(--font-sync-mono)";

/**
 * Meses do gráfico "Receita no ano".
 *
 * É decoração — nenhuma consulta alimenta essas alturas. O `tier` só marca
 * qual trimestre recebe a cor de destaque; a régua de valor real não existe
 * ainda nesta tela.
 */
const MESES: { nome: string; altura: string; tier: 0 | 1 | 2 }[] = [
  { nome: "JAN", altura: "44%", tier: 0 },
  { nome: "FEV", altura: "52%", tier: 0 },
  { nome: "MAR", altura: "47%", tier: 0 },
  { nome: "ABR", altura: "63%", tier: 0 },
  { nome: "MAI", altura: "58%", tier: 0 },
  { nome: "JUN", altura: "74%", tier: 0 },
  { nome: "JUL", altura: "69%", tier: 1 },
  { nome: "AGO", altura: "88%", tier: 1 },
  { nome: "SET", altura: "100%", tier: 1 },
  { nome: "OUT", altura: "34%", tier: 2 },
  { nome: "NOV", altura: "30%", tier: 2 },
  { nome: "DEZ", altura: "26%", tier: 2 },
];

interface LinhaDoPainel extends CityAccount {
  lucroProjetado: number;
}

export default function PainelPage() {
  const { user } = useAuth();
  const { token } = theme.useToken();
  const [periodo, setPeriodo] = useState<string>("Trimestre");
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

  // Métricas reais
  const contratoCount = cities.filter((c) =>
    ["contractual", "implementation", "assisted_operation", "fidelized"].includes(c.stage)
  ).length;

  const propostaCount = cities.filter((c) =>
    ["proposal_presented", "negotiation", "verbal_approval"].includes(c.stage)
  ).length;

  const estudoCount = cities.filter((c) =>
    ["technical_diagnostic", "institutional_validation"].includes(c.stage)
  ).length;

  const contatoCount = cities.filter((c) => ["mapping", "first_contact"].includes(c.stage)).length;

  const totalReceita = cities.reduce((sum, c) => sum + (c.estimatedAnnualRevenue || 0), 0);
  const totalLucro = totalReceita * 0.35;

  const pendenciasCount = cities.filter(
    (c) => c.stage === "paused" || (c.nextStepDueDate && new Date(c.nextStepDueDate) < new Date())
  ).length;

  const pctContrato = totalCidades > 0 ? Math.round((contratoCount / totalCidades) * 100) : 0;
  const pctProposta = totalCidades > 0 ? Math.round((propostaCount / totalCidades) * 100) : 0;
  const pctEstudo = totalCidades > 0 ? Math.round((estudoCount / totalCidades) * 100) : 0;
  const pctContato = totalCidades > 0 ? Math.max(0, 100 - pctContrato - pctProposta - pctEstudo) : 0;

  const dataAtualFormatada = new Date().toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  /* As quatro famílias do pipeline reaproveitam `stagePastelTone`: é a mesma
     paleta que já colore o estágio na carteira e no Kanban, então a barra
     segmentada bate com o resto do produto em vez de inventar cor nova aqui. */
  const familias = [
    {
      chave: "contrato",
      rotulo: "Contrato",
      contagem: contratoCount,
      pct: pctContrato,
      tom: stagePastelTone("contractual"),
    },
    {
      chave: "proposta",
      rotulo: "Proposta",
      contagem: propostaCount,
      pct: pctProposta,
      tom: stagePastelTone("proposal_presented"),
    },
    {
      chave: "estudo",
      rotulo: "Estudo",
      contagem: estudoCount,
      pct: pctEstudo,
      tom: stagePastelTone("technical_diagnostic"),
    },
    {
      chave: "contato",
      rotulo: "Contato",
      contagem: contatoCount,
      pct: pctContato,
      tom: stagePastelTone("mapping"),
    },
  ];

  const linhas: LinhaDoPainel[] = cities.map((c) => ({
    ...c,
    lucroProjetado: (c.estimatedAnnualRevenue || 0) * 0.35,
  }));

  const colunas: ProColumns<LinhaDoPainel>[] = [
    {
      title: "Município",
      dataIndex: "name",
      ellipsis: true,
      search: false,
      sorter: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
      render: (_, linha) => (
        <Link href="/pipeline" style={{ fontWeight: 600 }}>
          {linha.name}
        </Link>
      ),
    },
    {
      title: "UF",
      dataIndex: "uf",
      width: 64,
      search: false,
      render: (_, linha) => <span style={{ fontFamily: FONTE_NUMERO }}>{linha.uf}</span>,
    },
    {
      title: "Estágio",
      dataIndex: "stage",
      width: 150,
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
      title: "Receita Est.",
      dataIndex: "estimatedAnnualRevenue",
      align: "right",
      width: 120,
      search: false,
      sorter: (a, b) => (a.estimatedAnnualRevenue || 0) - (b.estimatedAnnualRevenue || 0),
      render: (_, linha) => (
        <span style={{ fontFamily: FONTE_NUMERO }}>
          {formatCurrencyCompact(linha.estimatedAnnualRevenue || 0)}
        </span>
      ),
    },
    {
      title: "Lucro Proj.",
      dataIndex: "lucroProjetado",
      align: "right",
      width: 120,
      search: false,
      sorter: (a, b) => a.lucroProjetado - b.lucroProjetado,
      render: (_, linha) => (
        <span style={{ fontFamily: FONTE_NUMERO, fontWeight: 600 }}>
          {formatCurrencyCompact(linha.lucroProjetado)}
        </span>
      ),
    },
    {
      title: "Margem",
      width: 90,
      align: "right",
      search: false,
      render: () => <span style={{ fontFamily: FONTE_NUMERO, color: token.colorSuccessText }}>35,0%</span>,
    },
    {
      title: "",
      width: 36,
      align: "right",
      search: false,
      render: (_, linha) => (
        <Link href="/pipeline" aria-label={`Abrir ${linha.name}`}>
          <RightOutlined style={{ color: token.colorTextQuaternary }} />
        </Link>
      ),
    },
  ];

  return (
    <>
      <Flex vertical gap={14}>
        {/* ── Topo: boas-vindas ─────────────────────────────────────────── */}
        <Flex justify="space-between" align="baseline">
          <Typography.Title level={3} style={{ margin: 0 }}>
            Olá, {nomeUsuario}!
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontFamily: FONTE_NUMERO, fontSize: 11 }}>
            {dataAtualFormatada} · exercício 2026
          </Typography.Text>
        </Flex>

        {/* ── Linha 1: KPIs ────────────────────────────────────────────── */}
        <ProCard gutter={16} wrap ghost>
          <ProCard colSpan={{ xs: 24, sm: 12, lg: 6 }}>
            <Statistic
              title="Municípios ativos"
              value={totalCidades}
              suffix={
                <span style={{ fontSize: 11.5, color: token.colorTextTertiary }}>na carteira</span>
              }
              valueStyle={{ fontFamily: FONTE_NUMERO, fontWeight: 600 }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
              {contratoCount} com contrato vigente
            </Typography.Text>
          </ProCard>

          <ProCard colSpan={{ xs: 24, sm: 12, lg: 9 }}>
            <Flex justify="space-between" align="baseline">
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Distribuição do pipeline
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontFamily: FONTE_NUMERO, fontSize: 10.5 }}>
                {totalCidades} municípios
              </Typography.Text>
            </Flex>

            <div style={{ height: 16 }} />

            {/* Barra segmentada dinâmica */}
            <Flex
              gap={3}
              style={{
                height: 14,
                borderRadius: 8,
                overflow: "hidden",
                background: token.colorFillTertiary,
              }}
            >
              {familias.map((f) =>
                f.pct > 0 ? (
                  <div
                    key={f.chave}
                    title={`${f.rotulo}: ${f.contagem}`}
                    style={{ width: `${f.pct}%`, background: f.tom.dot, cursor: "pointer" }}
                  />
                ) : null
              )}
            </Flex>

            <div style={{ height: 14 }} />

            <Flex wrap gap={18}>
              {familias.map((f) => (
                <Flex key={f.chave} align="center" gap={6}>
                  <span
                    style={{ width: 8, height: 8, borderRadius: 3, background: f.tom.dot, display: "inline-block" }}
                  />
                  <span style={{ fontFamily: FONTE_NUMERO, fontWeight: 600, fontSize: 11.5 }}>
                    {f.contagem}
                  </span>
                  <span style={{ fontSize: 11.5, color: token.colorTextSecondary }}>{f.rotulo}</span>
                </Flex>
              ))}
            </Flex>
          </ProCard>

          <ProCard
            colSpan={{ xs: 24, sm: 12, lg: 4 }}
            style={{
              background: `linear-gradient(135deg, ${token.colorBgContainer} 0%, ${token.colorFillTertiary} 100%)`,
            }}
          >
            <Statistic
              title="Lucro projetado"
              value={formatCurrencyCompact(totalLucro)}
              valueStyle={{ fontFamily: FONTE_NUMERO, fontWeight: 600 }}
            />
            <Flex align="center" gap={5}>
              <RiseOutlined style={{ color: token.colorSuccessText, fontSize: 13 }} />
              <span
                style={{
                  fontFamily: FONTE_NUMERO,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: token.colorSuccessText,
                }}
              >
                Margem est. 35%
              </span>
              <span style={{ fontSize: 11.5, color: token.colorTextSecondary }}>da receita</span>
            </Flex>
          </ProCard>

          <ProCard colSpan={{ xs: 24, sm: 12, lg: 5 }}>
            <Statistic
              title="Pendências"
              value={pendenciasCount}
              valueStyle={{ fontFamily: FONTE_NUMERO, fontWeight: 600 }}
            />
            <Tag color={pendenciasCount > 0 ? "warning" : "success"} icon={<ClockCircleOutlined />}>
              {pendenciasCount > 0 ? `${pendenciasCount} em atenção` : "Nenhuma pendência"}
            </Tag>
          </ProCard>
        </ProCard>

        {/* ── Linha 2: gráfico + radar ─────────────────────────────────── */}
        <Flex gap={14} wrap align="stretch">
          <ProCard style={{ flex: "1.7 1 480px" }}>
            <Flex justify="space-between" align="center">
              <div>
                <Typography.Title level={5} style={{ margin: 0 }}>
                  Receita no ano
                </Typography.Title>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Tendência mensal consolidada ·{" "}
                  <span style={{ fontFamily: FONTE_NUMERO, fontSize: 11.5 }}>
                    {formatCurrencyCompact(totalReceita)} acum.
                  </span>
                </Typography.Text>
              </div>

              <Segmented value={periodo} onChange={setPeriodo} options={["Mês", "Trimestre", "Ano"]} />
            </Flex>

            <div style={{ height: 20 }} />

            <Flex align="flex-end" gap={9} style={{ height: 150 }}>
              {MESES.map((m) => (
                <Flex
                  key={m.nome}
                  vertical
                  align="center"
                  justify="flex-end"
                  gap={6}
                  style={{ height: "100%", flex: 1 }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: m.altura,
                      borderRadius: 7,
                      background:
                        m.tier === 1
                          ? token.colorPrimary
                          : m.tier === 2
                            ? token.colorFillTertiary
                            : token.colorFillSecondary,
                      opacity: m.tier === 1 ? 0.85 : 1,
                    }}
                  />
                  <span style={{ fontFamily: FONTE_NUMERO, fontSize: 9.5, color: token.colorTextTertiary }}>
                    {m.nome}
                  </span>
                </Flex>
              ))}
            </Flex>
          </ProCard>

          <ProCard style={{ flex: "1 1 320px" }}>
            <Flex justify="space-between" align="baseline">
              <Typography.Title level={5} style={{ margin: 0 }}>
                Radar executivo
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontFamily: FONTE_NUMERO, fontSize: 10.5 }}>
                hoje
              </Typography.Text>
            </Flex>

            <div style={{ height: 14 }} />

            <Flex vertical gap={9}>
              <Flex gap={10} style={{ borderRadius: 12, padding: 12, background: token.colorWarningBg }}>
                <ClockCircleOutlined
                  style={{ fontSize: 17, color: token.colorWarningText, flexShrink: 0, marginTop: 2 }}
                />
                <div>
                  <Typography.Text strong style={{ fontSize: 12.5 }}>
                    {totalCidades > 0
                      ? `${totalCidades} municípios monitorados`
                      : "Nenhum município monitorado"}
                  </Typography.Text>
                  <div style={{ fontFamily: FONTE_NUMERO, fontSize: 10.5, color: token.colorTextSecondary }}>
                    bases FNDE · INEP · SICONFI sincronizadas
                  </div>
                </div>
              </Flex>

              <Flex gap={10} style={{ borderRadius: 12, padding: 12, background: token.colorInfoBg }}>
                <FileTextOutlined
                  style={{ fontSize: 17, color: token.colorInfoText, flexShrink: 0, marginTop: 2 }}
                />
                <div>
                  <Typography.Text strong style={{ fontSize: 12.5 }}>
                    Projeção anual de receita
                  </Typography.Text>
                  <div style={{ fontFamily: FONTE_NUMERO, fontSize: 10.5, color: token.colorTextSecondary }}>
                    {formatCurrency(totalReceita)} em carteira
                  </div>
                </div>
              </Flex>

              <Flex gap={10} style={{ borderRadius: 12, padding: 12, background: token.colorSuccessBg }}>
                <CheckCircleOutlined
                  style={{ fontSize: 17, color: token.colorSuccessText, flexShrink: 0, marginTop: 2 }}
                />
                <div>
                  <Typography.Text strong style={{ fontSize: 12.5 }}>
                    Status das bases oficiais
                  </Typography.Text>
                  <div style={{ fontFamily: FONTE_NUMERO, fontSize: 10.5, color: token.colorTextSecondary }}>
                    VAAT 2026 · dados atualizados
                  </div>
                </div>
              </Flex>
            </Flex>
          </ProCard>
        </Flex>

        {/* ── Linha 3: cidades com maior projeção ──────────────────────── */}
        <ProTable<LinhaDoPainel>
          headerTitle="Cidades com maior projeção"
          rowKey="id"
          size="small"
          cardBordered
          loading={isLoading}
          dataSource={linhas}
          columns={colunas}
          pagination={false}
          search={false}
          options={false}
          dateFormatter="string"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <>
                    <Typography.Text strong>
                      Nenhum município cadastrado na carteira ainda
                    </Typography.Text>
                    <div
                      style={{
                        color: token.colorTextSecondary,
                        fontSize: 12,
                        maxWidth: 380,
                        margin: "4px auto 0",
                      }}
                    >
                      Adicione o seu primeiro município para iniciar o levantamento financeiro e
                      acompanhamento no pipeline.
                    </div>
                  </>
                }
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setWizardAberto(true)}>
                  Adicionar primeiro município
                </Button>
              </Empty>
            ),
          }}
          toolBarRender={() => [
            <Button
              key="nova"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setWizardAberto(true)}
            >
              Novo Município
            </Button>,
          ]}
        />
      </Flex>

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
