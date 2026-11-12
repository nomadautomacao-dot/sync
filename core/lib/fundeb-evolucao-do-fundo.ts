/**
 * Quanto a receita do FUNDEB cresce sem nenhum trabalho na rede — a arrecadação
 * de impostos que alimenta o fundo do estado sobe a cada ano.
 *
 * O levantamento projeta a **receita total** do exercício seguinte, e a
 * prefeitura compara o ano seguinte com esse número inteiro, não com a fatia
 * do trabalho. Por isso a evolução do fundo entra na projeção, como linha
 * própria da tabela de composição.
 *
 * ## Por que a redistribuição, e não a receita total
 *
 * A média é a do próprio município, nos três últimos exercícios — mas sobre a
 * **contribuição ao fundo estadual**, não sobre o total. O total carrega a
 * complementação da União, que salta por evento: Serra do Ramalho entrou no
 * VAAT em 2024 (com 92% da Bahia) e a receita total cresceu 22,5% ao ano de 2023
 * a 2026; a redistribuição, 7,3%. Projetar os 22,5% para frente repetiria uma
 * entrada no VAAT que não se repete. A complementação fica onde está.
 *
 * Taxa negativa vira zero: o levantamento não projeta queda de arrecadação, e
 * também não a usaria para esconder ganho.
 */

export interface PontoDaSerie {
  ano: number;
  contribuicao: number;
}

export interface EvolucaoDoFundo {
  /** Taxa média anual, em fração (0,088 = 8,8% ao ano). */
  taxa: number;
  /** Primeiro e último exercício da média. */
  de: number;
  ate: number;
  /** Contribuição do último exercício — a base sobre a qual a taxa corre. */
  base: number;
}

/** Quantos exercícios entram na média: três transições, quatro pontos. */
const TRANSICOES = 3;

export function evolucaoDoFundo(serie: PontoDaSerie[]): EvolucaoDoFundo | null {
  const pontos = serie
    .filter((p) => p.ano > 0 && p.contribuicao > 0)
    .sort((a, b) => a.ano - b.ano)
    .slice(-(TRANSICOES + 1));
  if (pontos.length < 2) return null;
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  const anos = ultimo.ano - primeiro.ano;
  if (anos <= 0) return null;
  const taxa = Math.max(0, (ultimo.contribuicao / primeiro.contribuicao) ** (1 / anos) - 1);
  return { taxa, de: primeiro.ano, ate: ultimo.ano, base: ultimo.contribuicao };
}

/** Receita a mais, sobre a base, depois de `anos` exercícios de evolução. */
export function evolucaoEm(e: EvolucaoDoFundo | null, anos: number): number {
  if (!e || anos <= 0) return 0;
  return e.base * ((1 + e.taxa) ** anos - 1);
}
