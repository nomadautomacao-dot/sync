"use client";

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircleFilled,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  InboxOutlined,
  PaperClipOutlined,
  WarningFilled,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Result,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  Upload,
  theme,
} from "antd";
import type { UploadFile } from "antd";

import {
  CATEGORIAS_HABILITACAO,
  SITUACAO_LABELS,
  categoriaPorKey,
  diasParaVencer,
  resumoDaHabilitacao,
  situacaoDoDocumento,
  type CategoriaHabilitacao,
  type DocumentoDaHabilitacao,
  type SituacaoDoDocumento,
} from "@/core/domain/habilitacao";
import { getFirebaseDb, getFirebaseStorage } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import { formatFileSize } from "@/modules/documentos/documentos-firestore";
import {
  atualizarDocumentoDaHabilitacao,
  excluirDocumentoDaHabilitacao,
  listDocumentosDaHabilitacao,
  uploadDocumentoDaHabilitacao,
} from "@/modules/documentos/habilitacao-firestore";

const { Text, Title } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

/**
 * A habilitação da Global: os documentos da empresa que entram em todo kit.
 *
 * A tela é organizada por categoria, e não por lista corrida, porque a
 * pergunta que ela responde é "o que falta para montar o kit?" — que se
 * responde por pasta vazia, não por arquivo. A validade é o segundo eixo:
 * certidão vencida dentro de processo administrativo é inabilitação, e quem
 * descobre é o pregoeiro.
 */
