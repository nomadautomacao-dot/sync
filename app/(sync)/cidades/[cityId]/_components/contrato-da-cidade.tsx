"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DownloadOutlined,
  FileDoneOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Result,
  Segmented,
  Skeleton,
  Space,
  Tag,
  Typography,
  theme,
} from "antd";

import {
  ESTADO_DO_CONTRATO_LABELS,
  diasParaVencer,
  valorGlobalCents,
  type ContratoDaCidade,
  type EstadoDoContrato,
} from "@/core/domain/contrato-cidade";
import {
  VIAS_DE_CONTRATACAO,
  avisoDeLimite,
  fundamentoPadrao,
  type ViaDeContratacao,
} from "@/core/domain/contratacao-direta";
import { podeEditar } from "@/core/domain/rbac";
import { withAuthHeader } from "@/core/lib/api-client";
import { createCityEvent } from "@/core/lib/city-events-firestore";
import type { CityAccount } from "@/core/lib/city-types";
import {
  atualizarContrato,
  createContrato,
  listContratos,
  mudarEstadoDoContrato,
} from "@/core/lib/contratos-firestore";
import {
  getFirebaseAuth,
  getFirebaseDb,
  getFirebaseStorage,
} from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import { baixarPdf } from "@/modules/cidades/emissao";
import { uploadCityDocument } from "@/modules/documentos/documentos-firestore";

const { Text } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

/** Padrões de mercado da casa — os mesmos do kit de inexigibilidade. */
const VALOR_MENSAL_PADRAO = 27_500;
const MESES_PADRAO = 12;

/**
 * Os contratos do município: a proposta comercial que fecha o cliente e o
 * registro do que foi fechado — minuta, assinado, encerrado.
 *
 * A geração acontece daqui de propósito: a proposta nasce vinculada à cidade,
 * arquivada no acervo e anotada na linha do tempo, em vez de virar um arquivo
 * solto na pasta de downloads de alguém.
 */
