/**
 * Estimativa do repasse do **PNAE** a partir das mesmas matrículas que
 * alimentam o FUNDEB.
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * O Censo Escolar não define só o FUNDEB. A alimentação escolar é rateada
 * pelas **mesmas matrículas**, pela fórmula `VT = A × D × C` (Resolução
 * CD/FNDE nº 4, de 26/02/2026, art. 47), com `D = 200` dias letivos. Um erro
 * de declaração no Censo, portanto, custa duas vezes: derruba a ponderação do
 * fundo e encolhe o repasse da merenda.
 *
 * Isso também mostra ao gestor um fluxo que ele costuma tratar como fixo e
 * que, na verdade, responde às mesmas correções cadastrais.
 *
 * ## O que este cálculo é, e o que não é
 *
 * É **estimativa**, não o valor empenhado. O FNDE reparte por entidade
 * executora e admite delegação de rede entre entes, e o número de estudantes
 * usado no repasse é o do Censo do ano anterior. O que a função devolve é a
 * ordem de grandeza que as matrículas atuais justificam — útil para comparar
 * com o que o município de fato recebeu, não para substituí-lo.
 */

import { getPonderacaoMunicipal } from "@/core/lib/fundeb-ponderacao";

/** Art. 47, III da Resolução CD/FNDE nº 4/2026. */
const DIAS_LETIVOS = 200;

/**
 * Anexo V da Resolução CD/FNDE nº 4/2026, conferido no texto publicado no DOU
 * de 02/03/2026. Valores por estudante e por dia de atendimento.
 */
export const PER_CAPITA_PNAE = {
  fundamentalMedioEja: 0.57,
  preEscola: 0.82,
  /** Escolas em área indígena, remanescente de quilombo ou de outros PCT. */
  areasTradicionais: 0.98,
  /** Permanência mínima de 7h/dia, aferida pelo Censo Escolar. */
  tempoIntegral: 1.57,
  creche: 1.57,
  aee: 0.78,
} as const;

export interface FaixaPnae {
  rotulo: string;
  perCapita: number;
  matriculas: number;
  valorAnual: number;
}

export interface EstimativaPnae {
  exercicio: number;
  fonte: string;
  diasLetivos: number;
  matriculasConsideradas: number;
  valorAnual: number;
  faixas: FaixaPnae[];
}

/**
 * Faixa aplicável a um segmento do FUNDEB.
 *
 * As faixas do Anexo V não são disjuntas — uma creche em área quilombola
 * atende tanto "creche" (1,57) quanto "áreas tradicionais" (0,98). O Anexo
 * resolve isso explicitamente para a creche, que inclui "as localizadas em
 * áreas indígenas, remanescentes de quilombos e PCT" no valor cheio. Para os
 * demais cruzamentos aplicamos a **faixa de maior valor**, que é a leitura
 * coerente com o desenho do programa: a condição mais custosa prevalece.
 *
 * Devolve `null` para segmentos que o PNAE não remunera por esta via (o AEE
 * entra por conta própria, como contraturno).
 */
function faixaDoSegmento(nome: string): { chave: keyof typeof PER_CAPITA_PNAE; rotulo: string } | null {
  const tradicional = /Indígena|Quilombola/i.test(nome);

  if (/^Atendimento Educacional Especializado/i.test(nome)) {
    return { chave: "aee", rotulo: "Atendimento educacional especializado (contraturno)" };
  }
  if (/^Creche|^Educação Especial - Creche|^Educação Bilingue - Creche/i.test(nome)) {
    return { chave: "creche", rotulo: "Creche" };
  }
  if (/Integral/i.test(nome)) {
    return { chave: "tempoIntegral", rotulo: "Tempo integral (mínimo de 7h/dia)" };
  }
  if (tradicional) {
    return { chave: "areasTradicionais", rotulo: "Escolas em áreas indígenas, quilombolas e de PCT" };
  }
  if (/Pré-Escola/i.test(nome)) {
    return { chave: "preEscola", rotulo: "Pré-escola" };
  }
  if (/Fundamental|Médio|EJA|Educação Especial|Educação Bilingue|Educação Profissional/i.test(nome)) {
    return { chave: "fundamentalMedioEja", rotulo: "Ensino fundamental, médio e EJA" };
  }
  return null;
}

export function getEstimativaPnae(codigoIBGE: string): EstimativaPnae | null {
  const ponderacao = getPonderacaoMunicipal(codigoIBGE);
  if (!ponderacao || ponderacao.segmentos.length === 0) return null;

  const acumulado = new Map<string, FaixaPnae>();
  let matriculasConsideradas = 0;

  for (const segmento of ponderacao.segmentos) {
    const faixa = faixaDoSegmento(segmento.nome);
    if (!faixa || segmento.matriculas <= 0) continue;

    const perCapita = PER_CAPITA_PNAE[faixa.chave];
    const existente = acumulado.get(faixa.chave);

    if (existente) {
      existente.matriculas += segmento.matriculas;
      existente.valorAnual += segmento.matriculas * perCapita * DIAS_LETIVOS;
    } else {
      acumulado.set(faixa.chave, {
        rotulo: faixa.rotulo,
        perCapita,
        matriculas: segmento.matriculas,
        valorAnual: segmento.matriculas * perCapita * DIAS_LETIVOS,
      });
    }

    // O AEE é contraturno: soma ao repasse sem ser matrícula adicional de
    // escolarização. Contá-lo no total de estudantes duplicaria o aluno.
    if (faixa.chave !== "aee") matriculasConsideradas += segmento.matriculas;
  }

  if (acumulado.size === 0) return null;

  const faixas = [...acumulado.values()].sort((a, b) => b.valorAnual - a.valorAnual);
  const valorAnual = faixas.reduce((total, f) => total + f.valorAnual, 0);

  return {
    exercicio: ponderacao.exercicio,
    fonte: "Resolução CD/FNDE nº 4, de 26/02/2026, Anexo V — sobre matrículas da filtragem do FUNDEB",
    diasLetivos: DIAS_LETIVOS,
    matriculasConsideradas,
    valorAnual: Math.round(valorAnual * 100) / 100,
    faixas: faixas.map((f) => ({ ...f, valorAnual: Math.round(f.valorAnual * 100) / 100 })),
  };
}
