/**
 * Bloco Emprego do Perfil Municipal.
 *
 * Duas fontes, dois recortes complementares:
 *
 * - **Fluxo mensal** (admissões/desligamentos) vem do Novo CAGED publicado pelo
 *   IPEADATA. É o dado que responde "o município está criando ou perdendo
 *   emprego formal agora".
 * - **Estoque anual** (quantos vínculos existem, em que setores, a que salário)
 *   vem do CEMPRE/IBGE via SIDRA. Responde "qual é o tamanho e a cara do
 *   mercado formal".
 *
 * ## De onde vem o fluxo mensal: snapshot local, rede como fallback
 *
 * A API OData do IPEADATA **ignora `$filter`, `$top` e `$select`**: qualquer
 * requisição a uma série devolve os 5,6 mil municípios × todos os meses —
 * ~58 MB e ~33 s por série, e são duas séries. Não existe endpoint por
 * município. (Medido em 28/07/2026: `?$top=5` devolve os mesmos 58,45 MB.)
 *
 * Cache de memória sozinho não resolve, porque morre a cada restart do
 * processo — e no Cloud Run, com scale-to-zero, isso é a cada cold start. O
 * cache de fetch do Next também não ajuda: respostas acima de 2 MB não são
 * cacheáveis.
 *
 * Por isso o recorte municipal das duas séries é gerado offline por
 * `scripts/dados/gerar-caged-municipios.mjs` e versionado em
 * `data/caged-municipios.json` (~1 MB). A leitura é local e instantânea.
 *
 * A rede continua no código como fallback para quando o snapshot não existe —
 * um clone sem `npm run dados:caged`, por exemplo. O cache de módulo segue
 * valendo para os dois caminhos.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  type BlocoEmprego,
  type FalhaColeta,
  type Indicador,
  type SaldoMensalEmprego,
  fetchJson,
  indicador,
  semDado,
} from "./types";

const BLOCO = "emprego";

/** O IPEADATA publica o CAGED em duas versões; esta é a "sem ajuste" (só o
 *  arquivo de movimentações). A versão ajustada, que incorpora declarações
 *  fora do prazo, dá outros números — o rótulo precisa dizer qual foi usada,
 *  senão o valor não é reproduzível. */
const FONTE_CAGED = "Novo CAGED (série sem ajuste), via IPEADATA";
const FONTE_CEMPRE = "IBGE — Cadastro Central de Empresas (CEMPRE), via SIDRA";

const SERIE_ADMISSOES = "ADMISNC";
const SERIE_DESLIGAMENTOS = "DESLIGNC";
const ODATA_IPEADATA = "https://www.ipeadata.gov.br/api/odata4/ValoresSerie";
const URL_ADMISSOES = `${ODATA_IPEADATA}(SERCODIGO='${SERIE_ADMISSOES}')`;
const URL_DESLIGAMENTOS = `${ODATA_IPEADATA}(SERCODIGO='${SERIE_DESLIGAMENTOS}')`;

/** Download de ~61 MB por série: o timeout padrão de 15 s do `fetchJson` não
 *  cobre. Esta é a única chamada do bloco que merece essa folga. */
const TIMEOUT_IPEADATA_MS = 60_000;
const TIMEOUT_SIDRA_MS = 15_000;

/** Estoque agregado (t/9509) e estoque por seção CNAE (t/9510). A t/1685, que
 *  aparece em material antigo, foi encerrada em 2021 — não usar. */
const TABELA_CEMPRE = "9509";
const TABELA_CEMPRE_CNAE = "9510";
/** "Pessoal ocupado assalariado" — melhor proxy de vínculos formais. O
 *  "Pessoal ocupado total" (v/707) inclui sócios e proprietários sem vínculo. */
const VAR_PESSOAL_ASSALARIADO = "708";
/** "Salário médio mensal", já expresso em salários mínimos pelo próprio IBGE. */
const VAR_SALARIO_MEDIO_SM = "1606";
/** Classificação CNAE 2.0 dentro da t/9510. */
const CLASSIFICACAO_CNAE = "c12762";