export function ContratoDaCidade({ city }: { city: CityAccount }) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const { token } = theme.useToken();
  const queryClient = useQueryClient();
  const [gerarAberto, setGerarAberto] = useState(false);
  const [assinando, setAssinando] = useState<ContratoDaCidade | null>(null);

  const editarCidade = user ? podeEditar(user.permissoes, "cidades") : false;

  const {
    data: contratos = [],
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["contratos", user?.groupId, city.id],
    queryFn: () => listContratos(getFirebaseDb(), user!.groupId, city.id),
    enabled: Boolean(user?.groupId && city.id),
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["contratos"] });
    queryClient.invalidateQueries({ queryKey: ["city-events", city.id] });
    queryClient.invalidateQueries({ queryKey: ["city-documents"] });
  };

  const mudarEstado = useMutation({
    mutationFn: async ({
      contrato,
      para,
    }: {
      contrato: ContratoDaCidade;
      para: EstadoDoContrato;
    }) => {
      await mudarEstadoDoContrato(getFirebaseDb(), contrato, para);
      /* O que muda o rumo do município vira acontecimento — é na linha do
         tempo que a equipe fica sabendo. */
      await createCityEvent(
        getFirebaseDb(),
        user!.groupId,
        city.id,
        {
          tipo: "nota",
          titulo:
            para === "cancelado"
              ? "Contrato cancelado"
              : `Contrato ${ESTADO_DO_CONTRATO_LABELS[para].toLocaleLowerCase("pt-BR")}`,
          quando: new Date().toISOString(),
        },
        { uid: user!.id, nome: user!.name },
      );
    },
    onSuccess: (_dados, { para }) => {
      invalidar();
      message.success(`Contrato ${ESTADO_DO_CONTRATO_LABELS[para].toLocaleLowerCase("pt-BR")}.`);
    },
    onError: (e) =>
      message.error(e instanceof Error ? e.message : "Falha ao mudar o estado."),
  });

  if (isError) {
    return (
      <Result
        status="warning"
        title="Não foi possível carregar os contratos"
        subTitle="Verifique a conexão e tente novamente."
        extra={
          <Button type="primary" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const colunas: ProColumns<ContratoDaCidade>[] = [
    {
      title: "Estado",
      dataIndex: "estado",
      width: 110,
      render: (_, contrato) => <TagDeEstado contrato={contrato} />,
    },
    {
      title: "Valor mensal",
      dataIndex: "valorMensalCents",
      width: 130,
      align: "right",
      render: (_, contrato) => (
        <span style={{ fontFamily: FONTE_MONO, fontSize: 12 }}>
          {reais(contrato.valorMensalCents)}
        </span>
      ),
    },
    {
      title: "Meses",
      dataIndex: "quantidadeMeses",
      width: 70,
      align: "right",
      render: (_, contrato) => (
        <span style={{ fontFamily: FONTE_MONO, fontSize: 12 }}>
          {contrato.quantidadeMeses}
        </span>
      ),
    },
    {
      title: "Valor global",
      key: "global",
      width: 140,
      align: "right",
      render: (_, contrato) => (
        <span style={{ fontFamily: FONTE_MONO, fontSize: 12, fontWeight: 600 }}>
          {reais(valorGlobalCents(contrato))}
        </span>
      ),
    },
    {
      title: "Vigência",
      key: "vigencia",
      width: 200,
      render: (_, contrato) => <Vigencia contrato={contrato} />,
    },
    {
      title: "Gerado",
      dataIndex: "criadoEm",
      width: 160,
      responsive: ["lg"],
      render: (_, contrato) => (
        <Text type="secondary" style={{ fontSize: 11, fontFamily: FONTE_MONO }}>
          {dataCurta(contrato.criadoEm)}
          {contrato.criadoPorNome ? ` · ${contrato.criadoPorNome}` : ""}
        </Text>
      ),
    },
    {
      title: "",
      key: "acoes",
      align: "right",
      render: (_, contrato) => (
        <Space size={4} wrap>
          {contrato.propostaDownloadUrl && (
            <Button
              size="small"
              icon={<DownloadOutlined />}
              href={contrato.propostaDownloadUrl}
              target="_blank"
              rel="noreferrer"
            >
              Proposta
            </Button>
          )}
          {editarCidade && contrato.estado === "minuta" && (
            <>
              <Button
                size="small"
                type="primary"
                onClick={() => setAssinando(contrato)}
              >
                Marcar assinado
              </Button>
              <Popconfirm
                title="Cancelar este contrato?"
                description="O registro fica no histórico como cancelado."
                okText="Cancelar contrato"
                okButtonProps={{ danger: true }}
                cancelText="Voltar"
                onConfirm={() =>
                  mudarEstado.mutate({ contrato, para: "cancelado" })
                }
              >
                <Button size="small" danger type="text">
                  Cancelar
                </Button>
              </Popconfirm>
            </>
          )}
          {editarCidade && contrato.estado === "assinado" && (
            <Popconfirm
              title="Encerrar este contrato?"
              description="Use quando a vigência terminou. O registro fica no histórico."
              okText="Encerrar"
              cancelText="Voltar"
              onConfirm={() => mudarEstado.mutate({ contrato, para: "encerrado" })}
            >
              <Button size="small">Encerrar</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Contratos de {city.name}
          </Typography.Title>
          <Text type="secondary" style={{ fontSize: 10 }}>
            Proposta comercial por dispensa (Art. 75, Lei 14.133/21), do papel à
            assinatura.
          </Text>
        </div>
        {editarCidade && (
          <Button
            type="primary"
            icon={<FileTextOutlined />}
            onClick={() => setGerarAberto(true)}
          >
            Gerar proposta comercial
          </Button>
        )}
      </Flex>

      <div style={{ marginTop: 16 }}>
        {isPending ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : contratos.length ? (
          <ProTable<ContratoDaCidade>
            rowKey="id"
            size="small"
            search={false}
            toolBarRender={false}
            options={false}
            pagination={false}
            dateFormatter="string"
            dataSource={contratos}
            columns={colunas}
            scroll={{ x: 950 }}
          />
        ) : (
          <Empty
            image={<FileDoneOutlined style={{ fontSize: 40, color: token.colorTextQuaternary }} />}
            description={
              <Flex vertical gap={4} align="center">
                <Text strong>Nenhum contrato registrado</Text>
                <Text type="secondary" style={{ fontSize: 12, maxWidth: 420 }}>
                  Gere a proposta comercial: ela sai em DOCX pronta para a
                  prefeitura, fica arquivada no acervo da cidade e vira um
                  contrato em minuta aqui — que você marca como assinado quando
                  fechar.
                </Text>
              </Flex>
            }
            style={{ padding: "48px 0" }}
          >
            {editarCidade && (
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                onClick={() => setGerarAberto(true)}
              >
                Gerar proposta comercial
              </Button>
            )}
          </Empty>
        )}
      </div>

      {gerarAberto && (
        <GerarPropostaDialog
          city={city}
          onClose={() => setGerarAberto(false)}
          onGerado={invalidar}
        />
      )}

      {assinando && (
        <AssinarDialog
          contrato={assinando}
          cityId={city.id}
          onClose={() => setAssinando(null)}
          onAssinado={invalidar}
        />
      )}
    </Card>
  );
}

function TagDeEstado({ contrato }: { contrato: ContratoDaCidade }) {
  const cores: Record<EstadoDoContrato, string> = {
    minuta: "processing",
    assinado: "success",
    encerrado: "default",
    cancelado: "error",
  };
  return <Tag color={cores[contrato.estado]}>{ESTADO_DO_CONTRATO_LABELS[contrato.estado]}</Tag>;
}

/** Vigência com o aviso que importa: quanto falta para vencer. */
function Vigencia({ contrato }: { contrato: ContratoDaCidade }) {
  const { token } = theme.useToken();
  if (!contrato.vigenciaInicio && !contrato.vigenciaFim) {
    return <Text style={{ color: token.colorTextQuaternary }}>—</Text>;
  }

  const dias = diasParaVencer(contrato, new Date());
  return (
    <Flex vertical gap={0}>
      <Text style={{ fontFamily: FONTE_MONO, fontSize: 11.5 }}>
        {dataCurta(contrato.vigenciaInicio)} — {dataCurta(contrato.vigenciaFim)}
      </Text>
      {dias !== null && dias < 0 && (
        <Text style={{ fontSize: 11, color: token.colorErrorText }}>
          venceu há {Math.abs(dias)} dias
        </Text>
      )}
      {dias !== null && dias >= 0 && dias <= 90 && (
        <Text style={{ fontSize: 11, color: token.colorWarningText }}>
          vence em {dias} dias
        </Text>
      )}
    </Flex>
  );
}

interface CamposDaProposta {
  valorMensal: number;
  meses: number;
  via: ViaDeContratacao;
  numeroContrato?: string;
  numeroProcesso?: string;
}

function GerarPropostaDialog({
  city,
  onClose,
  onGerado,
}: {
  city: CityAccount;
  onClose: () => void;
  onGerado: () => void;
}) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [form] = Form.useForm<CamposDaProposta>();

  /* Reage ao que está digitado agora: o teto da dispensa por valor olha o
     valor global (mensal × meses), e é aqui que dá para avisar antes de a
     peça existir. */
  const viaEscolhida = Form.useWatch("via", form) ?? "dispensa";
  const valorMensalAtual = Form.useWatch("valorMensal", form) ?? 0;
  const mesesAtuais = Form.useWatch("meses", form) ?? 0;
  const avisoDeLimiteAtual =
    viaEscolhida === "dispensa"
      ? avisoDeLimite(
          fundamentoPadrao("dispensa").id,
          Math.round(valorMensalAtual * mesesAtuais * 100),
        )
      : null;

  const gerar = useMutation({
    mutationFn: async (campos: CamposDaProposta) => {
      const sessao = getFirebaseAuth().currentUser;
      if (!sessao) throw new Error("Sessão expirada — entre de novo.");
      const idToken = await sessao.getIdToken();

      const resposta = await fetch(
        "/api/modulos/contratos/proposta-dispensa",
        withAuthHeader(
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              municipioNome: city.name,
              municipioUf: city.uf,
              prazoMeses: campos.meses,
              valorMensalCents: Math.round(campos.valorMensal * 100),
              via: campos.via,
            }),
          },
          idToken,
        ),
      );
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}));
        throw new Error(corpo.error ?? "Falha ao gerar a proposta.");
      }
      const blob = await resposta.blob();
      const fileName = `Proposta_Comercial_${city.name.replaceAll(" ", "_")}.docx`;

      // O arquivo primeiro: se o resto falhar, a pessoa já tem a proposta.
      baixarPdf(blob, fileName);

      const documento = await uploadCityDocument(
        getFirebaseDb(),
        getFirebaseStorage(),
        new File([blob], fileName, {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
        {
          groupId: user!.groupId,
          cityId: city.id,
          cityName: city.name,
          cityUf: city.uf,
          category: "proposta",
          title: "Proposta Comercial — Dispensa",
          contractNumber: campos.numeroContrato?.trim() || undefined,
          createdBy: user!.id,
          createdByName: user!.name,
          source: "generated",
        },
      );

      const contrato = await createContrato(
        getFirebaseDb(),
        user!.groupId,
        {
          cityId: city.id,
          cityName: city.name,
          cityUf: city.uf,
          codigoIbge: city.codigoIbge || undefined,
          numeroContrato: campos.numeroContrato?.trim() || undefined,
          numeroProcesso: campos.numeroProcesso?.trim() || undefined,
          valorMensalCents: Math.round(campos.valorMensal * 100),
          quantidadeMeses: campos.meses,
          propostaDocumentoId: documento.id,
          propostaDownloadUrl: documento.downloadUrl,
        },
        user!.name,
      );

      await createCityEvent(
        getFirebaseDb(),
        user!.groupId,
        city.id,
        {
          tipo: "documento",
          titulo: `Proposta comercial gerada — ${reais(contrato.valorMensalCents)}/mês por ${contrato.quantidadeMeses} meses`,
          quando: new Date().toISOString(),
          anexo: { titulo: documento.title, url: documento.downloadUrl, documentoId: documento.id },
        },
        { uid: user!.id, nome: user!.name },
      );
    },
    onSuccess: () => {
      onGerado();
      message.success(
        "Proposta gerada e baixada. Ela está no acervo da cidade e o contrato entrou como minuta.",
      );
      onClose();
    },
    onError: (e) =>
      message.error(e instanceof Error ? e.message : "Falha ao gerar a proposta."),
  });

  return (
    <Modal
      open
      centered
      width={460}
      title={`Proposta comercial — ${city.name}/${city.uf}`}
      okText={gerar.isPending ? "Gerando…" : "Gerar e arquivar"}
      cancelText="Cancelar"
      confirmLoading={gerar.isPending}
      onOk={() => form.submit()}
      onCancel={() => {
        if (!gerar.isPending) onClose();
      }}
      destroyOnHidden
    >
      <Form<CamposDaProposta>
        form={form}
        layout="vertical"
        onFinish={(campos) => gerar.mutate(campos)}
        initialValues={{
          valorMensal: VALOR_MENSAL_PADRAO,
          meses: MESES_PADRAO,
          via: "dispensa" as ViaDeContratacao,
        }}
        style={{ marginTop: 12 }}
      >
        <Form.Item
          label="Via da contratação direta"
          name="via"
          extra={
            <Text type="secondary" style={{ fontSize: 11.5 }}>
              A proposta cita o artigo desta via. É a mesma escolha do kit
              capa a capa, em Documentos › Gerar contrato.
            </Text>
          }
        >
          <Segmented
            block
            options={VIAS_DE_CONTRATACAO.map((v) => ({
              value: v.key,
              label: v.nomeCurto,
            }))}
          />
        </Form.Item>

        {avisoDeLimiteAtual && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title="O valor não cabe na dispensa por valor"
            description={avisoDeLimiteAtual}
          />
        )}

        <Form.Item
          label="Valor mensal (R$)"
          name="valorMensal"
          rules={[{ required: true, message: "Informe o valor mensal." }]}
        >
          <InputNumber<number>
            style={{ width: "100%", fontFamily: FONTE_MONO }}
            min={1}
            step={500}
          />
        </Form.Item>

        <Form.Item
          label="Prazo de execução (meses)"
          name="meses"
          rules={[{ required: true, message: "Informe o prazo." }]}
        >
          <InputNumber<number> style={{ width: "100%", fontFamily: FONTE_MONO }} min={1} max={60} />
        </Form.Item>

        <Form.Item label="Nº do contrato (opcional)" name="numeroContrato">
          <Input placeholder="Ex: 012/2026" style={{ fontFamily: FONTE_MONO }} />
        </Form.Item>

        <Form.Item label="Nº do processo (opcional)" name="numeroProcesso">
          <Input placeholder="Ex: 045/2026" style={{ fontFamily: FONTE_MONO }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function AssinarDialog({
  contrato,
  cityId,
  onClose,
  onAssinado,
}: {
  contrato: ContratoDaCidade;
  cityId: string;
  onClose: () => void;
  onAssinado: () => void;
}) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [data, setData] = useState<dayjs.Dayjs>(dayjs());

  const assinar = useMutation({
    mutationFn: async () => {
      const inicio = data.format("YYYY-MM-DD");
      const fim = data.add(contrato.quantidadeMeses, "month").format("YYYY-MM-DD");
      /* A vigência entra antes da mudança de estado: se a segunda escrita
         falhar, um contrato assinado sem vigência esconderia o aviso de
         vencimento — pior que uma minuta com vigência preenchida. */
      await atualizarContrato(getFirebaseDb(), contrato.id, {
        vigenciaInicio: inicio,
        vigenciaFim: fim,
      });
      await mudarEstadoDoContrato(getFirebaseDb(), contrato, "assinado");
      await createCityEvent(
        getFirebaseDb(),
        user!.groupId,
        cityId,
        {
          tipo: "nota",
          titulo: `Contrato assinado — vigência até ${dataCurta(fim)}`,
          quando: new Date().toISOString(),
        },
        { uid: user!.id, nome: user!.name },
      );
    },
    onSuccess: () => {
      onAssinado();
      message.success("Contrato marcado como assinado.");
      onClose();
    },
    onError: (e) =>
      message.error(e instanceof Error ? e.message : "Falha ao marcar como assinado."),
  });

  return (
    <Modal
      open
      centered
      width={420}
      title="Quando o contrato foi assinado?"
      okText={assinar.isPending ? "Salvando…" : "Confirmar assinatura"}
      cancelText="Voltar"
      confirmLoading={assinar.isPending}
      onOk={() => assinar.mutate()}
      onCancel={() => {
        if (!assinar.isPending) onClose();
      }}
      destroyOnHidden
    >
      <Flex vertical gap={12} style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          A vigência de {contrato.quantidadeMeses} meses é contada a partir
          desta data, e o aviso de renovação sai dela. A assinatura também entra
          na linha do tempo da cidade.
        </Text>
        <DatePicker
          value={data}
          onChange={(d) => d && setData(d)}
          format="DD/MM/YYYY"
          style={{ width: "100%" }}
          allowClear={false}
        />
      </Flex>
    </Modal>
  );
}

function reais(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
}

function dataCurta(iso?: string): string {
  if (!iso) return "—";
  const data = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(data);
}
