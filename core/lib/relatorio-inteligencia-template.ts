import type { InteligenciaRelatorio } from './relatorio-inteligencia';
const e = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const n = (v: unknown, digits = 2) => typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: digits }) : 'Não disponível';
const money = (v: number | null | undefined) => v == null ? 'Não disponível' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const table = (head: string[], rows: string[][]) => `<table><thead><tr>${head.map(h => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const note = (s: string) => `<div class="intel-note">${e(s)}</div>`;
const box = (label: string, value: string, detail: string) => `<div><small>${e(label)}</small><b>${e(value)}</b><p>${e(detail)}</p></div>`;
export interface PaginaInteligencia { titulo: string; html: string }

/** Quatro páginas executivas comuns; anexos e arquivo de dados preservam o detalhamento. */
export function paginasInteligencia(i: InteligenciaRelatorio): PaginaInteligencia[] {
  const f = i.financeiro, a = f.atual;
  const periodo = a.bimestre ? `${a.bimestre}º bimestre de ${a.ano}` : `exercício ${a.ano}, período indisponível`;
  const prioritarias = i.escolas.filter(s => s.sinais.length > 0);
  const cond = i.vaar.componentes.find(c => c.tipo === 'condicionalidadeIII');
  const resumo = `<div class="intel-kicker">Síntese executiva / 1 de 4</div><h2>Decisões apoiadas pela base</h2><p>Leitura conjunta das receitas, indicadores e prioridades. Os anexos mantêm o contexto municipal e a memória técnica.</p>
    <div class="intel-grid">${box('Estimativa anual FNDE', money(f.estimativaAnualFnde), `Publicação do exercício ${a.ano}; não é saldo disponível.`)}${box('Transferências realizadas declaradas', money(a.receitaFundeb), `${periodo} · RREO, Anexo 6.`)}</div>
    ${table(['Prioridade', 'O que fazer', 'Evidência e limite'], [
      ['1. Financeiro', 'Conciliar previsão e execução com a contabilidade.', `${e(periodo)}; cobertura ${e(a.estado)}. Despesa da educação e despesa do Fundeb têm universos diferentes.`],
      ['2. VAAR', 'Validar indicadores e pactuar intervenção por causa.', e(cond?.motivo ?? 'Motivo detalhado não recuperado. Conferir a publicação do ciclo.')],
      ['3. Escolas', 'Selecionar as primeiras unidades para validação local.', `${prioritarias.length} escolas com sinais em ${i.escolas.length} códigos reunidos. Critérios e anos na síntese escolar.`],
      ['4. Dados e execução', 'Conciliar cadastros e registrar entregas da consultoria.', `${i.escolas.filter(s => s.verificacaoCadastro).length} códigos com presença diferente nos recortes territorial e de resultados. Não prova omissão.`],
    ])}
    ${note('Resultado financeiro da intervenção: não apurado. Receita adicional, economia, receita preservada e honorários devem ser documentados separadamente. Nenhum desses valores é derivado automaticamente da receita total do Fundeb.')}
    <h3>Atualização e qualidade</h3><p>${i.monitoramento.anteriorEm ? `${i.monitoramento.mudancas.length} alterações na comparação com a coleta anterior (${e(i.monitoramento.anteriorEm.slice(0, 10))}).` : 'Primeira coleta desta camada: linha de base registrada; sem histórico anterior para comparar.'} Os arquivos de dados preservam as fontes, datas de consulta e SHA-256 das novas consultas.</p><p>Dados ausentes permanecem identificados. Cada conclusão deve respeitar o ano, a rede e a competência da informação.</p>`;
  const indicators = a.indicadores.filter(r => r.unidade === '%' && r.origem === 'RREO-Anexo 14');
  const financeiro = `<div class="intel-kicker">Síntese executiva / 2 de 4</div><h2>Previsão e execução financeira</h2><p>${e(periodo)} · acumulado declarado, não extrato bancário.</p>
    ${table(['Medida', 'Valor / situação'], [
      ['Estimativa anual FNDE', money(f.estimativaAnualFnde)], ['Previsão municipal no RREO', money(a.previsaoMunicipal)],
      ['Transferências do Fundeb realizadas (RREO 6)', money(a.receitaFundeb)],
      [`Mesmo bimestre de ${a.ano - 1}`, money(f.anterior?.receitaFundeb)], ['Variação sobre o mesmo bimestre', f.variacaoMesmoBimestre == null ? 'Não calculada' : `${n(f.variacaoMesmoBimestre)}%`],
    ])}
    <h3>Aplicação declarada no período</h3>${table(['Indicador do RREO 14', '% aplicado'], indicators.map(r => [e(r.nome.replace('Mínimo Anual de <18% / 25%> das Receitas de Impostos na Manutenção e Desenvolvimento do Ensino', 'Aplicação em MDE')), n(r.valor)]))}
    <p>Os limites anuais exigem acompanhamento até o fechamento. Um percentual parcial abaixo do mínimo não comprova descumprimento anual. Conferir diferenças entre RREO, SIOPE e portarias.</p>
    <h3>Execução da educação no SIOPE (todas as fontes)</h3>${table(['Empenhada', 'Liquidada', 'Paga'], [[money(a.educacaoSiope?.empenhadas), money(a.educacaoSiope?.liquidadas), money(a.educacaoSiope?.pagas)]] )}
    <p>Estes valores abrangem a educação e não podem ser atribuídos integralmente ao Fundeb. Detalhamento exclusivo do Fundeb: ${Object.values(a.despesas).every(v => v === null) ? 'não recuperado; solicitar Anexo 8 e conciliação por fonte.' : 'consultar arquivo de dados e Anexo 8.'}</p>
    ${note(f.nota)}<p class="intel-source">Fontes: Tesouro/Siconfi, RREO 6 e 14; FNDE/SIOPE. Declaração SIOPE: ${e(a.educacaoSiope?.declaracao ?? 'não recuperada')}. Endereços e hashes no anexo de fontes.</p>`;
  const labels = { condicionalidadeIII: 'Condicionalidade III', atendimento: 'VAAR - Atendimento', aprendizagem: 'VAAR - Aprendizagem' };
  const c = cond?.campos ?? {};
  const proporcao = (key: string) => typeof c[key] === 'number' ? n(Number(c[key]) * 100) + '%' : 'N/D';
  const vaar = `<div class="intel-kicker">Síntese executiva / 3 de 4</div><h2>VAAR: do resultado à intervenção</h2><p>Exercício financeiro ${i.vaar.exercicio}. Os períodos das avaliações são anteriores ao exercício do repasse.</p>
    ${table(['Componente', 'Resultado publicado'], i.vaar.componentes.map(v => [labels[v.tipo], e(v.motivo ?? v.aviso ?? v.estado)]))}
    ${c.Prop_adeq_PPI_2019 != null ? `<h3>Desempenho adequado nos grupos considerados</h3>${table(['Grupo', 'Saeb 2019', 'Saeb 2023'], [['Pretos, pardos e indígenas', proporcao('Prop_adeq_PPI_2019'), proporcao('Prop_adeq_PPI_2023')], ['Baixo nível socioeconômico', proporcao('Prop_adeq_baixo_2019'), proporcao('Prop_adeq_baixo_2023')]])}<p>Proporções e períodos reproduzidos da planilha do Inep. O resultado oficial considera sua metodologia e margens de erro; estas proporções não são uma nova aferição municipal.</p>` : '<p>Componentes detalhados e períodos: consultar os campos preservados no arquivo de dados desta emissão.</p>'}
    <h3>Sequência de trabalho</h3><ol><li>Conferir a metodologia e a competência da publicação com a equipe de avaliação.</li><li>Localizar escolas, etapas e habilidades que precisam de apoio usando avaliações disponíveis e registros municipais.</li><li>Definir intervenção, responsável e medida de acompanhamento; registrar o diagnóstico inicial.</li><li>Conferir a próxima publicação oficial e registrar o resultado sem atribuir causalidade automaticamente.</li></ol>
    ${note('A Condicionalidade I trata da seleção dos gestores escolares. Aprendizagem e desigualdades exigem análise própria. Habilitação e melhoria dos indicadores são verificações distintas; não existe valor recuperável calculado pela mediana de outros municípios.')}
    <p class="intel-source">Fonte: <a href="${e(i.vaar.pagina)}">Inep - indicadores da complementação VAAR ${i.vaar.exercicio}</a>. Os três arquivos e as respectivas versões estão registrados na memória de dados.</p>`;
  const schools = `<div class="intel-kicker">Síntese executiva / 4 de 4</div><h2>Onde começar na rede escolar</h2><p>Primeiras cinco unidades da triagem. A relação completa, com os códigos e as presenças em cada base, acompanha a exportação de dados.</p>
    ${table(['Escola / código INEP', 'Sinais para validação'], prioritarias.slice(0, 5).map(s => [`<b>${e(s.nome)}</b><br>${e(s.codigo)} · ${n(s.matriculas, 0)} matrículas`, s.sinais.map(x => `${e(x.indicador)}: ${n(x.valor)} (${x.ano}); referência ${n(x.referencia)}`).join('<br>')]))}
    <p class="intel-source">${e(i.criteriosEscolas)}</p>
    <h3>Trajetória das matrículas municipais</h3>${table(['Ano do Censo', 'Total', 'Integral', 'EJA'], i.matriculas.slice(-5).map(r => [String(r.ano), n(r.total, 0), n(r.integral, 0), n(r.eja, 0)]))}
    ${note(i.sinaisMatricula[0] ?? 'Sem variação acima do limiar de triagem de 5% entre os anos consecutivos disponíveis. Isso não comprova ausência de problemas cadastrais.')}
    <p>Educação especial, integral e EJA podem se sobrepor. Comparar registros com o mesmo universo; variação de matrícula não identifica evasão individual, demanda de creche ou direito a financiamento.</p>`;
  return [{ titulo: 'Decisões e prioridades', html: resumo }, { titulo: 'Execução financeira', html: financeiro }, { titulo: 'Indicadores VAAR', html: vaar }, { titulo: 'Prioridades escolares', html: schools }].map(p => ({ ...p, html: `<div class="intel">${p.html}</div>` }));
}

export function paginasMemoria(i: InteligenciaRelatorio): PaginaInteligencia[] {
  const pages: PaginaInteligencia[] = [];
  pages.push({ titulo: 'Variações e acompanhamento', html: `<div class="intel"><div class="intel-kicker">Anexo / memória de cálculo</div><h2>O que mudou na receita anual</h2>${table(['Componente', 'Ano-base', 'Ano atual', 'Diferença nominal'], i.variacaoReceita.map(r => [e(r.componente), money(r.antes), money(r.depois), money(r.diferenca)]))}${note('Decomposição contábil das publicações anuais: não demonstra causa, efeito de matrícula ou resultado da consultoria. Revisões das fontes podem alterar o comparativo.')}<h3>Acompanhamento das ações</h3><p>Registrar no painel: responsável, prazo pactuado, situação, entrega, evidência, indicador inicial e resultado observado. A conclusão de uma entrega exige evidência. Resultado financeiro exige memória de cálculo e revisão técnica próprias.</p><h3>Monitoramento das fontes</h3><p>${e(i.monitoramento.nota)}</p>${table(['Alterações', 'Cobertura'], [[String(i.monitoramento.mudancas.length), `${i.monitoramento.fontes.length} consultas com URL, data e checksum.`]])}<h3>Lacunas da execução financeira</h3>${i.financeiro.atual.avisos.map(a => `<p>${e(a)}</p>`).join('')}</div>` });
  for (let offset = 0; offset < i.monitoramento.fontes.length; offset += 5) pages.push({ titulo: 'Fontes da análise executiva', html: `<div class="intel"><div class="intel-kicker">Anexo / rastreabilidade</div><h2>Fontes e versões consultadas</h2>${i.monitoramento.fontes.slice(offset, offset + 5).map(f => `<div class="intel-source-block"><p><a href="${e(f.url)}">${e(f.url)}</a></p><p>Coleta: ${e(f.coletadoEm)}</p><p>SHA-256: ${e(f.sha256)}</p></div>`).join('')}<p>Competências e campos originais estão preservados no arquivo de dados. A data da consulta não atualiza a referência histórica. Referências locais do Censo e dos indicadores escolares mantêm os anos informados nas tabelas.</p></div>` });
  return pages;
}

export const CSS_INTELIGENCIA = `.intel{font:11px/1.43 Arial,sans-serif;color:#203641}.intel h2{font-size:26px;line-height:1.14;margin:8px 0 14px;letter-spacing:-.3px}.intel h3{font-size:14px;color:#176b67;margin:15px 0 8px}.intel p{margin:7px 0}.intel-kicker{font-size:10px;color:#176b67;text-transform:uppercase;letter-spacing:1px;font-weight:bold}.intel table{border-collapse:collapse;table-layout:fixed;width:100%;margin:13px 0}.intel th{background:#143c49;color:#fff;text-align:left;padding:8px;font-size:10px}.intel td{padding:9px 7px;border-bottom:1px solid #dce5e8;font-size:11px;vertical-align:top;overflow-wrap:anywhere}.intel-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.intel-grid>div{padding:14px;background:#eef5f3}.intel-grid b{display:block;font-size:23px;margin:8px 0;color:#143c49}.intel-grid small{font-size:10px}.intel-note{padding:12px;background:#fff5e5;border-left:3px solid #b88738;margin:13px 0;font-size:11px}.intel-source{font-size:9px!important;color:#566f7a;overflow-wrap:anywhere}.intel-source-block{padding:14px 0;border-bottom:1px solid #dce5e8;overflow-wrap:anywhere;font-size:10px}.intel li{margin-bottom:10px}.intel a{color:#176b67}`;
