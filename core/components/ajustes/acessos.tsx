"use client";

import { useMemo, useState } from "react";
import {
  KeyOutlined,
  StopOutlined,
  UndoOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import {
  Alert,
  App,
  Button,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Result,
  Select,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
} from "antd";

import { apiFetch } from "@/core/lib/api-client";
import type { UsuariaDeAcesso } from "@/core/lib/acessos";
import {
  GradeDePermissoes,
  contarLiberadas,
  papeisDisponiveis,
  resumoDeAreas,
} from "@/core/components/acessos/grade-de-permissoes";
import { ModalDoLink } from "@/core/components/acessos/modal-do-link";
import {
  AREAS,
  GROUP_ROLE_LABELS,
  ajustesParaClaim,
  permissoesPadrao,
  type GroupRole,
  type Permissoes,
} from "@/core/domain/rbac";

const { Text } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

interface RespostaLista {
  usuarias: UsuariaDeAcesso[];
}

interface RespostaProvisionamento {
  usuaria: UsuariaDeAcesso;
  jaExistia: boolean;
  linkDeSenha: string;
}

/**
 * Concessão de acesso — tela do perfil técnico (dona e administradora).
 *
 * O que ela mostra é quem entra no sistema e até onde vai; nada aqui é para
 * girar o notebook na frente de gestor municipal.
 */
export function Acessos({ papelDeQuemEdita, uidDeQuemEdita }: {
  papelDeQuemEdita: GroupRole;
  uidDeQuemEdita: string;
}) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const queryClient = useQueryClient();

  const [convidarAberto, setConvidarAberto] = useState(false);
  const [editando, setEditando] = useState<UsuariaDeAcesso | null>(null);
  const [linkGerado, setLinkGerado] = useState<{ email: string; link: string } | null>(null);

  const {
    data,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["acessos"],
    queryFn: () => apiFetch<RespostaLista>("/api/acessos"),
    staleTime: 5 * 60 * 1000,
  });

  const usuarias = useMemo(() => data?.usuarias ?? [], [data]);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["acessos"] });

  const salvar = useMutation({
    mutationFn: ({ uid, corpo }: { uid: string; corpo: Record<string, unknown> }) =>
      apiFetch<{ usuaria: UsuariaDeAcesso }>(`/api/acessos/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      }),
    onSuccess: () => {
      invalidar();
      setEditando(null);
      message.success("Acesso salvo. Vale quando ela entrar de novo no sistema.");
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const gerarLink = useMutation({
    mutationFn: (usuaria: UsuariaDeAcesso) =>
      apiFetch<{ linkDeSenha: string }>(`/api/acessos/${usuaria.uid}`, { method: "POST" }).then(
        (r) => ({ email: usuaria.email, link: r.linkDeSenha }),
      ),
    onSuccess: setLinkGerado,
    onError: (e) => message.error(e instanceof Error ? e.message : "Falha ao gerar o link."),
  });

  const colunas: ProColumns<UsuariaDeAcesso>[] = [
    {
      title: "Pessoa",
      dataIndex: "nome",
      sorter: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
      render: (_, r) => (
        <Flex vertical gap={0}>
          <Text strong style={{ fontSize: 13 }} delete={r.desativada}>
            {r.nome}
          </Text>
          <Text type="secondary" style={{ fontSize: 11.5, fontFamily: FONTE_MONO }}>
            {r.email}
          </Text>
        </Flex>
      ),
    },
    {
      title: "Papel",
      dataIndex: "groupRole",
      width: 150,
      sorter: (a, b) => a.groupRole.localeCompare(b.groupRole),
      render: (_, r) => <Tag>{GROUP_ROLE_LABELS[r.groupRole]}</Tag>,
    },
    {
      title: "Áreas liberadas",
      width: 160,
      align: "right",
      sorter: (a, b) => contarLiberadas(a.permissoes) - contarLiberadas(b.permissoes),
      render: (_, r) => {
        const total = contarLiberadas(r.permissoes);
        return (
          <Tooltip title={resumoDeAreas(r.permissoes)}>
            <Text
              style={{
                fontFamily: FONTE_MONO,
                fontSize: 12,
                color: total === 0 ? token.colorTextQuaternary : token.colorText,
              }}
            >
              {total} de {AREAS.length}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: "Último acesso",
      dataIndex: "ultimoAcessoEm",
      width: 140,
      align: "right",
      sorter: (a, b) => (a.ultimoAcessoEm ?? "").localeCompare(b.ultimoAcessoEm ?? ""),
      render: (_, r) => (
        <Text
          style={{
            fontFamily: FONTE_MONO,
            fontSize: 12,
            color: r.ultimoAcessoEm ? token.colorText : token.colorTextQuaternary,
          }}
        >
          {/* Nunca entrou é ausência, não zero. */}
          {r.ultimoAcessoEm ? formatarData(r.ultimoAcessoEm) : "—"}
        </Text>
      ),
    },
    {
      title: "Situação",
      dataIndex: "desativada",
      width: 110,
      align: "center",
      render: (_, r) =>
        r.desativada ? <Tag color="red">Desativada</Tag> : <Tag color="green">Ativa</Tag>,
    },
    {
      title: "",
      width: 220,
      align: "right",
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" onClick={() => setEditando(r)}>
            Permissões
          </Button>
          <Tooltip title="Gera um link para ela mesma definir a senha">
            <Button
              size="small"
              icon={<KeyOutlined />}
              loading={gerarLink.isPending}
              onClick={() => gerarLink.mutate(r)}
            />
          </Tooltip>
          <Popconfirm
            title={r.desativada ? "Reativar o acesso?" : "Desativar o acesso?"}
            description={
              r.desativada
                ? "Ela volta a entrar com a senha que já tinha."
                : "Ela deixa de entrar. A conta e o histórico ficam."
            }
            okText={r.desativada ? "Reativar" : "Desativar"}
            cancelText="Cancelar"
            onConfirm={() =>
              salvar.mutate({ uid: r.uid, corpo: { desativada: !r.desativada } })
            }
            disabled={r.uid === uidDeQuemEdita}
          >
            <Tooltip
              title={
                r.uid === uidDeQuemEdita
                  ? "Você não pode desativar a própria conta"
                  : r.desativada
                    ? "Reativar"
                    : "Desativar"
              }
            >
              <Button
                size="small"
                danger={!r.desativada}
                disabled={r.uid === uidDeQuemEdita}
                icon={r.desativada ? <UndoOutlined /> : <StopOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (isPending) return <Skeleton active paragraph={{ rows: 6 }} />;

  if (error) {
    return (
      <Result
        status="warning"
        title="Não foi possível carregar os acessos"
        subTitle={error instanceof Error ? error.message : "Erro desconhecido."}
        extra={
          <Button type="primary" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        }
      />
    );
  }

  return (
    <Flex vertical gap={12} style={{ paddingTop: 8 }}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Quem entra no sistema e até onde vai. Toda mudança de permissão passa a
          valer quando a pessoa entrar de novo — o crachá dela é o token, e o
          token só se renova no próximo login.
        </Text>
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          onClick={() => setConvidarAberto(true)}
        >
          Conceder acesso
        </Button>
      </Flex>

      <ProTable<UsuariaDeAcesso>
        rowKey="uid"
        size="small"
        dataSource={usuarias}
        columns={colunas}
        pagination={false}
        search={false}
        options={false}
        scroll={{ x: 900 }}
        locale={{
          emptyText: (
            <Flex vertical gap={8} align="center" style={{ padding: 24 }}>
              <Text type="secondary">Ninguém além de você tem acesso ainda.</Text>
              <Button type="primary" icon={<UserAddOutlined />} onClick={() => setConvidarAberto(true)}>
                Conceder o primeiro acesso
              </Button>
            </Flex>
          ),
        }}
      />

      {convidarAberto && (
        <ModalDeConcessao
          papelDeQuemEdita={papelDeQuemEdita}
          aoFechar={() => setConvidarAberto(false)}
          aoConceder={(resposta) => {
            invalidar();
            setConvidarAberto(false);
            setLinkGerado({ email: resposta.usuaria.email, link: resposta.linkDeSenha });
            message.success(
              resposta.jaExistia
                ? "Conta que já existia foi vinculada ao grupo."
                : "Acesso criado.",
            );
          }}
        />
      )}

      {editando && (
        <ModalDePermissoes
          usuaria={editando}
          papelDeQuemEdita={papelDeQuemEdita}
          ehEuMesma={editando.uid === uidDeQuemEdita}
          salvando={salvar.isPending}
          aoFechar={() => setEditando(null)}
          aoSalvar={(corpo) => salvar.mutate({ uid: editando.uid, corpo })}
        />
      )}

      {linkGerado && (
        <ModalDoLink
          email={linkGerado.email}
          link={linkGerado.link}
          aoFechar={() => setLinkGerado(null)}
        />
      )}
    </Flex>
  );
}

// ── Concessão ────────────────────────────────────────────────────────────

function ModalDeConcessao({
  papelDeQuemEdita,
  aoFechar,
  aoConceder,
}: {
  papelDeQuemEdita: GroupRole;
  aoFechar: () => void;
  aoConceder: (resposta: RespostaProvisionamento) => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [papel, setPapel] = useState<GroupRole>("member");
  const [permissoes, setPermissoes] = useState<Permissoes>(permissoesPadrao("member"));

  const conceder = useMutation({
    mutationFn: (valores: { nome: string; email: string }) =>
      apiFetch<RespostaProvisionamento>("/api/acessos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...valores,
          groupRole: papel,
          permissoes: ajustesParaClaim(papel, permissoes),
        }),
      }),
    onSuccess: aoConceder,
    onError: (e) => message.error(e instanceof Error ? e.message : "Falha ao conceder."),
  });

  const trocarPapel = (novo: GroupRole) => {
    setPapel(novo);
    // Trocar o papel redefine a grade: o padrão do papel novo é o ponto de
    // partida certo, e manter ajustes do papel anterior confunde mais que ajuda.
    setPermissoes(permissoesPadrao(novo));
  };

  return (
    <Modal
      open
      title="Conceder acesso"
      okText="Conceder"
      cancelText="Cancelar"
      confirmLoading={conceder.isPending}
      onCancel={aoFechar}
      onOk={() => form.submit()}
      width={720}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={(v) => conceder.mutate(v)}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="A senha não passa por aqui"
          description="O sistema cria a conta sem senha e devolve um link para ela mesma definir a dela. Se já houver conta com esse e-mail, ela é vinculada ao grupo e a senha atual não é tocada."
        />

        <Flex gap={12} wrap="wrap">
          <Form.Item
            name="nome"
            label="Nome"
            style={{ flex: "1 1 240px" }}
            rules={[{ required: true, message: "Informe o nome." }]}
          >
            <Input placeholder="Maria Souza" autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="email"
            label="E-mail"
            style={{ flex: "1 1 240px" }}
            rules={[
              { required: true, message: "Informe o e-mail." },
              { type: "email", message: "E-mail inválido." },
            ]}
          >
            <Input placeholder="maria@globalcompany.com.br" autoComplete="off" />
          </Form.Item>
        </Flex>

        <Form.Item label="Papel">
          <Select
            value={papel}
            onChange={trocarPapel}
            options={papeisDisponiveis(papelDeQuemEdita).map((p) => ({
              value: p,
              label: GROUP_ROLE_LABELS[p],
            }))}
          />
        </Form.Item>
      </Form>

      <GradeDePermissoes papel={papel} valor={permissoes} aoMudar={setPermissoes} />
    </Modal>
  );
}

// ── Edição de permissões ─────────────────────────────────────────────────

function ModalDePermissoes({
  usuaria,
  papelDeQuemEdita,
  ehEuMesma,
  salvando,
  aoFechar,
  aoSalvar,
}: {
  usuaria: UsuariaDeAcesso;
  papelDeQuemEdita: GroupRole;
  ehEuMesma: boolean;
  salvando: boolean;
  aoFechar: () => void;
  aoSalvar: (corpo: Record<string, unknown>) => void;
}) {
  const [papel, setPapel] = useState<GroupRole>(usuaria.groupRole);
  const [permissoes, setPermissoes] = useState<Permissoes>(usuaria.permissoes);

  const trocarPapel = (novo: GroupRole) => {
    setPapel(novo);
    setPermissoes(permissoesPadrao(novo));
  };

  return (
    <Modal
      open
      title={`Permissões de ${usuaria.nome}`}
      okText="Salvar"
      cancelText="Cancelar"
      confirmLoading={salvando}
      onCancel={aoFechar}
      onOk={() =>
        aoSalvar({ groupRole: papel, permissoes: ajustesParaClaim(papel, permissoes) })
      }
      width={720}
      destroyOnHidden
    >
      <Flex vertical gap={12}>
        <Flex gap={12} align="center" wrap="wrap">
          <Text type="secondary" style={{ fontSize: 12 }}>
            Papel
          </Text>
          <Select
            value={papel}
            onChange={trocarPapel}
            style={{ minWidth: 200 }}
            disabled={ehEuMesma}
            options={papeisDisponiveis(papelDeQuemEdita).map((p) => ({
              value: p,
              label: GROUP_ROLE_LABELS[p],
            }))}
          />
          {ehEuMesma && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Você não pode mudar o próprio papel.
            </Text>
          )}
        </Flex>

        <GradeDePermissoes papel={papel} valor={permissoes} aoMudar={setPermissoes} />
      </Flex>
    </Modal>
  );
}

// ── Apoio ────────────────────────────────────────────────────────────────

function formatarData(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? "—"
    : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
