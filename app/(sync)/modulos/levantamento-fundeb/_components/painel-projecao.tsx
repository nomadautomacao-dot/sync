"use client";

import { Card, Col, Flex, Row, Table, Tag, Typography, theme } from "antd";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";

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

const FONTE_MONO = "var(--font-sync-mono)";

export function PainelProjecao({ projecao, recuperavel }: PainelProjecaoProps) {
  const { token } = theme.useToken();

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

  const colunas: ProColumns<LinhaComponente>[] = [
    {
      title: "Componente",
      dataIndex: "sigla",
      render: (_, linha) => (
        <span>
          <Typography.Text strong style={{ fontSize: 12.5 }}>
            {linha.sigla}
          </Typography.Text>{" "}
          <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
            {linha.rotulo}
          </Typography.Text>
        </span>
      ),
    },
    {
      title: "Atual",
      dataIndex: "atual",
      align: "right",
      render: (_, linha) => (
        <span style={{ fontFamily: FONTE_MONO, fontSize: 12.5, color: token.colorTextSecondary }}>
          {formatCurrency(linha.atual ?? 0)}
        </span>
      ),
    },
    {
      title: "Projetado",
      dataIndex: "projetado",
      align: "right",
      render: (_, linha) => (
        <span style={{ fontFamily: FONTE_MONO, fontSize: 12.5, fontWeight: 600 }}>
          {formatCurrency(linha.projetado ?? 0)}
        </span>
      ),
    },
    {
      title: "Variação",
      dataIndex: "ganho",
      align: "right",
      render: (_, linha) => (
        <span style={{ fontFamily: FONTE_MONO, fontSize: 12.5, fontWeight: 600, color: token.colorSuccess }}>
          {(linha.ganho ?? 0) > 0 ? "+" : ""}
          {formatCurrency(linha.ganho ?? 0)}
        </span>
      ),
    },
  ];

  return (
    <Flex vertical gap={14}>
      {/* Manchete: o número que a consultoria vende. Tudo em volta desce de peso
          para que ele seja o primeiro a ser lido. */}
      <Row gutter={[14, 14]}>
        <Col xs={24} lg={14}>
          <Card size="small" style={{ height: "100%" }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Potencial de incremento anual
            </Typography.Text>

            <div
              style={{
                marginTop: 10,
                fontFamily: FONTE_MONO,
                fontSize: 34,
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: -1.8,
                color: token.colorText,
              }}
            >
              {ganhoTotal > 0 ? "+" : ""}
              {formatCurrency(ganhoTotal)}
            </div>

            <Flex align="center" gap={8} wrap="wrap" style={{ marginTop: 14 }}>
              <Tag color="success" style={{ fontWeight: 600 }}>
                {ganhoPercentual > 0 ? "+" : ""}
                {ganhoPercentual.toFixed(1)}% sobre o cenário atual
              </Tag>
              <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                cenário otimizado
              </Typography.Text>
            </Flex>

            <Flex
              gap={28}
              wrap="wrap"
              style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${token.colorBorderSecondary}` }}
            >
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  Receita atual
                </Typography.Text>
                <div style={{ marginTop: 2, fontFamily: FONTE_MONO, fontSize: 13, color: token.colorTextSecondary }}>
                  {formatCurrency(projecao?.totalAtual ?? 0)}
                </div>
              </div>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  Receita projetada
                </Typography.Text>
                <div style={{ marginTop: 2, fontFamily: FONTE_MONO, fontSize: 13, fontWeight: 600 }}>
                  {formatCurrency(projecao?.totalProjetado ?? 0)}
                </div>
              </div>
            </Flex>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card size="small" style={{ height: "100%" }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Camada recuperável
            </Typography.Text>

            <div
              style={{
                marginTop: 10,
                fontFamily: FONTE_MONO,
                fontSize: 24,
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: -1.2,
                color: token.colorText,
              }}
            >
              +{formatCurrency(recuperavel?.totalGanho ?? 0)}
            </div>

            <Typography.Text type="secondary" style={{ display: "block", marginTop: 12, fontFamily: FONTE_MONO, fontSize: 11.5 }}>
              +{(recuperavel?.ganhoPercentual ?? 0).toFixed(1)}%
            </Typography.Text>

            <Typography.Paragraph
              type="secondary"
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: `1px solid ${token.colorBorderSecondary}`,
                fontSize: 11.5,
                marginBottom: 0,
              }}
            >
              Já evidenciada nas bases oficiais atuais, sem depender do cenário otimizado.
            </Typography.Paragraph>
          </Card>
        </Col>
      </Row>

      {/* Componente × atual × projetado × variação — espelha a página "Projeção"
          do relatório impresso. A linha de total usa o `summary` da tabela, que
          é o mesmo mecanismo do relatório em papel: rodapé fixo, sem entrar na
          ordenação. */}
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <ProTable<LinhaComponente>
          columns={colunas}
          dataSource={linhas}
          rowKey="sigla"
          size="small"
          pagination={false}
          search={false}
          options={false}
          summary={() => (
            <Table.Summary.Row style={{ background: token.colorFillAlter }}>
              <Table.Summary.Cell index={0}>
                <Typography.Text strong style={{ fontSize: 12.5 }}>
                  Receita total
                </Typography.Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <span style={{ fontFamily: FONTE_MONO, fontSize: 12.5, fontWeight: 600, color: token.colorTextSecondary }}>
                  {formatCurrency(projecao?.totalAtual ?? 0)}
                </span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                <span style={{ fontFamily: FONTE_MONO, fontSize: 12.5, fontWeight: 600 }}>
                  {formatCurrency(projecao?.totalProjetado ?? 0)}
                </span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <span style={{ fontFamily: FONTE_MONO, fontSize: 12.5, fontWeight: 600, color: token.colorSuccess }}>
                  {ganhoTotal > 0 ? "+" : ""}
                  {formatCurrency(ganhoTotal)}
                </span>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>
    </Flex>
  );
}
