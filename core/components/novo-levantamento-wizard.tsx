"use client";

/**
 * Assistente de novo levantamento FUNDEB.
 *
 * ATENÇÃO — problema conhecido e pendente, não resolvido nesta migração:
 * a barra de progresso da etapa "Gerar" é SIMULADA. `iniciarGeracao` avança
 * por `setInterval` em intervalos fixos de 850ms, sem consultar FNDE/INEP de
 * verdade. A lista de municípios sugeridos (`MUNICIPIOS_SUGESTOES`) e os
 * números da tela de conclusão (R$ 8,41M / R$ 9,24M / +R$ 828,7K) são valores
 * fixos no código, não vêm de nenhuma fonte oficial. Mesmo assim, ao fim do
 * progresso simulado o componente GRAVA a cidade de verdade no Firestore via
 * `ensureCity`, com `estimatedAnnualRevenue` chumbado em R$ 8.410.000. Esta
 * tarefa troca só a aparência (Tailwind → Ant Design com `Steps` e `Modal`) e
 * não altera nada desse comportamento.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  DownloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  LoadingOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { ProCard } from "@ant-design/pro-components";
import {
  Avatar,
  Button,
  Col,
  Descriptions,
  Flex,
  Input,
  List,
  Modal,
  Radio,
  Row,
  Segmented,
  Statistic,
  Steps,
  Switch,
  Tag,
  Typography,
  theme,
} from "antd";

import { useAuth } from "@/core/providers/auth-provider";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { ensureCity } from "@/core/lib/cities-firestore";

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
}

const MUNICIPIOS_SUGESTOES: Municipio[] = [
  { nome: "Senhor do Bonfim", uf: "BA", ibge: "2930105", matriculas: "14.203", escolas: "58", chip: "novo" },
  {
    nome: "Cristalina",
    uf: "GO",
    ibge: "5206206",
    matriculas: "11.688",
    escolas: "42",
    chip: "na carteira",
  },
  {
    nome: "Águas Lindas de Goiás",
    uf: "GO",
    ibge: "5200258",
    matriculas: "10.914",
    escolas: "39",
    chip: "na carteira",
  },
  {
    nome: "Senador José Porfírio",
    uf: "PA",
    ibge: "1507805",
    matriculas: "8.442",
    escolas: "31",
    chip: "proposta",
  },
  { nome: "Miradouro", uf: "MG", ibge: "3142304", matriculas: "4.170", escolas: "17", chip: "estudo" },
];

/** Cor nomeada do Ant para o chip de status da sugestão — sem hex solto. */
function corDoChip(chip: string): string {
  switch (chip) {
    case "na carteira":
      return "magenta";
    case "proposta":
      return "gold";
    case "estudo":
      return "green";
    default:
      return "default";
  }
}

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

const EXERCICIOS = ["2025", "2026"];
const RECORTES = ["Municipal", "Pública", "Total"];
const FONTE_NUMERO = "var(--font-sync-mono)";

