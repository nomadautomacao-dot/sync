"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FolderAddOutlined,
  LoadingOutlined,
  PaperClipOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Alert, App, Button, Card, Flex, Result, Skeleton, Typography, theme } from "antd";

import type { IbgeMunicipio } from "@/core/lib/ibge-client";
import {
  ensureCity,
  listCities,
  updateCityPipeline,
} from "@/core/lib/cities-firestore";
import {
  getFirebaseDb,
  getFirebaseStorage,
} from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import { useFilaDeEmissao } from "@/core/providers/fila-emissao-provider";
import {
  createCityReport,
  cityReportSnapshotFromUnknown,
  generatedReportBundleFromUnknown,
} from "@/modules/cidades/city-reports-firestore";
import { uploadCityDocument } from "@/modules/documentos/documentos-firestore";

import { BuscaMunicipio } from "./_components/busca-municipio";
import { CabecalhoMunicipio } from "./_components/cabecalho-municipio";
import { LinhaDocumento } from "./_components/linha-documento";
import { PainelCenso } from "./_components/painel-censo";
import { PainelProjecao } from "./_components/painel-projecao";
import { DOCUMENTOS, RELATORIOS_PADRAO } from "@/modules/cidades/documentos-emissiveis";
import type { RespostaLevantamento } from "./_components/tipos";

type Documento =
  | "raio-x"
  | "levantamento"
  | "dever-de-casa"
  | "historico-censo"
  | "oficio-documentos"
  | "dossie-escolas"
  | "dossie-conformidade"
  | "dossie-matricula"
  | "dossie-dinheiro"
  | "dossie-aprendizagem"
  | "dossie-demanda"
  | "dossie-equidade"
  | "dossie-comparativo";


function pdfBlobFromBase64(base64: string): Blob {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: "application/pdf" });
}

export default function LevantamentoFundebPage() {
  return (
    <Suspense fallback={<EsqueletoDaBancada />}>
      <Bancada />
    </Suspense>
  );
}

