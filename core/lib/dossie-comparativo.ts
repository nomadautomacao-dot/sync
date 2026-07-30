import {
  getMunicipiosGemeos,
  ROTULO_GRUPO_INDICADOR,
  type GrupoIndicador,
  type IndicadorGemeos,
  type MunicipiosGemeos,
} from "./municipios-gemeos";
import { getInepCensoMunicipalRecord, type InepCensoMunicipalRecord } from "./inep-censo";
import { getPonderacaoMunicipal } from "./fundeb-ponderacao";

/**
 * Dossiê Comparativo — quanto, comparado a quem.
 *
 * ## O que ele acrescenta aos outros sete
 *
 * Todo número dos demais dossiês responde "quanto?". Este responde "quanto,
 * comparado a quem?" — e é a diferença entre um relatório que informa e um que
 * muda decisão.
 *
 * "A rede tem 26,8% de distorção idade-série" não move ninguém. "A rede tem
 * 26,8% de distorção contra 14,1% da mediana dos 80 municípios de porte
 * semelhante, e está no percentil 88 — pior que 88% dos seus pares" move.
 *
 * ## As três réguas, e por que são três
 *
 * - **Porte semelhante**: os municípios que enfrentam a mesma escala de
 *   problema. É a régua principal.
 * - **UF**: os que compartilham a mesma política estadual e o mesmo VAAF. Onde
 *   ela diverge muito do porte, o que se está vendo é efeito de estado.
 * - **Percentil**: onde exatamente na fila o município está. Sem ele, "acima da
 *   mediana" não distingue o segundo do quadragésimo.
 *
 * ## As duas regras que impedem o número de mentir
 *
 * 1. **Percentil sem sentido é ruído.** Percentil 90 em investimento por aluno
 *    pode ser excelente ou pode ser desperdício; percentil 90 em abandono é
 *    sempre ruim. Cada indicador carrega o seu `sentido`, e indicador neutro
 *    nunca recebe cor de bom ou ruim.
 * 2. **Comparação não é meta.** Estar na mediana não significa estar bem — a
 *    mediana pode ser ruim. Onde existe parâmetro legal, ele aparece junto e
 *    prevalece sobre a comparação.
 */

/** Faixa de percentil em que o município é indistinguível do típico. */
const FAIXA_TIPICO = 10;
/** Abaixo disto o percentil não é publicado, só os valores. */
const COMPARAVEIS_MINIMO = 20;

export type Avaliacao = "melhor" | "pior" | "tipico" | "neutro" | "sem-leitura";

export interface IndicadorComparado extends IndicadorGemeos {
  avaliacao: Avaliacao;
  /** Valor do município menos a mediana de porte, na unidade do indicador. */
  distancia: number;
  /** Distância sobre a mediana, em %. `null` quando a mediana é zero. */
  distanciaRelativa: number | null;
  /**
   * Posição na régua de 0 a 100 **já orientada**: 100 é sempre o melhor lado.
   * Para indicador `menor-melhor` é o complemento do percentil. Indicador
   * neutro mantém o percentil cru, porque ali não há lado melhor.
   */
  posicaoOrientada: number;
  /** A frase que traduz o percentil em gestão. */
  leitura: string;
  /** O que a distância até a mediana significa em matrículas. `null` sem base. */
  distanciaEmMatriculas: { quantidade: number; base: string } | null;
  /** Parâmetro legal que prevalece sobre a comparação, quando existe. */
  parametroLegal: string | null;
}

export interface GrupoComparado {
  chave: GrupoIndicador;
  rotulo: string;
  indicadores: IndicadorComparado[];
}

export interface DossieComparativo {
  municipio: string;
  uf: string;
  gemeos: MunicipiosGemeos | null;
  censo: InepCensoMunicipalRecord | null;
  indicadores: IndicadorComparado[];
  grupos: GrupoComparado[];
  /** Os de maior distância desfavorável, do pior para o menos pior. */
  maioresDistancias: IndicadorComparado[];
  ausencias: string[];
  resumo: {
    total: number;
    melhores: number;
    piores: number;
    tipicos: number;
    neutros: number;
    /** Percentil médio orientado — 50 é o município mediano em tudo. */
    posicaoMedia: number | null;
  };
}