export function NovoLevantamentoWizard({ onClose }: NovoLevantamentoWizardProps) {
  const router = useRouter();
  const { token } = theme.useToken();
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
            await ensureCity(db, user.groupId, {
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
    <Modal
      open
      onCancel={onClose}
      footer={null}
      width={820}
      destroyOnHidden
      title={
        <div>
          <Flex align="center" gap={12}>
            <Button
              shape="circle"
              icon={<ArrowLeftOutlined />}
              onClick={etapa > 1 ? () => setEtapa((etapa - 1) as 1 | 2) : onClose}
            />
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                Novo levantamento FUNDEB
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontFamily: FONTE_NUMERO, fontSize: 10.5 }}>
                exercício 2026 · bases oficiais FNDE · INEP · SICONFI
              </Typography.Text>
            </div>
          </Flex>

          <Steps
            size="small"
            current={etapa - 1}
            style={{ marginTop: 16 }}
            items={[{ title: "Município" }, { title: "Parâmetros" }, { title: "Gerar" }]}
          />
        </div>
      }
    >
      {/* ── ETAPA 1: ESCOLHA O MUNICÍPIO ────────────────────────────────── */}
      {etapa === 1 && (
        <div>
          <Typography.Title level={5} style={{ marginBottom: 3 }}>
            Escolha o município
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            Qualquer um dos 5.570 municípios. Os dados são consultados nas bases oficiais na hora.
          </Typography.Text>

          <Input
            size="large"
            allowClear
            prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
            placeholder="Nome do município ou código IBGE…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ borderRadius: 24, marginTop: 16, marginBottom: 16 }}
          />

          <Typography.Text
            type="secondary"
            style={{
              display: "block",
              fontFamily: FONTE_NUMERO,
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: 1.3,
              textTransform: "uppercase",
            }}
          >
            Sugestões · região da carteira
          </Typography.Text>

          <List
            style={{ marginTop: 8 }}
            split={false}
            dataSource={MUNICIPIOS_SUGESTOES.filter(
              (m) => m.nome.toLowerCase().includes(busca.toLowerCase()) || m.ibge.includes(busca)
            )}
            renderItem={(m) => {
              const indexReal = MUNICIPIOS_SUGESTOES.indexOf(m);
              const selecionado = munSel === indexReal;

              return (
                <List.Item
                  onClick={() => setMunSel(indexReal)}
                  style={{
                    cursor: "pointer",
                    borderRadius: 12,
                    padding: "11px 14px",
                    marginBottom: 4,
                    background: selecionado ? token.colorFillTertiary : "transparent",
                    border: `1px solid ${selecionado ? token.colorBorderSecondary : "transparent"}`,
                  }}
                >
                  <Flex align="center" gap={12} style={{ width: "100%" }}>
                    <Avatar
                      shape="square"
                      size={30}
                      style={{
                        background: selecionado ? token.colorPrimary : token.colorFillTertiary,
                        color: selecionado ? token.colorWhite : token.colorTextSecondary,
                        fontFamily: FONTE_NUMERO,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {m.uf}
                    </Avatar>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Typography.Text strong style={{ fontSize: 13.5 }}>
                        {m.nome}
                      </Typography.Text>
                      <div style={{ fontFamily: FONTE_NUMERO, fontSize: 10, color: token.colorTextSecondary }}>
                        IBGE {m.ibge} · {m.matriculas} matrículas · {m.escolas} escolas
                      </div>
                    </div>

                    <Tag color={corDoChip(m.chip)}>{m.chip}</Tag>

                    {selecionado && <CheckCircleFilled style={{ color: token.colorPrimary, fontSize: 18 }} />}
                  </Flex>
                </List.Item>
              );
            }}
          />

          <Flex justify="flex-end" style={{ marginTop: 18 }}>
            <Button type="primary" size="large" onClick={() => setEtapa(2)} iconPosition="end" icon={<ArrowRightOutlined />}>
              Continuar
            </Button>
          </Flex>
        </div>
      )}

      {/* ── ETAPA 2: PARÂMETROS ────────────────────────────────────────── */}
      {etapa === 2 && (
        <div>
          <Typography.Title level={5} style={{ marginBottom: 3 }}>
            Parâmetros da projeção
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            {mun.nome} · {mun.uf} · os padrões abaixo seguem a metodologia da consultoria.
          </Typography.Text>

          <Row gutter={22} style={{ marginTop: 20 }}>
            <Col span={12}>
              <Typography.Text
                type="secondary"
                style={{ display: "block", fontFamily: FONTE_NUMERO, fontSize: 9.5, fontWeight: 600, letterSpacing: 1.3 }}
              >
                EXERCÍCIO
              </Typography.Text>
              <Segmented
                style={{ marginTop: 8 }}
                value={EXERCICIOS[exercicioSel]}
                onChange={(v) => setExercicioSel(EXERCICIOS.indexOf(v as string))}
                options={EXERCICIOS}
              />

              <Typography.Text
                type="secondary"
                style={{
                  display: "block",
                  marginTop: 20,
                  fontFamily: FONTE_NUMERO,
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: 1.3,
                }}
              >
                RECORTE DO CENSO
              </Typography.Text>
              <Segmented
                style={{ marginTop: 8 }}
                value={RECORTES[recorteSel]}
                onChange={(v) => setRecorteSel(RECORTES.indexOf(v as string))}
                options={RECORTES}
              />

              <Typography.Text
                type="secondary"
                style={{
                  display: "block",
                  marginTop: 20,
                  fontFamily: FONTE_NUMERO,
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: 1.3,
                }}
              >
                METODOLOGIA
              </Typography.Text>
              <Radio.Group
                style={{ marginTop: 8, width: "100%" }}
                value={metodoSel}
                onChange={(e) => setMetodoSel(e.target.value)}
              >
                <Flex vertical gap={6}>
                  {METODOLOGIAS.map((mt, i) => (
                    <Radio
                      key={mt.nome}
                      value={i}
                      style={{
                        width: "100%",
                        margin: 0,
                        padding: "12px 14px",
                        borderRadius: 12,
                        alignItems: "flex-start",
                        border: `1px solid ${metodoSel === i ? token.colorBorderSecondary : token.colorBorder}`,
                        background: metodoSel === i ? token.colorFillTertiary : "transparent",
                      }}
                    >
                      <Typography.Text strong style={{ fontSize: 13 }}>
                        {mt.nome}
                      </Typography.Text>
                      <div style={{ fontSize: 11.5, color: token.colorTextSecondary, marginTop: 2 }}>{mt.desc}</div>
                    </Radio>
                  ))}
                </Flex>
              </Radio.Group>
            </Col>

            <Col span={12}>
              <Typography.Text
                type="secondary"
                style={{ display: "block", fontFamily: FONTE_NUMERO, fontSize: 9.5, fontWeight: 600, letterSpacing: 1.3 }}
              >
                SEÇÕES DO RELATÓRIO
              </Typography.Text>

              <List
                style={{ marginTop: 8 }}
                split
                dataSource={SECOES}
                renderItem={(sec, i) => (
                  <List.Item
                    style={{ padding: "12px 4px" }}
                    actions={[<Switch key="switch" checked={secoesOn[i]} onChange={() => toggleSecao(i)} />]}
                  >
                    <Flex align="center" gap={11}>
                      <FileExcelOutlined style={{ fontSize: 17, color: token.colorTextSecondary }} />
                      <div>
                        <Typography.Text strong style={{ fontSize: 13 }}>
                          {sec.nome}
                        </Typography.Text>
                        <div style={{ fontFamily: FONTE_NUMERO, fontSize: 9.5, color: token.colorTextTertiary }}>
                          {sec.fonte}
                        </div>
                      </div>
                    </Flex>
                  </List.Item>
                )}
              />
            </Col>
          </Row>

          <Flex justify="space-between" style={{ marginTop: 20 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => setEtapa(1)}>
              Voltar
            </Button>
            <Button type="primary" onClick={() => setEtapa(3)} iconPosition="end" icon={<ArrowRightOutlined />}>
              Revisar e gerar
            </Button>
          </Flex>
        </div>
      )}

      {/* ── ETAPA 3: REVISÃO & GERAR ───────────────────────────────────── */}
      {etapa === 3 && (
        <div>
          {progresso < 4 ? (
            <>
              <Typography.Title level={5} style={{ marginBottom: 14 }}>
                Revisão
              </Typography.Title>

              <Descriptions
                column={1}
                size="small"
                items={[
                  { key: "municipio", label: "Município", children: `${mun.nome} · ${mun.uf} · IBGE ${mun.ibge}` },
                  { key: "exercicio", label: "Exercício", children: EXERCICIOS[exercicioSel] },
                  { key: "recorte", label: "Recorte do censo", children: RECORTES[recorteSel] },
                  { key: "metodologia", label: "Metodologia", children: METODOLOGIAS[metodoSel].nome },
                  { key: "secoes", label: "Seções", children: `${secoesOn.filter(Boolean).length} de 4 incluídas` },
                ]}
              />

              <div style={{ height: 18 }} />

              {progresso < 0 ? (
                <Flex justify="space-between">
                  <Button icon={<ArrowLeftOutlined />} onClick={() => setEtapa(2)}>
                    Voltar
                  </Button>
                  <Button type="primary" size="large" icon={<ThunderboltOutlined />} onClick={iniciarGeracao}>
                    Gerar levantamento
                  </Button>
                </Flex>
              ) : (
                <Steps
                  direction="vertical"
                  size="small"
                  current={progresso}
                  items={PASSOS_GERACAO.map((nome, i) => ({
                    title: nome,
                    icon: i === progresso ? <LoadingOutlined /> : undefined,
                  }))}
                />
              )}
            </>
          ) : (
            /* CONCLUÍDO */
            <div>
              <Flex vertical align="center" style={{ textAlign: "center", padding: "10px 0 6px" }}>
                <Avatar size={52} style={{ background: token.colorSuccessBg }}>
                  <CheckCircleFilled style={{ color: token.colorSuccessText, fontSize: 26 }} />
                </Avatar>
                <Typography.Title level={4} style={{ marginTop: 12, marginBottom: 0 }}>
                  Levantamento pronto
                </Typography.Title>
                <Typography.Text type="secondary" style={{ fontFamily: FONTE_NUMERO, fontSize: 10.5 }}>
                  {mun.nome} · lote 2026-07 · v1 · 4 min 12 s
                </Typography.Text>
              </Flex>

              <Row gutter={12} style={{ marginTop: 18 }}>
                <Col span={8}>
                  <ProCard size="small">
                    <Statistic
                      title="TOTAL ATUAL"
                      value="R$ 8,41M"
                      valueStyle={{ fontFamily: FONTE_NUMERO, fontSize: 22, fontWeight: 600 }}
                    />
                  </ProCard>
                </Col>
                <Col span={8}>
                  <ProCard
                    size="small"
                    style={{ background: `linear-gradient(135deg, ${token.colorFillTertiary}, ${token.colorInfoBg})` }}
                  >
                    <Statistic
                      title="TOTAL PROJETADO"
                      value="R$ 9,24M"
                      valueStyle={{ fontFamily: FONTE_NUMERO, fontSize: 22, fontWeight: 600 }}
                    />
                  </ProCard>
                </Col>
                <Col span={8}>
                  <ProCard size="small" style={{ background: token.colorSuccessBg }}>
                    <Statistic
                      title="GANHO RECUPERÁVEL"
                      value="+R$ 828,7K"
                      valueStyle={{ fontFamily: FONTE_NUMERO, fontSize: 22, fontWeight: 600, color: token.colorSuccessText }}
                    />
                  </ProCard>
                </Col>
              </Row>

              <Flex justify="center" gap={10} style={{ marginTop: 18 }}>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => {
                    onClose();
                    router.push(`/modulos/levantamento-fundeb?ibge=${mun.ibge}`);
                  }}
                >
                  Abrir e gerar PDF
                </Button>

                <Button icon={<FileTextOutlined />} onClick={onClose}>
                  Criar proposta
                </Button>

                <Button
                  type="text"
                  onClick={() => {
                    setEtapa(1);
                    setProgresso(-1);
                  }}
                >
                  Novo levantamento
                </Button>
              </Flex>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
