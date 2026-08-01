"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  ArrowLeftOutlined,
  BankOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  FileOutlined,
  FileTextOutlined,
  FolderOutlined,
  MoreOutlined,
  PaperClipOutlined,
  RightOutlined,
  RiseOutlined,
  RobotOutlined,
  RocketOutlined,
  SaveOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Dropdown,
  Empty,
  Flex,
  Input,
  InputNumber,
  List,
  Result,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Tabs,
  Tag,
  theme,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import { toast } from "sonner";

import { VisualizadorPdf } from "@/core/components/visualizador-pdf";
import {
  deleteCity,
  getCity,
  updateCityPipeline,
} from "@/core/lib/cities-firestore";
import {
  STAGE_KEYS,
  STAGE_LABELS,
  formatCurrency,
  stagePastelTone,
  stageProbability,
  type CityAccount,
  type StageKey,
} from "@/core/lib/city-types";
import { getFirebaseDb, getFirebaseStorage } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import { listCityReports } from "@/modules/cidades/city-reports-firestore";
import {
  CITY_REPORT_TYPE_LABELS,
  type CityReport,
} from "@/modules/cidades/reports-types";
import {
  formatFileSize,
  listCityDocuments,
  uploadCityDocument,
} from "@/modules/documentos/documentos-firestore";
import type {
  CityDocument,
  CreateCityDocumentInput,
} from "@/modules/documentos/types";

import { DocumentUploadDialog } from "../../documentos/_components/document-upload-dialog";
import { DeleteCityDialog } from "./_components/delete-city-dialog";
import { FundebDataTab } from "./_components/fundeb-data-tab";

const { Text, Title } = Typography;

type CityTab = "visao-geral" | "dados-fundeb" | "relatorios" | "documentos";

