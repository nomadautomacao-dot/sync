"use client";

import { useMemo, useState } from "react";
import {
  CheckCircleOutlined,
  CheckOutlined,
  EnvironmentOutlined,
  PaperClipOutlined,
  QuestionCircleOutlined,
  SendOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Empty,
  Flex,
  Input,
  Result,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  theme,
} from "antd";

import {
  TIPO_DE_POST_LABELS,
  podeResolver,
  repartirMural,
  type PostDoMural,
  type TipoDePost,
} from "@/core/domain/mural";
import { papelAlcanca } from "@/core/domain/rbac";
import {
  listarMural,
  listarRespostas,
  marcarResolvido,
  publicarNoMural,
  responder,
} from "@/core/lib/mural-firestore";
import { notificar } from "@/core/lib/notifications-firestore";
import { listCities } from "@/core/lib/cities-firestore";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { collaboratorInitials } from "@/core/lib/people-types";
import { useAuth } from "@/core/providers/auth-provider";

const { Text, Title } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

/**
 * O mural da equipe.
 *
 * A Caixa de entrada era só um log derivado de documentos e relatórios — leitura
 * de máquina, ninguém escrevia nela. O mural é o oposto: é onde as pessoas
 * falam. A auditoria continua existindo, na aba ao lado, porque ela responde
 * "quem emitiu o quê e quando", que a conversa não responde.
 */
export function Mural() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [tipo, setTipo] = useState<TipoDePost>("recado");
  const [texto, setTexto] = useState("");
  const [cityId, setCityId] = useState<string | undefined>();

  const chave = ["mural", user?.groupId];

  const {
    data: posts = [],
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: chave,
    queryFn: () => listarMural(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });

  const { data: cidades = [] } = useQuery({
    queryKey: ["cities", user?.groupId],
    queryFn: () => listCities(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
    staleTime: 5 * 60 * 1000,
  });

  const { emAberto, conversa } = useMemo(() => repartirMural(posts), [posts]);

  const publicar = useMutation({
    mutationFn: async () => {
      const cidade = cidades.find((c) => c.id === cityId);
      const db = getFirebaseDb();
      const post = await publicarNoMural(
        db,
        user!.groupId,
        {
          tipo,
          texto,
          cityId: cidade?.id,
          cityName: cidade ? `${cidade.name}/${cidade.uf}` : undefined,
        },
        { uid: user!.id, nome: user!.name },
      );
      /* Pergunta é a única coisa do mural que cobra alguém — recado não vira
         aviso. `notificar` engole a própria falha: o post já está publicado. */
      if (tipo === "pergunta") {
        await notificar(
          db,
          user!.groupId,
          {
            destinatarioUid: null,
            tipo: "pergunta_mural",
            titulo: "Pergunta no mural",
            resumo: texto.trim(),
            link: "/caixa",
          },
          { uid: user!.id, nome: user!.name },
        );
      }
      return post;
    },
    onSuccess: () => {
      setTexto("");
      setCityId(undefined);
      queryClient.invalidateQueries({ queryKey: chave });
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "Não foi possível publicar."),
  });

  const resolver = useMutation({
    mutationFn: ({ post, encerrar }: { post: PostDoMural; encerrar: boolean }) =>
      marcarResolvido(
        getFirebaseDb(),
        post.id,
        encerrar ? { uid: user!.id, nome: user!.name } : null,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chave }),
    onError: (e) => message.error(e instanceof Error ? e.message : "Não foi possível marcar."),
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
        title="Não foi possível carregar o mural"
        subTitle={error instanceof Error ? error.message : "Erro desconhecido."}
        extra={
          <Button type="primary" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        }
      />
    );
  }

  const ehAdmin = user ? papelAlcanca(user.groupRole, "admin") : false;

  const cartao = (post: PostDoMural) => (
    <PostDoMuralCard
      key={post.id}
      post={post}
      podeEncerrar={Boolean(user) && podeResolver(post, user!.id, ehAdmin)}
      aoResolver={(encerrar) => resolver.mutate({ post, encerrar })}
    />
  );

  return (
    <Flex vertical gap={14}>
      {/* ── Escrever ─────────────────────────────────────────────── */}
      <Card>
        <Flex vertical gap={10}>
          <Segmented<TipoDePost>
            value={tipo}
            onChange={setTipo}
            options={(["recado", "pergunta", "arquivo"] as const).map((t) => ({
              value: t,
              label: TIPO_DE_POST_LABELS[t],
            }))}
          />
          <Input.TextArea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder={
              tipo === "pergunta"
                ? "O que você precisa saber? Perguntas ficam no topo até alguém encerrar."
                : "O que a equipe precisa saber?"
            }
          />
          <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              value={cityId}
              onChange={setCityId}
              placeholder="Sobre alguma cidade? (opcional)"
              style={{ minWidth: 260 }}
              options={cidades.map((cidade) => ({
                value: cidade.id,
                label: `${cidade.name}/${cidade.uf}`,
              }))}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={publicar.isPending}
              disabled={!texto.trim()}
              onClick={() => publicar.mutate()}
            >
              Publicar
            </Button>
          </Flex>
        </Flex>
      </Card>

      {/* ── Perguntas em aberto ──────────────────────────────────── */}
      {emAberto.length > 0 && (
        <Card>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            title={`${emAberto.length} pergunta(s) esperando resposta`}
            description="A mais antiga vem primeiro. Quem perguntou (ou quem administra) encerra quando estiver respondida."
          />
          <Flex vertical gap={12}>{emAberto.map(cartao)}</Flex>
        </Card>
      )}

      {/* ── A conversa ───────────────────────────────────────────── */}
      {conversa.length === 0 && emAberto.length === 0 ? (
        <Card>
          <Empty
            description={
              <Flex vertical gap={4} align="center">
                <Text>O mural está vazio.</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Recados, perguntas e arquivos publicados aqui aparecem para a
                  equipe inteira — e ficam legíveis meses depois, ao contrário de
                  mensagem de aplicativo.
                </Text>
              </Flex>
            }
          />
        </Card>
      ) : (
        <Flex vertical gap={12}>{conversa.map(cartao)}</Flex>
      )}

      <Text type="secondary" style={{ fontSize: 11, textAlign: "center" }}>
        {/* O teto existe e é melhor dizê-lo do que deixar a pessoa achar que
            perdeu conteúdo. */}
        O mural mostra os 200 assuntos mais recentes.
      </Text>
    </Flex>
  );
}

