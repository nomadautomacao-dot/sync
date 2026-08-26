"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  SyncOutlined,
  UserAddOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  Empty,
  Popconfirm,
  Result,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  theme,
} from "antd";

import { podeAdministrarSistemas } from "@/core/domain/rbac";
import {
  papelDoSistema,
  statusDaPrefeitura,
  type PrefeituraDoConsole,
  type UsuarioDoConsole,
} from "@/core/domain/sistemas";
import { useAuth } from "@/core/providers/auth-provider";

import { DialogoPrefeitura, type ValoresDaPrefeitura } from "../_components/dialogo-prefeitura";
import { DialogoUsuario, type ValoresDoUsuario } from "../_components/dialogo-usuario";
import * as api from "../_lib/api";

const { Text, Title, Paragraph } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

const dataCurta = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
const dataHora = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const mensagemDe = (e: unknown, padrao: string) =>
  e instanceof Error && e.message ? e.message : padrao;

/**
 * Administração de um produto Global.
 *
 * Três abas, na ordem em que o trabalho acontece: cadastra-se a prefeitura,
 * cria-se o acesso de quem vai operar, e o registro guarda o que foi feito.
 */
export default function SistemaPage({ params }: { params: Promise<{ sistema: string }> }) {
  const { sistema: sistemaId } = use(params);
  const { user, loading: carregandoSessao } = useAuth();
  const { message, modal } = App.useApp();
  const { token } = theme.useToken();
  const queryClient = useQueryClient();
  const autorizado = podeAdministrarSistemas(user?.groupRole);

  const [aba, setAba] = useState("prefeituras");
  const [prefeituraEmEdicao, setPrefeituraEmEdicao] = useState<PrefeituraDoConsole | null>(null);
  const [dialogoPrefeitura, setDialogoPrefeitura] = useState(false);
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<UsuarioDoConsole | null>(null);
  const [dialogoUsuario, setDialogoUsuario] = useState(false);

  const sistemaQuery = useQuery({
    queryKey: ["sistema", sistemaId],
    queryFn: () => api.obterSistema(sistemaId),
    enabled: autorizado,
  });
  const sistema = sistemaQuery.data;

  const prefeiturasQuery = useQuery({
    queryKey: ["sistema", sistemaId, "prefeituras"],
    queryFn: () => api.listarPrefeituras(sistemaId),
    enabled: autorizado && Boolean(sistema),
  });
  const prefeituras = useMemo(() => prefeiturasQuery.data ?? [], [prefeiturasQuery.data]);

  const usuariosQuery = useQuery({
    queryKey: ["sistema", sistemaId, "usuarios"],
    queryFn: () => api.listarUsuarios(sistemaId),
    enabled: autorizado && Boolean(sistema),
  });
  const usuarios = useMemo(() => usuariosQuery.data ?? [], [usuariosQuery.data]);

  const registroQuery = useQuery({
    queryKey: ["sistema", sistemaId, "registro"],
    queryFn: () => api.listarRegistro(sistemaId),
    enabled: autorizado && aba === "registro",
  });

  const recarregar = (...chaves: string[]) => {
    queryClient.invalidateQueries({ queryKey: ["sistema", sistemaId] });
    queryClient.invalidateQueries({ queryKey: ["sistemas"] });
    for (const chave of chaves) queryClient.invalidateQueries({ queryKey: [chave] });
  };

  /** O link nunca vai para o log nem para o clipboard sozinho: quem o tem, entra na conta. */
  const mostrarLinkDeSenha = (email: string, link: string) => {
    modal.info({
      title: "Link de definição de senha",
      width: 620,
      icon: <KeyOutlined />,
      content: (
        <Space orientation="vertical" size="middle" style={{ width: "100%", marginTop: 12 }}>
          <Paragraph style={{ marginBottom: 0 }}>
            Entregue este link a <Text strong>{email}</Text>. Vale por uma hora e serve uma vez só.
          </Paragraph>
          <Text
            code
            copyable={{ text: link, icon: <CopyOutlined /> }}
            style={{ fontFamily: FONTE_MONO, fontSize: 11, wordBreak: "break-all" }}
          >
            {link}
          </Text>
          <Alert
            type="warning"
            showIcon
            title="Quem tiver este link define a senha da conta."
            description="O Sync não envia e-mail: a entrega é sua. Mande por um canal direto e não guarde o link depois."
          />
        </Space>
      ),
    });
  };

  const salvarPrefeitura = useMutation({
    mutationFn: (valores: ValoresDaPrefeitura) =>
      prefeituraEmEdicao
        ? api.salvarPrefeitura(sistemaId, prefeituraEmEdicao.slug, valores)
        : api.criarPrefeitura(sistemaId, valores),
    onSuccess: (p) => {
      setDialogoPrefeitura(false);
      setPrefeituraEmEdicao(null);
      recarregar();
      message.success(`${p.nome} salva.`);
    },
    onError: (e) => message.error(mensagemDe(e, "Não foi possível salvar a prefeitura.")),
  });

  const salvarUsuario = useMutation({
    mutationFn: async (valores: ValoresDoUsuario) => {
      if (usuarioEmEdicao) {
        return {
          usuario: await api.salvarUsuario(sistemaId, usuarioEmEdicao.id, {
            nome: valores.nome,
            papel: valores.papel,
            prefeitura: valores.prefeitura,
            prefeituras: valores.prefeituras?.length ? valores.prefeituras : [valores.prefeitura],
            ativo: valores.ativo,
          }),
          contaNova: false,
        } satisfies api.RespostaDoProvisionamento;
      }
      return api.criarUsuario(sistemaId, {
        email: valores.email,
        nome: valores.nome,
        papel: valores.papel,
        prefeitura: valores.prefeitura,
        prefeituras: valores.prefeituras?.length ? valores.prefeituras : undefined,
        senha: valores.senha?.trim() ? valores.senha : undefined,
      });
    },
    onSuccess: (r) => {
      setDialogoUsuario(false);
      setUsuarioEmEdicao(null);
      recarregar();
      message.success(
        r.contaNova
          ? `Acesso criado para ${r.usuario.email}.`
          : `${r.usuario.email} atualizado.`,
      );
      if (r.linkDeSenha) mostrarLinkDeSenha(r.usuario.email, r.linkDeSenha);
    },
    onError: (e) => message.error(mensagemDe(e, "Não foi possível salvar o usuário.")),
  });

  const ressincronizar = useMutation({
    mutationFn: (uid: string) => api.ressincronizarClaims(sistemaId, uid),
    onSuccess: (u) => {
      recarregar();
      message.success(
        `Token de ${u.email} regravado. A pessoa precisa sair e entrar de novo para o novo acesso valer.`,
      );
    },
    onError: (e) => message.error(mensagemDe(e, "Não foi possível ressincronizar.")),
  });

  const novoLink = useMutation({
    mutationFn: (u: UsuarioDoConsole) =>
      api.gerarLinkDeSenha(sistemaId, u.id, u.email).then((r) => ({ email: u.email, ...r })),
    onSuccess: ({ email, link }) => mostrarLinkDeSenha(email, link),
    onError: (e) => message.error(mensagemDe(e, "Não foi possível gerar o link.")),
  });

  const revogar = useMutation({
    mutationFn: (uid: string) => api.revogarAcesso(sistemaId, uid),
    onSuccess: () => {
      recarregar();
      message.success("Acesso a este sistema revogado. A conta e os outros produtos seguem intactos.");
    },
    onError: (e) => message.error(mensagemDe(e, "Não foi possível revogar o acesso.")),
  });

  if (carregandoSessao || (autorizado && sistemaQuery.isPending)) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  if (!autorizado) {
    return (
      <Result
        status="403"
        title="Área restrita"
        subTitle="O console de sistemas é de administradores do grupo."
      />
    );
  }

  if (sistemaQuery.isError || !sistema) {
    return (
      <Result
        status="404"
        title="Sistema não encontrado"
        subTitle={mensagemDe(sistemaQuery.error, `Não existe o sistema "${sistemaId}" no catálogo.`)}
        extra={
          <Link href="/sistemas">
            <Button type="primary">Voltar aos sistemas</Button>
          </Link>
        }
      />
    );
  }

  const colunasDePrefeitura: ProColumns<PrefeituraDoConsole>[] = [
    {
      title: "Município",
      dataIndex: "nome",
      sorter: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
      render: (_, p) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{p.nome}</Text>
          <Text type="secondary" style={{ fontFamily: FONTE_MONO, fontSize: 11 }}>
            {p.slug}
          </Text>
        </Space>
      ),
    },
    { title: "UF", dataIndex: "uf", width: 70, search: false },
    {
      title: "Situação",
      dataIndex: "status",
      width: 130,
      search: false,
      render: (_, p) => {
        const s = statusDaPrefeitura(sistema, p.status);
        return <Tag color={s.cor}>{s.rotulo}</Tag>;
      },
    },
    {
      title: "Usuários",
      width: 90,
      search: false,
      align: "right",
      render: (_, p) => (
        <Text style={{ fontFamily: FONTE_MONO }}>
          {usuarios.filter((u) => u.prefeituras.includes(p.slug)).length}
        </Text>
      ),
    },
    {
      title: "IBGE",
      dataIndex: "codigoIbge",
      width: 100,
      search: false,
      render: (_, p) => (
        <Text style={{ fontFamily: FONTE_MONO }} type={p.codigoIbge ? undefined : "secondary"}>
          {p.codigoIbge ?? "—"}
        </Text>
      ),
    },
    {
      title: "Criada em",
      dataIndex: "criadoEm",
      width: 110,
      search: false,
      render: (_, p) => <Text type="secondary">{dataCurta(p.criadoEm)}</Text>,
    },
    {
      title: "",
      width: 80,
      search: false,
      render: (_, p) => (
        <Button
          type="link"
          size="small"
          onClick={() => {
            setPrefeituraEmEdicao(p);
            setDialogoPrefeitura(true);
          }}
        >
          Editar
        </Button>
      ),
    },
  ];

  const colunasDeUsuario: ProColumns<UsuarioDoConsole>[] = [
    {
      title: "Pessoa",
      dataIndex: "nome",
      sorter: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
      render: (_, u) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{u.nome}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {u.email}
          </Text>
        </Space>
      ),
    },
    {
      title: "Papel",
      dataIndex: "papel",
      width: 190,
      search: false,
      filters: sistema.papeis.map((p) => ({ text: p.rotulo, value: p.id })),
      onFilter: (valor, u) => u.papel === valor,
      render: (_, u) => {
        const p = papelDoSistema(sistema, u.papel);
        return (
          <Tooltip title={p?.descricao}>
            <Tag color={p?.irrestrito ? "warning" : "default"}>{p?.rotulo ?? u.papel}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Prefeituras",
      width: 200,
      search: false,
      render: (_, u) => (
        <Space size={4} wrap>
          {u.prefeituras.length === 0 && <Text type="secondary">—</Text>}
          {u.prefeituras.map((slug) => (
            <Tag
              key={slug}
              style={{ fontFamily: FONTE_MONO, fontSize: 11 }}
              color={slug === u.prefeitura ? "processing" : "default"}
            >
              {slug}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "Situação",
      width: 190,
      search: false,
      render: (_, u) => (
        <Space orientation="vertical" size={2}>
          <Tag color={u.ativo ? "success" : "default"}>{u.ativo ? "Ativo" : "Bloqueado"}</Tag>
          {/* Os dois defeitos que explicam quase todo "não consigo entrar". */}
          {u.temConta === false && (
            <Tooltip title="Há documento no banco, mas nenhuma conta no Firebase com este uid. A pessoa não consegue entrar. Cadastre-a de novo pelo mesmo e-mail.">
              <Tag icon={<ExclamationCircleOutlined />} color="error">
                Sem conta
              </Tag>
            </Tooltip>
          )}
          {u.temConta && u.claimsEmDia === false && (
            <Tooltip title="O token da pessoa diz uma coisa e o cadastro diz outra. Como as regras de acesso leem o token, ela entra e não vê o que deveria. Ressincronize.">
              <Tag icon={<WarningOutlined />} color="warning">
                Token desatualizado
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: "",
      width: 230,
      search: false,
      render: (_, u) => (
        <Space size={0} wrap>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setUsuarioEmEdicao(u);
              setDialogoUsuario(true);
            }}
          >
            Editar
          </Button>
          <Tooltip title="Regrava o token a partir do cadastro">
            <Button
              type="link"
              size="small"
              icon={<SyncOutlined />}
              loading={ressincronizar.isPending && ressincronizar.variables === u.id}
              disabled={u.temConta === false}
              onClick={() => ressincronizar.mutate(u.id)}
            />
          </Tooltip>
          <Tooltip title="Gerar link de definição de senha">
            <Button
              type="link"
              size="small"
              icon={<KeyOutlined />}
              loading={novoLink.isPending && novoLink.variables?.id === u.id}
              onClick={() => novoLink.mutate(u)}
            />
          </Tooltip>
          <Popconfirm
            title="Revogar o acesso a este sistema?"
            description={
              <div style={{ maxWidth: 280 }}>
                A conta continua existindo e o acesso aos outros produtos Global não é tocado. Só
                as permissões do {sistema.nome} saem.
              </div>
            }
            okText="Revogar"
            okButtonProps={{ danger: true }}
            cancelText="Cancelar"
            onConfirm={() => revogar.mutate(u.id)}
          >
            <Tooltip title="Revogar acesso a este sistema">
              <Button type="link" size="small" danger icon={<StopOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const semPrefeituras = !prefeiturasQuery.isPending && prefeituras.length === 0;

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Breadcrumb
          style={{ marginBottom: 8 }}
          items={[
            { title: <Link href="/sistemas">Sistemas</Link> },
            { title: sistema.nome },
          ]}
        />
        <Space align="center" size="middle" wrap>
          <Link href="/sistemas">
            <Button type="text" icon={<ArrowLeftOutlined />} aria-label="Voltar aos sistemas" />
          </Link>
          <Title level={3} style={{ margin: 0 }}>
            {sistema.nome}
          </Title>
          <Tag style={{ fontFamily: FONTE_MONO }}>{sistema.databaseId || "(default)"}</Tag>
        </Space>
        <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, maxWidth: 720 }}>
          {sistema.descricao}
        </Paragraph>
      </div>

      {sistema.erro && (
        <Alert
          type="error"
          showIcon
          title="O banco deste sistema não respondeu"
          description={sistema.erro}
        />
      )}

      <Tabs
        activeKey={aba}
        onChange={setAba}
        items={[
          {
            key: "prefeituras",
            label: `Prefeituras${prefeituras.length ? ` (${prefeituras.length})` : ""}`,
            children: (
              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                {prefeiturasQuery.isError && (
                  <Alert
                    type="error"
                    showIcon
                    title="Falha ao listar prefeituras"
                    description={mensagemDe(prefeiturasQuery.error, "Erro desconhecido.")}
                    action={
                      <Button size="small" onClick={() => prefeiturasQuery.refetch()}>
                        Tentar de novo
                      </Button>
                    }
                  />
                )}

                {semPrefeituras && !prefeiturasQuery.isError ? (
                  <Card>
                    <Empty
                      description={
                        <Space orientation="vertical" size={4}>
                          <Text strong>Nenhuma prefeitura no {sistema.nome}</Text>
                          <Text type="secondary">
                            Cadastre o primeiro município para poder criar usuários nele.
                          </Text>
                        </Space>
                      }
                    >
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setPrefeituraEmEdicao(null);
                          setDialogoPrefeitura(true);
                        }}
                      >
                        Nova prefeitura
                      </Button>
                    </Empty>
                  </Card>
                ) : (
                  <ProTable<PrefeituraDoConsole>
                    headerTitle="Prefeituras"
                    rowKey="slug"
                    size="small"
                    cardBordered
                    loading={prefeiturasQuery.isPending}
                    dataSource={prefeituras}
                    columns={colunasDePrefeitura}
                    pagination={false}
                    scroll={{ x: 860 }}
                    search={false}
                    options={{ density: false, fullScreen: false, reload: () => prefeiturasQuery.refetch() }}
                    dateFormatter="string"
                    toolBarRender={() => [
                      <Button
                        key="nova"
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setPrefeituraEmEdicao(null);
                          setDialogoPrefeitura(true);
                        }}
                      >
                        Nova prefeitura
                      </Button>,
                    ]}
                  />
                )}
              </Space>
            ),
          },
          {
            key: "usuarios",
            label: `Usuários${usuarios.length ? ` (${usuarios.length})` : ""}`,
            children: (
              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                {usuariosQuery.isError && (
                  <Alert
                    type="error"
                    showIcon
                    title="Falha ao listar usuários"
                    description={mensagemDe(usuariosQuery.error, "Erro desconhecido.")}
                    action={
                      <Button size="small" onClick={() => usuariosQuery.refetch()}>
                        Tentar de novo
                      </Button>
                    }
                  />
                )}

                {semPrefeituras && (
                  <Alert
                    type="info"
                    showIcon
                    title="Cadastre uma prefeitura primeiro"
                    description="Todo usuário do sistema é vinculado a um município — é esse vínculo que decide o que ele enxerga."
                  />
                )}

                <ProTable<UsuarioDoConsole>
                  headerTitle="Usuários"
                  rowKey="id"
                  size="small"
                  cardBordered
                  loading={usuariosQuery.isPending}
                  dataSource={usuarios}
                  columns={colunasDeUsuario}
                  pagination={usuarios.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
                  scroll={{ x: 1000 }}
                  search={false}
                  options={{ density: false, fullScreen: false, reload: () => usuariosQuery.refetch() }}
                  dateFormatter="string"
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Ninguém com acesso a este sistema ainda."
                      />
                    ),
                  }}
                  toolBarRender={() => [
                    <Button
                      key="novo"
                      type="primary"
                      icon={<UserAddOutlined />}
                      disabled={semPrefeituras}
                      onClick={() => {
                        setUsuarioEmEdicao(null);
                        setDialogoUsuario(true);
                      }}
                    >
                      Novo usuário
                    </Button>,
                  ]}
                />
              </Space>
            ),
          },
          {
            key: "registro",
            label: "Registro",
            children: (
              <Card
                title="O que foi feito por aqui"
                extra={
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    loading={registroQuery.isFetching}
                    onClick={() => registroQuery.refetch()}
                  >
                    Atualizar
                  </Button>
                }
              >
                <Paragraph type="secondary" style={{ marginTop: -8 }}>
                  Toda escrita do console fica registrada: quem fez, quando e o que mudou. Senha e
                  link de definição nunca entram aqui.
                </Paragraph>
                <Table
                  size="small"
                  rowKey="id"
                  loading={registroQuery.isPending && registroQuery.isFetching}
                  dataSource={registroQuery.data ?? []}
                  pagination={{ pageSize: 20, showSizeChanger: false }}
                  scroll={{ x: 760 }}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Nada registrado ainda neste sistema."
                      />
                    ),
                  }}
                  columns={[
                    {
                      title: "Quando",
                      dataIndex: "at",
                      width: 150,
                      render: (v: string) => (
                        <Text style={{ fontFamily: FONTE_MONO, fontSize: 12 }}>{dataHora(v)}</Text>
                      ),
                    },
                    {
                      title: "Quem",
                      dataIndex: "atorEmail",
                      width: 220,
                      render: (v: string) => <Text style={{ fontSize: 12 }}>{v || "—"}</Text>,
                    },
                    {
                      title: "Ação",
                      dataIndex: "acao",
                      width: 200,
                      render: (v: string) => (
                        <Tag style={{ fontFamily: FONTE_MONO, fontSize: 11 }}>{v}</Tag>
                      ),
                    },
                    {
                      title: "Detalhe",
                      dataIndex: "detalhe",
                      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />

      <Text type="secondary" style={{ fontSize: 12, color: token.colorTextQuaternary }}>
        Alterações de papel só valem no próximo login da pessoa — o token em uso ainda carrega o
        acesso antigo por até uma hora.
      </Text>

      <DialogoPrefeitura
        sistema={sistema}
        aberto={dialogoPrefeitura}
        edicao={prefeituraEmEdicao}
        salvando={salvarPrefeitura.isPending}
        aoFechar={() => {
          setDialogoPrefeitura(false);
          setPrefeituraEmEdicao(null);
        }}
        aoSalvar={(valores) => salvarPrefeitura.mutate(valores)}
      />

      <DialogoUsuario
        sistema={sistema}
        prefeituras={prefeituras}
        aberto={dialogoUsuario}
        edicao={usuarioEmEdicao}
        salvando={salvarUsuario.isPending}
        aoFechar={() => {
          setDialogoUsuario(false);
          setUsuarioEmEdicao(null);
        }}
        aoSalvar={(valores) => salvarUsuario.mutate(valores)}
      />
    </Space>
  );
}
