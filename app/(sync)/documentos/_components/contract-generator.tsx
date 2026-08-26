"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AuditOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  RightOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Badge,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  theme,
} from "antd";

import {
  VIAS_DE_CONTRATACAO,
  avisoDeLimite,
  fundamentoPadrao,
  viaPorKey,
  type ViaDeContratacao,
} from "@/core/domain/contratacao-direta";
import {
  caminhoNoKit,
  resumoDaHabilitacao,
} from "@/core/domain/habilitacao";
import { lerResumoDoKit, type ResumoDoKit } from "@/core/domain/kit-resumo";
import type { CityAccount } from "@/core/lib/city-types";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import type {
  ContratoFundebCampoMeta,
  ContratosFundebData,
} from "@/modules/contrato-fundeb/types";
import { listDocumentosDaHabilitacao } from "@/modules/documentos/habilitacao-firestore";
import type { ContractAgentStats } from "@/modules/documentos/types";

interface AgentResponse {
  success: boolean;
  contrato: ContratosFundebData;
  metas: ContratoFundebCampoMeta[];
  stats: ContractAgentStats;
  warnings: string[];
  error?: string;
}

interface ContractGeneratorProps {
  cities: CityAccount[];
  onArchive: (
    file: File,
    city: CityAccount,
    title: string,
    contractNumber?: string,
  ) => Promise<void>;
}

const REVIEW_FIELDS: {
  key: keyof ContratosFundebData;
  label: string;
  placeholder?: string;
}[] = [
  { key: "municipioCNPJ", label: "CNPJ da Prefeitura" },
  { key: "municipioEndereco", label: "Endereço da Prefeitura" },
  { key: "fundoCNPJ", label: "CNPJ do Fundo de Educação" },
  { key: "prefeitoNome", label: "Prefeito(a)" },
  { key: "prefeitoCPF", label: "CPF do(a) prefeito(a)" },
  { key: "secretarioNome", label: "Secretário(a) de Educação" },
  { key: "fiscalNome", label: "Fiscal do contrato" },
  { key: "contratoNumero", label: "Número do contrato", placeholder: "001/2026" },
  { key: "processoNumero", label: "Processo administrativo" },
  { key: "foroComarca", label: "Comarca do foro" },
];

