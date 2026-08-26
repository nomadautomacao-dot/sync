"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Card,
  Col,
  Empty,
  Flex,
  Progress,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
  theme,
} from "antd";

import { BarrasHorizontais } from "@/core/components/graficos/barras-horizontais";
import { SerieTemporal } from "@/core/components/graficos/serie-temporal";
import { apiFetch } from "@/core/lib/api-client";
import { repartirLinhaDoTempo } from "@/core/domain/cidade-eventos";
import { resumoDoCronograma } from "@/core/domain/cronograma";
import { listCityEvents } from "@/core/lib/city-events-firestore";
import { listEtapas } from "@/core/lib/city-schedule-firestore";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import type { CityAccount } from "@/core/lib/city-types";
import { useAuth } from "@/core/providers/auth-provider";
import type { CityDocument } from "@/modules/documentos/types";
import type { CityReport } from "@/modules/cidades/reports-types";

import { BlocoComercial } from "./bloco-comercial";
import { FluxoDoCronograma } from "./fluxo-do-cronograma";

const { Text, Title } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

interface RespostaPanorama {
  dossie: {
    populacao?: number;
    prefeito?: string;
    partido?: string;
    censo?: {
      ano: number;
      escolasMunicipais: number;
      escolasNoMunicipio: number;
      matriculasMunicipais: number;
      docentesMunicipais: number;
      porEtapa: {
        creche: number;
        preEscola: number;
        anosIniciais: number;
        anosFinais: number;
        eja: number;
        educacaoEspecial: number;
      };
    };
    ideb?: { anosIniciais: number | null; anosFinais: number | null; ano: number };
    semDados: string[];
  };
  historicoIdeb: {
    anosIniciais: { ano: number; ideb: number }[];
    anosFinais: { ano: number; ideb: number }[];
  } | null;
}

/**
 * O retrato da cidade, montado sozinho.
 *
 * Substituiu a "Visão geral", que era um formulário de pipeline com três
 * contadores ao lado. A diferença de fundo não é visual: **nada aqui é montado
 * à mão**. Cada bloco sai de dado que já existe — o cronograma que a equipe
 * mantém, a linha do tempo que ela alimenta, e os JSON locais de IBGE, TSE,
 * INEP e IDEB. Uma cidade cadastrada hoje já abre com painel cheio, e ele
 * melhora sozinho conforme o trabalho acontece.
 *
 * Foi por isso que descartamos o quadro de caixas arrastáveis: um canvas livre
 * começa vazio em toda cidade da carteira e precisa de alguém para desenhá-lo,
 * município por município.
 *
 * **Esta é a tela que a consultora gira na mesa.** O bloco comercial só entra
 * para quem tem Pipeline; o resto é apresentável a um secretário municipal, e é
 * assim que deve continuar.
 */
