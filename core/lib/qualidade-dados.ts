/** Contrato comum de evidência. A data da coleta nunca substitui a competência. */
export type EstadoEvidencia = 'indisponivel' | 'disponivel' | 'zero_confirmado' | 'nao_aplicavel' | 'nao_publicado' | 'falha_consulta' | 'desatualizado';
export interface EvidenciaDado {
  id: string;
  valor: number | string | boolean | null;
  unidade: string;
  universo: string;
  periodo: string | null;
  fonte: string;
  url: string | null;
  coletadoEm: string | null;
  publicadoEm?: string | null;
  versao?: string | null;
  formula?: string | null;
  estado: EstadoEvidencia;
}
export interface AchadoQualidade { codigo: string; nivel: 'erro' | 'aviso'; mensagem: string }

export function percentualCompativel(
  numerador: Pick<EvidenciaDado, 'valor' | 'unidade' | 'universo' | 'periodo'>,
  denominador: Pick<EvidenciaDado, 'valor' | 'unidade' | 'universo' | 'periodo'>,
): number | null {
  if (typeof numerador.valor !== 'number' || typeof denominador.valor !== 'number'
    || !Number.isFinite(numerador.valor) || !Number.isFinite(denominador.valor)
    || denominador.valor <= 0 || numerador.valor < 0 || numerador.valor > denominador.valor
    || !numerador.periodo || numerador.periodo !== denominador.periodo
    || !numerador.unidade || numerador.unidade !== denominador.unidade
    || !numerador.universo || numerador.universo !== denominador.universo) return null;
  return numerador.valor / denominador.valor * 100;
}

export function conferirSoma(total: number, parcelas: number[], codigo: string, tolerancia = .05): AchadoQualidade[] {
  const soma = parcelas.reduce((a,b)=>a+b,0);
  return [total, ...parcelas].every(Number.isFinite) && Math.abs(total-soma) <= tolerancia ? []
    : [{codigo, nivel:'erro', mensagem:`Total ${total} não concilia com a soma ${soma}.`}];
}
export function exigirQualidade(achados: AchadoQualidade[]): void {
  const erros = achados.filter(a=>a.nivel==='erro');
  if (erros.length) throw new Error(`Emissão interrompida por inconsistência: ${erros.map(e=>e.codigo+': '+e.mensagem).join(' ' )}`);
}

export const ROTULO_EVIDENCIA: Record<EstadoEvidencia,string> = {
  indisponivel:'Indisponível', disponivel:'Disponível', zero_confirmado:'Zero confirmado', nao_aplicavel:'Não aplicável',
  nao_publicado:'Não publicado', falha_consulta:'Falha na consulta', desatualizado:'Referência antiga',
};
