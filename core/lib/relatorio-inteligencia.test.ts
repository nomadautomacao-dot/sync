import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { apurarExecucao, type ContaRreo } from './fundeb-execucao';
import { lerRegistroVaar } from './fundeb-vaar-indicadores';
import { compararObservacoes, priorizarEscolas, type ObservacaoMonitoramento } from './relatorio-inteligencia';
import { acompanhamentoSchema, acompanhamentoVazio } from '@/modules/levantamento-fundeb/acompanhamento';

const row = (p: Partial<ContaRreo> = {}): ContaRreo => ({ exercicio:2026,periodo:4,cod_ibge:2304400,anexo:'RREO-Anexo 06',cod_conta:'TransferenciasDoFUNDEB',conta:'Transferências do FUNDEB',coluna:'RECEITAS REALIZADAS (a)',valor:100,...p });
describe('Execução financeira sem mistura de conceitos',()=>{
  it('seleciona receita acumulada e preserva despesa desconhecida',()=>{
    const r=apurarExecucao([row(),row({coluna:'PREVISÃO ATUALIZADA',valor:180}),row({periodo:3,valor:70}),row({cod_ibge:1234567,valor:999})],'2304400',2026,4);
    expect(r.receitaFundeb).toBe(100);expect(r.previsaoMunicipal).toBe(180);expect(r.despesas.pagas).toBeNull();expect(r.estado).toBe('parcial');
  });
  it('não transforma vazio em zero nem escolhe célula duplicada',()=>{
    expect(apurarExecucao([],'2304400',2026,4).receitaFundeb).toBeNull();
    expect(apurarExecucao([row(),row()],'2304400',2026,4).receitaFundeb).toBeNull();
    expect(apurarExecucao([row({valor:0})],'2304400',2026,4).receitaFundeb).toBe(0);
  });
  it('série mensal descarta meses do ano anterior e o total de 12 meses',()=>{
    const r=apurarExecucao([row({anexo:'RREO-Anexo 03',cod_conta:'RREO3TransferenciasDoFUNDEB',coluna:'<MR-7>',valor:10}),row({anexo:'RREO-Anexo 03',cod_conta:'RREO3TransferenciasDoFUNDEB',coluna:'<MR-8>',valor:20}),row({anexo:'RREO-Anexo 03',cod_conta:'RREO3TransferenciasDoFUNDEB',coluna:'TOTAL (ÚLTIMOS 12 MESES)',valor:999})],'2304400',2026,4);
    expect(r.transferenciasMensais).toEqual([{mes:1,valor:10}]);
  });
});
describe('Leitura do VAAR',()=>{
  async function planilha(){const z=new JSZip();z.file('xl/worksheets/sheet1.xml','<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Codigo_Ente</t></is></c><c r="B1" t="inlineStr"><is><t>Competencia</t></is></c><c r="C1" t="inlineStr"><is><t>Motivo</t></is></c></row><row><c r="A2"><v>2304400</v></c><c r="B2"><v>2026</v></c><c r="C2" t="inlineStr"><is><t>Não &amp; teste</t></is></c></row></sheetData></worksheet>');return z.generateAsync({type:'nodebuffer'});}
  it('usa código, competência e texto original sem inferir receita',async()=>{expect(await lerRegistroVaar(await planilha(),'2304400',2026)).toEqual({Codigo_Ente:2304400,Competencia:2026,Motivo:'Não & teste'});});
  it('rejeita outro exercício e não inventa município ausente',async()=>{await expect(lerRegistroVaar(await planilha(),'2304400',2027)).rejects.toThrow('Competência');expect(await lerRegistroVaar(await planilha(),'0000000',2026)).toBeNull();});
});
describe('Prioridade escolar e monitoramento',()=>{
  it('preserva códigos, anos e ausência de dados, sem afirmar escola omitida',()=>{
    const r=priorizarEscolas({escolasTerritorio:{ano:2025,escolas:[{codigo:'12345678',matriculas:100}]},idebEscolas:{ano:2023,escolas:[{codigo:'87654321',nome:'Escola B',ai:{nd:true}}]},indicadoresEscolas:{anos:{rendimento:2024},escolas:[{codigo:'12345678',nome:'Escola A',abandonoFund:9},{codigo:'87654321',abandonoFund:1}]}});
    expect(r.escolas).toHaveLength(2);expect(r.escolas.every(s=>s.verificacaoCadastro)).toBe(true);
    expect(r.escolas.find(s=>s.codigo==='12345678')?.sinais[0]).toMatchObject({valor:9,referencia:5,ano:2024});
    expect(r.escolas.find(s=>s.codigo==='87654321')?.matriculas).toBeNull();
  });
  const o:ObservacaoMonitoramento={id:'receita',periodo:'2025',universo:'municipal',valor:100,fonte:'a'};
  it('comparação exige mesmo período e universo',()=>{
    const changes=compararObservacoes([o],[{...o,periodo:'2026',valor:110}]);
    expect(changes.some(c=>c.tipo==='valor_alterado')).toBe(false);
    expect(compararObservacoes([o],[{...o,valor:110}])[0]).toMatchObject({antes:100,depois:110,tipo:'valor_alterado'});
  });
  it('distingue revisão da fonte de revisão do valor',()=>{expect(compararObservacoes([o],[{...o,fonte:'b'}])[0].tipo).toBe('fonte_alterada');});
});
describe('Registro de entregas e resultados',()=>{
  it('não conclui entrega sem responsável, prazo e evidência',()=>{
    expect(acompanhamentoSchema.safeParse({...acompanhamentoVazio,status:'concluida'}).success).toBe(false);
    expect(acompanhamentoSchema.safeParse({...acompanhamentoVazio,status:'concluida',responsavel:'Equipe',prazo:'2026-12-01',entrega:'Conciliação',evidencia:'Protocolo 1'}).success).toBe(true);
  });
  it('valor financeiro exige memória e revisão, inclusive quando é zero',()=>{
    expect(acompanhamentoSchema.safeParse({...acompanhamentoVazio,receitaAdicional:0}).success).toBe(false);
    expect(acompanhamentoSchema.safeParse({...acompanhamentoVazio,receitaAdicional:10,memoriaFinanceira:'Processo e cálculo',revisadoPor:'Técnico'}).success).toBe(true);
  });
});
