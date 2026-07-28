/**
 * Bloco Saneamento — Censo Demográfico 2022 (IBGE), via API SIDRA v3.
 *
 * Três tabelas cobrem os três eixos por domicílio: 6805 (esgotamento
 * sanitário), 6803 (abastecimento de água) e 6892 (destino do lixo). É a mesma
 * infraestrutura `servicodados.ibge.gov.br` que o resto do projeto já consome:
 * sem chave, sem sessão, JSON limpo.
 *
 * Por que Censo e não SNIS: a Série Histórica do SNIS não é API — o host antigo
 * (app4.mdr.gov.br) sumiu e todos os controllers de consulta do host novo
 * respondem HTTP 500. O que resta do SNIS é bulk XLSX, que exige job offline de
 * consolidação e não cabe no caminho de geração do PDF.
 *
 * Ressalva que o relatório precisa carregar: o Censo é declaratório do morador
 * e conta rede PLUVIAL como esgotamento, então a cobertura de esgoto aqui é
 * estruturalmente maior que o índice de atendimento do prestador (em Senhor do
 * Bonfim, 63,25% no Censo contra 5,82% no SNIS-AE 2022 da EMBASA). Os dois
 * números estão certos; medem coisas diferentes.
 */

import {
  fetchJson,
  indicador,
  semDado,
  type BlocoSaneamento,
  type FalhaColeta,
  type Fatia,
  type Indicador,
} from "./types";

const BLOCO = "saneamento";

/** Censo é decenal: dado estrutural, não fechamento de exercício. */
const ANO_CENSO = 2022;
const FONTE_CENSO = "IBGE — Censo Demográfico 2022";

/** Domicílios particulares permanentes ocupados, contagem absoluta. */
const VAR_ABSOLUTO = "381";
/**
 * Mesma contagem em % do total geral. O IBGE já calcula e publica esse
 * percentual; dividir 381 pelo total na mão diverge do número impresso na
 * tabela por arredondamento. Usamos o do IBGE para o relatório ser conferível.
 */
const VAR_PERCENTUAL = "1000381";

const TIMEOUT_MS = 12_000;

interface Categoria {
  readonly id: string;
  /** Fallback caso a categoria não venha na resposta; o rótulo do IBGE tem precedência. */
  readonly rotulo: string;
}

interface EspecTabela {
  readonly agregado: string;
  readonly classificacao: string;
  /** Id da categoria "Total" dentro da classificação. */
  readonly idTotal: string;
  /**
   * Somente categorias de nível 1 — mutuamente exclusivas, somam 100%. Cada
   * classificação também expõe nível 2 (ex.: 72110 "Rede geral ou pluvial" e
   * 72111 "Fossa séptica ligada à rede" subdividem 46290); pedir os dois níveis
   * juntos faria o detalhe somar ~200%.
   */
  readonly categorias: readonly Categoria[];
  /** Página pública da tabela — é ela que vai para o rodapé do PDF, não a URL da API. */
  readonly url: string;
  /** Identificação da tabela no registro de falhas. */
  readonly rotuloFonte: string;
}

const TABELA_ESGOTO: EspecTabela = {
  agregado: "6805",
  classificacao: "11558",
  idTotal: "46292",
  categorias: [
    { id: "46290", rotulo: "Rede geral, rede pluvial ou fossa ligada à rede" },
    { id: "72112", rotulo: "Fossa séptica ou fossa filtro não ligada à rede" },
    { id: "72113", rotulo: "Fossa rudimentar ou buraco" },
    { id: "92858", rotulo: "Vala" },
    { id: "72114", rotulo: "Rio, lago, córrego ou mar" },
    { id: "72115", rotulo: "Outra forma" },
    { id: "92861", rotulo: "Não tinham banheiro nem sanitário" },
  ],
  url: "https://sidra.ibge.gov.br/tabela/6805",
  rotuloFonte: "IBGE/SIDRA — tabela 6805 (esgotamento sanitário)",
};

const TABELA_AGUA: EspecTabela = {
  agregado: "6803",
  classificacao: "1821",
  idTotal: "72129",
  categorias: [
    { id: "72144", rotulo: "Possui ligação à rede geral e a utiliza como forma principal" },
    { id: "72145", rotulo: "Possui ligação à rede geral, mas utiliza principalmente outra forma" },
    { id: "72153", rotulo: "Não possui ligação com a rede geral" },
  ],
  url: "https://sidra.ibge.gov.br/tabela/6803",
  rotuloFonte: "IBGE/SIDRA — tabela 6803 (abastecimento de água)",
};

