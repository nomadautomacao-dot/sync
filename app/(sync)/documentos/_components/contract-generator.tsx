"use client";

import { useMemo, useState } from "react";
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
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  theme,
} from "antd";

import type { CityAccount } from "@/core/lib/city-types";
import type {
  ContratoFundebCampoMeta,
  ContratosFundebData,
} from "@/modules/contrato-fundeb/types";
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
  const [cityId, setCityId] = useState("");
  const [monthlyValue, setMonthlyValue] = useState("27500");
  const [months, setMonths] = useState("12");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [archive, setArchive] = useState(true);
  const [result, setResult] = useState<AgentResponse | null>(null);

  const selectedCity = useMemo(
    () => cities.find((city) => city.id === cityId),
    [cities, cityId],
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
      const response = await fetch("/api/contratos-fundeb/generate-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contrato: result.contrato }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Falha ao gerar o kit documental.");
      }

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

            <Card size="small" style={{ background: token.colorFillQuaternary }}>
              <Flex align="center" gap={8}>
                <AuditOutlined style={{ color: token.colorTextSecondary }} />
                <Typography.Text strong style={{ fontSize: 11 }}>
                  Base legal do modelo
                </Typography.Text>
              </Flex>
              <Typography.Paragraph
                type="secondary"
                style={{ marginTop: 8, marginBottom: 0, fontSize: 11 }}
              >
                Lei Federal nº 14.133/2021, com estrutura de DFD, ETP, Termo de
                Referência, pareceres, ratificação, homologação e minuta.
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
