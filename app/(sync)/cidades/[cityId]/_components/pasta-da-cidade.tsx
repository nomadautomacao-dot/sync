"use client";

import { useMemo, useState } from "react";
import {
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileOutlined,
  HistoryOutlined,
  MoreOutlined,
  PaperClipOutlined,
  RobotOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Dropdown,
  Empty,
  Flex,
  Input,
  Modal,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  Upload,
  theme,
} from "antd";

import {
  baixarArquivo,
  extensaoDoArquivo,
  VisualizadorDeArquivo,
} from "@/core/components/visualizador-de-arquivo";
import type { IniciativaDaCidade } from "@/core/domain/cidade-iniciativas";
import {
  historicoDoDocumento,
  temHistorico,
  versaoAtual,
} from "@/core/domain/documento-versoes";
import { podeApagarDefinitivamente } from "@/core/domain/rbac";
import { getFirebaseDb, getFirebaseStorage } from "@/core/lib/firebase-client";
import {
  deleteCityDocument,
  formatFileSize,
  substituirArquivoDoDocumento,
} from "@/modules/documentos/documentos-firestore";
import type { CityDocument } from "@/modules/documentos/types";
import { useAuth } from "@/core/providers/auth-provider";

const { Text } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";


function formatarData(valor?: string): string {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(data)
    .replace(".", "");
}

/**
 * A pasta da cidade: tudo que existe deste município, com a origem à vista e o
 * histórico de cada arquivo por baixo.
 *
 * ## Fora da barra de abas
 *
 * Ela não é um lugar por onde se trabalha — é o arquivo. Vive atrás do menu de
 * três pontos e abre em gaveta, para ser consultada de dentro de qualquer aba e
 * fechada sem perder o que estava aberto.
 *
 * ## Origem é o que a torna pasta, e não lista
 *
 * O mesmo arquivo anexado dentro da capacitação aparece aqui dizendo que é da
 * capacitação. Sem isso, quem abre vê trinta nomes de arquivo e nenhuma pista
 * de a que cada um pertence — e o vínculo dependeria de alguém ter nomeado o
 * arquivo direito.
 *
 * ## Substituir não apaga
 *
 * Trocar o arquivo guarda o anterior, com a URL viva, e a linha ganha o número
 * da versão. Quem quiser a v1 de dezembro a baixa em março. É o oposto de
 * apagar, e por isso substituir está aberto à equipe enquanto apagar é só da
 * dona.
 */
