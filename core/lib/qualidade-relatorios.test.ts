import { describe, it, expect } from 'vitest';
import { percentualCompativel, conferirSoma, exigirQualidade } from './qualidade-dados';
import { simularMudancaJornada, referenciaSemProjecao } from './fundeb-simulacao';
import { situacaoCalendario } from './calendario-educacional';
import { getFundebReceitasOficiais, getFundebVaatContext } from './fundeb-fnde';
import { getMunicipiosGemeos } from './municipios-gemeos';

describe('qualidade dos relatórios',()=>{
 const num={valor:266643,unidade:'familias',universo:'cadunico',periodo:'2026-08'};
 it('não transforma famílias/pessoas nem períodos distintos em percentual',()=>{
  expect(percentualCompativel(num,{...num,valor:1243604,unidade:'pessoas'})).toBeNull();
  expect(percentualCompativel(num,{...num,valor:595758,periodo:'2026-10'})).toBeNull();
  expect(percentualCompativel(num,{...num,valor:589696})).toBeCloseTo(45.2169999,3);
 });
 it('recusa razão acima de 100%, valor ausente e denominador zero',()=>{
  for(const valor of [0,10,null])expect(percentualCompativel(num,{...num,valor})).toBeNull();
 });
 it('bloqueia total incompatível com as parcelas',()=>{
  expect(()=>exigirQualidade(conferirSoma(100,[20,30],'total'))).toThrow('total');
  expect(conferirSoma(100,[20,80],'total')).toEqual([]);
 });
 it('simula somente o peso incremental e deduz o custo uma vez',()=>{
  const s=simularMudancaJornada({quantidade:500,limiteElegivel:1000,fatorAtual:1,fatorNovo:1.4,valorEquivalente:6000,exercicioReferencia:2026,custoAdicionalAnual:900000});
  expect(s.equivalentes).toBeCloseTo(200);expect(s.receitaBrutaReferencial).toBe(1200000);expect(s.saldoReferencial).toBe(300000);
  expect(()=>simularMudancaJornada({...s,quantidade:1001})).toThrow();
  expect(simularMudancaJornada({...s,custoAdicionalAnual:null}).saldoReferencial).toBeNull();
 });
 it('não estima crescimento pelo porte ou pelo score comercial',()=>{
  const p=referenciaSemProjecao({receitaContribuicaoMunicipal:60,complementacaoVAAF:30,complementacaoVAAT:10,complementacaoVAAR:0,totalReceitas:100});
  expect(p.natureza).toBe('referencia');expect(p.totalGanho).toBe(0);expect(p.multiplicadorAplicado).toBeNull();
 });
 it('reconhece o encerramento e não inventa calendário para outro exercício',()=>{
  expect(situacaoCalendario(2026,new Date('2026-10-26T12:00:00Z')).situacao).toBe('encerrada');
  expect(situacaoCalendario(2027,new Date('2026-10-26T12:00:00Z')).situacao).toBe('a_confirmar');
 });
 it('concilia Fortaleza nos anexos oficiais da mesma publicação',async()=>{
  const [r,v]=await Promise.all([getFundebReceitasOficiais('2304400',2026),getFundebVaatContext('2304400',2026)]);
  expect(r?.totalReceitas).toBe(2261769773.55);expect(v?.complementacaoVAAT).toBe(r?.complementacaoVAAT);expect(v?.vaatComComplementacao).toBe(10192.38);
 });
 it('não força uma coorte de 80 cidades muito menores para uma capital',()=>{
  const g=getMunicipiosGemeos('2304400')!;
  expect(g.faixaPorte.minimo).toBeGreaterThanOrEqual(g.matriculas/2);
  expect(g.faixaPorte.maximo).toBeLessThanOrEqual(g.matriculas*2);
  for(const i of g.indicadores)expect(i.comparaveis).toBeGreaterThanOrEqual(20);
 });
});
