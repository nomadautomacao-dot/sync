import bruto from "@/data/ibge/trabalho-infantil.json";

/**
 * Crianças e adolescentes ocupados na semana de referência — Censo 2022, por
 * município, nas duas faixas que o direito trata de forma diferente.
 *
 * ## Por que este dado está num dossiê de FUNDEB
 *
 * O elo não é financeiro, é de frequência. Criança que trabalha falta, chega
 * cansada, repete e sai — e o relatório já mede cada uma dessas coisas por
 * outra fonte: distorção idade-série e abandono por escola (INEP), crianças
 * beneficiárias do PBF que a escola não localizou (SICON), abstenção no ENEM.
 * O que faltava era a medida do outro lado da equação, e ela existe: o Censo
 * pergunta se a pessoa trabalhou na semana de referência, e publica a resposta
 * por município a partir dos 10 anos.
 *
 * A ligação entre ocupação e trajetória escolar é da literatura, não deste
 * relatório. As duas medições são independentes e o módulo **não afirma
 * causalidade** — coloca os dois números na mesma página e transforma o resto
 * em pergunta de campo.
 *
 * ## As duas faixas nunca viram um número só
 *
 * Somá-las produziria um "total de trabalho infantil" que confunde dois fatos
 * jurídicos distintos:
 *
 * - **10 a 13 anos** — não há hipótese legal de trabalho. A Constituição
 *   proíbe qualquer trabalho a menores de 16 anos, salvo na condição de
 *   aprendiz **a partir dos 14** (art. 7º, XXXIII). Abaixo de 14 não existe
 *   nem aprendizagem possível. É o número sem ambiguidade.
 * - **14 a 17 anos** — há trabalho lícito: aprendiz dos 14 aos 17, emprego
 *   regular a partir dos 16, sempre vedados o noturno, o perigoso, o insalubre
 *   e o que consta da Lista TIP (Decreto nº 6.481/2008). Ocupação nesta faixa
 *   **não é, por si, irregularidade** — e o módulo nunca a chama assim.
 *
 * Por isso não existe campo de total neste módulo. A ausência é intencional.
 *
 * ## O que o número não é
 *
 * **Não é contagem.** A nota 1 da tabela 10268 diz, literal: "Dados dos
 * resultados preliminares da amostra, estimados a partir de áreas de
 * ponderação preliminares." São estimativas expandidas do questionário da
 * amostra, ainda preliminares — o valor municipal pode mudar na divulgação
 * definitiva. `ressalva` carrega essa frase até o rodapé da página.
 *
 * **Não é teto, é piso.** Trabalho de criança é subdeclarado ao recenseador; e
 * a produção para o consumo do próprio domicílio (roça, criação, pesca) o IBGE
 * classifica como **não ocupado**, contando-a em tabela separada (10269). Em
 * município agrícola isso desloca para fora do número boa parte do que a
 * conversa de campo vai encontrar. Estimativa zero significa que a amostra não
 * encontrou, não que não existe — e `semOcupacaoEstimada` é nomeado assim de
 * propósito.
 *
 * **Não é ranking.** O módulo não ordena municípios, não calcula percentil e
 * não devolve posição. A régua é a taxa da UF e a do país no mesmo Censo, e
 * serve para dimensionar, não para classificar.
 *
 * ## O piso de comparação é nosso, não da fonte
 *
 * `comparacaoFragil` marca a faixa cuja estimativa é pequena demais para
 * sustentar a leitura "acima/abaixo da régua". **Não é teste de
 * significância** — o IBGE não publica coeficiente de variação para esta
 * tabela, então não há como calcular um. É um piso de legibilidade: com
 * expansão de amostra e áreas de ponderação preliminares, uma estimativa de
 * poucas dezenas se move mais que a distância que separa o município da régua.
 * Quem lê precisa saber que a comparação, ali, não decide nada.
 */

/**
 * Abaixo desta estimativa, a distância para a régua não sustenta leitura.
 * Critério de legibilidade adotado aqui, não parâmetro do IBGE — ver o
 * doc-comment acima.
 */
const PISO_COMPARACAO = 30;

/**
 * O par por faixa é `[populacao, ocupadas]`. O tipo é `number[]` e não a tupla
 * `[number, number]` de propósito: `resolveJsonModule` infere array simples do
 * literal, e uma tupla obrigaria a um cast por `unknown` que esconderia
 * qualquer mudança real de formato do arquivo. O tamanho é conferido em `par`.
 */
type ParFaixa = number[];

interface ArquivoTrabalho {
  fonte?: string;
  ressalva?: string;
  anoCenso?: number;
  tabela?: number;
  faixas?: Array<{ chave: string; rotulo: string }>;
  brasil?: Record<string, ParFaixa>;
  ufs?: Record<string, Record<string, ParFaixa>>;
  municipios?: Record<string, Record<string, ParFaixa>>;
}

