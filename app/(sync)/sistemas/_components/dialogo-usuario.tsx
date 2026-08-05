"use client";

import { useEffect } from "react";
import { Alert, Form, Input, Modal, Select, Switch, Typography } from "antd";

import {
  papelDoSistema,
  type PrefeituraDoConsole,
  type SistemaParaTela,
  type UsuarioDoConsole,
} from "@/core/domain/sistemas";

const { Text } = Typography;

export interface ValoresDoUsuario {
  email: string;
  nome: string;
  papel: string;
  prefeitura: string;
  prefeituras?: string[];
  senha?: string;
  ativo?: boolean;
}

interface Props {
  sistema: SistemaParaTela;
  prefeituras: PrefeituraDoConsole[];
  aberto: boolean;
  edicao?: UsuarioDoConsole | null;
  salvando: boolean;
  aoFechar: () => void;
  aoSalvar: (valores: ValoresDoUsuario) => void;
}

export function DialogoUsuario({
  sistema,
  prefeituras,
  aberto,
  edicao,
  salvando,
  aoFechar,
  aoSalvar,
}: Props) {
  const [form] = Form.useForm<ValoresDoUsuario>();
  const papelEscolhido = Form.useWatch("papel", form);
  const papel = papelEscolhido ? papelDoSistema(sistema, papelEscolhido) : null;

  useEffect(() => {
    if (!aberto) return;
    form.setFieldsValue(
      edicao
        ? {
            email: edicao.email,
            nome: edicao.nome,
            papel: edicao.papel,
            prefeitura: edicao.prefeitura,
            prefeituras: edicao.prefeituras,
            ativo: edicao.ativo,
          }
        : {
            email: "",
            nome: "",
            papel: sistema.papelPadrao,
            prefeitura: prefeituras[0]?.slug,
            prefeituras: undefined,
            senha: "",
            ativo: true,
          },
    );
  }, [aberto, edicao, form, prefeituras, sistema]);

  const opcoesDePrefeitura = prefeituras.map((p) => ({
    value: p.slug,
    label: `${p.nome} — ${p.uf}`,
  }));

  return (
    <Modal
      title={edicao ? `Editar ${edicao.nome}` : `Novo usuário no ${sistema.nome}`}
      open={aberto}
      onCancel={aoFechar}
      okText={edicao ? "Salvar" : "Criar acesso"}
      cancelText="Cancelar"
      confirmLoading={salvando}
      onOk={() => form.validateFields().then(aoSalvar).catch(() => undefined)}
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical" requiredMark="optional" style={{ marginTop: 16 }}>
        <Form.Item
          name="email"
          label="E-mail"
          rules={[{ required: true, type: "email", message: "Informe um e-mail válido." }]}
          extra={
            edicao ? undefined : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Se já houver conta Global com este e-mail, ela é aproveitada — a senha atual
                continua valendo e os acessos aos outros produtos ficam intactos.
              </Text>
            )
          }
        >
          <Input placeholder="secretaria@municipio.ba.gov.br" disabled={Boolean(edicao)} autoFocus />
        </Form.Item>

        <Form.Item
          name="nome"
          label="Nome"
          rules={[{ required: true, min: 2, message: "Informe o nome de quem vai usar." }]}
        >
          <Input placeholder="Maria Souza" />
        </Form.Item>

        <Form.Item name="papel" label="Papel" rules={[{ required: true, message: "Escolha o papel." }]}>
          <Select
            options={sistema.papeis.map((p) => ({
              value: p.id,
              label: p.rotulo,
              title: p.descricao,
            }))}
          />
        </Form.Item>

        {papel && (
          <Alert
            type={papel.irrestrito ? "warning" : "info"}
            showIcon
            style={{ marginBottom: 24 }}
            message={papel.rotulo}
            description={
              papel.irrestrito
                ? `${papel.descricao} Este papel enxerga todas as prefeituras do ${sistema.nome}, não só a vinculada.`
                : papel.descricao
            }
          />
        )}

        <Form.Item
          name="prefeitura"
          label="Prefeitura"
          rules={[{ required: true, message: "Escolha a prefeitura." }]}
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              É o vínculo principal — vai no token e decide o que a pessoa enxerga.
            </Text>
          }
        >
          <Select showSearch optionFilterProp="label" options={opcoesDePrefeitura} />
        </Form.Item>

        <Form.Item
          name="prefeituras"
          label="Outras prefeituras"
          tooltip="Para quem atende mais de um município — consultor, por exemplo. Deixe vazio para vincular só à principal."
        >
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Nenhuma além da principal"
            options={opcoesDePrefeitura}
          />
        </Form.Item>

        {edicao ? (
          <Form.Item
            name="ativo"
            label="Acesso liberado"
            valuePropName="checked"
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Desligar bloqueia o login no Firebase na hora, em todos os produtos Global.
              </Text>
            }
          >
            <Switch />
          </Form.Item>
        ) : (
          <Form.Item
            name="senha"
            label="Senha inicial"
            rules={[{ min: 8, message: "Ao menos 8 caracteres." }]}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Deixe vazio — o recomendado. A conta nasce sem senha e o console devolve um link
                para a pessoa definir a dela, sem que a senha passe por você.
              </Text>
            }
          >
            <Input.Password placeholder="(em branco: gerar link de definição)" autoComplete="new-password" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
