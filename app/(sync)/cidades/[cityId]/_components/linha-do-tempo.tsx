"use client";

import { useMemo, useState } from "react";
import {
  CommentOutlined,
  EditOutlined,
  PaperClipOutlined,
  PlusOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Flex,
  Result,
  Skeleton,
  Space,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  theme,
} from "antd";

import {
  definicaoDoTipo,
  podeEditarEvento,
  repartirLinhaDoTempo,
  type EventoDaCidade,
} from "@/core/domain/cidade-eventos";
import { eventosDaIniciativa } from "@/core/domain/cidade-iniciativas";

import { COR_DO_TIPO, IconeDoTipo } from "./aparencia-do-evento";
import {
  createCityEvent,
  listCityEvents,
  updateCityEvent,
} from "@/core/lib/city-events-firestore";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useVisualizador } from "@/core/components/usar-visualizador";
import { extensaoDoArquivo } from "@/core/components/visualizador-de-arquivo";
import { useAuth } from "@/core/providers/auth-provider";

import { ComentariosDoEvento } from "./comentarios-do-evento";
import { EventoDialog, type ValoresDoEvento } from "./evento-dialog";

const { Text, Title } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";


/**
 * O que aconteceu nesta cidade, em ordem, e quem fez.
 *
 * Três blocos em vez de uma lista corrida, e a ordem se inverte entre eles: no
 * que está por vir interessa o **próximo** compromisso; no que passou, o
 * **último** acontecimento. Uma lista única obrigaria a rolar até o meio para
 * achar o presente.
 *
 * O bloco de pendências vem primeiro de propósito. Ele responde à única
 * pergunta que um mural de avisos não responderia — *o que foi marcado e ficou
 * sem desfecho* — e é o que faz alguém abrir esta tela de manhã.
 */
