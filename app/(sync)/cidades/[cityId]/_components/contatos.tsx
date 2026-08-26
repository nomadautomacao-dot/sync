"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DeleteOutlined,
  EditOutlined,
  MailOutlined,
  PhoneOutlined,
  UserAddOutlined,
  WhatsAppOutlined,
} from "@ant-design/icons";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import {
  App,
  AutoComplete,
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Result,
  Skeleton,
  Space,
  Typography,
  theme,
} from "antd";

import {
  CARGOS_SUGERIDOS,
  linkWhatsApp,
  type ContatoDaCidade,
  type EntradaDeContato,
} from "@/core/domain/cidade-contatos";
import {
  createCityContact,
  deleteCityContact,
  listCityContacts,
  updateCityContact,
} from "@/core/lib/city-contacts-firestore";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { podeEditar } from "@/core/domain/rbac";
import { useAuth } from "@/core/providers/auth-provider";

const { Text } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

/**
 * O diretório do município: prefeito, secretária de educação, chefe de
 * gabinete — quem a equipe precisa achar quando liga para a prefeitura.
 *
 * Diretório, não fato: edita-se e apaga-se sem trava de autor, porque a
 * eleição troca a prefeitura inteira. O que merece histórico — a reunião com
 * o secretário — mora na linha do tempo.
 */
