import { getFndeObrasEnrichment, type ObraDetalhada } from "./fnde-obras";
import { getEmendasMunicipio, type EmendasMunicipio } from "./emendas-municipais";
import {
  getConveniosMunicipio,
  getSancoesMunicipio,
  type ConvenioResumo,
  type ConveniosMunicipio,
  type SancoesMunicipio,
} from "./portal-transparencia";
import { getEstimativaPnae, type EstimativaPnae } from "./fundeb-pnae";

/**
 * Dossiê do Dinheiro Federal — o segundo orçamento da educação municipal.
 *
 * ## O que ele prova
 *
 * O FUNDEB é o maior fluxo e o único contínuo. Emenda parlamentar, convênio,
 * obra do FNDE e PNAE somam um segundo orçamento que é **descontínuo,
 * disputado e perecível**: obra parada perde valor a cada mês, emenda não
 * empenhada volta, convênio sem prestação de contas fecha a porta do próximo.
 *
 * O Raio-X dá duas folhas a isso. Aqui cada obra aparece com situação, termo e
 * saldo; cada ano de emenda com empenhado e pago; cada convênio vigente com
 * vigência e liberação. É o inventário que a prefeitura não tem consolidado em
 * lugar nenhum, porque cada pedaço mora num sistema diferente.
 *
 * ## As duas distinções que o dossiê existe para fazer
 *
 * 1. **Empenhado não é pago.** Emenda empenhada é promessa registrada; o que
 *    entrou no caixa é a coluna do lado. A diferença entre as duas é a linha
 *    que ninguém olha e a que diz se o recurso chegou.
 * 2. **Obra no município não é obra do município.** O painel do Pacto lista
 *    obras por território, e a esfera diz de quem é. Apresentar obra estadual
 *    como perda municipal é o erro que derruba o relatório inteiro na primeira
 *    pergunta do secretário — em Manaus, a maior obra paralisada é do estado.
 */

/** Situações do painel que significam dinheiro contratado e não entregue. */
const SITUACOES_PARADAS = new Set(["PARALISADA", "INACABADA", "EM RETOMADA"]);
/** Situações em que não há repasse futuro a esperar, qualquer que seja o saldo. */
const SITUACOES_ENCERRADAS = new Set(["CONCLUIDA", "CONCLUÍDA", "OBRA CANCELADA", "CANCELADA"]);
/** Convênio que vence dentro desta janela entra na lista de urgência. */
const JANELA_VENCIMENTO_DIAS = 180;

export interface ObraDossie extends ObraDetalhada {
  /** `true` quando a esfera do termo é o próprio município. */
  doMunicipio: boolean;
  parada: boolean;
  /**
   * Repasse estimado menos o já executado — **só onde a leitura faz sentido**.
   *
   * `null` em obra concluída ou cancelada, onde não há repasse futuro a
   * esperar, e em obra de outra esfera, onde o dinheiro não é do município.
   * Imprimir a subtração nesses casos anunciaria milhões a receber numa obra
   * entregue anos atrás, e é o tipo de linha que o secretário de finanças usa
   * para descartar o documento.
   */
  aReceber: number | null;
  /**
   * O que trava a retomada, quando ela está travada. `null` quando a obra não
   * está parada ou quando o painel não dá elementos para dizer.
   */
  trava: string | null;
}

export interface ConvenioDossie extends ConvenioResumo {
  /** Dias até o fim da vigência. Negativo se já venceu. */
  diasRestantes: number | null;
  vencendo: boolean;
  /** Liberado ÷ valor, em %. `null` sem valor pactuado. */
  execucao: number | null;
}

export interface DossieDinheiro {
  municipio: string;
  uf: string;
  obras: ObraDossie[];
  emendas: EmendasMunicipio | null;
  convenios: ConveniosMunicipio | null;
  conveniosLista: ConvenioDossie[];
  sancoes: SancoesMunicipio | null;
  pnae: EstimativaPnae | null;
  /** Por que uma fonte não veio, quando não veio. Uma frase por fonte. */
  ausencias: string[];
  fontes: string[];
  resumo: {
    obras: number;
    obrasDoMunicipio: number;
    obrasParadas: number;
    valorParadoMunicipal: number;
    valorParadoOutrasEsferas: number;
    /** Estimativa de repasse ainda a receber nas obras paradas do município. */
    aReceberEmObrasParadas: number;
    emendasEmpenhado: number;
    emendasPago: number;
    emendasEducacao: number;
    /** Pago ÷ empenhado no período, em %. `null` sem empenho. */
    taxaDeChegada: number | null;
    conveniosVigentes: number;
    valorConveniosVigentes: number;
    conveniosVencendo: number;
    conveniosSemLiberacao: number;
    /** Soma do que este dossiê consegue somar sem duplicar nada. */
    totalRastreado: number;
  };
}