const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

// ---------------------------------------------------------------------------
// IPEADATA — índice nacional em cache
// ---------------------------------------------------------------------------

interface RegistroIpeadata {
  SERCODIGO: string;
  VALDATA: string;
  VALVALOR: number | null;
  NIVNOME: string;
  TERCODIGO: string;
}

interface RespostaIpeadata {
  value: RegistroIpeadata[];
}

interface MovimentoMensal {
  admissoes: number;
  desligamentos: number;
}

/** código IBGE (7 dígitos) → competência "AAAA-MM" → movimento do mês. */
type IndiceCaged = Map<string, Map<string, MovimentoMensal>>;

function indexarSerie(
  destino: IndiceCaged,
  registros: RegistroIpeadata[],
  campo: keyof MovimentoMensal,
): void {
  for (const registro of registros) {
    // A série mistura níveis territoriais: junto dos municípios vêm Brasil,
    // Regiões, Estados e Áreas metropolitanas (~3,2 mil linhas). Sem este
    // filtro, o TERCODIGO de uma UF ("29") entraria no índice como se fosse
    // município — e o de área metropolitana (8 dígitos) idem.
    if (registro.NIVNOME !== "Municípios") continue;

    const valor = registro.VALVALOR;
    if (valor === null || !Number.isFinite(valor)) continue;

    // VALDATA vem com fuso: "2026-05-01T00:00:00-03:00". Passar por `new Date`
    // e ler o mês desloca a competência num runtime UTC (o dia 1 às 00:00 −03
    // é dia 1 às 03:00Z hoje, mas a regra deixa de valer se o IPEADATA mudar o
    // offset). A competência é o prefixo literal da string, sem conversão.
    const competencia = registro.VALDATA.slice(0, 7);

    let meses = destino.get(registro.TERCODIGO);
    if (!meses) {
      meses = new Map();
      destino.set(registro.TERCODIGO, meses);
    }

    let movimento = meses.get(competencia);
    if (!movimento) {
      movimento = { admissoes: 0, desligamentos: 0 };
      meses.set(competencia, movimento);
    }

    // VALVALOR chega como float (262.0) mesmo sendo contagem de pessoas.
    movimento[campo] = Math.round(valor);
  }
}

// ---------------------------------------------------------------------------
// Snapshot local (caminho normal)
// ---------------------------------------------------------------------------

const ARQUIVO_SNAPSHOT = join("data", "caged-municipios.json");

/** O IPEADATA publica o CAGED com ~2 meses de defasagem. Além disso, um
 *  snapshot atrasado indica que `npm run dados:caged` não roda há tempo. */
const MESES_ATE_AVISAR_DESATUALIZACAO = 4;

interface SnapshotCaged {
  geradoEm: string;
  competencias: string[];
  /** Alinhado a `competencias`; `null` = mês sem publicação para o município. */
  municipios: Record<string, Array<[number, number] | null>>;
}

function mesesEntre(competencia: string, referencia: Date): number {
  const ano = Number(competencia.slice(0, 4));
  const mes = Number(competencia.slice(5, 7));
  if (!Number.isFinite(ano) || !Number.isFinite(mes)) return 0;
  return (referencia.getFullYear() - ano) * 12 + (referencia.getMonth() + 1 - mes);
}

/**
 * Devolve `null` — e não lança — em qualquer problema: snapshot ausente,
 * ilegível ou fora de formato cai no caminho de rede. Uma exceção aqui
 * derrubaria o bloco Emprego inteiro por causa de um arquivo, quando a fonte
 * original continua acessível.
 */
