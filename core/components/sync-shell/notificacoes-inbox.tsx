"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircleOutlined,
  CommentOutlined,
  ExclamationCircleOutlined,
  NotificationOutlined,
  QuestionCircleOutlined,
  ScheduleOutlined,
} from "@ant-design/icons";
import { App, Badge, Button, Empty, Flex, Popover, Skeleton, Tag, Typography, theme } from "antd";

import { naoLidas, type Notificacao, type TipoDeNotificacao } from "@/core/domain/notificacoes";
import {
  lerUltimaLeitura,
  listarNotificacoes,
  marcarComoLida,
  marcarTodasComoLidas,
} from "@/core/lib/notifications-firestore";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";

const { Text } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

/* Sem `onSnapshot` de propósito: tempo real é a fase 5 do roadmap. O intervalo
   de 45s segura o badge "quase ao vivo" sem custo de leitura por escrita. */
const INTERVALO_DE_ATUALIZACAO = 45_000;

const ICONES: Record<TipoDeNotificacao, React.ComponentType<{ style?: React.CSSProperties }>> = {
  pergunta_mural: QuestionCircleOutlined,
  comentario_evento: CommentOutlined,
  etapa_atribuida: ScheduleOutlined,
  emissao_concluida: CheckCircleOutlined,
  emissao_erro: ExclamationCircleOutlined,
};

interface CaixaDeNotificacoes {
  notificacoes: Notificacao[];
  ultimaLeituraEm: string | null;
}

/**
 * O sino do inbox.
 *
 * Montado em dois lugares com a mesma caixa: no `SyncHeader` (que só existe no
 * painel) e na barra lateral (que está em todas as telas). Foi assim, e não com
 * o header no shell inteiro, porque a decisão de tirar a barra das telas de
 * trabalho está documentada em `app/(sync)/layout.tsx` — 74px de altura por
 * tela, numa tabela, é uma linha e meia de município. A lateral resolve o
 * "acessível de qualquer tela" sem desfazer aquilo.
 */
