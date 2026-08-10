import { getEscolasTerritorio, ROTULOS_DIFERENCIADA } from "./escolas-territorio";
import { getIdebEscolas, type EtapaEscola } from "./ideb-escolas";
import { getIndicadoresEscolas } from "./indicadores-escolas";

/**
 * Dossiê das Escolas — a rede municipal, unidade por unidade.
 *
 * ## O que este módulo faz
 *
 * Junta os três datasets por escola pelo **código do INEP** (`CO_ENTIDADE`) e
 * devolve um registro por unidade da rede municipal, com tudo o que as fontes
 * públicas sustentam sobre ela.
 *
 *     escolas-territorio.json   → toda a rede municipal ativa (geo, matrícula,
 *                                 localização, cor/raça, transporte)
 *     ideb-escolas-2025.json    → só as escolas na divulgação do IDEB
 *     indicadores-escolas.json  → só as escolas com Saeb 2023
 *
 * ## A regra que governa a cobertura
 *
 * A **base é o território**: se a escola está na rede municipal ativa, ela
 * entra no dossiê, mesmo que os outros dois datasets não a conheçam. Creche e
 * pré-escola pura não aparecem na divulgação do IDEB e ficariam de fora se o
 * join partisse de lá — e são justamente as de maior fator de ponderação.
 *
 * Consequência conhecida e declarada: **escola fora da divulgação do IDEB não
 * tem nome**, porque o nome só existe nos outros dois datasets. Ela sai
 * identificada pelo código, com a etiqueta de por quê. Resolver isso exige
 * regerar `escolas-territorio.json` com a coluna `NO_ENTIDADE` dos microdados
 * — ver `docs/specs/relatorios-extensos/01-dossie-das-escolas.md`, seção 5.
 *
 * Nenhuma escola some. Unidade sem nenhum dado além do código ainda aparece,
 * com tudo em branco: ela existe na rede e o documento tem de mostrar isso.
 */

/** Sinais que disparam a linha de leitura de um bloco. Ordem = prioridade. */
export type SinalEscola =
  | "sem-resultado-participacao"
  | "abaixo-do-esperado-para-o-contexto"
  | "abandono-alto"
  | "distorcao-alta"
  | "aprovacao-integral"
  | "localizacao-diferenciada"
  | "sem-coordenada";

export interface EscolaDossie {
  codigo: string;
  /** `null` quando a escola não aparece na divulgação do IDEB nem no Saeb. */
  nome: string | null;
  // ── território ────────────────────────────────────────────────────────
  rural: boolean;
  /** Cru do dicionário do INEP; 0 = não diferenciada. */
  dif: number;
  difRotulo: string | null;
  lat: number | null;
  lng: number | null;
  matriculas: number | null;
  transporte: number | null;
  /** `[ND, branca, preta, parda, amarela, indígena]`. */
  racas: number[] | null;
  // ── resultado ─────────────────────────────────────────────────────────
  ai: EtapaEscola | null;
  af: EtapaEscola | null;
  // ── contexto ──────────────────────────────────────────────────────────
  inse: number | null;
  inseNivel: number | null;
  inseAlunos: number | null;
  icg: number | null;
  tdiFund: number | null;
  aprovacaoFund: number | null;
  abandonoFund: number | null;
  docentesAdequadosFund: number | null;
  // ── derivados ─────────────────────────────────────────────────────────
  sinais: SinalEscola[];
}

export interface CoberturaDossie {
  /** Escolas na rede municipal ativa — o denominador de tudo. */
  total: number;
  comNome: number;
  comIdeb: number;
  comInse: number;
  comCoordenada: number;
  comMatricula: number;
}

export interface ResumoDossieEscolas {
  matriculas: number;
  /** Escolas com resultado retido por participação < 80% no Saeb. */
  retidasPorParticipacao: number;
  rurais: number;
  porDiferenciada: Record<number, number>;
  idebMedioAi: number | null;
  piorIdebAi: { nome: string | null; codigo: string; valor: number } | null;
  melhorIdebAi: { nome: string | null; codigo: string; valor: number } | null;
  maiorAbandono: { nome: string | null; codigo: string; valor: number } | null;
  maiorDistorcao: { nome: string | null; codigo: string; valor: number } | null;
  inseMedio: number | null;
  /** Escolas que vão abaixo da mediana da rede tendo INSE acima da mediana. */
  abaixoDoEsperado: number;
  /** Escolas com aprovação de 100% — fluxo no teto, que infla o IDEB. */
  aprovacaoIntegral: number;
}

