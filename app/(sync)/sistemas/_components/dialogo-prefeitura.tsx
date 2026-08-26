"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BankOutlined,
  BookOutlined,
  IdcardOutlined,
  ReadOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Alert,
  AutoComplete,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
  theme,
} from "antd";

import {
  slugDePrefeitura,
  UFS,
  type PrefeituraDoConsole,
  type ReferenciaCenso,
  type SistemaParaTela,
} from "@/core/domain/sistemas";

import { buscarMunicipios, dossieDoMunicipio, type Dossie } from "../_lib/api";

const { Text, Paragraph } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

const numero = (v?: number) => (typeof v === "number" ? v.toLocaleString("pt-BR") : "—");

export interface ValoresDaPrefeitura {
  nome: string;
  uf: string;
  slug?: string;
  status?: string;
  codigoIbge?: string;
  regiao?: string;
  populacao?: number;
  prefeito?: string;
  partido?: string;
  referenciaCenso?: ReferenciaCenso;
  ideb?: { anosIniciais: number | null; anosFinais: number | null; ano: number };
}

interface Props {
  sistema: SistemaParaTela;
  aberto: boolean;
  /** Preenchido = edição. Vazio = cadastro. */
  edicao?: PrefeituraDoConsole | null;
  salvando: boolean;
  aoFechar: () => void;
  aoSalvar: (valores: ValoresDaPrefeitura) => void;
}

/**
 * Cadastro de prefeitura.
 *
 * No cadastro, digitar o nome basta: a escolha na lista do IBGE traz código,
 * UF e região, e o dossiê preenche o resto do que a Global já sabe do
 * município — população, prefeito eleito, o Censo Escolar da rede municipal e o
 * IDEB. Nada disso é digitado à mão, e nada disso depende de API viva: são
 * datasets que já vêm no build.
 *
 * Na edição o município não muda — só a situação cadastral.
 */