function lerSnapshotCaged(): IndiceCaged | null {
  let snapshot: SnapshotCaged;
  try {
    snapshot = JSON.parse(readFileSync(join(process.cwd(), ARQUIVO_SNAPSHOT), "utf8"));
  } catch {
    return null;
  }

  if (!Array.isArray(snapshot.competencias) || typeof snapshot.municipios !== "object") {
    return null;
  }

  const indice: IndiceCaged = new Map();
  for (const [codigoIbge, linha] of Object.entries(snapshot.municipios ?? {})) {
    if (!Array.isArray(linha)) continue;
    const meses = new Map<string, MovimentoMensal>();

    linha.forEach((movimento, posicao) => {
      const competencia = snapshot.competencias[posicao];
      if (!competencia || !Array.isArray(movimento)) return;
      meses.set(competencia, { admissoes: movimento[0], desligamentos: movimento[1] });
    });

    if (meses.size > 0) indice.set(codigoIbge, meses);
  }

  if (indice.size === 0) return null;

  const ultima = snapshot.competencias[snapshot.competencias.length - 1];
  const atraso = ultima ? mesesEntre(ultima, new Date()) : 0;
  if (atraso > MESES_ATE_AVISAR_DESATUALIZACAO) {
    // Aviso, não erro: o relatório continua honesto porque rotula a janela e o
    // ano que efetivamente usou. O que se perde é atualidade, e quem opera
    // precisa ver isso no log.
    console.warn(
      `[caged] snapshot local vai até ${ultima} (${atraso} meses atrás). ` +
        `Rode "npm run dados:caged" para atualizar.`,
    );
  }

  return indice;
}

// ---------------------------------------------------------------------------
// Cache de módulo
// ---------------------------------------------------------------------------

const cacheCaged = new Map<string, Promise<IndiceCaged>>();

function carregarIndiceCaged(): Promise<IndiceCaged> {
  const chave = `${SERIE_ADMISSOES}|${SERIE_DESLIGAMENTOS}`;
  const emCache = cacheCaged.get(chave);
  if (emCache) return emCache;

  const promessa = (async () => {
    const local = lerSnapshotCaged();
    if (local) return local;

    console.warn(
      `[caged] ${ARQUIVO_SNAPSHOT} ausente — baixando ~117 MB do IPEADATA. ` +
        `Rode "npm run dados:caged" para evitar esta espera.`,
    );

    // `Promise.all` em vez de dois `await` em sequência por dois motivos: corta
    // o tempo pela metade (a rede é o gargalo) e, principalmente, anexa o
    // handler de rejeição às duas promises no mesmo tick — com `await` em
    // série, a segunda série falhando durante os ~30 s da primeira viraria
    // unhandled rejection, que derruba o processo no Node ≥ 15.
    const [admissoes, desligamentos] = await Promise.all([
      fetchJson<RespostaIpeadata>(URL_ADMISSOES, { timeoutMs: TIMEOUT_IPEADATA_MS }),
      fetchJson<RespostaIpeadata>(URL_DESLIGAMENTOS, { timeoutMs: TIMEOUT_IPEADATA_MS }),
    ]);

    const indice: IndiceCaged = new Map();
    indexarSerie(indice, admissoes.value, "admissoes");
    indexarSerie(indice, desligamentos.value, "desligamentos");
    return indice;
  })();

  // Uma falha de rede não pode envenenar o cache: sem isto, o primeiro
  // relatório que pegasse o IPEADATA fora do ar condenaria todos os seguintes
  // do mesmo processo a nunca mais terem série.
  promessa.catch(() => {
    if (cacheCaged.get(chave) === promessa) cacheCaged.delete(chave);
  });

  cacheCaged.set(chave, promessa);
  return promessa;
}

// ---------------------------------------------------------------------------
// SIDRA — leitura de células
// ---------------------------------------------------------------------------

type LinhaSidra = Record<string, string>;

type ValorSidra =
  | { tipo: "numero"; valor: number }
  /** Célula suprimida por sigilo estatístico. */
  | { tipo: "sigilo" }
  | { tipo: "ausente" };

/**
 * O SIDRA sinaliza ausência com marcadores textuais, não com `null`. O perigo
 * está em `Number("X")` → `NaN`, que numa soma ou formatação desatenta vira
 * zero e transforma "o IBGE não pode revelar" em "não existe emprego aqui".
 * Por isso os marcadores são testados antes de qualquer conversão.
 */