export function SinoDeNotificacoes({
  aparencia,
  compacta = false,
}: {
  aparencia: "cabecalho" | "lateral";
  /** Só vale na lateral: barra recolhida mostra o ícone sem o rótulo. */
  compacta?: boolean;
}) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);

  const chave = ["notificacoes", user?.groupId, user?.id];

  const { data, isPending } = useQuery<CaixaDeNotificacoes>({
    queryKey: chave,
    queryFn: async () => {
      const db = getFirebaseDb();
      const [notificacoes, ultimaLeituraEm] = await Promise.all([
        listarNotificacoes(db, user!.groupId, user!.id),
        lerUltimaLeitura(db, user!.groupId, user!.id),
      ]);
      return { notificacoes, ultimaLeituraEm };
    },
    enabled: Boolean(user?.groupId && user?.id),
    refetchInterval: INTERVALO_DE_ATUALIZACAO,
  });

  const notificacoes = data?.notificacoes ?? [];
  const ultimaLeituraEm = data?.ultimaLeituraEm ?? null;
  const pendentes = user ? naoLidas(notificacoes, user.id, ultimaLeituraEm) : [];

  const invalidar = () => queryClient.invalidateQueries({ queryKey: chave });

  const abrir = useMutation({
    mutationFn: async (notificacao: Notificacao) => {
      // Pessoal: marca no documento. De grupo: o "lido" é o carimbo, e ele anda
      // só no "marcar todas" — clicar numa de grupo não esvazia o inbox alheio.
      if (notificacao.destinatarioUid !== null && !notificacao.lida) {
        await marcarComoLida(getFirebaseDb(), notificacao.id);
      }
    },
    onSuccess: (_v, notificacao) => {
      invalidar();
      setAberto(false);
      if (notificacao.link) router.push(notificacao.link);
    },
    onError: () => message.error("Não foi possível abrir a notificação."),
  });

  const marcarTodas = useMutation({
    mutationFn: () =>
      marcarTodasComoLidas(
        getFirebaseDb(),
        user!.groupId,
        user!.id,
        pendentes.filter((n) => n.destinatarioUid !== null),
        new Date(),
      ),
    onSuccess: invalidar,
    onError: () => message.error("Não foi possível marcar como lidas."),
  });

  const gatilho =
    aparencia === "cabecalho" ? (
      <Badge count={pendentes.length} size="small" offset={[-4, 4]}>
        <Button
          type="text"
          shape="circle"
          icon={<NotificationOutlined />}
          aria-label={
            pendentes.length
              ? `${pendentes.length} notificações não lidas`
              : "Notificações"
          }
          aria-expanded={aberto}
        />
      </Badge>
    ) : (
      <Button
        type="text"
        block
        icon={
          <Badge count={pendentes.length} size="small">
            <NotificationOutlined />
          </Badge>
        }
        aria-label={
          pendentes.length
            ? `${pendentes.length} notificações não lidas`
            : "Notificações"
        }
        aria-expanded={aberto}
        style={
          compacta
            ? undefined
            : { display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 8 }
        }
      >
        {!compacta && <span style={{ flex: 1, textAlign: "left" }}>Notificações</span>}
      </Button>
    );

  return (
    <Popover
      open={aberto}
      onOpenChange={setAberto}
      trigger="click"
      placement={aparencia === "cabecalho" ? "bottomRight" : "topLeft"}
      styles={{ content: { padding: 0, width: "min(380px, calc(100vw - 24px))" } }}
      content={
        <div>
          <Flex
            align="center"
            justify="space-between"
            gap={8}
            style={{ padding: "12px 16px", borderBottom: `1px solid ${token.colorBorderSecondary}` }}
          >
            <div>
              <Text strong style={{ display: "block", fontSize: 14 }}>
                Notificações
              </Text>
              <Text type="secondary" style={{ display: "block", fontSize: 10, marginTop: 2 }}>
                As suas e as do grupo
              </Text>
            </div>
            {pendentes.length > 0 && (
              <Button
                size="small"
                type="link"
                loading={marcarTodas.isPending}
                onClick={() => marcarTodas.mutate()}
              >
                Marcar todas como lidas
              </Button>
            )}
          </Flex>

          <div style={{ maxHeight: "min(430px, calc(100vh - 180px))", overflowY: "auto" }}>
            {isPending ? (
              <div style={{ padding: 24 }}>
                <Skeleton active title={false} paragraph={{ rows: 3 }} />
              </div>
            ) : notificacoes.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Nenhuma notificação por aqui."
                style={{ padding: 28 }}
              />
            ) : (
              <Flex vertical gap={2} style={{ padding: 6 }}>
                {notificacoes.map((notificacao) => {
                  const lida = !pendentes.some((n) => n.id === notificacao.id);
                  const Icone = ICONES[notificacao.tipo];
                  return (
                    <Flex
                      key={notificacao.id}
                      gap={10}
                      align="flex-start"
                      onClick={() => abrir.mutate(notificacao)}
                      style={{
                        cursor: "pointer",
                        padding: "8px 10px",
                        borderRadius: token.borderRadiusLG,
                        background: lida ? undefined : token.colorFillTertiary,
                      }}
                    >
                      <Icone
                        style={{
                          marginTop: 3,
                          color:
                            notificacao.tipo === "emissao_erro"
                              ? token.colorError
                              : token.colorTextSecondary,
                        }}
                      />
                      <Flex vertical gap={2} style={{ minWidth: 0, flex: 1 }}>
                        <Text strong={!lida} ellipsis style={{ fontSize: 12, display: "block" }}>
                          {notificacao.titulo}
                        </Text>
                        {notificacao.resumo && (
                          <Text type="secondary" ellipsis style={{ fontSize: 11, display: "block" }}>
                            {notificacao.resumo}
                          </Text>
                        )}
                        <Text type="secondary" style={{ fontSize: 9.5, fontFamily: FONTE_MONO }}>
                          {notificacao.origemNome ? `${notificacao.origemNome} · ` : ""}
                          {formatarQuando(notificacao.criadoEm)}
                          {notificacao.destinatarioUid === null && (
                            <Tag style={{ marginInlineStart: 6, fontSize: 9, lineHeight: "14px" }}>
                              equipe
                            </Tag>
                          )}
                        </Text>
                      </Flex>
                      {!lida && <Badge status="processing" style={{ marginTop: 6 }} />}
                    </Flex>
                  );
                })}
              </Flex>
            )}
          </div>
        </div>
      }
    >
      {gatilho}
    </Popover>
  );
}

function formatarQuando(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? "—"
    : data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}