export function DialogoPrefeitura({ sistema, aberto, edicao, salvando, aoFechar, aoSalvar }: Props) {
  const [form] = Form.useForm<{ nome: string; uf: string; slug?: string; status?: string }>();
  const { token } = theme.useToken();

  const [termo, setTermo] = useState("");
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const editando = Boolean(edicao);

  const busca = useQuery({
    queryKey: ["municipios", termo],
    queryFn: () => buscarMunicipios(termo),
    enabled: aberto && !editando && termo.trim().length >= 2,
    staleTime: 10 * 60 * 1000,
  });

  const dossie = useQuery({
    queryKey: ["dossie", escolhido],
    queryFn: () => {
      const m = (busca.data ?? []).find((x) => x.codigoIbge === escolhido);
      return dossieDoMunicipio(escolhido!, m);
    },
    enabled: aberto && !editando && Boolean(escolhido),
    staleTime: 60 * 60 * 1000,
  });

  /**
   * Reset ao abrir, disparado pelo evento do Modal e não por efeito.
   *
   * O componente fica montado entre uma abertura e outra — sem isto, o segundo
   * cadastro herdaria o município do primeiro. Em efeito, o `setState` causaria
   * renderização em cascata; em `afterOpenChange`, roda uma vez, no momento
   * certo, e sem piscar a tela enquanto o diálogo fecha.
   */
  const aoTerminarDeAbrir = (abriu: boolean) => {
    if (!abriu) return;
    setEscolhido(null);
    setTermo("");
    form.setFieldsValue(
      edicao
        ? { nome: edicao.nome, uf: edicao.uf, slug: edicao.slug, status: edicao.status }
        : { nome: "", uf: undefined, slug: "", status: sistema.statusPrefeitura[0]?.id },
    );
  };

  // O dossiê é a fonte: ao chegar, ele manda nos campos de identificação.
  useEffect(() => {
    if (!dossie.data) return;
    form.setFieldsValue({ nome: dossie.data.nome, uf: dossie.data.uf });
  }, [dossie.data, form]);

  const opcoes = useMemo(
    () =>
      (busca.data ?? []).map((m) => ({
        value: m.codigoIbge,
        label: (
          <Space size={6}>
            <Text>{m.nome}</Text>
            <Tag style={{ marginInlineEnd: 0 }}>{m.uf}</Tag>
            <Text type="secondary" style={{ fontFamily: FONTE_MONO, fontSize: 11 }}>
              {m.codigoIbge}
            </Text>
          </Space>
        ),
        nome: m.nome,
      })),
    [busca.data],
  );

  const nomeAtual = Form.useWatch("nome", form);
  const slugDigitado = Form.useWatch("slug", form);
  const slugPrevisto = slugDigitado?.trim() || slugDePrefeitura(nomeAtual ?? "");

  const confirmar = async () => {
    const valores = await form.validateFields().catch(() => null);
    if (!valores) return;
    const d = dossie.data;
    aoSalvar({
      ...valores,
      codigoIbge: d?.codigoIbge,
      regiao: d?.regiao,
      populacao: d?.populacao,
      prefeito: d?.prefeito,
      partido: d?.partido,
      referenciaCenso: d?.censo,
      ideb: d?.ideb,
    });
  };

  return (
    <Modal
      title={edicao ? `Editar ${edicao.nome}` : `Nova prefeitura no ${sistema.nome}`}
      open={aberto}
      onCancel={aoFechar}
      okText={edicao ? "Salvar" : "Cadastrar"}
      cancelText="Cancelar"
      confirmLoading={salvando}
      onOk={confirmar}
      afterOpenChange={aoTerminarDeAbrir}
      destroyOnHidden
      width={editando ? 520 : 720}
    >
      <Form form={form} layout="vertical" requiredMark="optional" style={{ marginTop: 16 }}>
        <Form.Item
          name="nome"
          label="Município"
          rules={[{ required: true, min: 2, message: "Escolha o município." }]}
          extra={
            editando ? undefined : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Digite o nome e escolha na lista. UF, código IBGE e o que a Global já sabe do
                município entram sozinhos.
              </Text>
            )
          }
        >
          {editando ? (
            <Input disabled />
          ) : (
            <AutoComplete
              options={opcoes}
              onSearch={(v) => {
                setTermo(v);
                setEscolhido(null);
              }}
              onSelect={(codigo, opcao) => {
                setEscolhido(String(codigo));
                form.setFieldValue("nome", (opcao as { nome: string }).nome);
              }}
              // O AutoComplete guarda o código; o que se lê é o nome.
              value={nomeAtual}
              onChange={(v) => form.setFieldValue("nome", v)}
              notFoundContent={
                busca.isFetching
                  ? "Procurando…"
                  : termo.trim().length >= 2
                    ? "Nenhum município com esse nome."
                    : null
              }
              placeholder="Serra do Ramalho"
              autoFocus
            />
          )}
        </Form.Item>

        {busca.isError && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
            title="A base do IBGE não respondeu"
            description="Dá para cadastrar mesmo assim: informe nome, UF e código IBGE à mão. Os indicadores do município podem ser preenchidos depois."
          />
        )}

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="uf" label="UF" rules={[{ required: true, message: "Escolha a UF." }]}>
              <Select
                showSearch
                placeholder="BA"
                disabled={Boolean(dossie.data)}
                options={UFS.map((uf) => ({ value: uf, label: uf }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="status" label="Situação">
              <Select
                options={sistema.statusPrefeitura.map((s) => ({ value: s.id, label: s.rotulo }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Código IBGE">
              <Input
                readOnly
                value={dossie.data?.codigoIbge ?? edicao?.codigoIbge ?? ""}
                placeholder="(da escolha acima)"
                style={{ fontFamily: FONTE_MONO }}
              />
            </Form.Item>
          </Col>
        </Row>

        {editando ? (
          <Alert
            type="info"
            showIcon
            title={
              <Space size={6} wrap>
                Identificador
                <Text code style={{ fontFamily: FONTE_MONO }}>
                  {edicao?.slug}
                </Text>
              </Space>
            }
            description="Não muda. Ele é a chave gravada no token de todo mundo que trabalha nesta prefeitura e nos caminhos dos arquivos — renomear exigiria reescrever cada usuário."
          />
        ) : (
          <Form.Item
            name="slug"
            label="Identificador"
            tooltip="Gerado a partir do nome. Só mude se precisar casar com um identificador que já existe."
            rules={[{ pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/, message: "Minúsculas, números e hífen." }]}
            extra={
              slugPrevisto ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Vai ficar{" "}
                  <Text code style={{ fontFamily: FONTE_MONO }}>
                    {slugPrevisto}
                  </Text>{" "}
                  — é a chave definitiva desta prefeitura.
                </Text>
              ) : undefined
            }
          >
            <Input placeholder="(gerado do nome)" style={{ fontFamily: FONTE_MONO }} />
          </Form.Item>
        )}
      </Form>

      {!editando && (dossie.isFetching || dossie.data) && (
        <PainelDoDossie dossie={dossie.data} carregando={dossie.isFetching} corDaBorda={token.colorBorderSecondary} />
      )}
    </Modal>
  );
}

function PainelDoDossie({
  dossie,
  carregando,
  corDaBorda,
}: {
  dossie?: Dossie | null;
  carregando: boolean;
  corDaBorda: string;
}) {
  if (carregando && !dossie) {
    return (
      <Card size="small" style={{ borderColor: corDaBorda }}>
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    );
  }
  if (!dossie) return null;

  const c = dossie.censo;

  return (
    <Card
      size="small"
      title={
        <Space size={6}>
          <BankOutlined />
          <span>O que já sabemos de {dossie.nome}</span>
        </Space>
      }
      style={{ borderColor: corDaBorda }}
    >
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        <Descriptions size="small" column={{ xs: 1, sm: 2 }} colon={false}>
          <Descriptions.Item
            label={
              <Space size={4}>
                <TeamOutlined />
                População
              </Space>
            }
          >
            <Text style={{ fontFamily: FONTE_MONO }}>{numero(dossie.populacao)}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {" "}
              (Censo 2022)
            </Text>
          </Descriptions.Item>
          <Descriptions.Item
            label={
              <Space size={4}>
                <IdcardOutlined />
                Prefeito
              </Space>
            }
          >
            {dossie.prefeito ? (
              <>
                {dossie.prefeito}{" "}
                {dossie.partido && <Tag style={{ marginInlineStart: 4 }}>{dossie.partido}</Tag>}
              </>
            ) : (
              <Text type="secondary">—</Text>
            )}
          </Descriptions.Item>
        </Descriptions>

        {c ? (
          <>
            <Row gutter={8}>
              <Col span={8}>
                <Statistic
                  title="Escolas municipais"
                  value={c.escolasMunicipais}
                  suffix={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      / {c.escolasNoMunicipio} na cidade
                    </Text>
                  }
                  styles={{ content: { fontFamily: FONTE_MONO, fontSize: 20 } }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Matrículas da rede"
                  value={c.matriculasMunicipais}
                  styles={{ content: { fontFamily: FONTE_MONO, fontSize: 20 } }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Docentes"
                  value={c.docentesMunicipais}
                  styles={{ content: { fontFamily: FONTE_MONO, fontSize: 20 } }}
                />
              </Col>
            </Row>

            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Matrículas por etapa, rede municipal · Censo Escolar {c.ano}
              </Text>
              <div style={{ marginTop: 6 }}>
                <Space size={[6, 6]} wrap>
                  {(
                    [
                      ["Creche", c.porEtapa.creche],
                      ["Pré-escola", c.porEtapa.preEscola],
                      ["Anos iniciais", c.porEtapa.anosIniciais],
                      ["Anos finais", c.porEtapa.anosFinais],
                      ["EJA", c.porEtapa.eja],
                      ["Ed. especial", c.porEtapa.educacaoEspecial],
                    ] as const
                  )
                    .filter(([, v]) => v > 0)
                    .map(([rotulo, v]) => (
                      <Tag key={rotulo} style={{ marginInlineEnd: 0 }}>
                        {rotulo}{" "}
                        <Text strong style={{ fontFamily: FONTE_MONO }}>
                          {numero(v)}
                        </Text>
                      </Tag>
                    ))}
                </Space>
              </div>
            </div>
          </>
        ) : (
          <Alert
            type="info"
            showIcon
            title="Sem Censo Escolar para este município"
            description="O cadastro segue normalmente; o sistema só não terá a linha de base para medir a implantação."
          />
        )}

        {dossie.ideb && (
          <Space size={16}>
            <Space size={4}>
              <ReadOutlined style={{ opacity: 0.6 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                IDEB {dossie.ideb.ano}
              </Text>
            </Space>
            <Text style={{ fontFamily: FONTE_MONO }}>
              iniciais {dossie.ideb.anosIniciais ?? "—"} · finais {dossie.ideb.anosFinais ?? "—"}
            </Text>
          </Space>
        )}

        <Paragraph type="secondary" style={{ fontSize: 11, marginBottom: 0 }}>
          <BookOutlined /> Estes números vão junto com o cadastro e viram a linha de base da
          implantação — é contra eles que se mede quanto da rede já foi cadastrado no sistema.
          {dossie.semDados.length > 0 && ` Sem dados de: ${dossie.semDados.join(", ")}.`}
        </Paragraph>
      </Space>
    </Card>
  );
}