function lerValorSidra(bruto: string | null | undefined): ValorSidra {
  if (bruto === undefined || bruto === null) return { tipo: "ausente" };
  const texto = bruto.trim();

  // "X": o IBGE omite para não individualizar a empresa. A atividade existe no
  // município — o que falta é o número, e isso é diferente de zero.
  if (texto === "X") return { tipo: "sigilo" };
  // "-" é zero absoluto (não resultante de arredondamento): número de verdade.
  if (texto === "-") return { tipo: "numero", valor: 0 };
  // "..." = não disponível; ".." = não se aplica.
  if (texto === "" || texto === ".." || texto === "...") return { tipo: "ausente" };

  const numero = Number(texto);
  return Number.isFinite(numero) ? { tipo: "numero", valor: numero } : { tipo: "ausente" };
}

/** SIDRA devolve a linha 0 como cabeçalho descritivo; os dados começam em 1. */
function linhasDados(resposta: LinhaSidra[]): LinhaSidra[] {
  return Array.isArray(resposta) ? resposta.slice(1) : [];
}

/** Lê uma variável da t/9509 e a converte em indicador com procedência. */
function indicadorCempre(linhas: LinhaSidra[], variavel: string, url: string): Indicador {
  const linha = linhas.find((candidata) => candidata.D2C === variavel);
  const valor = lerValorSidra(linha?.V);
  if (valor.tipo !== "numero") {
    return semDado({ status: "fechado", fonte: FONTE_CEMPRE, url });
  }

  // D3C é o "Ano (Código)" da célula. A vintage do CEMPRE avança todo ano;
  // fixar 2024 no código faria o relatório mentir na virada.
  const ano = Number(linha?.D3C);
  return indicador(valor.valor, {
    ano: Number.isFinite(ano) ? ano : null,
    status: "fechado",
    fonte: FONTE_CEMPRE,
    url,
  });
}

/**
 * Na t/9510 as seções CNAE (letra + nome) convivem com as divisões (dois
 * dígitos + nome) e com a linha "Total" na mesma lista de 109 categorias. Só a
 * seção interessa ao relatório; somar tudo contaria cada vínculo três vezes.
 */
const RE_SECAO_CNAE = /^([A-Z]) (.+)$/;

// ---------------------------------------------------------------------------
// Montagem do bloco
// ---------------------------------------------------------------------------

function descreverJanela(mesesJanela: string[]): string {
  if (mesesJanela.length === 0) return "";
  const primeiro = MESES_PT[Number(mesesJanela[0]) - 1] ?? "";
  const ultimo = MESES_PT[Number(mesesJanela[mesesJanela.length - 1]) - 1] ?? "";
  if (!primeiro || !ultimo) return "";
  return primeiro === ultimo ? primeiro : `${primeiro} a ${ultimo}`;
}

/**
 * Soma o saldo de `ano` restrito aos meses de `mesesJanela`. É o que torna a
 * comparação honesta: janeiro–maio de um ano contra janeiro–maio do outro,
 * nunca contra o ano cheio (em Senhor do Bonfim, 2025 fechou +333, mas o
 * janeiro–maio comparável é −10).
 *
 * Devolve `null` quando nenhum dos meses existe no ano pedido — ausência de
 * dado, que não pode virar "saldo zero".
 */
function acumularJanela(
  meses: Map<string, MovimentoMensal>,
  ano: number,
  mesesJanela: string[],
): number | null {
  let soma = 0;
  let encontrou = false;
  for (const mes of mesesJanela) {
    const movimento = meses.get(`${ano}-${mes}`);
    if (!movimento) continue;
    soma += movimento.admissoes - movimento.desligamentos;
    encontrou = true;
  }
  return encontrou ? soma : null;
}

function motivoDaFalha(erro: unknown): string {
  if (erro instanceof Error) {
    // O AbortController do `fetchJson` rejeita com AbortError e uma mensagem
    // genérica; no relatório, "tempo limite excedido" diz muito mais.
    if (erro.name === "AbortError" || erro.name === "TimeoutError") {
      return "tempo limite excedido";
    }
    return erro.message || erro.name;
  }
  return String(erro);
}

