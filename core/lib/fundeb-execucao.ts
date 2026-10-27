import { consultarLista, type FonteColetada } from './public-data-fetch';

export interface ContaRreo { exercicio: number; periodo: number; cod_ibge: number; anexo: string; cod_conta: string; conta: string; coluna: string; valor: number }
export interface IndicadorExecucao { nome: string; valor: number | null; unidade: 'BRL' | '%'; origem: string; conta: string; coluna: string }
export interface PeriodoExecucao {
  ano: number; bimestre: number; entregueEm: string | null;
  estado: 'disponivel' | 'parcial' | 'indisponivel' | 'falha_consulta';
  receitaFundeb: number | null; previsaoMunicipal: number | null;
  despesas: { empenhadas: number | null; liquidadas: number | null; pagas: number | null };
  indicadores: IndicadorExecucao[]; fontes: FonteColetada[]; avisos: string[];
  educacaoSiope?: { declaracao: string | null; empenhadas: number | null; liquidadas: number | null; pagas: number | null };
  transferenciasMensais?: Array<{ mes: number; valor: number }>;
  ieiMinimoRreo?: number | null;
}
export interface ExecucaoFundeb {
  atual: PeriodoExecucao; anterior: PeriodoExecucao | null;
  variacaoMesmoBimestre: number | null;
  estimativaAnualFnde: number | null; proporcaoDaEstimativa: number | null;
  saldoDisponivel: null; nota: string;
}
const BASE = 'https://apidatalake.tesouro.gov.br/ords/siconfi/tt/';
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const vazio = (ano: number, bimestre = 0): PeriodoExecucao => ({ ano, bimestre, entregueEm: null, estado: 'indisponivel', receitaFundeb: null, previsaoMunicipal: null, despesas: { empenhadas: null, liquidadas: null, pagas: null }, indicadores: [], fontes: [], avisos: [] });

/** Seleciona uma célula única. Não soma subtotais nem confunde acumulado e bimestre. */
function celula(rows: ContaRreo[], anexo: string, code: string, column: RegExp): ContaRreo | null {
  const found = rows.filter(r => r.anexo === anexo && r.cod_conta === code && column.test(norm(r.coluna)) && Number.isFinite(r.valor));
  return found.length === 1 ? found[0] : null;
}

export function apurarExecucao(rows: ContaRreo[], codigo: string, ano: number, bimestre: number): PeriodoExecucao {
  const result = vazio(ano, bimestre);
  const valid = rows.filter(r => r.exercicio === ano && r.periodo === bimestre && String(r.cod_ibge) === codigo);
  if (!valid.length) return result;
  const receita = celula(valid, 'RREO-Anexo 06', 'TransferenciasDoFUNDEB', /^receitas realizadas/);
  const previsao = celula(valid, 'RREO-Anexo 06', 'TransferenciasDoFUNDEB', /^previsao atualizada/);
  result.receitaFundeb = receita?.valor ?? null;
  result.previsaoMunicipal = previsao?.valor ?? null;
  if (receita) result.indicadores.push({ nome: 'Transferências do Fundeb realizadas, acumuladas', valor: receita.valor, unidade: 'BRL', origem: receita.anexo, conta: receita.cod_conta, coluna: receita.coluna });
  result.transferenciasMensais = valid.filter(r => r.anexo === 'RREO-Anexo 03' && r.cod_conta === 'RREO3TransferenciasDoFUNDEB' && /^<MR(?:-\d+)?>$/.test(r.coluna)).map(r => ({ mes: bimestre * 2 - Number(r.coluna.match(/-(\d+)/)?.[1] ?? 0), valor: r.valor })).filter(r => r.mes > 0 && Number.isFinite(r.valor)).sort((a, b) => a.mes - b.mes);
  const education = valid.filter(r => r.anexo === 'RREO-Anexo 14' && /fundeb|manutencao e desenvolvimento do ensino/.test(norm(r.conta)));
  result.ieiMinimoRreo=celula(valid,'RREO-Anexo 14','ComplementacaoDaUniaoAoFUNDEBEducacaoInfantil',/% minimo a aplicar/)?.valor??null;
  for (const r of education) if (/valor apurado|% aplicado/.test(norm(r.coluna))) result.indicadores.push({ nome: r.conta, valor: Number.isFinite(r.valor) ? r.valor : null, unidade: r.coluna.includes('%') ? '%' : 'BRL', origem: r.anexo, conta: r.cod_conta, coluna: r.coluna });
  // O Anexo 8 não está disponível para todos os entes no Siconfi. O detalhamento
  // só é extraído de uma linha total inequivocamente identificada como Fundeb.
  const total = valid.filter(r => r.anexo === 'RREO-Anexo 08' && /^total das despesas (do|com recursos do) fundeb\b/.test(norm(r.conta)));
  for (const [key, regex] of Object.entries({ empenhadas: /empenhad/, liquidadas: /liquidad/, pagas: /pagas/ })) {
    const matched = total.filter(r => regex.test(norm(r.coluna)) && !/no bimestre/.test(norm(r.coluna)));
    result.despesas[key as keyof PeriodoExecucao['despesas']] = matched.length === 1 && Number.isFinite(matched[0].valor) ? matched[0].valor : null;
  }
  result.estado = result.receitaFundeb !== null && Object.values(result.despesas).every(v => v !== null) ? 'disponivel' : 'parcial';
  if (!valid.some(r => r.anexo === 'RREO-Anexo 08')) result.avisos.push('Anexo 8 não recuperado no Siconfi. Os anexos 6 e 14 oferecem cobertura parcial; não representam conciliação bancária nem o detalhamento integral do Fundeb.');
  if (result.receitaFundeb === null) result.avisos.push('Receita acumulada do Fundeb não identificada de forma única.');
  return result;
}