/**
 * Parâmetros legais que prevalecem sobre a comparação.
 *
 * Regra 4 da spec: estar acima da mediana dos pares não significa estar em
 * conformidade — a mediana pode ser ilegal. Onde a lei fixa um piso, ele
 * aparece junto e vale mais que o percentil.
 */
const PARAMETRO_LEGAL: Record<string, string> = {
  mde: "Mínimo constitucional de 25% da receita de impostos em MDE (art. 212 da CF).",
  remuneracao70:
    "Mínimo de 70% do FUNDEB em remuneração dos profissionais da educação básica (art. 26 da Lei 14.113/2020).",
  naoAplicado:
    "Até 10% do FUNDEB podem ser aplicados no primeiro trimestre do exercício seguinte (art. 25, §3º); acima disso é descumprimento.",
  medianaMagisterio:
    "Piso salarial profissional nacional do magistério, reajustado anualmente (Lei 11.738/2008).",
};

/** Onde a distância em pontos percentuais tem denominador conhecido. */
function baseDaConversao(
  chave: string,
  censo: InepCensoMunicipalRecord | null,
  especial: number,
  crechePublica: number,
): { total: number; rotulo: string } | null {
  switch (chave) {
    case "distorcaoFundamental":
    case "abandonoFundamental": {
      const fundamental =
        (censo?.anosIniciaisFundamentalMunicipal ?? 0) + (censo?.anosFinaisFundamentalMunicipal ?? 0);
      return fundamental > 0
        ? { total: fundamental, rotulo: "matrículas do fundamental na rede municipal" }
        : null;
    }
    case "naoDeclarada":
      return censo && censo.matriculasMunicipaisTotal > 0
        ? { total: censo.matriculasMunicipaisTotal, rotulo: "matrículas da rede municipal" }
        : null;
    case "coberturaAee":
      return especial > 0
        ? { total: especial, rotulo: "matrículas de educação especial" }
        : null;
    case "crecheIntegral":
      return crechePublica > 0
        ? { total: crechePublica, rotulo: "matrículas de creche pública" }
        : null;
    default:
      return null;
  }
}

function avaliar(indicador: IndicadorGemeos): Avaliacao {
  if (indicador.comparaveis < COMPARAVEIS_MINIMO) return "sem-leitura";
  if (indicador.sentido === "neutro") return "neutro";

  const distanciaDoMeio = indicador.percentil - 50;
  if (Math.abs(distanciaDoMeio) <= FAIXA_TIPICO) return "tipico";

  const acimaEhMelhor = indicador.sentido === "maior-melhor";
  return distanciaDoMeio > 0 === acimaEhMelhor ? "melhor" : "pior";
}

function posicaoOrientada(indicador: IndicadorGemeos): number {
  return indicador.sentido === "menor-melhor" ? 100 - indicador.percentil : indicador.percentil;
}

function lerIndicador(indicador: IndicadorGemeos, avaliacao: Avaliacao): string {
  const pares = indicador.comparaveis;
  const p = indicador.percentil;

  if (avaliacao === "sem-leitura") {
    return `Só ${pares} municípios de porte semelhante têm este dado — coorte rala demais para percentil. Os valores ficam na tabela; a posição não.`;
  }
  if (avaliacao === "neutro") {
    return `Indicador sem lado melhor: o percentil ${p} diz onde a rede está entre os ${pares} pares, não se isso é bom. Investimento por aluno alto pode ser oferta cara e necessária — rede rural dispersa, tempo integral — ou ineficiência.`;
  }
  if (avaliacao === "tipico") {
    return `Percentil ${p} entre ${pares} pares: a rede é indistinguível do município típico do seu porte neste indicador. Não é elogio nem alerta — é ausência de sinal.`;
  }
  if (avaliacao === "melhor") {
    const acima = indicador.sentido === "maior-melhor" ? p : 100 - p;
    return `Melhor que ${acima}% dos ${pares} municípios de porte semelhante. É posição a sustentar, e serve de argumento em qualquer pleito que exija demonstrar capacidade de gestão.`;
  }
  const piorQue = indicador.sentido === "maior-melhor" ? 100 - p : p;
  return `Pior que ${piorQue}% dos ${pares} municípios de porte semelhante. Não é contexto: são redes do mesmo tamanho, com a mesma escala de problema, e a maioria delas está melhor.`;
}

