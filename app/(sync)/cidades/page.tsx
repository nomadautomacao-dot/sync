"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusOutlined, RightOutlined, RiseOutlined } from "@ant-design/icons";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { Button, Result, Space, Statistic, Tag, theme } from "antd";
import { toast } from "sonner";

import {
  ensureCity,
  listCities,
} from "@/core/lib/cities-firestore";
import {
  STAGE_LABELS,
  stagePastelTone,
  type CityAccount,
} from "@/core/lib/city-types";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import { listCityReports } from "@/modules/cidades/city-reports-firestore";
import { listCityDocuments } from "@/modules/documentos/documentos-firestore";

import { NewCityDialog } from "../pipeline/_components/new-city-dialog";

/**
 * A carteira, primeira tela sobre o Ant Design.
 *
 * Serve de padrão para as outras: `ProTable` com busca embutida, ordenação por
 * coluna e sem paginação — a carteira inteira à vista é o objetivo, e não um
 * detalhe de configuração. O que era filtro escrito à mão (campo de texto,
 * seletor de estágio, contador "12 de 17") agora é comportamento do componente.
 */

/** A família monoespaçada carregada em `app/layout.tsx`. */
const FONTE_MONO = "var(--font-sync-mono)";

interface LinhaDaCarteira extends CityAccount {
  relatorios: number;
  documentos: number;
}