const TABELA_LIXO: EspecTabela = {
  agregado: "6892",
  classificacao: "67",
  idTotal: "10972",
  categorias: [
    { id: "2520", rotulo: "Coletado" },
    { id: "72122", rotulo: "Queimado na propriedade" },
    { id: "72123", rotulo: "Enterrado na propriedade" },
    { id: "72124", rotulo: "Jogado em terreno baldio, encosta ou área pública" },
    { id: "1091", rotulo: "Outro destino" },
  ],
  url: "https://sidra.ibge.gov.br/tabela/6892",
  rotuloFonte: "IBGE/SIDRA — tabela 6892 (destino do lixo)",
};

// Categorias-chave promovidas a indicador-resumo do bloco.
const ESGOTO_REDE_GERAL = "46290";
const ESGOTO_FOSSA_RUDIMENTAR = "72113";
const ESGOTO_SEM_BANHEIRO = "92861";
const AGUA_REDE_GERAL = "72144";
const AGUA_SEM_REDE = "72153";
const LIXO_COLETADO = "2520";
const LIXO_QUEIMADO = "72122";
const LIXO_ENTERRADO = "72123";

const FONTE_SNIS = "SNIS — Diagnóstico de Resíduos Sólidos";
const URL_SNIS =
  "https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/snis/produtos-do-snis/diagnosticos";

// ---------------------------------------------------------------------------
// Resposta do SIDRA
// ---------------------------------------------------------------------------

interface SidraClassificacao {
  id?: string | number;
  nome?: string;
  /** Sempre um único par `{ idCategoria: rótulo }` por resultado. */
  categoria?: Record<string, string>;
}

interface SidraSerie {
  localidade?: { id?: string | number };
  /** `{ "2022": "26895" }` — o valor vem como string, inclusive os especiais. */
  serie?: Record<string, string>;
}

interface SidraResultado {
  classificacoes?: SidraClassificacao[];
  series?: SidraSerie[];
}

interface SidraVariavel {
  id?: string | number;
  variavel?: string;
  unidade?: string;
  resultados?: SidraResultado[];
}

/**
 * O SIDRA escreve `"-"` para zero absoluto. Ler isso como ausência faria o PDF
 * imprimir "sem dado" exatamente onde o Censo respondeu "nenhum domicílio" —
 * um erro caro num raio-X de saneamento. Já `".."`, `"..."` e `"X"` (omitido
 * por sigilo estatístico) são ausência de verdade e viram null.
 */
function numeroSidra(bruto: string | undefined): number | null {
  if (typeof bruto !== "string") return null;
  const texto = bruto.trim();
  if (texto === "-") return 0;
  if (texto === "") return null;
  const n = Number(texto);
  return Number.isFinite(n) ? n : null;
}

/** Achata uma variável da resposta em `idCategoria -> { rótulo, valor }`. */
function indexarCategorias(
  payload: SidraVariavel[],
  variavelId: string,
  classificacaoId: string,
  codigoIbge: string,
): Map<string, { rotulo: string; valor: number | null }> {
  const saida = new Map<string, { rotulo: string; valor: number | null }>();
  const variavel = payload.find((v) => String(v?.id) === variavelId);
  if (!variavel) return saida;

  for (const resultado of variavel.resultados ?? []) {
    const classificacao = (resultado.classificacoes ?? []).find(
      (c) => String(c?.id) === classificacaoId,
    );
    if (!classificacao?.categoria) continue;

    // Filtra pela localidade pedida: se um dia a consulta trouxer mais de um
    // município, casar pelo índice 0 misturaria dados de cidades diferentes.
    const serie = (resultado.series ?? []).find(
      (s) => String(s?.localidade?.id) === codigoIbge,
    );
    if (!serie) continue;

    const valor = numeroSidra(serie.serie?.[String(ANO_CENSO)]);
    for (const [idCategoria, rotulo] of Object.entries(classificacao.categoria)) {
      saida.set(idCategoria, { rotulo, valor });
    }
  }
  return saida;
}

interface Leitura {
  total: number | null;
  /** Indexado por id de categoria, para os indicadores-resumo. */
  fatias: Record<string, Fatia | undefined>;
  /** Mesmas fatias na ordem de exibição da tabela. */
  detalhe: Fatia[];
}

