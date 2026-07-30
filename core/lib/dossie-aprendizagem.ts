import {
  getReferenciaNacionalSaeb,
  getSaebDistribuicao,
  percentilEm,
  type SaebDistribuicaoMunicipio,
  type SerieSaeb,
} from "./saeb-distribuicao";
import { getAlfabetizacaoMunicipal, type AlfabetizacaoMunicipal } from "./alfabetizacao-municipal";
import { getIdebMunicipalHistorico, getIdebMetasNacionais } from "./ideb-municipal";
import { getRendimentoMunicipal, type RendimentoMunicipal } from "./rendimento-municipal";
import { getEnemAbstencao, type EnemAbstencaoMunicipio } from "./enem-abstencao";
import { getInepCensoMunicipalRecord, type InepCensoMunicipalRecord } from "./inep-censo";
import { getSituacaoVaar, type SituacaoVaar } from "./fundeb-vaar";

/**
 * Dossiê da Aprendizagem — o que a média esconde.
 *
 * ## A tese
 *
 * O IDEB é um número só, e um número só esconde duas coisas ao mesmo tempo: a
 * distância entre as escolas da rede — isso é o Dossiê das Escolas — e a
 * **distribuição dos alunos dentro delas**, que é este documento.
 *
 * Uma rede com média 5,1 pode ter 30% dos alunos no nível insuficiente ou 8%. A
 * média não distingue; a política pública sim. Trinta por cento insuficiente é
 * recomposição em massa. Oito por cento é reforço focalizado. Os dois exigem
 * orçamento, calendário e formação diferentes, e o dado que separa um do outro
 * é público desde 2023.
 *
 * Some-se a alfabetização no 2º ano — **a única meta que o próprio município
 * assinou**. Todo o resto do dossiê compara com referência nacional ou com
 * pares; ali a régua é o compromisso do próprio ente, ano a ano até 2030.
 *
 * ## A conversão que muda a conversa, e o que ela custa
 *
 * "18% no nível insuficiente" é abstrato; "cerca de 380 crianças" não é. Mas a
 * divulgação do Saeb publica **percentual, não contagem**, e o Censo publica
 * matrícula **por etapa, não por série**. A conversão existe neste módulo com a
 * suposição declarada — distribuição uniforme entre as séries da etapa — e todo
 * campo que sai dela se chama `alunosAproximados`. Nenhum número assim aparece
 * no documento sem o sinal de aproximação e a nota que explica de onde veio.
 */

/** Séries do fundamental em cada etapa, para a conversão de % em alunos. */
const SERIES_POR_ETAPA = { anosIniciais: 5, anosFinais: 4 } as const;

export type GrupoProficiencia = "insuficiente" | "basico" | "proficiente" | "avancado";

export const ROTULO_SERIE: Record<SerieSaeb, string> = {
  lp5: "Língua Portuguesa — 5º ano",
  mt5: "Matemática — 5º ano",
  lp9: "Língua Portuguesa — 9º ano",
  mt9: "Matemática — 9º ano",
};

/**
 * O que cada grupo significa em decisão de gestão. É a tradução que falta em
 * toda divulgação oficial: a escala do INEP não tem rótulo qualitativo, e sem
 * ela o percentual não vira política.
 */
export const SIGNIFICADO_GRUPO: Record<GrupoProficiencia, string> = {
  insuficiente:
    "Não domina o que a etapa exige. Segue para a série seguinte sem a base dela — e a defasagem acumula, porque nenhuma etapa posterior volta para ensinar o que ficou.",
  basico: "Domina o mínimo, com lacunas. É o grupo em que reforço focalizado tem o maior retorno por aluno.",
  proficiente: "Domina o esperado para a etapa. É onde a rede quer a maior parte dos alunos.",
  avancado: "Vai além do esperado. Grupo pequeno em quase toda rede municipal do país.",
};

export interface GrupoDistribuicao {
  chave: GrupoProficiencia;
  rotulo: string;
  pct: number;
  /** Conversão de ordem de grandeza. `null` sem matrícula da etapa no Censo. */
  alunosAproximados: number | null;
}

export interface ReferenciaDaSerie {
  redes: number;
  medianaInsuficiente: number;
  medianaAvancado: number;
  /** Posição do município entre as redes municipais do país, de 0 a 100. */
  percentilInsuficiente: number | null;
  percentilAvancado: number | null;
}

