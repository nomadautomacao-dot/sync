"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DeleteOutlined, FilePdfOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Result,
  Row,
  Select,
  Skeleton,
  Statistic,
  Tag,
  Typography,
  theme,
} from "antd";
import { ProTable } from "@ant-design/pro-components";

import { apiFetch, withAuthHeader } from "@/core/lib/api-client";
import { getFirebaseAuth } from "@/core/lib/firebase-client";
import type { CaseSucesso, MunicipioApurado } from "@/modules/case-de-sucesso/types";

/**
 * Case de Sucesso — monta o deck comercial com a evolução do FUNDEB das redes
 * atendidas.
 *
 * ## Perfil
 *
 * Tela do **técnico**: é aqui que o case é montado. Não mostra receita
 * estimada, comissão nem estágio de pipeline, então o resultado pode ser girado
 * na mesa — mas a montagem é trabalho interno.
 *
 * ## A decisão que a tela existe para tornar difícil de errar
 *
 * Cada município tem a sua **janela de atuação**, e ela é escolhida linha a
 * linha. Fechar no exercício mais recente é o padrão errado: rede em que a
 * consultoria saiu antes precisa parar no ano em que ainda estava lá. Por isso
 * o ano final é uma coluna editável e não uma configuração global — a pergunta
 * "até quando fomos nós?" aparece uma vez por município.
 */

const ANO_MAIS_RECENTE = 2026;
const ANO_INICIAL = 2024;