export function PastaDaCidade({
  cityName,
  documents,
  pending,
  iniciativas,
  onUpload,
}: {
  cityName: string;
  documents: CityDocument[];
  pending: boolean;
  iniciativas: IniciativaDaCidade[];
  onUpload: () => void;
}) {
  const { message, modal } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();

  const [aberto, setAberto] = useState<CityDocument | null>(null);
  const [substituindo, setSubstituindo] = useState<CityDocument | null>(null);

  const apagaDefinitivamente = podeApagarDefinitivamente(user?.groupRole);
  const nomeDaIniciativa = useMemo(
    () => new Map(iniciativas.map((i) => [i.id, i.nome])),
    [iniciativas],
  );

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["city-documents"] });
  };

  const substituir = useMutation({
    mutationFn: ({
      documento,
      arquivo,
      nota,
    }: {
      documento: CityDocument;
      arquivo: File;
      nota?: string;
    }) =>
      substituirArquivoDoDocumento(
        getFirebaseDb(),
        getFirebaseStorage(),
        arquivo,
        documento,
        { uid: user!.id, nome: user!.name, groupId: user!.groupId },
        nota,
      ),
    onSuccess: () => {
      invalidar();
      setSubstituindo(null);
      message.success("Nova versão guardada. A anterior continua na pasta.");
    },
    onError: (erro) =>
      message.error(erro instanceof Error ? erro.message : "Não foi possível substituir."),
  });

  const apagar = useMutation({
    mutationFn: (documento: CityDocument) =>
      deleteCityDocument(getFirebaseDb(), getFirebaseStorage(), documento),
    onSuccess: () => {
      invalidar();
      message.success("Documento excluído.");
    },
    onError: (erro) =>
      message.error(erro instanceof Error ? erro.message : "Não foi possível excluir."),
  });

  const confirmarExclusao = (documento: CityDocument) => {
    const versoes = versaoAtual(documento);
    modal.confirm({
      title: `Excluir "${documento.title}"?`,
      okText: "Excluir",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      content: (
        <Text>
          {versoes > 1
            ? `As ${versoes} versões deste documento saem junto. `
            : "O arquivo sai do armazenamento. "}
          Não há lixeira e não dá para desfazer.
        </Text>
      ),
      onOk: () => apagar.mutateAsync(documento),
    });
  };

  const colunas: ProColumns<CityDocument>[] = [
    {
      title: "Documento",
      dataIndex: "title",
      sorter: (a, b) => a.title.localeCompare(b.title, "pt-BR"),
      render: (_, documento) => (
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
            {documento.source === "generated" ? (
              <RobotOutlined style={{ color: token.colorPrimary }} />
            ) : (
              <FileOutlined style={{ color: token.colorTextSecondary }} />
            )}
          </Flex>
          <div style={{ minWidth: 0 }}>
            <Space size={6}>
              {/* O nome é o alvo de clique: abrir é o que a pessoa quer
                  fazer com um documento, e caçar um ícone de olho para isso
                  transforma o gesto óbvio no gesto escondido. */}
              <Typography.Link
                onClick={() => setAberto(documento)}
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                {documento.title}
              </Typography.Link>
              {/* A extensão à vista: o título é escrito por quem sobe o
                  arquivo, e "Certificado da capacitação" não diz se o que está
                  lá dentro é DOCX ou ZIP. */}
              {extensaoDoArquivo(documento.fileName) && (
                <Tag
                  style={{
                    fontFamily: FONTE_MONO,
                    fontSize: 9.5,
                    marginInlineEnd: 0,
                    lineHeight: "16px",
                  }}
                >
                  {extensaoDoArquivo(documento.fileName)}
                </Tag>
              )}
              {temHistorico(documento) && (
                <Tooltip
                  title={`${versaoAtual(documento)} versões — as anteriores continuam guardadas`}
                >
                  <Tag
                    color="gold"
                    style={{ fontFamily: FONTE_MONO, fontSize: 10, marginInlineEnd: 0 }}
                  >
                    v{versaoAtual(documento)}
                  </Tag>
                </Tooltip>
              )}
            </Space>
            <Text
              type="secondary"
              style={{ fontFamily: FONTE_MONO, fontSize: 9, display: "block" }}
            >
              {documento.fileName} · {formatFileSize(documento.fileSize)} ·{" "}
              {formatarData(documento.createdAt)}
            </Text>
          </div>
        </Flex>
      ),
    },
    {
      title: "Categoria",
      dataIndex: "category",
      width: 150,
      sorter: (a, b) => a.category.localeCompare(b.category, "pt-BR"),
      render: (_, documento) => <Tag>{documento.category.replaceAll("_", " ")}</Tag>,
    },
    {
      title: "Origem",
      key: "origem",
      width: 190,
      render: (_, documento) => {
        const projeto = documento.iniciativaId
          ? nomeDaIniciativa.get(documento.iniciativaId)
          : undefined;
        if (projeto) return <Tag color="processing">{projeto}</Tag>;
        /* Projeto fora da vista não deixa o arquivo órfão: ele continua na
           pasta dizendo que pertence a um projeto — só não a qual. Sumir é
           pior que impreciso num arquivo que sustenta processo. */
        if (documento.iniciativaId) return <Tag color="processing">Projeto</Tag>;
        if (documento.relatorioTitulo) return <Tag>Análise · {documento.relatorioTitulo}</Tag>;
        if (documento.source === "generated") return <Tag color="purple">Emitido</Tag>;
        return (
          <Text type="secondary" style={{ fontSize: 11 }}>
            Avulso
          </Text>
        );
      },
    },
    {
      title: "",
      key: "acoes",
      width: 130,
      align: "right",
      render: (_, documento) => (
        <Space size={2}>
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => setAberto(documento)}
            title="Abrir aqui"
            aria-label={`Abrir ${documento.title}`}
          />
          <Button
            size="small"
            type="text"
            icon={<DownloadOutlined />}
            onClick={() => baixarArquivo(documento.downloadUrl, documento.fileName)}
            title="Baixar"
            aria-label={`Baixar ${documento.title}`}
          />
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                {
                  key: "substituir",
                  icon: <SwapOutlined />,
                  label: "Substituir arquivo",
                },
                ...(apagaDefinitivamente
                  ? [
                      { type: "divider" as const },
                      {
                        key: "excluir",
                        icon: <DeleteOutlined />,
                        label: "Excluir",
                        danger: true,
                      },
                    ]
                  : []),
              ],
              onClick: ({ key }) => {
                if (key === "substituir") setSubstituindo(documento);
                if (key === "excluir") confirmarExclusao(documento);
              },
            }}
          >
            <Button size="small" type="text" icon={<MoreOutlined />} aria-label="Mais ações" />
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <Text type="secondary" style={{ fontSize: 11, maxWidth: 480 }}>
          Contratos, relatórios emitidos, ofícios e tudo que a equipe anexou — inclusive o que
          entrou por dentro de um projeto. Substituir um arquivo guarda o anterior.
        </Text>
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
            columns={colunas}
            expandable={{
              /* Só quem tem histórico expande. Uma seta em toda linha
                 prometeria conteúdo que não existe na maioria delas. */
              rowExpandable: (documento) => temHistorico(documento),
              expandedRowRender: (documento) => (
                <HistoricoDoDocumento documento={documento} />
              ),
            }}
          />
        ) : (
          <Empty
            description={`Nenhum documento em ${cityName} ainda.`}
            style={{ padding: "50px 0" }}
          >
            <Button type="primary" icon={<PaperClipOutlined />} onClick={onUpload}>
              Anexar o primeiro
            </Button>
          </Empty>
        )}
      </div>

      {aberto && (
        <VisualizadorDeArquivo
          url={aberto.downloadUrl}
          titulo={aberto.title}
          nomeArquivo={aberto.fileName}
          mimeType={aberto.mimeType}
          detalhe={`${aberto.cityName} · ${aberto.fileName} · ${formatFileSize(aberto.fileSize)}`}
          onFechar={() => setAberto(null)}
        />
      )}

      {substituindo && (
        <SubstituirArquivoDialog
          documento={substituindo}
          salvando={substituir.isPending}
          aoFechar={() => setSubstituindo(null)}
          aoEnviar={(arquivo, nota) =>
            substituir.mutateAsync({ documento: substituindo, arquivo, nota })
          }
        />
      )}
    </>
  );
}

