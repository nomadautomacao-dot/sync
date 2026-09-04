"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftOutlined,
  BankOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ContactsOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  EditOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  FolderOutlined,
  HistoryOutlined,
  MoreOutlined,
  PaperClipOutlined,
  ProjectOutlined,
  RiseOutlined,
  RocketOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Flex,
  Result,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tabs,
  Tag,
  theme,
  Typography,
} from "antd";
import type { MenuProps } from "antd";

import { useVisualizador } from "@/core/components/usar-visualizador";
import { VisualizadorDeArquivo } from "@/core/components/visualizador-de-arquivo";
import {
  deleteCity,
  getCity,
} from "@/core/lib/cities-firestore";
import {
  STAGE_LABELS,
  formatCurrency,
  stagePastelTone,
  type CityAccount,
} from "@/core/lib/city-types";
import { getFirebaseDb, getFirebaseStorage } from "@/core/lib/firebase-client";
import { registrarArquivoNaLinhaDoTempo } from "@/core/lib/city-events-firestore";
import type { IniciativaDaCidade } from "@/core/domain/cidade-iniciativas";
import { listIniciativas } from "@/core/lib/city-initiatives-firestore";
import { useAuth } from "@/core/providers/auth-provider";
import { baixarPdf } from "@/modules/cidades/emissao";
import { listCityReports } from "@/modules/cidades/city-reports-firestore";
import {
  CITY_REPORT_TYPE_LABELS,
  type CityReport,
} from "@/modules/cidades/reports-types";
import {
  formatFileSize,
  listCityDocuments,
  uploadCityDocument,
} from "@/modules/documentos/documentos-firestore";
import type {
  CityDocument,
  CreateCityDocumentInput,
} from "@/modules/documentos/types";

import { podeEditar, podeVer, podeVerAdministrativo } from "@/core/domain/rbac";

import { DocumentUploadDialog } from "../../documentos/_components/document-upload-dialog";
import { PastaDaCidade } from "./_components/pasta-da-cidade";
import { ProjetosDaCidade } from "./_components/projetos-da-cidade";
import { DeleteCityDialog } from "./_components/delete-city-dialog";
import { ResponsaveisDialog } from "./_components/responsaveis-dialog";
import { Contatos } from "./_components/contatos";
import { ContratoDaCidade } from "./_components/contrato-da-cidade";
import { Cronograma } from "./_components/cronograma";
import { DocumentosDaCidade } from "./_components/documentos-da-cidade";
import { Panorama } from "./_components/panorama";
import { FundebDataTab } from "./_components/fundeb-data-tab";
import { LinhaDoTempo } from "./_components/linha-do-tempo";

const { Text, Title } = Typography;

type CityTab =
  | "linha-do-tempo"
  | "contatos"
  | "cronograma"
  | "contrato"
  | "projetos"
  | "panorama"
  | "dados-fundeb"
  | "relatorios";

