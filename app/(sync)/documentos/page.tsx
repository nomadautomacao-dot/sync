"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileOutlined,
  FileTextOutlined,
  FileZipOutlined,
  FilterOutlined,
  FolderOpenOutlined,
  MoreOutlined,
  PlusOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { ProCard, ProTable } from "@ant-design/pro-components";
import type { ActionType, ProColumns, ProFormInstance } from "@ant-design/pro-components";
import {
  App,
  Button,
  Dropdown,
  Empty,
  Flex,
  Modal,
  Result,
  Space,
  Statistic,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  theme,
} from "antd";

import { getFirebaseDb, getFirebaseStorage } from "@/core/lib/firebase-client";
import { listCities } from "@/core/lib/cities-firestore";
import type { CityAccount } from "@/core/lib/city-types";
import { useAuth } from "@/core/providers/auth-provider";
import {
  deleteCityDocument,
  formatFileSize,
  listCityDocuments,
  uploadCityDocument,
} from "@/modules/documentos/documentos-firestore";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  type CityDocument,
  type CreateCityDocumentInput,
  type DocumentCategory,
} from "@/modules/documentos/types";

import { ContractGenerator } from "./_components/contract-generator";
import { DocumentUploadDialog } from "./_components/document-upload-dialog";

type WorkspaceTab = "acervo" | "gerar";

/**
 * Parâmetros que o formulário de busca embutido do `ProTable` devolve. A
 * filtragem em si é local — os documentos já estão todos carregados pela
 * query — mas passa pelo `request` do ProTable para reaproveitar o formulário
 * de busca em vez de escrever campos e `useMemo` de filtro à mão.
 */
interface DocumentSearchParams {
  keyword?: string;
  cityId?: string;
  category?: DocumentCategory;
  /* Não são campos de busca — só mudam de valor quando a query do Firestore
     termina de carregar, e servem para o `params` do ProTable perceber que
     precisa refazer o `request` local. */
  total?: number;
  cidades?: number;
}