function diasAte(iso: string, referencia: Date): number {
  const alvo = new Date(`${iso}T12:00:00Z`).getTime();
  const hoje = Date.UTC(
    referencia.getUTCFullYear(),
    referencia.getUTCMonth(),
    referencia.getUTCDate(),
    12,
  );
  return Math.round((alvo - hoje) / 86_400_000);
}

/**
 * O que impede a retomada, lido dos campos de termo do painel.
 *
 * A leitura importa porque separa o que a prefeitura resolve do que depende do
 * FNDE: termo não gerado é fila do FNDE, termo gerado e não validado é
 * assinatura do ente. Dizer "está parada" sem dizer de quem é a próxima ação
 * transforma o dossiê em lamento.
 */
function lerTrava(obra: ObraDetalhada): string | null {
  if (!SITUACOES_PARADAS.has(obra.situacao)) return null;

  const solicitacao = obra.situacaoSolicitacao.trim().toUpperCase();
  if (solicitacao === "INDEFERIDO") {
    return "Solicitação de repactuação indeferida: a obra está fora do novo pacto, e reentrar exige novo pleito ao FNDE.";
  }
  if (solicitacao.startsWith("DILIG")) {
    return "Solicitação em diligência: o FNDE pediu complementação e a próxima ação é do município.";
  }

  const gerado = /gerado/i.test(obra.termoGerado);
  const validado = /validado/i.test(obra.termoValidado);

  if (!gerado) {
    return "Solicitação deferida e termo ainda não gerado: a próxima ação é do FNDE, e o que cabe ao município é cobrar a emissão.";
  }
  if (!validado) {
    return "Termo gerado e ainda não validado: a assinatura é do ente, e é o passo mais rápido de destravar deste quadro.";
  }
  return "Termo gerado e validado: a pactuação está formalizada e o que falta é execução física.";
}

/** Exportada para teste: é a regra de "de quem é este dinheiro". */
export function montarObras(obras: ObraDetalhada[]): ObraDossie[] {
  return obras.map((obra) => {
    const doMunicipio = /municipal/i.test(obra.esfera);
    const encerrada = SITUACOES_ENCERRADAS.has(obra.situacao);
    return {
      ...obra,
      doMunicipio,
      parada: SITUACOES_PARADAS.has(obra.situacao),
      aReceber:
        doMunicipio && !encerrada ? Math.max(0, obra.estimativaRepasse - obra.execucao) : null,
      trava: lerTrava(obra),
    };
  });
}

/** Exportada para teste: é a regra de urgência da carteira de convênios. */
export function montarConvenios(
  convenios: ConveniosMunicipio | null,
  referencia: Date,
): ConvenioDossie[] {
  if (!convenios) return [];

  return convenios.vigentesLista.map((c) => {
    const dias = c.fimVigencia === null ? null : diasAte(c.fimVigencia, referencia);
    return {
      ...c,
      diasRestantes: dias,
      vencendo: dias !== null && dias >= 0 && dias <= JANELA_VENCIMENTO_DIAS,
      execucao: c.valor > 0 ? (c.valorLiberado / c.valor) * 100 : null,
    };
  });
}

