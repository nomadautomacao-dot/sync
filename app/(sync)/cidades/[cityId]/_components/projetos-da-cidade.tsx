"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftOutlined,
  CheckOutlined,
  PaperClipOutlined,
  PlusOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Descriptions,
  Empty,
  Flex,
  Popconfirm,
  Result,
  Skeleton,
  Space,
  Tag,
  Typography,
  theme,
} from "antd";

import {
  ESTADO_DA_INICIATIVA_LABELS,
  catalogoDeTipos,
  definicaoDaIniciativa,
  estaAtrasada,
  podeEditarIniciativa,
  repartirIniciativas,
  type DefinicaoDeIniciativa,
  type EstadoDaIniciativa,
  type IniciativaDaCidade,
} from "@/core/domain/cidade-iniciativas";
import { MODELO_DE_IMPLANTACAO } from "@/core/domain/cronograma";
import {
  criarIniciativa,
  encerrarIniciativa,
  listIniciativas,
} from "@/core/lib/city-initiatives-firestore";
import { listEtapas } from "@/core/lib/city-schedule-firestore";
import {
  criarTipoDeIniciativa,
  listTiposDeIniciativa,
} from "@/core/lib/tipos-iniciativa-firestore";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import type { CityAccount } from "@/core/lib/city-types";
import type { CityDocument } from "@/modules/documentos/types";
import { useVisualizador } from "@/core/components/usar-visualizador";
import { extensaoDoArquivo } from "@/core/components/visualizador-de-arquivo";
import { useAuth } from "@/core/providers/auth-provider";

import { LinhaDoTempo } from "./linha-do-tempo";
import { IniciativaDialog, type ValoresDaIniciativa } from "./iniciativa-dialog";

const { Text, Title } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

const TOM_DO_ESTADO: Record<EstadoDaIniciativa, string> = {
  planejada: "default",
  em_andamento: "processing",
  concluida: "success",
  cancelada: "default",
};

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatarData(iso?: string): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * O que a Global abriu neste município: capacitações, projetos, programas,
 * serviços.
 *
 * ## Esta tela não é uma segunda linha do tempo
 *
 * Ela é a **lente**. A lista responde "o que está aberto aqui"; abrir um item
 * mostra a mesma `LinhaDoTempo` da aba de entrada, filtrada pelo fio. O
 * componente é o mesmo e a `queryKey` é a mesma — registrar uma reunião dentro
 * da capacitação aparece na linha do tempo da cidade sem segunda leitura, e
 * sem que existam dois lugares para procurar a mesma reunião.
 *
 * ## Perfil: consultora
 *
 * É a tela que ela abre na prefeitura, com o notebook virado para o gestor. Por
 * isso não há aqui receita, comissão nem estágio comercial — nada do eixo
 * administrativo. O que aparece é o trabalho.
 */
