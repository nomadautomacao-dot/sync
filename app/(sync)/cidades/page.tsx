"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusOutlined, RightOutlined, RiseOutlined } from "@ant-design/icons";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { App, Button, Result, Space, Statistic, Tag, theme } from "antd";

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
import { DOCUMENTOS } from "@/modules/cidades/documentos-emissiveis";
import { useFilaDeEmissao } from "@/core/providers/fila-emissao-provider";
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
  const { message } = App.useApp();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const { enfileirar } = useFilaDeEmissao();
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
    mutationFn: async (input: Partial<CityAccount> & { name: string; uf: string }) => {
      /* `ensureCity` é idempotente e não conta se criou ou reencontrou. A
         diferença importa aqui: enfileirar o acervo de uma cidade que alguém
         readicionou reemitiria treze documentos que já existem, gastando meia
         hora de chamadas às fontes de governo para produzir cópias. */
      const jaExistia = cities.some((atual) =>
        input.codigoIbge
          ? atual.codigoIbge === input.codigoIbge
          : atual.name.trim().toLocaleLowerCase("pt-BR") ===
              input.name.trim().toLocaleLowerCase("pt-BR") &&
            atual.uf.toUpperCase() === input.uf.toUpperCase(),
      );
      const city = await ensureCity(getFirebaseDb(), user!.groupId, input);
      return { city, jaExistia };
    },
    onSuccess: async ({ city, jaExistia }) => {
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] });
      setNewCityOpen(false);

      /* O acervo inteiro entra na fila junto com a cidade. A fila é sequencial
         e sobrevive a fechar a janela, então isto acontece por trás: quem
         cadastrou já cai na ficha do município e os documentos vão chegando.

         Sem código do IBGE não há o que emitir — todo documento é montado a
         partir dele —, e a mensagem diz isso em vez de falhar em silêncio. */
      if (!jaExistia && city.codigoIbge) {
        try {
          const criados = await enfileirar(
            {
              cityId: city.id,
              cityName: city.name,
              cityUf: city.uf,
              codigoIbge: city.codigoIbge,
              regiao: city.region,
            },
            DOCUMENTOS.map((documento) => documento.id),
          );
          message.success(
            `${city.name} está na carteira. ${criados} documentos entraram na fila e serão emitidos em segundo plano.`,
          );
        } catch {
          message.warning(
            `${city.name} entrou na carteira, mas os relatórios não foram enfileirados. Emita pela aba "FUNDEB e documentos".`,
          );
        }
      } else if (!city.codigoIbge) {
        message.warning(
          `${city.name} entrou na carteira sem código IBGE — sem ele não dá para emitir documento nenhum.`,
        );
      } else {
        message.success(`${city.name} já estava na carteira.`);
      }

      router.push(`/cidades/${city.id}`);
    },
    onError: (error) =>
      message.error(
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
      // Documento é o que a equipe anexa; o PDF emitido já conta em "Relat.".
      if (documento.source !== "upload") continue;
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
      /* Largura própria, e não flexível: esta era a única coluna sem largura,
         e quando a soma das fixas passa do espaço ela é espremida até sumir —
         justamente o nome, que é a coluna que dá sentido às outras. */
      width: 220,
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
      title: "Parceiro",
      dataIndex: "parceiroName",
      width: 150,
      ellipsis: true,
      responsive: ["xl"],
      sorter: (a, b) =>
        (a.parceiroName ?? "").localeCompare(b.parceiroName ?? "", "pt-BR"),
      render: (_, linha) =>
        linha.parceiroName ? (
          <span style={{ fontSize: 12 }}>{linha.parceiroName}</span>
        ) : (
          <span style={{ fontSize: 12, color: token.colorTextQuaternary }}>—</span>
        ),
    },
    {
      title: "Resp. técnico",
      dataIndex: "collaboratorName",
      width: 160,
      ellipsis: true,
      responsive: ["lg"],
      sorter: (a, b) =>
        (a.collaboratorName ?? "").localeCompare(b.collaboratorName ?? "", "pt-BR"),
      render: (_, linha) =>
        linha.collaboratorName ? (
          <span style={{ fontSize: 12 }}>{linha.collaboratorName}</span>
        ) : (
          /* Sem responsável é o estado que precisa saltar: cidade sem dono é
             cidade que ninguém sabe se está sendo trabalhada. Parceiro vazio é
             "—" porque nem toda cidade chegou por parceiro. */
          <span style={{ fontSize: 12, color: token.colorWarningText }}>sem responsável</span>
        ),
    },
    {
      title: "Última atividade",
      dataIndex: "lastActivityAt",
      width: 140,
      align: "right",
      search: false,
      responsive: ["lg"],
      sorter: (a, b) => (a.lastActivityAt ?? "").localeCompare(b.lastActivityAt ?? ""),
      render: (_, linha) => <UltimaAtividade iso={linha.lastActivityAt} />,
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
        /* A soma das larguras fixas: menor que isso, a tabela espreme as
           colunas em vez de rolar. */
        scroll={{ x: 1400 }}
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
              title="Documentos anexados"
              value={documents.filter((documento) => documento.source === "upload").length}
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

/**
 * "há 3 dias" em vez de uma data.
 *
 * A pergunta que esta coluna responde é *qual cidade está parada*, e ninguém
 * subtrai datas de cabeça ao varrer vinte linhas. A partir de duas semanas o
 * texto fica em cor de alerta — é onde "faz tempo" vira "alguém precisa olhar".
 */
function UltimaAtividade({ iso }: { iso?: string }) {
  const { token } = theme.useToken();

  if (!iso) {
    // Nunca teve atividade é ausência, não zero dias.
    return <span style={{ fontFamily: FONTE_MONO, color: token.colorTextQuaternary }}>—</span>;
  }

  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) {
    return <span style={{ fontFamily: FONTE_MONO, color: token.colorTextQuaternary }}>—</span>;
  }

  const dias = Math.floor((Date.now() - quando.getTime()) / 86_400_000);
  const texto =
    dias <= 0 ? "hoje" : dias === 1 ? "ontem" : dias < 30 ? `há ${dias} dias` : `há ${Math.floor(dias / 30)} meses`;

  return (
    <span
      style={{
        fontFamily: FONTE_MONO,
        fontSize: 12,
        color: dias >= 14 ? token.colorWarningText : token.colorText,
      }}
    >
      {texto}
    </span>
  );
}
