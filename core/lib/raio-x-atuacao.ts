import type { InteligenciaRelatorio } from './relatorio-inteligencia';
import type { RegistroAcao } from '@/modules/levantamento-fundeb/acompanhamento';
import type { RelatorioSnapshot } from './relatorio-snapshot';
import { mapMunicipalXrayModel } from './municipal-xray-template';
import { exigirQualidade } from './qualidade-dados';
import { situacaoCalendario } from './calendario-educacional';

export const VERSAO_ATUACAO = '2.0.0';
export interface EvidenciaAtuacao {
  descricao: string; fonte: string; url: string; periodo: string; universo: string;
}
export interface AcaoAtuacao {
  id: string; titulo: string; area: string; prioridade: 'P0' | 'P1' | 'P2';
  natureza: 'validacao' | 'planejamento' | 'articulacao';
  status: 'proposta_a_validar'; controle: 'municipal' | 'compartilhado' | 'estadual';
  evidencia: EvidenciaAtuacao; limite: string; passos: string[];
  equipe: string; contraparte: string; documentos: string[]; dependencias: string[];
  entrega: string; aceite: string; indicador: string;
  prazoOperacional: string; prazoNormativo: string; efeito: string;
  financeiro: { estado: 'nao_estimado'; valor: null; justificativa: string };
  escolas?: string[];
}
export interface RaioXAtuacao {
  inteligencia?: InteligenciaRelatorio;
  acompanhamento?: RegistroAcao[];
  versao: string; municipio: string; uf: string; codigoIbge: string; exercicio: number;
  geradoEm: string; coletadoEm: string; snapshotId: string; versaoFonte: string;
  acoes: AcaoAtuacao[]; manutencao: string[]; lacunas: string[]; alertas: string[];
  documentos: Array<{ nome: string; acoes: string[] }>;
  calendario: string;
}

const URLS = {
  censo: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/censo-escolar',
  ideb: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados',
  alfabetizacao: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/alfabetiza-brasil',
  siope: 'https://www.gov.br/fnde/pt-br/assuntos/sistemas/siope',
  siconfi: 'https://siconfi.tesouro.gov.br/',
  cauc: 'https://siconfi.tesouro.gov.br/siconfi/pages/public/sti/iframe_sti.jsf',
};
const n = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v);
const ano = (v: number | null | undefined) => v && v > 1900 ? String(v) : 'Referência a confirmar';

type Proposta = Pick<AcaoAtuacao, 'id' | 'titulo' | 'area' | 'evidencia' | 'limite' | 'passos' | 'equipe' | 'contraparte' | 'documentos' | 'entrega' | 'aceite' | 'indicador'> &
  Partial<Pick<AcaoAtuacao, 'prioridade' | 'natureza' | 'controle' | 'dependencias' | 'prazoNormativo' | 'prazoOperacional' | 'efeito'>>;

