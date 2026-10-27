export const CENSO_2026 = {
  referencia:'2026-05-27', coletaFim:'2026-07-31', retificacaoFim:'2026-10-23',
  url:'https://www.gov.br/inep/pt-br/centrais-de-conteudo/noticias/censo-escolar/inep-reabre-o-sistema-educacenso-para-o-periodo-de-conferencia-e-retificacao-da-1a-etapa-do-censo-escolar-2026/',
  norma:'Portaria Inep nº 217/2026 e comunicado atualizado em 13/10/2026',
};
export function situacaoCalendario(exercicio:number, emissao:Date) {
  if(!Number.isFinite(emissao.getTime())) throw new Error('Data de emissão inválida para determinar o calendário.');
  const hoje=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(emissao);
  if(exercicio!==2026) return {situacao:'a_confirmar' as const, texto:`Calendário ${exercicio}: confirmar a portaria anual antes de definir prazo ou efeito financeiro.`,fonte:null};
  return {situacao:hoje>CENSO_2026.retificacaoFim?'encerrada' as const:'em_curso' as const,
    texto:hoje>CENSO_2026.retificacaoFim
      ? 'A janela de retificação de 2026 encerrou em 23/10/2026, conforme o último comunicado consultado. Conferir etapas remanescentes e eventual novo ato oficial. Planejar a coleta seguinte; não atribuir correções futuras automaticamente ao FUNDEB 2027.'
      : 'Conferência e retificação de 2026: observar a etapa vigente e o encerramento em 23/10/2026. Confirmar eventuais alterações no comunicado do Inep.',fonte:CENSO_2026.url};
}
