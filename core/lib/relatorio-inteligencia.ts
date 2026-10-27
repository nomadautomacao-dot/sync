import type { RelatorioSnapshot } from './relatorio-snapshot';
import type { ExecucaoFundeb } from './fundeb-execucao';
import type { IndicadoresVaar } from './fundeb-vaar-indicadores';
import type { FonteColetada } from './public-data-fetch';

type Registro = Record<string, unknown>;
const obj = (v: unknown): Registro => v && typeof v === 'object' && !Array.isArray(v) ? v as Registro : {};
const arr = (v: unknown): Registro[] => Array.isArray(v) ? v.map(obj) : [];
const num = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;
const txt = (v: unknown) => typeof v === 'string' ? v : '';
export interface SinalEscola { indicador: string; valor: number; referencia: number; ano: number; acao: string }
export interface EscolaPrioritaria {
  codigo: string; nome: string; matriculas: number | null;
  bases: { territorio: boolean; resultados: boolean; indicadores: boolean };
  sinais: SinalEscola[]; medidas: SinalEscola[]; verificacaoCadastro: boolean;
}
export interface PontoMatricula { ano: number; total: number; integral: number | null; especial: number | null; eja: number | null; fonte: string }
export interface ObservacaoMonitoramento { id: string; periodo: string; universo: string; valor: number | string | boolean | null; fonte: string }
export interface MudancaMonitoramento { id: string; periodo: string; antes: ObservacaoMonitoramento['valor']; depois: ObservacaoMonitoramento['valor']; tipo: 'valor_alterado' | 'novo_dado' | 'dado_indisponivel' | 'fonte_alterada' }
export interface MonitoramentoRelatorio { consultadoEm: string; anteriorEm: string | null; mudancas: MudancaMonitoramento[]; observacoes: ObservacaoMonitoramento[]; fontes: FonteColetada[]; nota: string }
export interface InteligenciaRelatorio {
  versao: 1; financeiro: ExecucaoFundeb; vaar: IndicadoresVaar;
  escolas: EscolaPrioritaria[]; anosEscolas: Record<string, number | null>; criteriosEscolas: string;
  matriculas: PontoMatricula[]; sinaisMatricula: string[];
  variacaoReceita: Array<{ componente: string; anoBase: number; anoAtual: number; antes: number; depois: number; diferenca: number }>;
  monitoramento: MonitoramentoRelatorio;
}