function Bancada() {
  const { message, notification } = App.useApp();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { enfileirar } = useFilaDeEmissao();
  const { token } = theme.useToken();

  /* O município ativo mora na URL: é o que faz a faixa "retomar" do hub abrir a
     bancada já carregada, e o que deixa a tela sobreviver a um refresh. */
  const codigoIbge = searchParams.get("ibge");

  /* A escolha da busca fica em memória só para mostrar o nome antes de o
     relatório chegar. Se a URL apontar para outro município, ela não vale. */
  const [escolhido, setEscolhido] = useState<IbgeMunicipio | null>(null);
  const escolhidoValido = escolhido?.codigoIbge === codigoIbge ? escolhido : null;

  const [gerando, setGerando] = useState<Documento | null>(null);

  const {
    data: resposta,
    isLoading,
    error,
  } = useQuery<RespostaLevantamento>({
    queryKey: ["levantamento-fundeb", codigoIbge],
    queryFn: async () => {
      const res = await fetch(`/api/modulos/levantamento-fundeb/${codigoIbge}`);
      if (!res.ok) {
        const detalhe = await res.json().catch(() => null);
        throw new Error(detalhe?.error ?? "Não foi possível carregar os dados deste município.");
      }
      return res.json();
    },
    enabled: !!codigoIbge,
  });

  const relatorio = resposta?.relatorio;
  const identificacao = relatorio?.identificacao;

  /* Nenhum dos dossiês tem tamanho fixo — 20 blocos em Ibateguara, 508 em
     Manaus. Disparar um PDF de 130 folhas sem avisar é hostil, então a prévia
     vem antes e o card anuncia o volume real. */
  const { data: previaConformidade } = useQuery<{
    requisitos: number;
    pendentes: number;
    paginasEstimadas: number;
  }>({
    queryKey: ["dossie-conformidade-previa", codigoIbge],
    queryFn: async () => {
      const res = await fetch(`/api/modulos/dossies/conformidade?codigo_ibge=${codigoIbge}`);
      if (!res.ok) throw new Error("prévia indisponível");
      return res.json();
    },
    enabled: !!codigoIbge,
    retry: false,
  });

  const { data: previaDossie } = useQuery<{ escolas: number; paginasEstimadas: number }>({
    queryKey: ["dossie-escolas-previa", codigoIbge],
    queryFn: async () => {
      const res = await fetch(`/api/modulos/dossies/escolas?codigo_ibge=${codigoIbge}`);
      if (!res.ok) throw new Error("prévia indisponível");
      return res.json();
    },
    enabled: !!codigoIbge,
    retry: false,
  });

  const { data: previaMatricula } = useQuery<{
    segmentos: number;
    divergencias: number;
    paginasEstimadas: number;
  }>({
    queryKey: ["dossie-matricula-previa", codigoIbge],
    queryFn: async () => {
      const res = await fetch(`/api/modulos/dossies/matricula?codigo_ibge=${codigoIbge}`);
      if (!res.ok) throw new Error("prévia indisponível");
      return res.json();
    },
    enabled: !!codigoIbge,
    retry: false,
  });

  const { data: previaAprendizagem } = useQuery<{
    provas: number;
    seriesAtipicas: number;
    paginasEstimadas: number;
  }>({
    queryKey: ["dossie-aprendizagem-previa", codigoIbge],
    queryFn: async () => {
      const res = await fetch(`/api/modulos/dossies/aprendizagem?codigo_ibge=${codigoIbge}`);
      if (!res.ok) throw new Error("prévia indisponível");
      return res.json();
    },
    enabled: !!codigoIbge,
    retry: false,
  });

  const { data: previaDemanda } = useQuery<{
    coortes: number;
    demandaCrecheNaoAtendida: number | null;
    coberturaCreche: number | null;
    paginasEstimadas: number;
  }>({
    queryKey: ["dossie-demanda-previa", codigoIbge],
    queryFn: async () => {
      const res = await fetch(`/api/modulos/dossies/demanda?codigo_ibge=${codigoIbge}`);
      if (!res.ok) throw new Error("prévia indisponível");
      return res.json();
    },
    enabled: !!codigoIbge,
    retry: false,
  });

  const { data: previaEquidade } = useQuery<{
    correntes: number;
    povosComSinal: number;
    mudouCadastro: boolean;
    paginasEstimadas: number;
  }>({
    queryKey: ["dossie-equidade-previa", codigoIbge],
    queryFn: async () => {
      const res = await fetch(`/api/modulos/dossies/equidade?codigo_ibge=${codigoIbge}`);
      if (!res.ok) throw new Error("prévia indisponível");
      return res.json();
    },
    enabled: !!codigoIbge,
    retry: false,
  });

  /* O Dever de Casa julga contra fontes vivas (CAUC, Siconfi) e datasets
     locais; a prévia antecipa a nota e quantos itens ficaram verificáveis. */
  const { data: previaDever } = useQuery<{
    nota: number | null;
    rotulo: string;
    cumpre: number;
    avaliados: number;
    semDado: number;
    paginasEstimadas: number;
  }>({
    queryKey: ["dever-de-casa-previa", codigoIbge],
    queryFn: async () => {
      const res = await fetch(`/api/modulos/levantamento-fundeb/dever-de-casa?codigo_ibge=${codigoIbge}`);
      if (!res.ok) throw new Error("prévia indisponível");
      return res.json();
    },
    enabled: !!codigoIbge,
    retry: false,
  });

  const { data: previaComparativo } = useQuery<{
    indicadores: number;
    piores: number;
    posicaoMedia: number | null;
    paginasEstimadas: number;
  }>({
    queryKey: ["dossie-comparativo-previa", codigoIbge],
    queryFn: async () => {
      const res = await fetch(`/api/modulos/dossies/comparativo?codigo_ibge=${codigoIbge}`);
      if (!res.ok) throw new Error("prévia indisponível");
      return res.json();
    },
    enabled: !!codigoIbge,
    retry: false,
  });

  /* Chegando pela URL, o nome e a UF só existem depois que o relatório carrega —
     e os dois são obrigatórios no corpo que as rotas de PDF recebem. */
  const municipio: IbgeMunicipio | null =
    escolhidoValido ??
    (codigoIbge && identificacao?.municipioNome && identificacao.uf
      ? {
          codigoIbge,
          nome: identificacao.municipioNome,
          uf: identificacao.uf,
          regiao: identificacao.regiao ?? "",
        }
      : null);

  /* O painel do FNDE resolve obra por nome e UF, não por código IBGE — então
     esta prévia só pode rodar depois que o relatório trouxe a identificação. */
  const { data: previaDinheiro } = useQuery<{
    obras: number;
    obrasParadas: number;
    conveniosVigentes: number;
    paginasEstimadas: number;
  }>({
    queryKey: ["dossie-dinheiro-previa", codigoIbge],
    queryFn: async () => {
      const params = new URLSearchParams({
        codigo_ibge: municipio!.codigoIbge,
        nome: municipio!.nome,
        uf: municipio!.uf,
      });
      const res = await fetch(`/api/modulos/dossies/dinheiro?${params}`);
      if (!res.ok) throw new Error("prévia indisponível");
      return res.json();
    },
    enabled: !!municipio,
    retry: false,
  });

  /* Os quatro dossiês não têm tamanho fixo, e cada um mede o próprio volume
     numa grandeza diferente. Sem prévia o card diz "tamanho variável" em vez de
     mentir um número — falha de prévia não bloqueia a geração. */
  const medidaDoCard = (id: Documento): string | undefined => {
    if (id === "dever-de-casa") {
      if (!previaDever) return "tamanho variável";
      const nota =
        previaDever.nota !== null
          ? `nota ${previaDever.nota.toFixed(1).replace(".", ",")}`
          : "sem nota";
      return `${nota} · ${previaDever.cumpre}/${previaDever.avaliados} itens · ~${previaDever.paginasEstimadas} pg`;
    }
    if (id === "dossie-escolas") {
      return previaDossie
        ? `${previaDossie.escolas} escolas · ~${previaDossie.paginasEstimadas} pg`
        : "tamanho variável";
    }
    if (id === "dossie-conformidade") {
      return previaConformidade
        ? `${previaConformidade.requisitos} requisitos · ~${previaConformidade.paginasEstimadas} pg`
        : "tamanho variável";
    }
    if (id === "dossie-matricula") {
      if (!previaMatricula) return "tamanho variável";
      const divergencias =
        previaMatricula.divergencias > 0
          ? ` · ${previaMatricula.divergencias} a conferir`
          : "";
      return `${previaMatricula.segmentos} segmentos${divergencias} · ~${previaMatricula.paginasEstimadas} pg`;
    }
    if (id === "dossie-dinheiro") {
      if (!previaDinheiro) return "tamanho variável";
      const paradas =
        previaDinheiro.obrasParadas > 0 ? ` · ${previaDinheiro.obrasParadas} parada(s)` : "";
      return `${previaDinheiro.obras} obras${paradas} · ${previaDinheiro.conveniosVigentes} convênios · ~${previaDinheiro.paginasEstimadas} pg`;
    }
    if (id === "dossie-aprendizagem") {
      if (!previaAprendizagem) return "tamanho variável";
      const atipicas =
        previaAprendizagem.seriesAtipicas > 0
          ? ` · ${previaAprendizagem.seriesAtipicas} atípica(s)`
          : "";
      return `${previaAprendizagem.provas} provas do Saeb${atipicas} · ~${previaAprendizagem.paginasEstimadas} pg`;
    }
    if (id === "dossie-demanda") {
      if (!previaDemanda) return "tamanho variável";
      const creche =
        previaDemanda.coberturaCreche !== null
          ? ` · creche ${previaDemanda.coberturaCreche.toFixed(1).replace(".", ",")}%`
          : "";
      return `${previaDemanda.coortes} coortes${creche} · ~${previaDemanda.paginasEstimadas} pg`;
    }
    if (id === "dossie-equidade") {
      if (!previaEquidade) return "tamanho variável";
      const sinal =
        previaEquidade.povosComSinal > 0 ? ` · ${previaEquidade.povosComSinal} a conferir` : "";
      const cadastro = previaEquidade.mudouCadastro ? " · cadastro mudou" : "";
      return `${previaEquidade.correntes} povo(s)${sinal}${cadastro} · ~${previaEquidade.paginasEstimadas} pg`;
    }
    if (id === "dossie-comparativo") {
      if (!previaComparativo) return "tamanho variável";
      const posicao =
        previaComparativo.posicaoMedia !== null ? ` · posição p${previaComparativo.posicaoMedia}` : "";
      return `${previaComparativo.indicadores} indicadores · ${previaComparativo.piores} abaixo${posicao} · ~${previaComparativo.paginasEstimadas} pg`;
    }
    return undefined;
  };

  /* A carteira é consultada para saber se este município já é cliente. Gerar
     relatório deixou de criar cidade sozinho: emitir um PDF é pesquisa, entrar
     na carteira é decisão comercial, e misturar as duas enchia o pipeline de
     município que só se quis olhar uma vez. */
  const { data: cidadesDaCarteira = [] } = useQuery({
    queryKey: ["cities", user?.groupId],
    queryFn: () => listCities(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });

  const cidadeNaCarteira =
    municipio
      ? (cidadesDaCarteira.find(
          (cidade) =>
            cidade.codigoIbge.replace(/\D/g, "") ===
            municipio.codigoIbge.replace(/\D/g, ""),
        ) ?? null)
      : null;

  const adicionarNaCarteira = useMutation({
    mutationFn: async () => {
      if (!municipio) throw new Error("Escolha um município primeiro.");
      if (!user?.groupId) throw new Error("Sessão sem grupo definido.");
      return ensureCity(getFirebaseDb(), user.groupId, {
        name: municipio.nome,
        uf: municipio.uf,
        codigoIbge: municipio.codigoIbge,
        region: identificacao?.regiao ?? municipio.regiao,
        stage: "technical_diagnostic",
      });
    },
    onSuccess: async (cidade) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cities"] }),
        queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] }),
      ]);

      /* Entrar na carteira já enfileira os quatro relatórios de reunião. A
         emissão roda no shell, então trocar de tela — ou fechar e reabrir o
         app — não interrompe o que ficou pendente. */
      const enfileirados = await enfileirar(
        {
          cityId: cidade.id,
          cityName: cidade.name,
          cityUf: cidade.uf,
          codigoIbge: cidade.codigoIbge,
          regiao: identificacao?.regiao ?? municipio?.regiao,
        },
        RELATORIOS_PADRAO,
      );

      notification.success({
        message: `${cidade.name} entrou na carteira.`,
        description: enfileirados
          ? `${enfileirados} relatórios entraram na fila e serão anexados à ficha.`
          : undefined,
        btn: (
          <Button type="link" size="small" onClick={() => router.push(`/cidades/${cidade.id}`)}>
            Abrir ficha
          </Button>
        ),
      });
    },
    onError: (erro) =>
      message.error(
        erro instanceof Error
          ? erro.message
          : "Não foi possível adicionar o município à carteira.",
      ),
  });

  const selecionarMunicipio = (selecionado: IbgeMunicipio) => {
    setEscolhido(selecionado);
    router.replace(`${pathname}?ibge=${selecionado.codigoIbge}`, { scroll: false });
  };

  const trocarMunicipio = () => {
    setEscolhido(null);
    router.replace(pathname, { scroll: false });
  };

  const gerarDocumento = async (documento: (typeof DOCUMENTOS)[number]) => {
    if (!municipio || isLoading || error || !resposta || !relatorio) {
      message.error(
        isLoading
          ? "Aguarde os dados do município terminarem de carregar."
          : "Carregue os dados FUNDEB antes de gerar o documento.",
      );
      return;
    }

    setGerando(documento.id);
    try {
      const res = await fetch(documento.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo_ibge: municipio.codigoIbge,
          nome: municipio.nome,
          uf: municipio.uf,
          response_format: "bundle",
        }),
      });

      if (!res.ok) {
        /* A rota devolve `{ error }` em JSON; mostrar a mensagem do servidor
           evita o "falhou" genérico que não diz o que corrigir. */
        const detalhe = await res.json().catch(() => null);
        throw new Error(detalhe?.error ?? `Falha na geração (HTTP ${res.status}).`);
      }

      const bundle = generatedReportBundleFromUnknown(
        await res.json().catch(() => null),
      );
      if (!bundle) {
        throw new Error(
          "O servidor gerou uma resposta incompleta: o PDF veio sem o JSON de arquivamento.",
        );
      }
      const selectedCode = municipio.codigoIbge.replace(/\D/g, "");
      const generatedCode =
        bundle.archive.municipality.codigoIbge.replace(/\D/g, "");
      if (selectedCode !== generatedCode) {
        throw new Error(
          `O relatório retornou o IBGE ${generatedCode}, mas a cidade selecionada é ${selectedCode}. Nada foi arquivado.`,
        );
      }

      const blob = pdfBlobFromBase64(bundle.pdfBase64);
      const fileName = bundle.fileName;
      const reportSnapshot = cityReportSnapshotFromUnknown(bundle.archive);
      if (!reportSnapshot) {
        throw new Error("O JSON do relatório não pôde ser normalizado para arquivamento.");
      }

      let dataArchived = false;
      let pdfArchived = false;
      let linkingFailed = false;
      let linkedCityId: string | undefined;
      /* Arquiva só em cidade que já está na carteira. Fora dela o PDF é gerado
         e baixado, e nada é escrito no Firestore — quem decide se aquele
         município vira cliente é o botão "Adicionar à carteira", não o ato de
         emitir um relatório. */
      if (user?.groupId && cidadeNaCarteira) {
        try {
          const db = getFirebaseDb();
          const city = cidadeNaCarteira;
          linkedCityId = city.id;

          const file = new File([blob], fileName, {
            type: res.headers.get("Content-Type") || "application/pdf",
          });
          let archivedDocument:
            | Awaited<ReturnType<typeof uploadCityDocument>>
            | undefined;

          try {
            archivedDocument = await uploadCityDocument(
              db,
              getFirebaseStorage(),
              file,
              {
                groupId: user.groupId,
                cityId: city.id,
                cityName: city.name,
                cityUf: city.uf,
                category: "relatorio",
                title: `${documento.nome} ${identificacao?.exercicio ?? new Date().getFullYear()}`,
                description:
                  "Relatório gerado pela Central de Relatórios e Levantamentos FUNDEB.",
                createdBy: user.id,
                createdByName: user.name,
                source: "generated",
              },
            );
            pdfArchived = true;
          } catch (archiveError) {
            console.warn(
              "PDF gerado, mas a cópia binária não pôde ser arquivada:",
              archiveError,
            );
          }

          await createCityReport(db, {
            groupId: user.groupId,
            cityId: city.id,
            cityName: city.name,
            cityUf: city.uf,
            codigoIbge: city.codigoIbge,
            type: documento.reportType,
            title: documento.nome,
            exercise:
              Number(bundle.archive.exercise) || new Date().getFullYear(),
            snapshot: reportSnapshot,
            generationId: bundle.archive.generationId,
            documentId: archivedDocument?.id,
            downloadUrl: archivedDocument?.downloadUrl,
            fileName: archivedDocument?.fileName,
            generatedBy: user.id,
            generatedByName: user.name,
          });
          dataArchived = true;

          const receitaFundeb = Number(relatorio?.receitas?.totalReceitas);
          const pipelinePatch: Record<string, unknown> = {
            lastActivityAt: new Date().toISOString(),
          };
          if (city.stage === "mapping" || city.stage === "first_contact") {
            pipelinePatch.stage = "technical_diagnostic";
          }
          if (Number.isFinite(receitaFundeb) && receitaFundeb > 0) {
            pipelinePatch.estimatedAnnualRevenue = receitaFundeb;
          }
          await updateCityPipeline(db, city.id, pipelinePatch).catch(
            (stageError) => {
              console.warn(
                "Relatório arquivado, mas o pipeline não foi atualizado:",
                stageError,
              );
            },
          );
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] }),
            queryClient.invalidateQueries({ queryKey: ["city-documents"] }),
            queryClient.invalidateQueries({ queryKey: ["city-reports"] }),
            queryClient.invalidateQueries({ queryKey: ["cities"] }),
          ]);
        } catch (archiveError) {
          console.error("Erro ao associar relatório à cidade:", archiveError);
          linkingFailed = true;
        }
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      const abrirCidadeBtn = linkedCityId ? (
        <Button type="link" size="small" onClick={() => router.push(`/cidades/${linkedCityId}`)}>
          Abrir cidade
        </Button>
      ) : undefined;

      if (dataArchived && !pdfArchived) {
        notification.warning({
          title: `${documento.nome} gerado.`,
          description: `Os dados foram vinculados a ${municipio.nome}, mas o PDF não foi arquivado.`,
          actions: abrirCidadeBtn,
        });
      } else if (linkingFailed) {
        notification.error({
          title: `${documento.nome} baixado`,
          description: "O JSON não foi salvo na cidade. Tente gerar novamente.",
          actions: abrirCidadeBtn,
        });
      } else if (!cidadeNaCarteira) {
        notification.success({
          title: `${documento.nome} gerado e baixado.`,
          description: `${municipio.nome} não está na carteira, então nada foi arquivado.`,
          actions: (
            <Button type="link" size="small" onClick={() => adicionarNaCarteira.mutate()}>
              Adicionar à carteira
            </Button>
          ),
        });
      } else {
        notification.success({
          title: `${documento.nome} gerado e anexado a ${municipio.nome}.`,
          actions: abrirCidadeBtn,
        });
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Erro ao gerar o documento.");
    } finally {
      setGerando(null);
    }
  };

  /* Os dois grupos de documento — cada um vira um bloco de `List` dentro do
     mesmo card, com um cabeçalho de seção entre eles. */
  const grupos = (
    [
      { titulo: "Relatórios", prefixo: false },
      { titulo: "Dossiês temáticos", prefixo: true },
    ] as const
  ).map((grupo) => ({
    ...grupo,
    documentos: DOCUMENTOS.filter(
      (documento) => documento.id.startsWith("dossie-") === grupo.prefixo,
    ),
  }));

  const documentoDesabilitado =
    !municipio || isLoading || Boolean(error) || !resposta || !relatorio || gerando !== null;

  return (
    <Flex vertical gap={14} style={{ padding: "4px 4px 14px" }}>
      {/* Cabeçalho em uma linha: o título ocupava três, com um parágrafo que
          listava as fontes — informação de folheto numa tela de trabalho. */}
      <Flex align="baseline" wrap="wrap" gap={8} component="header">
        <Link href="/modulos">
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            Módulos
          </Typography.Text>
        </Link>
        <RightOutlined style={{ fontSize: 10, color: token.colorTextQuaternary }} />
        <Typography.Title level={4} style={{ margin: 0 }}>
          Relatórios &amp; Levantamentos FUNDEB
        </Typography.Title>
        <Typography.Text
          type="secondary"
          style={{ fontFamily: "var(--font-sync-mono)", fontSize: 10 }}
        >
          IBGE · FNDE · INEP · DATASUS · CAGED · CadÚnico · SICONFI
        </Typography.Text>
      </Flex>

      {!codigoIbge ? (
        <BuscaMunicipio onSelecionar={selecionarMunicipio} />
      ) : (
        <>
          {municipio ? (
            <CabecalhoMunicipio
              nome={municipio.nome}
              uf={municipio.uf}
              codigoIbge={municipio.codigoIbge}
              mesorregiao={identificacao?.mesorregiao}
              regiao={identificacao?.regiao ?? municipio.regiao}
              prefeito={identificacao?.prefeito}
              partido={identificacao?.partido}
              onTrocar={trocarMunicipio}
            />
          ) : (
            <Card size="small">
              <Skeleton active title={{ width: "35%" }} paragraph={{ rows: 1, width: "55%" }} />
            </Card>
          )}

          {municipio &&
            (cidadeNaCarteira ? (
              <Alert
                type="success"
                showIcon
                icon={<PaperClipOutlined />}
                title={
                  <Flex align="center" justify="space-between" gap={12} wrap="wrap">
                    <span>
                      {municipio.nome} está na carteira — cada relatório gerado fica anexado
                      à ficha.
                    </span>
                    <Link href={`/cidades/${cidadeNaCarteira.id}`}>Abrir ficha</Link>
                  </Flex>
                }
              />
            ) : (
              <Alert
                type="info"
                showIcon
                icon={<FolderAddOutlined />}
                title={
                  <Flex align="center" justify="space-between" gap={12} wrap="wrap">
                    <span>
                      {municipio.nome} não está na carteira. Os relatórios são apenas
                      baixados; nada é arquivado.
                    </span>
                    <Button
                      size="small"
                      type="primary"
                      icon={<FolderAddOutlined />}
                      loading={adicionarNaCarteira.isPending}
                      onClick={() => adicionarNaCarteira.mutate()}
                    >
                      Adicionar à carteira
                    </Button>
                  </Flex>
                }
              />
            ))}

          <Card size="small" styles={{ body: { padding: 0 } }}>
            {grupos.map((grupo) => (
              <div key={grupo.titulo}>
                <Flex
                  align="center"
                  gap={8}
                  style={{
                    padding: "6px 12px",
                    background: token.colorFillAlter,
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <Typography.Text
                    type="secondary"
                    style={{
                      fontFamily: "var(--font-sync-mono)",
                      fontSize: 9,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: 1.1,
                    }}
                  >
                    {grupo.titulo}
                  </Typography.Text>
                  <Typography.Text
                    type="secondary"
                    style={{ fontFamily: "var(--font-sync-mono)", fontSize: 9 }}
                  >
                    {grupo.documentos.length}
                  </Typography.Text>
                </Flex>

                <Flex vertical gap={2}>
                  {grupo.documentos.map((documento) => (
                    <LinhaDocumento
                      key={documento.id}
                      icone={documento.icone}
                      nome={documento.nome}
                      paginas={documento.paginas}
                      medida={medidaDoCard(documento.id)}
                      descricao={documento.descricao}
                      variante={documento.variante}
                      gerando={gerando === documento.id}
                      desabilitado={documentoDesabilitado}
                      onGerar={() => gerarDocumento(documento)}
                    />
                  ))}
                </Flex>
              </div>
            ))}
          </Card>

          {isLoading ? (
            <Card size="small">
              <Flex vertical gap={12}>
                <Flex align="center" gap={10}>
                  <LoadingOutlined style={{ fontSize: 16, color: token.colorTextTertiary }} />
                  <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                    Consultando portarias FNDE, Censo INEP e SICONFI…
                  </Typography.Text>
                </Flex>
                <Skeleton active title={false} paragraph={{ rows: 4 }} />
              </Flex>
            </Card>
          ) : error ? (
            <ErroDoLevantamento
              mensagem={error instanceof Error ? error.message : "Erro ao carregar o município."}
              onTrocar={trocarMunicipio}
            />
          ) : relatorio ? (
            <>
              <PainelProjecao
                projecao={relatorio.projecao}
                recuperavel={relatorio.projecaoRecuperavel}
              />
              <PainelCenso
                censo={relatorio.censoEscolar}
                perfil={relatorio.perfilComercial}
                projecao={relatorio.projecao}
              />
            </>
          ) : null}
        </>
      )}
    </Flex>
  );
}

function ErroDoLevantamento({ mensagem, onTrocar }: { mensagem: string; onTrocar: () => void }) {
  return (
    <Result
      status="error"
      title={mensagem}
      subTitle="Os documentos acima dependem desses dados e seguem indisponíveis para este município."
      extra={
        <Button type="primary" onClick={onTrocar}>
          Escolher outro município
        </Button>
      }
    />
  );
}

function EsqueletoDaBancada() {
  return (
    <Flex
      vertical
      gap={14}
      style={{ padding: "4px 4px 0" }}
      role="status"
      aria-label="Carregando o levantamento"
    >
      <Skeleton.Input active size="large" style={{ width: 420, maxWidth: "100%" }} />
      <Card size="small">
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    </Flex>
  );
}
