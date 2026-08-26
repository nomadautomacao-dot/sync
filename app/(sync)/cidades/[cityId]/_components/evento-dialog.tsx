"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { Alert, DatePicker, Form, Input, Modal, Select, Typography } from "antd";

import {
  ESTADO_LABELS,
  TIPOS_MANUAIS,
  definicaoDoTipo,
  type EstadoDoEvento,
  type EventoDaCidade,
  type TipoDeEvento,
} from "@/core/domain/cidade-eventos";

const { Text } = Typography;

export interface ValoresDoEvento {
  tipo: TipoDeEvento;
  titulo: string;
  quando: string;
  participantes?: string;
  relato?: string;
  estado?: EstadoDoEvento;
}

interface CamposDoFormulario {
  tipo: TipoDeEvento;
  titulo: string;
  quando: dayjs.Dayjs;
  participantes?: string;
  relato?: string;
  estado?: EstadoDoEvento;
}

/**
 * Registra um acontecimento, corrige um registro ou dá desfecho a um
 * compromisso — as três coisas no mesmo formulário.
 *
 * São o mesmo ato do ponto de vista de quem usa: "contar o que se passou".
 * Separar em três telas obrigaria a pessoa a saber, antes de clicar, em qual
 * estado o registro está — e ela clica no que quer contar, não no estado.
 */
export function EventoDialog({
  aberto,
  evento,
  salvando,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  /** `null` cria; um evento abre em edição. */
  evento: EventoDaCidade | null;
  salvando: boolean;
  aoFechar: () => void;
  aoSalvar: (valores: ValoresDoEvento) => Promise<void>;
}) {
  const [form] = Form.useForm<CamposDoFormulario>();
  const [tipo, setTipo] = useState<TipoDeEvento>(evento?.tipo ?? "reuniao");

  const editando = evento !== null;
  const agendavel = definicaoDoTipo(tipo).agendavel;

  const fechar = () => {
    form.resetFields();
    aoFechar();
  };

  const enviar = async (campos: CamposDoFormulario) => {
    await aoSalvar({
      tipo: campos.tipo,
      titulo: campos.titulo,
      quando: campos.quando.toISOString(),
      participantes: campos.participantes,
      relato: campos.relato,
      estado: campos.estado,
    });
    form.resetFields();
  };

  return (
    <Modal
      open={aberto}
      onCancel={fechar}
      destroyOnHidden
      width={620}
      title={editando ? "Editar registro" : "Registrar na linha do tempo"}
      okText={editando ? "Salvar" : "Registrar"}
      cancelText="Cancelar"
      confirmLoading={salvando}
      onOk={() => form.submit()}
    >
      <Form<CamposDoFormulario>
        form={form}
        layout="vertical"
        onFinish={enviar}
        initialValues={{
          tipo: evento?.tipo ?? "reuniao",
          titulo: evento?.titulo ?? "",
          quando: dayjs(evento?.quando ?? undefined),
          participantes: evento?.participantes ?? "",
          relato: evento?.relato ?? "",
          ...(editando ? { estado: evento.estado } : {}),
        }}
      >
        <Form.Item label="O que é" name="tipo">
          <Select
            onChange={(valor: TipoDeEvento) => setTipo(valor)}
            /* O tipo não muda depois: uma reunião que vira nota deixa o
               histórico contando outra história da que foi vivida. */
            disabled={editando}
            options={TIPOS_MANUAIS.map((t) => ({ value: t.key, label: t.rotulo }))}
          />
        </Form.Item>

        <Form.Item
          label="Título"
          name="titulo"
          rules={[{ required: true, message: "Diga em uma linha do que se trata." }]}
        >
          <Input placeholder="Ex: Reunião com a Secretária de Educação" />
        </Form.Item>

        <Form.Item
          label={agendavel ? "Quando (pode ser no futuro)" : "Quando aconteceu"}
          name="quando"
          rules={[{ required: true, message: "Informe a data." }]}
          extra={
            agendavel && !editando ? (
              <Text type="secondary" style={{ fontSize: 11.5 }}>
                Data no futuro entra como compromisso marcado; data passada entra
                como já realizado.
              </Text>
            ) : undefined
          }
        >
          <DatePicker
            showTime={{ format: "HH:mm" }}
            format="DD/MM/YYYY HH:mm"
            style={{ width: "100%" }}
          />
        </Form.Item>

        {editando && (
          <Form.Item label="Situação" name="estado">
            <Select
              options={(["marcado", "realizado", "cancelado"] as const).map((e) => ({
                value: e,
                label: ESTADO_LABELS[e],
              }))}
            />
          </Form.Item>
        )}

        <Form.Item label="Quem participa ou participou" name="participantes">
          <Input placeholder="Ex: Secretária Maria, prefeito, equipe do FUNDEB" />
        </Form.Item>

        <Form.Item
          label="Relato"
          name="relato"
          extra={
            <Text type="secondary" style={{ fontSize: 11.5 }}>
              Pode ficar vazio agora e ser preenchido quando acontecer.
            </Text>
          }
        >
          <Input.TextArea
            rows={5}
            placeholder="O que foi tratado, o que ficou pendente, qual o próximo passo."
          />
        </Form.Item>

        {editando && (
          <Alert
            type="info"
            showIcon
            title="A autoria não muda"
            description={`Este registro continua sendo de ${evento.autorNome}, mesmo depois de editado.`}
          />
        )}
      </Form>
    </Modal>
  );
}