export function Habilitacao() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const [anexarEm, setAnexarEm] = useState<CategoriaHabilitacao | null>(null);
  const [editando, setEditando] = useState<DocumentoDaHabilitacao | null>(null);

  const {
    data: documentos = [],
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["empresa-documentos", user?.groupId],
    queryFn: () => listDocumentosDaHabilitacao(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });

  /* Um "agora" só por carga, compartilhado pelo resumo e pelas linhas: dois
     relógios fariam o cabeçalho dizer "1 vencido" e a linha correspondente
     aparecer válida, na virada da meia-noite. */
  const { agora, resumo, porCategoria } = useMemo(() => {
    const instante = new Date();
    const mapa = new Map<CategoriaHabilitacao, DocumentoDaHabilitacao[]>();
    for (const categoria of CATEGORIAS_HABILITACAO) mapa.set(categoria.key, []);
    for (const documento of documentos) {
      mapa.get(documento.categoria)?.push(documento);
    }
    return {
      agora: instante,
      resumo: resumoDaHabilitacao(documentos, instante),
      porCategoria: mapa,
    };
  }, [documentos]);

  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: ["empresa-documentos"] });

  const excluir = useMutation({
    mutationFn: (documento: DocumentoDaHabilitacao) =>
      excluirDocumentoDaHabilitacao(getFirebaseDb(), getFirebaseStorage(), documento),
    onSuccess: () => {
      invalidar();
      message.success("Documento removido da habilitação.");
    },
    onError: (erro) =>
      message.error(erro instanceof Error ? erro.message : "Falha ao remover."),
  });

  if (isError) {
    return (
      <Result
        status="warning"
        title="Não foi possível carregar a habilitação"
        subTitle="Verifique a conexão e tente novamente."
        extra={
          <Button type="primary" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  if (isPending) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }

  return (
    <Flex vertical gap={14}>
      <Card>
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={16}>
          <div>
            <Title level={5} style={{ margin: 0 }}>
              Habilitação da Global Company
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Os documentos da empresa que entram em todo kit de inexigibilidade.
              O que estiver aqui é anexado ao processo na hora de gerar — e a
              validade avisa quando é hora de trocar.
            </Text>
          </div>
          <Space size="large" wrap>
            <Statistic
              title="documentos"
              value={resumo.total}
              styles={{ content: { fontSize: 18, fontFamily: FONTE_MONO } }}
            />
            <Statistic
              title="vencidos"
              value={resumo.vencidos}
              styles={{
                content: {
                  fontSize: 18,
                  fontFamily: FONTE_MONO,
                  color: resumo.vencidos ? token.colorError : token.colorTextQuaternary,
                },
              }}
            />
            <Statistic
              title="vencendo em 30 dias"
              value={resumo.vencendo}
              styles={{
                content: {
                  fontSize: 18,
                  fontFamily: FONTE_MONO,
                  color: resumo.vencendo ? token.colorWarningText : token.colorTextQuaternary,
                },
              }}
            />
          </Space>
        </Flex>
      </Card>

      {resumo.vencidos > 0 && (
        <Alert
          type="error"
          showIcon
          title={`${resumo.vencidos} documento(s) vencido(s)`}
          description="Substitua antes de montar o próximo kit: documento vencido dentro do processo é motivo de inabilitação, e quem percebe é o setor de licitação da prefeitura."
        />
      )}
      {resumo.categoriasFaltando.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title="A habilitação ainda está incompleta"
          description={`Falta anexar: ${resumo.categoriasFaltando
            .map((categoria) => categoria.nome)
            .join(", ")}.`}
        />
      )}
      {resumo.pronta && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleFilled />}
          title="Habilitação pronta para montar o kit"
          description="Todas as categorias essenciais estão preenchidas e nenhum documento está vencido."
        />
      )}

      <Row gutter={[14, 14]}>
        {CATEGORIAS_HABILITACAO.map((categoria) => {
          const daCategoria = porCategoria.get(categoria.key) ?? [];
          return (
            <Col key={categoria.key} xs={24} xl={12}>
              <Card
                size="small"
                title={
                  <Space size={8}>
                    <Text style={{ fontFamily: FONTE_MONO, color: token.colorTextTertiary }}>
                      {categoria.ordem}
                    </Text>
                    <Text strong>{categoria.nome}</Text>
                    {categoria.essencial && daCategoria.length === 0 && (
                      <Tag color="warning">falta</Tag>
                    )}
                  </Space>
                }
                extra={
                  <Button
                    size="small"
                    icon={<PaperClipOutlined />}
                    onClick={() => setAnexarEm(categoria.key)}
                  >
                    Anexar
                  </Button>
                }
                style={{ height: "100%" }}
              >
                <Text type="secondary" style={{ fontSize: 11.5 }}>
                  {categoria.descricao}
                </Text>

                <div style={{ marginTop: 12 }}>
                  {daCategoria.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Nada anexado ainda.
                        </Text>
                      }
                      style={{ margin: "8px 0" }}
                    />
                  ) : (
                    <Flex vertical gap={8}>
                      {daCategoria.map((documento) => (
                        <LinhaDoDocumento
                          key={documento.id}
                          documento={documento}
                          agora={agora}
                          onEditar={() => setEditando(documento)}
                          onExcluir={() => excluir.mutate(documento)}
                        />
                      ))}
                    </Flex>
                  )}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {anexarEm && (
        <AnexarDialog
          categoria={anexarEm}
          onClose={() => setAnexarEm(null)}
          onEnviado={invalidar}
        />
      )}

      {editando && (
        <EditarDialog
          documento={editando}
          onClose={() => setEditando(null)}
          onSalvo={invalidar}
        />
      )}
    </Flex>
  );
}