export function ProjetosDaCidade({
  city,
  documents,
  onAnexar,
}: {
  city: CityAccount;
  documents: CityDocument[];
  /** Abre o diálogo de upload já amarrado à iniciativa. */
  onAnexar: (iniciativa: IniciativaDaCidade) => void;
}) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();

  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [abertaId, setAbertaId] = useState<string | null>(null);

  const chave = ["city-initiatives", city.id];

  const {
    data: iniciativas = [],
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: chave,
    queryFn: () => listIniciativas(getFirebaseDb(), user!.groupId, city.id),
    enabled: Boolean(user?.groupId && city.id),
  });

  /* As etapas entram só para o elo do cronograma: encerrar uma iniciativa que
     aponta para uma etapa do modelo conclui a etapa no mesmo lote. Sem a lista
     em mãos não dá para saber qual documento de etapa atualizar. */
  const { data: etapas = [] } = useQuery({
    queryKey: ["city-schedule", city.id],
    queryFn: () => listEtapas(getFirebaseDb(), user!.groupId, city.id),
    enabled: Boolean(user?.groupId && city.id),
  });

  /* Os tipos são do grupo, não da cidade: "Formação continuada" criado em
     Juvenília serve em São Félix. Chave sem o cityId, então uma leitura só
     atende todas as cidades que a pessoa abrir na sessão. */
  const { data: tiposPersonalizados = [] } = useQuery({
    queryKey: ["initiative-types", user?.groupId],
    queryFn: () => listTiposDeIniciativa(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });
  const catalogo = useMemo(() => catalogoDeTipos(tiposPersonalizados), [tiposPersonalizados]);

  const criarTipo = useMutation({
    mutationFn: ({ rotulo, temFormacao }: { rotulo: string; temFormacao: boolean }) =>
      criarTipoDeIniciativa(getFirebaseDb(), user!.groupId, rotulo, temFormacao, {
        uid: user!.id,
        nome: user!.name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["initiative-types", user?.groupId] });
    },
    onError: (erro) =>
      message.error(erro instanceof Error ? erro.message : "Não foi possível criar o tipo."),
  });

  const hoje = hojeISO();
  const lista = useMemo(() => repartirIniciativas(iniciativas, hoje), [iniciativas, hoje]);
  const aberta = iniciativas.find((i) => i.id === abertaId) ?? null;

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: chave });
    queryClient.invalidateQueries({ queryKey: ["city-events", city.id] });
    queryClient.invalidateQueries({ queryKey: ["city-schedule", city.id] });
    queryClient.invalidateQueries({ queryKey: ["city", city.id] });
  };

  const abrir = useMutation({
    mutationFn: (valores: ValoresDaIniciativa) =>
      criarIniciativa(
        getFirebaseDb(),
        user!.groupId,
        city.id,
        valores,
        { uid: user!.id, nome: user!.name },
        catalogo,
      ),
    onSuccess: () => {
      invalidar();
      setDialogoAberto(false);
      message.success("Projeto aberto na cidade.");
    },
    onError: (erro) =>
      message.error(erro instanceof Error ? erro.message : "Não foi possível abrir."),
  });

  const encerrar = useMutation({
    mutationFn: ({
      iniciativa,
      estado,
    }: {
      iniciativa: IniciativaDaCidade;
      estado: Extract<EstadoDaIniciativa, "concluida" | "cancelada">;
    }) =>
      encerrarIniciativa(
        getFirebaseDb(),
        user!.groupId,
        city.id,
        iniciativa,
        estado,
        { uid: user!.id, nome: user!.name },
        etapas,
      ),
    onSuccess: (_dado, variaveis) => {
      invalidar();
      message.success(
        variaveis.estado === "concluida" ? "Projeto concluído." : "Projeto cancelado.",
      );
    },
    onError: (erro) =>
      message.error(erro instanceof Error ? erro.message : "Não foi possível encerrar."),
  });

  if (isPending) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 5 }} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Result
          status="warning"
          title="Não foi possível carregar os projetos"
          subTitle={error instanceof Error ? error.message : "Falha ao ler a cidade."}
          extra={
            <Button type="primary" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          }
        />
      </Card>
    );
  }

  if (aberta) {
    return (
      <DetalheDaIniciativa
        city={city}
        iniciativa={aberta}
        catalogo={catalogo}
        documentos={documents.filter((d) => d.iniciativaId === aberta.id)}
        hoje={hoje}
        encerrando={encerrar.isPending}
        aoVoltar={() => setAbertaId(null)}
        aoAnexar={() => onAnexar(aberta)}
        aoEncerrar={(estado) => encerrar.mutate({ iniciativa: aberta, estado })}
      />
    );
  }

  const colunas: ProColumns<IniciativaDaCidade>[] = [
    {
      title: "Projeto",
      dataIndex: "nome",
      sorter: (a, b) => a.nome.localeCompare(b.nome),
      render: (_texto, registro) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => setAbertaId(registro.id)}>
          {registro.nome}
        </Button>
      ),
    },
    {
      title: "Tipo",
      dataIndex: "tipo",
      width: 130,
      render: (_texto, registro) => definicaoDaIniciativa(registro.tipo, catalogo).rotulo,
    },
    {
      title: "Situação",
      dataIndex: "estado",
      width: 150,
      render: (_texto, registro) => (
        <Space size={6}>
          <Tag color={TOM_DO_ESTADO[registro.estado]}>
            {ESTADO_DA_INICIATIVA_LABELS[registro.estado]}
          </Tag>
          {estaAtrasada(registro, hoje) && <Tag color="error">Atrasado</Tag>}
        </Space>
      ),
    },
    {
      title: "Período",
      dataIndex: "inicio",
      width: 190,
      align: "right",
      sorter: (a, b) => a.inicio.localeCompare(b.inicio),
      render: (_texto, registro) => (
        <Text style={{ fontFamily: FONTE_MONO, fontSize: 12 }}>
          {formatarData(registro.inicio)}
          {registro.fim ? ` – ${formatarData(registro.fim)}` : ""}
        </Text>
      ),
    },
    {
      title: "Responsável",
      dataIndex: "responsavelNome",
      width: 180,
      render: (_texto, registro) =>
        registro.responsavelNome ?? (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  const ordenada = [...lista.emAndamento, ...lista.planejadas, ...lista.encerradas];

  return (
    <Flex vertical gap={14}>
      {iniciativas.length === 0 ? (
        <Card>
          <Empty
            description={
              <Flex vertical gap={4}>
                <Text strong>Nenhum projeto aberto em {city.name}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Capacitação, programa, serviço — abra aqui e o que acontecer nele fica junto,
                  com os documentos anexados.
                </Text>
              </Flex>
            }
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDialogoAberto(true)}>
              Abrir o primeiro
            </Button>
          </Empty>
        </Card>
      ) : (
        <Card>
          <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
            <Title level={5} style={{ margin: 0 }}>
              Projetos em {city.name}
            </Title>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDialogoAberto(true)}>
              Abrir projeto
            </Button>
          </Flex>
          <ProTable<IniciativaDaCidade>
            rowKey="id"
            size="small"
            search={false}
            options={false}
            pagination={false}
            columns={colunas}
            dataSource={ordenada}
            /* A ordem já vem repartida (o que roda, o que vai começar, o que
               acabou). Ordenar por coluna é do usuário; a ordem de chegada
               responde à pergunta que traz alguém aqui. */
            rowClassName={(registro) =>
              registro.estado === "cancelada" ? "linha-encerrada" : ""
            }
            style={{ marginTop: 0 }}
          />
          <Text type="secondary" style={{ fontSize: 12, color: token.colorTextTertiary }}>
            Abrir um projeto mostra a linha do tempo dele — os mesmos registros da cidade,
            filtrados por este assunto.
          </Text>
        </Card>
      )}

      <IniciativaDialog
        aberto={dialogoAberto}
        salvando={abrir.isPending}
        etapasDoModelo={MODELO_DE_IMPLANTACAO}
        catalogo={catalogo}
        criandoTipo={criarTipo.isPending}
        aoCriarTipo={async (rotulo, temFormacao) => {
          const criado = await criarTipo.mutateAsync({ rotulo, temFormacao });
          return criado.key;
        }}
        aoFechar={() => setDialogoAberto(false)}
        aoSalvar={async (valores) => {
          await abrir.mutateAsync(valores);
        }}
      />
    </Flex>
  );
}