export function ContractGenerator({
  cities,
  onArchive,
}: ContractGeneratorProps) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { user } = useAuth();
  const [cityId, setCityId] = useState("");
  const [monthlyValue, setMonthlyValue] = useState("27500");
  const [months, setMonths] = useState("12");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pendencias, setPendencias] = useState<ResumoDoKit | null>(null);
  const [archive, setArchive] = useState(true);
  /* A via da contratação direta. O padrão é dispensa — decisão do dono
     (2026-08-14): a inexigibilidade exige inviabilidade de competição, e o
     caso comum aqui é o que a lei dispensa. Trocar aqui muda a nomenclatura
     de todas as peças e o fundamento do parecer. */
  const [via, setVia] = useState<ViaDeContratacao>("dispensa");
  const [fundamentoId, setFundamentoId] = useState<string>(
    fundamentoPadrao("dispensa").id,
  );
  const [result, setResult] = useState<AgentResponse | null>(null);

  const selectedCity = useMemo(
    () => cities.find((city) => city.id === cityId),
    [cities, cityId],
  );

  /* A habilitação da empresa (Documentos › Habilitação) entra no ZIP junto
     com as 14 peças. Mesma chave de query da aba, então anexar lá reflete
     aqui sem recarregar. */
  const { data: documentosDaHabilitacao = [] } = useQuery({
    queryKey: ["empresa-documentos", user?.groupId],
    queryFn: () => listDocumentosDaHabilitacao(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
    staleTime: 5 * 60 * 1000,
  });

  const resumoHabilitacao = useMemo(
    () => resumoDaHabilitacao(documentosDaHabilitacao, new Date()),
    [documentosDaHabilitacao],
  );

  /* Dispensa por valor tem teto legal, e o valor global é o que conta — não o
     mensal. Um contrato anual de seis dígitos entrando como dispensa por valor
     é o erro que este aviso existe para pegar antes do protocolo. */
  const avisoDoLimite = useMemo(
    () =>
      avisoDeLimite(
        fundamentoId,
        Math.round(Number(monthlyValue || 0) * Number(months || 0) * 100),
      ),
    [fundamentoId, monthlyValue, months],
  );

  const analyze = async () => {
    if (!selectedCity) {
      message.error("Selecione um município.");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const response = await fetch("/api/contratos-fundeb/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          municipioNome: selectedCity.name,
          uf: selectedCity.uf,
          codigoIBGE: selectedCity.codigoIbge || undefined,
          exercicio: Number(year),
          valorMensal: Number(monthlyValue),
          quantidadeMeses: Number(months),
        }),
      });
      const data = (await response.json()) as AgentResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.warnings?.[0] || "Falha na análise.");
      }
      setResult(data);
      message.success("Minuta preparada para revisão.");
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar o contrato.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const updateContractField = (
    key: keyof ContratosFundebData,
    value: string,
  ) => {
    setResult((current) =>
      current
        ? {
            ...current,
            contrato: { ...current.contrato, [key]: value },
          }
        : current,
    );
  };

  const generate = async () => {
    if (!result || !selectedCity) return;
    setGenerating(true);
    try {
      /* A habilitação viaja com o pedido: quem enxerga o Firestore é o
         browser (a rota atende também o smoke test, sem sessão), e é o
         acervo — não a pasta local de quem montou o kit — que manda hoje. */
      const habilitacao = documentosDaHabilitacao.map((documento) => ({
        caminho: caminhoNoKit(documento),
        url: documento.downloadUrl,
      }));

      const response = await fetch("/api/contratos-fundeb/generate-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contrato: { ...result.contrato, via, fundamentoId },
          habilitacao,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Falha ao gerar o kit documental.");
      }

      const resumo = lerResumoDoKit(response.headers.get("X-Kit-Resumo"));
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const responseName = disposition.match(/filename="([^"]+)"/)?.[1];
      const fileName =
        responseName ||
        `Kit_Contrato_${selectedCity.name.replace(/\s+/g, "_")}_${year}.zip`;
      const file = new File([blob], fileName, {
        type: response.headers.get("Content-Type") || "application/zip",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      if (archive) {
        await onArchive(
          file,
          selectedCity,
          `Kit contratual FUNDEB ${year}`,
          String(result.contrato.contratoNumero ?? ""),
        );
      }

      message.success(
        archive
          ? "Kit gerado, baixado e salvo no acervo."
          : "Kit gerado e baixado.",
      );

      /* O kit sai mesmo com lacuna, e é aqui que a pessoa fica sabendo disso.
         Sem este aviso, "Kit gerado" e "kit pronto para protocolar" viram a
         mesma frase — e a diferença só apareceria no balcão da prefeitura. A
         lista completa vai no PENDENCIAS.txt dentro do ZIP, porque a tela
         fecha e o arquivo fica. */
      if (resumo.pendencias.length || resumo.avisos.length) {
        setPendencias(resumo);
      } else {
        setPendencias(null);
      }
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "Não foi possível gerar o kit.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const camposLocalizados =
    result ? result.stats.preenchidoAutomatico + result.stats.preenchidoIA : 0;

  return (
    <Row gutter={16}>
      <Col xs={24} xl={9}>
        <Card style={{ height: "100%" }}>
          <Flex align="flex-start" gap={12}>
            <Flex
              align="center"
              justify="center"
              style={{
                width: 40,
                height: 40,
                borderRadius: token.borderRadiusLG,
                background: token.colorInfoBg,
                flexShrink: 0,
              }}
            >
              <ThunderboltOutlined style={{ fontSize: 18, color: token.colorInfoText }} />
            </Flex>
            <div>
              <Typography.Title level={5} style={{ margin: 0 }}>
                Novo contrato inteligente
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0, fontSize: 12 }}>
                Escolha o município. O sistema consulta as bases disponíveis,
                preenche o modelo e separa o que precisa de revisão humana.
              </Typography.Paragraph>
            </div>
          </Flex>

          <Form layout="vertical" style={{ marginTop: 20 }}>
            <Form.Item label="Modelo documental">
              <Card size="small" style={{ background: token.colorInfoBg, borderColor: token.colorInfoBorder }}>
                <Flex align="center" gap={10}>
                  <FileDoneOutlined style={{ fontSize: 18, color: token.colorInfoText }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Typography.Text strong style={{ fontSize: 12 }}>
                      Inexigibilidade · Consultoria FUNDEB
                    </Typography.Text>
                    <div
                      style={{
                        fontFamily: "var(--font-sync-mono)",
                        fontSize: 10,
                        color: token.colorTextSecondary,
                      }}
                    >
                      14 documentos DOCX · modelo ativo
                    </div>
                  </div>
                  <CheckCircleOutlined style={{ color: token.colorSuccessText }} />
                </Flex>
              </Card>
            </Form.Item>

            <Form.Item label="Município">
              <Select
                value={cityId || undefined}
                placeholder="Selecione o município"
                showSearch
                optionFilterProp="label"
                onChange={(value) => {
                  setCityId(value);
                  setResult(null);
                }}
                options={cities.map((city) => ({
                  value: city.id,
                  label: `${city.name} · ${city.uf}`,
                }))}
              />
            </Form.Item>

            <Flex gap={10}>
              <Form.Item label="Exercício" style={{ flex: 1 }}>
                <InputNumber
                  min={2024}
                  max={2100}
                  value={year ? Number(year) : undefined}
                  onChange={(value) => setYear(value == null ? "" : String(value))}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item label="Valor mensal" style={{ flex: 1 }}>
                <InputNumber
                  min={0}
                  step={100}
                  value={monthlyValue ? Number(monthlyValue) : undefined}
                  onChange={(value) => setMonthlyValue(value == null ? "" : String(value))}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item label="Meses" style={{ flex: 1 }}>
                <InputNumber
                  min={1}
                  max={60}
                  value={months ? Number(months) : undefined}
                  onChange={(value) => setMonths(value == null ? "" : String(value))}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Flex>

            <Form.Item label="Via da contratação direta">
              <Segmented
                block
                value={via}
                onChange={(valor) => {
                  const escolhida = valor as ViaDeContratacao;
                  setVia(escolhida);
                  // O fundamento pertence à via: mantê-lo ao trocar produziria
                  // uma dispensa fundamentada no artigo da inexigibilidade.
                  setFundamentoId(fundamentoPadrao(escolhida).id);
                  setResult(null);
                }}
                options={VIAS_DE_CONTRATACAO.map((v) => ({
                  value: v.key,
                  label: v.nomeCurto,
                }))}
              />
              <Typography.Text
                type="secondary"
                style={{ fontSize: 11, display: "block", marginTop: 6 }}
              >
                {viaPorKey(via).descricao}
              </Typography.Text>
            </Form.Item>

            <Form.Item label="Fundamento legal">
              <Select
                value={fundamentoId}
                onChange={(valor) => {
                  setFundamentoId(valor);
                  setResult(null);
                }}
                options={viaPorKey(via).fundamentos.map((f) => ({
                  value: f.id,
                  label: f.rotulo,
                }))}
              />
            </Form.Item>

            {avisoDoLimite && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title="O valor não cabe nesta hipótese"
                description={avisoDoLimite}
              />
            )}

            <Card size="small" style={{ background: token.colorFillQuaternary }}>
              <Flex align="center" gap={8}>
                <AuditOutlined style={{ color: token.colorTextSecondary }} />
                <Typography.Text strong style={{ fontSize: 11 }}>
                  {viaPorKey(via).artigo}
                </Typography.Text>
              </Flex>
              <Typography.Paragraph
                type="secondary"
                style={{ marginTop: 8, marginBottom: 0, fontSize: 11 }}
              >
                Estrutura de DFD, ETP, Termo de Referência, pareceres,
                ratificação, homologação e minuta — todas as peças saem com a
                nomenclatura e o fundamento da via escolhida.
              </Typography.Paragraph>
            </Card>
          </Form>

          <Button
            type="primary"
            block
            size="large"
            style={{ marginTop: 20 }}
            icon={analyzing ? undefined : <RobotOutlined />}
            loading={analyzing}
            disabled={!cityId}
            onClick={analyze}
          >
            {analyzing ? "Consultando bases e preparando…" : "Preparar minuta para revisão"}
            {!analyzing && <RightOutlined style={{ marginLeft: 8 }} />}
          </Button>
        </Card>
      </Col>

      <Col xs={24} xl={15}>
        <Card style={{ height: "100%" }} styles={{ body: { padding: result ? 0 : 24 } }}>
          {!result ? (
            <Flex vertical align="center" justify="center" style={{ minHeight: 480, textAlign: "center" }}>
              <Empty
                image={<FileTextOutlined style={{ fontSize: 64, color: token.colorTextTertiary }} />}
                description={
                  <>
                    <Typography.Title level={5} style={{ marginBottom: 8 }}>
                      A revisão aparecerá aqui
                    </Typography.Title>
                    <Typography.Paragraph type="secondary" style={{ maxWidth: 380, fontSize: 12 }}>
                      Antes de gerar o arquivo, você verá os dados encontrados, as
                      fontes utilizadas e os campos que ainda precisam ser confirmados.
                    </Typography.Paragraph>
                  </>
                }
              />
              <Space wrap style={{ marginTop: 8 }}>
                <Tag color="blue">IBGE</Tag>
                <Tag color="green">TSE</Tag>
                <Tag color="gold">CNPJ</Tag>
                <Tag color="purple">Dados públicos</Tag>
              </Space>
            </Flex>
          ) : (
            <Flex vertical style={{ maxHeight: "calc(100vh - 190px)", minHeight: 560 }}>
              <Flex
                align="flex-start"
                justify="space-between"
                style={{ borderBottom: `1px solid ${token.colorBorderSecondary}`, padding: "16px 20px" }}
              >
                <div>
                  <Flex align="center" gap={8}>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                      Revisão da minuta
                    </Typography.Title>
                    <Tag color="success">
                      {result.stats.percentualPreenchido}% preenchido
                    </Tag>
                  </Flex>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {selectedCity?.name} · {selectedCity?.uf} · exercício {year}
                  </Typography.Text>
                </div>
                <Statistic
                  value={camposLocalizados}
                  suffix={<span style={{ fontSize: 11, color: token.colorTextTertiary }}>/{result.stats.total}</span>}
                  styles={{ content: { fontFamily: "var(--font-sync-mono)", fontSize: 18, textAlign: "right" } }}
                />
              </Flex>

              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                {result.warnings.length > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<WarningOutlined />}
                    title="Confira os campos não localizados"
                    description={
                      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                        {result.warnings.slice(0, 3).map((warning) => (
                          <li key={warning} style={{ fontSize: 11 }}>
                            {warning}
                          </li>
                        ))}
                      </ul>
                    }
                    style={{ marginBottom: 16 }}
                  />
                )}

                <Row gutter={[12, 12]}>
                  {REVIEW_FIELDS.map((field) => {
                    const value = String(result.contrato[field.key] ?? "");
                    const meta = result.metas.find(
                      (item) => item.campo === field.key,
                    );
                    return (
                      <Col key={field.key} xs={24} sm={12}>
                        <Typography.Text style={{ fontSize: 10, fontWeight: 700, color: token.colorTextSecondary }}>
                          {field.label}
                        </Typography.Text>
                        <Input
                          value={value}
                          onChange={(event) =>
                            updateContractField(field.key, event.target.value)
                          }
                          placeholder={field.placeholder || "Não localizado"}
                          status={value ? undefined : "warning"}
                          style={{ marginTop: 4 }}
                        />
                        <Badge
                          status={value ? "success" : "error"}
                          text={value ? meta?.fonte || "revisado manualmente" : "revisão necessária"}
                          style={{ marginTop: 4, fontSize: 10 }}
                        />
                      </Col>
                    );
                  })}
                </Row>
              </div>

              <div
                style={{
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                  background: token.colorFillQuaternary,
                  padding: "16px 20px",
                }}
              >
                {/* O que vai de habilitação junto das 14 peças. Sem este
                    aviso, um kit sairia sem certidão nenhuma — ou com uma
                    vencida — e só o setor de licitação da prefeitura veria. */}
                <Alert
                  type={
                    resumoHabilitacao.vencidos > 0
                      ? "error"
                      : resumoHabilitacao.pronta
                        ? "success"
                        : "warning"
                  }
                  showIcon
                  style={{ marginBottom: 12 }}
                  title={
                    resumoHabilitacao.total === 0
                      ? "Nenhum documento de habilitação anexado"
                      : `${resumoHabilitacao.total} documento(s) de habilitação entram neste kit`
                  }
                  description={
                    resumoHabilitacao.vencidos > 0
                      ? `${resumoHabilitacao.vencidos} está(ão) vencido(s). Substitua na aba Habilitação antes de gerar.`
                      : resumoHabilitacao.categoriasFaltando.length > 0
                        ? `Falta anexar: ${resumoHabilitacao.categoriasFaltando
                            .map((categoria) => categoria.nome)
                            .join(", ")}.`
                        : "Habilitação completa e dentro da validade."
                  }
                />
                {pendencias && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<WarningOutlined />}
                    closable
                    onClose={() => setPendencias(null)}
                    style={{ marginBottom: 12 }}
                    title={
                      pendencias.pendencias.length
                        ? `Kit gerado com ${pendencias.pendencias.length} campo(s) a preencher à mão`
                        : "Kit gerado com ressalvas"
                    }
                    description={
                      <>
                        {pendencias.pendencias.length > 0 && (
                          <div style={{ fontSize: 11 }}>
                            Procure por <b>A INFORMAR</b> nas peças:{" "}
                            {pendencias.pendencias.slice(0, 6).join(", ")}
                            {pendencias.pendencias.length > 6 &&
                              ` e mais ${pendencias.pendencias.length - 6}`}
                            .
                          </div>
                        )}
                        {pendencias.avisos.map((aviso) => (
                          <div key={aviso} style={{ fontSize: 11, marginTop: 4 }}>
                            {aviso}
                          </div>
                        ))}
                        <div style={{ fontSize: 11, marginTop: 4 }}>
                          A lista completa está em <b>PENDENCIAS.txt</b>, dentro
                          do ZIP.
                        </div>
                      </>
                    }
                  />
                )}
                <Checkbox
                  checked={archive}
                  onChange={(event) => setArchive(event.target.checked)}
                  style={{ marginBottom: 12, fontSize: 11 }}
                >
                  Salvar uma cópia do ZIP no acervo de {selectedCity?.name}
                </Checkbox>
                <Button
                  type="primary"
                  block
                  size="large"
                  icon={generating ? undefined : <DownloadOutlined />}
                  loading={generating}
                  onClick={generate}
                >
                  {generating ? "Montando os documentos…" : "Gerar e baixar kit contratual"}
                </Button>
              </div>
            </Flex>
          )}
        </Card>
      </Col>
    </Row>
  );
}