export function priorizarEscolas(dirigido: Registro): Pick<InteligenciaRelatorio, 'escolas' | 'anosEscolas' | 'criteriosEscolas'> {
  const territorio = obj(dirigido.escolasTerritorio), resultados = obj(dirigido.idebEscolas), indicadores = obj(dirigido.indicadoresEscolas);
  const years = obj(indicadores.anos);
  const map = new Map<string, EscolaPrioritaria>();
  function school(row: Registro): EscolaPrioritaria | null {
    const codigo = String(row.codigo ?? '');
    if (!/^\d{8}$/.test(codigo)) return null;
    if (!map.has(codigo)) map.set(codigo, { codigo, nome: txt(row.nome) || `Escola ${codigo}`, matriculas: null, bases: { territorio: false, resultados: false, indicadores: false }, sinais: [], medidas: [], verificacaoCadastro: false });
    const s = map.get(codigo)!;
    if (txt(row.nome)) s.nome = txt(row.nome);
    return s;
  }
  for (const r of arr(territorio.escolas)) { const s = school(r); if (s) { s.bases.territorio = true; s.matriculas = num(r.matriculas); } }
  for (const r of arr(resultados.escolas)) {
    const s = school(r); if (!s) continue;
    s.bases.resultados = true;
    for (const etapa of ['ai', 'af']) if (obj(r[etapa]).nd === true && num(resultados.ano) !== null) s.sinais.push({ indicador: `Resultado não divulgado (${etapa.toUpperCase()})`, valor: 1, referencia: 0, ano: Number(resultados.ano), acao: 'Conferir o motivo oficial e a participação; ausência de resultado não prova reprovação da rede no VAAR.' });
  }
  const rows = arr(indicadores.escolas);
  const median = (field: string) => {
    const values = rows.map(r => num(r[field])).filter((v): v is number => v !== null).sort((a, b) => a - b);
    return values.length ? (values[Math.floor((values.length - 1) / 2)] + values[Math.floor(values.length / 2)]) / 2 : null;
  };
  const checks = [
    { field: 'abandonoFund', ano: years.rendimento, nome: 'Abandono no fundamental (%)', direction: 'maior', acao: 'Validar frequência e organizar busca ativa com a rede de proteção.' },
    { field: 'tdiFund', ano: years.tdi, nome: 'Distorção idade-série (%)', direction: 'maior', acao: 'Analisar trajetórias e necessidades de recomposição por etapa.' },
    { field: 'docentesAdequadosFund', ano: years.afd, nome: 'Adequação docente (%)', direction: 'menor', acao: 'Conferir lotação, componentes curriculares e necessidades de formação.' },
  ];
  for (const r of rows) {
    const s = school(r); if (!s) continue;
    s.bases.indicadores = true;
    for (const c of checks) {
      const value = num(r[c.field]), ref = median(c.field), year = num(c.ano);
      if (value === null || ref === null || year === null) continue;
      s.medidas.push({ indicador: c.nome, valor: value, referencia: ref, ano: year, acao: c.acao });
      if ((c.direction === 'maior' && value > ref) || (c.direction === 'menor' && value < ref)) s.sinais.push({ indicador: c.nome, valor: value, referencia: ref, ano: year, acao: c.acao });
    }
  }
  const escolas = [...map.values()];
  for (const s of escolas) s.verificacaoCadastro = s.bases.territorio !== s.bases.resultados;
  escolas.sort((a, b) => b.sinais.length - a.sinais.length || (b.matriculas ?? -1) - (a.matriculas ?? -1) || a.codigo.localeCompare(b.codigo));
  return { escolas, anosEscolas: { territorio: num(territorio.ano), resultados: num(resultados.ano), ...Object.fromEntries(Object.entries(years).map(([k, v]) => [k, num(v)])) }, criteriosEscolas: 'Triagem por quantidade de sinais; desempate pelo número de matrículas informado. Abandono e distorção acima da mediana do recorte escolar disponível; adequação docente abaixo dessa mediana; resultado não divulgado. Não é nota de qualidade, ranking causal ou prova de irregularidade. Cada indicador mantém seu ano; diferenças de cadastro podem refletir etapas e critérios de publicação.' };
}

export function compararObservacoes(antes: ObservacaoMonitoramento[], depois: ObservacaoMonitoramento[]): MudancaMonitoramento[] {
  const key = (o: ObservacaoMonitoramento) => `${o.id}|${o.periodo}|${o.universo}`;
  const prev = new Map(antes.map(o => [key(o), o]));
  const out: MudancaMonitoramento[] = [];
  for (const o of depois) {
    const p = prev.get(key(o));
    if (!p) out.push({ id: o.id, periodo: o.periodo, antes: null, depois: o.valor, tipo: 'novo_dado' });
    else if (p.valor !== o.valor) out.push({ id: o.id, periodo: o.periodo, antes: p.valor, depois: o.valor, tipo: o.valor === null ? 'dado_indisponivel' : 'valor_alterado' });
    else if (p.fonte !== o.fonte) out.push({ id: o.id, periodo: o.periodo, antes: p.fonte, depois: o.fonte, tipo: 'fonte_alterada' });
  }
  const current = new Set(depois.map(key));
  for (const p of antes) if (!current.has(key(p))) out.push({ id: p.id, periodo: p.periodo, antes: p.valor, depois: null, tipo: 'dado_indisponivel' });
  return out;
}