export default function CidadeDetailPage() {
  const { message } = App.useApp();
  const params = useParams<{ cityId: string }>();
  const cityId = params.cityId;
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  /* A linha do tempo é a aba de entrada: quem abre uma cidade quer saber o que
     se passou nela, não editar o funil. `?aba=` existe para as portas de fora
     — o catálogo de módulos manda direto para a aba de contrato. */
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<CityTab>(() => {
    const pedida = searchParams.get("aba");
    const validas: CityTab[] = [
      "linha-do-tempo",
      "contatos",
      "cronograma",
      "contrato",
      "projetos",
      "panorama",
      "dados-fundeb",
      "relatorios",
    ];
    return validas.includes(pedida as CityTab) ? (pedida as CityTab) : "linha-do-tempo";
  });
  /* A pasta saiu da barra de abas e virou gaveta no menu de três pontos: ela
     não é um lugar por onde se trabalha, é o arquivo — consulta-se e fecha-se,
     de dentro de qualquer aba, sem perder o que estava aberto.

     `?aba=documentos` continua valendo como porta de fora e abre a gaveta, em
     vez de cair em silêncio na linha do tempo. */
  const [pastaAberta, setPastaAberta] = useState(
    () => searchParams.get("aba") === "documentos",
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  /* Quando o upload é uma análise sobre um relatório, e não um documento
     avulso. Guarda o relatório para vincular e para nomear o acontecimento. */
  const [anexarAoRelatorio, setAnexarAoRelatorio] = useState<CityReport | null>(null);
  /* Quando o upload é de um projeto — o cartaz e o certificado da capacitação.
     Mesmo mecanismo do relatório: quem sabe a que o arquivo pertence é quem
     abriu o diálogo, não o formulário. */
  const [anexarAoProjeto, setAnexarAoProjeto] = useState<IniciativaDaCidade | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [responsaveisOpen, setResponsaveisOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const {
    data: city,
    isPending: cityPending,
    error: cityError,
  } = useQuery({
    queryKey: ["city", cityId],
    queryFn: () => getCity(getFirebaseDb(), cityId),
    enabled: Boolean(cityId),
  });

  const {
    data: reports = [],
    isPending: reportsPending,
    error: reportsError,
  } = useQuery({
    queryKey: ["city-reports", user?.groupId, cityId],
    queryFn: () => listCityReports(getFirebaseDb(), user!.groupId, cityId),
    enabled: Boolean(user?.groupId && cityId),
  });

  const { data: allDocuments = [], isPending: documentsPending } = useQuery({
    queryKey: ["city-documents", user?.groupId],
    queryFn: () => listCityDocuments(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });
  /* Relatório é o que o sistema emite; documento é o que a equipe anexa. A
     emissão grava o PDF gerado também em `cityDocuments` (source "generated"),
     e sem este filtro cada relatório aparecia duas vezes — uma na aba de
     Relatórios e outra contada como "documento", inflando a pasta da cidade
     com cópias do que a aba ao lado já mostra. */
  const documents = useMemo(
    () =>
      allDocuments.filter(
        (document) => document.cityId === cityId && document.source === "upload",
      ),
    [allDocuments, cityId],
  );

  /* A pasta mostra **tudo** que tem esta cidade — inclusive o que o sistema
     emitiu. O filtro acima existe para as outras telas, onde relatório e
     documento são coisas separadas; aqui a pergunta é "o que existe desta
     cidade", e um Raio-X emitido é documento dela como qualquer outro.

     O que resolvia o problema da contagem dupla agora é a coluna Origem: em
     vez de esconder o arquivo, a pasta diz de onde ele veio. */
  const documentosDaPasta = useMemo(
    () => allDocuments.filter((document) => document.cityId === cityId),
    [allDocuments, cityId],
  );

  /* Só para nomear a origem na pasta: o documento guarda `iniciativaId`, e o
     nome do projeto mora na iniciativa. Mesma `queryKey` da aba Projetos — o
     TanStack serve as duas com uma leitura só. */
  const { data: iniciativas = [] } = useQuery({
    queryKey: ["city-initiatives", cityId],
    queryFn: () => listIniciativas(getFirebaseDb(), user!.groupId, cityId),
    enabled: Boolean(user?.groupId && cityId),
  });

  const uploadMutation = useMutation({
    mutationFn: ({
      file,
      input,
    }: {
      file: File;
      input: Omit<
        CreateCityDocumentInput,
        "groupId" | "createdBy" | "createdByName"
      >;
    }) =>
      uploadCityDocument(getFirebaseDb(), getFirebaseStorage(), file, {
        ...input,
        groupId: user!.groupId,
        createdBy: user!.id,
        createdByName: user!.name,
      }),
    onSuccess: async (documento) => {
      queryClient.invalidateQueries({ queryKey: ["city-documents"] });
      setUploadOpen(false);
      setAnexarAoRelatorio(null);
      setAnexarAoProjeto(null);
      message.success("Documento anexado à cidade.");

      /* O arquivo entrou; agora ele vira acontecimento, com autor e data, para
         que a equipe veja a contribuição sem abrir a aba de Documentos.
         Falha aqui é aviso, não erro: o documento já está salvo e íntegro —
         desfazer o upload por causa da anotação seria perder o trabalho de
         quem subiu o arquivo. */
      try {
        await registrarArquivoNaLinhaDoTempo(
          getFirebaseDb(),
          user!.groupId,
          cityId,
          {
            titulo: documento.title,
            url: documento.downloadUrl,
            documentoId: documento.id,
            relatorioTitulo: documento.relatorioTitulo,
            descricao: documento.description,
          },
          { uid: user!.id, nome: user!.name },
        );
        queryClient.invalidateQueries({ queryKey: ["city-events", cityId] });
      } catch {
        message.warning(
          "O documento foi salvo, mas não entrou na linha do tempo. Registre-o à mão se for importante para a equipe.",
        );
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (targetCityId: string) =>
      deleteCity(getFirebaseDb(), targetCityId),
    onSuccess: async () => {
      setDeleteOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cities"] }),
        queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] }),
        queryClient.invalidateQueries({ queryKey: ["documentos-cities"] }),
        queryClient.invalidateQueries({ queryKey: ["sidebar-cities-real"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-cities-real"] }),
        queryClient.invalidateQueries({ queryKey: ["modulos-cities"] }),
      ]);
      queryClient.removeQueries({ queryKey: ["city", cityId] });
      message.success("Cidade excluída da carteira. O histórico foi preservado.");
      router.replace("/cidades");
    },
    onError: (error) => {
      message.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a cidade.",
      );
    },
  });

  const selectedReport =
    reports.find((report) => report.id === selectedReportId) ?? reports[0];

  if (cityPending) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (cityError || !city) {
    return (
      <Result
        icon={<EnvironmentOutlined style={{ color: token.colorTextTertiary }} />}
        title="Cidade não encontrada"
        extra={
          <Link href="/cidades">
            <Button type="primary">Voltar para cidades</Button>
          </Link>
        }
      />
    );
  }

  const tone = stagePastelTone(city.stage);

  /* Receita estimada, probabilidade e estágio saem da tela de quem não tem
     Pipeline — e isso não é zelo abstrato: a consultora abre a cidade na frente
     do secretário municipal, girando o notebook na mesa. Amarrar à permissão
     que já existe, em vez de criar uma nova, faz com que quem não vê o funil no
     menu também não o veja aqui, sem uma segunda regra para manter. */
  const verComercial = user ? podeVer(user.permissoes, "pipeline") : false;
  /* Contrato, valores e remuneração são do administrativo — e a régua é o
     papel, não a área: a colaboradora que organiza a capacitação precisa da
     ficha inteira do município e não do valor contratado. Esconder a aba é
     metade do trabalho; a outra é o `allow read` de `contratos` nas rules. */
  const verAdministrativo = podeVerAdministrativo(user?.groupRole);
  const editarCidade = user ? podeEditar(user.permissoes, "cidades") : false;

  const handleUpload = async (
    file: File,
    input: Omit<
      CreateCityDocumentInput,
      "groupId" | "createdBy" | "createdByName"
    >,
  ) => {
    /* O vínculo com o relatório entra aqui, e não no diálogo: o formulário de
       upload é o mesmo da tela de Documentos, que não conhece relatório nenhum.
       Quem sabe que este upload é uma análise é quem abriu o diálogo. */
    await uploadMutation.mutateAsync({
      file,
      input: {
        ...input,
        ...(anexarAoRelatorio
          ? { relatorioId: anexarAoRelatorio.id, relatorioTitulo: anexarAoRelatorio.title }
          : {}),
        ...(anexarAoProjeto ? { iniciativaId: anexarAoProjeto.id } : {}),
      },
    });
  };

  const optionsMenu: MenuProps["items"] = [
    {
      key: "pasta",
      icon: <FolderOutlined />,
      label: `Pasta de documentos (${documentosDaPasta.length})`,
      onClick: () => setPastaAberta(true),
    },
    { type: "divider" },
    {
      key: "excluir",
      danger: true,
      label: "Excluir cidade",
      onClick: () => setDeleteOpen(true),
    },
  ];

  /* Conteúdo por aba: renderizado fora do `Tabs` (que aqui só resolve a
     barra de navegação) para o cabeçalho — nome, estágio, ações — ficar num
     cartão só, e o conteúdo de cada aba em cartões próprios abaixo, como já
     era antes da migração. */
  const tabPanels: { key: CityTab; label: string; icon: ReactNode; content: ReactNode }[] = [
    {
      key: "linha-do-tempo",
      label: "Linha do tempo",
      icon: <HistoryOutlined />,
      content: <LinhaDoTempo cityId={city.id} />,
    },
    {
      /* Logo depois da linha do tempo: quem abre a cidade para ligar na
         prefeitura quer o telefone do secretário, não o funil. */
      key: "contatos",
      label: "Contatos",
      icon: <ContactsOutlined />,
      content: <Contatos cityId={city.id} />,
    },
    {
      key: "cronograma",
      label: "Cronograma",
      icon: <CalendarOutlined />,
      content: <Cronograma cityId={city.id} inicioSugerido={city.implantacaoInicio} />,
    },
    ...(verAdministrativo
      ? [
          {
            key: "contrato" as const,
            label: "Contrato",
            icon: <FileDoneOutlined />,
            content: <ContratoDaCidade city={city} />,
          },
        ]
      : []),
    {
      /* Logo depois do cronograma: as duas abas respondem "o que está andando
         aqui" — o cronograma pelo processo da Global, esta pelo que a equipe
         abriu dentro do município. */
      key: "projetos",
      label: "Projetos",
      icon: <ProjectOutlined />,
      content: (
        <ProjetosDaCidade
          city={city}
          documents={documents}
          onAnexar={(iniciativa) => {
            setAnexarAoProjeto(iniciativa);
            setUploadOpen(true);
          }}
        />
      ),
    },
    {
      key: "panorama",
      label: "Panorama",
      icon: <RiseOutlined />,
      content: (
        <Panorama
          city={city}
          reports={reports}
          documents={documents}
          verComercial={verComercial}
        />
      ),
    },
    {
      key: "dados-fundeb",
      label: "FUNDEB e documentos",
      icon: <DatabaseOutlined />,
      content: (
        /* A mesa de emissão vem primeiro, e a ficha do último levantamento
           abaixo: quem abre esta aba quer saber o que já existe e o que falta
           emitir antes de conferir número. */
        <Flex vertical gap={14}>
          <DocumentosDaCidade city={city} reports={reports} />
          <FundebDataTab
            city={city}
            reports={reports}
            pending={reportsPending}
            selected={selectedReport}
            onSelect={setSelectedReportId}
          />
        </Flex>
      ),
    },
    {
      key: "relatorios",
      label: `Relatórios (${reportsError ? "—" : reports.length})`,
      icon: <FileTextOutlined />,
      content: (
        <ReportsTab
          city={city}
          reports={reports}
          documents={documents}
          pending={reportsPending}
          error={reportsError}
          selected={selectedReport}
          onSelect={setSelectedReportId}
          onAnexarAnalise={(report) => {
            setAnexarAoRelatorio(report);
            setUploadOpen(true);
          }}
        />
      ),
    },
  ];

  /* A aba pedida pode não existir para quem está olhando: `/modulos/contratos`
     manda para `?aba=contrato`, e quem não é do administrativo não tem essa
     aba. Sem esta queda, o link entregaria cabeçalho sem conteúdo e sem aba
     acesa — que se lê como app quebrado, não como acesso negado. */
  const abaAtiva = tabPanels.some((painel) => painel.key === tab)
    ? tab
    : "linha-do-tempo";

  return (
    <Flex vertical gap={14}>
      <Card>
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={16}>
          <Flex gap={14} align="flex-start" style={{ minWidth: 0 }}>
            <Link href="/cidades" aria-label="Voltar para cidades">
              <Button shape="circle" icon={<ArrowLeftOutlined />} />
            </Link>
            <div style={{ minWidth: 0 }}>
              <Flex align="center" gap={10} wrap="wrap">
                <Title level={3} style={{ margin: 0 }}>
                  {city.name}
                </Title>
                {verComercial && (
                  <Tag
                    style={{
                      backgroundColor: tone.bg,
                      color: tone.text,
                      border: "none",
                      borderRadius: 999,
                    }}
                  >
                    {STAGE_LABELS[city.stage]}
                  </Tag>
                )}
              </Flex>
              <Text
                type="secondary"
                style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11 }}
              >
                {city.uf}
                {city.region ? ` · ${city.region}` : ""} · IBGE{" "}
                {city.codigoIbge || "não informado"} ·{" "}
                {reportsError
                  ? "relatórios indisponíveis"
                  : `${reports.length} relatórios`}{" "}
                · {documents.length} documentos
              </Text>
              {/* Os dois papéis da cidade: quem abriu a porta e quem responde
                  pela operação. Faltar é o estado que precisa saltar — cidade
                  sem responsável é cidade que ninguém sabe se está sendo
                  trabalhada. */}
              <Flex align="center" gap={6} wrap="wrap" style={{ marginTop: 2 }}>
                <Text style={{ fontSize: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Parceiro:
                  </Text>{" "}
                  {city.parceiroName ? (
                    city.parceiroName
                  ) : (
                    <Text style={{ fontSize: 12, color: token.colorWarningText }}>
                      não definido
                    </Text>
                  )}
                </Text>
                <Text type="secondary">·</Text>
                <Text style={{ fontSize: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Resp. técnico:
                  </Text>{" "}
                  {city.collaboratorName ? (
                    city.collaboratorName
                  ) : (
                    <Text style={{ fontSize: 12, color: token.colorWarningText }}>
                      não definido
                    </Text>
                  )}
                </Text>
                {editarCidade && (
                  <Button
                    size="small"
                    type="text"
                    icon={<EditOutlined />}
                    aria-label="Editar responsáveis da cidade"
                    title="Editar responsáveis"
                    onClick={() => setResponsaveisOpen(true)}
                  />
                )}
              </Flex>
            </div>
          </Flex>

          <Space wrap>
            <Button
              icon={<PaperClipOutlined />}
              onClick={() => setUploadOpen(true)}
            >
              Anexar documento
            </Button>
            <Link href={`/modulos/levantamento-fundeb?ibge=${city.codigoIbge}`}>
              <Button type="primary" icon={<RocketOutlined />}>
                Gerar relatório
              </Button>
            </Link>
            {(user?.groupRole === "owner" || user?.groupRole === "admin") && (
              <Dropdown menu={{ items: optionsMenu }} trigger={["click"]}>
                <Button
                  icon={<MoreOutlined />}
                  aria-label="Mais opções da cidade"
                  title="Mais opções"
                />
              </Dropdown>
            )}
          </Space>
        </Flex>

        <Tabs
          activeKey={abaAtiva}
          onChange={(key) => setTab(key as CityTab)}
          style={{ marginTop: 4, marginBottom: -16 }}
          items={tabPanels.map(({ key, label, icon }) => ({
            key,
            label: (
              <Space size={6}>
                {icon}
                {label}
              </Space>
            ),
          }))}
        />
      </Card>

      {tabPanels.find((panel) => panel.key === abaAtiva)?.content}

      <Drawer
        open={pastaAberta}
        onClose={() => setPastaAberta(false)}
        title={`Pasta de documentos · ${city.name}`}
        /* `size`, e não `width`: o antd 6 depreciou `width` e avisa no console
           a cada render. `size` aceita valor de CSS além de "default"/"large". */
        size="min(920px, 100vw)"
        destroyOnHidden
      >
        <PastaDaCidade
          cityName={city.name}
          documents={documentosDaPasta}
          pending={documentsPending}
          iniciativas={iniciativas}
          onUpload={() => setUploadOpen(true)}
        />
      </Drawer>

      {uploadOpen && (
        <DocumentUploadDialog
          open
          cities={[city]}
          initialCityId={city.id}
          uploading={uploadMutation.isPending}
          onClose={() => {
            if (!uploadMutation.isPending) {
              setUploadOpen(false);
              setAnexarAoRelatorio(null);
              setAnexarAoProjeto(null);
            }
          }}
          onSubmit={handleUpload}
        />
      )}

      {responsaveisOpen && (
        <ResponsaveisDialog city={city} onClose={() => setResponsaveisOpen(false)} />
      )}

      {deleteOpen && (
        <DeleteCityDialog
          cityName={city.name}
          deleting={deleteMutation.isPending}
          onClose={() => {
            if (!deleteMutation.isPending) setDeleteOpen(false);
          }}
          onConfirm={() => deleteMutation.mutate(city.id)}
        />
      )}
    </Flex>
  );
}

function ReportsTab({
  city,
  reports,
  documents,
  pending,
  error,
  selected,
  onSelect,
  onAnexarAnalise,
}: {
  city: CityAccount;
  reports: CityReport[];
  /** Todos os da cidade; o que interessa aqui são os vinculados a relatório. */
  documents: CityDocument[];
  pending: boolean;
  error: unknown;
  selected?: CityReport;
  onSelect: (id: string) => void;
  onAnexarAnalise: (report: CityReport) => void;
}) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [baixandoTodos, setBaixandoTodos] = useState(false);

  const comPdf = reports.filter((report) => report.downloadUrl);

  /**
   * Baixa um por um, em vez de abrir todas as URLs de uma vez.
   *
   * Abrir dez links seguidos é o caminho curto, e o navegador bloqueia a partir
   * do segundo — o usuário ficaria com um PDF e a impressão de que os outros
   * nove falharam. Buscar o arquivo e salvar o blob passa por cima disso, e no
   * app desktop cada um cai direto na pasta de relatórios.
   *
   * Um que falhe não interrompe os demais: a contagem do fim diz quantos foram.
   */
  const baixarTodos = async () => {
    setBaixandoTodos(true);
    let baixados = 0;
    for (const report of comPdf) {
      try {
        const resposta = await fetch(report.downloadUrl!);
        if (!resposta.ok) continue;
        baixarPdf(await resposta.blob(), report.fileName ?? `${report.title}.pdf`);
        baixados += 1;
      } catch {
        // Contabilizado pela ausência; o aviso do fim diz o total.
      }
    }
    setBaixandoTodos(false);
    if (baixados === comPdf.length) {
      message.success(`${baixados} relatório(s) baixado(s).`);
    } else {
      message.warning(`${baixados} de ${comPdf.length} baixados. Tente os que faltaram um a um.`);
    }
  };

  if (pending) {
    return (
      <Card style={{ minHeight: 460 }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </Card>
    );
  }

  if (error) {
    return (
      <Result
        status="warning"
        icon={<WarningOutlined />}
        title="Não foi possível consultar os relatórios"
        subTitle="A leitura do histórico falhou. Verifique as regras do Firestore e tente recarregar a página; o sistema não exibirá “zero” enquanto a consulta estiver indisponível."
      />
    );
  }

  if (!reports.length) {
    return (
      <Card style={{ minHeight: 460 }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_DEFAULT}
          description={
            <Flex vertical gap={4} style={{ maxWidth: 380 }}>
              <Text strong>Nenhum relatório gerado</Text>
              <Text type="secondary">
                Gere o primeiro levantamento. O PDF e uma versão navegável
                ficarão vinculados automaticamente a esta cidade.
              </Text>
            </Flex>
          }
        >
          <Link href={`/modulos/levantamento-fundeb?ibge=${city.codigoIbge}`}>
            <Button type="primary" icon={<RocketOutlined />}>
              Gerar levantamento
            </Button>
          </Link>
        </Empty>
      </Card>
    );
  }

  return (
    <Flex vertical gap={14}>
      <Card>
        <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
          <div>
            <Text strong style={{ fontSize: 13 }}>
              {reports.length} relatório(s) desta cidade
            </Text>
            <div>
              <Text type="secondary" style={{ fontSize: 11.5 }}>
                {comPdf.length} com PDF arquivado
                {comPdf.length < reports.length
                  ? ` · ${reports.length - comPdf.length} só na versão navegável`
                  : ""}
              </Text>
            </div>
          </div>
          <Space wrap>
            <Button
              icon={<DownloadOutlined />}
              loading={baixandoTodos}
              disabled={comPdf.length === 0}
              onClick={baixarTodos}
            >
              {baixandoTodos ? "Baixando…" : `Baixar todos (${comPdf.length})`}
            </Button>
            <Link href={`/modulos/levantamento-fundeb?ibge=${city.codigoIbge}`}>
              <Button type="primary" icon={<RocketOutlined />}>
                Emitir novo
              </Button>
            </Link>
          </Space>
        </Flex>
      </Card>

      <Row gutter={[14, 14]}>
      <Col xs={24} xl={7}>
        <Card size="small" title="Histórico de versões">
          <Flex vertical gap={6}>
            {reports.map((report) => {
              const active = selected?.id === report.id;
              return (
                <div
                  key={report.id}
                  onClick={() => onSelect(report.id)}
                  style={{
                    cursor: "pointer",
                    borderRadius: token.borderRadiusLG,
                    background: active ? token.colorFillSecondary : "transparent",
                    padding: 12,
                  }}
                >
                  <Flex gap={10} align="flex-start" style={{ width: "100%" }}>
                    <Flex
                      align="center"
                      justify="center"
                      style={{
                        width: 32,
                        height: 32,
                        flex: "0 0 auto",
                        borderRadius: token.borderRadius,
                        background: active
                          ? token.colorBgContainer
                          : token.colorFillTertiary,
                      }}
                    >
                      <FileTextOutlined style={{ color: token.colorTextSecondary }} />
                    </Flex>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text strong ellipsis style={{ fontSize: 10.5, display: "block" }}>
                        {report.title}
                      </Text>
                      <Text
                        type="secondary"
                        style={{ fontFamily: "var(--font-sync-mono)", fontSize: 8.5 }}
                      >
                        {report.exercise} · {formatDate(report.generatedAt)}
                      </Text>
                      <Flex gap={6} wrap="wrap" style={{ marginTop: 8 }}>
                        {report.downloadUrl ? (
                          <Tag color="success" style={{ fontSize: 8 }}>
                            PDF arquivado
                          </Tag>
                        ) : (
                          <Tag color="warning" style={{ fontSize: 8 }}>
                            versão navegável
                          </Tag>
                        )}
                        {report.snapshot && (
                          <Tag color="purple" style={{ fontSize: 8 }}>
                            JSON salvo
                            {report.snapshotBytes
                              ? ` · ${formatJsonSize(report.snapshotBytes)}`
                              : ""}
                          </Tag>
                        )}
                      </Flex>
                    </div>
                  </Flex>
                </div>
              );
            })}
          </Flex>
        </Card>
      </Col>

      <Col xs={24} xl={17}>
        {selected && (
          <Flex vertical gap={14}>
            <ReportPreview report={selected} />
            <AnalisesDoRelatorio
              report={selected}
              analises={documents.filter((doc) => doc.relatorioId === selected.id)}
              onAnexar={() => onAnexarAnalise(selected)}
            />
          </Flex>
        )}
      </Col>
      </Row>
    </Flex>
  );
}

/**
 * O que a equipe acrescentou em cima de um relatório.
 *
 * É a diferença entre um acervo e uma conversa: o PDF emitido é o que o sistema
 * produziu, e estas análises são o que as pessoas concluíram a partir dele.
 * Cada uma delas também vira acontecimento na linha do tempo — com autor — para
 * que a contribuição apareça sem ninguém precisar abrir esta aba.
 */
function AnalisesDoRelatorio({
  report,
  analises,
  onAnexar,
}: {
  report: CityReport;
  analises: CityDocument[];
  onAnexar: () => void;
}) {
  const { token } = theme.useToken();
  const { abrir: abrirArquivo, visor } = useVisualizador();

  return (
    <Card
      size="small"
      title={`Análises sobre "${report.title}"`}
      extra={
        <Button size="small" icon={<PaperClipOutlined />} onClick={onAnexar}>
          Anexar análise
        </Button>
      }
    >
      {analises.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary" style={{ fontSize: 12 }}>
              Ninguém anexou análise a este relatório ainda. O que for anexado
              aqui aparece na linha do tempo da cidade.
            </Text>
          }
        />
      ) : (
        <Flex vertical gap={8}>
          {analises.map((analise) => (
            <Flex key={analise.id} justify="space-between" align="center" gap={12} wrap="wrap">
              <Flex vertical gap={0} style={{ minWidth: 0 }}>
                <Text strong style={{ fontSize: 12 }}>
                  {analise.title}
                </Text>
                <Text
                  type="secondary"
                  style={{ fontSize: 11, fontFamily: "var(--font-sync-mono)" }}
                >
                  {analise.createdByName} · {formatDate(analise.createdAt)} ·{" "}
                  {formatFileSize(analise.fileSize)}
                </Text>
              </Flex>
              <Button
                size="small"
                icon={<EyeOutlined />}
                /* Abre dentro do app. Um `href` aqui contradiz o próprio
                   rótulo: o botão diz "Abrir" e o navegador baixava. */
                onClick={() =>
                  abrirArquivo({
                    url: analise.downloadUrl,
                    titulo: analise.title,
                    nomeArquivo: analise.fileName,
                    mimeType: analise.mimeType,
                    detalhe: `${analise.createdByName} · ${formatFileSize(analise.fileSize)}`,
                  })
                }
                style={{ color: token.colorPrimary }}
              >
                Abrir
              </Button>
            </Flex>
          ))}
        </Flex>
      )}

      {visor}
    </Card>
  );
}

function ReportPreview({ report }: { report: CityReport }) {
  const { token } = theme.useToken();
  const [pdfAberto, setPdfAberto] = useState(false);
  const snapshot = report.snapshot;
  const identification = snapshot?.identificacao;
  const projection =
    snapshot?.projecaoRecuperavel ?? snapshot?.projecao ?? undefined;
  const census = snapshot?.censoEscolar;

  const municipality =
    stringField(identification, "municipioNome") ||
    stringField(identification, "municipio") ||
    report.cityName;
  const current = numberField(projection, "totalAtual");
  const projected = numberField(projection, "totalProjetado");
  const gain = numberField(projection, "totalGanho");

  return (
    <Card>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
        <Flex align="center" gap={10}>
          <Flex
            align="center"
            justify="center"
            style={{
              width: 32,
              height: 32,
              flex: "0 0 auto",
              borderRadius: token.borderRadiusLG,
              background: token.colorSuccessBg,
              color: token.colorSuccess,
            }}
          >
            <BankOutlined />
          </Flex>
          <div>
            <Title level={5} style={{ margin: 0 }}>
              {CITY_REPORT_TYPE_LABELS[report.type] ?? report.title}
            </Title>
            <Text type="secondary" style={{ fontSize: 10.5 }}>
              {municipality} · {report.cityUf} · exercício {report.exercise}
            </Text>
          </div>
        </Flex>
        {report.downloadUrl && (
          <Button
            type="primary"
            icon={<EyeOutlined />}
            onClick={() => setPdfAberto(true)}
          >
            Abrir PDF exato
          </Button>
        )}
      </Flex>

      {pdfAberto && report.downloadUrl && (
        <VisualizadorDeArquivo
          url={report.downloadUrl}
          titulo={CITY_REPORT_TYPE_LABELS[report.type] ?? report.title}
          nomeArquivo={report.fileName}
          detalhe={`${municipality} · ${report.cityUf} · exercício ${report.exercise}`}
          onFechar={() => setPdfAberto(false)}
        />
      )}

      <Card
        style={{ marginTop: 20, background: token.colorBgSpotlight, border: "none" }}
      >
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
          <div>
            <Text
              style={{
                color: "rgba(255,255,255,.55)",
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Resumo do levantamento
            </Text>
            <Title
              level={4}
              style={{ color: token.colorTextLightSolid, margin: "4px 0 0" }}
            >
              {municipality}
            </Title>
          </div>
          <Tag
            style={{
              background: "rgba(255,255,255,.1)",
              color: token.colorTextLightSolid,
              border: "none",
            }}
          >
            versão {formatDate(report.generatedAt)}
          </Tag>
        </Flex>
        <Row gutter={16} style={{ marginTop: 20 }}>
          <Col span={8}>
            <Statistic
              title={
                <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 8.5 }}>
                  Atual
                </Text>
              }
              value={formatCurrency(current)}
              styles={{ content: {
                color: token.colorTextLightSolid,
                fontFamily: "var(--font-sync-mono)",
                fontSize: 15,
              } }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={
                <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 8.5 }}>
                  Projetado
                </Text>
              }
              value={formatCurrency(projected)}
              styles={{ content: {
                color: token.colorTextLightSolid,
                fontFamily: "var(--font-sync-mono)",
                fontSize: 15,
              } }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={
                <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 8.5 }}>
                  Ganho recuperável
                </Text>
              }
              value={`+${formatCurrency(gain)}`}
              styles={{ content: {
                color: token.colorSuccess,
                fontFamily: "var(--font-sync-mono)",
                fontSize: 15,
              } }}
            />
          </Col>
        </Row>
      </Card>

      {snapshot ? (
        <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12}>
            <PreviewBlock
              title="Complementações FUNDEB"
              rows={[
                ["VAAF atual", formatCurrency(numberField(projection, "vaafAtual"))],
                ["VAAT atual", formatCurrency(numberField(projection, "vaatAtual"))],
                ["VAAR atual", formatCurrency(numberField(projection, "vaarAtual"))],
              ]}
            />
          </Col>
          <Col xs={24} sm={12}>
            <PreviewBlock
              title="Censo Escolar"
              rows={[
                [
                  "Matrículas",
                  formatInteger(numberField(census, "totalMatriculas")),
                ],
                ["Escolas", formatInteger(numberField(census, "totalEscolas"))],
                [
                  "Ganho percentual",
                  `${numberField(projection, "ganhoPercentual").toFixed(1)}%`,
                ],
              ]}
            />
          </Col>
        </Row>
      ) : (
        <Alert
          style={{ marginTop: 16 }}
          type="warning"
          showIcon
          title="Esta versão possui apenas o arquivo PDF. Abra o documento exato pelo botão acima."
        />
      )}

      <Flex
        align="center"
        gap={8}
        style={{
          marginTop: 16,
          padding: "10px 12px",
          borderRadius: token.borderRadiusLG,
          background: token.colorFillTertiary,
        }}
      >
        <CheckCircleOutlined style={{ color: token.colorSuccess }} />
        <Text type="secondary" style={{ fontSize: 9.5 }}>
          Gerado por {report.generatedByName || "Global Sync"} em{" "}
          {formatDate(report.generatedAt)}
        </Text>
      </Flex>
    </Card>
  );
}

function PreviewBlock({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <Card size="small" title={title}>
      <Descriptions
        size="small"
        column={1}
        items={rows.map(([label, value]) => ({
          key: label,
          label,
          children: (
            <Text strong style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11 }}>
              {value}
            </Text>
          ),
        }))}
      />
    </Card>
  );
}


function stringField(
  object: Record<string, unknown> | undefined,
  field: string,
): string {
  return typeof object?.[field] === "string" ? object[field] : "";
}

function numberField(
  object: Record<string, unknown> | undefined,
  field: string,
): number {
  const value = Number(object?.[field]);
  return Number.isFinite(value) ? value : 0;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatDate(value?: string): string {
  if (!value) return "agora";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(".", "");
}

function formatJsonSize(bytes: number): string {
  return bytes < 1024
    ? `${bytes} B`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
