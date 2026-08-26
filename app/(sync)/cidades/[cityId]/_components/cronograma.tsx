"use client";

import { createContext, useContext, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  CheckOutlined,
  EditOutlined,
  HolderOutlined,
  PlusOutlined,
  RocketOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Modal,
  Progress,
  Result,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  theme,
} from "antd";

import {
  ESTADO_DA_ETAPA_LABELS,
  MODELO_DE_IMPLANTACAO,
  estaAtrasada,
  novaOrdemAposMover,
  ordenarCronograma,
  proximaOrdem,
  resumoDoCronograma,
  type EstadoDaEtapa,
  type EtapaDoCronograma,
} from "@/core/domain/cronograma";
import {
  atualizarEtapa,
  concluirEtapa,
  criarCronogramaDoModelo,
  criarEtapaAvulsa,
  listEtapas,
  reabrirEtapa,
  salvarOrdemDasEtapas,
} from "@/core/lib/city-schedule-firestore";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";

const { Text } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

/* ── Arrastar para reordenar ─────────────────────────────────────────────
   Nó de arrasto é a exceção declarada das regras de interface: o dnd-kit
   precisa de `ref`, `style` e ouvintes no mesmo elemento do DOM. Aqui o
   elemento é o próprio `<tr>` da tabela do Ant (via `components.body.row`),
   e os ouvintes ficam só na alça — arrastar pela linha inteira roubaria o
   clique dos botões "Concluir" e "Editar". */

interface ContextoDaLinha {
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
  listeners?: ReturnType<typeof useSortable>["listeners"];
}

const RowContext = createContext<ContextoDaLinha>({});

function AlcaDeArrasto() {
  const { setActivatorNodeRef, listeners } = useContext(RowContext);
  return (
    <Button
      type="text"
      size="small"
      icon={<HolderOutlined />}
      style={{ cursor: "move" }}
      ref={setActivatorNodeRef}
      aria-label="Arrastar para reordenar"
      title="Arrastar para reordenar"
      {...listeners}
    />
  );
}

function LinhaArrastavel(
  props: React.HTMLAttributes<HTMLTableRowElement> & { "data-row-key": string },
) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props["data-row-key"] });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: "relative", zIndex: 2 } : {}),
  };

  const contexto = useMemo(
    () => ({ setActivatorNodeRef, listeners }),
    [setActivatorNodeRef, listeners],
  );

  return (
    <RowContext.Provider value={contexto}>
      <tr {...props} ref={setNodeRef} style={style} {...attributes} />
    </RowContext.Provider>
  );
}

/**
 * O cronograma de implantação do município.
 *
 * Nasce vazio de propósito: semear o modelo em toda cidade da carteira encheria
 * de prazos vencidos as que estão só em prospecção. A semeadura é um ato — a
 * pessoa diz quando a implantação começou, e os prazos saem daí.
 *
 * Etapa não tem dono, ao contrário de evento: qualquer pessoa da equipe conclui
 * qualquer etapa. É o estado combinado do trabalho, não registro de autoria —
 * quem está na cidade hoje conclui o que a colega marcou semana passada.
 */
