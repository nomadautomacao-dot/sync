"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  FileTextIcon,
  HistoryIcon,
  LoaderIcon,
  ClipboardCheckIcon,
  BabyIcon,
  GlobeIcon,
  GraduationCapIcon,
  LandmarkIcon,
  ScaleIcon,
  SchoolIcon,
  SendIcon,
  ZapIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { IbgeMunicipio } from "@/core/lib/ibge-client";
import { ensureCity, updateCityPipeline } from "@/core/lib/cities-firestore";
import {
  getFirebaseDb,
  getFirebaseStorage,
} from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import {
  createCityReport,
  cityReportSnapshotFromUnknown,
  generatedReportBundleFromUnknown,
} from "@/modules/cidades/city-reports-firestore";
import type { CityReportType } from "@/modules/cidades/reports-types";
import { uploadCityDocument } from "@/modules/documentos/documentos-firestore";

import { BuscaMunicipio } from "./_components/busca-municipio";
import { CabecalhoMunicipio } from "./_components/cabecalho-municipio";
import { DocumentoCard } from "./_components/documento-card";
import { PainelCenso } from "./_components/painel-censo";
import { PainelProjecao } from "./_components/painel-projecao";
import type { RespostaLevantamento } from "./_components/tipos";

type Documento =
  | "raio-x"
  | "levantamento"
  | "historico-censo"
  | "oficio-documentos"
  | "dossie-escolas"
  | "dossie-conformidade"
  | "dossie-matricula"
  | "dossie-dinheiro"
  | "dossie-aprendizagem"
  | "dossie-demanda"
  | "dossie-equidade";

/**
 * Os quatro documentos que o módulo produz, nesta ordem de uso.
 *
 * O Raio-X é a cidade inteira, o passo que antecede a conversa de fundo — a
 * equipe chega sabendo o município. O Diagnóstico é o aprofundamento no FUNDEB.
 * O Histórico do Censo compara os últimos três Censos Escolares em detalhe.
 * Todos partem da mesma carga de dados: a rota remonta o município no servidor.
 *
 * O Ofício é o único **endereçado à prefeitura** — os outros três são análise
 * interna. Por isso o tom dele é de coleta, nunca de veredito.
 */