export interface FaixaOcupacao {
  chave: string;
  rotulo: string;
  /** Pessoas da faixa no município (estimativa da amostra). */
  populacao: number;
  /** Ocupadas na semana de referência (estimativa da amostra). */
  ocupadas: number;
  /** Ocupadas sobre população da faixa, em %. */
  taxaPct: number | null;
  /** Mesma taxa na UF, mesmo Censo. */
  taxaUfPct: number | null;
  /** Mesma taxa no país, mesmo Censo. */
  taxaBrasilPct: number | null;
  /**
   * Posicionamento factual contra cada régua — só quando a leitura se
   * sustenta. As duas são independentes e frequentemente discordam: um
   * município pode estar acima do país e abaixo da própria UF. Quem escreve o
   * texto tem de ler as duas, sob pena de afirmar "acima" ao lado de um número
   * estadual maior.
   */
  acimaDaUf: boolean;
  acimaDoBrasil: boolean;
  /** Estimativa pequena demais para a comparação decidir algo. */
  comparacaoFragil: boolean;
  /**
   * Há hipótese legal de trabalho nesta faixa? Falso para 10 a 13 anos.
   * O template usa isto para escolher a moldura jurídica correta.
   */
  admiteTrabalhoLegal: boolean;
}

export interface TrabalhoInfantilMunicipio {
  fonte: string;
  ressalva: string;
  anoCenso: number;
  tabela: number;
  /** Na ordem do dataset: 10 a 13, depois 14 a 17. Nunca somadas. */
  faixas: FaixaOcupacao[];
  /** A faixa sem hipótese legal de trabalho — o número sem ambiguidade. */
  abaixoDaIdadeMinima: FaixaOcupacao | null;
  /** A faixa em que há trabalho lícito possível. */
  idadeDeAprendizagem: FaixaOcupacao | null;
  /** Nenhuma ocupação estimada em nenhuma faixa — a amostra não encontrou. */
  semOcupacaoEstimada: boolean;
}

const arquivo = bruto as ArquivoTrabalho;

/** Faixa sem hipótese legal de trabalho: menores de 14 anos. */
const FAIXA_ABAIXO_DA_IDADE_MINIMA = "f1013";

function taxa(populacao: number, ocupadas: number): number | null {
  if (!Number.isFinite(populacao) || populacao <= 0) return null;
  return Math.round((ocupadas / populacao) * 10_000) / 100;
}

function par(registro: Record<string, ParFaixa> | undefined, chave: string) {
  const valor = registro?.[chave];
  if (!Array.isArray(valor) || valor.length < 2) return null;
  const [populacao, ocupadas] = valor;
  if (!Number.isFinite(populacao) || !Number.isFinite(ocupadas)) return null;
  return { populacao, ocupadas };
}

/** A UF é os dois primeiros dígitos do código do município. */
function codigoUf(codigoIBGE: string): string {
  return codigoIBGE.slice(0, 2);
}

export function getTrabalhoInfantil(codigoIBGE: string): TrabalhoInfantilMunicipio | null {
  const digits = String(codigoIBGE ?? "").replace(/\D/g, "");
  const registro = arquivo.municipios?.[digits];
  if (!registro) return null;

  const catalogo = arquivo.faixas ?? [];
  const uf = arquivo.ufs?.[codigoUf(digits)];
  const pais = arquivo.brasil;

  const faixas: FaixaOcupacao[] = [];
  for (const { chave, rotulo } of catalogo) {
    const local = par(registro, chave);
    if (!local) continue;

    const taxaPct = taxa(local.populacao, local.ocupadas);
    const naUf = par(uf, chave);
    const noPais = par(pais, chave);
    const taxaUfPct = naUf ? taxa(naUf.populacao, naUf.ocupadas) : null;
    const taxaBrasilPct = noPais ? taxa(noPais.populacao, noPais.ocupadas) : null;
    const fragil = local.ocupadas < PISO_COMPARACAO;

    faixas.push({
      chave,
      rotulo,
      populacao: local.populacao,
      ocupadas: local.ocupadas,
      taxaPct,
      taxaUfPct,
      taxaBrasilPct,
      acimaDaUf: !fragil && taxaPct !== null && taxaUfPct !== null && taxaPct > taxaUfPct,
      acimaDoBrasil: !fragil && taxaPct !== null && taxaBrasilPct !== null && taxaPct > taxaBrasilPct,
      comparacaoFragil: fragil,
      admiteTrabalhoLegal: chave !== FAIXA_ABAIXO_DA_IDADE_MINIMA,
    });
  }

  if (faixas.length === 0) return null;

  return {
    fonte: arquivo.fonte ?? "IBGE — Censo Demográfico 2022 (SIDRA)",
    ressalva: arquivo.ressalva ?? "",
    anoCenso: arquivo.anoCenso ?? 2022,
    tabela: arquivo.tabela ?? 10268,
    faixas,
    abaixoDaIdadeMinima: faixas.find((f) => !f.admiteTrabalhoLegal) ?? null,
    idadeDeAprendizagem: faixas.find((f) => f.admiteTrabalhoLegal) ?? null,
    semOcupacaoEstimada: faixas.every((f) => f.ocupadas === 0),
  };
}
