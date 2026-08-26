"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GoogleOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Flex,
  Form,
  Grid,
  Input,
  Layout,
  Space,
  Spin,
  Tag,
  theme,
  Typography,
} from "antd";

import packageJson from "@/package.json";
import { useAuth } from "@/core/providers/auth-provider";

import { DialogoRedefinirSenha } from "./dialogo-redefinir-senha";

const { Text, Title } = Typography;

const ROTA_POS_LOGIN = "/painel";
const VERSAO_APP = `v${packageJson.version}`;

const MENSAGENS_POR_CODIGO: Record<string, string> = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  // Fechar a janela do Google é desistência, não falha — e um alerta vermelho
  // dizendo "erro" para quem simplesmente mudou de ideia assusta à toa.
  "auth/popup-closed-by-user": "",
  "auth/cancelled-popup-request": "",
  "auth/popup-blocked":
    "O navegador bloqueou a janela do Google. Libere as janelas pop-up para este endereço e tente de novo.",
  "auth/unauthorized-domain":
    "Este endereço ainda não está autorizado no Firebase para entrar com Google. Avise quem administra o sistema.",
  "auth/account-exists-with-different-credential":
    "Já existe uma conta com esse e-mail usando outro método. Entre com e-mail e senha desta vez.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/invalid-email": "E-mail em formato inválido.",
  "auth/user-disabled": "Esta conta foi desativada. Contate o suporte interno.",
  "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.",
  "auth/network-request-failed": "Falha de conexão. Verifique sua rede e tente de novo.",
};

function mensagemDeErro(erro: unknown): string {
  const codigo =
    typeof erro === "object" && erro !== null && "code" in erro && typeof erro.code === "string"
      ? erro.code
      : "";
  return (
    MENSAGENS_POR_CODIGO[codigo] ??
    (erro instanceof Error ? erro.message : "Não foi possível autenticar.")
  );
}

interface ValoresLogin {
  email: string;
  senha: string;
  manterConectado: boolean;
}