export default function DocumentosPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("acervo");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [modalApi, modalContextHolder] = Modal.useModal();
  const actionRef = useRef<ActionType>(undefined);
  const formRef = useRef<ProFormInstance<DocumentSearchParams>>(undefined);

  const { data: cities = [], isPending: citiesPending } = useQuery({
    queryKey: ["documentos-cities", user?.groupId],
    queryFn: () => listCities(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });

  const {
    data: documents = [],
    isPending: documentsPending,
    isError: documentsError,
    refetch: refetchDocuments,
  } = useQuery({
    queryKey: ["city-documents", user?.groupId],
    queryFn: () => listCityDocuments(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });

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
      queryClient.invalidateQueries({
        queryKey: ["city-documents", user?.groupId],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (document: CityDocument) =>
      deleteCityDocument(getFirebaseDb(), getFirebaseStorage(), document),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["city-documents", user?.groupId],
      });
      message.success("Documento excluído do acervo.");
    },
    onError: (error) => {
      message.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o documento.",
      );
    },
  });

  const metrics = useMemo(() => {
    const contracts = documents.filter(
      (document) => document.category === "contrato",
    );
    const today = new Date();
    const inNinetyDays = new Date();
    inNinetyDays.setDate(inNinetyDays.getDate() + 90);
    const expiring = contracts.filter((document) => {
      if (!document.expiresAt) return false;
      const date = new Date(`${document.expiresAt}T12:00:00`);
      return date >= today && date <= inNinetyDays;
    }).length;
    return {
      total: documents.length,
      cities: new Set(documents.map((document) => document.cityId)).size,
      contracts: contracts.length,
      expiring,
    };
  }, [documents]);

  const handleUpload = async (
    file: File,
    input: Omit<
      CreateCityDocumentInput,
      "groupId" | "createdBy" | "createdByName"
    >,
  ) => {
    await uploadMutation.mutateAsync({ file, input });
    setUploadOpen(false);
    message.success("Documento anexado ao acervo.");
  };

  const archiveGeneratedContract = async (
    file: File,
    city: CityAccount,
    title: string,
    contractNumber?: string,
  ) => {
    await uploadMutation.mutateAsync({
      file,
      input: {
        cityId: city.id,
        cityName: city.name,
        cityUf: city.uf,
        category: "contrato",
        title,
        contractNumber,
        description:
          "Kit contratual gerado pelo modelo de Inexigibilidade · Consultoria FUNDEB.",
        source: "generated",
      },
    });
  };

  const confirmDelete = useCallback(
    (document: CityDocument) => {
      modalApi.confirm({
        title: `Excluir "${document.title}" do acervo?`,
        content:
          "O arquivo também será removido do armazenamento e esta ação não pode ser desfeita.",
        okText: "Excluir",
        okButtonProps: { danger: true },
        cancelText: "Cancelar",
        onOk: () => deleteMutation.mutate(document),
      });
    },
    [modalApi, deleteMutation],
  );

  const loading = citiesPending || documentsPending;

  const cityValueEnum = useMemo(
    () =>
      Object.fromEntries(
        cities.map((city) => [city.id, { text: `${city.name} · ${city.uf}` }]),
      ),
    [cities],
  );
  const categoryValueEnum = useMemo(
    () =>
      Object.fromEntries(
        DOCUMENT_CATEGORIES.map((category) => [
          category,
          { text: DOCUMENT_CATEGORY_LABELS[category] },
        ]),
      ),
    [],
  );

  const columns: ProColumns<CityDocument>[] = useMemo(
    () => [
      {
        title: "Buscar",
        dataIndex: "keyword",
        hideInTable: true,
        fieldProps: { placeholder: "Documento, município ou número…" },
      },
      {
        title: "Documento",
        dataIndex: "title",
        search: false,
        ellipsis: true,
        sorter: (a, b) => a.title.localeCompare(b.title, "pt-BR"),
        render: (_, doc) => (
          <Space size={10} align="start">
            <Flex
              align="center"
              justify="center"
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: token.colorFillTertiary,
                flexShrink: 0,
              }}
            >
              {renderFileIcon(doc.fileName, token.colorTextSecondary)}
            </Flex>
            <div style={{ minWidth: 0 }}>
              <Space size={4}>
                <Typography.Text strong style={{ fontSize: 12 }}>
                  {doc.title}
                </Typography.Text>
                {doc.source === "generated" && (
                  <Tooltip title="Gerado pelo sistema">
                    <RobotOutlined style={{ color: token.colorInfoText }} />
                  </Tooltip>
                )}
              </Space>
              <div
                style={{
                  fontFamily: "var(--font-sync-mono)",
                  fontSize: 10,
                  color: token.colorTextTertiary,
                }}
              >
                {doc.fileName}
                {doc.contractNumber ? ` · nº ${doc.contractNumber}` : ""}
              </div>
            </div>
          </Space>
        ),
      },
      {
        title: "Município",
        dataIndex: "cityId",
        width: 190,
        valueType: "select",
        valueEnum: cityValueEnum,
        sorter: (a, b) => a.cityName.localeCompare(b.cityName, "pt-BR"),
        render: (_, doc) => (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>{doc.cityName}</div>
            <div
              style={{
                fontFamily: "var(--font-sync-mono)",
                fontSize: 10,
                color: token.colorTextTertiary,
              }}
            >
              {doc.cityUf}
            </div>
          </div>
        ),
      },
      {
        title: "Categoria",
        dataIndex: "category",
        width: 160,
        valueType: "select",
        valueEnum: categoryValueEnum,
        sorter: (a, b) =>
          (DOCUMENT_CATEGORY_LABELS[a.category] ?? a.category).localeCompare(
            DOCUMENT_CATEGORY_LABELS[b.category] ?? b.category,
            "pt-BR",
          ),
        render: (_, doc) => (
          <Tag>{DOCUMENT_CATEGORY_LABELS[doc.category] ?? "Documento"}</Tag>
        ),
      },
      {
        title: "Vencimento",
        dataIndex: "expiresAt",
        width: 170,
        search: false,
        sorter: (a, b) => (a.expiresAt ?? "").localeCompare(b.expiresAt ?? ""),
        render: (_, doc) => {
          const expired =
            doc.expiresAt && new Date(`${doc.expiresAt}T12:00:00`) < new Date();
          return doc.expiresAt ? (
            <div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: expired ? token.colorErrorText : token.colorText,
                }}
              >
                {expired ? "Venceu " : "Vence "}
                {formatDate(doc.expiresAt)}
              </span>
              <div style={{ fontSize: 10, color: token.colorTextTertiary }}>
                enviado {formatDate(doc.createdAt)}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: token.colorTextSecondary }}>
              {formatDate(doc.createdAt)}
            </span>
          );
        },
      },
      {
        title: "Tamanho",
        dataIndex: "fileSize",
        width: 96,
        align: "right",
        search: false,
        sorter: (a, b) => a.fileSize - b.fileSize,
        render: (_, doc) => (
          <span
            style={{
              fontFamily: "var(--font-sync-mono)",
              fontSize: 11,
              color: token.colorTextSecondary,
            }}
          >
            {formatFileSize(doc.fileSize)}
          </span>
        ),
      },
      {
        title: "",
        width: 76,
        align: "right",
        search: false,
        render: (_, doc) => {
          const deleting =
            deleteMutation.isPending && deleteMutation.variables?.id === doc.id;
          return (
            <Space size={4}>
              <Tooltip title="Baixar documento">
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  href={doc.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                />
              </Tooltip>
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    {
                      key: "abrir",
                      label: "Abrir arquivo",
                      icon: <DownloadOutlined />,
                    },
                    {
                      key: "excluir",
                      label: "Excluir do acervo",
                      icon: <DeleteOutlined />,
                      danger: true,
                    },
                  ],
                  onClick: ({ key }) => {
                    if (key === "abrir") {
                      window.open(doc.downloadUrl, "_blank", "noreferrer");
                    }
                    if (key === "excluir") confirmDelete(doc);
                  },
                }}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<MoreOutlined />}
                  loading={deleting}
                />
              </Dropdown>
            </Space>
          );
        },
      },
    ],
    [cityValueEnum, categoryValueEnum, token, deleteMutation, confirmDelete],
  );

  /** A busca embutida do ProTable filtra `documents` localmente — a coleção já
   * está inteira em memória via `useQuery`, então não há por que ir ao
   * Firestore de novo a cada tecla. */
  const requestDocuments = useCallback(
    async (params: DocumentSearchParams) => {
      const term = (params.keyword ?? "").trim().toLocaleLowerCase("pt-BR");
      const filtered = documents.filter((document) => {
        if (params.cityId && document.cityId !== params.cityId) return false;
        if (params.category && document.category !== params.category) {
          return false;
        }
        if (!term) return true;
        const haystack =
          `${document.title} ${document.fileName} ${document.cityName} ${document.cityUf} ${document.contractNumber ?? ""}`.toLocaleLowerCase(
            "pt-BR",
          );
        return haystack.includes(term);
      });
      return { data: filtered, success: true, total: filtered.length };
    },
    [documents],
  );

  return (
    <Flex vertical gap={14}>
      {modalContextHolder}

      <Flex align="center" justify="space-between" wrap="wrap" gap={12}>
        <div>
          <Space align="center" size={8}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Documentos
            </Typography.Title>
            <Tag>
              {metrics.total} {metrics.total === 1 ? "arquivo" : "arquivos"}
            </Tag>
          </Space>
          <div>
            <Typography.Text type="secondary">
              Acervo municipal, contratos e modelos gerados em um só lugar.
            </Typography.Text>
          </div>
        </div>
      </Flex>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as WorkspaceTab)}
        tabBarExtraContent={
          activeTab === "acervo" ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setUploadOpen(true)}
            >
              Anexar documento
            </Button>
          ) : null
        }
        items={[
          {
            key: "acervo",
            label: (
              <span>
                <FolderOpenOutlined /> Acervo
              </span>
            ),
            children: (
              <Flex vertical gap={14}>
                <ProCard gutter={12} wrap ghost>
                  <ProCard
                    colSpan={{ xs: 12, lg: 6 }}
                    style={{ border: `1px solid ${token.colorBorderSecondary}` }}
                  >
                    <Statistic
                      title={
                        <Space size={6}>
                          <FolderOpenOutlined style={{ color: token.colorInfoText }} />
                          Documentos
                        </Space>
                      }
                      value={metrics.total}
                      styles={{ content: {
                        fontFamily: "var(--font-sync-mono)",
                        fontWeight: 700,
                      } }}
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      no acervo
                    </Typography.Text>
                  </ProCard>
                  <ProCard
                    colSpan={{ xs: 12, lg: 6 }}
                    style={{ border: `1px solid ${token.colorBorderSecondary}` }}
                  >
                    <Statistic
                      title={
                        <Space size={6}>
                          <SafetyCertificateOutlined
                            style={{ color: token.colorSuccessText }}
                          />
                          Municípios
                        </Space>
                      }
                      value={metrics.cities}
                      styles={{ content: {
                        fontFamily: "var(--font-sync-mono)",
                        fontWeight: 700,
                      } }}
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      de {cities.length} na carteira
                    </Typography.Text>
                  </ProCard>
                  <ProCard
                    colSpan={{ xs: 12, lg: 6 }}
                    style={{ border: `1px solid ${token.colorBorderSecondary}` }}
                  >
                    <Statistic
                      title={
                        <Space size={6}>
                          <FileTextOutlined style={{ color: token.colorTextSecondary }} />
                          Contratos
                        </Space>
                      }
                      value={metrics.contracts}
                      styles={{ content: {
                        fontFamily: "var(--font-sync-mono)",
                        fontWeight: 700,
                      } }}
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      anexados e gerados
                    </Typography.Text>
                  </ProCard>
                  <ProCard
                    colSpan={{ xs: 12, lg: 6 }}
                    style={{ border: `1px solid ${token.colorBorderSecondary}` }}
                  >
                    <Statistic
                      title={
                        <Space size={6}>
                          <ClockCircleOutlined style={{ color: token.colorWarningText }} />
                          A vencer
                        </Space>
                      }
                      value={metrics.expiring}
                      styles={{ content: {
                        fontFamily: "var(--font-sync-mono)",
                        fontWeight: 700,
                        color:
                          metrics.expiring > 0 ? token.colorWarningText : token.colorText,
                      } }}
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      nos próximos 90 dias
                    </Typography.Text>
                  </ProCard>
                </ProCard>

                {documentsError ? (
                  <Result
                    status="warning"
                    title="Não foi possível carregar o acervo"
                    subTitle="Verifique a conexão e tente novamente."
                    extra={
                      <Button type="primary" onClick={() => refetchDocuments()}>
                        Tentar novamente
                      </Button>
                    }
                  />
                ) : (
                  <ProTable<CityDocument, DocumentSearchParams>
                    headerTitle="Acervo"
                    rowKey="id"
                    size="small"
                    cardBordered
                    loading={loading}
                    columns={columns}
                    actionRef={actionRef}
                    formRef={formRef}
                    request={requestDocuments}
                    params={{ total: documents.length, cidades: cities.length }}
                    pagination={false}
                    scroll={{ x: 960 }}
                    search={{ labelWidth: "auto" }}
                    options={{ density: false, fullScreen: false, reload: false }}
                    dateFormatter="string"
                    locale={{
                      emptyText: (
                        <EmptyLibrary
                          hasFilters={documents.length > 0}
                          onUpload={() => setUploadOpen(true)}
                          onClearFilters={() => {
                            formRef.current?.resetFields();
                            actionRef.current?.reload();
                          }}
                        />
                      ),
                    }}
                  />
                )}
              </Flex>
            ),
          },
          {
            key: "gerar",
            label: (
              <span>
                <ThunderboltOutlined /> Gerar contrato
              </span>
            ),
            children: (
              <ContractGenerator
                cities={cities}
                onArchive={archiveGeneratedContract}
              />
            ),
          },
        ]}
      />

      {uploadOpen && (
        <DocumentUploadDialog
          open
          cities={cities}
          uploading={uploadMutation.isPending}
          onClose={() => {
            if (!uploadMutation.isPending) setUploadOpen(false);
          }}
          onSubmit={handleUpload}
        />
      )}
    </Flex>
  );
}

function EmptyLibrary({
  hasFilters,
  onUpload,
  onClearFilters,
}: {
  hasFilters: boolean;
  onUpload: () => void;
  onClearFilters: () => void;
}) {
  return (
    <Empty
      style={{ padding: "48px 0" }}
      description={
        hasFilters
          ? "Nenhum documento corresponde aos filtros"
          : "Seu acervo municipal começa aqui — anexe contratos, propostas, pareceres e outros arquivos."
      }
    >
      <Button
        type={hasFilters ? "default" : "primary"}
        icon={hasFilters ? <FilterOutlined /> : <UploadOutlined />}
        onClick={hasFilters ? onClearFilters : onUpload}
      >
        {hasFilters ? "Limpar filtros" : "Anexar primeiro documento"}
      </Button>
    </Empty>
  );
}

function renderFileIcon(fileName: string, color: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const style = { fontSize: 16, color };
  if (extension === "zip") return <FileZipOutlined style={style} />;
  if (extension === "xls" || extension === "xlsx") {
    return <FileExcelOutlined style={style} />;
  }
  if (extension === "pdf" || extension === "doc" || extension === "docx") {
    return <FileTextOutlined style={style} />;
  }
  return <FileOutlined style={style} />;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date =
    value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(".", "");
}