export function Cronograma({
  cityId,
  inicioSugerido,
}: {
  cityId: string;
  /** `implantacaoInicio` da cidade, quando informado no cadastro. */
  inicioSugerido?: string;
}) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [semeando, setSemeando] = useState(false);
  const [nova, setNova] = useState(false);
  const [emEdicao, setEmEdicao] = useState<EtapaDoCronograma | null>(null);

  const chave = ["city-schedule", cityId];

  const {
    data: etapas = [],
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: chave,
    queryFn: () => listEtapas(getFirebaseDb(), user!.groupId, cityId),
    enabled: Boolean(user?.groupId && cityId),
  });

  /* Um "agora" só, congelado por carga, e compartilhado pelo resumo e pela
     tabela. Dois relógios diferentes deixariam o cabeçalho dizer "1 atrasada" e
     a linha correspondente aparecer em dia — na virada da meia-noite, e só para
     quem estivesse com a tela aberta. */
  const { agora, resumo, ordenadas } = useMemo(() => {
    const instante = new Date();
    return {
      agora: instante,
      resumo: resumoDoCronograma(etapas, instante),
      ordenadas: ordenarCronograma(etapas),
    };
  }, [etapas]);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: chave });
    queryClient.invalidateQueries({ queryKey: ["city-events", cityId] });
  };

  const semear = useMutation({
    mutationFn: (inicio: string) =>
      criarCronogramaDoModelo(getFirebaseDb(), user!.groupId, cityId, inicio),
    onSuccess: () => {
      invalidar();
      setSemeando(false);
      message.success("Cronograma criado a partir do modelo.");
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "Falha ao criar."),
  });

  const criar = useMutation({
    mutationFn: (valores: { nome: string; prazo: string; descricao?: string }) =>
      criarEtapaAvulsa(getFirebaseDb(), user!.groupId, cityId, {
        ...valores,
        ordem: proximaOrdem(etapas),
      }),
    onSuccess: () => {
      invalidar();
      setNova(false);
      message.success("Etapa acrescentada.");
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "Falha ao acrescentar."),
  });

  const editar = useMutation({
    mutationFn: ({
      id,
      valores,
    }: {
      id: string;
      valores: { nome: string; prazo: string; descricao?: string; estado: EstadoDaEtapa };
    }) =>
      atualizarEtapa(getFirebaseDb(), cityId, id, {
        nome: valores.nome,
        prazo: valores.prazo,
        descricao: valores.descricao ?? null,
        estado: valores.estado,
      }),
    onSuccess: () => {
      invalidar();
      setEmEdicao(null);
      message.success("Etapa atualizada.");
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const concluir = useMutation({
    mutationFn: (etapa: EtapaDoCronograma) =>
      concluirEtapa(getFirebaseDb(), user!.groupId, cityId, etapa, {
        uid: user!.id,
        nome: user!.name,
      }),
    onSuccess: () => {
      invalidar();
      message.success("Etapa concluída e anotada na linha do tempo.");
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "Falha ao concluir."),
  });

  const reabrir = useMutation({
    mutationFn: (etapaId: string) => reabrirEtapa(getFirebaseDb(), cityId, etapaId),
    onSuccess: () => {
      invalidar();
      message.success("Etapa reaberta. O registro da conclusão continua na linha do tempo.");
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "Falha ao reabrir."),
  });

  /* Otimista de propósito: a linha cai onde a pessoa soltou, na hora. Esperar
     a ida ao Firestore faria a etapa voltar ao lugar antigo por um instante e
     pular de volta — arrasto que "não pegou" é defeito na percepção de quem
     usa, mesmo quando gravou. Se a escrita falhar, a ordem anterior volta e o
     erro aparece. */
  const reordenar = useMutation({
    mutationFn: (ordens: { id: string; ordem: number }[]) =>
      salvarOrdemDasEtapas(getFirebaseDb(), cityId, ordens),
    onMutate: async (ordens) => {
      await queryClient.cancelQueries({ queryKey: chave });
      const anteriores = queryClient.getQueryData<EtapaDoCronograma[]>(chave);
      queryClient.setQueryData<EtapaDoCronograma[]>(chave, (atuais = []) =>
        atuais.map((etapa) => {
          const nova = ordens.find((ordem) => ordem.id === etapa.id);
          return nova ? { ...etapa, ordem: nova.ordem } : etapa;
        }),
      );
      return { anteriores };
    },
    onError: (e, _ordens, contexto) => {
      if (contexto?.anteriores) queryClient.setQueryData(chave, contexto.anteriores);
      message.error(e instanceof Error ? e.message : "Falha ao salvar a ordem.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: chave }),
  });

  const aoSoltar = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const ordens = novaOrdemAposMover(ordenadas, String(active.id), String(over.id));
    if (ordens) reordenar.mutate(ordens);
  };

  /* A alça exige 4px de movimento antes de virar arrasto: sem isso, o clique
     simples no botão da alça já contaria como drag e nada mais receberia foco. */
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  if (isPending) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (error) {
    return (
      <Result
        status="warning"
        title="Não foi possível carregar o cronograma"
        subTitle={error instanceof Error ? error.message : "Erro desconhecido."}
        extra={
          <Button type="primary" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        }
      />
    );
  }

  if (etapas.length === 0) {
    return (
      <>
        <Card>
          <Empty
            description={
              <Flex vertical gap={4} align="center">
                <Text>Esta cidade ainda não tem cronograma.</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  O modelo de implantação tem {MODELO_DE_IMPLANTACAO.length} etapas, do
                  contrato assinado ao relatório de resultados. Os prazos são
                  contados a partir da data que você informar, e cada um pode ser
                  ajustado depois.
                </Text>
              </Flex>
            }
          >
            <Button type="primary" icon={<RocketOutlined />} onClick={() => setSemeando(true)}>
              Criar a partir do modelo
            </Button>
          </Empty>
        </Card>

        <DialogoDeInicio
          aberto={semeando}
          inicioSugerido={inicioSugerido}
          salvando={semear.isPending}
          aoFechar={() => setSemeando(false)}
          aoConfirmar={(inicio) => semear.mutate(inicio)}
        />
      </>
    );
  }

  return (
    <Flex vertical gap={14}>
      <Card>
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={16}>
          <Flex gap={32} wrap="wrap">
            <Statistic
              title="etapas concluídas"
              value={`${resumo.concluidas}/${resumo.total}`}
              styles={{ content: { fontFamily: FONTE_MONO, fontSize: 18 } }}
            />
            <Statistic
              title="atrasadas"
              value={resumo.atrasadas}
              styles={{
                content: {
                  fontFamily: FONTE_MONO,
                  fontSize: 18,
                  // Zero atrasadas em cinza: só chama atenção o que precisa.
                  color: resumo.atrasadas > 0 ? token.colorError : token.colorTextQuaternary,
                },
              }}
            />
            <div style={{ minWidth: 180 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                próxima etapa
              </Text>
              <div style={{ marginTop: 4 }}>
                {resumo.proxima ? (
                  <Space size={6} wrap>
                    <Text strong style={{ fontSize: 13 }}>
                      {resumo.proxima.nome}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11.5, fontFamily: FONTE_MONO }}>
                      {formatarPrazo(resumo.proxima.prazo)}
                    </Text>
                  </Space>
                ) : (
                  <Text type="secondary">Implantação concluída.</Text>
                )}
              </div>
            </div>
          </Flex>

          <Button icon={<PlusOutlined />} onClick={() => setNova(true)}>
            Acrescentar etapa
          </Button>
        </Flex>

        <Progress
          percent={resumo.percentual}
          status={resumo.atrasadas > 0 ? "exception" : "normal"}
          style={{ marginTop: 12 }}
        />
      </Card>

      {resumo.atrasadas > 0 && (
        <Alert
          type="warning"
          showIcon
          title={`${resumo.atrasadas} ${
            resumo.atrasadas === 1 ? "etapa passou do prazo" : "etapas passaram do prazo"
          }`}
          description="Concluir, adiar o prazo ou remarcar tira daqui. Prazo que fica vermelho para sempre deixa de ser aviso."
        />
      )}

      <Card>
        <DndContext sensors={sensores} onDragEnd={aoSoltar}>
          <SortableContext
            items={ordenadas.map((etapa) => etapa.id)}
            strategy={verticalListSortingStrategy}
          >
        <Table<EtapaDoCronograma>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={ordenadas}
          components={{ body: { row: LinhaArrastavel } }}
          columns={[
            {
              key: "arrastar",
              width: 40,
              render: () => <AlcaDeArrasto />,
            },
            {
              title: "Etapa",
              dataIndex: "nome",
              render: (_, etapa) => (
                <Flex vertical gap={0}>
                  <Space size={6} wrap>
                    <Text strong style={{ fontSize: 13 }} delete={etapa.estado === "concluida"}>
                      {etapa.nome}
                    </Text>
                    {!etapa.modeloKey && <Tag>avulsa</Tag>}
                  </Space>
                  {etapa.descricao && (
                    <Text type="secondary" style={{ fontSize: 11.5 }}>
                      {etapa.descricao}
                    </Text>
                  )}
                  {etapa.concluidaPor && (
                    <Text type="secondary" style={{ fontSize: 11, fontFamily: FONTE_MONO }}>
                      concluída por {etapa.concluidaPor}
                    </Text>
                  )}
                </Flex>
              ),
            },
            {
              title: "Prazo",
              dataIndex: "prazo",
              width: 130,
              align: "right",
              /* Sem `sorter` de propósito: a ordem agora é a que se arrasta.
                 Uma tabela ordenada por prazo mostraria as linhas numa ordem e
                 o arrasto soltaria noutra — a etapa cairia longe de onde a
                 pessoa a soltou. */
              render: (_, etapa) => (
                <Text
                  style={{
                    fontFamily: FONTE_MONO,
                    fontSize: 12,
                    color: estaAtrasada(etapa, agora) ? token.colorError : undefined,
                  }}
                >
                  {formatarPrazo(etapa.prazo)}
                </Text>
              ),
            },
            {
              title: "Situação",
              dataIndex: "estado",
              width: 140,
              align: "center",
              render: (_, etapa) => <TagDeEstado etapa={etapa} agora={agora} />,
            },
            {
              title: "",
              width: 150,
              align: "right",
              render: (_, etapa) => (
                <Space size={4}>
                  {etapa.estado === "concluida" ? (
                    <Button
                      size="small"
                      icon={<UndoOutlined />}
                      loading={reabrir.isPending}
                      onClick={() => reabrir.mutate(etapa.id)}
                    >
                      Reabrir
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      type="primary"
                      icon={<CheckOutlined />}
                      loading={concluir.isPending}
                      onClick={() => concluir.mutate(etapa)}
                    >
                      Concluir
                    </Button>
                  )}
                  <Button size="small" icon={<EditOutlined />} onClick={() => setEmEdicao(etapa)} />
                </Space>
              ),
            },
          ]}
        />
          </SortableContext>
        </DndContext>
      </Card>

      <DialogoDeEtapa
        aberto={nova}
        etapa={null}
        salvando={criar.isPending}
        aoFechar={() => setNova(false)}
        aoSalvar={(v) => criar.mutate(v)}
      />

      {emEdicao && (
        <DialogoDeEtapa
          aberto
          etapa={emEdicao}
          salvando={editar.isPending}
          aoFechar={() => setEmEdicao(null)}
          aoSalvar={(v) =>
            editar.mutate({
              id: emEdicao.id,
              valores: { ...v, estado: v.estado ?? emEdicao.estado },
            })
          }
        />
      )}
    </Flex>
  );
}

function TagDeEstado({ etapa, agora }: { etapa: EtapaDoCronograma; agora: Date }) {
  if (etapa.estado === "concluida") return <Tag color="success">Concluída</Tag>;
  if (estaAtrasada(etapa, agora)) return <Tag color="error">Atrasada</Tag>;
  if (etapa.estado === "em_andamento") return <Tag color="processing">Em andamento</Tag>;
  return <Tag>Pendente</Tag>;
}

function DialogoDeInicio({
  aberto,
  inicioSugerido,
  salvando,
  aoFechar,
  aoConfirmar,
}: {
  aberto: boolean;
  inicioSugerido?: string;
  salvando: boolean;
  aoFechar: () => void;
  aoConfirmar: (inicio: string) => void;
}) {
  /* A data do cadastro entra preenchida. Quem assinou o contrato em março e
     cria o cronograma em agosto não lembra o dia — e o que se lembra em vez de
     consultar vira cronograma inteiro cinco meses fora do lugar. */
  const [inicio, setInicio] = useState<dayjs.Dayjs>(
    inicioSugerido ? dayjs(inicioSugerido) : dayjs(),
  );

  return (
    <Modal
      open={aberto}
      title="Quando a implantação começou?"
      okText="Criar cronograma"
      cancelText="Cancelar"
      confirmLoading={salvando}
      onCancel={aoFechar}
      onOk={() => aoConfirmar(inicio.format("YYYY-MM-DD"))}
      destroyOnHidden
    >
      <Flex vertical gap={12}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Normalmente é a data da assinatura do contrato. Os prazos das{" "}
          {MODELO_DE_IMPLANTACAO.length} etapas são contados a partir dela, e cada um pode
          ser ajustado depois — inclusive para trás, se a cidade já estiver em
          andamento.
        </Text>
        <DatePicker
          value={inicio}
          onChange={(d) => d && setInicio(d)}
          format="DD/MM/YYYY"
          style={{ width: "100%" }}
          allowClear={false}
        />
      </Flex>
    </Modal>
  );
}

interface ValoresDaEtapa {
  nome: string;
  prazo: string;
  descricao?: string;
  estado?: EstadoDaEtapa;
}

interface CamposDaEtapa {
  nome: string;
  prazo: dayjs.Dayjs;
  descricao?: string;
  estado?: EstadoDaEtapa;
}

function DialogoDeEtapa({
  aberto,
  etapa,
  salvando,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  etapa: EtapaDoCronograma | null;
  salvando: boolean;
  aoFechar: () => void;
  aoSalvar: (valores: ValoresDaEtapa) => void;
}) {
  const [form] = Form.useForm<CamposDaEtapa>();
  const editando = etapa !== null;

  return (
    <Modal
      open={aberto}
      title={editando ? "Editar etapa" : "Acrescentar etapa"}
      okText={editando ? "Salvar" : "Acrescentar"}
      cancelText="Cancelar"
      confirmLoading={salvando}
      onCancel={() => {
        form.resetFields();
        aoFechar();
      }}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form<CamposDaEtapa>
        form={form}
        layout="vertical"
        onFinish={(campos) =>
          aoSalvar({
            nome: campos.nome,
            prazo: campos.prazo.format("YYYY-MM-DD"),
            descricao: campos.descricao,
            estado: campos.estado,
          })
        }
        initialValues={{
          nome: etapa?.nome ?? "",
          prazo: etapa?.prazo ? dayjs(etapa.prazo) : dayjs(),
          descricao: etapa?.descricao ?? "",
          ...(editando ? { estado: etapa.estado } : {}),
        }}
      >
        <Form.Item
          label="Nome da etapa"
          name="nome"
          rules={[{ required: true, message: "Informe o nome da etapa." }]}
        >
          <Input placeholder="Ex: Visita às escolas do campo" />
        </Form.Item>

        <Form.Item
          label="Prazo"
          name="prazo"
          rules={[{ required: true, message: "Informe o prazo." }]}
        >
          <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} allowClear={false} />
        </Form.Item>

        {editando && (
          <Form.Item label="Situação" name="estado">
            <Select
              options={(["pendente", "em_andamento", "concluida"] as const).map((e) => ({
                value: e,
                label: ESTADO_DA_ETAPA_LABELS[e],
              }))}
            />
          </Form.Item>
        )}

        <Form.Item label="Descrição" name="descricao">
          <Input.TextArea rows={3} placeholder="O que precisa acontecer para esta etapa fechar." />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function formatarPrazo(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : "—";
}