export interface DossieEscolas {
  fonte: string;
  anoTerritorio: number;
  anoIdeb: number | null;
  escolas: EscolaDossie[];
  cobertura: CoberturaDossie;
  resumo: ResumoDossieEscolas;
}

/** Limiar de abandono que vira sinal. Acima disso é fuga, não flutuação. */
const ABANDONO_ALTO = 3;
/** Distorção idade-série acima da qual a rede tem problema de fluxo instalado. */
const DISTORCAO_ALTA = 25;

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenado = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenado.length / 2);
  return ordenado.length % 2 === 0
    ? (ordenado[meio - 1] + ordenado[meio]) / 2
    : ordenado[meio];
}

/**
 * Sinais de cada escola.
 *
 * O mais interessante é `abaixo-do-esperado-para-o-contexto`: escola com IDEB
 * abaixo da mediana da própria rede **e** INSE acima da mediana. Ela tem
 * contexto socioeconômico melhor que a média das irmãs e ainda assim vai pior
 * — é onde a gestão pedagógica tem mais a ganhar, e é invisível num ranking
 * de IDEB puro, que só mostra as escolas pobres embaixo.
 */
function sinaisDaEscola(
  e: EscolaDossie,
  medianaIdebAi: number | null,
  medianaInse: number | null,
): SinalEscola[] {
  const sinais: SinalEscola[] = [];

  if (e.ai?.nd === true || e.af?.nd === true) sinais.push("sem-resultado-participacao");

  const ideb = e.ai?.ideb ?? null;
  if (
    ideb !== null &&
    medianaIdebAi !== null &&
    e.inse !== null &&
    medianaInse !== null &&
    ideb < medianaIdebAi &&
    e.inse > medianaInse
  ) {
    sinais.push("abaixo-do-esperado-para-o-contexto");
  }

  // O IDEB é fluxo × proficiência, e aprovação de 100% põe o fluxo no teto.
  // Não é fraude nem erro — é o mecanismo que faz rede que aprova todo mundo
  // subir o índice sem aprender mais, e ele precisa estar nomeado quando o
  // resultado da escola parecer bom demais. Em Ibateguara/AL as quatro escolas
  // com IDEB divulgado estão em 100% de aprovação, rendimento 1,000 e IDEB
  // entre 9,2 e 9,8 — contra 4,9 de média em Paulo Afonso e 6,3 em Manaus.
  if (e.ai?.aprovacao === 100 || e.af?.aprovacao === 100) sinais.push("aprovacao-integral");

  if (e.abandonoFund !== null && e.abandonoFund >= ABANDONO_ALTO) sinais.push("abandono-alto");
  if (e.tdiFund !== null && e.tdiFund >= DISTORCAO_ALTA) sinais.push("distorcao-alta");
  if (e.dif > 0) sinais.push("localizacao-diferenciada");
  if (e.lat === null || e.lng === null) sinais.push("sem-coordenada");

  return sinais;
}

/** Peso de ordenação: quanto menor, mais no topo do dossiê. */
function gravidade(e: EscolaDossie): number {
  if (e.sinais.includes("sem-resultado-participacao")) return 0;
  if (e.sinais.includes("abaixo-do-esperado-para-o-contexto")) return 1;
  if (e.sinais.includes("abandono-alto")) return 2;
  if (e.sinais.includes("distorcao-alta")) return 3;
  return 4;
}