export default function CidadeDetailPage() {
  const params = useParams<{ cityId: string }>();
  const cityId = params.cityId;
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const [tab, setTab] = useState<CityTab>("visao-geral");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const {
    data: city,
    isPending: cityPending,
    error: cityError,
  } = useQuery({
    queryKey: ["city", cityId],
    queryFn: () => getCity(getFirebaseDb(), cityId),
    enabled: Boolean(cityId),
  });

  const {
    data: reports = [],
    isPending: reportsPending,
    error: reportsError,
  } = useQuery({
    queryKey: ["city-reports", user?.groupId, cityId],
    queryFn: () => listCityReports(getFirebaseDb(), user!.groupId, cityId),
    enabled: Boolean(user?.groupId && cityId),
  });

  const { data: allDocuments = [], isPending: documentsPending } = useQuery({
    queryKey: ["city-documents", user?.groupId],
    queryFn: () => listCityDocuments(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });
  const documents = useMemo(
    () => allDocuments.filter((document) => document.cityId === cityId),
    [allDocuments, cityId],
  );

  const uploadMutation = useMutation({
    mutationFn: ({
      file,
      input,
    }: {
      file: File;
      input: Omit<
        CreateCityDocumentInput,
        "groupId" | "createdBy" | "createdByName"
      >;
    }) =>
      uploadCityDocument(getFirebaseDb(), getFirebaseStorage(), file, {
        ...input,
        groupId: user!.groupId,
        createdBy: user!.id,
        createdByName: user!.name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["city-documents"] });
      setUploadOpen(false);
      toast.success("Documento anexado à cidade.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (targetCityId: string) =>
      deleteCity(getFirebaseDb(), targetCityId),
    onSuccess: async () => {
      setDeleteOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cities"] }),
        queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] }),
        queryClient.invalidateQueries({ queryKey: ["documentos-cities"] }),
        queryClient.invalidateQueries({ queryKey: ["sidebar-cities-real"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-cities-real"] }),
        queryClient.invalidateQueries({ queryKey: ["modulos-cities"] }),
      ]);
      queryClient.removeQueries({ queryKey: ["city", cityId] });
      toast.success("Cidade excluída da carteira. O histórico foi preservado.");
      router.replace("/cidades");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a cidade.",
      );
    },
  });

  const selectedReport =
    reports.find((report) => report.id === selectedReportId) ?? reports[0];

  if (cityPending) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (cityError || !city) {
    return (
      <Result
        icon={<EnvironmentOutlined style={{ color: token.colorTextTertiary }} />}
        title="Cidade não encontrada"
        extra={
          <Link href="/cidades">
            <Button type="primary">Voltar para cidades</Button>
          </Link>
        }
      />
    );
  }

  const tone = stagePastelTone(city.stage);

  const handleUpload = async (
    file: File,
    input: Omit<
      CreateCityDocumentInput,
      "groupId" | "createdBy" | "createdByName"
    >,
  ) => {
    await uploadMutation.mutateAsync({ file, input });
  };

  const optionsMenu: MenuProps["items"] = [
    {
      key: "excluir",
      danger: true,
      label: "Excluir cidade",
      onClick: () => setDeleteOpen(true),
    },
  ];

  /* Conteúdo por aba: renderizado fora do `Tabs` (que aqui só resolve a
     barra de navegação) para o cabeçalho — nome, estágio, ações — ficar num
     cartão só, e o conteúdo de cada aba em cartões próprios abaixo, como já
     era antes da migração. */
  const tabPanels: { key: CityTab; label: string; icon: ReactNode; content: ReactNode }[] = [
    {
      key: "visao-geral",
      label: "Visão geral",
      icon: <RiseOutlined />,
      content: (
        <OverviewTab
          city={city}
          reports={reports}
          documents={documents}
          onOpenReports={() => setTab("relatorios")}
        />
      ),
    },
    {
      key: "dados-fundeb",
      label: "Levantamento FUNDEB",
      icon: <DatabaseOutlined />,
      content: (
        <FundebDataTab
          city={city}
          reports={reports}
          pending={reportsPending}
          selected={selectedReport}
          onSelect={setSelectedReportId}
        />
      ),
    },
    {
      key: "relatorios",
      label: `Relatórios (${reportsError ? "—" : reports.length})`,
      icon: <FileTextOutlined />,
      content: (
        <ReportsTab
          city={city}
          reports={reports}
          pending={reportsPending}
          error={reportsError}
          selected={selectedReport}
          onSelect={setSelectedReportId}
        />
      ),
    },
    {
      key: "documentos",
      label: `Documentos (${documents.length})`,
      icon: <FolderOutlined />,
      content: (
        <DocumentsTab
          documents={documents}
          pending={documentsPending}
          onUpload={() => setUploadOpen(true)}
        />
      ),
    },
  ];

  return (
    <Flex vertical gap={14}>
      <Card>
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={16}>
          <Flex gap={14} align="flex-start" style={{ minWidth: 0 }}>
            <Link href="/cidades" aria-label="Voltar para cidades">
              <Button shape="circle" icon={<ArrowLeftOutlined />} />
            </Link>
            <div style={{ minWidth: 0 }}>
              <Flex align="center" gap={10} wrap="wrap">
                <Title level={3} style={{ margin: 0 }}>
                  {city.name}
                </Title>
                <Tag
                  style={{
                    backgroundColor: tone.bg,
                    color: tone.text,
                    border: "none",
                    borderRadius: 999,
                  }}
                >
                  {STAGE_LABELS[city.stage]}
                </Tag>
              </Flex>
              <Text
                type="secondary"
                style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11 }}
              >
                {city.uf}
                {city.region ? ` · ${city.region}` : ""} · IBGE{" "}
                {city.codigoIbge || "não informado"} ·{" "}
                {reportsError
                  ? "relatórios indisponíveis"
                  : `${reports.length} relatórios`}{" "}
                · {documents.length} documentos
              </Text>
            </div>
          </Flex>

          <Space wrap>
            <Button
              icon={<PaperClipOutlined />}
              onClick={() => setUploadOpen(true)}
            >
              Anexar documento
            </Button>
            <Link href={`/modulos/levantamento-fundeb?ibge=${city.codigoIbge}`}>
              <Button type="primary" icon={<RocketOutlined />}>
                Gerar relatório
              </Button>
            </Link>
            {(user?.groupRole === "owner" || user?.groupRole === "admin") && (
              <Dropdown menu={{ items: optionsMenu }} trigger={["click"]}>
                <Button
                  icon={<MoreOutlined />}
                  aria-label="Mais opções da cidade"
                  title="Mais opções"
                />
              </Dropdown>
            )}
          </Space>
        </Flex>

        <Tabs
          activeKey={tab}
          onChange={(key) => setTab(key as CityTab)}
          style={{ marginTop: 4, marginBottom: -16 }}
          items={tabPanels.map(({ key, label, icon }) => ({
            key,
            label: (
              <Space size={6}>
                {icon}
                {label}
              </Space>
            ),
          }))}
        />
      </Card>

      {tabPanels.find((panel) => panel.key === tab)?.content}

      {uploadOpen && (
        <DocumentUploadDialog
          open
          cities={[city]}
          initialCityId={city.id}
          uploading={uploadMutation.isPending}
          onClose={() => {
            if (!uploadMutation.isPending) setUploadOpen(false);
          }}
          onSubmit={handleUpload}
        />
      )}

      {deleteOpen && (
        <DeleteCityDialog
          cityName={city.name}
          deleting={deleteMutation.isPending}
          onClose={() => {
            if (!deleteMutation.isPending) setDeleteOpen(false);
          }}
          onConfirm={() => deleteMutation.mutate(city.id)}
        />
      )}
    </Flex>
  );
}

