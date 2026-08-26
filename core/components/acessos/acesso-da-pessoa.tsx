"use client";

import { useState } from "react";
import {
  GoogleOutlined,
  KeyOutlined,
  StopOutlined,
  UndoOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Descriptions,
  Empty,
  Flex,
  Popconfirm,
  Result,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";

import { apiFetch } from "@/core/lib/api-client";
import type { UsuariaDeAcesso } from "@/core/lib/acessos";
import {
  ajustesParaClaim,
  permissoesPadrao,
  podeAdministrarAcessos,
  GROUP_ROLE_LABELS,
  type GroupRole,
  type Permissoes,
} from "@/core/domain/rbac";

import { GradeDePermissoes, papeisDisponiveis } from "./grade-de-permissoes";
import { ModalDoLink } from "./modal-do-link";

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
 * Acesso ao sistema, visto de dentro da ficha de uma pessoa.
 *
 * A aba de Ajustes › Acessos continua existindo e olha o grupo inteiro — é onde
 * se responde "quem entra aqui". Esta é a pergunta oposta, e é a que se faz na
 * prática: *esta* pessoa, que eu acabei de cadastrar, entra? até onde? Fazer o
 * caminho de ida e volta entre duas telas para responder isso é o tipo de
 * atrito que faz o acesso ser concedido larga demais "por enquanto".
 *
 * O elo entre os dois mundos é o **e-mail**: `collaborators` é um documento do
 * Firestore e a conta é um registro do Firebase Auth, sem chave estrangeira
 * entre eles. Consequência que a tela precisa assumir: mudar o e-mail da ficha
 * desfaz o vínculo aparente, e o acesso antigo continua existindo com o e-mail
 * velho — por isso o painel diz o e-mail que está consultando.
 *
 * Nada de senha passa por aqui. O que se concede é conta e alcance; a senha
 * quem define é a própria pessoa, pelo link.
 */
export function AcessoDaPessoa({
  nome,
  email,
  papelDeQuemEdita,
  uidDeQuemEdita,
}: {
  nome: string;
  email?: string;
  papelDeQuemEdita: GroupRole;
  uidDeQuemEdita: string;
}) {
  const [linkGerado, setLinkGerado] = useState<{ email: string; link: string } | null>(null);

  const emailLimpo = email?.trim().toLowerCase() ?? "";
  const podeAdministrar = podeAdministrarAcessos(papelDeQuemEdita);

  const { data, isPending, error, refetch } = useQuery({
    // Mesma chave da aba de Ajustes: conceder acesso aqui atualiza a lista de
    // lá, e vice-versa, sem que nenhuma das duas saiba da outra.
    queryKey: ["acessos"],
    queryFn: () => apiFetch<RespostaLista>("/api/acessos"),
    staleTime: 5 * 60 * 1000,
    enabled: podeAdministrar && Boolean(emailLimpo),
  });

  if (!podeAdministrar) {
    return (
      <Alert
        type="info"
        showIcon
        title="Só quem administra concede acesso"
        description="Conceder acesso é decidir quem entra no sistema e até onde vai. Fale com a dona ou com uma administradora do grupo."
      />
    );
  }

  if (!emailLimpo) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Flex vertical gap={4} align="center">
            <Text>Esta pessoa não tem e-mail cadastrado.</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              O e-mail é a identidade da conta — sem ele não há acesso a conceder.
              Preencha-o em Dados Cadastrais e volte aqui.
            </Text>
          </Flex>
        }
      />
    );
  }

  if (isPending) return <Skeleton active paragraph={{ rows: 6 }} />;

  if (error) {
    return (
      <Result
        status="warning"
        title="Não foi possível consultar os acessos"
        subTitle={error instanceof Error ? error.message : "Erro desconhecido."}
        extra={
          <Button type="primary" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        }
      />
    );
  }

  const usuaria = data.usuarias.find((u) => u.email.trim().toLowerCase() === emailLimpo);

  return (
    <Flex vertical gap={16} style={{ width: "100%" }}>
      {usuaria ? (
        <EditorDeAcesso
          key={usuaria.uid}
          usuaria={usuaria}
          papelDeQuemEdita={papelDeQuemEdita}
          ehEuMesma={usuaria.uid === uidDeQuemEdita}
          aoGerarLink={setLinkGerado}
        />
      ) : (
        <ConcessaoDeAcesso
          nome={nome}
          email={emailLimpo}
          papelDeQuemEdita={papelDeQuemEdita}
          aoConceder={(r) => setLinkGerado({ email: r.usuaria.email, link: r.linkDeSenha })}
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

// ── Ainda não tem conta ──────────────────────────────────────────────────

function ConcessaoDeAcesso({
  nome,
  email,
  papelDeQuemEdita,
  aoConceder,
}: {
  nome: string;
  email: string;
  papelDeQuemEdita: GroupRole;
  aoConceder: (resposta: RespostaProvisionamento) => void;
}) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [papel, setPapel] = useState<GroupRole>("member");
  const [permissoes, setPermissoes] = useState<Permissoes>(permissoesPadrao("member"));

  const conceder = useMutation({
    mutationFn: () =>
      apiFetch<RespostaProvisionamento>("/api/acessos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          groupRole: papel,
          permissoes: ajustesParaClaim(papel, permissoes),
        }),
      }),
    onSuccess: (resposta) => {
      queryClient.invalidateQueries({ queryKey: ["acessos"] });
      message.success(
        resposta.jaExistia
          ? "Conta que já existia foi vinculada ao grupo."
          : "Acesso criado.",
      );
      aoConceder(resposta);
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "Falha ao conceder."),
  });

  const trocarPapel = (novo: GroupRole) => {
    setPapel(novo);
    // Trocar o papel redefine a grade: o padrão do papel novo é o ponto de
    // partida certo, e manter ajustes do papel anterior confunde mais que ajuda.
    setPermissoes(permissoesPadrao(novo));
  };

  return (
    <Flex vertical gap={14}>
      <Alert
        type="info"
        showIcon
        title="Esta pessoa ainda não entra no sistema"
        description={
          <>
            A conta será criada para <Text strong style={{ fontFamily: FONTE_MONO }}>{email}</Text>{" "}
            <b>sem senha</b>: o que você recebe é um link para ela mesma definir a dela. Se já
            existir conta com esse e-mail — de outro produto Global, por exemplo — ela é vinculada
            ao grupo e a senha atual não é tocada.
          </>
        }
      />

      <Flex gap={12} align="center" wrap="wrap">
        <Text type="secondary" style={{ fontSize: 12 }}>
          Papel
        </Text>
        <Select
          value={papel}
          onChange={trocarPapel}
          style={{ minWidth: 200 }}
          options={papeisDisponiveis(papelDeQuemEdita).map((p) => ({
            value: p,
            label: GROUP_ROLE_LABELS[p],
          }))}
        />
      </Flex>

      <GradeDePermissoes papel={papel} valor={permissoes} aoMudar={setPermissoes} />

      <Button
        type="primary"
        icon={<UserAddOutlined />}
        loading={conceder.isPending}
        onClick={() => conceder.mutate()}
      >
        Dar acesso a {nome.split(/\s+/)[0]}
      </Button>
    </Flex>
  );
}