export interface SerieDossie {
  chave: SerieSaeb;
  rotulo: string;
  etapa: "anosIniciais" | "anosFinais";
  media: number;
  grupos: GrupoDistribuicao[];
  /** Insuficiente + básico: quem ainda não domina o esperado da etapa. */
  abaixoDoEsperado: number;
  abaixoDoEsperadoAproximado: number | null;
  /** Matrícula usada como base da conversão, já dividida pelas séries da etapa. */
  baseConversao: number | null;
  /** Onde esta rede cai entre as redes municipais do país. */
  referencia: ReferenciaDaSerie | null;
  /**
   * `true` quando o percentual em avançado passa do percentil 99 nacional.
   *
   * Não é acusação de fraude: pode ser rede pequena com turma excepcional, e
   * pode ser problema de aplicação da prova. Mas 57 municípios declaram mais de
   * 60% dos alunos em avançado na Língua Portuguesa do 5º ano, contra mediana
   * de 20% — entregar isso como conquista, sem dizer onde cai no país, é a
   * afirmação que derruba o documento quando alguém confere.
   */
  atipica: boolean;
}

export interface AnoIdeb {
  ano: number;
  anosIniciais: number | null;
  anosFinais: number | null;
  /** Referência nacional do ano. Não é meta do município — ver a nota. */
  referenciaAnosIniciais: number | null;
  referenciaAnosFinais: number | null;
}

export type Trajetoria = "subindo" | "estagnada" | "caindo" | "indefinida";

export interface LeituraIdeb {
  etapa: "anosIniciais" | "anosFinais";
  rotulo: string;
  ultimo: { ano: number; valor: number } | null;
  primeiro: { ano: number; valor: number } | null;
  /** Variação entre as duas últimas edições. */
  variacaoRecente: number | null;
  trajetoria: Trajetoria;
  /** Distância até a referência nacional da última edição. */
  distanciaReferencia: number | null;
}

/** Movimento menor que isto, entre duas edições, é ruído de medida. */
const LIMIAR_ESTAGNACAO = 0.1;

export interface DossieAprendizagem {
  municipio: string;
  uf: string;
  saeb: SaebDistribuicaoMunicipio | null;
  series: SerieDossie[];
  alfabetizacao: AlfabetizacaoMunicipal | null;
  serieIdeb: AnoIdeb[];
  leituraIdeb: LeituraIdeb[];
  rendimento: RendimentoMunicipal | null;
  enem: EnemAbstencaoMunicipio | null;
  censo: InepCensoMunicipalRecord | null;
  vaar: SituacaoVaar | null;
  ausencias: string[];
  resumo: {
    /** Maior percentual insuficiente entre as quatro séries. */
    piorInsuficiente: { serie: SerieSaeb; rotulo: string; pct: number } | null;
    /** Soma da conversão em alunos, nas séries em que ela foi possível. */
    alunosInsuficientesAproximados: number | null;
    idebAnosIniciais: number | null;
    idebAnosFinais: number | null;
    alfabetizacao: number | null;
    /** `true` quando a meta de 2030 já está fora de alcance em ritmo constante. */
    metaFinalForaDeAlcance: boolean | null;
    abandonoFundamental: number | null;
    distorcaoFundamental: number | null;
    /** Provas em que a distribuição desta rede é atípica no país. */
    seriesAtipicas: number;
  };
}

// ── distribuição do Saeb ───────────────────────────────────────────────────

const ETAPA_DA_SERIE: Record<SerieSaeb, "anosIniciais" | "anosFinais"> = {
  lp5: "anosIniciais",
  mt5: "anosIniciais",
  lp9: "anosFinais",
  mt9: "anosFinais",
};

const ROTULO_GRUPO: Record<GrupoProficiencia, string> = {
  insuficiente: "Insuficiente",
  basico: "Básico",
  proficiente: "Proficiente",
  avancado: "Avançado",
};

/**
 * Matrícula de uma série do fundamental, aproximada a partir da etapa.
 *
 * A suposição é uniformidade entre as séries da etapa. Ela erra em rede com
 * pirâmide muito inclinada — município que perde matrícula ano a ano tem 1º ano
 * maior que 5º —, e é por isso que todo número que sai daqui carrega o sinal de
 * aproximação até a última tabela do documento.
 */
function baseDaSerie(
  censo: InepCensoMunicipalRecord | null,
  etapa: "anosIniciais" | "anosFinais",
): number | null {
  if (!censo) return null;
  const matricula =
    etapa === "anosIniciais"
      ? censo.anosIniciaisFundamentalMunicipal
      : censo.anosFinaisFundamentalMunicipal;
  if (typeof matricula !== "number" || matricula <= 0) return null;
  return matricula / SERIES_POR_ETAPA[etapa];
}

