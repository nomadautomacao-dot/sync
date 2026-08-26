"use client";

import { useMemo, useState } from "react";
import {
  CheckCircleOutlined,
  CommentOutlined,
  EditOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  FormOutlined,
  PaperClipOutlined,
  PhoneOutlined,
  PlusOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Alert, Button, Card, Empty, Flex, Result, Skeleton, Space, Tag, Timeline, Typography, theme } from "antd";

import {
  definicaoDoTipo,
  podeEditarEvento,
  repartirLinhaDoTempo,
  type EventoDaCidade,
  type TipoDeEvento,
} from "@/core/domain/cidade-eventos";
import {
  createCityEvent,
  listCityEvents,
  updateCityEvent,
} from "@/core/lib/city-events-firestore";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";

import { ComentariosDoEvento } from "./comentarios-do-evento";
import { EventoDialog, type ValoresDoEvento } from "./evento-dialog";

const { Text, Title } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

const ICONES: Record<TipoDeEvento, React.ComponentType> = {
  reuniao: TeamOutlined,
  visita: EnvironmentOutlined,
  ligacao: PhoneOutlined,
  relatorio_campo: FileTextOutlined,
  nota: FormOutlined,
  documento: PaperClipOutlined,
  etapa: CheckCircleOutlined,
};

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
export function LinhaDoTempo({ cityId }: { cityId: string }) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<EventoDaCidade | null>(null);

  const chave = ["city-events", cityId];

  const {
    data: eventos = [],
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: chave,
    queryFn: () => listCityEvents(getFirebaseDb(), user!.groupId, cityId),
    enabled: Boolean(user?.groupId && cityId),
  });

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
      createCityEvent(getFirebaseDb(), user!.groupId, cityId, valores, {
        uid: user!.id,
        nome: user!.name,
      }),
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
              <Title level={5} style={{ marginTop: 0 }}>
                Por vir
              </Title>
              <Timeline items={linha.agenda.map(item)} />
            </Card>
          )}

          {linha.historico.length > 0 && (
            <Card>
              <Title level={5} style={{ marginTop: 0 }}>
                Já aconteceu
              </Title>
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

function IconeDoTipo({ tipo }: { tipo: TipoDeEvento }) {
  const Icone = ICONES[tipo];
  return <Icone />;
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
  const [comentariosAbertos, setComentariosAbertos] = useState(false);

  return (
    <Flex vertical gap={4} style={{ paddingBottom: 8 }}>
      <Flex justify="space-between" align="flex-start" gap={12} wrap="wrap">
        <Flex vertical gap={2} style={{ minWidth: 0 }}>
          <Space size={8} wrap>
            <Text strong style={{ fontSize: 13 }}>
              {evento.titulo}
            </Text>
            <Tag>{definicaoDoTipo(evento.tipo).rotulo}</Tag>
            {evento.estado === "cancelado" && <Tag color="default">Cancelado</Tag>}
            {evento.estado === "marcado" && <Tag color="processing">Marcado</Tag>}
          </Space>
          <Text type="secondary" style={{ fontSize: 11.5, fontFamily: FONTE_MONO }}>
            {formatarQuando(evento.quando)} · {evento.autorNome}
            {evento.atualizadoEm ? " · editado" : ""}
          </Text>
        </Flex>

        {podeEditar && (
          <Button size="small" icon={<EditOutlined />} onClick={aoEditar}>
            Editar
          </Button>
        )}
      </Flex>

      {evento.participantes && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Com: {evento.participantes}
        </Text>
      )}

      {evento.relato ? (
        <Text style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{evento.relato}</Text>
      ) : (
        /* Ausência de relato não é erro: o compromisso pode ainda não ter
           acontecido. Mas some quando já aconteceu, e aí vale dizer. */
        evento.estado === "realizado" && (
          <Text style={{ fontSize: 12, color: token.colorTextQuaternary }}>
            Sem relato.
          </Text>
        )
      )}

      {evento.anexo && (
        <Flex align="center" gap={6} wrap="wrap">
          <PaperClipOutlined style={{ color: token.colorTextTertiary, fontSize: 12 }} />
          <Typography.Link
            href={evento.anexo.url}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12 }}
          >
            {evento.anexo.titulo}
          </Typography.Link>
          {evento.anexo.relatorioTitulo && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              sobre {evento.anexo.relatorioTitulo}
            </Text>
          )}
        </Flex>
      )}

      <div>
        <Button
          size="small"
          type="text"
          icon={<CommentOutlined />}
          onClick={() => setComentariosAbertos((aberto) => !aberto)}
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