export async function montarDossieDinheiro(
  codigoIBGE: string,
  municipio: string,
  uf: string,
  referencia = new Date(),
): Promise<DossieDinheiro> {
  // Nenhuma fonte derruba o dossiê: cada seção some com a explicação de por
  // quê. Convênios e sanções vão à rede e dependem de chave; obras vêm da
  // planilha pública do FNDE; emendas e PNAE são dataset local.
  const [obrasRes, conveniosRes, sancoesRes] = await Promise.allSettled([
    getFndeObrasEnrichment({ municipio, uf }),
    getConveniosMunicipio(codigoIBGE),
    getSancoesMunicipio(municipio, uf),
  ]);

  const ausencias: string[] = [];

  const enrichment = obrasRes.status === "fulfilled" ? obrasRes.value : null;
  if (!enrichment) {
    ausencias.push(
      "O painel do Pacto de Retomada de Obras do FNDE não respondeu nesta emissão — a seção de obras sai vazia em vez de sair estimada.",
    );
  }

  const convenios = conveniosRes.status === "fulfilled" ? conveniosRes.value : null;
  if (!convenios) {
    ausencias.push(
      conveniosRes.status === "rejected"
        ? "A consulta de convênios ao Portal da Transparência falhou nesta emissão. A API limita chamadas por minuto na chave gratuita; repetir a geração em alguns minutos costuma resolver."
        : "A consulta de convênios exige a chave do Portal da Transparência, que não está configurada neste ambiente.",
    );
  }

  const sancoes = sancoesRes.status === "fulfilled" ? sancoesRes.value : null;
  if (!sancoes) {
    ausencias.push(
      "A consulta de sanções (CEIS/CNEP) não respondeu nesta emissão — ausência de resposta não é ausência de sanção.",
    );
  }

  const emendas = getEmendasMunicipio(codigoIBGE);
  if (!emendas) {
    ausencias.push(
      "O Portal da Transparência não registra emenda parlamentar com aplicação carimbada neste município desde 2020. A ausência é do carimbo territorial: emenda de aplicação estadual ou nacional que beneficie o município de forma difusa não entra nesta base.",
    );
  }

  const obras = montarObras(enrichment?.obras ?? []);
  const conveniosLista = montarConvenios(convenios, referencia);
  const pnae = getEstimativaPnae(codigoIBGE);

  const paradas = obras.filter((o) => o.parada);
  const paradasMunicipais = paradas.filter((o) => o.doMunicipio);

  const emendasEmpenhado = (emendas?.anos ?? []).reduce((t, a) => t + a.empenhado, 0);
  const emendasPago = (emendas?.anos ?? []).reduce((t, a) => t + a.pago, 0);

  return {
    municipio,
    uf,
    obras,
    emendas,
    convenios,
    conveniosLista,
    sancoes,
    pnae,
    ausencias,
    fontes: [
      "FNDE — Painel do Pacto de Retomada de Obras (dados abertos)",
      "Portal da Transparência (CGU) — Emendas Parlamentares, download de dados",
      "Portal da Transparência (CGU) — Convênios e acordos, API de dados",
      "Portal da Transparência (CGU) — CEIS e CNEP",
      "Resolução CD/FNDE nº 4/2026, Anexo V — PNAE",
    ],
    resumo: {
      obras: obras.length,
      obrasDoMunicipio: obras.filter((o) => o.doMunicipio).length,
      obrasParadas: paradas.length,
      valorParadoMunicipal: paradasMunicipais.reduce((t, o) => t + o.estimativaRepasse, 0),
      valorParadoOutrasEsferas: paradas
        .filter((o) => !o.doMunicipio)
        .reduce((t, o) => t + o.estimativaRepasse, 0),
      aReceberEmObrasParadas: paradasMunicipais.reduce((t, o) => t + (o.aReceber ?? 0), 0),
      emendasEmpenhado,
      emendasPago,
      emendasEducacao: (emendas?.anos ?? []).reduce((t, a) => t + a.empenhadoEducacao, 0),
      taxaDeChegada: emendasEmpenhado > 0 ? (emendasPago / emendasEmpenhado) * 100 : null,
      conveniosVigentes: convenios?.vigentes ?? 0,
      valorConveniosVigentes: convenios?.valorVigentes ?? 0,
      conveniosVencendo: conveniosLista.filter((c) => c.vencendo).length,
      conveniosSemLiberacao: convenios?.semLiberacao ?? 0,
      // Só entra o que é do município e não se sobrepõe: convênio pactuado
      // vigente, repasse ainda a receber em obra parada do próprio ente e a
      // estimativa anual do PNAE. Emenda fica de fora do total porque boa
      // parte dela **vira** convênio — somar as duas contaria duas vezes.
      totalRastreado:
        (convenios?.valorVigentes ?? 0) +
        paradasMunicipais.reduce((t, o) => t + (o.aReceber ?? 0), 0) +
        (pnae?.valorAnual ?? 0),
    },
  };
}
