import { getCorRacaHistorico, type CorRacaHistoricoAno, type CorRacaHistorico } from "./cor-raca-historico";
import { getEquidadeMunicipal, type EquidadeMunicipal } from "./inep-equidade";
import { getEquidadeTerritorial, type EquidadeTerritorial, type PovoTerritorial } from "./equidade-territorial";
import { getEscolasTerritorio, type ResumoTerritorio, ROTULOS_DIFERENCIADA } from "./escolas-territorio";
import { getAssentamentos, type AssentamentosMunicipio } from "./assentamentos-incra";
import { getCatalogoSegmentos } from "./fundeb-ponderacao";
import { getValorAlunoAno } from "./fundeb-valor-aluno";
import { getTerrasIndigenas, type TerrasIndigenasMunicipio } from "@/core/lib/terras-indigenas";
import { getTrabalhoInfantil, type TrabalhoInfantilMunicipio } from "@/core/lib/trabalho-infantil";
import {
  getCoberturaVacinal,
  getViolenciaInfantil,
  type CoberturaVacinalMunicipio,
  type ViolenciaInfantilMunicipio,
} from "@/core/lib/saude-escolar";
import { getSituacaoVaar, type SituacaoVaar } from "./fundeb-vaar";

/**
 * Dossiê da Equidade e dos Territórios.
 *
 * ## A regra que governa o documento inteiro
 *
 * Pertencimento étnico é **autodeclaração**. Este dossiê aponta lacuna de
 * **registro** e jamais afirma que alguém "é" indígena ou quilombola, nem
 * estima quantos "deveriam" se declarar. O que ele faz é medir a distância
 * entre contagens oficiais e transformá-la em pergunta de campo.
 *
 * A regra não é delicadeza: é precisão. O Censo Demográfico conta quem se
 * declarou ao recenseador; o Censo Escolar conta quem a escola registrou; a
 * Portaria conta a escola com localização diferenciada declarada. São três
 * perguntas diferentes, feitas a três respondentes diferentes, e nenhuma delas
 * é "quantas crianças indígenas existem aqui".
 *
 * ## A corrente de três elos
 *
 * ```
 * população do povo (IBGE, Censo 2022)
 *   → matrícula com cor/raça declarada (Censo Escolar)
 *     → matrícula no segmento ponderado (FNDE, fator 1,40 a 2,17)
 * ```
 *
 * Cada seta é uma perda possível, com causa distinta. **A segunda vira
 * dinheiro** — e é a que nenhuma análise de duas pontas enxerga, porque a
 * ponderação segue a **localização diferenciada da escola**, não a cor/raça do
 * aluno. Criança quilombola em escola urbana comum pondera como urbana comum,
 * e isso pode ser inteiramente legítimo: pode não haver oferta no território.
 */

/** Acima disto, a distribuição por cor/raça descreve o preenchimento. */
const LIMIAR_CADASTRO_FRAGIL = 33;
/** Variação de não declaração entre dois anos que denuncia mudança de cadastro. */
const SALTO_DE_CADASTRO = 5;
/**
 * População em idade escolar a partir da qual o povo ganha folha própria.
 *
 * O Censo devolve populações de uma ou duas pessoas — Paulo Afonso tem
 * população quilombola igual a **1**. Dedicar uma folha a isso não é rigor, é
 * ruído: a folha diria "1 pessoa, 0 matrículas" e ensinaria o leitor a pular a
 * seção. Povo abaixo do piso só aparece se já houver matrícula no segmento,
 * porque aí existe o que conferir.
 */
const POPULACAO_ESCOLAR_MINIMA = 30;

export type GrupoCorRaca = "naoDeclarada" | "branca" | "preta" | "parda" | "amarela" | "indigena";

export const ROTULO_GRUPO: Record<GrupoCorRaca, string> = {
  naoDeclarada: "Não declarada",
  branca: "Branca",
  preta: "Preta",
  parda: "Parda",
  amarela: "Amarela",
  indigena: "Indígena",
};

