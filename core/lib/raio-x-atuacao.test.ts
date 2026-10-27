import { describe, it, expect } from 'vitest';
import type { RelatorioSnapshot } from './relatorio-snapshot';
import { montarRaioXAtuacao } from './raio-x-atuacao';
import { generateRaioXAtuacaoHtml } from './raio-x-atuacao-template';

const emissao = new Date('2026-10-26T15:00:00Z');
function base(dirigido: Record<string, unknown> = {}, year = 2026): RelatorioSnapshot {
  return {
    schemaVersion: 4, current: { relatorio: { identificacao: { exercicio: year } }, payload: {
      dados_basicos: { nome: 'Município de teste', uf: 'CE', codigo_ibge: '2304400' },
      relatorio_fundeb: { censoEscolar: { totalEscolas: 12, anoReferencia: 2025 } },
      relatorio_dirigido_base: dirigido,
    } }, base: null, profile: null, boundary: null,
    qualidade: { snapshotId: 'teste', coletadoEm: '2026-10-26T13:00:00Z', versao: 'teste', evidencias: [], achados: [] },
  } as unknown as RelatorioSnapshot;
}
const vaar = { exercicio: 2026, habilitado: false, beneficiario: false, complementacao: 0, reprovadas: ['III'], condIVEstadual: false, referencia: { medianaUf: 9_999_999 } };