export function LinhaDoTempo({
  cityId,
  iniciativaId = null,
}: {
  cityId: string;
  /**
   * Quando presente, a linha mostra só o que pertence a esta iniciativa — e o
   * que for registrado daqui já nasce com o fio.
   *
   * É o que faz a aba Projetos ser uma **lente** sobre esta tela em vez de uma
   * segunda linha do tempo: o componente é o mesmo, a consulta é a mesma, e o
   * cache do TanStack é compartilhado (mesma `queryKey`) — registrar dentro de
   * um projeto atualiza a linha do tempo da cidade sem uma segunda leitura.
   */
  iniciativaId?: string | null;
}) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();

  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<EventoDaCidade | null>(null);

  const chave = ["city-events", cityId];

  const {
    data: todosOsEventos = [],
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: chave,
    queryFn: () => listCityEvents(getFirebaseDb(), user!.groupId, cityId),
    enabled: Boolean(user?.groupId && cityId),
  });

  const eventos = useMemo(
    () => eventosDaIniciativa(todosOsEventos, iniciativaId),
    [todosOsEventos, iniciativaId],
  );

  /* `new Date()` a cada render mudaria a repartição no meio de uma interação —
     e um evento pularia de "agenda" para "pendências" enquanto a pessoa lê.
     Congelar por carga é o comportamento que não surpreende. */
  const linha = useMemo(() => repartirLinhaDoTempo(eventos, new Date()), [eventos]);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: chave });
    queryClient.invalidateQueries({ queryKey: ["city", cityId] });
  };

  const registrar = useMutation({
    mutationFn: (valores: ValoresDoEvento) =>
      createCityEvent(
        getFirebaseDb(),
        user!.groupId,
        cityId,
        { ...valores, ...(iniciativaId ? { iniciativaId } : {}) },
        { uid: user!.id, nome: user!.name },
      ),
    onSuccess: () => {
      invalidar();
      setDialogoAberto(false);
      message.success("Registrado na linha do tempo.");
    },
    onError: (erro) =>
      message.error(erro instanceof Error ? erro.message : "Não foi possível registrar."),
  });

  const editar = useMutation({
    mutationFn: ({ id, valores }: { id: string; valores: ValoresDoEvento }) =>
      updateCityEvent(getFirebaseDb(), cityId, id, {
        titulo: valores.titulo,
        quando: valores.quando,
        participantes: valores.participantes ?? null,
        relato: valores.relato ?? null,
        estado: valores.estado,
      }),
    onSuccess: () => {
      invalidar();
      setEmEdicao(null);
      message.success("Registro atualizado.");
    },
    onError: (erro) =>
      message.error(erro instanceof Error ? erro.message : "Não foi possível salvar."),
  });

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
        title="Não foi possível carregar a linha do tempo"
        subTitle={error instanceof Error ? error.message : "Erro desconhecido."}
        extra={
          <Button type="primary" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        }
      />
    );
  }

  const item = (evento: EventoDaCidade) => ({
    key: evento.id,
    // `icon` e `content`, não `dot` e `children`: no antd 6 as props antigas
    // ainda funcionam e avisam no console a cada render.
    icon: <IconeDoTipo tipo={evento.tipo} />,
    // A cor do ponto é a do tipo: é o que deixa a coluna varrível sem leitura.
    color: COR_DO_TIPO[evento.tipo](token),
    content: (
      <ItemDaLinha
        evento={evento}
        cityId={cityId}
        podeEditar={Boolean(user) && podeEditarEvento(evento, user!.id, user!.groupRole)}
        aoEditar={() => setEmEdicao(evento)}
      />
    ),
  });

  const vazia = eventos.length === 0;

  return (
    <Flex vertical gap={14}>
      <Card>
        <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
          <div>
            <Title level={5} style={{ margin: 0 }}>
              Linha do tempo
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Reuniões, visitas, relatórios e documentos desta cidade — de toda a
              equipe, em ordem.
            </Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDialogoAberto(true)}>
            Registrar
          </Button>
        </Flex>
      </Card>

      {vazia ? (
        <Card>
          <Empty
            description={
              <Flex vertical gap={4} align="center">
                <Text>Nada registrado nesta cidade ainda.</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  A primeira reunião, visita ou ligação registrada aqui fica
                  visível para a equipe inteira.
                </Text>
              </Flex>
            }
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDialogoAberto(true)}>
              Registrar o primeiro
            </Button>
          </Empty>
        </Card>
      ) : (
        <>
          {linha.pendencias.length > 0 && (
            <Card>
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title={`${linha.pendencias.length} ${
                  linha.pendencias.length === 1
                    ? "compromisso passou sem desfecho"
                    : "compromissos passaram sem desfecho"
                }`}
                description="A data chegou e ninguém contou o que houve. Editar o registro e dizer se aconteceu, ou cancelar, tira daqui."
              />
              <Timeline items={linha.pendencias.map(item)} />
            </Card>
          )}

          {linha.agenda.length > 0 && (
            <Card>
              <TituloDaSecao
                texto="Por vir"
                quantidade={linha.agenda.length}
                cor={token.colorPrimary}
              />
              <Timeline items={linha.agenda.map(item)} />
            </Card>
          )}

          {linha.historico.length > 0 && (
            <Card>
              <TituloDaSecao
                texto="Já aconteceu"
                quantidade={linha.historico.length}
                cor={token.colorTextTertiary}
              />
              <Timeline items={linha.historico.map(item)} />
            </Card>
          )}
        </>
      )}

      <EventoDialog
        aberto={dialogoAberto}
        evento={null}
        salvando={registrar.isPending}
        aoFechar={() => setDialogoAberto(false)}
        aoSalvar={async (valores) => {
          await registrar.mutateAsync(valores);
        }}
      />

      {emEdicao && (
        <EventoDialog
          aberto
          evento={emEdicao}
          salvando={editar.isPending}
          aoFechar={() => setEmEdicao(null)}
          aoSalvar={async (valores) => {
            await editar.mutateAsync({ id: emEdicao.id, valores });
          }}
        />
      )}
    </Flex>
  );
}

/**
 * Título de bloco com a contagem ao lado.
 *
 * O número responde antes da leitura — "tenho três coisas por vir" — e é o que
 * uma lista sem contagem obriga a descobrir rolando até o fim do bloco.
 */
function TituloDaSecao({
  texto,
  quantidade,
  cor,
}: {
  texto: string;
  quantidade: number;
  cor: string;
}) {
  return (
    <Space size={8} align="center" style={{ marginBottom: 14 }}>
      <Title level={5} style={{ margin: 0 }}>
        {texto}
      </Title>
      <Badge
        count={quantidade}
        showZero
        style={{ backgroundColor: cor, fontFamily: FONTE_MONO, fontSize: 10 }}
      />
    </Space>
  );
}