/** Regras determinísticas. Não herda valores potenciais, notas ou narrativas dos PDFs antigos. */
export function montarRaioXAtuacao(snapshot: RelatorioSnapshot, geradoEm = new Date()): RaioXAtuacao {
  if (!Number.isFinite(geradoEm.getTime()) || !Number.isFinite(Date.parse(snapshot.qualidade.coletadoEm))) {
    throw new Error('Data de emissão ou coleta inválida.');
  }
  exigirQualidade(snapshot.qualidade.achados);
  const exercicio = Number(snapshot.current.relatorio.identificacao.exercicio);
  if (!Number.isInteger(exercicio) || exercicio < 2000) throw new Error('Exercício da base inválido.');
  const m = mapMunicipalXrayModel({ currentPayload: snapshot.current.payload, basePayload: snapshot.base?.payload ?? {},
    currentYear: exercicio, baseYear: exercicio - 1, generatedAt: geradoEm, qualidade: snapshot.qualidade, profile: snapshot.profile });
  const fundebUrl = `https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/${exercicio}`;
  const acoes: AcaoAtuacao[] = [], manutencao: string[] = [], lacunas: string[] = [];
  const mensagemQualidade = (a: { codigo: string; mensagem: string }) => a.codigo.startsWith('consulta_')
    ? a.mensagem.replace(/:\s*(fetch failed|.*timeout.*)$/i, ': consulta indisponível nesta coleta') : a.mensagem;
  const alertas = snapshot.qualidade.achados.map(mensagemQualidade);
  if (geradoEm.getTime() - Date.parse(snapshot.qualidade.coletadoEm) > 7 * 86400_000) alertas.push('Base coletada há mais de sete dias: atualizar antes de iniciar o plano.');
  const calendario = situacaoCalendario(exercicio, geradoEm).texto;
  const ev = (descricao: string, fonte: string, url: string, periodo: string, universo = 'Rede municipal') => ({ descricao, fonte, url, periodo, universo });
  const add = (p: Proposta) => acoes.push({ prioridade: 'P2', natureza: 'planejamento', controle: 'municipal',
    status: 'proposta_a_validar', dependencias: ['Validação da evidência e aprovação do plano pela equipe municipal.'],
    prazoOperacional: 'Dimensionar esforço e prazo após a validação documental.',
    prazoNormativo: 'Confirmar norma e calendário do ciclo aplicável antes de fixar a data.',
    efeito: 'Sem exercício financeiro de efeito confirmado.',
    financeiro: { estado: 'nao_estimado', valor: null, justificativa: 'Sem base validada para atribuir receita adicional, receita preservada ou economia a esta ação. Custos e honorários ainda não dimensionados.' }, ...p });

  const contagens = [m.schools, m.schoolMap?.total, m.schoolResults?.total].filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (new Set(contagens).size > 1) add({ id: 'CAD-01', titulo: 'Conciliar os cadastros de escolas', area: 'Dados e Censo', prioridade: 'P0', natureza: 'validacao',
    evidencia: ev(`Consolidado: ${m.schools == null ? 'N/D' : n(m.schools)} (${ano(m.enrollmentYear)}); território: ${m.schoolMap ? n(m.schoolMap.total) : 'N/D'} (${ano(m.schoolMap?.year)}); resultados: ${m.schoolResults ? n(m.schoolResults.total) : 'N/D'} (${ano(m.schoolResults?.year)}).`, 'Inep - recortes integrados', URLS.censo, 'Períodos indicados em cada recorte', 'Recortes distintos; conciliar por código INEP'),
    limite: 'Contagens diferentes não comprovam escolas omitidas nem matrículas perdidas.',
    passos: ['Obter os cadastros com código INEP, dependência administrativa, ano e funcionamento.', 'Cruzar registros e justificar cada inclusão ou exclusão.', 'Fixar o universo usado pelos demais diagnósticos.'],
    equipe: 'Analista de dados e técnico de Censo', contraparte: 'Cadastro escolar da SME', documentos: ['Cadastros de escolas por código INEP', 'Recibos e relatórios do Educacenso'],
    entrega: 'Cadastro conciliado e memória das diferenças.', aceite: 'Cada diferença explicada; período e universo documentados.', indicador: 'Registros divergentes sem justificativa.', prazoOperacional: 'Primeira etapa, antes das análises por escola.' });

  const v = m.vaar;
  const registroVaar = snapshot.current.payload.relatorio_dirigido_base?.vaar;
  const vaarCompleto = typeof registroVaar?.habilitado === 'boolean' && typeof registroVaar?.beneficiario === 'boolean'
    && typeof registroVaar?.complementacao === 'number' && Number.isFinite(registroVaar.complementacao);
  if (!v || v.year !== exercicio || !vaarCompleto) lacunas.push(`VAAR: ${v && v.year !== exercicio ? `base de ${ano(v.year)}, diferente de ${exercicio}` : 'situação não recuperada ou incompleta'}. Conferir a publicação do exercício.`);
  else if (!v.qualified || !v.beneficiary) {
    const estadual = v.stateWideFailure && v.failed.includes('IV');
    const locais = v.failed.filter(c => !(estadual && c === 'IV'));
    if (estadual) add({ id: 'VAAR-UF', titulo: 'Articular o impedimento estadual do VAAR', area: 'Institucional', prioridade: 'P1', natureza: 'articulacao', controle: 'estadual',
      evidencia: ev('A base registra impedimento estadual na Condicionalidade IV.', 'FNDE - habilitação VAAR', fundebUrl, ano(v.year), 'Estado e redes municipais abrangidas'),
      limite: 'Uma alteração cadastral municipal não resolve o impedimento estadual.', passos: ['Confirmar o ato e a situação vigente.', 'Formalizar demanda e acompanhar as providências estaduais.'], equipe: 'Coordenação e jurídico', contraparte: 'SME e órgãos estaduais competentes', documentos: ['Aferição oficial das condicionalidades VAAR'], dependencias: ['Ato e providências sob responsabilidade do estado.'], entrega: 'Nota de dependência estadual e agenda de articulação.', aceite: 'Impedimento e responsáveis confirmados; encaminhamento documentado.', indicador: 'Situação oficial do requisito estadual.' });
    if (locais.length || !estadual) add({ id: 'VAAR-01', titulo: locais.length ? `Investigar o impedimento VAAR: ${locais.join(', ')}` : 'Investigar habilitação e distribuição do VAAR', area: 'Pedagógico, dados e jurídico', prioridade: 'P1',
      evidencia: ev(`VAAR informado na base: R$ ${n(v.amount)}. ${v.pendency ?? (locais.length ? `Condicionalidades registradas: ${locais.join(', ')}.` : 'Sem motivo suficiente para concluir a causa do não recebimento.')}`, 'FNDE - habilitação e distribuição VAAR', fundebUrl, ano(v.year)),
      limite: 'A mediana de outros municípios não é perda recuperável. Habilitação e evolução dos indicadores são etapas distintas; não há garantia de repasse.',
      passos: ['Conferir a publicação vigente, o motivo e a metodologia de aferição.', locais.includes('III') ? 'Analisar desigualdades socioeconômicas e raciais de aprendizagem e os grupos/escolas envolvidos.' : 'Revisar os requisitos específicos indicados na aferição; não presumir causa pedagógica.', 'Definir intervenções e evidências para o ciclo aplicável, com a SME.'],
      equipe: 'Pedagógico, analista de dados e apoio jurídico', contraparte: 'Avaliação e gestão educacional da SME', documentos: ['Aferição oficial das condicionalidades VAAR', 'Indicadores de atendimento, aprendizagem e equidade'],
      entrega: 'Diagnóstico do impedimento e plano de intervenção.', aceite: 'Causa validada e plano aprovado. Eventual efeito financeiro depende de aferição oficial posterior.', indicador: 'Situação oficial das condicionalidades e evolução dos indicadores.', dependencias: ['Dados de avaliação disponíveis e metodologia do ciclo.', 'Execução das medidas pela rede e aferição pelos órgãos competentes.'] });
  } else manutencao.push(`VAAR ${v.year}: base registra rede habilitada e beneficiária. Monitorar requisitos e indicadores do próximo ciclo.`);

  if (!m.vaat || m.vaat.year !== exercicio) lacunas.push('VAAT: situação do exercício não confirmada na base.');
  else if (/inabilit|n[aã]o habilit/i.test(m.vaat.status)) add({ id: 'VAAT-01', titulo: 'Apurar a pendência de habilitação ao VAAT', area: 'Contábil e financeiro', prioridade: 'P1',
    evidencia: ev(`${m.vaat.status}. ${m.vaat.pendency ?? 'Motivo detalhado a confirmar.'}`, 'FNDE - habilitação VAAT', fundebUrl, ano(m.vaat.year)), limite: 'Regularizar uma pendência não garante complementação nem crédito retroativo.',
    passos: ['Conferir a lista vigente e o exercício contábil exigido.', 'Identificar a obrigação pendente e os recibos de transmissão.', 'Planejar saneamento com a contabilidade dentro do ciclo permitido.'], equipe: 'Contábil e apoio jurídico', contraparte: 'Contabilidade municipal e SME', documentos: ['Recibos SIOPE e Siconfi', 'Lista oficial de habilitação VAAT'], entrega: 'Mapa da pendência e providências documentadas.', aceite: 'Protocolo válido e situação conferida na fonte competente.', indicador: 'Situação de habilitação oficial, sem presumir receita.' });
  else if (/^habilitad/i.test(m.vaat.status)) manutencao.push(`VAAT ${m.vaat.year}: habilitação registrada; manter entregas e conferir a publicação seguinte.`);
  else lacunas.push('VAAT: descrição sem classificação conclusiva; validar status oficial.');

  const l = m.literacy?.latest;
  if (!l) lacunas.push('Alfabetização: resultado e meta do mesmo exercício não disponíveis.');
  else if (l.target != null && l.value < l.target) add({ id: 'APRE-01', titulo: 'Planejar a recomposição da alfabetização', area: 'Pedagógico', prioridade: 'P1',
    evidencia: ev(`${n(l.value)}% em ${l.year}; meta do mesmo ano: ${n(l.target)}%; distância: ${n(l.target - l.value)} pontos percentuais.`, 'Inep - Indicador Criança Alfabetizada', URLS.alfabetizacao, ano(l.year)),
    limite: 'Resultado histórico não comprova a situação do ano corrente. Não confundir aprendizagem com a Condicionalidade I, que trata da seleção de gestores.',
    passos: ['Validar resultado, participação e meta do mesmo ano.', 'Localizar habilidades e turmas que precisam de apoio, com avaliação diagnóstica.', 'Organizar formação e acompanhamento com avaliações comparáveis.'], equipe: 'Coordenação pedagógica e dados', contraparte: 'Alfabetização da SME e coordenações escolares', documentos: ['Avaliações de alfabetização por escola e habilidade', 'Plano de formação e acompanhamento pedagógico'], entrega: 'Plano de recomposição com linha de base e rotina de acompanhamento.', aceite: 'Diagnóstico validado e rotina implantada; melhoria aferida separadamente.', indicador: 'Percentual alfabetizado e evolução por habilidade, com período e participação.' });
  else if (l.target != null) manutencao.push(`Alfabetização ${l.year}: resultado atinge a meta daquele exercício; acompanhar o ciclo atual.`);
  else lacunas.push(`Alfabetização ${l.year}: meta comparável indisponível; não emitir veredito.`);

  if (m.schoolResults?.ndCount) add({ id: 'SAEB-01', titulo: 'Verificar participação nas avaliações', area: 'Pedagógico e operação',
    evidencia: ev(`${n(m.schoolResults.ndCount)} escola(s) sinalizada(s) por participação no recorte de ${n(m.schoolResults.total)} escolas.`, 'Inep - resultados por escola', URLS.ideb, ano(m.schoolResults.year), 'Escolas presentes na base de resultados'),
    limite: 'Esse registro histórico não comprova reprovação da rede inteira na Condicionalidade II.',
    passos: ['Confirmar motivo, edição e situação atual de cada escola sinalizada.', 'Verificar público elegível, frequência e barreiras de participação.', 'Preparar logística da próxima aplicação conforme o calendário oficial.'], equipe: 'Dados e coordenação pedagógica', contraparte: 'Direções escolares e avaliação da SME', documentos: ['Resultados e participação no Saeb por escola', 'Registros de frequência e planejamento de aplicação'], entrega: 'Plano de participação das escolas confirmadas.', aceite: 'Causas documentadas, responsáveis designados e logística validada.', indicador: 'Participantes sobre público elegível por escola e etapa.' });

  const d = m.demographics;
  if (d && d.crechePop > 0 && d.crecheEnrollment != null) add({ id: 'DEM-01', titulo: 'Validar a demanda e a viabilidade de creche', area: 'Planejamento e financeiro', natureza: 'validacao',
    evidencia: ev(`${n(d.crecheEnrollment)} matrículas municipais (${ano(m.enrollmentYear)}); população de 0 a 3 anos: ${n(d.crechePop)} (2022).`, 'Inep e IBGE - referências distintas', URLS.censo, `${ano(m.enrollmentYear)} / 2022`, 'Matrículas municipais e população residente; universos diferentes'),
    limite: 'Não é contagem de crianças excluídas. A diferença não autoriza calcular vagas elegíveis ou receita adicional.',
    passos: ['Conciliar fila, idade, residência, outras redes e demanda manifesta.', 'Conferir vagas e capacidade física e de pessoal.', 'Dimensionar expansão, investimento e custeio somente para demanda comprovada.'], equipe: 'Planejamento, dados e financeiro', contraparte: 'Educação infantil, infraestrutura e orçamento da SME', documentos: ['Fila atual de creche, vagas e critérios de atendimento', 'Capacidade física, quadro de pessoal e custos por unidade'], entrega: 'Mapa da demanda comprovada e estudo de viabilidade.', aceite: 'Demanda, capacidade e custos documentados antes de qualquer simulação.', indicador: 'Demanda validada, vagas disponíveis e custo incremental por vaga.' });
  else lacunas.push('Creche: dados demográficos ou matrículas insuficientes para estudar demanda.');

  const ind = m.schoolMap?.raceTotals?.indigenous;
  const segmento = m.peoples?.indigenous.enrolled;
  if (ind != null && segmento != null && ind > segmento) add({ id: 'CENSO-01', titulo: 'Conferir classificações e universos do Censo', area: 'Censo, pedagógico e jurídico', natureza: 'validacao',
    evidencia: ev(`${n(ind)} matrículas com declaração indígena no recorte escolar; ${n(segmento)} no segmento comparado. Diferença descritiva: ${n(ind - segmento)}.`, 'Inep / FNDE - recortes integrados', URLS.censo, `Recorte escolar ${ano(m.schoolMap?.year)}; período do segmento a confirmar`, 'Cor/raça e classificação escolar são conceitos diferentes'),
    limite: 'A diferença não comprova erro, elegibilidade ou perda financeira. Autodeclaração não autoriza reenquadrar a escola.',
    passos: ['Conferir competência, universo e critérios de cada classificação.', 'Solicitar os documentos escolares e verificar aderência à realidade.', 'Registrar correções somente quando cabíveis e dentro da etapa permitida.'], equipe: 'Técnico de Censo e apoio pedagógico/jurídico', contraparte: 'Cadastro da SME e responsáveis escolares', documentos: ['Recibos e relatórios do Educacenso', 'Documentação de classificação e funcionamento das escolas'], entrega: 'Parecer de consistência dos registros.', aceite: 'Cada classificação sustentada por documentação, inclusive quando nenhuma alteração é necessária.', indicador: 'Registros verificados e inconsistências efetivamente confirmadas.', prazoNormativo: calendario });

  const fiscais: string[] = [];
  if (m.siope?.stale) fiscais.push(`SIOPE: referência ${ano(m.siope.year)} sinalizada como defasada na base`);
  for (const i of m.siope?.indicators ?? []) if (i.compliant === false) fiscais.push(`${i.label}: ${n(i.value)} (${ano(m.siope?.year)})`);
  if (m.cauc?.pendingEducation.length) fiscais.push(`CAUC: itens ${m.cauc.pendingEducation.map(i => i.code).join(', ')}; consulta ${m.cauc.queriedAt ?? 'sem data'}`);
  if (m.fiscalTimeliness && m.fiscalTimeliness.risk !== 'baixo') fiscais.push(`Histórico DCA com sinal de risco ${m.fiscalTimeliness.risk}`);
  if (fiscais.length) add({ id: 'FISC-01', titulo: 'Conferir pendências e execução educacional', area: 'Contábil e financeiro', prioridade: 'P1', natureza: 'validacao',
    evidencia: ev(fiscais.join('; '), 'SIOPE / Siconfi / CAUC', URLS.siconfi, 'Referências indicadas em cada registro', 'Declarações e extratos fiscais'),
    limite: 'Base defasada pode refletir atraso de atualização da fonte. Pendência CAUC não demonstra automaticamente perda de VAAT.',
    passos: ['Obter recibos e extratos atuais.', 'Conciliar cada alerta com demonstrativos e justificativas.', 'Definir saneamento somente para pendências confirmadas.'], equipe: 'Contábil e apoio jurídico', contraparte: 'Contabilidade municipal e SME', documentos: ['Recibos SIOPE e Siconfi', 'Extrato CAUC atualizado e demonstrativos educacionais'], entrega: 'Matriz de pendências confirmadas e providências.', aceite: 'Cada sinal conciliado com evidência atual e encaminhamento cabível.', indicador: 'Pendências confirmadas, resolvidas e aguardando atualização da fonte.' });
  if (m.fiscalTimeliness?.risk === 'baixo') manutencao.push('DCA: histórico consultado com risco baixo; preservar a rotina de entrega e os recibos.');
  if (!m.siope) lacunas.push('SIOPE: vinculações e execução sem dados nesta emissão.');
  if (!m.cauc) lacunas.push('CAUC: extrato não recuperado; não concluir regularidade ou pendência.');

  if (m.stalledWorks?.stalled) add({ id: 'OBRA-01', titulo: 'Diagnosticar a situação das obras educacionais', area: 'Planejamento e articulação', prioridade: 'P1', controle: 'compartilhado',
    evidencia: ev(`${n(m.stalledWorks.stalled)} obra(s) sinalizada(s) como parada(s).`, 'FNDE - obras', fundebUrl, 'Data e situação de cada obra a confirmar', 'Obras educacionais registradas'),
    limite: 'Valor de obra não é caixa recuperável. Retomada depende de requisitos técnicos e programa vigente.',
    passos: ['Conferir situação atual, contratos, medições e pendências de cada obra.', 'Solicitar avaliação técnica e verificar instrumentos de retomada existentes.', 'Propor encaminhamento com engenharia e gestão municipal.'], equipe: 'Planejamento e apoio jurídico', contraparte: 'Engenharia, infraestrutura e SME', documentos: ['Contratos, medições e situação atual das obras'], entrega: 'Diagnóstico por obra e encaminhamento técnico.', aceite: 'Causa, responsável e alternativa de encaminhamento documentados.', indicador: 'Obras com diagnóstico e encaminhamento formal.', dependencias: ['Avaliação de engenharia, orçamento municipal e regras do instrumento federal.'] });

  for (const a of snapshot.qualidade.achados) if (a.codigo.startsWith('consulta_') || a.codigo === 'referencias_historicas') lacunas.push(mensagemQualidade(a));
  const obrigatorios = [m.vaar?.year === exercicio && vaarCompleto, m.vaat?.year === exercicio, Boolean(m.siope), Boolean(m.literacy), Boolean(m.schoolResults)];
  if (!obrigatorios.some(Boolean)) add({ id: 'BASE-01', titulo: 'Completar a base antes de definir intervenções', area: 'Dados', prioridade: 'P0', natureza: 'validacao',
    evidencia: ev('Fontes essenciais não disponíveis para este exercício.', 'Registro da coleta', fundebUrl, String(exercicio)), limite: 'Ausência de dados não comprova descumprimento nem ausência de oportunidade.',
    passos: ['Reconsultar fontes essenciais e registrar falhas.', 'Solicitar documentos mínimos e validar competência.', 'Reemitir o diagnóstico após completar a base.'], equipe: 'Analista de dados', contraparte: 'Equipe técnica da SME', documentos: ['Recibos e relatórios do Educacenso', 'Recibos SIOPE e Siconfi', 'Aferição oficial das condicionalidades VAAR'], entrega: 'Base mínima rastreável.', aceite: 'Fontes, períodos e universos documentados.', indicador: 'Fontes essenciais disponíveis e validadas.' });
  if(snapshot.inteligencia) {
    const intel = snapshot.inteligencia, f = intel.financeiro.atual;
    add({id:'FIN-01',titulo:'Conciliar a execução da educação e do Fundeb',area:'Contábil e dados',prioridade:'P1',natureza:'validacao',
      evidencia:ev(f.receitaFundeb===null?'Receita acumulada do Fundeb não recuperada.':`Transferências do Fundeb declaradas: R$ ${n(f.receitaFundeb)}; cobertura ${f.estado}.`,'Tesouro/Siconfi e FNDE/SIOPE',f.fontes[0]?.url??URLS.siconfi,`${f.bimestre||'não informado'}º bimestre de ${f.ano}`,'Ente municipal; despesa da educação e Fundeb separados'),
      limite:'Receita declarada não é saldo livre. Percentual parcial abaixo do mínimo anual pede acompanhamento, não conclusão de descumprimento.',
      passos:['Conciliar RREO, SIOPE, portarias e créditos bancários por origem e competência.','Obter o Anexo 8 e separar despesas empenhadas, liquidadas, pagas e restos a pagar por fonte.','Documentar diferenças e acompanhar os indicadores até o fechamento.'],
      equipe:'Contabilidade e analista de dados',contraparte:'Contabilidade municipal e SME',documentos:['Anexo 8 do RREO e demonstrativos SIOPE','Extratos Fundeb e conciliação por fonte','Empenhos, liquidações, pagamentos e restos a pagar da educação'],
      entrega:'Conciliação por fonte e período, com diferenças justificadas.',aceite:'Cada diferença documentada; nenhuma soma mistura receitas, caixa e dotações.',indicador:'Diferenças de conciliação pendentes e indicadores de aplicação por bimestre.'});
    const prioritarias = intel.escolas.filter(s=>s.sinais.length>0);
    if(prioritarias.length) {
      add({id:'ESC-01',titulo:'Validar as escolas prioritárias e organizar o apoio',area:'Pedagógico e gestão de pessoas',prioridade:'P1',
        evidencia:ev(`${prioritarias.length} escolas com sinais em ${intel.escolas.length} códigos reunidos. A síntese apresenta as primeiras unidades e a exportação contém a relação completa.`,'Inep - indicadores por escola',URLS.ideb,'Ano próprio de cada indicador','Recorte escolar disponível; presença nos cadastros conciliada separadamente'),
        limite:'Triagem por quantidade de sinais e porte; não é avaliação causal. Mediana do recorte disponível não é meta oficial.',
        passos:['Conferir a identidade e os períodos das primeiras unidades da lista.','Validar frequência, habilidades, lotação e infraestrutura com cada escola.','Pactuar apoio e registrar medida inicial, entrega e avaliação posterior no mesmo universo.'],
        equipe:'Coordenação pedagógica, dados e apoio à gestão de pessoas',contraparte:'SME e direções escolares',documentos:['Avaliações por escola e habilidade','Registros de frequência e lotação docente'],entrega:'Plano por escola com causa validada e intervenção pactuada.',aceite:'Escolas, responsáveis, prazos e evidências de acompanhamento registrados.',indicador:'Escolas com diagnóstico validado, apoio executado e resultado acompanhado.'});
      acoes[acoes.length-1].escolas=prioritarias.map(s=>s.codigo);
    }
    const comp = intel.vaar.componentes.find(c=>c.tipo==='condicionalidadeIII');
    const va = acoes.find(a=>a.id==='VAAR-01');
    if(va&&comp?.motivo) { va.evidencia.descricao += ` Motivo detalhado: ${comp.motivo}`; va.evidencia.url=comp.fonte?.url??va.evidencia.url; }
    manutencao.push('Reconsultar fontes e comparar versões por competência. Arquivar evidências das ações e distinguir resultado observado de efeito financeiro atribuído.');
    lacunas.push(...f.avisos);
  }
  acoes.sort((a, b) => a.prioridade.localeCompare(b.prioridade) || a.id.localeCompare(b.id));
  const pedidos = new Map<string, string[]>();
  for (const a of acoes) for (const doc of a.documentos) pedidos.set(doc, [...(pedidos.get(doc) ?? []), a.id]);
  return { inteligencia: snapshot.inteligencia, versao: VERSAO_ATUACAO, municipio: m.municipality, uf: m.uf, codigoIbge: m.ibgeCode, exercicio,
    geradoEm: geradoEm.toISOString(), coletadoEm: snapshot.qualidade.coletadoEm, snapshotId: snapshot.qualidade.snapshotId,
    versaoFonte: snapshot.qualidade.versao, acoes, manutencao, lacunas: [...new Set(lacunas)], alertas,
    documentos: [...pedidos].map(([nome, ids]) => ({ nome, acoes: ids })), calendario };
}