function LinhaDoDocumento({
  documento,
  agora,
  onEditar,
  onExcluir,
}: {
  documento: DocumentoDaHabilitacao;
  agora: Date;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const { token } = theme.useToken();
  const situacao = situacaoDoDocumento(documento, agora);
  const dias = diasParaVencer(documento, agora);

  return (
    <Flex justify="space-between" align="center" gap={8} wrap="wrap">
      <Flex vertical gap={0} style={{ minWidth: 0, flex: 1 }}>
        <Space size={6} wrap>
          <Text strong style={{ fontSize: 12 }}>
            {documento.titulo}
          </Text>
          <SeloDeSituacao situacao={situacao} dias={dias} />
        </Space>
        <Text
          type="secondary"
          style={{ fontSize: 10.5, fontFamily: FONTE_MONO }}
          ellipsis
        >
          {documento.fileName} · {formatFileSize(documento.fileSize)}
          {documento.validade ? ` · validade ${formatarData(documento.validade)}` : ""}
        </Text>
        {documento.observacao && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {documento.observacao}
          </Text>
        )}
      </Flex>
      <Space size={2}>
        <Button
          size="small"
          type="text"
          icon={<DownloadOutlined />}
          href={documento.downloadUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Baixar ${documento.titulo}`}
          title="Baixar"
        />
        <Button
          size="small"
          type="text"
          icon={<EditOutlined />}
          onClick={onEditar}
          aria-label={`Editar ${documento.titulo}`}
          title="Editar validade e rótulo"
        />
        <Popconfirm
          title="Remover este documento?"
          description="O arquivo sai da habilitação e deixa de entrar nos próximos kits."
          okText="Remover"
          okButtonProps={{ danger: true }}
          cancelText="Cancelar"
          onConfirm={onExcluir}
        >
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            aria-label={`Remover ${documento.titulo}`}
            title="Remover"
            style={{ color: token.colorErrorText }}
          />
        </Popconfirm>
      </Space>
    </Flex>
  );
}

function SeloDeSituacao({
  situacao,
  dias,
}: {
  situacao: SituacaoDoDocumento;
  dias: number | null;
}) {
  if (situacao === "sem_validade") return null;
  if (situacao === "vencido") {
    return (
      <Tooltip title={`Venceu há ${Math.abs(dias ?? 0)} dias`}>
        <Tag icon={<ExclamationCircleFilled />} color="error">
          {SITUACAO_LABELS.vencido}
        </Tag>
      </Tooltip>
    );
  }
  if (situacao === "vence_em_breve") {
    return (
      <Tag icon={<WarningFilled />} color="warning">
        {dias === 0 ? "vence hoje" : `vence em ${dias} dias`}
      </Tag>
    );
  }
  return <Tag color="success">{SITUACAO_LABELS.valido}</Tag>;
}

interface CamposDeAnexo {
  titulo: string;
  categoria: CategoriaHabilitacao;
  validade?: dayjs.Dayjs;
  observacao?: string;
}

function AnexarDialog({
  categoria,
  onClose,
  onEnviado,
}: {
  categoria: CategoriaHabilitacao;
  onClose: () => void;
  onEnviado: () => void;
}) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [form] = Form.useForm<CamposDeAnexo>();
  const [arquivos, setArquivos] = useState<UploadFile[]>([]);

  const categoriaEscolhida = Form.useWatch("categoria", form) ?? categoria;
  const exigeValidade = categoriaPorKey(categoriaEscolhida).exigeValidade;

  const enviar = useMutation({
    mutationFn: async (campos: CamposDeAnexo) => {
      const arquivo = arquivos[0]?.originFileObj;
      if (!arquivo) throw new Error("Escolha o arquivo antes de salvar.");
      await uploadDocumentoDaHabilitacao(
        getFirebaseDb(),
        getFirebaseStorage(),
        arquivo,
        {
          groupId: user!.groupId,
          categoria: campos.categoria,
          titulo: campos.titulo,
          validade: campos.validade?.format("YYYY-MM-DD"),
          observacao: campos.observacao,
          criadoPor: user!.id,
          criadoPorNome: user!.name,
        },
      );
    },
    onSuccess: () => {
      onEnviado();
      message.success("Documento anexado à habilitação.");
      onClose();
    },
    onError: (erro) =>
      message.error(erro instanceof Error ? erro.message : "Falha ao anexar."),
  });

  return (
    <Modal
      open
      centered
      width={480}
      title="Anexar documento da empresa"
      okText={enviar.isPending ? "Enviando…" : "Anexar"}
      cancelText="Cancelar"
      confirmLoading={enviar.isPending}
      onOk={() => form.submit()}
      onCancel={() => {
        if (!enviar.isPending) onClose();
      }}
      destroyOnHidden
    >
      <Form<CamposDeAnexo>
        form={form}
        layout="vertical"
        onFinish={(campos) => enviar.mutate(campos)}
        initialValues={{ categoria }}
        style={{ marginTop: 12 }}
      >
        <Form.Item label="Categoria" name="categoria">
          <Select
            options={CATEGORIAS_HABILITACAO.map((c) => ({
              value: c.key,
              label: `${c.ordem} · ${c.nome}`,
            }))}
          />
        </Form.Item>

        <Form.Item
          label="Nome do documento"
          name="titulo"
          rules={[{ required: true, message: "Diga o que é este documento." }]}
        >
          <Input placeholder="Ex: CND Federal — tributos e dívida ativa" autoFocus />
        </Form.Item>

        <Form.Item
          label={exigeValidade ? "Válida até" : "Válido até (opcional)"}
          name="validade"
          rules={
            exigeValidade
              ? [
                  {
                    required: true,
                    /* Certidão sem data é o problema guardado em vez do
                       documento: ninguém saberia quando trocar. */
                    message: "Certidões e consultas precisam da data de validade.",
                  },
                ]
              : undefined
          }
        >
          <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item label="Arquivo" required>
          <Upload.Dragger
            beforeUpload={() => false}
            maxCount={1}
            fileList={arquivos}
            onChange={({ fileList }) => setArquivos(fileList)}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Clique ou arraste o arquivo</p>
            <p className="ant-upload-hint">PDF, DOCX, XLSX, imagem ou ZIP — até 20 MB.</p>
          </Upload.Dragger>
        </Form.Item>

        <Form.Item label="Observação (opcional)" name="observacao">
          <Input placeholder="Ex: emitida pelo portal da Receita em 14/08" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function EditarDialog({
  documento,
  onClose,
  onSalvo,
}: {
  documento: DocumentoDaHabilitacao;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{
    titulo: string;
    validade?: dayjs.Dayjs;
    observacao?: string;
  }>();

  const salvar = useMutation({
    mutationFn: (campos: { titulo: string; validade?: dayjs.Dayjs; observacao?: string }) =>
      atualizarDocumentoDaHabilitacao(getFirebaseDb(), documento.id, {
        titulo: campos.titulo,
        validade: campos.validade ? campos.validade.format("YYYY-MM-DD") : null,
        observacao: campos.observacao ?? null,
      }),
    onSuccess: () => {
      onSalvo();
      message.success("Documento atualizado.");
      onClose();
    },
    onError: (erro) =>
      message.error(erro instanceof Error ? erro.message : "Falha ao salvar."),
  });

  return (
    <Modal
      open
      centered
      width={440}
      title="Editar documento"
      okText={salvar.isPending ? "Salvando…" : "Salvar"}
      cancelText="Cancelar"
      confirmLoading={salvar.isPending}
      onOk={() => form.submit()}
      onCancel={() => {
        if (!salvar.isPending) onClose();
      }}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(campos) => salvar.mutate(campos)}
        initialValues={{
          titulo: documento.titulo,
          validade: documento.validade ? dayjs(documento.validade) : undefined,
          observacao: documento.observacao,
        }}
        style={{ marginTop: 12 }}
      >
        <Form.Item
          label="Nome do documento"
          name="titulo"
          rules={[{ required: true, message: "Diga o que é este documento." }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Válido até"
          name="validade"
          extra={
            <Text type="secondary" style={{ fontSize: 11.5 }}>
              Renovou a certidão e o arquivo é o mesmo? Basta atualizar a data.
              Se o arquivo mudou, anexe o novo e remova este.
            </Text>
          }
        >
          <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} allowClear />
        </Form.Item>
        <Form.Item label="Observação" name="observacao">
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : "—";
}