function OverviewTab({
  city,
  reports,
  documents,
  onOpenReports,
}: {
  city: CityAccount;
  reports: CityReport[];
  documents: CityDocument[];
  onOpenReports: () => void;
}) {
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const [stage, setStage] = useState<StageKey>(city.stage);
  const [probability, setProbability] = useState(city.probability);
  const [revenue, setRevenue] = useState(city.estimatedAnnualRevenue);
  const [nextStep, setNextStep] = useState(city.nextStepDescription ?? "");
  const [dueDate, setDueDate] = useState(city.nextStepDueDate ?? "");

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCityPipeline(getFirebaseDb(), city.id, {
        stage,
        probability,
        estimatedAnnualRevenue: revenue,
        nextStepDescription: nextStep,
        nextStepDueDate: dueDate,
        lastActivityAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["city", city.id] });
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] });
      toast.success("Pipeline da cidade atualizado.");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o pipeline.",
      ),
  });

  const latestActivities = [
    ...reports.map((report) => ({
      id: `report-${report.id}`,
      title: report.title,
      meta: `Relatório ${report.exercise}`,
      date: report.generatedAt,
      icon: RobotOutlined,
      background: token.colorSuccessBg,
      color: token.colorSuccess,
    })),
    ...documents.map((document) => ({
      id: `document-${document.id}`,
      title: document.title,
      meta: "Documento anexado",
      date: document.createdAt,
      icon: PaperClipOutlined,
      background: token.colorInfoBg,
      color: token.colorInfo,
    })),
  ]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 5);

  return (
    <Row gutter={[14, 14]}>
      <Col xs={24} xl={15}>
        <Card>
          <Flex justify="space-between" align="flex-start">
            <div>
              <Title level={5} style={{ margin: 0 }}>
                Pipeline e próxima ação
              </Title>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Este status alimenta o Kanban e o painel comercial.
              </Text>
            </div>
            <Text
              type="secondary"
              style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11 }}
            >
              {probability}% probabilidade
            </Text>
          </Flex>

          <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
            <Col xs={24} sm={12}>
              <Flex vertical gap={6}>
                <Text strong style={{ fontSize: 11 }}>
                  Estágio atual
                </Text>
                <Select<StageKey>
                  value={stage}
                  onChange={(value) => {
                    setStage(value);
                    setProbability(stageProbability(value));
                  }}
                  options={STAGE_KEYS.map((key) => ({
                    value: key,
                    label: STAGE_LABELS[key],
                  }))}
                />
              </Flex>
            </Col>
            <Col xs={24} sm={12}>
              <Flex vertical gap={6}>
                <Text strong style={{ fontSize: 11 }}>
                  Probabilidade (%)
                </Text>
                <InputNumber
                  min={0}
                  max={100}
                  value={probability}
                  onChange={(value) => setProbability(value ?? 0)}
                  style={{ width: "100%" }}
                />
              </Flex>
            </Col>
            <Col xs={24} sm={12}>
              <Flex vertical gap={6}>
                <Text strong style={{ fontSize: 11 }}>
                  Receita anual estimada
                </Text>
                <InputNumber
                  min={0}
                  step={1000}
                  value={revenue}
                  onChange={(value) => setRevenue(value ?? 0)}
                  style={{ width: "100%" }}
                  prefix="R$"
                />
              </Flex>
            </Col>
            <Col xs={24} sm={12}>
              <Flex vertical gap={6}>
                <Text strong style={{ fontSize: 11 }}>
                  Prazo da próxima ação
                </Text>
                <DatePicker
                  value={dueDate ? dayjs(dueDate) : null}
                  onChange={(date) =>
                    setDueDate(date ? date.format("YYYY-MM-DD") : "")
                  }
                  style={{ width: "100%" }}
                  format="DD/MM/YYYY"
                />
              </Flex>
            </Col>
          </Row>

          <Flex vertical gap={6} style={{ marginTop: 16 }}>
            <Text strong style={{ fontSize: 11 }}>
              Próxima ação
            </Text>
            <Input.TextArea
              value={nextStep}
              onChange={(event) => setNextStep(event.target.value)}
              rows={3}
              placeholder="Ex.: Apresentar diagnóstico ao secretário de educação"
            />
          </Flex>

          <Flex justify="flex-end" style={{ marginTop: 20 }}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              Salvar acompanhamento
            </Button>
          </Flex>
        </Card>
      </Col>

      <Col xs={24} xl={9}>
        <Flex vertical gap={14}>
          <Card>
            <Title level={5} style={{ margin: 0 }}>
              Resumo da cidade
            </Title>
            <Row style={{ marginTop: 16 }}>
              <Col span={8}>
                <Statistic
                  title="relatórios"
                  value={reports.length}
                  styles={{ content: {
                    fontFamily: "var(--font-sync-mono)",
                    fontSize: 16,
                  } }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="documentos"
                  value={documents.length}
                  styles={{ content: {
                    fontFamily: "var(--font-sync-mono)",
                    fontSize: 16,
                  } }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="probabilidade"
                  value={`${city.probability}%`}
                  styles={{ content: {
                    fontFamily: "var(--font-sync-mono)",
                    fontSize: 16,
                  } }}
                />
              </Col>
            </Row>

            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: token.borderRadiusLG,
                background: token.colorFillTertiary,
              }}
            >
              <Text
                type="secondary"
                style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}
              >
                Receita estimada
              </Text>
              <Title
                level={4}
                style={{ margin: "4px 0 0", fontFamily: "var(--font-sync-mono)" }}
              >
                {formatCurrency(city.estimatedAnnualRevenue)}
              </Title>
            </div>

            {reports[0] && (
              <Button
                block
                type="text"
                onClick={onOpenReports}
                style={{ marginTop: 12, height: "auto", padding: 12, textAlign: "left" }}
              >
                <Flex justify="space-between" align="center" style={{ width: "100%" }}>
                  <div style={{ minWidth: 0 }}>
                    <Text strong style={{ fontSize: 11, display: "block" }}>
                      {reports[0].title}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 9 }}>
                      Último relatório · {formatDate(reports[0].generatedAt)}
                    </Text>
                  </div>
                  <RightOutlined style={{ color: token.colorTextTertiary }} />
                </Flex>
              </Button>
            )}
          </Card>

          <Card style={{ flex: 1 }}>
            <Title level={5} style={{ margin: 0 }}>
              Atividade recente
            </Title>
            {latestActivities.length ? (
              <List
                size="small"
                style={{ marginTop: 8 }}
                dataSource={latestActivities}
                renderItem={(activity) => {
                  const Icon = activity.icon;
                  return (
                    <List.Item style={{ border: "none", padding: "8px 0" }}>
                      <Flex align="center" gap={10} style={{ width: "100%" }}>
                        <Flex
                          align="center"
                          justify="center"
                          style={{
                            width: 28,
                            height: 28,
                            flex: "0 0 auto",
                            borderRadius: token.borderRadius,
                            background: activity.background,
                            color: activity.color,
                          }}
                        >
                          <Icon style={{ fontSize: 13 }} />
                        </Flex>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <Text strong ellipsis style={{ fontSize: 10, display: "block" }}>
                            {activity.title}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 8.5 }}>
                            {activity.meta} · {formatDate(activity.date)}
                          </Text>
                        </div>
                      </Flex>
                    </List.Item>
                  );
                }}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="A atividade aparecerá quando um relatório ou documento for salvo."
                style={{ marginTop: 16 }}
              />
            )}
          </Card>
        </Flex>
      </Col>
    </Row>
  );
}