export function Contatos({ cityId }: { cityId: string }) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const [dialogo, setDialogo] = useState<
    { modo: "novo" } | { modo: "editar"; contato: ContatoDaCidade } | null
  >(null);

  const editarCidade = user ? podeEditar(user.permissoes, "cidades") : false;

  const {
    data: contatos = [],
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["city-contacts", cityId],
    queryFn: () => listCityContacts(getFirebaseDb(), user!.groupId, cityId),
    enabled: Boolean(user?.groupId && cityId),
  });

  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: ["city-contacts", cityId] });

  const salvar = useMutation({
    mutationFn: async (entrada: EntradaDeContato) => {
      if (dialogo?.modo === "editar") {
        await updateCityContact(getFirebaseDb(), cityId, dialogo.contato.id, entrada);
      } else {
        await createCityContact(
          getFirebaseDb(),
          user!.groupId,
          cityId,
          entrada,
          user!.name,
        );
      }
    },
    onSuccess: () => {
      invalidar();
      message.success(
        dialogo?.modo === "editar" ? "Contato atualizado." : "Contato adicionado.",
      );
      setDialogo(null);
    },
    onError: (error) =>
      message.error(
        error instanceof Error ? error.message : "Não foi possível salvar o contato.",
      ),
  });

  const excluir = useMutation({
    mutationFn: (contatoId: string) =>
      deleteCityContact(getFirebaseDb(), cityId, contatoId),
    onSuccess: () => {
      invalidar();
      message.success("Contato excluído.");
    },
    onError: (error) =>
      message.error(
        error instanceof Error ? error.message : "Não foi possível excluir o contato.",
      ),
  });

  if (isError) {
    return (
      <Result
        status="warning"
        title="Não foi possível carregar os contatos"
        subTitle="Verifique a conexão e tente novamente."
        extra={
          <Button type="primary" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const colunas: ProColumns<ContatoDaCidade>[] = [
    {
      title: "Contato",
      dataIndex: "nome",
      sorter: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
      render: (_, contato) => (
        <div style={{ minWidth: 0 }}>
          <Text strong style={{ fontSize: 12.5, display: "block" }}>
            {contato.nome}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {contato.cargo || "—"}
          </Text>
        </div>
      ),
    },
    {
      title: "Telefone",
      dataIndex: "telefone",
      width: 190,
      sorter: (a, b) => (a.telefone ?? "").localeCompare(b.telefone ?? ""),
      render: (_, contato) => {
        if (!contato.telefone) {
          return <Text style={{ color: token.colorTextQuaternary }}>—</Text>;
        }
        const whatsapp = linkWhatsApp(contato.telefone);
        return (
          <Space size={6}>
            <Text style={{ fontFamily: FONTE_MONO, fontSize: 12 }}>
              <PhoneOutlined style={{ color: token.colorTextTertiary, marginRight: 6 }} />
              {contato.telefone}
            </Text>
            {whatsapp && (
              <Button
                size="small"
                type="text"
                icon={<WhatsAppOutlined style={{ color: token.colorSuccess }} />}
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                aria-label={`Abrir WhatsApp de ${contato.nome}`}
                title="Abrir conversa no WhatsApp"
              />
            )}
          </Space>
        );
      },
    },
    {
      title: "E-mail",
      dataIndex: "email",
      width: 220,
      ellipsis: true,
      responsive: ["lg"],
      render: (_, contato) =>
        contato.email ? (
          <a href={`mailto:${contato.email}`} style={{ fontSize: 12 }}>
            <MailOutlined style={{ marginRight: 6 }} />
            {contato.email}
          </a>
        ) : (
          <Text style={{ color: token.colorTextQuaternary }}>—</Text>
        ),
    },
    {
      title: "Observação",
      dataIndex: "observacao",
      ellipsis: true,
      responsive: ["xl"],
      render: (_, contato) => contato.observacao || "—",
    },
    ...(editarCidade
      ? ([
          {
            title: "",
            key: "acoes",
            width: 90,
            align: "right",
            render: (_, contato) => (
              <Space size={4}>
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  aria-label={`Editar ${contato.nome}`}
                  title="Editar"
                  onClick={() => setDialogo({ modo: "editar", contato })}
                />
                <Popconfirm
                  title="Excluir este contato?"
                  description="A exclusão é definitiva. Reuniões e ligações registradas na linha do tempo não são afetadas."
                  okText="Excluir"
                  okButtonProps={{ danger: true }}
                  cancelText="Cancelar"
                  onConfirm={() => excluir.mutate(contato.id)}
                >
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={`Excluir ${contato.nome}`}
                    title="Excluir"
                  />
                </Popconfirm>
              </Space>
            ),
          },
        ] as ProColumns<ContatoDaCidade>[])
      : []),
  ];

  return (
    <Card>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Contatos do município
          </Typography.Title>
          <Text type="secondary" style={{ fontSize: 10 }}>
            Prefeitura, secretarias e quem mais a equipe precisa achar.
          </Text>
        </div>
        {editarCidade && (
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => setDialogo({ modo: "novo" })}
          >
            Novo contato
          </Button>
        )}
      </Flex>

      <div style={{ marginTop: 16 }}>
        {isPending ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : contatos.length ? (
          <ProTable<ContatoDaCidade>
            rowKey="id"
            size="small"
            search={false}
            toolBarRender={false}
            options={false}
            pagination={false}
            dateFormatter="string"
            dataSource={contatos}
            columns={colunas}
            scroll={{ x: 700 }}
          />
        ) : (
          <Empty
            description={
              <Flex vertical gap={4} align="center">
                <Text strong>Nenhum contato cadastrado</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Comece pelo prefeito e pela Secretaria de Educação — são quem
                  a equipe mais procura.
                </Text>
              </Flex>
            }
            style={{ padding: "48px 0" }}
          >
            {editarCidade && (
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                onClick={() => setDialogo({ modo: "novo" })}
              >
                Adicionar contato
              </Button>
            )}
          </Empty>
        )}
      </div>

      {dialogo && (
        <ContatoDialog
          contato={dialogo.modo === "editar" ? dialogo.contato : undefined}
          salvando={salvar.isPending}
          onClose={() => {
            if (!salvar.isPending) setDialogo(null);
          }}
          onSubmit={(entrada) => salvar.mutate(entrada)}
        />
      )}
    </Card>
  );
}

function ContatoDialog({
  contato,
  salvando,
  onClose,
  onSubmit,
}: {
  contato?: ContatoDaCidade;
  salvando: boolean;
  onClose: () => void;
  onSubmit: (entrada: EntradaDeContato) => void;
}) {
  const [form] = Form.useForm<EntradaDeContato>();

  return (
    <Modal
      open
      centered
      width={480}
      title={contato ? "Editar contato" : "Novo contato"}
      okText={salvando ? "Salvando…" : "Salvar"}
      cancelText="Cancelar"
      confirmLoading={salvando}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form<EntradaDeContato>
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={{
          nome: contato?.nome,
          cargo: contato?.cargo,
          telefone: contato?.telefone,
          email: contato?.email,
          observacao: contato?.observacao,
        }}
        style={{ marginTop: 12 }}
      >
        <Form.Item
          label="Nome"
          name="nome"
          rules={[{ required: true, message: "O contato precisa de um nome." }]}
        >
          <Input placeholder="Ex: Maria dos Santos" autoFocus />
        </Form.Item>

        <Form.Item label="Cargo" name="cargo">
          <AutoComplete
            options={CARGOS_SUGERIDOS.map((cargo) => ({ value: cargo }))}
            filterOption={(texto, opcao) =>
              (opcao?.value ?? "")
                .toLocaleLowerCase("pt-BR")
                .includes(texto.toLocaleLowerCase("pt-BR"))
            }
            placeholder="Ex: Secretário(a) de Educação"
          />
        </Form.Item>

        <Form.Item label="Telefone / WhatsApp" name="telefone">
          <Input
            placeholder="Ex: (77) 99999-8888"
            style={{ fontFamily: FONTE_MONO }}
          />
        </Form.Item>

        <Form.Item
          label="E-mail"
          name="email"
          rules={[{ type: "email", message: "Este e-mail não parece válido." }]}
        >
          <Input placeholder="Ex: gabinete@municipio.ba.gov.br" />
        </Form.Item>

        <Form.Item label="Observação" name="observacao">
          <Input.TextArea
            rows={2}
            placeholder="Ex: atende melhor pela manhã; falar antes com a assessora"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
