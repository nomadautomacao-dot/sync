"use client";

import { useState } from "react";
import { SendOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Avatar, Button, Flex, Input, Skeleton, Space, Typography, theme } from "antd";

import { collaboratorInitials } from "@/core/lib/people-types";
import { addComentario, listComentarios } from "@/core/lib/city-events-firestore";
import { notificar } from "@/core/lib/notifications-firestore";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";

const { Text } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

/**
 * A conversa em cima de um acontecimento.
 *
 * Sem isto a linha do tempo é um mural de avisos: cada um deixa o seu recado e
 * ninguém responde ao de ninguém. O comentário é o que transforma o registro em
 * assunto — e é o motivo declarado deste app existir.
 *
 * A consulta só dispara quando a pessoa abre os comentários. Com vinte eventos
 * na tela, carregar todos de saída seriam vinte consultas para exibir texto que
 * quase ninguém vai ler naquele momento.
 */
export function ComentariosDoEvento({
  cityId,
  eventoId,
  autorDoEvento,
}: {
  cityId: string;
  eventoId: string;
  /** Dono do registro: é quem recebe o aviso de comentário novo. */
  autorDoEvento: { uid: string; nome: string };
}) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState("");

  const chave = ["city-event-comments", cityId, eventoId];

  const { data: comentarios = [], isPending } = useQuery({
    queryKey: chave,
    queryFn: () => listComentarios(getFirebaseDb(), user!.groupId, cityId, eventoId),
    enabled: Boolean(user?.groupId),
  });

  const comentar = useMutation({
    mutationFn: async (conteudo: string) => {
      const db = getFirebaseDb();
      const autor = { uid: user!.id, nome: user!.name };
      await addComentario(db, user!.groupId, cityId, eventoId, conteudo, autor);
      // Comentar no próprio registro não avisa ninguém — a pessoa sabe o que fez.
      if (autorDoEvento.uid && autorDoEvento.uid !== user!.id) {
        await notificar(
          db,
          user!.groupId,
          {
            destinatarioUid: autorDoEvento.uid,
            tipo: "comentario_evento",
            titulo: "Comentário no seu registro",
            resumo: conteudo.trim(),
            link: `/cidades/${cityId}`,
          },
          autor,
        );
      }
    },
    onSuccess: () => {
      setTexto("");
      queryClient.invalidateQueries({ queryKey: chave });
      queryClient.invalidateQueries({ queryKey: ["city-events", cityId] });
    },
    onError: (erro) =>
      message.error(erro instanceof Error ? erro.message : "Não foi possível comentar."),
  });

  const enviar = () => {
    const limpo = texto.trim();
    if (limpo) comentar.mutate(limpo);
  };

  return (
    <Flex
      vertical
      gap={12}
      style={{
        marginTop: 12,
        paddingTop: 12,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      {isPending ? (
        <Skeleton active paragraph={{ rows: 2 }} title={false} />
      ) : comentarios.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Nenhum comentário ainda.
        </Text>
      ) : (
        comentarios.map((comentario) => (
          <Flex key={comentario.id} gap={8} align="flex-start">
            <Avatar
              size={24}
              style={{
                background: token.colorFillTertiary,
                color: token.colorText,
                fontSize: 10,
                fontFamily: FONTE_MONO,
                flexShrink: 0,
              }}
            >
              {collaboratorInitials(comentario.autorNome)}
            </Avatar>
            <Flex vertical gap={2} style={{ minWidth: 0 }}>
              <Space size={6} wrap>
                <Text strong style={{ fontSize: 12 }}>
                  {comentario.autorNome}
                </Text>
                <Text type="secondary" style={{ fontSize: 11, fontFamily: FONTE_MONO }}>
                  {formatarQuando(comentario.criadoEm)}
                </Text>
              </Space>
              <Text style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{comentario.texto}</Text>
            </Flex>
          </Flex>
        ))
      )}

      <Space.Compact style={{ width: "100%" }}>
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onPressEnter={enviar}
          placeholder="Comentar…"
          disabled={comentar.isPending}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={comentar.isPending}
          disabled={!texto.trim()}
          onClick={enviar}
        >
          Enviar
        </Button>
      </Space.Compact>
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
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}
