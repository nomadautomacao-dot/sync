"use client";

import { CopyOutlined } from "@ant-design/icons";
import { App, Button, Input, Modal, Typography } from "antd";

const { Text, Paragraph } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

/**
 * O link que a própria pessoa usa para definir a senha dela.
 *
 * Esta é a peça que sustenta a regra de que **senha não passa pelo sistema**: a
 * conta nasce sem senha e o que sai daqui é um link do Firebase. Nem quem
 * administra nem o servidor chegam a ver a senha escolhida — e o que ninguém vê
 * não vaza em log, não é reaproveitado noutro serviço e não vira
 * responsabilidade de guarda.
 */
export function ModalDoLink({
  email,
  link,
  aoFechar,
}: {
  email: string;
  link: string;
  aoFechar: () => void;
}) {
  const { message } = App.useApp();

  return (
    <Modal
      open
      title="Link para definir a senha"
      onCancel={aoFechar}
      onOk={aoFechar}
      okText="Fechar"
      cancelButtonProps={{ style: { display: "none" } }}
      width={620}
    >
      <Paragraph type="secondary" style={{ fontSize: 12 }}>
        Envie este link para <Text strong>{email}</Text>. Ela define a própria
        senha — nem você nem o sistema chegam a vê-la. O link expira; se passar
        do prazo, gere outro pelo botão da chave.
      </Paragraph>
      <Input.TextArea
        value={link}
        readOnly
        autoSize={{ minRows: 3, maxRows: 5 }}
        style={{ fontFamily: FONTE_MONO, fontSize: 11.5 }}
      />
      <Button
        icon={<CopyOutlined />}
        style={{ marginTop: 10 }}
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          message.success("Link copiado.");
        }}
      >
        Copiar link
      </Button>
    </Modal>
  );
}