function PostDoMuralCard({
  post,
  podeEncerrar,
  aoResolver,
}: {
  post: PostDoMural;
  podeEncerrar: boolean;
  aoResolver: (encerrar: boolean) => void;
}) {
  const { token } = theme.useToken();
  const { user } = useAuth();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [resposta, setResposta] = useState("");

  const chaveRespostas = ["mural-respostas", post.id];

  const { data: respostas = [], isPending } = useQuery({
    queryKey: chaveRespostas,
    queryFn: () => listarRespostas(getFirebaseDb(), user!.groupId, post.id),
    enabled: aberto && Boolean(user?.groupId),
  });

  const enviar = useMutation({
    mutationFn: () =>
      responder(getFirebaseDb(), user!.groupId, post.id, resposta, {
        uid: user!.id,
        nome: user!.name,
      }),
    onSuccess: () => {
      setResposta("");
      queryClient.invalidateQueries({ queryKey: chaveRespostas });
      queryClient.invalidateQueries({ queryKey: ["mural"] });
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "Não foi possível responder."),
  });

  return (
    <Card size="small">
      <Flex gap={10} align="flex-start">
        <Avatar
          size={32}
          style={{
            background: token.colorFillTertiary,
            color: token.colorText,
            fontSize: 11,
            fontFamily: FONTE_MONO,
            flexShrink: 0,
          }}
        >
          {collaboratorInitials(post.autorNome)}
        </Avatar>

        <Flex vertical gap={4} style={{ minWidth: 0, flex: 1 }}>
          <Space size={8} wrap>
            <Text strong style={{ fontSize: 13 }}>
              {post.autorNome}
            </Text>
            {post.tipo === "pergunta" && (
              <Tag icon={<QuestionCircleOutlined />} color={post.resolvidoEm ? "success" : "warning"}>
                {post.resolvidoEm ? "Respondida" : "Pergunta"}
              </Tag>
            )}
            {post.cityName && (
              <Tag icon={<EnvironmentOutlined />}>{post.cityName}</Tag>
            )}
            <Text type="secondary" style={{ fontSize: 11, fontFamily: FONTE_MONO }}>
              {formatarQuando(post.criadoEm)}
              {post.atualizadoEm ? " · editado" : ""}
            </Text>
          </Space>

          <Text style={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{post.texto}</Text>

          {post.anexo && (
            <Flex align="center" gap={6}>
              <PaperClipOutlined style={{ color: token.colorTextTertiary, fontSize: 12 }} />
              <Typography.Link
                href={post.anexo.url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12 }}
              >
                {post.anexo.titulo}
              </Typography.Link>
            </Flex>
          )}

          {post.resolvidoEm && post.resolvidoPor && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              Encerrada por {post.resolvidoPor}.
            </Text>
          )}

          <Space size={4} wrap>
            <Button size="small" type="text" onClick={() => setAberto((a) => !a)}>
              {post.respostas ? `${post.respostas} resposta(s)` : "Responder"}
            </Button>
            {podeEncerrar && (
              <Button
                size="small"
                type="text"
                icon={post.resolvidoEm ? <UndoOutlined /> : <CheckOutlined />}
                onClick={() => aoResolver(!post.resolvidoEm)}
              >
                {post.resolvidoEm ? "Reabrir" : "Marcar como respondida"}
              </Button>
            )}
          </Space>

          {aberto && (
            <Flex
              vertical
              gap={10}
              style={{
                marginTop: 8,
                paddingTop: 10,
                borderTop: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              {isPending ? (
                <Skeleton active paragraph={{ rows: 1 }} title={false} />
              ) : respostas.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Ninguém respondeu ainda.
                </Text>
              ) : (
                respostas.map((r) => (
                  <Flex key={r.id} vertical gap={2}>
                    <Space size={6} wrap>
                      <Text strong style={{ fontSize: 12 }}>
                        {r.autorNome}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11, fontFamily: FONTE_MONO }}>
                        {formatarQuando(r.criadoEm)}
                      </Text>
                    </Space>
                    <Text style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{r.texto}</Text>
                  </Flex>
                ))
              )}

              <Space.Compact style={{ width: "100%" }}>
                <Input
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  onPressEnter={() => resposta.trim() && enviar.mutate()}
                  placeholder="Responder…"
                  disabled={enviar.isPending}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={enviar.isPending}
                  disabled={!resposta.trim()}
                  onClick={() => enviar.mutate()}
                >
                  Enviar
                </Button>
              </Space.Compact>
            </Flex>
          )}
        </Flex>

        {post.resolvidoEm && (
          <CheckCircleOutlined style={{ color: token.colorSuccess, fontSize: 16 }} />
        )}
      </Flex>
    </Card>
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
