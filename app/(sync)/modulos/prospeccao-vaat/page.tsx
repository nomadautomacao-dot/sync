"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DownloadOutlined, FileSearchOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Input,
  Result,
  Row,
  Segmented,
  Select,
  Skeleton,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  theme,
} from "antd";
import { ProTable, type ProColumns } from "@ant-design/pro-components";

import { podeVer } from "@/core/domain/rbac";
import { apiFetch } from "@/core/lib/api-client";
import { useAuth } from "@/core/providers/auth-provider";
import type { LinhaProspeccao, Prospeccao } from "@/core/lib/fundeb-prospeccao-vaat";

/**
 * Prospecção pelo VAAT — quem está perto de entrar na faixa da complementação.
 *
 * ## Perfil
 *
 * Tela do **técnico** e do comercial: é uma lista de prospecção, com receita do
 * FUNDEB de outros municípios e o tempo até a alavanca do VAAT. Não é tela para
 * girar na mesa do secretário. Amarrada à área de Pipeline, a mesma régua que
 * esconde o bloco comercial da ficha da cidade — e a rota confere de novo.
 *
 * ## O que a tela existe para responder
 *
 * "Em quais municípios a consultoria de matrícula rende mais, e mais cedo?"
 * Acima do VAAT-MIN cada matrícula vale o fundo do estado; cruzado o piso, vale o
 * mínimo inteiro. A coluna que ordena é o tempo até cruzar, no ritmo que os
 * municípios atendidos pela Global alcançaram.
 */

const MONO = { fontFamily: "var(--font-sync-mono)" } as const;
const EXERCICIO = 2026;

const inteiro = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : Math.round(v).toLocaleString("pt-BR");
const reais = (v: number | null | undefined, casas = 0) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
const milhoes = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
const porcento = (v: number | null | undefined, casas = 1) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

type Horizonte = "1" | "3" | "todos";

