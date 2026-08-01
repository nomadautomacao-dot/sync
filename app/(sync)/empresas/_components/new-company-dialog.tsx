"use client";

import { useState } from "react";
import { BankOutlined } from "@ant-design/icons";
import {
  Button,
  Checkbox,
  Col,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Typography,
  theme,
} from "antd";

import type { CompanyItem } from "@/core/lib/company-types";
import { cleanCnpj } from "@/core/lib/company-types";

interface NewCompanyDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: Partial<CompanyItem> & { cnpj: string; razaoSocial: string }) => Promise<void>;
}

const AVAILABLE_MODULES = [
  { id: "pipeline", label: "Pipeline de Vendas" },
  { id: "levantamento_fundeb", label: "Levantamento FUNDEB" },
  { id: "contrato_fundeb", label: "Gestão de Contratos" },
  { id: "caixa", label: "Fluxo de Caixa" },
];

/* Campos que ficam de fato dentro do `Form` do Ant. */
interface CamposDoFormulario {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  responsavelNome: string;
  responsavelEmail: string;
  modules: string[];
}

export function NewCompanyDialog({ open, onClose, onSubmit }: NewCompanyDialogProps) {
  const { token } = theme.useToken();
  const [form] = Form.useForm<CamposDoFormulario>();
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    form.resetFields();
    setSubmitting(false);
    onClose();
  };

  const handleFinish = async (values: CamposDoFormulario) => {
    const rawCnpj = cleanCnpj(values.cnpj);
    setSubmitting(true);
    try {
      await onSubmit({
        cnpj: rawCnpj,
        razaoSocial: values.razaoSocial.trim(),
        nomeFantasia: values.nomeFantasia?.trim() || values.razaoSocial.trim(),
        responsavelNome: values.responsavelNome?.trim() || undefined,
        responsavelEmail: values.responsavelEmail?.trim() || undefined,
        activeModules: values.modules,
        status: "ativo",
        employeeCount: 1,
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
      maskClosable={false}
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
            <BankOutlined />
          </Flex>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Nova Empresa
          </Typography.Title>
        </Space>
      }
      footer={
        <Space>
          <Button onClick={reset}>Cancelar</Button>
          <Button type="primary" loading={submitting} onClick={() => form.submit()}>
            {submitting ? "Salvando..." : "Cadastrar Empresa"}
          </Button>
        </Space>
      }
    >
      <Form<CamposDoFormulario>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{
          cnpj: "",
          razaoSocial: "",
          nomeFantasia: "",
          responsavelNome: "",
          responsavelEmail: "",
          modules: ["pipeline", "levantamento_fundeb"],
        }}
      >
        <Form.Item
          label="CNPJ"
          name="cnpj"
          rules={[{ required: true, message: "Informe o CNPJ." }]}
        >
          <Input placeholder="00.000.000/0001-00" />
        </Form.Item>

        <Form.Item
          label="Razão Social"
          name="razaoSocial"
          rules={[{ required: true, message: "Informe a razão social." }]}
        >
          <Input placeholder="Empresa Exemplo LTDA" />
        </Form.Item>

        <Form.Item label="Nome Fantasia" name="nomeFantasia">
          <Input placeholder="Exemplo Soluções" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Responsável" name="responsavelNome">
              <Input placeholder="Nome do responsável" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="E-mail Responsável"
              name="responsavelEmail"
              rules={[{ type: "email", message: "E-mail inválido." }]}
            >
              <Input placeholder="contato@empresa.com" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Módulos Habilitados" name="modules">
          <Checkbox.Group style={{ width: "100%" }}>
            <Row gutter={[8, 8]}>
              {AVAILABLE_MODULES.map((mod) => (
                <Col span={12} key={mod.id}>
                  <Checkbox value={mod.id}>{mod.label}</Checkbox>
                </Col>
              ))}
            </Row>
          </Checkbox.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
}
