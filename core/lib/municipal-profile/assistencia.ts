/**
 * Bloco "Assistência social" do Perfil Municipal — CadÚnico / Bolsa Família.
 *
 * Fonte principal: CECAD 2.0 (MDS/SAGI). Apesar do botão "Login" no topo da
 * ferramenta, o Painel e o TABCAD são públicos: respondem a POST simples com o
 * código IBGE, sem cookie, sem sessão e sem chave de API.
 *
 * Complemento: Censo 2022 pela API v3 do SIDRA, para o que o CadÚnico não
 * publica (renda domiciliar média) e como rede de segurança para a chefia
 * feminina, caso o TABCAD esteja fora do ar.
 *
 * O Portal da Transparência (api.portaldatransparencia.gov.br) ficou DE FORA de
 * propósito: exige o header `chave-api-dados`, e a chave só é emitida por um
 * cadastro manual no gov.br com selo Prata/Ouro e CAPTCHA. Depender dela
 * quebraria a autonomia da geração do Raio-X. O painel do CECAD já entrega
 * famílias beneficiárias, valor repassado e benefício médio do Bolsa Família,
 * que é o essencial do programa.
 */

import {
  fetchJson,
  indicador,
  percentual,
  semDado,
  type BlocoAssistencia,
  type FalhaColeta,
} from "@/core/lib/municipal-profile/types";

const BLOCO = "assistencia";

// Endpoints do CECAD 2.0. Ambos SÓ funcionam via POST — no painel a querystring
// é ignorada, e no TABCAD ela carrega apenas `p_tipo`.
const PAINEL_URL = "https://aplicacoes.cidadania.gov.br/sagi/cecad20/painel03.php";
const TABCAD_URL = "https://aplicacoes.cidadania.gov.br/sagi/cecad20/tab_cad_table.php";
const TABCAD_PAGINA = "https://aplicacoes.cidadania.gov.br/sagi/cecad20/tab_cad.php";

/**
 * O formulário do TABCAD posta `schema=semPBF` e o servidor resolve o apelido
 * para o dump mais recente (hoje `tab_cad_10072026`, no atributo `data-esquema`
 * do HTML da página). Fixar o nome datado quebraria a coleta todo mês; o
 * apelido é o que a própria ferramenta usa e não muda.
 */
const TABCAD_SCHEMA = "semPBF";

const SIDRA_V3 = "https://servicodados.ibge.gov.br/api/v3/agregados";
const ANO_CENSO = 2022;

const FONTE_CENSO_RENDA =
  "IBGE — Censo 2022, tabela 10295 (rendimento nominal médio mensal domiciliar per capita)";
const FONTE_CENSO_CHEFIA = "IBGE — Censo 2022, tabela 9879 (sexo da pessoa responsável pelo domicílio)";

// O TABCAD leva de 5 s a 13 s por consulta; o painel responde em menos de 1 s.
// Os limites abaixo cortam travamento, não lentidão normal.
const TIMEOUT_PAINEL_MS = 20_000;
const TIMEOUT_TABCAD_MS = 45_000;
const TIMEOUT_SIDRA_MS = 15_000;

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function fetchTexto(url: string, opts: { timeoutMs: number; init?: RequestInit }): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(url, {
      ...opts.init,
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
        // O nginx do MDS aceita UA de curl/node hoje, mas um UA identificável
        // evita bloqueio caso liguem filtro e facilita o rastreio do lado deles.
        "user-agent": "Mozilla/5.0 (compatible; SyncRaioX/1.0)",
        ...(opts.init?.headers ?? {}),
      },
      // Consulta é POST: Next não cacheia de qualquer forma. Explícito para não
      // restar dúvida de que o número do PDF é o do momento da geração.
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Parsing de HTML (o CECAD não tem saída JSON)
// ---------------------------------------------------------------------------

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (bruto, corpo: string) => {
    if (corpo.startsWith("#")) {
      const cod = corpo[1] === "x" || corpo[1] === "X" ? parseInt(corpo.slice(2), 16) : parseInt(corpo.slice(1), 10);
      // Fora do intervalo Unicode o fromCodePoint lança; entidade estranha vira
      // texto literal, que é inofensivo, em vez de derrubar a página inteira.
      return Number.isFinite(cod) && cod >= 0 && cod <= 0x10ffff ? String.fromCodePoint(cod) : bruto;
    }
    return ENTIDADES[corpo.toLowerCase()] ?? bruto;
  });
}