export function montarSeries(
  saeb: SaebDistribuicaoMunicipio | null,
  censo: InepCensoMunicipalRecord | null,
): SerieDossie[] {
  if (!saeb) return [];

  const ordem: SerieSaeb[] = ["lp5", "mt5", "lp9", "mt9"];
  const chaves: GrupoProficiencia[] = ["insuficiente", "basico", "proficiente", "avancado"];
  const nacional = getReferenciaNacionalSaeb();

  return ordem
    .filter((chave) => saeb.series[chave])
    .map((chave) => {
      const bruto = saeb.series[chave]!;
      const etapa = ETAPA_DA_SERIE[chave];
      const base = baseDaSerie(censo, etapa);
      const ref = nacional[chave] ?? null;

      const grupos = chaves.map((g) => ({
        chave: g,
        rotulo: ROTULO_GRUPO[g],
        pct: bruto.grupos[g],
        alunosAproximados: base === null ? null : Math.round((bruto.grupos[g] / 100) * base),
      }));

      const abaixo = Math.round((bruto.grupos.insuficiente + bruto.grupos.basico) * 10) / 10;

      return {
        chave,
        rotulo: ROTULO_SERIE[chave],
        etapa,
        media: bruto.media,
        grupos,
        abaixoDoEsperado: abaixo,
        abaixoDoEsperadoAproximado: base === null ? null : Math.round((abaixo / 100) * base),
        baseConversao: base === null ? null : Math.round(base),
        referencia: ref
          ? {
              redes: ref.redes,
              medianaInsuficiente: ref.medianaInsuficiente,
              medianaAvancado: ref.medianaAvancado,
              percentilInsuficiente: percentilEm(ref.insuficiente, bruto.grupos.insuficiente),
              percentilAvancado: percentilEm(ref.avancado, bruto.grupos.avancado),
            }
          : null,
        atipica: ref !== null && bruto.grupos.avancado > ref.p99Avancado,
      };
    });
}

// ── série do IDEB ──────────────────────────────────────────────────────────

/**
 * Junta as duas etapas numa linha por ano e traz a referência nacional ao lado.
 *
 * A referência **não é meta do município**: o INEP não projeta meta municipal
 * desde 2021, e chamar de meta afirmaria compromisso que ninguém assinou. A
 * regra 3 da spec deste dossiê existe exatamente por isso.
 */
export function montarSerieIdeb(codigoIBGE: string): AnoIdeb[] {
  const historico = getIdebMunicipalHistorico(codigoIBGE);
  if (!historico) return [];

  const metas = getIdebMetasNacionais();
  const porAno = new Map<number, AnoIdeb>();

  const garantir = (ano: number): AnoIdeb => {
    const atual = porAno.get(ano) ?? {
      ano,
      anosIniciais: null,
      anosFinais: null,
      referenciaAnosIniciais: null,
      referenciaAnosFinais: null,
    };
    porAno.set(ano, atual);
    return atual;
  };

  for (const item of historico.anosIniciais) garantir(item.ano).anosIniciais = item.ideb;
  for (const item of historico.anosFinais) garantir(item.ano).anosFinais = item.ideb;

  for (const meta of metas.anosIniciais) {
    const linha = porAno.get(meta.ano);
    if (linha) linha.referenciaAnosIniciais = meta.meta;
  }
  for (const meta of metas.anosFinais) {
    const linha = porAno.get(meta.ano);
    if (linha) linha.referenciaAnosFinais = meta.meta;
  }

  return [...porAno.values()].sort((a, b) => a.ano - b.ano);
}

function lerTrajetoria(pontos: Array<{ ano: number; valor: number }>): Trajetoria {
  if (pontos.length < 2) return "indefinida";
  const delta = pontos[pontos.length - 1].valor - pontos[pontos.length - 2].valor;
  if (Math.abs(delta) < LIMIAR_ESTAGNACAO) return "estagnada";
  return delta > 0 ? "subindo" : "caindo";
}

