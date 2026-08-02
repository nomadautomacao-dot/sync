"use client";

import { DeleteOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Modal, Space, theme, Typography } from "antd";

const { Paragraph, Text } = Typography;

interface DeleteCityDialogProps {
  cityName: string;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmação de exclusão vira `Modal` do Ant: ele já resolve foco, ESC e
 * clique fora — o componente próprio em cima do Radix (overlay, animação,
 * bloqueio de fechamento durante a exclusão) existia só para reimplementar
 * isso. `closable`/`maskClosable`/`keyboard` amarrados a `!deleting`
 * reproduzem o antigo bloqueio de fechar no meio da exclusão.
 */
export function DeleteCityDialog({
  cityName,
  deleting,
  onClose,
  onConfirm,
}: DeleteCityDialogProps) {
  const { token } = theme.useToken();

  return (
    <Modal
      open
      title={`Excluir ${cityName}?`}
      closable={!deleting}
      mask={{ closable: !deleting }}
      keyboard={!deleting}
      onCancel={onClose}
      onOk={onConfirm}
      confirmLoading={deleting}
      cancelButtonProps={{ disabled: deleting }}
      okText="Excluir cidade"
      cancelText="Cancelar"
      okButtonProps={{ danger: true, icon: <DeleteOutlined /> }}
    >
      <Paragraph type="secondary">
        A cidade deixará de aparecer na carteira, no pipeline e nos painéis da
        equipe.
      </Paragraph>

      <Space
        align="start"
        size={12}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: token.borderRadiusLG,
          background: token.colorSuccessBg,
          border: `1px solid ${token.colorSuccessBorder}`,
        }}
      >
        <SafetyCertificateOutlined
          style={{ color: token.colorSuccess, fontSize: 18, marginTop: 2 }}
        />
        <div>
          <Text strong>O histórico não será apagado</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Relatórios, arquivos JSON e documentos continuarão armazenados
            para consulta e eventual restauração.
          </Text>
        </div>
      </Space>
    </Modal>
  );
}
