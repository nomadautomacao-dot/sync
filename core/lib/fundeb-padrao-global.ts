import { getInepCensoMunicipalHistory, type InepCensoMunicipalRecord } from "@/core/lib/inep-censo";

/**
 * O Padrão Global — o ritmo de matrícula que os municípios atendidos alcançaram.
 *
 * O cenário otimista anterior usava o decil de cima do país: o que uma em cada
 * dez redes faz sozinha. Não é o que a consultoria entrega. Os municípios
 * atendidos pela Global cresceram a matrícula ponderada bem acima disso — e é
 * esse o dado que sustenta a venda, porque é o que a consultoria mexe.
 *
 * ## O que este padrão NÃO usa
 *
 * A receita dos casos disparou de 2023 para 2026 (Senhor do Bonfim +287%,
 * Coribe +219%), mas a maior parte veio da entrada no VAAT em 2024 — e **92%
 * dos municípios da Bahia entraram no VAAT naquele ano**, porque o mínimo
 * nacional subiu. Contra os pares da Bahia que também entraram, três casos
 * ficam no decil de cima e dois abaixo da mediana. Usar a receita como padrão
 * seria vender como resultado o que aconteceu com o estado inteiro.
 *
 * ## O que ele usa
 *
 * A matrícula ponderada ganha de um Censo para o seguinte, pelo acréscimo de
 * fator de cada frente (EJA 1,00 · integral 0,40 · educação especial 0,40),
 * sobre a rede municipal. É a mesma conta do cenário de matrículas, aplicada ao
 * que os casos fizeram. Medido sobre a base do Censo: quando um Censo novo
 * entra, o padrão se atualiza sozinho.
 *
 * As janelas de atuação abaixo são as do Case de Sucesso; os anos de Censo de
 * cada uma **precisam ser confirmados** pela equipe.
 */

export interface CasoGlobal {
  codigoIbge: string;
  nome: string;
  uf: string;
  /** Primeiro e último Censo da janela de atuação. */
  censoInicio: number;
  censoFim: number;
}

export const CASOS_GLOBAL: readonly CasoGlobal[] = [
  { codigoIbge: "2930105", nome: "Senhor do Bonfim", uf: "BA", censoInicio: 2022, censoFim: 2025 },
  { codigoIbge: "2909109", nome: "Coribe", uf: "BA", censoInicio: 2022, censoFim: 2025 },
  { codigoIbge: "2930758", nome: "Sítio do Mato", uf: "BA", censoInicio: 2022, censoFim: 2025 },
  { codigoIbge: "2908101", nome: "Cocos", uf: "BA", censoInicio: 2022, censoFim: 2025 },
  // O Case de Sucesso fecha Serra do Ramalho no exercício de 2025 — Censo de 2024.
  { codigoIbge: "2930154", nome: "Serra do Ramalho", uf: "BA", censoInicio: 2022, censoFim: 2024 },
];

/** Acréscimo de fator por matrícula — o mesmo de `fundeb-cenario-metas.ts`. */
const FATOR = { eja: 1.0, integral: 0.4, especial: 0.4 } as const;

export interface CasoMedido extends CasoGlobal {
  redeInicio: number;
  /** Matrícula ponderada ganha na janela, em fração da rede do primeiro Censo. */
  ganhoAcumulado: number;
  /** Média por transição de Censo. */
  ganhoPorAno: number;
  /** O melhor ano da janela. */
  melhorAno: number;
  transicoes: number;
}

export interface PadraoGlobal {
  /** Ganho por ano da rede mediana entre os casos — o ritmo do Padrão Global. */
  porAno: number;
  /** Mediana do melhor ano de cada caso — o teto de um ano. */
  melhorAno: number;
  /** Mediana do ganho acumulado na janela. */
  acumulado: number;
  casos: CasoMedido[];
}

const integral = (r: InepCensoMunicipalRecord) =>
  (r.tempoIntegralEnsinoFundamentalMunicipal ?? 0) + (r.tempoIntegralEducacaoInfantilMunicipal ?? 0);

function equivalentesGanhos(a: InepCensoMunicipalRecord, b: InepCensoMunicipalRecord): number {
  return (
    FATOR.eja * ((b.ejaMunicipal ?? 0) - (a.ejaMunicipal ?? 0)) +
    FATOR.integral * (integral(b) - integral(a)) +
    FATOR.especial * ((b.educacaoEspecialMunicipal ?? 0) - (a.educacaoEspecialMunicipal ?? 0))
  );
}

function mediana(valores: number[]): number {
  if (!valores.length) return 0;
  const s = [...valores].sort((x, y) => x - y);
  const meio = Math.floor(s.length / 2);
  return s.length % 2 ? s[meio] : (s[meio - 1] + s[meio]) / 2;
}

export function medirCaso(caso: CasoGlobal): CasoMedido | null {
  const serie = getInepCensoMunicipalHistory(caso.codigoIbge)
    .filter((r) => r.anoReferencia >= caso.censoInicio && r.anoReferencia <= caso.censoFim)
    .sort((a, b) => a.anoReferencia - b.anoReferencia);
  const inicio = serie[0];
  if (serie.length < 2 || !inicio || !((inicio.matriculasMunicipaisTotal ?? 0) > 0)) return null;
  const rede = inicio.matriculasMunicipaisTotal!;
  const anuais: number[] = [];
  for (let k = 1; k < serie.length; k++) {
    const base = serie[k - 1].matriculasMunicipaisTotal ?? 0;
    if (base > 0) anuais.push(equivalentesGanhos(serie[k - 1], serie[k]) / base);
  }
  const acumulado = equivalentesGanhos(inicio, serie[serie.length - 1]) / rede;
  return {
    ...caso,
    redeInicio: rede,
    ganhoAcumulado: acumulado,
    ganhoPorAno: acumulado / anuais.length,
    melhorAno: Math.max(...anuais),
    transicoes: anuais.length,
  };
}

let cache: PadraoGlobal | null = null;

export function padraoGlobal(): PadraoGlobal | null {
  if (cache) return cache;
  const casos = CASOS_GLOBAL.map(medirCaso).filter((c): c is CasoMedido => c !== null);
  // Com menos de três casos medidos a "mediana" é um município, não um padrão.
  if (casos.length < 3) return null;
  cache = {
    porAno: mediana(casos.map((c) => c.ganhoPorAno)),
    melhorAno: mediana(casos.map((c) => c.melhorAno)),
    acumulado: mediana(casos.map((c) => c.ganhoAcumulado)),
    casos: casos.sort((a, b) => b.ganhoAcumulado - a.ganhoAcumulado),
  };
  return cache;
}
