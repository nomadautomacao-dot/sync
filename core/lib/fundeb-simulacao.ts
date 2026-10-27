import type { ReceitasFundeb, ProjecaoFundeb } from '@/modules/levantamento-fundeb/types';

/** Referência contábil para consumidores legados. Não é previsão do próximo exercício. */
export function referenciaSemProjecao(r: ReceitasFundeb): ProjecaoFundeb {
  return {
    vaafAtual:r.complementacaoVAAF, vaafProjetado:r.complementacaoVAAF, vaafGanho:0,
    vaatAtual:r.complementacaoVAAT, vaatProjetado:r.complementacaoVAAT, vaatGanho:0,
    vaarAtual:r.complementacaoVAAR, vaarProjetado:r.complementacaoVAAR, vaarGanho:0,
    totalAtual:r.totalReceitas, totalProjetado:r.totalReceitas, totalGanho:0, ganhoPercentual:0,
    possuiComplementacao:r.complementacaoVAAF+r.complementacaoVAAT+r.complementacaoVAAR>0,
    natureza:'referencia', multiplicadorAplicado:null,
    metodologia:'Referência do exercício vigente. Projeção futura não estimada sem premissas verificadas.',
    ressalva:'Não representa ausência de potencial nem previsão de receita futura.',
  };
}

export interface PremissasSimulacao {
  quantidade: number;
  limiteElegivel: number;
  fatorAtual: number;
  fatorNovo: number;
  valorEquivalente: number;
  exercicioReferencia: number;
  custoAdicionalAnual?: number | null;
}
/** Sensibilidade estática: usa apenas o acréscimo de peso; não soma alunos sobrepostos. */
export function simularMudancaJornada(p: PremissasSimulacao) {
  const numeros=[p.quantidade,p.limiteElegivel,p.fatorAtual,p.fatorNovo,p.valorEquivalente];
  if (!numeros.every(Number.isFinite) || !Number.isInteger(p.quantidade) || p.quantidade<0
    || !Number.isInteger(p.limiteElegivel) || !Number.isInteger(p.exercicioReferencia) || p.exercicioReferencia<2022 || p.exercicioReferencia>2100
    || p.quantidade>p.limiteElegivel || p.fatorAtual<0 || p.fatorNovo<p.fatorAtual
    || p.valorEquivalente<=0 || (p.custoAdicionalAnual != null && (!Number.isFinite(p.custoAdicionalAnual)||p.custoAdicionalAnual<0))) {
    throw new Error('Premissas inválidas ou quantidade acima das matrículas elegíveis.');
  }
  const equivalentes=p.quantidade*(p.fatorNovo-p.fatorAtual);
  const receitaBrutaReferencial=Math.round(equivalentes*p.valorEquivalente*100)/100;
  return {...p, equivalentes, receitaBrutaReferencial,
    saldoReferencial:p.custoAdicionalAnual==null?null:Math.round((receitaBrutaReferencial-p.custoAdicionalAnual)*100)/100,
    natureza:'simulacao' as const,
    formula:`${p.quantidade} × (${p.fatorNovo} − ${p.fatorAtual}) × ${p.valorEquivalente}`,
    ressalva:'Hipótese ilustrativa, sem matrícula nova. Mantém o valor por equivalente constante. O rateio estadual, as ponderações futuras, o VAAT, a elegibilidade e os custos podem alterar o resultado. Sem garantia de repasse.',
  };
}