async function consultarPeriodo(codigo: string, ano: number, bimestre: number, atualizar: boolean): Promise<PeriodoExecucao> {
  const url = BASE + 'rreo?' + new URLSearchParams({ id_ente: codigo, an_exercicio: String(ano), nr_periodo: String(bimestre), co_tipo_demonstrativo: 'RREO' });
  try {
    let response = await consultarLista<ContaRreo>(url, atualizar);
    if (!response.itens.length) response = await consultarLista<ContaRreo>(url.replace('co_tipo_demonstrativo=RREO', 'co_tipo_demonstrativo=RREO+Simplificado'), atualizar);
    return { ...apurarExecucao(response.itens, codigo, ano, bimestre), fontes: response.fontes };
  } catch {
    return { ...vazio(ano, bimestre), estado: 'falha_consulta', avisos: ['Não foi possível consultar a execução deste período. Valor ausente não é zero.'] };
  }
}

export async function coletarExecucaoFundeb(codigo: string, ano: number, estimativaAnualFnde: number | null, atualizar = false): Promise<ExecucaoFundeb> {
  let atual = vazio(ano), anterior: PeriodoExecucao | null = null;
  try {
    const extrato = await consultarLista<{ exercicio: number; periodo: number; entregavel: string; instituicao: string; data_status: string; status_relatorio: string | null }>(BASE + 'extrato_entregas?' + new URLSearchParams({ id_ente: codigo, an_referencia: String(ano) }), atualizar);
    const entrega = extrato.itens.filter(e => e.exercicio === ano && /relatorio resumido/.test(norm(e.entregavel ?? '')) && !/camara/.test(norm(e.instituicao ?? '')) && !/cancel|retir|rascunho/.test(norm(e.status_relatorio ?? ''))).sort((a, b) => b.periodo - a.periodo || b.data_status.localeCompare(a.data_status))[0];
    if (entrega) {
      [atual, anterior] = await Promise.all([consultarPeriodo(codigo, ano, entrega.periodo, atualizar), consultarPeriodo(codigo, ano - 1, entrega.periodo, atualizar)]);
      atual.entregueEm = entrega.data_status;
      atual.fontes.push(...extrato.fontes);
      const uf = UFS[codigo.slice(0, 2)];
      if (uf) {
        const query = `?@Ano_Consulta=${ano}&@Num_Peri=${entrega.periodo}&@Sig_UF='${uf}'&$filter=COD_MUNI%20eq%20${codigo.slice(0, 6)}&$format=json`;
        const base = 'https://www.fnde.gov.br/olinda-ide/servico/DADOS_ABERTOS_SIOPE/versao/v1/odata/';
        const responses = await Promise.allSettled(['Dados_Gerais_Siope', 'Indicadores_Siope'].map(entity => consultarLista<Record<string, unknown>>(base + entity + '(Ano_Consulta=@Ano_Consulta,Num_Peri=@Num_Peri,Sig_UF=@Sig_UF)' + query, atualizar)));
        for (const [index, response] of responses.entries()) {
          if (response.status === 'rejected') { atual.avisos.push('Consulta SIOPE indisponível; conferir recibos e demonstrativos municipais.'); continue; }
          atual.fontes.push(...response.value.fontes);
          const records = response.value.itens.filter(r => r.NUM_ANO === ano && r.NUM_PERI === entrega.periodo && String(r.COD_MUNI) === codigo.slice(0, 6) && r.TIPO === 'Municipal');
          if (index === 0 && records.length === 1) {
            const r = records[0];
            atual.educacaoSiope = { declaracao: typeof r.DAT_DECL === 'string' ? r.DAT_DECL : null, empenhadas: numeroSiope(r.VL_DESP_EMPE_EDU), liquidadas: numeroSiope(r.VL_DESP_LIQU_EDU), pagas: numeroSiope(r.VL_DESP_PAGA_EDU) };
          } else if (index === 1) for (const r of records.filter(r => /^1\.[1-7]$/.test(String(r.COD_EXIB)))) {
            atual.indicadores.push({ nome: String(r.NOM_INDI), valor: numeroSiope(r.VAL_INDI), unidade: '%', origem: 'SIOPE - indicadores do período', conta: String(r.COD_EXIB), coluna: 'VAL_INDI' });
          }
        }
        const ieiSiope=atual.indicadores.find(r=>r.origem.startsWith('SIOPE')&&r.conta==='1.7')?.valor;
        if(ieiSiope!=null&&atual.ieiMinimoRreo!=null&&Math.abs(ieiSiope-atual.ieiMinimoRreo)>.01)atual.avisos.push(`IEI mínimo: ${atual.ieiMinimoRreo}% no RREO e ${ieiSiope}% no SIOPE para o mesmo período. Validar versão e critério; não escolher silenciosamente uma das bases.`);
      }
    } else { atual.fontes = extrato.fontes; atual.avisos.push('Nenhuma entrega RREO identificada para este exercício; não substituída silenciosamente por outro ano.'); }
  } catch { atual.estado = 'falha_consulta'; atual.avisos.push('Extrato de entregas indisponível nesta consulta.'); }
  return { atual, anterior, estimativaAnualFnde,
    variacaoMesmoBimestre: atual.receitaFundeb !== null && anterior?.receitaFundeb != null && anterior.receitaFundeb > 0 ? (atual.receitaFundeb / anterior.receitaFundeb - 1) * 100 : null,
    proporcaoDaEstimativa: atual.receitaFundeb !== null && estimativaAnualFnde !== null && estimativaAnualFnde > 0 ? atual.receitaFundeb / estimativaAnualFnde * 100 : null,
    saldoDisponivel: null, nota: 'Receita realizada declarada não é saldo bancário livre. A proporção da estimativa anual é apenas contextual: calendário, ajustes e escopo podem diferir. Não se presume execução linear de 1/12, economia ou resultado atribuível à consultoria.' };
}

function numeroSiope(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).includes(',') ? String(v).replace(/\./g, '').replace(',', '.') : v);
  return Number.isFinite(n) ? n : null;
}
const UFS: Record<string, string> = { '11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO','21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL','28':'SE','29':'BA','31':'MG','32':'ES','33':'RJ','35':'SP','41':'PR','42':'SC','43':'RS','50':'MS','51':'MT','52':'GO','53':'DF' };