export function montarDossieEscolas(codigoIBGE: string): DossieEscolas | null {
  const territorio = getEscolasTerritorio(codigoIBGE);
  if (!territorio || territorio.escolas.length === 0) return null;

  const ideb = getIdebEscolas(codigoIBGE);
  const indicadores = getIndicadoresEscolas(codigoIBGE);

  const porCodigoIdeb = new Map((ideb?.escolas ?? []).map((e) => [e.codigo, e]));
  const porCodigoInd = new Map((indicadores?.escolas ?? []).map((e) => [e.codigo, e]));

  const base: EscolaDossie[] = territorio.escolas.map((t) => {
    const i = porCodigoIdeb.get(t.codigo) ?? null;
    const n = porCodigoInd.get(t.codigo) ?? null;
    return {
      codigo: t.codigo,
      nome: i?.nome ?? n?.nome ?? null,
      rural: t.rural,
      dif: t.dif,
      difRotulo: t.dif > 0 ? ROTULOS_DIFERENCIADA[t.dif] ?? null : null,
      lat: t.lat,
      lng: t.lng,
      matriculas: t.matriculas,
      transporte: t.transporte,
      racas: t.racas,
      ai: i?.ai ?? null,
      af: i?.af ?? null,
      inse: n?.inse ?? null,
      inseNivel: n?.inseNivel ?? null,
      inseAlunos: n?.inseAlunos ?? null,
      icg: n?.icg ?? null,
      tdiFund: n?.tdiFund ?? null,
      aprovacaoFund: n?.aprovacaoFund ?? null,
      abandonoFund: n?.abandonoFund ?? null,
      docentesAdequadosFund: n?.docentesAdequadosFund ?? null,
      sinais: [],
    };
  });

  // As medianas são da própria rede — a comparação que importa ao secretário é
  // entre as escolas dele, não contra uma referência nacional que ele não
  // controla.
  const medianaIdebAi = mediana(
    base.map((e) => e.ai?.ideb).filter((v): v is number => v !== null && v !== undefined),
  );
  const medianaInse = mediana(
    base.map((e) => e.inse).filter((v): v is number => v !== null),
  );

  for (const e of base) e.sinais = sinaisDaEscola(e, medianaIdebAi, medianaInse);

  const escolas = [...base].sort((a, b) => {
    const g = gravidade(a) - gravidade(b);
    if (g !== 0) return g;
    const ia = a.ai?.ideb ?? Number.POSITIVE_INFINITY;
    const ib = b.ai?.ideb ?? Number.POSITIVE_INFINITY;
    if (ia !== ib) return ia - ib;
    return (a.nome ?? a.codigo).localeCompare(b.nome ?? b.codigo, "pt-BR");
  });

  const extremo = (
    pegar: (e: EscolaDossie) => number | null,
    modo: "max" | "min",
  ) => {
    const comDado = escolas.filter((e) => pegar(e) !== null);
    if (comDado.length === 0) return null;
    const alvo = comDado.reduce((melhor, e) =>
      modo === "max"
        ? (pegar(e) as number) > (pegar(melhor) as number)
          ? e
          : melhor
        : (pegar(e) as number) < (pegar(melhor) as number)
          ? e
          : melhor,
    );
    return { nome: alvo.nome, codigo: alvo.codigo, valor: pegar(alvo) as number };
  };

  const porDiferenciada: Record<number, number> = {};
  for (const e of escolas) {
    if (e.dif > 0) porDiferenciada[e.dif] = (porDiferenciada[e.dif] ?? 0) + 1;
  }

  const idebs = escolas
    .map((e) => e.ai?.ideb)
    .filter((v): v is number => v !== null && v !== undefined);

  return {
    fonte: territorio.fonte,
    anoTerritorio: territorio.ano,
    anoIdeb: ideb?.ano ?? null,
    escolas,
    cobertura: {
      total: escolas.length,
      comNome: escolas.filter((e) => e.nome !== null).length,
      comIdeb: escolas.filter((e) => e.ai?.ideb != null || e.af?.ideb != null).length,
      comInse: escolas.filter((e) => e.inse !== null).length,
      comCoordenada: escolas.filter((e) => e.lat !== null && e.lng !== null).length,
      comMatricula: escolas.filter((e) => e.matriculas !== null).length,
    },
    resumo: {
      matriculas: escolas.reduce((t, e) => t + (e.matriculas ?? 0), 0),
      retidasPorParticipacao: escolas.filter((e) => e.sinais.includes("sem-resultado-participacao")).length,
      rurais: escolas.filter((e) => e.rural).length,
      porDiferenciada,
      idebMedioAi: idebs.length
        ? Math.round((idebs.reduce((t, v) => t + v, 0) / idebs.length) * 10) / 10
        : null,
      piorIdebAi: extremo((e) => e.ai?.ideb ?? null, "min"),
      melhorIdebAi: extremo((e) => e.ai?.ideb ?? null, "max"),
      maiorAbandono: extremo((e) => e.abandonoFund, "max"),
      maiorDistorcao: extremo((e) => e.tdiFund, "max"),
      inseMedio: medianaInse,
      abaixoDoEsperado: escolas.filter((e) => e.sinais.includes("abaixo-do-esperado-para-o-contexto")).length,
      aprovacaoIntegral: escolas.filter((e) => e.sinais.includes("aprovacao-integral")).length,
    },
  };
}
