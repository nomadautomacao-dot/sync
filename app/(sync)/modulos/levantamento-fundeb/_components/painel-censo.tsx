"use client";

import { BarChartOutlined, ReadOutlined } from "@ant-design/icons";
import { Alert, Card, Col, Flex, Row, Statistic, Tag, Typography, theme } from "antd";

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
  const { token } = theme.useToken();

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
    <Row gutter={[14, 14]}>
      <Col xs={24} lg={12}>
        <Card
          size="small"
          title={
            <Flex align="center" gap={9}>
              <ReadOutlined style={{ color: token.colorTextTertiary }} />
              <span>Censo Escolar INEP</span>
            </Flex>
          }
        >
          <Row gutter={[18, 16]}>
            {indicadores.map((indicador) => (
              <Col span={12} key={indicador.rotulo}>
                <Statistic
                  title={<span style={{ fontSize: 11.5 }}>{indicador.rotulo}</span>}
                  value={indicador.valor}
                  styles={{ content: {
                    fontFamily: "var(--font-sync-mono)",
                    fontWeight: 600,
                    lineHeight: 1,
                    fontSize: indicador.destaque ? 24 : 15,
                    color: token.colorText,
                  } }}
                />
              </Col>
            ))}
          </Row>
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card
          size="small"
          title={
            <Flex align="center" gap={9}>
              <BarChartOutlined style={{ color: token.colorTextTertiary }} />
              <span>Metodologia</span>
            </Flex>
          }
          extra={
            perfil?.faixa ? (
              <Tag style={{ fontFamily: "var(--font-sync-mono)", fontSize: 10.5, fontWeight: 600 }}>
                {perfil.faixa}
                {typeof perfil.score === "number" && ` · ${perfil.score.toFixed(2)}`}
              </Tag>
            ) : null
          }
        >
          <Typography.Paragraph style={{ fontSize: 12.5, color: token.colorTextSecondary }}>
            {projecao?.metodologia ||
              "Diagnóstico automatizado pelo cruzamento de dados oficiais do FNDE com o Censo Escolar INEP."}
          </Typography.Paragraph>

          {typeof projecao?.multiplicadorAplicado === "number" && (
            <Typography.Text
              type="secondary"
              style={{ display: "block", marginTop: -8, marginBottom: 14, fontFamily: "var(--font-sync-mono)", fontSize: 11.5 }}
            >
              Multiplicador aplicado: {projecao.multiplicadorAplicado.toFixed(2)}×
            </Typography.Text>
          )}

          <Alert
            type="info"
            message="A estimativa é uma leitura possível do próximo ciclo a partir da receita atual e dos pontos de conferência do FUNDEB. Não substitui a validação nas bases oficiais."
          />

          {projecao?.ressalva && (
            <Alert type="warning" showIcon style={{ marginTop: 10 }} message={projecao.ressalva} />
          )}
        </Card>
      </Col>
    </Row>
  );
}
