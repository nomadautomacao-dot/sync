/**
 * Estado nutricional das crianças em idade escolar — SISVAN / Ministério da
 * Saúde, consultado ao vivo na geração.
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * A merenda é política da secretaria de educação, e o PNAE tem regra dura:
 * cardápio aprovado por nutricionista e no mínimo 30% da compra vinda da
 * agricultura familiar. O que quase nunca chega à mesa da reunião é o
 * **resultado** dessa política — e ele existe, medido criança a criança pela
 * atenção primária e agregado por município no SISVAN.
 *
 * Os dois lados importam e apontam para intervenções opostas: magreza é
 * insegurança alimentar, e excesso de peso é ultraprocessado. Uma rede com um
 * quarto das crianças acima do peso não tem problema de quantidade de comida,
 * tem de composição do cardápio — e isso é decisão de licitação, não de verba.
 *
 * ## A ressalva que a página precisa imprimir
 *
 * O denominador do SISVAN **não é a rede escolar**: são as crianças que
 * passaram pela atenção primária e tiveram peso e altura registrados. Cobertura
 * baixa significa amostra, não retrato. Por isso a página compara o total
 * acompanhado com a matrícula da rede e diz a cobertura em voz alta.
 *
 * ## Armadilhas da fonte (custaram seis tentativas)
 *
 * O endpoint aceita POST sem captcha e sem sessão, mas erra em silêncio:
 * parâmetro errado devolve **HTTP 200 com a tabela vazia**, nunca um erro.
 *
 * - `coMunicipioIbge` é o código de **6 dígitos**, não o de 7 usado no resto
 *   do projeto.
 * - `CO_ESCOLARIDADE` e `CO_POVO_COMUNIDADE` são a string literal `TODOS`, não
 *   código numérico. Sem elas, tabela vazia.
 * - `nu_indice_ado` e `nu_idade_ges` precisam ir mesmo consultando criança.
 * - `nu_idade_fim` só aceita valor coerente com `nu_idade_inicio` (para
 *   início 5, o fim é 7 ou 10).
 *
 * As categorias mudam com a faixa etária: de 5 a 10 anos são magreza
 * acentuada, magreza, eutrofia, sobrepeso, obesidade e obesidade grave —
 * abaixo de 5 anos a fonte usa "risco de sobrepeso" no lugar de obesidade
 * grave. Esta lib consulta só a faixa escolar, então as seis são fixas.
 */

const URL_SISVAN = "https://sisaps.saude.gov.br/sisvan/relatoriopublico/estadonutricional";

/** Faixa escolar: de 5 anos a menos de 10. */
const IDADE_INICIO = "5";
const IDADE_FIM = "10";
/** 4 = IMC × Idade, o índice que separa magreza de excesso de peso. */
const INDICE_IMC_IDADE = "4";

export interface FaixaNutricional {
  magrezaAcentuada: number;
  magreza: number;
  eutrofia: number;
  sobrepeso: number;
  obesidade: number;
  obesidadeGrave: number;
  total: number;
  /** Magreza acentuada + magreza, em % do total. */
  magrezaPct: number | null;
  eutrofiaPct: number | null;
  /** Sobrepeso + obesidade + obesidade grave, em % do total. */
  excessoPesoPct: number | null;
}

export interface EstadoNutricionalMunicipio {
  fonte: string;
  ano: number;
  municipio: FaixaNutricional;
  /** Réguas que a própria resposta devolve, sem consulta extra. */
  estado: FaixaNutricional | null;
  regiao: FaixaNutricional | null;
  brasil: FaixaNutricional | null;
}

/** "2.487" → 2487; "3.2%" → 3.2; vazio ou traço → null. */
function numeroBR(bruto: string): number | null {
  const limpo = bruto.replace(/[%\s]/g, "").replace(/\./g, "").replace(",", ".");
  if (!limpo || limpo === "-") return null;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : null;
}