async function lerTabela(spec: EspecTabela, codigoIbge: string): Promise<Leitura> {
  const ids = [spec.idTotal, ...spec.categorias.map((c) => c.id)].join(",");
  // Colchetes e barra vertical vão percent-encodados de propósito: dependendo
  // do agente HTTP eles são reescritos (ou não) na serialização da URL, e o
  // SIDRA responde 500 quando chegam quebrados. Encodar aqui torna a chamada
  // idêntica em Node, Edge runtime e curl.
  const url =
    `https://servicodados.ibge.gov.br/api/v3/agregados/${spec.agregado}` +
    `/periodos/${ANO_CENSO}` +
    `/variaveis/${VAR_ABSOLUTO}%7C${VAR_PERCENTUAL}` +
    `?localidades=N6%5B${codigoIbge}%5D` +
    `&classificacao=${spec.classificacao}%5B${ids}%5D`;

  const payload = await fetchJson<SidraVariavel[]>(url, { timeoutMs: TIMEOUT_MS });
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("SIDRA respondeu sem variáveis");
  }

  const absolutos = indexarCategorias(payload, VAR_ABSOLUTO, spec.classificacao, codigoIbge);
  const percentuais = indexarCategorias(payload, VAR_PERCENTUAL, spec.classificacao, codigoIbge);
  if (absolutos.size === 0 && percentuais.size === 0) {
    throw new Error(`SIDRA não retornou a localidade ${codigoIbge}`);
  }

  const detalhe: Fatia[] = spec.categorias.map(({ id, rotulo }) => ({
    // Prefere o rótulo vindo do IBGE: ele é reescrito entre edições (a tabela
    // 6803 já trocou "como principal" por "como forma principal") e o relatório
    // deve citar a redação corrente da fonte.
    rotulo: absolutos.get(id)?.rotulo ?? percentuais.get(id)?.rotulo ?? rotulo,
    domicilios: absolutos.get(id)?.valor ?? null,
    percentual: percentuais.get(id)?.valor ?? null,
  }));

  return {
    total: absolutos.get(spec.idTotal)?.valor ?? null,
    fatias: Object.fromEntries(spec.categorias.map((c, i) => [c.id, detalhe[i]])),
    detalhe,
  };
}

// ---------------------------------------------------------------------------
// Montagem do bloco
// ---------------------------------------------------------------------------

function ausente(spec: EspecTabela): Indicador {
  return semDado({ status: "estrutural", fonte: FONTE_CENSO, url: spec.url });
}

/**
 * Os indicadores-resumo carregam o PERCENTUAL de domicílios — é o número que o
 * Raio-X imprime e o único comparável entre municípios de portes diferentes. A
 * contagem absoluta não se perde: continua em `detalhe[].domicilios`.
 */
function resumo(leitura: Leitura | null, idCategoria: string, spec: EspecTabela): Indicador {
  const percentual = leitura?.fatias[idCategoria]?.percentual;
  if (percentual === undefined || percentual === null) return ausente(spec);
  return indicador(percentual, {
    ano: ANO_CENSO,
    status: "estrutural",
    fonte: FONTE_CENSO,
    url: spec.url,
  });
}

/** Indicador-resumo que agrega categorias vizinhas (queimado + enterrado). */
function resumoSoma(leitura: Leitura | null, ids: string[], spec: EspecTabela): Indicador {
  const presentes = ids
    .map((id) => leitura?.fatias[id]?.percentual)
    .filter((v): v is number => typeof v === "number");
  if (presentes.length === 0) return ausente(spec);
  // Somar os percentuais do IBGE arrasta cauda binária (7.82 + 0.13 =
  // 7.949999...); o relatório imprime 2 casas, então arredonda na origem.
  const total = Math.round(presentes.reduce((a, b) => a + b, 0) * 100) / 100;
  return indicador(total, {
    ano: ANO_CENSO,
    status: "estrutural",
    fonte: FONTE_CENSO,
    url: spec.url,
  });
}

/** Traduz o erro de rede para uma linha que o relatório possa imprimir. */
function descreverErro(erro: unknown): string {
  if (!(erro instanceof Error)) return String(erro);
  // fetchJson aborta por timeout; "This operation was aborted" sozinho não
  // diz ao leitor do relatório que a fonte demorou demais.
  if (erro.name === "AbortError" || erro.name === "TimeoutError") {
    return `tempo esgotado após ${TIMEOUT_MS} ms`;
  }
  // O undici resume TODA queda de rede como "fetch failed" e esconde a razão
  // real em `cause` (ConnectTimeoutError, ENOTFOUND, certificado inválido...).
  // Sem desembrulhar, DNS morto e host lento viram a mesma linha inútil.
  const causa: unknown = erro.cause;
  if (causa instanceof Error && causa.message) return `${erro.message}: ${causa.message}`;
  return erro.message || erro.name;
}

function colher(
  resultado: PromiseSettledResult<Leitura>,
  spec: EspecTabela,
  falhas: FalhaColeta[],
): Leitura | null {
  if (resultado.status === "fulfilled") return resultado.value;
  falhas.push({ bloco: BLOCO, fonte: spec.rotuloFonte, motivo: descreverErro(resultado.reason) });
  return null;
}