/**
 * As versões anteriores, com a URL viva de cada uma.
 *
 * A versão vigente aparece aqui também, marcada — sem ela a lista começaria na
 * v2 e quem lê teria de deduzir qual é a atual.
 */
function HistoricoDoDocumento({ documento }: { documento: CityDocument }) {
  const { token } = theme.useToken();
  const versoes = historicoDoDocumento(documento);

  return (
    <Flex vertical gap={8} style={{ paddingBlock: 4 }}>
      <Space size={6}>
        <HistoryOutlined style={{ color: token.colorTextTertiary }} />
        <Text type="secondary" style={{ fontSize: 11 }}>
          Nada se perde: cada versão continua baixável.
        </Text>
      </Space>
      {versoes.map((versao) => (
        <Flex
          key={versao.storagePath}
          justify="space-between"
          align="center"
          gap={12}
          style={{
            padding: "6px 10px",
            borderRadius: token.borderRadius,
            background: token.colorFillQuaternary,
          }}
        >
          <Space size={8} style={{ minWidth: 0 }}>
            <Tag
              color={versao.versao === versaoAtual(documento) ? "gold" : "default"}
              style={{ fontFamily: FONTE_MONO, fontSize: 10, marginInlineEnd: 0 }}
            >
              v{versao.versao}
            </Tag>
            <div style={{ minWidth: 0 }}>
              <Space size={6}>
                <Text style={{ fontSize: 12 }}>{versao.fileName}</Text>
                {extensaoDoArquivo(versao.fileName) && (
                  <Tag style={{ fontFamily: FONTE_MONO, fontSize: 9, marginInlineEnd: 0 }}>
                    {extensaoDoArquivo(versao.fileName)}
                  </Tag>
                )}
              </Space>
              <Text
                type="secondary"
                style={{ fontFamily: FONTE_MONO, fontSize: 9, display: "block" }}
              >
                {formatarData(versao.criadoEm)} · {versao.autorNome} ·{" "}
                {formatFileSize(versao.fileSize)}
                {versao.nota ? ` · ${versao.nota}` : ""}
              </Text>
            </div>
          </Space>
          <Button
            size="small"
            type="text"
            icon={<DownloadOutlined />}
            onClick={() => baixarArquivo(versao.downloadUrl, versao.fileName)}
            aria-label={`Baixar versão ${versao.versao}`}
          />
        </Flex>
      ))}
    </Flex>
  );
}