function umaCasa(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/**
 * Monta a faixa a partir das 13 células finais da linha: seis pares
 * (quantidade, %) seguidos do total. Os percentuais da fonte são
 * recalculados aqui — assim município, estado, região e Brasil saem na mesma
 * régua de arredondamento.
 */
function montarFaixa(celulas: string[]): FaixaNutricional | null {
  if (celulas.length < 13) return null;
  const cauda = celulas.slice(-13);
  const q = (i: number) => numeroBR(cauda[i * 2]) ?? 0;

  const magrezaAcentuada = q(0);
  const magreza = q(1);
  const eutrofia = q(2);
  const sobrepeso = q(3);
  const obesidade = q(4);
  const obesidadeGrave = q(5);
  const total = numeroBR(cauda[12]) ?? 0;
  if (total <= 0) return null;

  const pctDe = (parte: number) => umaCasa((parte / total) * 100);
  return {
    magrezaAcentuada,
    magreza,
    eutrofia,
    sobrepeso,
    obesidade,
    obesidadeGrave,
    total,
    magrezaPct: pctDe(magrezaAcentuada + magreza),
    eutrofiaPct: pctDe(eutrofia),
    excessoPesoPct: pctDe(sobrepeso + obesidade + obesidadeGrave),
  };
}

function celulasDaLinha(linha: string): string[] {
  return [...linha.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
    m[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim(),
  );
}

/**
 * Análise pura do HTML, separada da rede para ser testável com fixture.
 *
 * A linha do município é localizada pelo código IBGE de 6 dígitos, e não pela
 * posição: a fonte devolve também as linhas de total, e depender da ordem
 * quebraria no dia em que ela mudar.
 */
export function lerEstadoNutricional(
  html: string,
  codigoIbge6: string,
  ano: number,
): EstadoNutricionalMunicipio | null {
  const corpo = [...html.matchAll(/<tbody[^>]*>([\s\S]*?)<\/tbody>/g)]
    .map((m) => m[1])
    .join("");
  const linhas = [...corpo.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
    celulasDaLinha(m[1]),
  );

  const doMunicipio = linhas.find((c) => c.includes(codigoIbge6));
  const municipio = doMunicipio ? montarFaixa(doMunicipio) : null;
  // Sem a linha do município não há página: as réguas sozinhas não dizem nada
  // sobre a rede.
  if (!municipio) return null;

  const porRotulo = (padrao: RegExp) => {
    const linha = linhas.find((c) => c.some((x) => padrao.test(x)));
    return linha ? montarFaixa(linha) : null;
  };

  return {
    fonte: "Ministério da Saúde — SISVAN, estado nutricional (IMC × idade, 5 a 10 anos)",
    ano,
    municipio,
    estado: porRotulo(/^TOTAL ESTADO/i),
    regiao: porRotulo(/^TOTAL REGI/i),
    brasil: porRotulo(/^TOTAL BRASIL/i),
  };
}

/**
 * Corpo do POST. Exportado porque a ordem e a presença dos campos são o
 * contrato real da fonte — um teste guarda os quatro que causam tabela vazia.
 */
export function montarConsulta(codigoIbge6: string, ano: number): string {
  const uf = codigoIbge6.slice(0, 2);
  const campos: Array<[string, string]> = [
    ["tpRelatorio", "2"],
    ["coVisualizacao", "1"],
    ["nuAno", String(ano)],
    ["nuMes[]", "99"],
    ["tpFiltro", "M"],
    ["coRegiao", ""],
    ["coUfIbge", uf],
    ["coMunicipioIbge", codigoIbge6],
    ["noRegional", ""],
    ["st_cobertura", "99"],
    ["nu_ciclo_vida", "1"],
    ["nu_idade_inicio", IDADE_INICIO],
    ["nu_idade_fim", IDADE_FIM],
    ["nu_indice_cri", INDICE_IMC_IDADE],
    // Os quatro abaixo parecem supérfluos numa consulta de criança, mas sem
    // eles a fonte devolve a tabela vazia com HTTP 200.
    ["nu_indice_ado", "1"],
    ["nu_idade_ges", "99"],
    ["ds_sexo2", "1"],
    ["ds_raca_cor2", "99"],
    ["co_sistema_origem", "0"],
    ["CO_POVO_COMUNIDADE", "TODOS"],
    ["CO_ESCOLARIDADE", "TODOS"],
  ];
  return campos
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

export async function getEstadoNutricional(
  codigoIBGE: string,
  ano: number,
  fetcher: typeof fetch = fetch,
): Promise<EstadoNutricionalMunicipio | null> {
  const digits = codigoIBGE.replace(/\D/g, "");
  if (digits.length !== 7) return null;
  // O SISVAN usa o código sem o dígito verificador.
  const codigo6 = digits.slice(0, 6);

  try {
    const resposta = await fetcher(URL_SISVAN, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html",
      },
      body: montarConsulta(codigo6, ano),
      signal: AbortSignal.timeout(25_000),
    });
    if (!resposta.ok) return null;
    return lerEstadoNutricional(await resposta.text(), codigo6, ano);
  } catch {
    // Fonte viva fora do ar não derruba o relatório: o bloco degrada.
    return null;
  }
}