export function compararIndicadores(
  gemeos: MunicipiosGemeos | null,
  censo: InepCensoMunicipalRecord | null,
  especial: number,
  crechePublica: number,
): IndicadorComparado[] {
  if (!gemeos) return [];

  return gemeos.indicadores.map((indicador) => {
    const avaliacao = avaliar(indicador);
    const distancia = indicador.valor - indicador.medianaPorte;
    const base =
      indicador.unidade === "percentual"
        ? baseDaConversao(indicador.chave, censo, especial, crechePublica)
        : null;

    return {
      ...indicador,
      avaliacao,
      distancia,
      distanciaRelativa:
        indicador.medianaPorte !== 0
          ? Math.round((distancia / Math.abs(indicador.medianaPorte)) * 1000) / 10
          : null,
      posicaoOrientada: posicaoOrientada(indicador),
      leitura: lerIndicador(indicador, avaliacao),
      // Distância que arredonda para zero não vira linha: "0 matrículas de
      // diferença" ocupa espaço para dizer que não há diferença.
      distanciaEmMatriculas:
        base !== null && Math.round((Math.abs(distancia) / 100) * base.total) > 0
          ? {
              quantidade: Math.round((Math.abs(distancia) / 100) * base.total),
              base: base.rotulo,
            }
          : null,
      parametroLegal: PARAMETRO_LEGAL[indicador.chave] ?? null,
    };
  });
}

export function montarDossieComparativo(
  codigoIBGE: string,
  municipio: string,
  uf: string,
): DossieComparativo {
  const gemeos = getMunicipiosGemeos(codigoIBGE);
  const censo = getInepCensoMunicipalRecord(codigoIBGE);
  const ponderacao = getPonderacaoMunicipal(codigoIBGE);

  const soma = (padrao: RegExp) =>
    (ponderacao?.segmentos ?? []).reduce(
      (t, s) => (padrao.test(s.nome) ? t + s.matriculas : t),
      0,
    );
  const especial = soma(/^Educação Especial/);
  const crechePublica = soma(/^Creche (Integral|Parcial) Pública/);

  const ausencias: string[] = [];
  if (!gemeos) {
    ausencias.push(
      "A planilha de matrículas ponderadas do FNDE não traz este município — sem ela não há porte de rede, e sem porte não há coorte de comparação.",
    );
  } else if (gemeos.indicadores.length === 0) {
    ausencias.push(
      "Nenhum indicador teve pares suficientes para comparação nesta coorte. Percentil sobre meia dúzia de vizinhos é ruído com cara de estatística, e o dossiê prefere não publicá-lo.",
    );
  }
  if (!censo) {
    ausencias.push(
      "O Censo Escolar não trouxe matrícula por etapa — as distâncias aparecem em pontos percentuais, sem a conversão em matrículas.",
    );
  }

  const indicadores = compararIndicadores(gemeos, censo, especial, crechePublica);

  const grupos: GrupoComparado[] = (
    Object.keys(ROTULO_GRUPO_INDICADOR) as GrupoIndicador[]
  )
    .map((chave) => ({
      chave,
      rotulo: ROTULO_GRUPO_INDICADOR[chave],
      indicadores: indicadores.filter((i) => i.grupo === chave),
    }))
    .filter((g) => g.indicadores.length > 0);

  // A maior distância desfavorável é a que se mede em percentil, não em pontos:
  // pontos de indicadores com escalas diferentes não se comparam entre si.
  const maioresDistancias = indicadores
    .filter((i) => i.avaliacao === "pior")
    .sort((a, b) => a.posicaoOrientada - b.posicaoOrientada)
    .slice(0, 3);

  const comLeitura = indicadores.filter(
    (i) => i.avaliacao !== "sem-leitura" && i.avaliacao !== "neutro",
  );

  return {
    municipio,
    uf,
    gemeos,
    censo,
    indicadores,
    grupos,
    maioresDistancias,
    ausencias,
    resumo: {
      total: indicadores.length,
      melhores: indicadores.filter((i) => i.avaliacao === "melhor").length,
      piores: indicadores.filter((i) => i.avaliacao === "pior").length,
      tipicos: indicadores.filter((i) => i.avaliacao === "tipico").length,
      neutros: indicadores.filter((i) => i.avaliacao === "neutro").length,
      posicaoMedia:
        comLeitura.length > 0
          ? Math.round(
              comLeitura.reduce((t, i) => t + i.posicaoOrientada, 0) / comLeitura.length,
            )
          : null,
    },
  };
}
