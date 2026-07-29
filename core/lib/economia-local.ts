/**
 * Economia local — de onde o município ganha a vida, e o que isso faz com a
 * escola.
 *
 * Duas consultas vivas ao IBGE:
 *
 * - **PIB dos Municípios** (agregado 5938): valor adicionado bruto por setor.
 *   "Cidade de fazenda", "cidade de prefeitura" e "cidade de comércio" têm
 *   evasões diferentes — o VAB diz qual é o caso antes da primeira visita.
 * - **Censo 2022, alfabetização** (agregado 9543): a taxa municipal de 15+.
 *   Analfabetos são o mercado do EJA; cruzar com a matrícula EJA da rede
 *   dimensiona a demanda não atendida em pessoas.
 *
 * ## O custo de oportunidade, com número
 *
 * O exemplo clássico é a fazenda que paga bem e esvazia o EJA: quando o VAB é
 * dominado pela agropecuária e o salário de admissão do setor supera o que o
 * jovem espera ganhar concluindo os estudos, a evasão é decisão econômica —
 * e a resposta é calendário adaptado à safra e oferta noturna, não busca
 * ativa genérica. Esta página junta as peças; a leitura fica explícita.
 */

const BASE = "https://servicodados.ibge.gov.br/api/v3/agregados";

/** Variáveis do agregado 5938 (PIB dos Municípios). */
const VAB = {
  total: 498,
  agropecuaria: 513,
  industria: 517,
  servicos: 6575,
  administracao: 525,
} as const;

const VARIAVEL_ALFABETIZACAO = 2513; // taxa de alfabetização, agregado 9543

export interface EconomiaLocal {
  fonte: string;
  anoPib: number | null;
  /** Participação de cada setor no VAB, em % (soma ~100). */
  setores: {
    agropecuaria: number | null;
    industria: number | null;
    servicos: number | null;
    administracao: number | null;
  };
  /** Setor de maior participação. */
  setorDominante: "agropecuaria" | "industria" | "servicos" | "administracao" | null;
  /** Taxa de alfabetização 15+ (Censo 2022), em %. */
  taxaAlfabetizacao: number | null;
  /** Analfabetos 15+ estimados = população 15+ × (1 − taxa). */
  analfabetosEstimados: number | null;
  /**
   * Cultura de maior valor de produção na PAM — em economia de safra, é ela
   * que define o calendário que compete com a aula.
   */
  culturaDominante: { nome: string; participacaoPct: number | null; anoPam: number | null } | null;
}

/**
 * Puro: dado o valor da produção por cultura (PAM), acha a dominante e sua
 * participação. O erro caro seria somar o "Total" da própria PAM no
 * denominador e diluir todas as participações pela metade.
 */
export function montarCulturaDominante(
  valorPorCultura: Map<string, number>,
  anoPam: number | null,
): EconomiaLocal["culturaDominante"] {
  const culturas = [...valorPorCultura.entries()].filter(
    ([nome, valor]) => valor > 0 && !/^total/i.test(nome.trim()),
  );
  if (culturas.length === 0) return null;
  const soma = culturas.reduce((t, [, v]) => t + v, 0);
  const [nome, valor] = culturas.sort(([, a], [, b]) => b - a)[0];
  return {
    nome: nome.replace(/\s*\(.*?\)\s*$/, "").trim(),
    participacaoPct: soma > 0 ? Math.round((valor / soma) * 1000) / 10 : null,
    anoPam,
  };
}

/** Análise pura, testável com fixture. */
export function montarEconomia(
  vab: Partial<Record<keyof typeof VAB, number>>,
  anoPib: number | null,
  taxaAlfabetizacao: number | null,
  populacao15mais: number | null,
): EconomiaLocal {
  const total = vab.total ?? 0;
  const participacao = (valor: number | undefined) =>
    total > 0 && valor !== undefined ? Math.round((valor / total) * 1000) / 10 : null;

  const setores = {
    agropecuaria: participacao(vab.agropecuaria),
    industria: participacao(vab.industria),
    servicos: participacao(vab.servicos),
    administracao: participacao(vab.administracao),
  };

  const dominante = (Object.entries(setores) as Array<[keyof typeof setores, number | null]>)
    .filter(([, v]) => v !== null)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))[0]?.[0];

  return {
    fonte: "IBGE — PIB dos Municípios (agregado 5938) e Censo 2022 (alfabetização, agregado 9543)",
    anoPib,
    setores,
    setorDominante: dominante ?? null,
    taxaAlfabetizacao,
    analfabetosEstimados:
      taxaAlfabetizacao !== null && populacao15mais !== null && populacao15mais > 0
        ? Math.round(populacao15mais * (1 - taxaAlfabetizacao / 100))
        : null,
    culturaDominante: null,
  };
}

