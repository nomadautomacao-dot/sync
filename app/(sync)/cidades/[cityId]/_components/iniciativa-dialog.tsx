"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Checkbox,
  DatePicker,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Typography,
} from "antd";

import {
  definicaoDaIniciativa,
  type DefinicaoDeIniciativa,
  type TipoDeIniciativa,
} from "@/core/domain/cidade-iniciativas";
import type { EtapaModelo } from "@/core/domain/cronograma";

const { Text } = Typography;

export interface ValoresDaIniciativa {
  tipo: TipoDeIniciativa;
  nome: string;
  objetivo?: string;
  inicio: string;
  fim?: string;
  etapaModeloKey?: string;
  cargaHoraria?: number;
  formador?: string;
}

interface CamposDoFormulario {
  tipo: TipoDeIniciativa;
  nome: string;
  objetivo?: string;
  periodo: [dayjs.Dayjs, dayjs.Dayjs | null] | null;
  etapaModeloKey?: string;
  cargaHoraria?: number;
  formador?: string;
}

/**
 * Abre um projeto, capacitação, programa ou serviço no município.
 *
 * ## Um período, não duas datas
 *
 * `RangePicker` em vez de dois `DatePicker` porque a pergunta é "de quando a
 * quando", e dois campos soltos deixam passar fim anterior ao início — erro que
 * só aparece na lista, semanas depois, como um projeto eternamente atrasado.
 * O fim é opcional: serviço contínuo não tem data para acabar.
 *
 * ## Carga horária some fora da capacitação
 *
 * Perguntar carga horária de "assessoria contínua" produz campo vazio em todo
 * cadastro, e campo que ninguém preenche ensina a ignorar o formulário inteiro.
 * Quem decide é `temFormacao`, no catálogo — e o domínio descarta o valor de
 * qualquer jeito se o tipo não o comporta.
 */