function ReportsTab({
  city,
  reports,
  pending,
  error,
  selected,
  onSelect,
}: {
  city: CityAccount;
  reports: CityReport[];
  pending: boolean;
  error: unknown;
  selected?: CityReport;
  onSelect: (id: string) => void;
}) {
  const { token } = theme.useToken();

  if (pending) {
    return (
      <Card style={{ minHeight: 460 }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </Card>
    );
  }

  if (error) {
    return (
      <Result
        status="warning"
        icon={<WarningOutlined />}
        title="Não foi possível consultar os relatórios"
        subTitle="A leitura do histórico falhou. Verifique as regras do Firestore e tente recarregar a página; o sistema não exibirá “zero” enquanto a consulta estiver indisponível."
      />
    );
  }

  if (!reports.length) {
    return (
      <Card style={{ minHeight: 460 }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_DEFAULT}
          description={
            <Space direction="vertical" size={4} style={{ maxWidth: 380 }}>
              <Text strong>Nenhum relatório gerado</Text>
              <Text type="secondary">
                Gere o primeiro levantamento. O PDF e uma versão navegável
                ficarão vinculados automaticamente a esta cidade.
              </Text>
            </Space>
          }
        >
          <Link href={`/modulos/levantamento-fundeb?ibge=${city.codigoIbge}`}>
            <Button type="primary" icon={<RocketOutlined />}>
              Gerar levantamento
            </Button>
          </Link>
        </Empty>
      </Card>
    );
  }

  return (
    <Row gutter={[14, 14]}>
      <Col xs={24} xl={7}>
        <Card size="small" title="Histórico de versões">
          <List
            size="small"
            dataSource={reports}
            renderItem={(report) => {
              const active = selected?.id === report.id;
              return (
                <List.Item
                  key={report.id}
                  onClick={() => onSelect(report.id)}
                  style={{
                    cursor: "pointer",
                    borderRadius: token.borderRadiusLG,
                    background: active ? token.colorFillSecondary : "transparent",
                    padding: 12,
                    marginBottom: 6,
                    border: "none",
                  }}
                >
                  <Flex gap={10} align="flex-start" style={{ width: "100%" }}>
                    <Flex
                      align="center"
                      justify="center"
                      style={{
                        width: 32,
                        height: 32,
                        flex: "0 0 auto",
                        borderRadius: token.borderRadius,
                        background: active
                          ? token.colorBgContainer
                          : token.colorFillTertiary,
                      }}
                    >
                      <FileTextOutlined style={{ color: token.colorTextSecondary }} />
                    </Flex>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text strong ellipsis style={{ fontSize: 10.5, display: "block" }}>
                        {report.title}
                      </Text>
                      <Text
                        type="secondary"
                        style={{ fontFamily: "var(--font-sync-mono)", fontSize: 8.5 }}
                      >
                        {report.exercise} · {formatDate(report.generatedAt)}
                      </Text>
                      <Flex gap={6} wrap="wrap" style={{ marginTop: 8 }}>
                        {report.downloadUrl ? (
                          <Tag color="success" style={{ fontSize: 8 }}>
                            PDF arquivado
                          </Tag>
                        ) : (
                          <Tag color="warning" style={{ fontSize: 8 }}>
                            versão navegável
                          </Tag>
                        )}
                        {report.snapshot && (
                          <Tag color="purple" style={{ fontSize: 8 }}>
                            JSON salvo
                            {report.snapshotBytes
                              ? ` · ${formatJsonSize(report.snapshotBytes)}`
                              : ""}
                          </Tag>
                        )}
                      </Flex>
                    </div>
                  </Flex>
                </List.Item>
              );
            }}
          />
        </Card>
      </Col>

      <Col xs={24} xl={17}>
        {selected && <ReportPreview report={selected} />}
      </Col>
    </Row>
  );
}

function ReportPreview({ report }: { report: CityReport }) {
  const { token } = theme.useToken();
  const [pdfAberto, setPdfAberto] = useState(false);
  const snapshot = report.snapshot;
  const identification = snapshot?.identificacao;
  const projection =
    snapshot?.projecaoRecuperavel ?? snapshot?.projecao ?? undefined;
  const census = snapshot?.censoEscolar;

  const municipality =
    stringField(identification, "municipioNome") ||
    stringField(identification, "municipio") ||
    report.cityName;
  const current = numberField(projection, "totalAtual");
  const projected = numberField(projection, "totalProjetado");
  const gain = numberField(projection, "totalGanho");

  return (
    <Card>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
        <Flex align="center" gap={10}>
          <Flex
            align="center"
            justify="center"
            style={{
              width: 32,
              height: 32,
              flex: "0 0 auto",
              borderRadius: token.borderRadiusLG,
              background: token.colorSuccessBg,
              color: token.colorSuccess,
            }}
          >
            <BankOutlined />
          </Flex>
          <div>
            <Title level={5} style={{ margin: 0 }}>
              {CITY_REPORT_TYPE_LABELS[report.type] ?? report.title}
            </Title>
            <Text type="secondary" style={{ fontSize: 10.5 }}>
              {municipality} · {report.cityUf} · exercício {report.exercise}
            </Text>
          </div>
        </Flex>
        {report.downloadUrl && (
          <Button
            type="primary"
            icon={<EyeOutlined />}
            onClick={() => setPdfAberto(true)}
          >
            Abrir PDF exato
          </Button>
        )}
      </Flex>

      {pdfAberto && report.downloadUrl && (
        <VisualizadorPdf
          url={report.downloadUrl}
          titulo={CITY_REPORT_TYPE_LABELS[report.type] ?? report.title}
          nomeArquivo={report.fileName}
          detalhe={`${municipality} · ${report.cityUf} · exercício ${report.exercise}`}
          onFechar={() => setPdfAberto(false)}
        />
      )}

      <Card
        style={{ marginTop: 20, background: token.colorBgSpotlight, border: "none" }}
      >
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
          <div>
            <Text
              style={{
                color: "rgba(255,255,255,.55)",
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Resumo do levantamento
            </Text>
            <Title
              level={4}
              style={{ color: token.colorTextLightSolid, margin: "4px 0 0" }}
            >
              {municipality}
            </Title>
          </div>
          <Tag
            style={{
              background: "rgba(255,255,255,.1)",
              color: token.colorTextLightSolid,
              border: "none",
            }}
          >
            versão {formatDate(report.generatedAt)}
          </Tag>
        </Flex>
        <Row gutter={16} style={{ marginTop: 20 }}>
          <Col span={8}>
            <Statistic
              title={
                <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 8.5 }}>
                  Atual
                </Text>
              }
              value={formatCurrency(current)}
              styles={{ content: {
                color: token.colorTextLightSolid,
                fontFamily: "var(--font-sync-mono)",
                fontSize: 15,
              } }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={
                <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 8.5 }}>
                  Projetado
                </Text>
              }
              value={formatCurrency(projected)}
              styles={{ content: {
                color: token.colorTextLightSolid,
                fontFamily: "var(--font-sync-mono)",
                fontSize: 15,
              } }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={
                <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 8.5 }}>
                  Ganho recuperável
                </Text>
              }
              value={`+${formatCurrency(gain)}`}
              styles={{ content: {
                color: token.colorSuccess,
                fontFamily: "var(--font-sync-mono)",
                fontSize: 15,
              } }}
            />
          </Col>
        </Row>
      </Card>

      {snapshot ? (
        <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12}>
            <PreviewBlock
              title="Complementações FUNDEB"
              rows={[
                ["VAAF atual", formatCurrency(numberField(projection, "vaafAtual"))],
                ["VAAT atual", formatCurrency(numberField(projection, "vaatAtual"))],
                ["VAAR atual", formatCurrency(numberField(projection, "vaarAtual"))],
              ]}
            />
          </Col>
          <Col xs={24} sm={12}>
            <PreviewBlock
              title="Censo Escolar"
              rows={[
                [
                  "Matrículas",
                  formatInteger(numberField(census, "totalMatriculas")),
                ],
                ["Escolas", formatInteger(numberField(census, "totalEscolas"))],
                [
                  "Ganho percentual",
                  `${numberField(projection, "ganhoPercentual").toFixed(1)}%`,
                ],
              ]}
            />
          </Col>
        </Row>
      ) : (
        <Alert
          style={{ marginTop: 16 }}
          type="warning"
          showIcon
          message="Esta versão possui apenas o arquivo PDF. Abra o documento exato pelo botão acima."
        />
      )}

      <Flex
        align="center"
        gap={8}
        style={{
          marginTop: 16,
          padding: "10px 12px",
          borderRadius: token.borderRadiusLG,
          background: token.colorFillTertiary,
        }}
      >
        <CheckCircleOutlined style={{ color: token.colorSuccess }} />
        <Text type="secondary" style={{ fontSize: 9.5 }}>
          Gerado por {report.generatedByName || "Global Sync"} em{" "}
          {formatDate(report.generatedAt)}
        </Text>
      </Flex>
    </Card>
  );
}