export interface AnoSerie extends CorRacaHistoricoAno {
  /** Participação de cada grupo no total do ano, em %. */
  pct: Record<GrupoCorRaca, number | null>;
  /** Variação da não declaração contra o ano anterior, em pontos. */
  variacaoNaoDeclarada: number | null;
  /**
   * `true` quando a não declaração saltou mais de 5 pontos contra o ano
   * anterior — em qualquer direção. Movimento desse tamanho em um ano não é
   * mudança demográfica: é a rede tendo mexido no preenchimento do campo, e
   * ler a série como composição sem notar isso inverte a conclusão.
   */
  mudouCadastro: boolean;
}

export interface SerieCorRaca {
  rede: "municipal" | "publica";
  rotulo: string;
  anos: AnoSerie[];
  /** Variação da não declaração entre o primeiro e o último ano, em pontos. */
  variacaoNaoDeclarada: number | null;
  /** Anos em que o cadastro mudou o suficiente para invalidar a comparação. */
  anosComMudanca: number[];
}

export interface EloDaCorrente {
  chave: "populacao" | "declaracao" | "ponderacao";
  rotulo: string;
  valor: number | null;
  fonte: string;
  /** O que a perda entre este elo e o anterior significaria. `null` no primeiro. */
  perda: string | null;
}

export interface CorrentePovo {
  povo: "quilombola" | "indigena";
  rotulo: string;
  territorial: PovoTerritorial;
  /** Matrículas com a cor/raça correspondente no Censo Escolar, quando existe. */
  declaradasNoCenso: number | null;
  elos: EloDaCorrente[];
  /** Matrículas no segmento ponderado que faltariam para igualar a declaração. */
  vaoDeclaracaoParaPonderacao: number | null;
  /** `vao × (fator mínimo do segmento − 1) × valor da equivalente`. Derivado. */
  valorDerivado: number | null;
  /** Perguntas de campo que a corrente produz, na ordem de quem responde. */
  perguntas: string[];
}

export interface CondicaoTerritorio {
  codigo: number;
  rotulo: string;
  escolas: number;
  /** Fator do segmento correspondente, quando a Portaria publica um. */
  fatorExemplo: number | null;
  nota: string;
}

export interface DossieEquidade {
  municipio: string;
  uf: string;
  historico: CorRacaHistorico | null;
  series: SerieCorRaca[];
  equidade: EquidadeMunicipal | null;
  territorial: EquidadeTerritorial | null;
  correntes: CorrentePovo[];
  territorio: ResumoTerritorio | null;
  condicoes: CondicaoTerritorio[];
  assentamentos: AssentamentosMunicipio | null;
  /**
   * Os quatro cruzamentos que o Raio-X já fazia e o dossiê não via. Todos
   * respondem à mesma pergunta que esta peça faz — quem fica de fora, e por
   * quê —, e nenhum exige coleta nova: os datasets já estão versionados.
   */
  aldeias: TerrasIndigenasMunicipio | null;
  trabalhoInfantil: TrabalhoInfantilMunicipio | null;
  vacinacao: CoberturaVacinalMunicipio | null;
  violencia: ViolenciaInfantilMunicipio | null;
  vaar: SituacaoVaar | null;
  anoCensoEscolar: number | null;
  ausencias: string[];
  resumo: {
    naoDeclaradaPct: number | null;
    cadastroFragil: boolean;
    negraPct: number | null;
    /** Diferença de participação negra entre a rede rural e a urbana, em pontos. */
    diferencaNegraRuralUrbana: number | null;
    /** Povos com sinal de conferência entre declaração e ponderação. */
    povosComSinal: number;
    /** Soma do valor derivado das correntes com vão. */
    valorDerivadoTotal: number | null;
    condicionalidadeIII: boolean | null;
  };
}

// ── série histórica ────────────────────────────────────────────────────────

const GRUPOS: GrupoCorRaca[] = ["naoDeclarada", "branca", "preta", "parda", "amarela", "indigena"];

/**
 * A série lida como **qualidade de cadastro antes de composição**.
 *
 * Uma queda súbita de "não declarada" entre dois anos não é mudança
 * demográfica: é a rede tendo preenchido o campo. Uma alta súbita de
 * "indígena" idem. Sem marcar isso, a leitura de tendência atribui à
 * população um movimento que foi do formulário.
 */