/** As iniciais de quem escreveu, para o avatar. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0]![0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]![0] ?? "") : "";
  return (primeira + ultima).toUpperCase();
}

function ItemDaLinha({
  evento,
  cityId,
  podeEditar,
  aoEditar,
}: {
  evento: EventoDaCidade;
  cityId: string;
  podeEditar: boolean;
  aoEditar: () => void;
}) {
  const { token } = theme.useToken();
  const { abrir: abrirArquivo, visor } = useVisualizador();
  const [comentariosAbertos, setComentariosAbertos] = useState(false);
  const cor = COR_DO_TIPO[evento.tipo](token);
  const cancelado = evento.estado === "cancelado";

  return (
    /* Cartão em vez de texto solto, com uma faixa da cor do tipo à esquerda.
       Numa lista de dezenas de registros é o que separa um acontecimento do
       seguinte sem exigir que a pessoa leia para descobrir onde um termina. */
    <Flex
      vertical
      gap={8}
      style={{
        marginBottom: 12,
        padding: "10px 14px",
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderInlineStartWidth: 3,
        borderInlineStartColor: cor,
        background: token.colorBgContainer,
        opacity: cancelado ? 0.6 : 1,
      }}
    >
      <Flex justify="space-between" align="flex-start" gap={12} wrap="wrap">
        <Flex vertical gap={3} style={{ minWidth: 0 }}>
          <Space size={8} wrap>
            <Text
              strong
              style={{
                fontSize: 13.5,
                textDecoration: cancelado ? "line-through" : undefined,
              }}
            >
              {evento.titulo}
            </Text>
            <Tag
              style={{
                color: cor,
                background: `${cor}14`,
                borderColor: `${cor}33`,
                fontSize: 10.5,
                marginInlineEnd: 0,
              }}
            >
              {definicaoDoTipo(evento.tipo).rotulo}
            </Tag>
            {cancelado && <Tag>Cancelado</Tag>}
            {evento.estado === "marcado" && <Tag color="processing">Marcado</Tag>}
          </Space>

          <Space size={6} align="center">
            <Tooltip title={evento.autorNome}>
              <Avatar size={18} style={{ backgroundColor: cor, fontSize: 8.5 }}>
                {iniciais(evento.autorNome)}
              </Avatar>
            </Tooltip>
            <Text type="secondary" style={{ fontSize: 11, fontFamily: FONTE_MONO }}>
              {formatarQuando(evento.quando)} · {evento.autorNome}
              {evento.atualizadoEm ? " · editado" : ""}
            </Text>
          </Space>
        </Flex>

        {podeEditar && (
          <Button size="small" type="text" icon={<EditOutlined />} onClick={aoEditar}>
            Editar
          </Button>
        )}
      </Flex>

      {evento.participantes && (
        <Space size={6} wrap>
          <TeamOutlined style={{ color: token.colorTextTertiary, fontSize: 11 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {evento.participantes}
          </Text>
        </Space>
      )}

      {evento.relato ? (
        /* O relato num bloco próprio, e não como mais uma linha de texto: é o
           conteúdo do registro, e o que alguém volta aqui para reler. */
        <div
          style={{
            padding: "8px 12px",
            borderRadius: token.borderRadius,
            background: token.colorFillQuaternary,
          }}
        >
          <Text style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{evento.relato}</Text>
        </div>
      ) : (
        /* Ausência de relato não é erro: o compromisso pode ainda não ter
           acontecido. Mas some quando já aconteceu, e aí vale dizer. */
        evento.estado === "realizado" && (
          <Text style={{ fontSize: 12, color: token.colorTextQuaternary }}>Sem relato.</Text>
        )
      )}

      {evento.anexo && (
        <Button
          size="small"
          icon={<PaperClipOutlined />}
          onClick={() =>
            abrirArquivo({
              url: evento.anexo!.url,
              titulo: evento.anexo!.titulo,
              detalhe: evento.anexo!.relatorioTitulo
                ? `sobre ${evento.anexo!.relatorioTitulo}`
                : undefined,
            })
          }
          style={{ alignSelf: "flex-start", maxWidth: "100%" }}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {evento.anexo.titulo}
            {/* A extensão sai da URL: o anexo do evento guarda só título e
                link, e o título não diz se é DOCX ou ZIP. */}
            {extensaoDoArquivo(undefined, evento.anexo.url)
              ? ` · ${extensaoDoArquivo(undefined, evento.anexo.url)}`
              : ""}
            {evento.anexo.relatorioTitulo ? ` · sobre ${evento.anexo.relatorioTitulo}` : ""}
          </span>
        </Button>
      )}

      <div>
        <Button
          size="small"
          type="text"
          icon={<CommentOutlined />}
          onClick={() => setComentariosAbertos((aberto) => !aberto)}
          style={{ color: token.colorTextTertiary, paddingInline: 4 }}
        >
          {evento.comentarios ? `${evento.comentarios} comentários` : "Comentar"}
        </Button>
      </div>

      {comentariosAbertos && (
        <ComentariosDoEvento
          cityId={cityId}
          eventoId={evento.id}
          autorDoEvento={{ uid: evento.autorUid, nome: evento.autorNome }}
        />
      )}

      {visor}
    </Flex>
  );
}

function formatarQuando(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? "—"
    : data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