function PreviewBlock({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <Card size="small" title={title}>
      <Descriptions
        size="small"
        column={1}
        items={rows.map(([label, value]) => ({
          key: label,
          label,
          children: (
            <Text strong style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11 }}>
              {value}
            </Text>
          ),
        }))}
      />
    </Card>
  );
}

function DocumentsTab({
  documents,
  pending,
  onUpload,
}: {
  documents: CityDocument[];
  pending: boolean;
  onUpload: () => void;
}) {
  const { token } = theme.useToken();
  /* Só PDF abre por dentro: o visor embutido é o do Chromium, e DOCX ou XLSX
     nele viram tela em branco. Para esses, baixar continua sendo o caminho. */
  const [aberto, setAberto] = useState<CityDocument | null>(null);

  const columns: ProColumns<CityDocument>[] = [
    {
      title: "Documento",
      dataIndex: "title",
      search: false,
      sorter: (a, b) => a.title.localeCompare(b.title, "pt-BR"),
      render: (_, document) => (
        <Flex align="center" gap={10}>
          <Flex
            align="center"
            justify="center"
            style={{
              width: 30,
              height: 30,
              flex: "0 0 auto",
              borderRadius: token.borderRadius,
              background: token.colorFillTertiary,
            }}
          >
            {document.source === "generated" ? (
              <RobotOutlined style={{ color: token.colorPrimary }} />
            ) : (
              <FileOutlined style={{ color: token.colorTextSecondary }} />
            )}
          </Flex>
          <div style={{ minWidth: 0 }}>
            <Text strong style={{ fontSize: 11, display: "block" }}>
              {document.title}
            </Text>
            <Text
              type="secondary"
              style={{ fontFamily: "var(--font-sync-mono)", fontSize: 8.5 }}
            >
              {document.fileName} · {formatFileSize(document.fileSize)} ·{" "}
              {formatDate(document.createdAt)}
            </Text>
          </div>
        </Flex>
      ),
    },
    {
      title: "Categoria",
      dataIndex: "category",
      width: 160,
      search: false,
      sorter: (a, b) => a.category.localeCompare(b.category, "pt-BR"),
      render: (_, document) => <Tag>{document.category.replaceAll("_", " ")}</Tag>,
    },
    {
      title: "",
      key: "acoes",
      width: 110,
      align: "right",
      search: false,
      render: (_, document) => (
        <Space size={4}>
          {ehPdf(document) && (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setAberto(document)}
              aria-label={`Abrir ${document.title} no app`}
            >
              Abrir
            </Button>
          )}
          <Button
            size="small"
            type="text"
            icon={<DownloadOutlined />}
            href={document.downloadUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Baixar ${document.title}`}
            title="Baixar"
          />
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <div>
          <Title level={5} style={{ margin: 0 }}>
            Pasta digital da cidade
          </Title>
          <Text type="secondary" style={{ fontSize: 10 }}>
            Contratos, relatórios, ofícios, planilhas e qualquer outro arquivo.
          </Text>
        </div>
        <Button type="primary" icon={<PaperClipOutlined />} onClick={onUpload}>
          Anexar
        </Button>
      </Flex>

      <div style={{ marginTop: 16 }}>
        {pending ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : documents.length ? (
          <ProTable<CityDocument>
            rowKey="id"
            size="small"
            search={false}
            toolBarRender={false}
            options={false}
            pagination={false}
            dateFormatter="string"
            dataSource={documents}
            columns={columns}
          />
        ) : (
          <Empty
            description="Nenhum documento anexado — use o botão Anexar para iniciar a pasta digital."
            style={{ padding: "60px 0" }}
          />
        )}
      </div>

      {aberto && (
        <VisualizadorPdf
          url={aberto.downloadUrl}
          titulo={aberto.title}
          nomeArquivo={aberto.fileName}
          detalhe={`${aberto.cityName} · ${aberto.fileName} · ${formatFileSize(aberto.fileSize)}`}
          onFechar={() => setAberto(null)}
        />
      )}
    </Card>
  );
}

/** O visor embutido só entende PDF — o resto continua sendo download. */
function ehPdf(documento: CityDocument): boolean {
  return (
    documento.mimeType === "application/pdf" ||
    documento.fileName.toLowerCase().endsWith(".pdf")
  );
}

function stringField(
  object: Record<string, unknown> | undefined,
  field: string,
): string {
  return typeof object?.[field] === "string" ? object[field] : "";
}

function numberField(
  object: Record<string, unknown> | undefined,
  field: string,
): number {
  const value = Number(object?.[field]);
  return Number.isFinite(value) ? value : 0;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(
    value,
  );
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

function formatJsonSize(bytes: number): string {
  return bytes < 1024
    ? `${bytes} B`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