export function montarSerie(
  anos: CorRacaHistoricoAno[],
  rede: "municipal" | "publica",
): SerieCorRaca {
  const lista: AnoSerie[] = anos.map((ano, indice) => {
    const pct = Object.fromEntries(
      GRUPOS.map((g) => [g, ano.total > 0 ? Math.round((ano[g] / ano.total) * 1000) / 10 : null]),
    ) as Record<GrupoCorRaca, number | null>;

    const anterior = indice > 0 ? anos[indice - 1] : null;
    const pctAnterior =
      anterior && anterior.total > 0 ? (anterior.naoDeclarada / anterior.total) * 100 : null;
    const pctAtual = ano.total > 0 ? (ano.naoDeclarada / ano.total) * 100 : null;
    const variacao =
      pctAnterior !== null && pctAtual !== null
        ? Math.round((pctAtual - pctAnterior) * 10) / 10
        : null;

    return {
      ...ano,
      pct,
      variacaoNaoDeclarada: variacao,
      mudouCadastro: variacao !== null && Math.abs(variacao) > SALTO_DE_CADASTRO,
    };
  });

  const primeiro = lista[0];
  const ultimo = lista[lista.length - 1];

  return {
    rede,
    rotulo: rede === "municipal" ? "Rede municipal" : "Rede pública (federal, estadual e municipal)",
    anos: lista,
    variacaoNaoDeclarada:
      primeiro && ultimo && primeiro.pct.naoDeclarada !== null && ultimo.pct.naoDeclarada !== null
        ? Math.round((ultimo.pct.naoDeclarada - primeiro.pct.naoDeclarada) * 10) / 10
        : null,
    anosComMudanca: lista.filter((a) => a.mudouCadastro).map((a) => a.ano),
  };
}

// ── a corrente de três elos ────────────────────────────────────────────────

const PADRAO_SEGMENTO: Record<"quilombola" | "indigena", RegExp> = {
  quilombola: /Quilombola$/,
  indigena: /Indígena$/,
};

/**
 * Menor fator entre os segmentos do povo — o piso do que a condição vale.
 *
 * Usar o piso, e não o teto de 2,17, é a leitura conservadora: o teto supõe
 * creche integral, que a maior parte da matrícula não é.
 */
function fatorMinimoDoPovo(povo: "quilombola" | "indigena"): number | null {
  const fatores = getCatalogoSegmentos()
    .filter((s) => PADRAO_SEGMENTO[povo].test(s.nome) && s.fatorVaaf !== null)
    .map((s) => s.fatorVaaf as number);
  return fatores.length > 0 ? Math.min(...fatores) : null;
}

