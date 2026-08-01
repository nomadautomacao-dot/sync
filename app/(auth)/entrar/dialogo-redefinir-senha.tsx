"use client";

import { useState } from "react";
import { MailOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Modal, Typography } from "antd";

import { useAuth } from "@/core/providers/auth-provider";

const { Text, Paragraph } = Typography;

interface DialogoRedefinirSenhaProps {
  aberto: boolean;
  /** E-mail já digitado no login, para não pedir duas vezes a mesma coisa. */
  emailInicial: string;
  aoFechar: () => void;
}

interface ValoresRedefinir {
  email: string;
}

/**
 * Redefinição de senha.
 *
 * A resposta é a mesma exista ou não a conta: dizer "e-mail não cadastrado"
 * numa tela pública entrega a lista de usuários a quem estiver sondando. Quem
 * engole o `user-not-found` é o provider; aqui a mensagem de sucesso é redigida
 * no condicional ("se houver uma conta...") para não prometer o que não sabe.
 *
 * O `Modal` do Ant substitui o `<dialog>` nativo que havia antes: prisão de
 * foco, `Esc` e clique fora para fechar já vêm de fábrica, sem reimplementar
 * nada disso à mão.
 */
export function DialogoRedefinirSenha({
  aberto,
  emailInicial,
  aoFechar,
}: DialogoRedefinirSenhaProps) {
  const { sendPasswordReset } = useAuth();
  const [form] = Form.useForm<ValoresRedefinir>();
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O que aparece na tela de sucesso é o e-mail que o usuário de fato enviou,
  // não um estado à parte duplicando o que o `Form` já guarda.
  const emailEnviado = Form.useWatch("email", form) ?? emailInicial;

  const aoEnviar = async (valores: ValoresRedefinir) => {
    setEnviando(true);
    setErro(null);
    try {
      await sendPasswordReset(valores.email.trim());
      setEnviado(true);
    } catch {
      setErro("Não foi possível enviar agora. Verifique sua conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      open={aberto}
      onCancel={aoFechar}
      // O reset mora aqui, não num `useEffect`: o gatilho é a própria
      // transição de abertura do `Modal` (evento), não um valor derivado do
      // React que precise ser sincronizado a cada render.
      afterOpenChange={(estaAberto) => {
        if (estaAberto) {
          form.setFieldsValue({ email: emailInicial });
          setEnviado(false);
          setErro(null);
        }
      }}
      title={enviado ? "Verifique seu e-mail" : "Redefinir senha"}
      footer={
        enviado
          ? [
              <Button key="fechar" type="primary" onClick={aoFechar}>
                Fechar
              </Button>,
            ]
          : [
              <Button key="cancelar" onClick={aoFechar} disabled={enviando}>
                Cancelar
              </Button>,
              <Button key="enviar" type="primary" loading={enviando} onClick={() => form.submit()}>
                Enviar link
              </Button>,
            ]
      }
    >
      {enviado ? (
        <Paragraph type="secondary" role="status">
          Se houver uma conta para <Text code>{emailEnviado.trim()}</Text>, o link de redefinição
          chega em alguns minutos. Confira também a caixa de spam.
        </Paragraph>
      ) : (
        <Form<ValoresRedefinir> form={form} layout="vertical" requiredMark={false} onFinish={aoEnviar}>
          <Paragraph type="secondary">Enviamos um link para você criar uma senha nova.</Paragraph>

          {erro && <Alert type="error" showIcon message={erro} style={{ marginBottom: 16 }} />}

          <Form.Item
            name="email"
            label="E-mail"
            // Espaço colado no fim de um e-mail copiado é a causa mais comum
            // de "não recebi o link".
            normalize={(valor: string) => (typeof valor === "string" ? valor.replace(/\s/g, "") : valor)}
            rules={[
              { required: true, message: "Informe o e-mail." },
              { type: "email", message: "E-mail em formato inválido." },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              autoComplete="email"
              placeholder="nome@consultoria.com.br"
              autoFocus
            />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