/**
 * Troca o arquivo mantendo o documento.
 *
 * O diálogo diz, com todas as letras, que a versão atual não some — porque
 * "substituir" em quase todo software significa perder o anterior, e a pessoa
 * hesita na hora de clicar se não souber que aqui não é assim.
 */
function SubstituirArquivoDialog({
  documento,
  salvando,
  aoFechar,
  aoEnviar,
}: {
  documento: CityDocument;
  salvando: boolean;
  aoFechar: () => void;
  aoEnviar: (arquivo: File, nota?: string) => Promise<void>;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nota, setNota] = useState("");

  return (
    <Modal
      open
      title={`Substituir arquivo de "${documento.title}"`}
      okText="Guardar nova versão"
      cancelText="Cancelar"
      okButtonProps={{ disabled: !arquivo }}
      confirmLoading={salvando}
      onCancel={salvando ? undefined : aoFechar}
      onOk={async () => {
        if (arquivo) await aoEnviar(arquivo, nota.trim() || undefined);
      }}
      destroyOnHidden
      centered
    >
      <Flex vertical gap={14} style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          A versão <b>v{versaoAtual(documento)}</b> ({documento.fileName}) continua guardada e
          baixável. O documento passa a apontar para o arquivo novo.
        </Text>

        <Upload.Dragger
          maxCount={1}
          beforeUpload={(file) => {
            setArquivo(file);
            return false;
          }}
          onRemove={() => setArquivo(null)}
        >
          {/* Sem o `ant-upload-drag-icon`: o ícone grande do padrão empurra o
              diálogo além da altura de um notebook, e aqui ele não informa
              nada que o texto já não diga. */}
          <p className="ant-upload-text" style={{ fontSize: 13 }}>
            Arraste o arquivo novo, ou clique para escolher
          </p>
          <p className="ant-upload-hint" style={{ fontSize: 11 }}>
            PDF, DOCX, XLSX, imagem ou ZIP — até 20 MB.
          </p>
        </Upload.Dragger>

        <div>
          <Text style={{ fontSize: 12 }}>Por que está trocando? (opcional)</Text>
          <Input
            value={nota}
            onChange={(evento) => setNota(evento.target.value)}
            placeholder="Ex.: nome do formador estava errado"
            maxLength={140}
            style={{ marginTop: 4 }}
          />
        </div>
      </Flex>
    </Modal>
  );
}