export function montarCorrente(
  povo: "quilombola" | "indigena",
  territorial: PovoTerritorial,
  declaradasNoCenso: number | null,
  valorPorEquivalente: number | null,
): CorrentePovo {
  const rotulo = povo === "quilombola" ? "Quilombola" : "Indígena";
  const fator = fatorMinimoDoPovo(povo);

  const elos: EloDaCorrente[] = [
    {
      chave: "populacao",
      rotulo: `População ${rotulo.toLowerCase()} de 0 a 14 anos`,
      valor: territorial.emIdadeEscolar,
      fonte: "IBGE — Censo Demográfico 2022, autodeclaração ao recenseador",
      perda: null,
    },
    {
      chave: "declaracao",
      rotulo: `Matrículas declaradas como ${rotulo.toLowerCase()} na rede municipal`,
      valor: declaradasNoCenso,
      fonte: "INEP — Censo Escolar, campo de cor/raça preenchido pela escola",
      perda:
        "Distância aqui pode ser criança fora da rede municipal — na estadual, na privada ou fora da escola — ou campo de cor/raça em branco na matrícula. As duas se separam olhando a taxa de não declaração da rede.",
    },
    {
      chave: "ponderacao",
      rotulo: `Matrículas no segmento ponderado ${rotulo.toLowerCase()} do FUNDEB`,
      valor: territorial.matriculasNosSegmentos,
      fonte: "FNDE — planilha de matrículas ponderadas, segue a localização da escola",
      perda:
        "Distância aqui é a que vira dinheiro. A ponderação segue a **localização diferenciada da escola**, não a cor/raça do aluno: criança declarada numa escola urbana comum pondera como urbana comum. Pode ser legítimo — pode não haver oferta no território — e pode ser campo não preenchido na coleta da escola.",
    },
  ];

  const vao =
    declaradasNoCenso !== null
      ? Math.max(0, declaradasNoCenso - territorial.matriculasNosSegmentos)
      : null;

  return {
    povo,
    rotulo,
    territorial,
    declaradasNoCenso,
    elos,
    vaoDeclaracaoParaPonderacao: vao,
    // O ganho por matrícula é o **acréscimo** do fator sobre a referência 1,00,
    // não o fator inteiro: a matrícula já pondera hoje, só que como urbana.
    valorDerivado:
      vao === null || fator === null || valorPorEquivalente === null
        ? null
        : vao * (fator - 1) * valorPorEquivalente,
    perguntas: [
      `Existe escola em território ${rotulo.toLowerCase()} neste município sem a localização diferenciada declarada no Censo? — responde-se escola a escola, na própria coleta.`,
      `As crianças declaradas ${rotulo.toLowerCase()}s estudam em escola do território ou em escola comum? — se em comum, a ponderação está correta e a pergunta passa a ser de oferta.`,
      "Quem preenche o campo de cor/raça na matrícula, e a família é consultada? — autodeclaração exige que alguém pergunte.",
    ],
  };
}

// ── territórios ────────────────────────────────────────────────────────────

const NOTA_CONDICAO: Record<number, string> = {
  1: "Assentamento segue o fator do campo: 15% acima do urbano na mesma etapa e jornada.",
  2: "Terra indígena pondera 40% acima do urbano — de 1,40 nos anos iniciais a 2,17 na creche integral.",
  3: "Remanescente de quilombo pondera igual à terra indígena: 40% acima do urbano na mesma etapa.",
  8: "Comunidade ribeirinha não tem segmento próprio na Portaria; entra pelo fator do campo, e o custo de transporte é fluvial.",
};

/** Segmento de referência para exibir o fator de cada condição. */
const SEGMENTO_EXEMPLO: Record<number, string> = {
  1: "Anos Iniciais Fundamental Campo",
  2: "Anos Iniciais Fundamental Indígena",
  3: "Anos Iniciais Fundamental Quilombola",
  8: "Anos Iniciais Fundamental Campo",
};

export function montarCondicoes(territorio: ResumoTerritorio | null): CondicaoTerritorio[] {
  if (!territorio) return [];
  const catalogo = getCatalogoSegmentos();

  return Object.entries(territorio.porDiferenciada)
    .map(([codigo, escolas]) => {
      const cod = Number(codigo);
      const nome = SEGMENTO_EXEMPLO[cod];
      return {
        codigo: cod,
        rotulo: ROTULOS_DIFERENCIADA[cod] ?? `localização diferenciada (código ${cod})`,
        escolas,
        fatorExemplo: nome ? (catalogo.find((s) => s.nome === nome)?.fatorVaaf ?? null) : null,
        nota: NOTA_CONDICAO[cod] ?? "Condição sem segmento próprio na Portaria de ponderação.",
      };
    })
    .sort((a, b) => b.escolas - a.escolas);
}

// ── montagem ───────────────────────────────────────────────────────────────