/** Exporta o recorte da tela, não a base inteira: é a lista que a pessoa montou. */
function baixarCsv(linhas: LinhaProspeccao[]) {
  const campo = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const cabecalho = [
    "UF", "Município", "Código IBGE", "Rede municipal", "Acima do piso (%)", "Matrículas-equivalentes que faltam",
    "Em % da rede", "Anos no Padrão Global", "A mais por equivalente depois do piso (R$)", "Receita FUNDEB (R$)",
  ];
  const corpo = linhas.map((l) => [
    l.uf, l.municipio, l.codigoIbge, l.rede ?? "", l.acimaDoPiso.toFixed(1).replace(".", ","),
    Math.round(l.faltam), l.fracaoDaRede === null ? "" : (l.fracaoDaRede * 100).toFixed(1).replace(".", ","),
    l.anos === null ? "" : l.anos.toFixed(1).replace(".", ","), l.premioPorEquivalente.toFixed(2).replace(".", ","),
    l.receitaFundeb === null ? "" : l.receitaFundeb.toFixed(2).replace(".", ","),
  ]);
  const blob = new Blob(["﻿" + [cabecalho, ...corpo].map((r) => r.map(campo).join(";")).join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PROSPECCAO_VAAT_${EXERCICIO}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProspeccaoVaatPage() {
  const { token } = theme.useToken();
  const { user } = useAuth();
  const autorizado = user ? podeVer(user.permissoes, "pipeline") : false;

  const [ufs, setUfs] = useState<string[]>([]);
  const [horizonte, setHorizonte] = useState<Horizonte>("3");
  const [busca, setBusca] = useState("");

  const consulta = useQuery({
    queryKey: ["prospeccao-vaat", EXERCICIO],
    queryFn: async () => await apiFetch<Prospeccao>(`/api/modulos/prospeccao-vaat?exercicio=${EXERCICIO}`),
    enabled: autorizado,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  const resumo = consulta.data?.resumo;
  const todas = useMemo(() => consulta.data?.linhas ?? [], [consulta.data]);
  const opcoesUf = useMemo(
    () => [...new Set(todas.map((l) => l.uf))].sort().map((uf) => ({ value: uf, label: uf })),
    [todas],
  );

  const linhas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");
    return todas.filter((l) => {
      if (ufs.length && !ufs.includes(l.uf)) return false;
      if (horizonte !== "todos" && !(l.anos !== null && l.anos <= Number(horizonte))) return false;
      if (termo && !l.municipio.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "").includes(termo)) return false;
      return true;
    });
  }, [todas, ufs, horizonte, busca]);

  const colunas: ProColumns<LinhaProspeccao>[] = [
    {
      title: "Município",
      dataIndex: "municipio",
      fixed: "left",
      width: 230,
      sorter: (a, b) => a.municipio.localeCompare(b.municipio, "pt-BR"),
      render: (_, l) => (
        <Flex vertical gap={0}>
          <Typography.Text strong>{l.municipio}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {l.uf} · IBGE <span style={MONO}>{l.codigoIbge}</span>
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Rede municipal",
      dataIndex: "rede",
      align: "right",
      width: 120,
      sorter: (a, b) => (a.rede ?? -1) - (b.rede ?? -1),
      render: (_, l) => <span style={MONO}>{inteiro(l.rede)}</span>,
    },
    {
      title: <Tooltip title="Quanto o VAAT próprio do município está acima do VAAT-MIN nacional.">Acima do piso</Tooltip>,
      dataIndex: "acimaDoPiso",
      align: "right",
      width: 110,
      sorter: (a, b) => a.acimaDoPiso - b.acimaDoPiso,
      render: (_, l) => <span style={MONO}>{porcento(l.acimaDoPiso)}</span>,
    },
    {
      title: (
        <Tooltip title="Matrículas-equivalentes a mais para o VAAT próprio cair até o piso. Aluno novo de EJA vale cerca de 1; AEE registrado, cerca de 1,4; passar um aluno para jornada integral, 0,4.">
          Faltam para entrar
        </Tooltip>
      ),
      dataIndex: "faltam",
      align: "right",
      width: 130,
      sorter: (a, b) => a.faltam - b.faltam,
      render: (_, l) => <span style={MONO}>{inteiro(l.faltam)}</span>,
    },
    {
      title: "Em % da rede",
      dataIndex: "fracaoDaRede",
      align: "right",
      width: 110,
      sorter: (a, b) => (a.fracaoDaRede ?? Infinity) - (b.fracaoDaRede ?? Infinity),
      render: (_, l) => <span style={MONO}>{l.fracaoDaRede === null ? "—" : porcento(l.fracaoDaRede * 100)}</span>,
    },
    {
      title: (
        <Tooltip title={`Tempo até cruzar o piso no ritmo dos municípios atendidos pela Global (+${porcento((resumo?.ritmoPadraoGlobal ?? 0) * 100)} da rede ao ano em matrícula ponderada).`}>
          Anos no Padrão Global
        </Tooltip>
      ),
      dataIndex: "anos",
      align: "right",
      width: 150,
      defaultSortOrder: "ascend",
      sorter: (a, b) => (a.anos ?? Infinity) - (b.anos ?? Infinity),
      render: (_, l) =>
        l.anos === null ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          <Tag color={l.anos <= 1 ? "green" : l.anos <= 3 ? "gold" : "default"} style={MONO}>
            {l.anos < 0.1 ? "já no limite" : `${l.anos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ano${l.anos >= 2 ? "s" : ""}`}
          </Tag>
        ),
    },
    {
      title: <Tooltip title="O que cada matrícula-equivalente passa a render a mais quando a rede entra na faixa: o VAAT-MIN menos o que o fundo do estado já paga.">A mais depois do piso</Tooltip>,
      dataIndex: "premioPorEquivalente",
      align: "right",
      width: 150,
      sorter: (a, b) => a.premioPorEquivalente - b.premioPorEquivalente,
      render: (_, l) => <span style={MONO}>{reais(l.premioPorEquivalente)}</span>,
    },
    {
      title: `Receita FUNDEB ${EXERCICIO}`,
      dataIndex: "receitaFundeb",
      align: "right",
      width: 140,
      sorter: (a, b) => (a.receitaFundeb ?? -1) - (b.receitaFundeb ?? -1),
      render: (_, l) => <span style={MONO}>{milhoes(l.receitaFundeb)}</span>,
    },
    {
      title: "",
      key: "acao",
      fixed: "right",
      width: 140,
      render: (_, l) => (
        <Link href={`/modulos/levantamento-fundeb?ibge=${l.codigoIbge}`}>
          <Button size="small" icon={<FileSearchOutlined />}>
            Levantamento
          </Button>
        </Link>
      ),
    },
  ];

  if (user && !autorizado) {
    return (
      <Result
        status="403"
        title="Prospecção restrita"
        subTitle="Esta lista é comercial e exige acesso ao Pipeline. Peça a liberação em Ajustes › Acessos."
      />
    );
  }

  if (consulta.isError) {
    return (
      <Result
        status="error"
        title="Não foi possível montar a prospecção"
        subTitle={consulta.error instanceof Error ? consulta.error.message : "Erro desconhecido."}
        extra={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
      />
    );
  }

  return (
    <Flex vertical gap={16}>
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          Prospecção pelo VAAT
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 860 }}>
          Municípios habilitados que ainda estão acima do VAAT-MIN. Enquanto estiverem acima, cada matrícula nova vale
          só o fundo do estado; cruzado o piso, a União completa a rede e cada matrícula passa a valer o mínimo inteiro.
          Quanto menos falta, mais cedo a consultoria de matrícula rende.
        </Typography.Paragraph>
      </div>

      {consulta.isLoading || !resumo ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <Row gutter={[12, 12]}>
          {[
            { titulo: "Acima do piso e habilitados", valor: resumo.acimaDoPiso },
            { titulo: "Entram em até 1 ano", valor: resumo.emUmAno, cor: token.colorSuccess },
            { titulo: "Entram em até 3 anos", valor: resumo.emTresAnos, cor: token.colorWarning },
            { titulo: "Já recebem VAAT", valor: resumo.recebem },
          ].map((k) => (
            <Col key={k.titulo} xs={12} md={6}>
              <Card size="small">
                <Statistic
                  title={k.titulo}
                  value={k.valor}
                  styles={{ content: { ...MONO, color: k.cor } }}
                  formatter={(v) => Number(v).toLocaleString("pt-BR")}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {resumo && (
        <Alert
          type="info"
          showIcon
          message={`VAAT-MIN ${EXERCICIO}: ${reais(resumo.vaatMinimo, 2)} · Padrão Global: +${porcento(resumo.ritmoPadraoGlobal * 100)} da rede ao ano`}
          description="Retrato do exercício: se a arrecadação própria do município crescer mais rápido que a matrícula, ele se afasta do piso. O VAAT pondera a educação infantil mais que o fundo comum, então a distância tende a ser menor onde a alavanca é creche. Os inabilitados não aparecem aqui — para eles o primeiro passo é a habilitação."
        />
      )}

      <ProTable<LinhaProspeccao>
        headerTitle="Municípios acima do piso"
        rowKey="codigoIbge"
        size="small"
        cardBordered
        loading={consulta.isLoading}
        dataSource={linhas}
        columns={colunas}
        search={false}
        options={{ density: false, fullScreen: false, reload: false, setting: false }}
        /* São quase três mil municípios: aqui a lista não cabe na tela, e
           paginar é o que mantém a tabela respondendo ao filtro. */
        pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (total) => `${total.toLocaleString("pt-BR")} municípios` }}
        scroll={{ x: 1380 }}
        locale={{
          emptyText: (
            <Empty description="Nenhum município neste recorte. Amplie o horizonte ou tire o filtro de UF." />
          ),
        }}
        toolBarRender={() => [
          <Input.Search
            key="busca"
            allowClear
            placeholder="Buscar município"
            onSearch={setBusca}
            onChange={(e) => !e.target.value && setBusca("")}
            style={{ width: 200 }}
          />,
          <Select
            key="uf"
            mode="multiple"
            allowClear
            placeholder="UF"
            options={opcoesUf}
            value={ufs}
            onChange={setUfs}
            style={{ minWidth: 140 }}
            maxTagCount="responsive"
          />,
          <Segmented<Horizonte>
            key="horizonte"
            value={horizonte}
            onChange={setHorizonte}
            options={[
              { label: "Até 1 ano", value: "1" },
              { label: "Até 3 anos", value: "3" },
              { label: "Todos", value: "todos" },
            ]}
          />,
          <Button key="csv" icon={<DownloadOutlined />} disabled={!linhas.length} onClick={() => baixarCsv(linhas)}>
            Baixar CSV
          </Button>,
        ]}
      />
    </Flex>
  );
}