// ── Já tem conta ─────────────────────────────────────────────────────────

function EditorDeAcesso({
  usuaria,
  papelDeQuemEdita,
  ehEuMesma,
  aoGerarLink,
}: {
  usuaria: UsuariaDeAcesso;
  papelDeQuemEdita: GroupRole;
  ehEuMesma: boolean;
  aoGerarLink: (valor: { email: string; link: string }) => void;
}) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [papel, setPapel] = useState<GroupRole>(usuaria.groupRole);
  const [permissoes, setPermissoes] = useState<Permissoes>(usuaria.permissoes);

  const salvar = useMutation({
    mutationFn: (corpo: Record<string, unknown>) =>
      apiFetch<{ usuaria: UsuariaDeAcesso }>(`/api/acessos/${usuaria.uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acessos"] });
      message.success("Acesso salvo. Vale quando ela entrar de novo no sistema.");
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const gerarLink = useMutation({
    mutationFn: () =>
      apiFetch<{ linkDeSenha: string }>(`/api/acessos/${usuaria.uid}`, { method: "POST" }),
    onSuccess: (r) => aoGerarLink({ email: usuaria.email, link: r.linkDeSenha }),
    onError: (e) => message.error(e instanceof Error ? e.message : "Falha ao gerar o link."),
  });

  const trocarPapel = (novo: GroupRole) => {
    setPapel(novo);
    setPermissoes(permissoesPadrao(novo));
  };

  return (
    <Flex vertical gap={14}>
      <Descriptions
        column={1}
        size="small"
        items={[
          {
            key: "situacao",
            label: "Situação",
            children: usuaria.desativada ? (
              <Tag color="red">Desativada</Tag>
            ) : (
              <Tag color="green">Entra no sistema</Tag>
            ),
          },
          {
            key: "email",
            label: "Conta",
            children: <Text style={{ fontFamily: FONTE_MONO, fontSize: 12 }}>{usuaria.email}</Text>,
          },
          {
            key: "metodos",
            label: "Entra com",
            children: usuaria.metodos.length ? (
              <Space size={4} wrap>
                {usuaria.metodos.map((metodo) => (
                  <Tag key={metodo} icon={metodo === "Google" ? <GoogleOutlined /> : undefined}>
                    {metodo}
                  </Tag>
                ))}
              </Space>
            ) : (
              /* Lista vazia não é falha: a conta existe e ninguém entrou ainda.
                 Dizer isso evita a administradora gerar um segundo link de
                 senha achando que o primeiro falhou. */
              <Text type="secondary" style={{ fontSize: 12 }}>
                Ainda não entrou nenhuma vez
              </Text>
            ),
          },
          {
            key: "ultimo",
            label: "Último acesso",
            // Nunca entrou é ausência, não zero.
            children: usuaria.ultimoAcessoEm ? formatarData(usuaria.ultimoAcessoEm) : "—",
          },
        ]}
      />

      {/* O Google não se "habilita por pessoa": o provedor é do projeto, e o que
          liga a conta Google a este acesso é o e-mail ser o mesmo. Dizer isso na
          tela evita a procura por um botão de habilitar que não existe. */}
      <Alert
        type="info"
        showIcon
        title="Ela já pode entrar com a conta Google"
        description={
          <>
            Basta usar &quot;Entrar com Google&quot; escolhendo a conta{" "}
            <Text strong style={{ fontFamily: FONTE_MONO }}>
              {usuaria.email}
            </Text>
            . O e-mail precisa ser exatamente esse — entrar com outra conta Google
            cria um acesso sem permissão nenhuma.
          </>
        }
      />

      {usuaria.desativada && (
        <Alert
          type="warning"
          showIcon
          title="Acesso desativado"
          description="Ela não entra no sistema. A conta, o histórico e as permissões continuam aqui — reativar devolve tudo como estava."
        />
      )}

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

      <Flex gap={8} wrap="wrap">
        <Button
          type="primary"
          loading={salvar.isPending}
          onClick={() =>
            salvar.mutate({ groupRole: papel, permissoes: ajustesParaClaim(papel, permissoes) })
          }
        >
          Salvar permissões
        </Button>

        <Space size={8}>
          <Button
            icon={<KeyOutlined />}
            loading={gerarLink.isPending}
            onClick={() => gerarLink.mutate()}
          >
            Link de senha
          </Button>

          <Popconfirm
            title={usuaria.desativada ? "Reativar o acesso?" : "Desativar o acesso?"}
            description={
              usuaria.desativada
                ? "Ela volta a entrar com a senha que já tinha."
                : "Ela deixa de entrar. A conta e o histórico ficam."
            }
            okText={usuaria.desativada ? "Reativar" : "Desativar"}
            cancelText="Cancelar"
            disabled={ehEuMesma}
            onConfirm={() => salvar.mutate({ desativada: !usuaria.desativada })}
          >
            <Button
              danger={!usuaria.desativada}
              disabled={ehEuMesma}
              icon={usuaria.desativada ? <UndoOutlined /> : <StopOutlined />}
            >
              {usuaria.desativada ? "Reativar" : "Desativar"}
            </Button>
          </Popconfirm>
        </Space>
      </Flex>

      <Text type="secondary" style={{ fontSize: 11.5 }}>
        Mudança de papel ou de permissão passa a valer quando ela entrar de novo —
        o crachá dela é o token, e o token só se renova no próximo login.
      </Text>
    </Flex>
  );
}

function formatarData(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? "—"
    : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
