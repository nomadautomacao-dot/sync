"use client";

import { useState } from "react";
import { UserAddOutlined } from "@ant-design/icons";
import {
  Button,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Typography,
  theme,
} from "antd";

import type { CollaboratorItem } from "@/core/lib/people-types";

interface NewCollaboratorDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: Partial<CollaboratorItem> & { fullName: string }) => Promise<void>;
}

const TIPOS_DE_VINCULO = [
  { value: "consultor_parceiro", label: "Consultor Parceiro" },
  { value: "articulador_politico", label: "Articulador Político" },
  { value: "socio_executivo", label: "Sócio Executivo" },
  { value: "equipe_interna", label: "Equipe Interna" },
  { value: "suporte_tecnico", label: "Suporte Técnico" },
];

/* Campos que ficam de fato dentro do `Form` do Ant. */
interface CamposDoFormulario {
  fullName: string;
  email: string;
  phone: string;
  state: string;
  primaryRole: string;
  collaboratorType: string;
  defaultCommissionPercent: number;
}

export function NewCollaboratorDialog({
  open,
  onClose,
  onSubmit,
}: NewCollaboratorDialogProps) {
  const { token } = theme.useToken();
  const [form] = Form.useForm<CamposDoFormulario>();
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    form.resetFields();
    setSubmitting(false);
    onClose();
  };

  const handleFinish = async (values: CamposDoFormulario) => {
    setSubmitting(true);
    try {
      await onSubmit({
        fullName: values.fullName.trim(),
        email: values.email?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        state: values.state,
        primaryRole: values.primaryRole,
        collaboratorType: values.collaboratorType,
        defaultCommissionPercent: values.defaultCommissionPercent,
        partnershipStatus: "ativo",
      });
      reset();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={reset}
      mask={{ closable: false }}
      destroyOnHidden
      width={540}
      centered
      title={
        <Space size={10} align="start">
          <Flex
            align="center"
            justify="center"
            style={{
              width: 36,
              height: 36,
              borderRadius: token.borderRadiusLG,
              background: token.colorFillTertiary,
              color: token.colorText,
              flexShrink: 0,
            }}
          >
            <UserAddOutlined />
          </Flex>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Nova Pessoa / Colaborador
          </Typography.Title>
        </Space>
      }
      footer={
        <Space>
          <Button onClick={reset}>Cancelar</Button>
          <Button type="primary" loading={submitting} onClick={() => form.submit()}>
            {submitting ? "Salvando..." : "Cadastrar Pessoa"}
          </Button>
        </Space>
      }
    >
      <Form<CamposDoFormulario>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{
          fullName: "",
          email: "",
          phone: "",
          state: "DF",
          primaryRole: "Consultor Regional",
          collaboratorType: "consultor_parceiro",
          defaultCommissionPercent: 10,
        }}
      >
        <Form.Item
          label="Nome Completo"
          name="fullName"
          rules={[{ required: true, message: "Informe o nome completo." }]}
        >
          <Input placeholder="Ex: João da Silva" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              label="E-mail"
              name="email"
              rules={[{ type: "email", message: "E-mail inválido." }]}
            >
              <Input placeholder="joao@empresa.com" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Telefone / Whats" name="phone">
              <Input placeholder="(61) 99999-9999" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={6}>
            <Form.Item label="UF" name="state">
              <Input
                maxLength={2}
                style={{ textTransform: "uppercase", fontFamily: "var(--font-sync-mono)" }}
                onChange={(event) =>
                  form.setFieldValue("state", event.target.value.toUpperCase())
                }
              />
            </Form.Item>
          </Col>
          <Col span={18}>
            <Form.Item label="Função Principal" name="primaryRole">
              <Input placeholder="Ex: Consultor Regional" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Tipo de Vínculo" name="collaboratorType">
              <Select options={TIPOS_DE_VINCULO} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Comissão (%)" name="defaultCommissionPercent">
              <InputNumber<number>
                min={0}
                max={100}
                style={{ width: "100%", fontFamily: "var(--font-sync-mono)" }}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