export async function coletarEmprego(params: {
  codigoIbge: string;
  uf: string;
  municipio: string;
}): Promise<{ bloco: BlocoEmprego | null; falhas: FalhaColeta[] }> {
  // Tanto o SIDRA quanto o TERCODIGO do IPEADATA usam os 7 dígitos (o corte
  // para 6 é coisa do DATASUS); aqui só limpamos formatação vinda do cadastro.
  const codigoIbge = params.codigoIbge.replace(/\D/g, "");
  const falhas: FalhaColeta[] = [];

  const urlAgregado = `https://apisidra.ibge.gov.br/values/t/${TABELA_CEMPRE}/n6/${codigoIbge}/v/${VAR_PESSOAL_ASSALARIADO},${VAR_SALARIO_MEDIO_SM}/p/last`;
  const urlSetores = `https://apisidra.ibge.gov.br/values/t/${TABELA_CEMPRE_CNAE}/n6/${codigoIbge}/v/${VAR_PESSOAL_ASSALARIADO}/p/last/${CLASSIFICACAO_CNAE}/all`;

  // As três coletas são independentes: uma fonte fora do ar não pode levar as
  // outras junto, daí `allSettled` em vez de `all`.
  const [resCaged, resAgregado, resSetores] = await Promise.allSettled([
    carregarIndiceCaged(),
    fetchJson<LinhaSidra[]>(urlAgregado, { timeoutMs: TIMEOUT_SIDRA_MS }),
    fetchJson<LinhaSidra[]>(urlSetores, { timeoutMs: TIMEOUT_SIDRA_MS }),
  ]);

  if (resCaged.status === "rejected") {
    falhas.push({ bloco: BLOCO, fonte: FONTE_CAGED, motivo: motivoDaFalha(resCaged.reason) });
  }
  if (resAgregado.status === "rejected") {
    falhas.push({
      bloco: BLOCO,
      fonte: `${FONTE_CEMPRE} (tabela ${TABELA_CEMPRE})`,
      motivo: motivoDaFalha(resAgregado.reason),
    });
  }
  if (resSetores.status === "rejected") {
    falhas.push({
      bloco: BLOCO,
      fonte: `${FONTE_CEMPRE} (tabela ${TABELA_CEMPRE_CNAE})`,
      motivo: motivoDaFalha(resSetores.reason),
    });
  }

  // Nada respondeu: não há bloco a montar, e imprimir uma grade de nulos seria
  // pior do que dizer que a seção não pôde ser levantada.
  if (
    resCaged.status === "rejected" &&
    resAgregado.status === "rejected" &&
    resSetores.status === "rejected"
  ) {
    return { bloco: null, falhas };
  }

  // -------------------------------------------------------------------------
  // Fluxo mensal (IPEADATA)
  // -------------------------------------------------------------------------
  const serie: SaldoMensalEmprego[] = [];
  let janela = "";
  let saldoAcumuladoAtual = semDado<number>({
    status: "em_execucao",
    fonte: FONTE_CAGED,
    url: URL_ADMISSOES,
  });
  let saldoAcumuladoAnterior = semDado<number>({
    status: "fechado",
    fonte: FONTE_CAGED,
    url: URL_ADMISSOES,
  });

  if (resCaged.status === "fulfilled") {
    // Município ausente do índice (recém-criado, por exemplo): a fonte
    // respondeu e não tem o dado — série vazia, sem falha registrada.
    const meses = resCaged.value.get(codigoIbge) ?? new Map<string, MovimentoMensal>();
    // "AAAA-MM" ordena lexicograficamente na mesma ordem cronológica: comparar
    // as strings basta, não há data a construir.
    const entradas = [...meses.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    if (entradas.length > 0) {
      // O ano corrente vem do dado, não do relógio. Rodar o relatório em
      // janeiro, antes de o IPEADATA publicar a primeira competência do ano
      // novo, devolveria série vazia se usássemos `new Date()`.
      const anoAtual = Number(entradas[entradas.length - 1][0].slice(0, 4));
      const anoAnterior = anoAtual - 1;
      const mesesJanela: string[] = [];

      for (const [competencia, movimento] of entradas) {
        const ano = Number(competencia.slice(0, 4));
        if (ano !== anoAtual && ano !== anoAnterior) continue;
        serie.push({
          competencia,
          admissoes: movimento.admissoes,
          desligamentos: movimento.desligamentos,
          saldo: movimento.admissoes - movimento.desligamentos,
        });
        // A janela de comparação é o conjunto de meses já publicados do ano
        // corrente; é ela que recorta o ano anterior mais adiante.
        if (ano === anoAtual) mesesJanela.push(competencia.slice(5));
      }

      janela = descreverJanela(mesesJanela);

      const acumuladoAnterior = acumularJanela(meses, anoAnterior, mesesJanela);

      // Ano corrente é parcial por definição — "em_execucao" impede que o
      // template compare esse número com um exercício fechado.
      saldoAcumuladoAtual = indicador(acumularJanela(meses, anoAtual, mesesJanela), {
        ano: anoAtual,
        status: "em_execucao",
        fonte: FONTE_CAGED,
        url: URL_ADMISSOES,
      });
      saldoAcumuladoAnterior = indicador(acumuladoAnterior, {
        ano: acumuladoAnterior === null ? null : anoAnterior,
        status: "fechado",
        fonte: FONTE_CAGED,
        url: URL_ADMISSOES,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Estoque anual (CEMPRE t/9509)
  // -------------------------------------------------------------------------
  let estoqueVinculos = semDado<number>({
    status: "fechado",
    fonte: FONTE_CEMPRE,
    url: urlAgregado,
  });
  let salarioMedioSalariosMinimos = semDado<number>({
    status: "fechado",
    fonte: FONTE_CEMPRE,
    url: urlAgregado,
  });

  if (resAgregado.status === "fulfilled") {
    const linhas = linhasDados(resAgregado.value);
    estoqueVinculos = indicadorCempre(linhas, VAR_PESSOAL_ASSALARIADO, urlAgregado);
    salarioMedioSalariosMinimos = indicadorCempre(linhas, VAR_SALARIO_MEDIO_SM, urlAgregado);
  }

  // -------------------------------------------------------------------------
  // Estoque por seção CNAE (CEMPRE t/9510)
  // -------------------------------------------------------------------------
  const setores: Array<{ nome: string; vinculos: number | null }> = [];

  if (resSetores.status === "fulfilled") {
    for (const linha of linhasDados(resSetores.value)) {
      const secao = RE_SECAO_CNAE.exec(linha.D4N ?? "");
      if (!secao) continue; // divisões de dois dígitos e a linha "Total"

      const valor = lerValorSidra(linha.V);
      // Seção sem nenhum vínculo, ou não publicada para este município, fica de
      // fora: linha de zero em relatório é ruído. Já o sigilo entra com
      // `vinculos: null` — a atividade existe, e o leitor precisa saber que o
      // número foi omitido, não que ele é zero.
      if (valor.tipo === "ausente") continue;
      if (valor.tipo === "numero" && valor.valor === 0) continue;

      setores.push({
        // O nome oficial do IBGE vem prefixado pela letra da seção
        // ("G Comércio; ..."); a letra é jargão CNAE e não ajuda o leitor do
        // relatório. O resto do rótulo fica literal, sem encurtamento nosso.
        nome: secao[2],
        vinculos: valor.tipo === "numero" ? valor.valor : null,
      });
    }

    // Maior primeiro; as seções sob sigilo vão para o fim, já que não há como
    // posicioná-las na ordem de grandeza.
    setores.sort((a, b) => (b.vinculos ?? -1) - (a.vinculos ?? -1));
  }

  return {
    bloco: {
      saldoAcumuladoAtual,
      saldoAcumuladoAnterior,
      janela,
      serie,
      estoqueVinculos,
      setores,
      salarioMedioSalariosMinimos,
    },
    falhas,
  };
}