const brl = (v: number) => `R$ ${(v / 1e6).toFixed(2).replace(".", ",")} mi`;
const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1).replace(".", ",")}%`;

interface Sugestao {
  codigo_ibge: string;
  nome: string;
  uf: string;
}

interface Selecionado {
  codigoIbge: string;
  nome: string;
  uf: string;
  fim: number;
}

const MONO = { fontFamily: "var(--font-sync-mono)" } as const;

export default function CaseDeSucessoPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();

  const [selecionados, setSelecionados] = useState<Selecionado[]>([]);
  const [busca, setBusca] = useState("");

  const { data: sugestoes = [], isFetching: buscando } = useQuery({
    queryKey: ["case-busca-municipio", busca],
    queryFn: async () => {
      const res = await fetch(`/api/municipios/buscar?q=${encodeURIComponent(busca)}`);
      if (!res.ok) return [] as Sugestao[];
      const body = (await res.json()) as { data: Sugestao[] };
      return body.data ?? [];
    },
    enabled: busca.trim().length >= 2,
  });

  // A chave da prévia carrega a janela de cada município: mudar o ano final de
  // uma linha reapura o case inteiro, porque o agregado e a posição dependem dele.
  const chave = selecionados.map((s) => `${s.codigoIbge}:${s.fim}`).join(",");

  const previa = useQuery({
    queryKey: ["case-previa", chave],
    queryFn: async () =>
      await apiFetch<{ caso: CaseSucesso }>(
        `/api/modulos/case-de-sucesso?municipios=${encodeURIComponent(chave)}`,
      ),
    enabled: chave.length > 0,
    retry: false,
  });

  const caso = previa.data?.caso;

  const gerar = useMutation({
    mutationFn: async () => {
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new Error("Sessão ausente. Entre de novo.");
      const res = await fetch(
        "/api/modulos/case-de-sucesso",
        withAuthHeader(
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              // O nome vai junto: o do FNDE é caixa alta e sem acento, e é o
              // nome do cliente que aparece na capa.
              municipios: selecionados.map((s) => ({
                codigoIbge: s.codigoIbge,
                fim: s.fim,
                nome: s.nome,
              })),
            }),
          },
          await user.getIdToken(),
        ),
      );
      if (!res.ok) {
        const corpo = await res.json().catch(() => ({}));
        throw new Error(corpo.error ?? "Falha ao gerar o case.");
      }
      const nome =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "case.pdf";
      return { blob: await res.blob(), nome, folhas: res.headers.get("X-Case-Folhas") };
    },
    onSuccess: ({ blob, nome, folhas }) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success(`Case emitido com ${folhas ?? "?"} folhas.`);
    },
    onError: (erro: Error) => message.error(erro.message),
  });

  const adicionar = (codigoIbge: string) => {
    const achado = sugestoes.find((s) => s.codigo_ibge === codigoIbge);
    if (!achado) return;
    if (selecionados.some((s) => s.codigoIbge === codigoIbge)) {
      message.info("Este município já está no case.");
      return;
    }
    setSelecionados((atual) => [
      ...atual,
      { codigoIbge, nome: achado.nome, uf: achado.uf, fim: ANO_MAIS_RECENTE },
    ]);
    setBusca("");
  };

  const trocarJanela = (codigoIbge: string, fim: number) =>
    setSelecionados((atual) =>
      atual.map((s) => (s.codigoIbge === codigoIbge ? { ...s, fim } : s)),
    );

  const remover = (codigoIbge: string) =>
    setSelecionados((atual) => atual.filter((s) => s.codigoIbge !== codigoIbge));

  /** Junta o que a tela escolheu com o que a prévia apurou, linha a linha. */
  const linhas = useMemo(
    () =>
      selecionados.map((s) => ({
        ...s,
        apurado: caso?.municipios.find((m) => m.codigoIbge === s.codigoIbge) ?? null,
      })),
    [selecionados, caso],
  );

  const anosPossiveis = Array.from(
    { length: ANO_MAIS_RECENTE - ANO_INICIAL },
    (_, i) => ANO_INICIAL + 1 + i,
  );

  return (
    <Flex vertical gap={14}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Case de Sucesso
        </Typography.Title>
        <Typography.Text type="secondary">
          O deck comercial com a evolução do FUNDEB das redes atendidas, apurada nas portarias de
          complementação do FNDE.
        </Typography.Text>
      </div>

      <Card
        size="small"
        title="Municípios do case"
        extra={
          <Select<string>
            showSearch
            value={null}
            placeholder="Buscar município pelo nome…"
            style={{ width: 320 }}
            filterOption={false}
            onSearch={setBusca}
            onChange={adicionar}
            loading={buscando}
            suffixIcon={<PlusOutlined />}
            notFoundContent={
              busca.trim().length < 2 ? "Digite ao menos duas letras." : "Nenhum município."
            }
            options={sugestoes.map((s) => ({
              value: s.codigo_ibge,
              label: `${s.nome} — ${s.uf}`,
            }))}
          />
        }
      >
        {selecionados.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Nenhum município no case. Busque pelo nome para começar."
          />
        ) : previa.isError ? (
          <Result
            status="warning"
            title="Não foi possível apurar o case"
            subTitle={(previa.error as Error).message}
            extra={
              <Button type="primary" onClick={() => previa.refetch()}>
                Tentar de novo
              </Button>
            }
          />
        ) : (
          <ProTable<(typeof linhas)[number]>
            rowKey="codigoIbge"
            size="small"
            search={false}
            options={false}
            pagination={false}
            loading={previa.isFetching}
            dataSource={linhas}
            columns={[
              {
                title: "Município",
                dataIndex: "nome",
                render: (_, linha) => (
                  <Flex vertical>
                    <Typography.Text strong>{linha.nome}</Typography.Text>
                    <Typography.Text type="secondary" style={{ ...MONO, fontSize: 12 }}>
                      {linha.uf} · {linha.codigoIbge}
                    </Typography.Text>
                  </Flex>
                ),
              },
              {
                title: "Último ano nosso",
                dataIndex: "fim",
                width: 170,
                render: (_, linha) => (
                  <Select<number>
                    size="small"
                    value={linha.fim}
                    style={{ width: 130 }}
                    onChange={(ano) => trocarJanela(linha.codigoIbge, ano)}
                    options={anosPossiveis.map((ano) => ({
                      value: ano,
                      label: `${ANO_INICIAL} → ${ano}`,
                    }))}
                  />
                ),
              },
              {
                title: "Crescimento",
                dataIndex: "variacao",
                align: "right",
                width: 130,
                sorter: (a, b) =>
                  (a.apurado?.variacaoTotal ?? 0) - (b.apurado?.variacaoTotal ?? 0),
                render: (_, linha) =>
                  linha.apurado ? (
                    <Typography.Text
                      strong
                      style={{ ...MONO, color: token.colorSuccess }}
                    >
                      {pct(linha.apurado.variacaoTotal)}
                    </Typography.Text>
                  ) : (
                    <Typography.Text type="secondary">—</Typography.Text>
                  ),
              },
              {
                title: "A mais por ano",
                dataIndex: "ganho",
                align: "right",
                width: 150,
                sorter: (a, b) => (a.apurado?.ganhoTotal ?? 0) - (b.apurado?.ganhoTotal ?? 0),
                render: (_, linha) =>
                  linha.apurado ? (
                    <Typography.Text style={MONO}>{brl(linha.apurado.ganhoTotal)}</Typography.Text>
                  ) : (
                    <Typography.Text type="secondary">—</Typography.Text>
                  ),
              },
              {
                title: "Posição no país",
                dataIndex: "percentil",
                align: "right",
                width: 190,
                sorter: (a, b) => (a.apurado?.percentilBR ?? 0) - (b.apurado?.percentilBR ?? 0),
                render: (_, linha) => <Posicao apurado={linha.apurado} />,
              },
              {
                title: "",
                width: 50,
                render: (_, linha) => (
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => remover(linha.codigoIbge)}
                    aria-label={`Remover ${linha.nome}`}
                  />
                ),
              },
            ]}
          />
        )}
      </Card>

      {previa.isFetching && !caso ? (
        <Card size="small">
          <Skeleton active paragraph={{ rows: 2 }} />
        </Card>
      ) : caso ? (
        <Card size="small" title="O que o documento vai afirmar">
          <Row gutter={[16, 16]}>
            {/* `formatter` em vez de `value` já formatado: o `Statistic` aplica
                separador de milhar e casas decimais por conta própria, e uma
                string como "R$ 87,74 mi" sai mutilada por esse tratamento. */}
            <Col xs={24} md={8}>
              <Statistic
                title="A mais por ano, somadas as redes"
                value={caso.agregado.ganhoTotal}
                formatter={(v) => brl(Number(v))}
                valueStyle={{ ...MONO, color: token.colorSuccess }}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                de {brl(caso.agregado.totalInicio)} para {brl(caso.agregado.totalFim)}
              </Typography.Text>
            </Col>
            <Col xs={24} md={8}>
              <Statistic
                title="Vindo da complementação da União"
                value={caso.agregado.ganhoComplementacao}
                formatter={(v) => brl(Number(v))}
                valueStyle={MONO}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                VAAF, VAAT e VAAR
              </Typography.Text>
            </Col>
            <Col xs={24} md={8}>
              <Statistic
                title="Redes no topo 10% do país"
                value={caso.agregado.noTopo10}
                formatter={(v) => `${Number(v)} de ${caso.municipios.length}`}
                valueStyle={MONO}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                entre os {caso.municipios[0]?.universoBR ?? 0} municípios que recebem complementação
              </Typography.Text>
            </Col>
          </Row>

          <Alert
            type="info"
            showIcon
            style={{ marginTop: 16 }}
            title="A janela de cada município é o que o documento reivindica"
            description="O ano final de cada linha deve ser o último exercício em que a Global esteve na rede. Reivindicar exercício posterior é o tipo de afirmação que uma consulta ao portal do FNDE desmonta na frente do cliente."
          />

          <Flex justify="flex-end" gap={10} style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              loading={gerar.isPending}
              onClick={() => gerar.mutate()}
            >
              {gerar.isPending ? "Gerando o deck…" : "Gerar o case em PDF"}
            </Button>
          </Flex>
          {gerar.isPending && (
            <Typography.Paragraph
              type="secondary"
              style={{ textAlign: "right", marginBottom: 0, fontSize: 12 }}
            >
              A emissão abre o Chromium e monta as folhas — costuma levar de 1 a 2 minutos. Não feche
              esta aba.
            </Typography.Paragraph>
          )}
        </Card>
      ) : null}
    </Flex>
  );
}

/** Posição da rede no país, no vocabulário que o documento usa. */
function Posicao({ apurado }: { apurado: MunicipioApurado | null }) {
  const { token } = theme.useToken();
  if (!apurado) return <Typography.Text type="secondary">—</Typography.Text>;

  const p = Math.round(apurado.percentilBR);
  return p >= 90 ? (
    <Tag color="success" style={MONO}>
      topo {100 - p}% do país
    </Tag>
  ) : (
    <Typography.Text style={{ ...MONO, color: token.colorTextSecondary }}>
      percentil {p}
    </Typography.Text>
  );
}