export async function coletarSaneamento(params: {
  codigoIbge: string;
  uf: string;
  municipio: string;
}): Promise<{ bloco: BlocoSaneamento | null; falhas: FalhaColeta[] }> {
  const falhas: FalhaColeta[] = [];
  const codigoIbge = params.codigoIbge.replace(/\D/g, "");

  // O SIDRA usa o código de 7 dígitos (N6) e responde HTTP 500 — não lista
  // vazia — para código malformado. Barrar aqui evita três 500 inúteis e
  // devolve um motivo legível em vez de "HTTP 500" repetido.
  if (codigoIbge.length !== 7) {
    falhas.push({
      bloco: BLOCO,
      fonte: FONTE_CENSO,
      motivo: `código IBGE inválido: "${params.codigoIbge}" (esperado 7 dígitos)`,
    });
    return { bloco: null, falhas };
  }

  // As três tabelas são independentes; allSettled garante que uma fora do ar
  // não zere as outras duas.
  const [respostaEsgoto, respostaAgua, respostaLixo] = await Promise.allSettled([
    lerTabela(TABELA_ESGOTO, codigoIbge),
    lerTabela(TABELA_AGUA, codigoIbge),
    lerTabela(TABELA_LIXO, codigoIbge),
  ]);

  const esgoto = colher(respostaEsgoto, TABELA_ESGOTO, falhas);
  const agua = colher(respostaAgua, TABELA_AGUA, falhas);
  const lixo = colher(respostaLixo, TABELA_LIXO, falhas);

  // Nenhuma das três respondeu: devolver um bloco só de nulls faria o PDF
  // desenhar o quadro de saneamento vazio, como se o Censo não tivesse achado
  // nada no município. Null diz a verdade — a seção não pôde ser apurada.
  if (!esgoto && !agua && !lixo) return { bloco: null, falhas };

  // As três tabelas recortam o MESMO universo (domicílios particulares
  // permanentes ocupados), então o total é redundante entre elas: vale a
  // primeira que respondeu com número.
  let domiciliosTotal = ausente(TABELA_ESGOTO);
  for (const [leitura, spec] of [
    [esgoto, TABELA_ESGOTO],
    [agua, TABELA_AGUA],
    [lixo, TABELA_LIXO],
  ] as const) {
    if (leitura && leitura.total !== null) {
      domiciliosTotal = indicador(leitura.total, {
        ano: ANO_CENSO,
        status: "estrutural",
        fonte: FONTE_CENSO,
        url: spec.url,
      });
      break;
    }
  }

  const bloco: BlocoSaneamento = {
    domiciliosTotal,
    agua: {
      redeGeral: resumo(agua, AGUA_REDE_GERAL, TABELA_AGUA),
      semRede: resumo(agua, AGUA_SEM_REDE, TABELA_AGUA),
      detalhe: agua?.detalhe ?? [],
    },
    esgoto: {
      redeGeral: resumo(esgoto, ESGOTO_REDE_GERAL, TABELA_ESGOTO),
      fossaRudimentar: resumo(esgoto, ESGOTO_FOSSA_RUDIMENTAR, TABELA_ESGOTO),
      semBanheiro: resumo(esgoto, ESGOTO_SEM_BANHEIRO, TABELA_ESGOTO),
      detalhe: esgoto?.detalhe ?? [],
    },
    residuos: {
      coletado: resumo(lixo, LIXO_COLETADO, TABELA_LIXO),
      // Queima e enterro no lote são a mesma prática do ponto de vista do
      // diagnóstico (destinação no próprio domicílio, sem coleta), e o Censo
      // as separa. O resumo soma; o detalhe preserva as duas linhas.
      queimadoEnterrado: resumoSoma(lixo, [LIXO_QUEIMADO, LIXO_ENTERRADO], TABELA_LIXO),
      detalhe: lixo?.detalhe ?? [],
      // O Censo diz que o lixo é "coletado", nunca onde ele para. A única fonte
      // testada que afirma literalmente "Lixão" por município é a planilha
      // Unidades_Lixoes_Aterros do SNIS-RS, distribuída só como XLSX dentro de
      // ZIP (a Série Histórica, que seria consultável, responde HTTP 500).
      // Baixar e parsear 10 MB de XLSX no caminho de geração do PDF é
      // inaceitável: isso exige um job offline que consolide o diagnóstico num
      // índice por código IBGE. Até lá o campo é honestamente vazio — não é
      // falha de coleta, é dado que esta camada ainda não alcança.
      lixaoDeclarado: semDado<boolean>({
        status: "estrutural",
        fonte: FONTE_SNIS,
        url: URL_SNIS,
      }),
    },
  };

  return { bloco, falhas };
}
