import type { CityReport } from "./reports-types";

/**
 * Qual relatório alimenta a Ficha do levantamento FUNDEB.
 *
 * Mora fora do componente para poder ser testado. A escolha errada aqui não
 * produz erro visível: produz uma ficha **preenchida pela metade**, com VAAF e
 * VAAT em R$ 0,00 porque esses campos não existem no snapshot de um dossiê, e
 * "Não informado" em toda a identificação. Número plausível e errado é o pior
 * desfecho possível numa tela que sustenta proposta comercial — pior que a tela
 * vazia, que pelo menos avisa.
 *
 * `diagnostico_fundeb` é o tipo do documento "levantamento" no catálogo
 * (`documentos-emissiveis.ts`). Raio-X e os oito dossiês arquivam JSON com
 * forma própria e não servem aqui.
 */
export const TIPO_DA_FICHA_FUNDEB = "diagnostico_fundeb" as const;

/** Só levantamentos, e só os que trouxeram JSON. */
export function levantamentosDaFicha(reports: readonly CityReport[]): CityReport[] {
  return reports.filter(
    (report) => Boolean(report.snapshot) && report.type === TIPO_DA_FICHA_FUNDEB,
  );
}

/**
 * A versão que a ficha mostra.
 *
 * Respeita a escolha do usuário **apenas** quando ela é um levantamento: a
 * seleção é compartilhada com a aba de Relatórios, onde se pode escolher um
 * dossiê — e nesse caso a ficha cai no levantamento mais recente em vez de
 * tentar ler o dossiê com o gabarito errado.
 */
export function versaoDaFicha(
  reports: readonly CityReport[],
  selecionado?: CityReport,
): CityReport | undefined {
  const disponiveis = levantamentosDaFicha(reports);
  if (selecionado && disponiveis.some((r) => r.id === selecionado.id)) {
    return selecionado;
  }
  return disponiveis[0];
}

/** Todo relatório que arquivou JSON — de qualquer tipo. */
export function relatoriosComDados(reports: readonly CityReport[]): CityReport[] {
  return reports.filter((report) => Boolean(report.snapshot));
}

/**
 * Qual relatório o inspetor de dados abre.
 *
 * Aqui **qualquer** tipo serve, ao contrário da ficha: o Raio-X e os dossiês
 * arquivam dezenas de blocos que só existiam dentro do PDF, e abri-los é o
 * ponto. O que não se pode é ler esses blocos com o gabarito do levantamento —
 * por isso o painel de VAAF/VAAT/VAAR continua atrás de `ehLevantamento`.
 *
 * Sem escolha, prefere o levantamento: é o que responde as perguntas do dia a
 * dia, e abrir a cidade num dossiê de equidade seria um começo estranho.
 */
export function relatorioParaInspecionar(
  reports: readonly CityReport[],
  selecionado?: CityReport,
): CityReport | undefined {
  const disponiveis = relatoriosComDados(reports);
  if (selecionado?.snapshot && disponiveis.some((r) => r.id === selecionado.id)) {
    return selecionado;
  }
  return levantamentosDaFicha(reports)[0] ?? disponiveis[0];
}

export function ehLevantamento(report: CityReport | undefined): boolean {
  return report?.type === TIPO_DA_FICHA_FUNDEB;
}