export function Panorama({
  city,
  reports,
  documents,
  verComercial,
}: {
  city: CityAccount;
  reports: CityReport[];
  documents: CityDocument[];
  verComercial: boolean;
}) {
  const { token } = theme.useToken();
  const { user } = useAuth();

  const { data: panorama, isPending: panoramaPendente } = useQuery({
    queryKey: ["city-panorama", city.codigoIbge],
    queryFn: () => apiFetch<RespostaPanorama>(`/api/municipios/${city.codigoIbge}/panorama`),
    enabled: Boolean(city.codigoIbge),
    // Dado de arquivo local não muda entre uma aba e outra.
    staleTime: 60 * 60 * 1000,
  });

  const { data: etapas = [] } = useQuery({
    queryKey: ["city-schedule", city.id],
    queryFn: () => listEtapas(getFirebaseDb(), user!.groupId, city.id),
    enabled: Boolean(user?.groupId),
  });

  const { data: eventos = [] } = useQuery({
    queryKey: ["city-events", city.id],
    queryFn: () => listCityEvents(getFirebaseDb(), user!.groupId, city.id),
    enabled: Boolean(user?.groupId),
  });

  const { agora, cronograma, linha } = useMemo(() => {
    const instante = new Date();
    return {
      agora: instante,
      cronograma: resumoDoCronograma(etapas, instante),
      linha: repartirLinhaDoTempo(eventos, instante),
    };
  }, [etapas, eventos]);

  const censo = panorama?.dossie.censo;
  const ultimoEvento = linha.historico[0];

  return (
    <Flex vertical gap={14}>
      {/* ── Identidade ─────────────────────────────────────────────── */}
      <Card>
        {panoramaPendente ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (
          <Row gutter={[24, 16]}>
            <Col xs={12} md={6}>
              <Statistic
                title="população"
                value={panorama?.dossie.populacao ?? "—"}
                formatter={(valor) =>
                  typeof valor === "number" ? valor.toLocaleString("pt-BR") : "—"
                }
                styles={{ content: { fontFamily: FONTE_MONO, fontSize: 18 } }}
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title="escolas da rede"
                value={censo ? `${censo.escolasMunicipais}/${censo.escolasNoMunicipio}` : "—"}
                styles={{ content: { fontFamily: FONTE_MONO, fontSize: 18 } }}
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title="matrículas municipais"
                value={censo?.matriculasMunicipais ?? "—"}
                formatter={(valor) =>
                  typeof valor === "number" ? valor.toLocaleString("pt-BR") : "—"
                }
                styles={{ content: { fontFamily: FONTE_MONO, fontSize: 18 } }}
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title="docentes"
                value={censo?.docentesMunicipais ?? "—"}
                formatter={(valor) =>
                  typeof valor === "number" ? valor.toLocaleString("pt-BR") : "—"
                }
                styles={{ content: { fontFamily: FONTE_MONO, fontSize: 18 } }}
              />
            </Col>
          </Row>
        )}

        <Flex gap={16} wrap="wrap" style={{ marginTop: 12 }}>
          {panorama?.dossie.prefeito && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Prefeito(a): <Text strong style={{ fontSize: 12 }}>{panorama.dossie.prefeito}</Text>
              {panorama.dossie.partido ? ` · ${panorama.dossie.partido}` : ""}
            </Text>
          )}
          {censo && (
            <Text type="secondary" style={{ fontSize: 12, fontFamily: FONTE_MONO }}>
              Censo Escolar {censo.ano}
            </Text>
          )}
        </Flex>

        {/* Dado ausente é normal e precisa ser dito: "—" sem explicação faz
            parecer que o sistema falhou. */}
        {panorama && panorama.dossie.semDados.length > 0 && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            title="Este município não aparece em todas as fontes"
            description={`Sem dado em: ${panorama.dossie.semDados.join(", ")}.`}
          />
        )}
      </Card>

      {/* ── Cronograma em fluxo ────────────────────────────────────── */}
      <Card>
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
          <Title level={5} style={{ margin: 0 }}>
            Implantação
          </Title>
          {cronograma.total > 0 && (
            <Space size={12} wrap>
              <Text style={{ fontFamily: FONTE_MONO, fontSize: 12 }}>
                {cronograma.concluidas}/{cronograma.total} etapas
              </Text>
              {cronograma.atrasadas > 0 && (
                <Tag color="error">{cronograma.atrasadas} atrasada(s)</Tag>
              )}
            </Space>
          )}
        </Flex>

        {cronograma.total === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Cronograma ainda não criado. A aba Cronograma monta a partir do modelo."
            style={{ marginTop: 8 }}
          />
        ) : (
          <>
            <Progress
              percent={cronograma.percentual}
              status={cronograma.atrasadas > 0 ? "exception" : "normal"}
              style={{ marginTop: 8, marginBottom: 16 }}
            />
            <FluxoDoCronograma etapas={etapas} agora={agora} />
          </>
        )}
      </Card>

      <Row gutter={[14, 14]}>
        {/* ── A rede municipal ─────────────────────────────────────── */}
        <Col xs={24} xl={12}>
          <Card style={{ height: "100%" }}>
            <Title level={5} style={{ marginTop: 0 }}>
              Matrículas da rede municipal
            </Title>
            {panoramaPendente ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : (
              <BarrasHorizontais
                dados={[
                  { rotulo: "Creche", valor: censo?.porEtapa.creche ?? 0 },
                  { rotulo: "Pré-escola", valor: censo?.porEtapa.preEscola ?? 0 },
                  { rotulo: "Anos iniciais", valor: censo?.porEtapa.anosIniciais ?? 0 },
                  { rotulo: "Anos finais", valor: censo?.porEtapa.anosFinais ?? 0 },
                  { rotulo: "EJA", valor: censo?.porEtapa.eja ?? 0 },
                  { rotulo: "Educação especial", valor: censo?.porEtapa.educacaoEspecial ?? 0 },
                ]}
                vazio="Este município não está no Censo Escolar carregado."
              />
            )}
          </Card>
        </Col>

        {/* ── IDEB ─────────────────────────────────────────────────── */}
        <Col xs={24} xl={12}>
          <Card style={{ height: "100%" }}>
            <Title level={5} style={{ marginTop: 0 }}>
              IDEB da rede
            </Title>
            {panoramaPendente ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : (
              <SerieTemporal
                linhas={[
                  {
                    nome: "Anos iniciais",
                    pontos: (panorama?.historicoIdeb?.anosIniciais ?? []).map((p) => ({
                      rotulo: p.ano,
                      valor: p.ideb,
                    })),
                  },
                  {
                    nome: "Anos finais",
                    pontos: (panorama?.historicoIdeb?.anosFinais ?? []).map((p) => ({
                      rotulo: p.ano,
                      valor: p.ideb,
                    })),
                    tracejada: true,
                  },
                ]}
                vazio="Sem série do IDEB para este município."
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Pulso e acervo ─────────────────────────────────────────── */}
      <Row gutter={[14, 14]}>
        <Col xs={24} xl={12}>
          <Card style={{ height: "100%" }}>
            <Title level={5} style={{ marginTop: 0 }}>
              Movimento da equipe
            </Title>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={8}>
                <Statistic
                  title="registros"
                  value={eventos.length}
                  styles={{ content: { fontFamily: FONTE_MONO, fontSize: 16 } }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="por vir"
                  value={linha.agenda.length}
                  styles={{ content: { fontFamily: FONTE_MONO, fontSize: 16 } }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="sem desfecho"
                  value={linha.pendencias.length}
                  styles={{
                    content: {
                      fontFamily: FONTE_MONO,
                      fontSize: 16,
                      color:
                        linha.pendencias.length > 0
                          ? token.colorError
                          : token.colorTextQuaternary,
                    },
                  }}
                />
              </Col>
            </Row>

            <div style={{ marginTop: 16 }}>
              {ultimoEvento ? (
                <Flex vertical gap={2}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    último acontecimento
                  </Text>
                  <Text strong style={{ fontSize: 13 }}>
                    {ultimoEvento.titulo}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11, fontFamily: FONTE_MONO }}>
                    {formatarData(ultimoEvento.quando)} · {ultimoEvento.autorNome}
                  </Text>
                </Flex>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Nada registrado ainda. A linha do tempo é onde a equipe conta o
                  que aconteceu aqui.
                </Text>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card style={{ height: "100%" }}>
            <Title level={5} style={{ marginTop: 0 }}>
              Acervo da cidade
            </Title>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <Statistic
                  title="relatórios emitidos"
                  value={reports.length}
                  styles={{ content: { fontFamily: FONTE_MONO, fontSize: 16 } }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="documentos anexados"
                  value={documents.length}
                  styles={{ content: { fontFamily: FONTE_MONO, fontSize: 16 } }}
                />
              </Col>
            </Row>
            {reports[0] && (
              <Flex vertical gap={2} style={{ marginTop: 16 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  último relatório
                </Text>
                <Text strong style={{ fontSize: 13 }}>
                  {reports[0].title}
                </Text>
                <Text type="secondary" style={{ fontSize: 11, fontFamily: FONTE_MONO }}>
                  {formatarData(reports[0].generatedAt)}
                </Text>
              </Flex>
            )}
          </Card>
        </Col>
      </Row>

      {verComercial && <BlocoComercial city={city} />}
    </Flex>
  );
}

function formatarData(iso?: string): string {
  if (!iso) return "—";
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? "—"
    : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