export function IniciativaDialog({
  aberto,
  salvando,
  etapasDoModelo,
  catalogo,
  criandoTipo,
  aoCriarTipo,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  salvando: boolean;
  etapasDoModelo: readonly EtapaModelo[];
  /** Os quatro do sistema mais os que a equipe criou. */
  catalogo: readonly DefinicaoDeIniciativa[];
  criandoTipo: boolean;
  /** Cria o tipo e devolve a chave, para o formulário já selecioná-la. */
  aoCriarTipo: (rotulo: string, temFormacao: boolean) => Promise<string>;
  aoFechar: () => void;
  aoSalvar: (valores: ValoresDaIniciativa) => Promise<void>;
}) {
  const [form] = Form.useForm<CamposDoFormulario>();
  const [tipo, setTipo] = useState<TipoDeIniciativa>("capacitacao");

  const temFormacao = definicaoDaIniciativa(tipo, catalogo).temFormacao;

  const fechar = () => {
    form.resetFields();
    setTipo("capacitacao");
    aoFechar();
  };

  const enviar = async (campos: CamposDoFormulario) => {
    const [inicio, fim] = campos.periodo ?? [];
    await aoSalvar({
      tipo: campos.tipo,
      nome: campos.nome,
      objetivo: campos.objetivo,
      inicio: inicio!.format("YYYY-MM-DD"),
      fim: fim ? fim.format("YYYY-MM-DD") : undefined,
      etapaModeloKey: campos.etapaModeloKey,
      cargaHoraria: campos.cargaHoraria,
      formador: campos.formador,
    });
    form.resetFields();
    setTipo("capacitacao");
  };

  return (
    <Modal
      open={aberto}
      title="Abrir projeto na cidade"
      okText="Abrir"
      cancelText="Cancelar"
      confirmLoading={salvando}
      onCancel={fechar}
      onOk={() => form.submit()}
      destroyOnHidden
      /* Centrado e com o corpo limitado à janela: o formulário tem seis campos
         e, ancorado no topo, o rodapé com o botão "Abrir" caía fora da tela em
         notebook — o usuário via um diálogo sem como confirmar. */
      centered
      width={640}
      styles={{ body: { maxHeight: "calc(100vh - 220px)", overflowY: "auto" } }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={enviar}
        initialValues={{ tipo: "capacitacao" as TipoDeIniciativa }}
        style={{ marginTop: 12 }}
      >
        <Form.Item name="tipo" label="Tipo" rules={[{ required: true }]}>
          <Select
            onChange={(valor: TipoDeIniciativa) => setTipo(valor)}
            options={catalogo.map((t) => ({ value: t.key, label: t.rotulo }))}
            /* O "+" mora dentro da lista, e não como botão ao lado: quem
               precisa de um tipo novo descobre isso ao abrir a lista e não
               achar o que queria — é ali que a saída tem de estar. */
            popupRender={(lista) => (
              <>
                {lista}
                <Divider style={{ margin: "8px 0" }} />
                <NovoTipo
                  salvando={criandoTipo}
                  aoCriar={async (rotulo, comFormacao) => {
                    const chave = await aoCriarTipo(rotulo, comFormacao);
                    form.setFieldValue("tipo", chave);
                    setTipo(chave);
                  }}
                />
              </>
            )}
          />
        </Form.Item>

        <Form.Item
          name="nome"
          label="Nome"
          rules={[{ required: true, message: "Dê um nome ao projeto." }]}
        >
          <Input placeholder="Ex.: Avanços para a Educação" maxLength={120} />
        </Form.Item>

        <Form.Item
          name="periodo"
          label="Período"
          rules={[{ required: true, message: "Diga quando começa." }]}
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              O fim é opcional — serviço contínuo não tem data para acabar.
            </Text>
          }
        >
          <DatePicker.RangePicker
            style={{ width: "100%" }}
            format="DD/MM/YYYY"
            allowEmpty={[false, true]}
            placeholder={["Início", "Fim (opcional)"]}
          />
        </Form.Item>

        {temFormacao && (
          <>
            <Form.Item
              name="cargaHoraria"
              label="Carga horária"
              rules={[
                {
                  type: "number",
                  min: 1,
                  max: 999,
                  message: "Carga horária entre 1 e 999 horas.",
                },
              ]}
            >
              {/* `suffix`, e não `addonAfter`: o antd 6 depreciou o segundo e
                  avisa no console a cada render. */}
              <InputNumber style={{ width: "100%" }} suffix="horas" placeholder="6" />
            </Form.Item>

            <Form.Item name="formador" label="Formação a cargo de">
              <Input placeholder="Quem ministra" maxLength={120} />
            </Form.Item>
          </>
        )}

        <Form.Item
          name="etapaModeloKey"
          label="Cumpre qual etapa do cronograma?"
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              Ao concluir este projeto, a etapa é concluída junto. Sem isso, a mesma ficha
              mostraria o projeto pronto e a etapa pendente.
            </Text>
          }
        >
          <Select
            allowClear
            placeholder="Nenhuma"
            options={etapasDoModelo.map((e) => ({ value: e.key, label: e.nome }))}
          />
        </Form.Item>

        <Form.Item name="objetivo" label="Objetivo">
          <Input.TextArea rows={3} maxLength={600} placeholder="O que este projeto entrega." />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/**
 * O "+" dentro da lista de tipos.
 *
 * A caixa de "tem carga horária" existe porque é o único comportamento que
 * varia entre tipos: uma "Formação continuada" precisa de carga horária e
 * formador como a capacitação; uma "Assessoria" não. Perguntar isso na criação
 * é o que evita que o tipo novo nasça sem os campos que a pessoa esperava — e
 * ela descobrindo só no cadastro seguinte.
 */
function NovoTipo({
  salvando,
  aoCriar,
}: {
  salvando: boolean;
  aoCriar: (rotulo: string, temFormacao: boolean) => Promise<void>;
}) {
  const [rotulo, setRotulo] = useState("");
  const [comFormacao, setComFormacao] = useState(false);

  const criar = async () => {
    if (!rotulo.trim()) return;
    await aoCriar(rotulo, comFormacao);
    setRotulo("");
    setComFormacao(false);
  };

  return (
    <Flex vertical gap={8} style={{ padding: "4px 8px 8px" }}>
      <Flex gap={8}>
        <Input
          size="small"
          placeholder="Novo tipo — ex.: Formação continuada"
          value={rotulo}
          maxLength={40}
          onChange={(evento) => setRotulo(evento.target.value)}
          /* O Enter aqui não pode subir para o `Form`: ele submeteria o
             cadastro do projeto inteiro com o formulário pela metade. */
          onKeyDown={(evento) => {
            if (evento.key === "Enter") {
              evento.preventDefault();
              evento.stopPropagation();
              void criar();
            }
          }}
          onClick={(evento) => evento.stopPropagation()}
        />
        <Button
          size="small"
          type="primary"
          icon={<PlusOutlined />}
          loading={salvando}
          disabled={!rotulo.trim()}
          onClick={(evento) => {
            evento.stopPropagation();
            void criar();
          }}
        >
          Criar
        </Button>
      </Flex>
      <Checkbox
        checked={comFormacao}
        onChange={(evento) => setComFormacao(evento.target.checked)}
        onClick={(evento) => evento.stopPropagation()}
      >
        <Text style={{ fontSize: 12 }}>Tem carga horária e formador</Text>
      </Checkbox>
    </Flex>
  );
}