export function montarInteligencia(snapshot: RelatorioSnapshot, financeiro: ExecucaoFundeb, vaar: IndicadoresVaar, anterior?: MonitoramentoRelatorio | null): InteligenciaRelatorio {
  const d = obj(snapshot.current.payload.relatorio_dirigido_base), historico = arr(obj(d.historico).anos);
  const matriculas: PontoMatricula[] = [];
  for (const r of historico) {
    const ano = num(r.anoBaseCenso), total = num(r.totalMatriculasMunicipais);
    if (ano === null || total === null || matriculas.some(p => p.ano === ano)) continue;
    matriculas.push({ ano, total, integral: num(r.tempoIntegral), especial: num(r.educacaoEspecial), eja: num(r.eja), fonte: 'Inep - série municipal integrada; conferir recorte e revisão do Censo.' });
  }
  matriculas.sort((a, b) => a.ano - b.ano);
  const sinaisMatricula: string[] = [];
  for (let i = 1; i < matriculas.length; i++) {
    const a = matriculas[i - 1], b = matriculas[i];
    if (b.ano !== a.ano + 1 || a.total <= 0) continue;
    const pct = (b.total / a.total - 1) * 100;
    if (Math.abs(pct) >= 5) sinaisMatricula.push(`${a.ano}–${b.ano}: total municipal variou ${pct.toFixed(1)}%. Limiar de triagem de 5%; conferir oferta, migração, recorte e revisão da base. Não equivale a evasão nem erro cadastral.`);
    for(const [key,label] of [['integral','Tempo integral'],['especial','Educação especial'],['eja','EJA']] as const) {
      const antes=a[key],depois=b[key];
      if(antes===null||depois===null||antes<=0)continue;
      const variacao=(depois/antes-1)*100;
      if(Math.abs(variacao)>=20)sinaisMatricula.push(`${label}, ${a.ano}–${b.ano}: ${variacao.toFixed(1)}%. Limiar de triagem de 20% por modalidade; validar recortes e oferta. Categorias não aditivas; não comprova erro nem receita recuperável.`);
    }
  }
  const variacaoReceita: InteligenciaRelatorio['variacaoReceita'] = [];
  const rec = snapshot.current.relatorio.receitas, previous = snapshot.base?.relatorio.receitas;
  if (rec && previous) for (const [key, componente] of Object.entries({ receitaContribuicaoMunicipal: 'Redistribuição do fundo', complementacaoVAAF: 'Complementação VAAF', complementacaoVAAT: 'Complementação VAAT', complementacaoVAAR: 'Complementação VAAR' })) {
    const k = key as keyof typeof rec, antes = num(previous[k]), depois = num(rec[k]);
    if (antes !== null && depois !== null) variacaoReceita.push({ componente, anoBase: snapshot.base!.relatorio.identificacao.exercicio, anoAtual: snapshot.current.relatorio.identificacao.exercicio, antes, depois, diferenca: depois - antes });
  }
  const escolas = priorizarEscolas(d);
  const observacoes: ObservacaoMonitoramento[] = snapshot.qualidade.evidencias.map(e => ({ id: e.id, periodo: e.periodo ?? 'não informado', universo: e.universo, valor: e.valor, fonte: e.url ?? e.fonte }));
  observacoes.push({ id: 'fundeb.receita_realizada', periodo: `${financeiro.atual.ano}/${financeiro.atual.bimestre}B`, universo: 'ente municipal - RREO Anexo 6', valor: financeiro.atual.receitaFundeb, fonte: financeiro.atual.fontes[0]?.url ?? 'Siconfi indisponível' });
  for (const c of vaar.componentes) for (const [key, value] of Object.entries(c.campos)) observacoes.push({ id: `vaar.${c.tipo}.${key}`, periodo: String(vaar.exercicio), universo: 'rede municipal conforme nota do Inep', valor: value, fonte: c.fonte?.url ?? vaar.pagina });
  for (const e of escolas.escolas) for (const s of e.medidas) observacoes.push({ id: `escola.${e.codigo}.${s.indicador}`, periodo: String(s.ano), universo: 'escola municipal', valor: s.valor, fonte: 'Inep - recortes escolares integrados' });
  const fontes = [...financeiro.atual.fontes, ...(financeiro.anterior?.fontes ?? []), ...vaar.componentes.flatMap(c => c.fonte ? [c.fonte] : [])];
  return { versao: 1, financeiro, vaar, ...escolas, matriculas, sinaisMatricula, variacaoReceita,
    monitoramento: { consultadoEm: new Date().toISOString(), anteriorEm: anterior?.consultadoEm ?? null, observacoes, fontes, mudancas: anterior ? compararObservacoes(anterior.observacoes, observacoes) : [], nota: 'Comparação entre coletas no mesmo período e universo. Uma alteração publicada não é ganho da consultoria. Primeira coleta estabelece a linha de base. Dados históricos ausentes no novo recorte exigem conferência, não exclusão automática.' } };
}
