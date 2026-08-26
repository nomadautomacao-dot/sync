"use client";

import { useState } from "react";
import { EditOutlined, UserAddOutlined } from "@ant-design/icons";
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
import type { CamposEditaveis } from "@/core/lib/collaborators-firestore";

const TIPOS_DE_VINCULO = [
  { value: "consultor_parceiro", label: "Consultor Parceiro" },
  { value: "articulador_politico", label: "Articulador Político" },
  { value: "socio_executivo", label: "Sócio Executivo" },
  { value: "equipe_interna", label: "Equipe Interna" },
  { value: "suporte_tecnico", label: "Suporte Técnico" },
];

const SITUACOES = [
  { value: "ativo", label: "Ativo" },
  { value: "pendente", label: "Pendente" },
  { value: "pausado", label: "Pausado" },
  { value: "inativo", label: "Inativo" },
];

/**
 * Um formulário só para cadastrar e para editar.
 *
 * Eram duas telas em potencial, e duas teriam divergido no primeiro campo novo
 * — o cadastro pedindo sete campos e a edição mostrando nove, sem que ninguém
 * percebesse de qual lado faltava. Aqui a lista de campos é uma; o que muda
 * entre os modos é o título, o texto do botão e de onde vêm os valores iniciais.
 *
 * Campos apurados (comissão paga, lucro, número de cidades) não aparecem: eles
 * vêm de contrato e de comissão, não de digitação. Ver `corpoDaEdicao`.
 */
export interface CollaboratorFormDialogProps {
  /** `null` fecha; um item abre em edição; `"novo"` abre em cadastro. */
  alvo: CollaboratorItem | "novo" | null;
  onClose: () => void;
  onSubmit: (valores: CamposEditaveis) => Promise<void>;
}

export function CollaboratorFormDialog({
  alvo,
  onClose,
  onSubmit,
}: CollaboratorFormDialogProps) {
  const { token } = theme.useToken();
  const [form] = Form.useForm<CamposEditaveis>();
  const [salvando, setSalvando] = useState(false);

  const editando = alvo !== null && alvo !== "novo";
  const pessoa = editando ? alvo : null;

  const fechar = () => {
    form.resetFields();
    setSalvando(false);
    onClose();
  };

  const enviar = async (valores: CamposEditaveis) => {
    setSalvando(true);
    try {
      await onSubmit(valores);
      fechar();
    } catch {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open={alvo !== null}
      onCancel={fechar}
      mask={{ closable: false }}
      destroyOnHidden
      width={620}
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
            {editando ? <EditOutlined /> : <UserAddOutlined />}
          </Flex>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {editando ? `Editar ${pessoa?.fullName}` : "Nova Pessoa / Colaborador"}
          </Typography.Title>
        </Space>
      }
      footer={
        <Space>
          <Button onClick={fechar}>Cancelar</Button>
          <Button type="primary" loading={salvando} onClick={() => form.submit()}>
            {editando ? "Salvar alterações" : "Cadastrar Pessoa"}
          </Button>
        </Space>
      }
    >
      <Form<CamposEditaveis>
        form={form}
        layout="vertical"
        onFinish={enviar}
        /* `destroyOnHidden` desmonta o formulário ao fechar, então estes valores
           são relidos a cada abertura — trocar de pessoa na tabela não deixa o
           formulário com o dado de quem foi aberto antes. */
        initialValues={{
          fullName: pessoa?.fullName ?? "",
          email: pessoa?.email ?? "",
          phone: pessoa?.phone ?? "",
          whatsapp: pessoa?.whatsapp ?? "",
          state: pessoa?.state ?? "DF",
          primaryRole: pessoa?.primaryRole ?? "Consultor Regional",
          collaboratorType: pessoa?.collaboratorType ?? "consultor_parceiro",
          partnershipStatus: pessoa?.partnershipStatus ?? "ativo",
          defaultCommissionPercent: pessoa?.defaultCommissionPercent ?? 10,
          companyOrOrganization: pessoa?.companyOrOrganization ?? "",
          pixKey: pessoa?.pixKey ?? "",
          bankAccountInfo: pessoa?.bankAccountInfo ?? "",
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
              extra="É por ele que o acesso ao sistema é concedido."
            >
              <Input placeholder="joao@empresa.com" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Telefone" name="phone">
              <Input placeholder="(61) 99999-9999" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="WhatsApp"
          name="whatsapp"
          /* O telefone responde pelo WhatsApp quando este fica vazio — ver
             `whatsappDoColaborador`. Dizer isso aqui evita a digitação dupla. */
          extra="Só preencha se for diferente do telefone."
        >
          <Input placeholder="Mesmo do telefone" />
        </Form.Item>

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
          <Col span={8}>
            <Form.Item label="Tipo de Vínculo" name="collaboratorType">
              <Select options={TIPOS_DE_VINCULO} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Situação" name="partnershipStatus">
              <Select options={SITUACOES} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Comissão (%)" name="defaultCommissionPercent">
              <InputNumber<number>
                min={0}
                max={100}
                style={{ width: "100%", fontFamily: "var(--font-sync-mono)" }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Empresa / Organização" name="companyOrOrganization">
          <Input placeholder="Ex: Global Company" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Chave PIX" name="pixKey">
              <Input placeholder="CPF, e-mail ou aleatória" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Dados Bancários" name="bankAccountInfo">
              <Input placeholder="Banco · agência · conta" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
