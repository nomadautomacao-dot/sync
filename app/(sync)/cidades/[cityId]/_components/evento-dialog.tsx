"use client";

import { useState } from "react";
import dayjs from "dayjs";
import {
  DatePicker,
  Flex,
  Form,
  Input,
  Modal,
  Radio,
  Segmented,
  Typography,
  theme,
} from "antd";

import { COR_DO_TIPO, ICONE_DO_TIPO } from "./aparencia-do-evento";

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
      /* Mais largo e ancorado perto do topo para caber numa tela de notebook
         sem rolagem: em 620px os campos empilham e o formulário passa da
         altura da janela. O `maxHeight` é rede de segurança para tela baixa —
         o objetivo é não encostar nele. */
      width={760}
      /* `centered`, e não `top`: o antd 6 tirou `top`, e centrado o diálogo se
         acomoda sozinho a qualquer altura de janela. */
      centered
      styles={{
        body: {
          paddingTop: 12,
          maxHeight: "calc(100vh - 220px)",
          overflowY: "auto",
        },
      }}
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
        {/* O tipo em cartões com ícone e cor, e não numa lista suspensa: são
            cinco opções fixas, e a cor escolhida aqui é a mesma que a pessoa
            vai procurar na linha do tempo depois. Um `Select` esconde as
            opções atrás de um clique e não mostra cor nenhuma. */}
        <Form.Item label="O que é" name="tipo" style={{ marginBottom: 12 }}>
          <SeletorDeTipo desabilitado={editando} aoTrocar={setTipo} />
        </Form.Item>

        <Form.Item
          label="Título"
          name="titulo"
          rules={[{ required: true, message: "Diga em uma linha do que se trata." }]}
          style={{ marginBottom: 12 }}
        >
          <Input placeholder="Ex: Reunião com a Secretária de Educação" />
        </Form.Item>

        {/* Data e situação lado a lado: são dois campos curtos, e empilhá-los
            custava duas alturas de linha num formulário que já não cabia. */}
        <Flex gap={16} wrap="wrap">
          <Form.Item
            label={agendavel ? "Quando (pode ser no futuro)" : "Quando aconteceu"}
            name="quando"
            rules={[{ required: true, message: "Informe a data." }]}
            style={{ flex: "1 1 260px", marginBottom: 12 }}
          >
            <DatePicker
              showTime={{ format: "HH:mm" }}
              format="DD/MM/YYYY HH:mm"
              style={{ width: "100%" }}
            />
          </Form.Item>

          {editando && (
            <Form.Item
              label="Situação"
              name="estado"
              style={{ flex: "1 1 260px", marginBottom: 12 }}
            >
              <Segmented
                block
                options={(["marcado", "realizado", "cancelado"] as const).map((e) => ({
                  value: e,
                  label: ESTADO_LABELS[e],
                }))}
              />
            </Form.Item>
          )}

          <Form.Item
            label="Quem participa ou participou"
            name="participantes"
            style={{ flex: "1 1 260px", marginBottom: 12 }}
          >
            <Input placeholder="Ex: Secretária Maria, prefeito" />
          </Form.Item>
        </Flex>

        {agendavel && !editando && (
          <Text
            type="secondary"
            style={{ fontSize: 11.5, display: "block", marginTop: -4, marginBottom: 10 }}
          >
            Data no futuro entra como compromisso marcado; data passada entra como já realizado.
          </Text>
        )}

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
            rows={3}
            placeholder="O que foi tratado, o que ficou pendente, qual o próximo passo."
          />
        </Form.Item>

        {/* Era um `Alert` de três linhas. Vira uma: a informação importa e não
            justifica um quinto da altura do formulário. */}
        {editando && (
          <Text type="secondary" style={{ fontSize: 11.5 }}>
            A autoria não muda: este registro continua sendo de {evento.autorNome}.
          </Text>
        )}
      </Form>
    </Modal>
  );
}

/**
 * Escolhe o tipo do acontecimento em cartões, com o ícone e a cor que ele terá
 * na linha do tempo.
 *
 * É um `Radio.Group` e não uma fileira de `<button>`: são as mesmas caixas na
 * tela, e o rádio traz de graça o que o botão perderia — navegação por setas,
 * papel de "escolha uma entre N" para leitor de tela, `disabled` propagado e a
 * integração com `Form.Item` sem passar `value`/`onChange` à mão. O que fica
 * por nossa conta é só a cor de cada opção.
 *
 * `aoTrocar` avisa o diálogo à parte porque ele muda de rótulo conforme o tipo
 * (uma ligação não é agendável, uma reunião é), e essa decisão não é do campo.
 */
function SeletorDeTipo({
  value,
  onChange,
  desabilitado,
  aoTrocar,
}: {
  value?: TipoDeEvento;
  onChange?: (valor: TipoDeEvento) => void;
  desabilitado: boolean;
  aoTrocar: (valor: TipoDeEvento) => void;
}) {
  const { token } = theme.useToken();

  return (
    <Radio.Group
      value={value}
      disabled={desabilitado}
      onChange={(evento) => {
        const escolhido = evento.target.value as TipoDeEvento;
        onChange?.(escolhido);
        aoTrocar(escolhido);
      }}
      style={{ display: "flex", flexWrap: "wrap", gap: 8, width: "100%" }}
    >
      {TIPOS_MANUAIS.map((definicao) => {
        const Icone = ICONE_DO_TIPO[definicao.key];
        const cor = COR_DO_TIPO[definicao.key](token);
        const escolhido = value === definicao.key;

        return (
          <Radio.Button
            key={definicao.key}
            value={definicao.key}
            style={{
              flex: "1 1 92px",
              height: "auto",
              paddingBlock: 12,
              textAlign: "center",
              borderRadius: token.borderRadiusLG,
              borderInlineStartWidth: 1,
              borderColor: escolhido ? cor : token.colorBorder,
              background: escolhido ? `${cor}14` : token.colorBgContainer,
              color: escolhido ? cor : token.colorText,
              /* Editando, o tipo não muda: uma reunião que vira nota deixa o
                 histórico contando outra história da que foi vivida. Os cartões
                 continuam à vista, apagados, para a pessoa ver qual é o tipo em
                 vez de encarar um campo vazio. */
              opacity: desabilitado && !escolhido ? 0.35 : 1,
            }}
          >
            <Flex vertical align="center" gap={6}>
              <span style={{ fontSize: 18, lineHeight: 1, color: cor }}>
                <Icone />
              </span>
              <span style={{ fontSize: 12 }}>{definicao.rotulo}</span>
            </Flex>
          </Radio.Button>
        );
      })}
    </Radio.Group>
  );
}