export function lerIdeb(serie: AnoIdeb[]): LeituraIdeb[] {
  const etapas: Array<{
    etapa: "anosIniciais" | "anosFinais";
    rotulo: string;
    valor: (a: AnoIdeb) => number | null;
    referencia: (a: AnoIdeb) => number | null;
  }> = [
    {
      etapa: "anosIniciais",
      rotulo: "Anos iniciais do fundamental",
      valor: (a) => a.anosIniciais,
      referencia: (a) => a.referenciaAnosIniciais,
    },
    {
      etapa: "anosFinais",
      rotulo: "Anos finais do fundamental",
      valor: (a) => a.anosFinais,
      referencia: (a) => a.referenciaAnosFinais,
    },
  ];

  return etapas.map(({ etapa, rotulo, valor, referencia }) => {
    const pontos = serie
      .map((a) => ({ ano: a.ano, valor: valor(a) }))
      .filter((p): p is { ano: number; valor: number } => p.valor !== null);

    const ultimo = pontos[pontos.length - 1] ?? null;
    const linhaUltimo = ultimo ? serie.find((a) => a.ano === ultimo.ano) : undefined;
    const ref = linhaUltimo ? referencia(linhaUltimo) : null;

    return {
      etapa,
      rotulo,
      ultimo,
      primeiro: pontos[0] ?? null,
      variacaoRecente:
        pontos.length >= 2
          ? Math.round((ultimo!.valor - pontos[pontos.length - 2].valor) * 100) / 100
          : null,
      trajetoria: lerTrajetoria(pontos),
      distanciaReferencia:
        ultimo && ref !== null ? Math.round((ultimo.valor - ref) * 100) / 100 : null,
    };
  });
}

// ── montagem ───────────────────────────────────────────────────────────────

export function montarDossieAprendizagem(
  codigoIBGE: string,
  municipio: string,
  uf: string,
): DossieAprendizagem {
  const saeb = getSaebDistribuicao(codigoIBGE);
  const censo = getInepCensoMunicipalRecord(codigoIBGE);
  const alfabetizacao = getAlfabetizacaoMunicipal(codigoIBGE);
  const rendimento = getRendimentoMunicipal(codigoIBGE);
  const enem = getEnemAbstencao(codigoIBGE, uf);
  const vaar = getSituacaoVaar(codigoIBGE);

  const series = montarSeries(saeb, censo);
  const serieIdeb = montarSerieIdeb(codigoIBGE);
  const leituraIdeb = lerIdeb(serieIdeb);

  const ausencias: string[] = [];
  if (!saeb) {
    ausencias.push(
      "A divulgação do Saeb 2023 não traz a rede municipal deste município — a distribuição de proficiência, que é o centro deste dossiê, sai vazia. Rede sem alunos avaliados em nenhuma das quatro provas não aparece na planilha.",
    );
  }
  if (!alfabetizacao) {
    ausencias.push(
      "O município não consta na divulgação do Indicador Criança Alfabetizada — sem ele não há a única régua deste dossiê que é compromisso do próprio ente.",
    );
  }
  if (!rendimento) {
    ausencias.push(
      "A divulgação do IDEB 2023 não traz taxas de rendimento para este município: aprovação, reprovação, abandono e distorção idade-série ficam de fora.",
    );
  }
  if (series.length > 0 && series.every((s) => s.baseConversao === null)) {
    ausencias.push(
      "O Censo Escolar não trouxe matrícula do fundamental por etapa para este município — os percentuais do Saeb aparecem sem a conversão em número de crianças.",
    );
  }

  const insuficientes = series
    .map((s) => ({ serie: s.chave, rotulo: s.rotulo, pct: s.grupos[0].pct }))
    .sort((a, b) => b.pct - a.pct);

  const convertidos = series
    .map((s) => s.grupos[0].alunosAproximados)
    .filter((v): v is number => v !== null);

  const ultimoIdeb = (etapa: "anosIniciais" | "anosFinais") =>
    leituraIdeb.find((l) => l.etapa === etapa)?.ultimo?.valor ?? null;

  return {
    municipio,
    uf,
    saeb,
    series,
    alfabetizacao,
    serieIdeb,
    leituraIdeb,
    rendimento,
    enem,
    censo,
    vaar,
    ausencias,
    resumo: {
      piorInsuficiente: insuficientes[0] ?? null,
      // Soma das quatro séries: são coortes diferentes, então isto **não** é
      // "alunos distintos da rede" — é a carga de trabalho somada das quatro
      // provas, e o documento diz isso onde o número aparece.
      alunosInsuficientesAproximados: convertidos.length > 0 ? convertidos.reduce((t, v) => t + v, 0) : null,
      idebAnosIniciais: ultimoIdeb("anosIniciais"),
      idebAnosFinais: ultimoIdeb("anosFinais"),
      alfabetizacao: alfabetizacao?.ultimo.valor ?? null,
      metaFinalForaDeAlcance:
        alfabetizacao?.metaFinal && alfabetizacao.ritmoObservado !== null
          ? alfabetizacao.ritmoObservado < alfabetizacao.metaFinal.ritmoNecessario
          : null,
      abandonoFundamental: rendimento?.fundamental.abandono ?? null,
      distorcaoFundamental: rendimento?.fundamental.distorcao ?? null,
      seriesAtipicas: series.filter((s) => s.atipica).length,
    },
  };
}