export async function montarDossieEquidade(
  codigoIBGE: string,
  municipio: string,
  uf: string,
): Promise<DossieEquidade> {
  const territorialRes = await Promise.allSettled([getEquidadeTerritorial(codigoIBGE)]);
  const territorial = territorialRes[0].status === "fulfilled" ? territorialRes[0].value : null;

  const historico = getCorRacaHistorico(codigoIBGE);
  const equidade = getEquidadeMunicipal(codigoIBGE);
  const escolas = getEscolasTerritorio(codigoIBGE);
  const territorio = escolas?.resumo ?? null;
  const assentamentos = getAssentamentos(codigoIBGE);
  const vaar = getSituacaoVaar(codigoIBGE);
  const aldeias = getTerrasIndigenas(codigoIBGE);
  const trabalhoInfantil = getTrabalhoInfantil(codigoIBGE);
  const vacinacao = getCoberturaVacinal(codigoIBGE);
  const violencia = getViolenciaInfantil(codigoIBGE);

  const valores = getValorAlunoAno(uf);
  const valorPorEquivalente =
    valores && valores.fundamentalParcialAnosIniciais > 0
      ? valores.fundamentalParcialAnosIniciais
      : null;

  const ausencias: string[] = [];
  if (!historico) {
    ausencias.push(
      "O município não consta na série histórica de cor/raça derivada dos microdados do Censo Escolar — a folha da série sai vazia.",
    );
  }
  if (!territorial) {
    ausencias.push(
      "As consultas de população quilombola e indígena ao IBGE (agregados 8176 e 8175 do Censo 2022) não responderam nesta emissão. Sem elas não há o primeiro elo da corrente.",
    );
  }
  if (!territorio) {
    ausencias.push(
      "Os microdados do Censo Escolar não trouxeram a rede municipal deste município — sem eles não há cor/raça por zona nem contagem de escolas por condição de território.",
    );
  }

  const series = historico
    ? [montarSerie(historico.municipal, "municipal"), montarSerie(historico.publica, "publica")]
    : [];

  // A declaração vem da contagem absoluta da rede, não do percentual: derivar
  // absoluto de percentual arredondado erra por dezenas em rede grande.
  const declaradaIndigena = territorio?.corRacaTotais?.indigena ?? null;

  const correntes: CorrentePovo[] = territorial
    ? [
        // Quilombola não tem contraparte no Censo Escolar: o campo de cor/raça
        // não distingue quilombola de parda ou preta. O elo do meio fica `null`
        // de propósito — inventar um número ali seria pior que a lacuna.
        montarCorrente("quilombola", territorial.quilombola, null, valorPorEquivalente),
        montarCorrente("indigena", territorial.indigena, declaradaIndigena, valorPorEquivalente),
      ].filter(
        (c) =>
          c.territorial.emIdadeEscolar >= POPULACAO_ESCOLAR_MINIMA ||
          c.territorial.matriculasNosSegmentos > 0,
      )
    : [];

  const zona = territorio?.corRaca ?? null;
  const diferencaNegra =
    zona && zona.rural.negraPct !== null && zona.urbana.negraPct !== null
      ? Math.round((zona.rural.negraPct - zona.urbana.negraPct) * 10) / 10
      : null;

  const derivados = correntes
    .map((c) => c.valorDerivado)
    .filter((v): v is number => v !== null && v > 0);

  return {
    municipio,
    uf,
    historico,
    series,
    equidade,
    territorial,
    correntes,
    territorio,
    condicoes: montarCondicoes(territorio),
    assentamentos,
    aldeias,
    trabalhoInfantil,
    vacinacao,
    violencia,
    vaar,
    anoCensoEscolar: escolas?.ano ?? null,
    ausencias,
    resumo: {
      naoDeclaradaPct: equidade?.naoDeclaradaPct ?? null,
      cadastroFragil:
        equidade?.cadastroFragil ??
        (equidade?.naoDeclaradaPct !== null &&
          equidade?.naoDeclaradaPct !== undefined &&
          equidade.naoDeclaradaPct > LIMIAR_CADASTRO_FRAGIL),
      negraPct:
        equidade && equidade.municipal.total > 0
          ? Math.round((equidade.negraMunicipal / equidade.municipal.total) * 1000) / 10
          : null,
      diferencaNegraRuralUrbana: diferencaNegra,
      povosComSinal: correntes.filter((c) => c.territorial.sinalConferencia).length,
      valorDerivadoTotal: derivados.length > 0 ? derivados.reduce((t, v) => t + v, 0) : null,
      condicionalidadeIII: vaar ? vaar.condicionalidades.III : null,
    },
  };
}