async function consultar(url: string): Promise<unknown> {
  const resposta = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resposta.ok) throw new Error(`IBGE HTTP ${resposta.status}`);
  return resposta.json();
}

type Agregado = Array<{
  id?: string;
  resultados?: Array<{ series?: Array<{ serie?: Record<string, string> }> }>;
}>;

export async function getEconomiaLocal(
  codigoIBGE: string,
  populacao15mais?: number | null,
): Promise<EconomiaLocal | null> {
  const digits = codigoIBGE.replace(/\D/g, "");
  if (digits.length !== 7) return null;

  try {
    const variaveis = Object.values(VAB).join("|");
    // O PIB municipal sai com ~2 anos de defasagem e o SIDRA devolve "..."
    // para ano ainda não publicado — pedir "-1" traria só reticências. A faixa
    // cobre a defasagem e o parser fica com o último ano numérico de verdade.
    const anoAtual = new Date().getFullYear();
    const faixa = Array.from({ length: 5 }, (_, i) => anoAtual - 5 + i).join("|");
    const [pibBruto, alfaBruto, pamBruto] = (await Promise.all([
      consultar(`${BASE}/5938/periodos/${faixa}/variaveis/${variaveis}?localidades=N6[${digits}]`),
      consultar(`${BASE}/9543/periodos/2022/variaveis/${VARIAVEL_ALFABETIZACAO}?localidades=N6[${digits}]`).catch(
        () => null,
      ),
      // PAM (agregado 5457): valor da produção por cultura — a safra que
      // compete com a aula tem nome. Falha não derruba o resto.
      consultar(`${BASE}/5457/periodos/${faixa}/variaveis/215?localidades=N6[${digits}]&classificacao=782[all]`).catch(
        () => null,
      ),
    ])) as [Agregado, Agregado | null, unknown];

    const vab: Partial<Record<keyof typeof VAB, number>> = {};
    let anoPib: number | null = null;
    for (const variavel of pibBruto ?? []) {
      const chave = (Object.entries(VAB) as Array<[keyof typeof VAB, number]>).find(
        ([, id]) => String(id) === String(variavel.id),
      )?.[0];
      const serie = variavel.resultados?.[0]?.series?.[0]?.serie ?? {};
      // Do ano mais recente para trás, pulando os "..." de ano não publicado.
      const publicado = Object.entries(serie)
        .filter(([, valor]) => Number.isFinite(Number(valor)))
        .sort(([a], [b]) => Number(b) - Number(a))[0];
      if (chave && publicado) {
        vab[chave] = Number(publicado[1]);
        anoPib = Number(publicado[0]);
      }
    }

    let taxa: number | null = null;
    const serieAlfa = alfaBruto?.[0]?.resultados?.[0]?.series?.[0]?.serie ?? {};
    const valorAlfa = Number(serieAlfa["2022"]);
    if (Number.isFinite(valorAlfa)) taxa = valorAlfa;

    if (vab.total === undefined && taxa === null) return null;

    // Valor por cultura no último ano publicado da PAM — duas passadas para
    // não misturar exercícios (toda cultura entra com o MESMO ano).
    const porCultura: Array<{ nome: string; ano: number; valor: number }> = [];
    const resultadosPam = (pamBruto as Agregado | null)?.[0]?.resultados ?? [];
    for (const resultado of resultadosPam as Array<{
      classificacoes?: Array<{ categoria?: Record<string, string> }>;
      series?: Array<{ serie?: Record<string, string> }>;
    }>) {
      const nome = Object.values(resultado.classificacoes?.[0]?.categoria ?? {})[0];
      const serie = resultado.series?.[0]?.serie ?? {};
      const publicado = Object.entries(serie)
        .filter(([, valor]) => Number.isFinite(Number(valor)) && Number(valor) > 0)
        .sort(([a], [b]) => Number(b) - Number(a))[0];
      if (nome && publicado) {
        porCultura.push({ nome, ano: Number(publicado[0]), valor: Number(publicado[1]) });
      }
    }
    const anoPam = porCultura.length ? Math.max(...porCultura.map((c) => c.ano)) : null;
    const valorPorCultura = new Map(
      porCultura.filter((c) => c.ano === anoPam).map((c) => [c.nome, c.valor]),
    );

    const economia = montarEconomia(vab, anoPib, taxa, populacao15mais ?? null);
    economia.culturaDominante = montarCulturaDominante(valorPorCultura, anoPam);
    return economia;
  } catch {
    // IBGE fora do ar: o bloco some do relatório em vez de derrubá-lo.
    return null;
  }
}