const DOCUMENTOS = [
  {
    id: "raio-x" as const,
    reportType: "raio_x" as CityReportType,
    icone: ZapIcon,
    nome: "Raio-X Municipal",
    paginas: 41,
    variante: "secundario" as const,
    prefixoArquivo: "RaioX_Municipal",
    endpoint: "/api/modulos/levantamento-fundeb/raio-x",
    descricao:
      "A cidade inteira antes da conversa de fundo. Todo número traz fonte e ano.",
    conteudo: [
      "Saneamento (Censo 2022)",
      "Rede de saúde (CNES)",
      "Emprego formal (CAGED)",
      "Vulnerabilidade (CadÚnico)",
      "Capacidade institucional (MUNIC)",
    ],
  },
  {
    id: "levantamento" as const,
    reportType: "diagnostico_fundeb" as CityReportType,
    icone: FileTextIcon,
    nome: "Diagnóstico FUNDEB",
    paginas: 10,
    variante: "primario" as const,
    prefixoArquivo: "Levantamento_FUNDEB",
    endpoint: "/api/modulos/levantamento-fundeb/pdf?tipo=levantamento",
    descricao:
      "O aprofundamento no fundo: repasses, projeção de ganho e plano de ação.",
    conteudo: [
      "VAAF / VAAT / VAAR",
      "Projeção de ganho",
      "Censo Escolar INEP",
      "Série histórica",
      "Saúde fiscal",
      "Plano de ação",
    ],
  },
  {
    id: "historico-censo" as const,
    reportType: "historico_censo" as CityReportType,
    icone: HistoryIcon,
    nome: "Histórico do Censo Escolar",
    paginas: 11,
    variante: "secundario" as const,
    prefixoArquivo: "Historico_Censo",
    endpoint: "/api/modulos/levantamento-fundeb/historico-censo",
    descricao:
      "Os últimos três Censos lado a lado — e o que a trajetória significa para a receita.",
    conteudo: [
      "Matrículas por rede e etapa",
      "Creche e pré-escola",
      "Cor/raça em série",
      "Tempo integral (fator)",
      "Docentes e rede física",
      "Infraestrutura em série",
      "Sinais e perguntas de campo",
    ],
  },
  {
    id: "oficio-documentos" as const,
    reportType: "oficio_documentos" as CityReportType,
    icone: SendIcon,
    nome: "Ofício de solicitação de documentos",
    paginas: 4,
    variante: "secundario" as const,
    prefixoArquivo: "Oficio_Documentos",
    endpoint: "/api/modulos/levantamento-fundeb/oficio-documentos",
    descricao:
      "O único documento endereçado à prefeitura: pede os cinco documentos da rede e traz o questionário do que as bases não alcançam.",
    conteudo: [
      "Ofício à Secretaria de Educação",
      "Os cinco documentos, com caixa",
      "Onde cada um costuma estar",
      "Questionário com linha de resposta",
      "Registro público sob cada pergunta",
    ],
  },
  {
    id: "dossie-escolas" as const,
    reportType: "dossie_escolas" as CityReportType,
    icone: SchoolIcon,
    nome: "Dossiê das Escolas",
    // O tamanho é função do município; a medida real vem da prévia da rota.
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dossie_Escolas",
    endpoint: "/api/modulos/dossies/escolas",
    descricao:
      "A rede inteira, unidade por unidade: território, matrícula, resultado e contexto de cada escola na mesma linha.",
    conteudo: [
      "Um bloco por escola",
      "IDEB e Saeb por etapa",
      "INSE e complexidade de gestão",
      "Distorção, abandono e docentes",
      "Cor/raça e transporte",
      "Índice remissivo",
    ],
  },
  {
    id: "dossie-conformidade" as const,
    reportType: "dossie_conformidade" as CityReportType,
    icone: ClipboardCheckIcon,
    nome: "Dossiê da Conformidade",
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dossie_Conformidade",
    endpoint: "/api/modulos/dossies/conformidade",
    descricao:
      "Todo requisito do CAUC com a data em que vence, toda vinculação do SIOPE com a folga, e o que cada pendência trava — e o que ela não trava.",
    conteudo: [
      "Agenda por data de vencimento",
      "Requisito a requisito",
      "SIOPE com folga e parâmetro",
      "Pontualidade das DCAs",
      "As cinco condicionalidades",
      "Piso do magistério",
    ],
  },
  {
    id: "dossie-matricula" as const,
    reportType: "dossie_matricula" as CityReportType,
    icone: ScaleIcon,
    nome: "Dossiê da Matrícula Ponderada",
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dossie_Matricula_Ponderada",
    endpoint: "/api/modulos/dossies/matricula",
    descricao:
      "De onde vem cada real do fundo: todos os segmentos com matrícula × fator, cinco cortes do mesmo total e a conciliação com o Censo que o município preencheu.",
    conteudo: [
      "Todos os segmentos, com a conta aberta",
      "Os dois fatores — VAAF e VAAT",
      "Cinco cortes do mesmo total",
      "Conciliação Censo × Portaria",
      "Censo contra Portaria, indicador a indicador",
      "Série da composição e PNAE",
    ],
  },
  {
    id: "dossie-dinheiro" as const,
    reportType: "dossie_dinheiro" as CityReportType,
    icone: LandmarkIcon,
    nome: "Dossiê do Dinheiro Federal",
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dossie_Dinheiro_Federal",
    endpoint: "/api/modulos/dossies/dinheiro",
    descricao:
      "O segundo orçamento: obra do FNDE com o que trava cada uma, emenda ano a ano com quanto virou pagamento, convênio a convênio e quem já mandou dinheiro para cá.",
    conteudo: [
      "Obra a obra, com a esfera do termo",
      "O que trava cada retomada",
      "Emenda: empenhado contra pago",
      "Quem já mandou dinheiro para cá",
      "Convênio a convênio, com liberação",
      "Sanções e transferências automáticas",
    ],
  },
  {
    id: "dossie-aprendizagem" as const,
    reportType: "dossie_aprendizagem" as CityReportType,
    icone: GraduationCapIcon,
    nome: "Dossiê da Aprendizagem",
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dossie_Aprendizagem",
    endpoint: "/api/modulos/dossies/aprendizagem",
    descricao:
      "A distribuição que a média esconde: as quatro provas do Saeb com o percentual convertido em crianças, a série do IDEB e a alfabetização contra a meta que o município assinou.",
    conteudo: [
      "Distribuição das quatro provas",
      "Percentual convertido em crianças",
      "Régua contra as redes do país",
      "IDEB, edição a edição",
      "Alfabetização contra a meta assinada",
      "Fluxo escolar e a ponte com o VAAR",
    ],
  },
  {
    id: "dossie-demanda" as const,
    reportType: "dossie_demanda" as CityReportType,
    icone: BabyIcon,
    nome: "Dossiê da Demanda",
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dossie_Demanda",
    endpoint: "/api/modulos/dossies/demanda",
    descricao:
      "A rede de 2030 já nasceu: o calendário das coortes do Registro Civil, a cobertura por faixa com os dois denominadores e a conta da creche contra a meta do PNE.",
    conteudo: [
      "Calendário das coortes por ano",
      "Cobertura: rede municipal e todas",
      "A conta da creche e a meta do PNE",
      "Fora da escola × demanda não atendida",
      "Busca ativa pelo Bolsa Família",
      "Maternidade adolescente e rural",
    ],
  },
  {
    id: "dossie-equidade" as const,
    reportType: "dossie_equidade" as CityReportType,
    icone: GlobeIcon,
    nome: "Dossiê da Equidade e dos Territórios",
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dossie_Equidade",
    endpoint: "/api/modulos/dossies/equidade",
    descricao:
      "Três contagens da mesma criança — Censo Demográfico, Censo Escolar e Portaria do FUNDEB — e a distância entre elas, que é a Condicionalidade III e o fator de ponderação ao mesmo tempo.",
    conteudo: [
      "Série de cor/raça, ano a ano",
      "Mudança de cadastro sinalizada",
      "A corrente de três elos por povo",
      "Territórios declarados e seus fatores",
      "Cor/raça por zona urbana e rural",
      "A ponte com a Condicionalidade III",
    ],
  },
];

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
    return undefined;
  };

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
      toast.error(
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
      if (user?.groupId) {
        try {
          const db = getFirebaseDb();
          const city = await ensureCity(db, user.groupId, {
            name: bundle.archive.municipality.name,
            uf: bundle.archive.municipality.uf,
            codigoIbge: bundle.archive.municipality.codigoIbge,
            region: municipio.regiao,
            stage: "technical_diagnostic",
          });
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

      const toastOptions = linkedCityId
        ? {
            action: {
              label: "Abrir cidade",
              onClick: () => router.push(`/cidades/${linkedCityId}`),
            },
          }
        : undefined;

      if (dataArchived && !pdfArchived) {
        toast.warning(
          `${documento.nome} gerado. Os dados foram vinculados a ${municipio.nome}, mas o PDF não foi arquivado.`,
          toastOptions,
        );
      } else if (linkingFailed) {
        toast.error(
          `${documento.nome} baixado, mas o JSON não foi salvo na cidade. Tente gerar novamente.`,
          toastOptions,
        );
      } else {
        toast.success(
          dataArchived
            ? `${documento.nome} gerado e anexado a ${municipio.nome}.`
            : `${documento.nome} gerado.`,
          toastOptions,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar o documento.");
    } finally {
      setGerando(null);
    }
  };

  return (
    <div className="flex flex-col gap-[14px] px-[4px] pt-[4px] pb-[14px]">
      <header>
        <nav className="flex items-center gap-[5px] text-[11.5px] text-[#A2A6B2]">
          <Link href="/modulos" className="transition-colors hover:text-[#16181D]">
            Módulos
          </Link>
          <ChevronRightIcon className="size-[12px]" />
          <span className="text-[#767A86]">Levantamento FUNDEB</span>
        </nav>

        <h1 className="mt-[6px] text-[21px] font-bold tracking-[-0.7px] text-[#16181D]">
          Central de Relatórios &amp; Levantamentos FUNDEB
        </h1>
        <p className="mt-[3px] text-[13px] text-[#767A86]">
          Raio-X da cidade inteira e diagnóstico técnico de repasses, a partir de IBGE, FNDE, INEP,
          DATASUS, CAGED, CadÚnico e SICONFI.
        </p>
      </header>

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
            <div
              role="status"
              aria-label="Carregando o município"
              className="h-[80px] animate-pulse rounded-[16px] border border-white/95 bg-white/60"
            />
          )}

          {municipio && (
            <div className="flex items-center gap-2 rounded-[12px] border border-[#CFE8DB] bg-[#F2FAF6] px-3.5 py-2.5 text-[10.5px] font-semibold text-[#1F6A47]">
              <CheckCircle2Icon className="size-3.5 shrink-0" />
              Todo relatório gerado será baixado e também anexado automaticamente
              à ficha de {municipio.nome}.
              <Link
                href="/cidades"
                className="ml-auto shrink-0 font-bold underline underline-offset-2"
              >
                Ver cidades
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2 xl:grid-cols-3">
            {DOCUMENTOS.map((documento) => (
              <DocumentoCard
                key={documento.id}
                icone={documento.icone}
                nome={documento.nome}
                paginas={documento.paginas}
                medida={medidaDoCard(documento.id)}
                descricao={documento.descricao}
                conteudo={documento.conteudo}
                variante={documento.variante}
                gerando={gerando === documento.id}
                desabilitado={
                  !municipio ||
                  isLoading ||
                  Boolean(error) ||
                  !resposta ||
                  !relatorio ||
                  gerando !== null
                }
                onGerar={() => gerarDocumento(documento)}
              />
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-[10px] rounded-[16px] border border-white/95 bg-white/88 py-[48px] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
              <LoaderIcon className="size-[16px] animate-spin text-[#A2A6B2]" />
              <span className="text-[12.5px] text-[#767A86]">
                Consultando portarias FNDE, Censo INEP e SICONFI…
              </span>
            </div>
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
    </div>
  );
}

function ErroDoLevantamento({ mensagem, onTrocar }: { mensagem: string; onTrocar: () => void }) {
  return (
    <section className="rounded-[16px] border border-white/95 bg-white/88 p-[24px] text-center shadow-[0_10px_26px_rgba(22,24,29,.05)]">
      <p className="text-[13px] font-semibold text-[#991B1B]">{mensagem}</p>
      <p className="mt-[6px] text-[12px] text-[#767A86]">
        Os documentos acima dependem desses dados e seguem indisponíveis para este município.
      </p>
      <button
        type="button"
        onClick={onTrocar}
        className="mt-[16px] inline-flex h-[38px] items-center rounded-[20px] bg-[#F2F1F7] px-[16px] text-[12.5px] font-semibold text-[#3B3F4A] transition-colors hover:bg-[#ECEBF2]"
      >
        Escolher outro município
      </button>
    </section>
  );
}

function EsqueletoDaBancada() {
  return (
    <div
      role="status"
      aria-label="Carregando o levantamento"
      className="flex animate-pulse flex-col gap-[14px] px-[4px] pt-[4px]"
    >
      <div className="h-[56px] w-[420px] max-w-full rounded-[12px] bg-white/50" />
      <div className="h-[150px] rounded-[16px] border border-white/95 bg-white/60" />
    </div>
  );
}