/** Achata o HTML na sequência de textos visíveis, um por elemento. */
function textoVisivel(html: string): string[] {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, "\n")
    .split("\n")
    .map((t) => decodificarEntidades(t).replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 0);
}

function semTags(html: string): string {
  return decodificarEntidades(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * Número em formato brasileiro: ponto separa milhar, vírgula separa decimal.
 * Aceita sujeira em volta ("13.959 (55%)" → 13959, "R$ 665,51" → 665.51).
 */
function numeroBr(texto: string | undefined): number | null {
  if (!texto) return null;
  const bruto = texto.match(/-?\d[\d.]*(?:,\d+)?/)?.[0];
  if (!bruto) return null;
  const n = Number(bruto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * O CECAD devolve HTTP 200 mesmo quando a consulta explode: para um código IBGE
 * desconhecido a página vem com `var_dump` de erro do PostgreSQL, zeros em todos
 * os campos e "nan%" nos percentuais. Estes marcadores não aparecem em nenhuma
 * página válida — por isso servem de sentinela antes de qualquer leitura.
 */
function pareceDumpDeErro(html: string): boolean {
  return /invalid input syntax|Fatal error|Parse error|Uncaught \w*Error/i.test(html);
}

// ---------------------------------------------------------------------------
// CECAD — Painel (painel03.php)
// ---------------------------------------------------------------------------

interface PainelCecad {
  /** Mês/ano de referência do dump, no formato MM/AAAA. */
  referencia: string;
  ano: number;
  familias: number | null;
  pessoas: number | null;
}

/**
 * Layout estável do painel: `<h3>Rótulo</h3><p>MM/AAAA</p><h5>Valor</h5>`.
 * Em vez de amarrar em classes CSS, procuro o rótulo exato na sequência de
 * textos visíveis e leio a referência e o número logo depois — assim um remendo
 * de markup não derruba a coleta.
 *
 * O casamento precisa ser exato: numa busca por substring "Pessoas Cadastradas"
 * também acertaria "Pessoas Cadastradas em Famílias", que são as quebras por
 * faixa de renda logo abaixo do total.
 */
function valorAposRotulo(tokens: string[], rotulo: string): { referencia: string | null; valor: number | null } {
  const i = tokens.indexOf(rotulo);
  if (i < 0) return { referencia: null, valor: null };

  let referencia: string | null = null;
  for (let j = i + 1; j < Math.min(i + 5, tokens.length); j += 1) {
    const t = tokens[j];
    // Todo token com barra é data de referência, nunca valor — sem isso uma
    // mudança no formato ("7/2026") faria o mês virar o número do indicador.
    // Só MM/AAAA conta como referência válida: na consulta vazia o CECAD
    // imprime "/" nessa posição, e é justamente isso que denuncia a falha.
    if (t.includes("/")) {
      if (/^\d{2}\/\d{4}$/.test(t)) referencia = t;
      continue;
    }
    const n = numeroBr(t);
    if (n !== null) return { referencia, valor: n };
  }
  return { referencia, valor: null };
}

function parsePainel(html: string): PainelCecad | null {
  if (pareceDumpDeErro(html)) return null;

  const tokens = textoVisivel(html);
  const familias = valorAposRotulo(tokens, "Famílias Cadastradas");
  const pessoas = valorAposRotulo(tokens, "Pessoas Cadastradas");

  // Sem MM/AAAA o painel não achou o município: ele renderiza exatamente a mesma
  // página, com "/" no lugar da referência e zero em tudo. Um zero legítimo
  // seria indistinguível da falha, então a referência é o critério de aceite.
  const referencia = familias.referencia ?? pessoas.referencia;
  if (!referencia) return null;

  const ano = Number(referencia.slice(3));
  if (!Number.isFinite(ano)) return null;

  return { referencia, ano, familias: familias.valor, pessoas: pessoas.valor };
}

async function buscarPainel(codigoIbge: string): Promise<PainelCecad | null> {
  const corpo = new URLSearchParams({
    // `p_ibge` é a UF (2 primeiros dígitos) e `mu_ibge` o município com 7
    // dígitos. Derivar a UF do próprio código evita divergência entre os dois.
    p_ibge: codigoIbge.slice(0, 2),
    mu_ibge: codigoIbge,
  });
  const html = await fetchTexto(PAINEL_URL, {
    timeoutMs: TIMEOUT_PAINEL_MS,
    init: { method: "POST", body: corpo },
  });
  return parsePainel(html);
}

// ---------------------------------------------------------------------------
// CECAD — TABCAD (tab_cad_table.php)
// ---------------------------------------------------------------------------

interface TabulacaoCecad {
  /** Referência por extenso, como o TABCAD imprime ("Julho 2026"). */
  referencia: string;
  ano: number | null;
  /**
   * Colunas na ordem em que a tabela as publica. É lista, e não mapa, porque a
   * leitura é sempre por padrão de rótulo (regex), nunca por chave exata.
   */
  colunas: Array<{ rotulo: string; valor: number }>;
  total: number;
}

function celulas(linha: string, tag: "th" | "td"): string[] {
  return [...linha.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) => semTags(m[1]));
}

/**
 * A tabela do TABCAD tem duas linhas de cabeçalho: a primeira com o nome da
 * variável (colspan) e a coluna TOTAL (rowspan), a segunda com os rótulos das
 * categorias. Depois vêm a linha do município e a linha TOTAL, idênticas quando
 * a consulta é de um município só.
 */
function parseTabcad(html: string): TabulacaoCecad | null {
  if (pareceDumpDeErro(html)) return null;

  // Município não reconhecido: o TABCAD devolve HTTP 200 com `<h2><b></b></h2>`
  // e zeros. Sem o nome da localidade não há o que confiar na tabela.
  const localidade = /<h2[^>]*>\s*<b>([\s\S]*?)<\/b>/i.exec(html)?.[1];
  if (!localidade || !semTags(localidade)) return null;

  const referencia = semTags(/Refer[êe]ncia:\s*<\/b>([^<]*)/i.exec(html)?.[1] ?? "");
  if (!referencia) return null;

  const tabela = /<table[^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1];
  if (!tabela) return null;

  const linhas = [...tabela.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);

  // Rótulos das categorias = última linha só de <th> antes da primeira com <td>.
  let rotulos: string[] = [];
  for (const linha of linhas) {
    if (/<td\b/i.test(linha)) break;
    const th = celulas(linha, "th").filter((t) => t.length > 0);
    if (th.length > 0) rotulos = th;
  }

  const linhaTotal = linhas.find((l) => /<td\b/i.test(l) && celulas(l, "th").some((t) => t.toUpperCase() === "TOTAL"));
  if (!linhaTotal || rotulos.length === 0) return null;

  const valores = celulas(linhaTotal, "td").map((t) => numeroBr(t));
  // A última célula é o total geral: o <th rowspan> "TOTAL" da primeira linha de
  // cabeçalho não entra em `rotulos`, então sobra exatamente uma coluna.
  if (valores.length !== rotulos.length + 1) return null;

  const total = valores[valores.length - 1];
  // Município válido nunca tem cadastro zerado; zero aqui é resposta vazia
  // disfarçada, e serviria de denominador quebrado adiante.
  if (total === null || total === 0) return null;

  const colunas: Array<{ rotulo: string; valor: number }> = [];
  rotulos.forEach((rotulo, i) => {
    const valor = valores[i];
    if (valor !== null) colunas.push({ rotulo, valor });
  });

  return { referencia, ano: numeroBr(referencia.match(/\d{4}/)?.[0]), colunas, total };
}

async function buscarTabcad(
  codigoIbge: string,
  variavel: string,
  filtros: Record<string, string> = {},
): Promise<TabulacaoCecad | null> {
  const corpo = new URLSearchParams({
    schema: TABCAD_SCHEMA,
    uf_ibge: codigoIbge.slice(0, 2),
    // Pegadinha: aqui o município vai em `p_ibge` — o inverso do painel03, onde
    // `p_ibge` é a UF. Mandar `mu_ibge` faz o TABCAD devolver o total do ESTADO
    // sem qualquer aviso, com HTTP 200.
    p_ibge: codigoIbge,
    var1: variavel,
    var2: "",
  });
  for (const [chave, valor] of Object.entries(filtros)) corpo.append(`filtros[${chave}][]`, valor);

  const html = await fetchTexto(`${TABCAD_URL}?p_tipo=absoluto`, {
    timeoutMs: TIMEOUT_TABCAD_MS,
    init: { method: "POST", body: corpo },
  });
  return parseTabcad(html);
}

function colunaPor(tab: TabulacaoCecad | null, teste: RegExp): number | null {
  return tab?.colunas.find((c) => teste.test(c.rotulo))?.valor ?? null;
}

// ---------------------------------------------------------------------------
// SIDRA — Censo 2022
// ---------------------------------------------------------------------------

interface SidraResultado {
  classificacoes?: Array<{ id?: string; nome?: string; categoria?: Record<string, string> }>;
  series?: Array<{ serie?: Record<string, string> }>;
}

interface SidraVariavel {
  id?: string;
  unidade?: string;
  resultados?: SidraResultado[];
}

/** O SIDRA usa "...", "-" e "X" para célula sem dado, e ponto decimal. */
function valorSidra(res: SidraResultado | undefined, ano: number): number | null {
  const bruto = res?.series?.[0]?.serie?.[String(ano)];
  if (!bruto || bruto === "..." || bruto === "-" || bruto === "X") return null;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : null;
}

/**
 * Tabela 10295 — rendimento nominal médio mensal domiciliar PER CAPITA.
 *
 * O Censo 2022 não publica renda média por domicílio/família em nível
 * municipal: as tabelas de 2010 que traziam isso (3562, 4009 e afins) não foram
 * repetidas, e Gini e massa de rendimento só existem de N3 para cima. Este per
 * capita é o valor mais próximo disponível, e o rótulo da fonte diz exatamente
 * o que ele é para não virar comparação indevida no PDF.
 *
 * Armadilha: o id da categoria "Total" muda de classificação para
 * classificação (sexo 2[6794], cor/raça 86[95251], idade 58[95253]). Errar o id
 * não gera erro HTTP — a API devolve "..." no lugar do número. Ids conferidos
 * em /agregados/10295/metadados.
 */
function urlCensoRenda(codigoIbge: string): string {
  return (
    `${SIDRA_V3}/10295/periodos/${ANO_CENSO}/variaveis/13431` +
    `?localidades=N6[${codigoIbge}]&classificacao=2[6794]|86[95251]|58[95253]`
  );
}

/**
 * Tabela 9879 — domicílios por sexo da pessoa responsável. Pedimos a
 * classificação 11561 inteira (`all`) e resolvemos "Mulheres" pelo nome, em vez
 * de fixar o id da categoria; as demais classificações vão travadas no "Total".
 */
function urlCensoChefia(codigoIbge: string): string {
  return (
    `${SIDRA_V3}/9879/periodos/${ANO_CENSO}/variaveis/800|1000800` +
    `?localidades=N6[${codigoIbge}]&classificacao=460[45902]|68[9902]|11561[all]|12237[104570]|11562[72593]`
  );
}

async function buscarCensoRenda(url: string): Promise<number | null> {
  const payload = await fetchJson<SidraVariavel[]>(url, { timeoutMs: TIMEOUT_SIDRA_MS });
  const variavel = Array.isArray(payload) ? payload.find((v) => v?.id === "13431") : undefined;
  return valorSidra(variavel?.resultados?.[0], ANO_CENSO);
}

async function buscarCensoChefiaFeminina(url: string): Promise<number | null> {
  const payload = await fetchJson<SidraVariavel[]>(url, { timeoutMs: TIMEOUT_SIDRA_MS });

  const porSexo = (idVariavel: string, sexo: string) => {
    const variavel = Array.isArray(payload) ? payload.find((v) => v?.id === idVariavel) : undefined;
    const resultado = variavel?.resultados?.find((r) => {
      const classificacao = r.classificacoes?.find((c) => c.id === "11561");
      return Object.values(classificacao?.categoria ?? {})[0] === sexo;
    });
    return valorSidra(resultado, ANO_CENSO);
  };

  // A própria API já calcula o percentual (variável 1000800); os absolutos
  // ficam de reserva caso o IBGE deixe de publicar a variável derivada.
  return porSexo("1000800", "Mulheres") ?? percentual(porSexo("800", "Mulheres"), porSexo("800", "Total"));
}

// ---------------------------------------------------------------------------
// Coletor
// ---------------------------------------------------------------------------

export async function coletarAssistencia(params: {
  codigoIbge: string;
  uf: string;
  municipio: string;
}): Promise<{ bloco: BlocoAssistencia | null; falhas: FalhaColeta[] }> {
  const falhas: FalhaColeta[] = [];

  // CECAD e SIDRA usam o código IBGE de 7 dígitos (o de 6 é coisa do DATASUS).
  // Sem os 7 dígitos não existe consulta possível em nenhuma das duas fontes.
  const codigoIbge = params.codigoIbge.replace(/\D/g, "");
  if (codigoIbge.length !== 7) {
    return {
      bloco: null,
      falhas: [{ bloco: BLOCO, fonte: "entrada", motivo: `código IBGE inválido: ${params.codigoIbge}` }],
    };
  }

  const urlRenda = urlCensoRenda(codigoIbge);
  const urlChefia = urlCensoChefia(codigoIbge);

  // Tudo em paralelo: as consultas são independentes e a mais lenta (TABCAD)
  // manda no tempo total. A chefia feminina do Censo é disparada sempre, mesmo
  // sendo só reserva do TABCAD — é um GET JSON barato e evita uma segunda ida à
  // rede, em série, justamente quando o CECAD está caindo.
  const [painel, rendaCadUnico, sexoResponsavel, rendaCenso, chefiaCenso] = await Promise.allSettled([
    buscarPainel(codigoIbge),
    buscarTabcad(codigoIbge, "fx_rfpc"),
    // Filtro de parentesco = 1 (pessoa responsável pela unidade familiar): sem
    // ele a tabulação conta todas as pessoas da família, não o RF.
    buscarTabcad(codigoIbge, "cod_sexo_pessoa", { cod_parentesco_rf_pessoa: "1" }),
    buscarCensoRenda(urlRenda),
    buscarCensoChefiaFeminina(urlChefia),
  ]);

  const registrar = (fonte: string, resultado: PromiseSettledResult<unknown>, semDados: string) => {
    if (resultado.status === "rejected") {
      const erro = resultado.reason;
      const motivo =
        erro instanceof Error
          ? erro.name === "AbortError" || erro.name === "TimeoutError"
            ? "timeout"
            : erro.message
          : String(erro);
      falhas.push({ bloco: BLOCO, fonte, motivo });
    } else if (resultado.value === null) {
      falhas.push({ bloco: BLOCO, fonte, motivo: semDados });
    }
  };

  registrar("MDS/CECAD 2.0 — Painel", painel, "resposta sem referência mensal (município não reconhecido)");
  registrar("MDS/CECAD 2.0 — TABCAD (faixa de renda)", rendaCadUnico, "tabulação vazia ou sem município");
  registrar("MDS/CECAD 2.0 — TABCAD (sexo do RF)", sexoResponsavel, "tabulação vazia ou sem município");
  registrar("IBGE/SIDRA — Censo 2022, tabela 10295", rendaCenso, "sem valor publicado para o município");
  registrar("IBGE/SIDRA — Censo 2022, tabela 9879", chefiaCenso, "sem valor publicado para o município");

  const dadosPainel = painel.status === "fulfilled" ? painel.value : null;
  const dadosRenda = rendaCadUnico.status === "fulfilled" ? rendaCadUnico.value : null;
  const dadosSexo = sexoResponsavel.status === "fulfilled" ? sexoResponsavel.value : null;
  const valorRendaCenso = rendaCenso.status === "fulfilled" ? rendaCenso.value : null;
  const valorChefiaCenso = chefiaCenso.status === "fulfilled" ? chefiaCenso.value : null;

  // Nenhuma fonte respondeu: melhor devolver bloco ausente do que uma casca de
  // indicadores nulos, que o template imprimiria como se fossem zero.
  if (!dadosPainel && !dadosRenda && !dadosSexo && valorRendaCenso === null && valorChefiaCenso === null) {
    return { bloco: null, falhas };
  }

  const fontePainel = dadosPainel
    ? `MDS/CECAD 2.0 — Cadastro Único (referência ${dadosPainel.referencia})`
    : "MDS/CECAD 2.0 — Cadastro Único";
  const fonteTabcad = (tab: TabulacaoCecad | null) =>
    tab
      ? `MDS/CECAD 2.0 — TABCAD, Cadastro Único (referência ${tab.referencia})`
      : "MDS/CECAD 2.0 — TABCAD, Cadastro Único";

  // Extrema pobreza no CadÚnico é a faixa "Pobreza 1" (renda familiar per capita
  // até R$ 109). O painel só publica "em situação de Pobreza", que soma Pobreza
  // 1 + Pobreza 2 (até R$ 218) — usar aquele número aqui inflaria o indicador em
  // cerca de 40%. O valor da linha de corte muda por decreto, então o rótulo é
  // casado pelo prefixo e não pelo "R$ 109".
  const extremaPobreza = colunaPor(dadosRenda, /^pobreza\s*1\b/i);
  const pctFemininoCadUnico = percentual(colunaPor(dadosSexo, /^feminino$/i), dadosSexo?.total ?? null);

  const bloco: BlocoAssistencia = {
    familiasCadastradas:
      dadosPainel && dadosPainel.familias !== null
        ? indicador(dadosPainel.familias, {
            ano: dadosPainel.ano,
            // O CadÚnico é reprocessado todo mês: o número é a fotografia do mês
            // corrente, nunca um exercício fechado.
            status: "em_execucao",
            fonte: fontePainel,
            url: PAINEL_URL,
          })
        : semDado<number>({ status: "em_execucao", fonte: fontePainel, url: PAINEL_URL }),

    pessoasCadastradas:
      dadosPainel && dadosPainel.pessoas !== null
        ? indicador(dadosPainel.pessoas, {
            ano: dadosPainel.ano,
            status: "em_execucao",
            fonte: fontePainel,
            url: PAINEL_URL,
          })
        : semDado<number>({ status: "em_execucao", fonte: fontePainel, url: PAINEL_URL }),

    extremaPobreza:
      extremaPobreza !== null
        ? indicador(extremaPobreza, {
            ano: dadosRenda?.ano ?? null,
            status: "em_execucao",
            fonte: `${fonteTabcad(dadosRenda)} — famílias na faixa de extrema pobreza`,
            url: TABCAD_PAGINA,
          })
        : semDado<number>({ status: "em_execucao", fonte: fonteTabcad(dadosRenda), url: TABCAD_PAGINA }),

    // CadÚnico primeiro (famílias, mensal); Censo como reserva (domicílios,
    // 2022). Universos diferentes, por isso a procedência viaja no indicador em
    // vez de os dois números serem tratados como intercambiáveis.
    responsavelFemininoPct:
      pctFemininoCadUnico !== null
        ? indicador(pctFemininoCadUnico, {
            ano: dadosSexo?.ano ?? null,
            status: "em_execucao",
            fonte: `${fonteTabcad(dadosSexo)} — responsáveis familiares do sexo feminino`,
            url: TABCAD_PAGINA,
          })
        : valorChefiaCenso !== null
          ? indicador(valorChefiaCenso, {
              ano: ANO_CENSO,
              status: "estrutural",
              fonte: FONTE_CENSO_CHEFIA,
              url: urlChefia,
            })
          : semDado<number>({ status: "em_execucao", fonte: fonteTabcad(dadosSexo), url: TABCAD_PAGINA }),

    rendaMediaFamiliar:
      valorRendaCenso !== null
        ? indicador(valorRendaCenso, {
            ano: ANO_CENSO,
            status: "estrutural",
            fonte: FONTE_CENSO_RENDA,
            url: urlRenda,
          })
        : semDado<number>({ status: "estrutural", fonte: FONTE_CENSO_RENDA, url: urlRenda }),
  };

  return { bloco, falhas };
}