function DetalheDaIniciativa({
  city,
  iniciativa,
  catalogo,
  documentos,
  hoje,
  encerrando,
  aoVoltar,
  aoAnexar,
  aoEncerrar,
}: {
  city: CityAccount;
  iniciativa: IniciativaDaCidade;
  catalogo: readonly DefinicaoDeIniciativa[];
  documentos: CityDocument[];
  hoje: string;
  encerrando: boolean;
  aoVoltar: () => void;
  aoAnexar: () => void;
  aoEncerrar: (estado: Extract<EstadoDaIniciativa, "concluida" | "cancelada">) => void;
}) {
  const { user } = useAuth();
  const { token } = theme.useToken();
  const { abrir: abrirArquivo, visor } = useVisualizador();

  const definicao = definicaoDaIniciativa(iniciativa.tipo, catalogo);
  const etapa = iniciativa.etapaModeloKey
    ? MODELO_DE_IMPLANTACAO.find((e) => e.key === iniciativa.etapaModeloKey)
    : undefined;
  const podeMexer = user
    ? podeEditarIniciativa(iniciativa, user.id, user.groupRole)
    : false;
  const encerrada = iniciativa.estado === "concluida" || iniciativa.estado === "cancelada";

  return (
    <Flex vertical gap={14}>
      <Card>
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
          <Flex gap={12} align="flex-start" style={{ minWidth: 0 }}>
            <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={aoVoltar} />
            <div style={{ minWidth: 0 }}>
              <Flex align="center" gap={8} wrap="wrap">
                <Title level={4} style={{ margin: 0 }}>
                  {iniciativa.nome}
                </Title>
                <Tag color={TOM_DO_ESTADO[iniciativa.estado]}>
                  {ESTADO_DA_INICIATIVA_LABELS[iniciativa.estado]}
                </Tag>
                {estaAtrasada(iniciativa, hoje) && <Tag color="error">Atrasado</Tag>}
              </Flex>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {definicao.rotulo} · {city.name}/{city.uf} · aberto por {iniciativa.autorNome}
              </Text>
            </div>
          </Flex>

          <Space wrap>
            <Button icon={<PaperClipOutlined />} onClick={aoAnexar}>
              Anexar documento
            </Button>
            {podeMexer && !encerrada && (
              <>
                <Popconfirm
                  title="Concluir este projeto?"
                  description={
                    etapa
                      ? `A etapa "${etapa.nome}" do cronograma será concluída junto.`
                      : "Entra na linha do tempo da cidade."
                  }
                  okText="Concluir"
                  cancelText="Voltar"
                  onConfirm={() => aoEncerrar("concluida")}
                >
                  <Button type="primary" icon={<CheckOutlined />} loading={encerrando}>
                    Concluir
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title="Cancelar este projeto?"
                  description="Fica registrado como cancelado — não some da história da cidade."
                  okText="Cancelar projeto"
                  cancelText="Voltar"
                  onConfirm={() => aoEncerrar("cancelada")}
                >
                  <Button danger icon={<StopOutlined />} loading={encerrando}>
                    Cancelar
                  </Button>
                </Popconfirm>
              </>
            )}
          </Space>
        </Flex>

        <Descriptions
          size="small"
          column={{ xs: 1, sm: 2, lg: 3 }}
          style={{ marginTop: 16 }}
          items={[
            {
              key: "periodo",
              label: "Período",
              children: (
                <Text style={{ fontFamily: FONTE_MONO, fontSize: 12 }}>
                  {formatarData(iniciativa.inicio)}
                  {iniciativa.fim ? ` – ${formatarData(iniciativa.fim)}` : " – sem fim previsto"}
                </Text>
              ),
            },
            {
              key: "responsavel",
              label: "Responsável",
              children: iniciativa.responsavelNome ?? "—",
            },
            ...(definicao.temFormacao
              ? [
                  {
                    key: "carga",
                    label: "Carga horária",
                    children: iniciativa.cargaHoraria ? (
                      <Text style={{ fontFamily: FONTE_MONO, fontSize: 12 }}>
                        {iniciativa.cargaHoraria}h
                      </Text>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    key: "formador",
                    label: "Formação a cargo de",
                    children: iniciativa.formador ?? "—",
                  },
                ]
              : []),
            ...(etapa
              ? [
                  {
                    key: "etapa",
                    label: "Cumpre no cronograma",
                    children: etapa.nome,
                  },
                ]
              : []),
            ...(iniciativa.objetivo
              ? [{ key: "objetivo", label: "Objetivo", children: iniciativa.objetivo, span: 3 }]
              : []),
          ]}
        />
      </Card>

      <Card>
        <Flex justify="space-between" align="center" style={{ marginBottom: 10 }}>
          <Title level={5} style={{ margin: 0 }}>
            Documentos ({documentos.length})
          </Title>
        </Flex>
        {documentos.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Cartaz, certificado, lista de presença — o que for deste projeto entra aqui.
              </Text>
            }
          />
        ) : (
          <Flex vertical gap={6}>
            {documentos.map((documento) => (
              <Flex key={documento.id} justify="space-between" align="center" gap={10}>
                <Space size={8} style={{ minWidth: 0 }}>
                  <PaperClipOutlined style={{ color: token.colorTextTertiary }} />
                  {/* Abre dentro do app. Um `<a href>` aqui baixaria — e o
                      gesto de clicar no nome de um documento é "quero ver o
                      que é", não "quero uma cópia na pasta de downloads". */}
                  <Typography.Link
                    onClick={() =>
                      abrirArquivo({
                        url: documento.downloadUrl,
                        titulo: documento.title,
                        nomeArquivo: documento.fileName,
                        mimeType: documento.mimeType,
                        detalhe: `${iniciativa.nome} · ${documento.fileName}`,
                      })
                    }
                  >
                    {documento.title}
                  </Typography.Link>
                  {extensaoDoArquivo(documento.fileName) && (
                    <Tag style={{ fontFamily: FONTE_MONO, fontSize: 9.5, marginInlineEnd: 0 }}>
                      {extensaoDoArquivo(documento.fileName)}
                    </Tag>
                  )}
                </Space>
                <Text
                  type="secondary"
                  style={{ fontFamily: FONTE_MONO, fontSize: 11, whiteSpace: "nowrap" }}
                >
                  {Math.round(documento.fileSize / 1024)} KB
                </Text>
              </Flex>
            ))}
          </Flex>
        )}
      </Card>

      {/* A mesma linha do tempo da aba de entrada, com um `where` a mais. O que
          for registrado daqui já nasce amarrado a este projeto. */}
      <LinhaDoTempo cityId={city.id} iniciativaId={iniciativa.id} />

      {visor}
    </Flex>
  );
}