export default function EntrarPage() {
  const router = useRouter();
  const { user, loading, signIn, signInWithGoogle, ultimoEmail } = useAuth();
  const { token } = theme.useToken();
  const telas = Grid.useBreakpoint();
  const [form] = Form.useForm<ValoresLogin>();

  // O e-mail já digitado alimenta o diálogo de redefinição de senha, para não
  // pedir o mesmo dado duas vezes. `Form.useWatch` mantém isso reativo sem
  // duplicar o valor num `useState` próprio — o `Form` já é a fonte da verdade.
  const emailDigitado = Form.useWatch("email", form) ?? "";

  const [enviando, setEnviando] = useState(false);
  const [entrandoComGoogle, setEntrandoComGoogle] = useState(false);
  const [erroAuth, setErroAuth] = useState<string | null>(null);
  const [redefinindo, setRedefinindo] = useState(false);

  // "Manter sessão ativa" vale para os dois caminhos de entrada — o Form é a
  // fonte da verdade, e o botão do Google lê o mesmo valor.
  const manterConectado = Form.useWatch("manterConectado", form) ?? true;

  // Status dinâmico da API
  const [statusApi, setStatusApi] = useState<{ ok: boolean; carregando: boolean }>({
    ok: true,
    carregando: true,
  });

  // Checagem de saúde da API
  useEffect(() => {
    let ativo = true;
    const checarSaude = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (ativo) {
          setStatusApi({ ok: res.ok, carregando: false });
        }
      } catch {
        if (ativo) {
          setStatusApi({ ok: false, carregando: false });
        }
      }
    };

    checarSaude();
    const intervalo = setInterval(checarSaude, 20000);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, []);

  useEffect(() => {
    if (!loading && user) router.replace(ROTA_POS_LOGIN);
  }, [loading, user, router]);

  // `onFinish` só dispara depois que o `Form` valida os dois campos — a
  // checagem manual de e-mail/senha que existia antes vira regra declarativa
  // em cada `Form.Item`, e o foco no campo com erro é comportamento do Ant.
  const aoEnviar = async (valores: ValoresLogin) => {
    setEnviando(true);
    setErroAuth(null);
    try {
      await signIn(valores.email.trim(), valores.senha, valores.manterConectado);
    } catch (erro) {
      setErroAuth(mensagemDeErro(erro));
      setEnviando(false);
    }
  };

  const aoEntrarComGoogle = async () => {
    setEntrandoComGoogle(true);
    setErroAuth(null);
    try {
      await signInWithGoogle(manterConectado);
      // Sem `setEntrandoComGoogle(false)` no caminho feliz: a navegação para o
      // painel desmonta a tela, e apagar o estado antes disso devolveria o
      // botão ao normal por um instante, como se nada tivesse acontecido.
    } catch (erro) {
      setErroAuth(mensagemDeErro(erro) || null);
      setEntrandoComGoogle(false);
    }
  };

  if (loading || user) {
    return (
      <Flex align="center" justify="center" style={{ height: "100vh", width: "100vw" }}>
        <Space>
          <Spin size="small" />
          <Text
            type="secondary"
            style={{ fontFamily: "var(--font-sync-mono)", fontSize: 12, fontWeight: 600 }}
          >
            Verificando sessão…
          </Text>
        </Space>
      </Flex>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh", background: token.colorBgLayout }}>
      <Layout.Header
        style={{
          height: 64,
          lineHeight: "normal",
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          paddingInline: 24,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Flex justify="space-between" align="center" style={{ width: "100%", maxWidth: 1152, margin: "0 auto" }}>
          <Space size={12}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: token.borderRadius,
                border: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorBgContainer,
              }}
            >
              <Image src="/global-sync-icon.png" alt="Global Sync" width={24} height={24} priority />
            </div>
            <Space size={8}>
              <Text strong>Global Sync</Text>
              <Tag variant="filled" style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11 }}>
                {VERSAO_APP}
              </Tag>
            </Space>
          </Space>

          {/* Escondido no mobile, como antes: nesse tamanho de tela o par
              status + razão social só disputa espaço com a marca. */}
          {telas.sm && (
            <Space separator={<Divider orientation="vertical" />} size="middle">
              {statusApi.carregando ? (
                <Badge status="processing" text="Checando sistema…" />
              ) : statusApi.ok ? (
                <Badge status="success" text="Sistemas Operacionais" />
              ) : (
                <Badge status="error" text="Instabilidade na Rede" />
              )}
              <Text strong>Global Company Consultorias</Text>
            </Space>
          )}
        </Flex>
      </Layout.Header>

      <Layout.Content style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Card style={{ width: "100%", maxWidth: 420 }} styles={{ body: { padding: 32 } }}>
          <Flex vertical align="center" style={{ textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 56,
                height: 56,
                borderRadius: token.borderRadiusLG,
                border: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorBgContainer,
              }}
            >
              <Image src="/global-sync-icon.png" alt="Global Sync" width={36} height={36} priority />
            </div>
            <Title level={4} style={{ marginTop: 16, marginBottom: 0 }}>
              Acessar o Global Sync
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Global Company Consultorias
            </Text>
          </Flex>

          {erroAuth && (
            <Alert
              type="error"
              showIcon
              title={erroAuth}
              description={
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, height: "auto" }}
                  onClick={() => setRedefinindo(true)}
                >
                  Esqueci minha senha
                </Button>
              }
              style={{ marginTop: 24 }}
            />
          )}

          <Form<ValoresLogin>
            form={form}
            layout="vertical"
            requiredMark={false}
            // O `Form` só monta depois de `loading` virar `false`, então
            // `ultimoEmail` já chegou do `localStorage` quando estes valores
            // são lidos — `initialValues` vale uma vez, na montagem.
            initialValues={{ manterConectado: true, email: ultimoEmail }}
            onFinish={aoEnviar}
            scrollToFirstError
            style={{ marginTop: 24 }}
          >
            <Form.Item
              name="email"
              label="E-mail institucional"
              rules={[
                { required: true, message: "Informe o e-mail institucional." },
                { type: "email", message: "E-mail em formato inválido." },
              ]}
            >
              <Input
                prefix={<MailOutlined style={{ color: token.colorTextQuaternary }} />}
                placeholder="usuario@globalcompany.com.br"
                autoComplete="username"
                autoFocus={!ultimoEmail}
              />
            </Form.Item>

            {/* O `label` do `Form.Item` é `inline-flex` e ignora `width: 100%`
                do filho — por isso o cabeçalho "Senha / Esqueceu?" vem fora
                do prop `label`, como uma linha própria acima do campo. */}
            <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
              <label htmlFor="senha" style={{ color: token.colorText }}>
                Senha
              </label>
              <Button
                type="link"
                size="small"
                style={{ padding: 0, height: "auto", fontWeight: 600 }}
                onClick={() => setRedefinindo(true)}
              >
                Esqueceu?
              </Button>
            </Flex>
            <Form.Item name="senha" rules={[{ required: true, message: "Informe a senha." }]}>
              <Input.Password
                id="senha"
                prefix={<LockOutlined style={{ color: token.colorTextQuaternary }} />}
                autoComplete="current-password"
                // Com o e-mail já preenchido, o cursor começa onde ainda falta
                // digitar algo. Sem ele, o foco fica no e-mail, como antes.
                autoFocus={Boolean(ultimoEmail)}
              />
            </Form.Item>

            <Form.Item name="manterConectado" valuePropName="checked">
              <Checkbox>Manter sessão ativa neste dispositivo</Checkbox>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={enviando}
                disabled={entrandoComGoogle}
              >
                {enviando ? "Autenticando…" : "Acessar console"}
              </Button>
            </Form.Item>
          </Form>

          <Divider plain style={{ margin: "20px 0" }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              ou
            </Text>
          </Divider>

          <Button
            block
            icon={<GoogleOutlined />}
            loading={entrandoComGoogle}
            disabled={enviando}
            onClick={aoEntrarComGoogle}
          >
            {entrandoComGoogle ? "Aguardando o Google…" : "Entrar com Google"}
          </Button>
          <Text
            type="secondary"
            style={{ display: "block", textAlign: "center", fontSize: 11, marginTop: 8 }}
          >
            Use a conta do mesmo e-mail cadastrado no Sync.
          </Text>

          <Divider style={{ margin: "24px 0 16px" }} />
          <Text type="secondary" style={{ display: "block", textAlign: "center", fontSize: 11, fontFamily: "var(--font-sync-mono)" }}>
            Uso exclusivo de colaboradores autorizados.
          </Text>
        </Card>
      </Layout.Content>

      <Layout.Footer style={{ textAlign: "center", background: "transparent" }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          © {new Date().getFullYear()} Global Company Consultorias. Todos os direitos reservados.
        </Text>
      </Layout.Footer>

      <DialogoRedefinirSenha
        aberto={redefinindo}
        emailInicial={emailDigitado.trim()}
        aoFechar={() => setRedefinindo(false)}
      />
    </Layout>
  );
}