export default function CidadesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const [newCityOpen, setNewCityOpen] = useState(false);

  const {
    data: cities = [],
    isPending: citiesPending,
    isError: citiesError,
    refetch: refetchCities,
  } = useQuery({
    queryKey: ["cities", user?.groupId],
    queryFn: () => listCities(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });
  const { data: documents = [], isPending: documentsPending } = useQuery({
    queryKey: ["city-documents", user?.groupId],
    queryFn: () => listCityDocuments(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });
  const { data: reports = [], isPending: reportsPending } = useQuery({
    queryKey: ["city-reports", user?.groupId],
    queryFn: () => listCityReports(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });

  const createMutation = useMutation({
    mutationFn: (
      input: Partial<CityAccount> & { name: string; uf: string },
    ) => ensureCity(getFirebaseDb(), user!.groupId, input),
    onSuccess: (city) => {
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] });
      setNewCityOpen(false);
      toast.success(`${city.name} está pronta na carteira.`);
      router.push(`/cidades/${city.id}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar o município.",
      ),
  });

  const linhas: LinhaDaCarteira[] = useMemo(() => {
    const contagem = new Map<string, { documentos: number; relatorios: number }>();
    for (const city of cities) {
      contagem.set(city.id, { documentos: 0, relatorios: 0 });
    }
    for (const documento of documents) {
      const atual = contagem.get(documento.cityId);
      if (atual) atual.documentos += 1;
    }
    for (const relatorio of reports) {
      const atual = contagem.get(relatorio.cityId);
      if (atual) atual.relatorios += 1;
    }
    return cities.map((city) => ({
      ...city,
      relatorios: contagem.get(city.id)?.relatorios ?? 0,
      documentos: contagem.get(city.id)?.documentos ?? 0,
    }));
  }, [cities, documents, reports]);

  const carregando = citiesPending || documentsPending || reportsPending;
  const comRelatorio = new Set(reports.map((relatorio) => relatorio.cityId)).size;
  const emContrato = cities.filter((city) =>
    ["contractual", "implementation", "assisted_operation", "fidelized"].includes(
      city.stage,
    ),
  ).length;

  /** Zero em cinza: dá para varrer a coluna e ver quem não tem nada. */
  const colunaDeContagem = (
    titulo: string,
    campo: "relatorios" | "documentos",
  ): ProColumns<LinhaDaCarteira> => ({
    title: titulo,
    dataIndex: campo,
    width: 96,
    align: "right",
    search: false,
    sorter: (a, b) => a[campo] - b[campo],
    render: (_, linha) => (
      <span
        style={{
          fontFamily: FONTE_MONO,
          color: linha[campo] > 0 ? token.colorText : token.colorTextQuaternary,
          fontWeight: linha[campo] > 0 ? 600 : 400,
        }}
      >
        {linha[campo]}
      </span>
    ),
  });

  const colunas: ProColumns<LinhaDaCarteira>[] = [
    {
      title: "UF",
      dataIndex: "uf",
      width: 72,
      search: false,
      sorter: (a, b) => a.uf.localeCompare(b.uf, "pt-BR"),
      render: (_, linha) => <span style={{ fontFamily: FONTE_MONO }}>{linha.uf}</span>,
    },
    {
      title: "Município",
      dataIndex: "name",
      ellipsis: true,
      sorter: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
      render: (_, linha) => (
        <Link href={`/cidades/${linha.id}`} style={{ fontWeight: 600 }}>
          {linha.name}
        </Link>
      ),
    },
    {
      title: "IBGE",
      dataIndex: "codigoIbge",
      width: 110,
      responsive: ["lg"],
      render: (_, linha) => (
        <span style={{ fontFamily: FONTE_MONO, color: token.colorTextTertiary }}>
          {linha.codigoIbge || "—"}
        </span>
      ),
    },
    {
      title: "Estágio",
      dataIndex: "stage",
      width: 170,
      valueType: "select",
      valueEnum: Object.fromEntries(
        Object.entries(STAGE_LABELS).map(([chave, rotulo]) => [chave, { text: rotulo }]),
      ),
      sorter: (a, b) =>
        (STAGE_LABELS[a.stage] ?? a.stage).localeCompare(
          STAGE_LABELS[b.stage] ?? b.stage,
          "pt-BR",
        ),
      render: (_, linha) => {
        const tom = stagePastelTone(linha.stage);
        return (
          <Tag
            style={{
              backgroundColor: tom.bg,
              color: tom.text,
              border: "none",
              borderRadius: 999,
            }}
          >
            {STAGE_LABELS[linha.stage] ?? linha.stage}
          </Tag>
        );
      },
    },
    {
      title: "Prob.",
      dataIndex: "probability",
      width: 88,
      align: "right",
      search: false,
      sorter: (a, b) => a.probability - b.probability,
      render: (_, linha) => (
        <span style={{ fontFamily: FONTE_MONO }}>{linha.probability}%</span>
      ),
    },
    colunaDeContagem("Relat.", "relatorios"),
    colunaDeContagem("Docs", "documentos"),
    {
      title: "Próxima ação",
      dataIndex: "nextStepDescription",
      ellipsis: true,
      search: false,
      responsive: ["xl"],
      render: (_, linha) => linha.nextStepDescription || "—",
    },
    {
      title: "",
      width: 44,
      align: "right",
      search: false,
      render: (_, linha) => (
        <Link href={`/cidades/${linha.id}`} aria-label={`Abrir ${linha.name}`}>
          <RightOutlined style={{ color: token.colorTextQuaternary }} />
        </Link>
      ),
    },
  ];

  if (citiesError) {
    return (
      <Result
        status="warning"
        title="Não foi possível carregar as cidades"
        subTitle="Verifique a conexão e tente novamente."
        extra={
          <Button type="primary" onClick={() => refetchCities()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  return (
    <>
      <ProTable<LinhaDaCarteira>
        headerTitle="Cidades"
        rowKey="id"
        size="small"
        cardBordered
        loading={carregando}
        dataSource={linhas}
        columns={colunas}
        /* A carteira inteira à vista é o ponto: rolar é melhor que paginar
           quando a pergunta é "quais municípios eu tenho". */
        pagination={false}
        scroll={{ x: 900 }}
        search={{ labelWidth: "auto" }}
        options={{ density: false, fullScreen: false }}
        dateFormatter="string"
        toolBarRender={() => [
          <Space key="numeros" size="large" style={{ marginRight: 8 }}>
            <Statistic
              title="Com relatório"
              value={comRelatorio}
              styles={{ content: { fontSize: 16, fontFamily: "var(--font-sync-mono)" } }}
            />
            <Statistic
              title="Documentos"
              value={documents.length}
              styles={{ content: { fontSize: 16, fontFamily: "var(--font-sync-mono)" } }}
            />
            <Statistic
              title="Em contrato"
              value={emContrato}
              styles={{ content: { fontSize: 16, fontFamily: "var(--font-sync-mono)" } }}
            />
          </Space>,
          <Link key="kanban" href="/pipeline">
            <Button icon={<RiseOutlined />}>Ver Kanban</Button>
          </Link>,
          <Button
            key="nova"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setNewCityOpen(true)}
          >
            Novo município
          </Button>,
        ]}
      />

      <NewCityDialog
        open={newCityOpen}
        onClose={() => setNewCityOpen(false)}
        context="cities"
        onSubmit={async (input) => {
          await createMutation.mutateAsync(input);
        }}
      />
    </>
  );
}