describe('Raio-X de Atuação: evidência e escopo', () => {
  it('base ausente gera coleta e lacunas, sem acusação de descumprimento', () => {
    const r = montarRaioXAtuacao(base(), emissao);
    expect(r.acoes.map(a => a.id)).toEqual(['BASE-01']);
    expect(r.manutencao).toEqual([]);
    expect(r.lacunas.length).toBeGreaterThan(3);
  });
  it('não converte mediana de VAAR em perda ou receita recuperável', () => {
    const r = montarRaioXAtuacao(base({ vaar }), emissao);
    const a = r.acoes.find(a => a.id === 'VAAR-01')!;
    expect(a.evidencia.descricao).toContain('III');
    expect(a.passos.join(' ')).toContain('desigualdades');
    expect(a.financeiro.valor).toBeNull();
    expect(JSON.stringify(r)).not.toContain('9999999');
    expect(r.acoes.every(a => a.status === 'proposta_a_validar')).toBe(true);
  });
  it('impedimento estadual não vira correção local', () => {
    const r = montarRaioXAtuacao(base({ vaar: { ...vaar, reprovadas: ['IV'], condIVEstadual: true } }), emissao);
    expect(r.acoes.find(a => a.id === 'VAAR-UF')?.controle).toBe('estadual');
    expect(r.acoes.find(a => a.id === 'VAAR-01')).toBeUndefined();
  });
  it('impedimentos estaduais e locais têm responsabilidades distintas', () => {
    const r = montarRaioXAtuacao(base({ vaar: { ...vaar, reprovadas: ['III', 'IV'], condIVEstadual: true } }), emissao);
    expect(r.acoes.find(a => a.id === 'VAAR-UF')).toBeDefined();
    expect(r.acoes.find(a => a.id === 'VAAR-01')?.titulo).toContain('III');
    expect(r.acoes.find(a => a.id === 'VAAR-01')?.titulo).not.toContain('IV');
  });
  it('VAAR de outro exercício gera lacuna, não impedimento atual', () => {
    const r = montarRaioXAtuacao(base({ vaar }, 2027), emissao);
    expect(r.acoes.some(a => a.id.startsWith('VAAR'))).toBe(false);
    expect(r.lacunas.join(' ')).toContain('diferente de 2027');
  });
  it('campos ausentes de VAAR não viram zero confirmado pelo mapeador', () => {
    const r = montarRaioXAtuacao(base({ vaar: { exercicio: 2026 } }), emissao);
    expect(r.acoes.some(a => a.id.startsWith('VAAR'))).toBe(false);
    expect(r.lacunas.join(' ')).toContain('incompleta');
    expect(r.acoes.map(a => a.id)).toContain('BASE-01');
  });
  it('situação regular permanece em manutenção', () => {
    const r = montarRaioXAtuacao(base({ vaar: { ...vaar, habilitado: true, beneficiario: true, reprovadas: [], complementacao: 500 } }), emissao);
    expect(r.acoes.some(a => a.id.startsWith('VAAR'))).toBe(false);
    expect(r.manutencao.join(' ')).toContain('beneficiária');
  });
  it('usa meta de alfabetização do mesmo ano e não acusa descumprimento de meta futura', () => {
    const r = montarRaioXAtuacao(base({ alfabetizacao: { serie: [{ ano: 2025, valor: 73, meta: 76 }], proximaMeta: { ano: 2026, meta: 77, faltamPontos: 4 } } }), emissao);
    const a = r.acoes.find(a => a.id === 'APRE-01')!;
    expect(a.evidencia.descricao).toContain('3 pontos');
    expect(a.evidencia.descricao).not.toContain('77');
    expect(a.evidencia.periodo).toBe('2025');
  });
  it('meta futura sozinha não gera ação por resultado abaixo de meta', () => {
    const r = montarRaioXAtuacao(base({ alfabetizacao: { serie: [{ ano: 2025, valor: 73, meta: null }], proximaMeta: { ano: 2026, meta: 77 } } }), emissao);
    expect(r.acoes.some(a => a.id === 'APRE-01')).toBe(false);
    expect(r.lacunas.join(' ')).toContain('meta comparável indisponível');
  });
  it('diferenças de universo acionam conciliação antes das ações dependentes', () => {
    const r = montarRaioXAtuacao(base({ vaar, idebEscolas: { ano: 2025, escolas: [], resumo: { total: 13, semResultadoPorParticipacao: 2 } } }), emissao);
    expect(r.acoes[0].id).toBe('CAD-01');
    expect(r.acoes[0].limite).toContain('não comprovam');
    expect(r.acoes.find(a => a.id === 'SAEB-01')?.limite).toContain('não comprova reprovação da rede inteira');
    expect(r.acoes.every(a => a.financeiro.valor === null)).toBe(true);
  });
  it('erros de integridade bloqueiam a emissão; advertências permanecem visíveis', () => {
    const s = base();
    s.qualidade.achados.push({ codigo: 'soma', nivel: 'erro', mensagem: 'Soma inconsistente' });
    expect(() => montarRaioXAtuacao(s, emissao)).toThrow('Emissão interrompida');
    s.qualidade.achados[0].nivel = 'aviso';
    expect(montarRaioXAtuacao(s, emissao).alertas).toContain('Soma inconsistente');
  });
  it('expõe data da base antiga e calendário vencido sem prometer efeito em 2027', () => {
    const s = base(); s.qualidade.coletadoEm = '2026-10-01T12:00:00Z';
    const r = montarRaioXAtuacao(s, emissao);
    expect(r.alertas.join(' ')).toContain('mais de sete dias');
    expect(r.calendario).toContain('encerrou');
    expect(r.coletadoEm).toBe(s.qualidade.coletadoEm);
  });
  it('preserva todas as fichas e pedidos em HTML e escapa texto de entrada', () => {
    const r = montarRaioXAtuacao(base({ vaar }), emissao);
    r.municipio = '<script>alert(1)</script>';
    const exemplar = r.acoes[0];
    r.acoes = Array.from({ length: 15 }, (_, i) => ({ ...exemplar, id: `TESTE-${i}` }));
    const h = generateRaioXAtuacaoHtml(r);
    expect((h.match(/data-acao=/g) ?? []).length).toBe(15);
    expect((h.match(/data-documento=/g) ?? []).length).toBe(r.documentos.length);
    expect(h).not.toContain('<script>');
    expect(h).toContain('&lt;script&gt;');
  });
  it('deduplica documentos preservando vínculo com ações', () => {
    const r = montarRaioXAtuacao(base({ vaar: { ...vaar, reprovadas: ['III', 'IV'], condIVEstadual: true } }), emissao);
    const docs = r.documentos.filter(d => d.nome === 'Aferição oficial das condicionalidades VAAR');
    expect(docs).toHaveLength(1);
    expect(docs[0].acoes).toEqual(expect.arrayContaining(['VAAR-01', 'VAAR-UF']));
  });
});
