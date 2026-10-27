import { z } from 'zod';

export const ESTADOS_ACAO = ['proposta', 'em_validacao', 'aprovada', 'em_execucao', 'concluida', 'descartada'] as const;
export const acompanhamentoSchema = z.object({
  status: z.enum(ESTADOS_ACAO), responsavel: z.string().trim().max(150), prazo: z.union([z.literal(''), z.iso.date()]),
  evidencia: z.string().trim().max(4000), entrega: z.string().trim().max(4000), resultadoObservado: z.string().trim().max(4000),
  receitaAdicional: z.number().finite().min(0).nullable(), receitaPreservada: z.number().finite().min(0).nullable(),
  economia: z.number().finite().min(0).nullable(), custoIntervencao: z.number().finite().min(0).nullable(), honorarios: z.number().finite().min(0).nullable(),
  memoriaFinanceira: z.string().trim().max(4000), revisadoPor: z.string().trim().max(150),
}).superRefine((v, ctx) => {
  if (['aprovada', 'em_execucao', 'concluida'].includes(v.status) && (!v.responsavel || !v.prazo)) ctx.addIssue({ code: 'custom', message: 'Defina responsável e prazo pactuado.', path: ['responsavel'] });
  if (v.status === 'concluida' && (!v.evidencia || !v.entrega)) ctx.addIssue({ code: 'custom', message: 'Conclusão exige entrega e referência da evidência.', path: ['evidencia'] });
  if (v.status === 'descartada' && !v.resultadoObservado) ctx.addIssue({ code: 'custom', message: 'Registre por que a hipótese foi descartada.', path: ['resultadoObservado'] });
  if ([v.receitaAdicional, v.receitaPreservada, v.economia].some(x => x !== null) && (!v.memoriaFinanceira || !v.revisadoPor)) ctx.addIssue({ code: 'custom', message: 'Resultado financeiro exige memória de cálculo e identificação da revisão técnica.', path: ['memoriaFinanceira'] });
});
export type Acompanhamento = z.infer<typeof acompanhamentoSchema>;
export const acompanhamentoVazio: Acompanhamento = { status: 'proposta', responsavel: '', prazo: '', evidencia: '', entrega: '', resultadoObservado: '', receitaAdicional: null, receitaPreservada: null, economia: null, custoIntervencao: null, honorarios: null, memoriaFinanceira: '', revisadoPor: '' };
export interface RegistroAcao { id: string; groupId: string; codigoIbge: string; exercicio: number; acaoId: string; titulo: string; snapshotId: string; linhaBase: string; atualizadoPor: string; revisao: number; acompanhamento: Acompanhamento }
