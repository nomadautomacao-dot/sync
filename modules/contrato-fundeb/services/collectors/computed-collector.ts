/**
 * Computed Collector — Calcula campos derivados: datas cronológicas, valores por extenso, etc.
 */
import { format, addBusinessDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ComputedCollectorInput {
  exercicio: number;
  municipioNome: string;
  municipioUF: string;
  valorMensal: number;
  quantidadeMeses: number;
  dataBase?: Date; // data de início do fluxo; padrão: hoje
}

interface ComputedCollectorResult {
  // Números de processo
  processoNumero: string;
  inexigibilidadeNumero: string;
  contratoNumero: string;
  dataProcesso: string;

  // Financeiro calculado
  valorGlobal: number;
  valorMensalExtenso: string;
  valorGlobalExtenso: string;

  // Nomes derivados
  fundoNome: string;
  foroComarca: string;
  foroUF: string;

  // Datas cronológicas do fluxo processual
  dataSolicitacao: string;
  dataParecerJuridico: string;
  dataRatificacao: string;
  dataHomologacao: string;
  dataAssinatura: string;
  vigenciaInicio: string;
  vigenciaFim: string;

  // Padrões do contratante
  prefeitoNacionalidade: string;
  prefeitoEstadoCivil: string;
}

function formatarDataExtenso(data: Date): string {
  return format(data, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

function formatarData(data: Date): string {
  return format(data, "dd.MM.yyyy");
}

function numeroPorExtenso(valor: number): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const extenso = require("numero-por-extenso");
    return extenso.porExtenso(valor, extenso.estilo.monetario);
  } catch {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    }).format(valor);
  }
}

/**
 * Calcula todos os campos derivados do contrato.
 *
 * Datas cronológicas seguem o fluxo processual padrão:
 *  Solicitação → (+5 dias úteis) → Parecer Jurídico → (+3) → Ratificação
 *  → (+2) → Homologação → (+2) → Assinatura
 */
export function collectComputedFields(input: ComputedCollectorInput): ComputedCollectorResult {
  const { exercicio, municipioNome, municipioUF, valorMensal, quantidadeMeses } = input;
  const valorGlobal = valorMensal * quantidadeMeses;
  const dataBase = input.dataBase ?? new Date();

  // Fluxo cronológico de datas processuais
  const dataSolicitacao = dataBase;
  const dataParecerJuridico = addBusinessDays(dataSolicitacao, 5);
  const dataRatificacao = addBusinessDays(dataParecerJuridico, 3);
  const dataHomologacao = addBusinessDays(dataRatificacao, 2);
  const dataAssinatura = addBusinessDays(dataHomologacao, 2);

  return {
    processoNumero: `001/${exercicio}`,
    inexigibilidadeNumero: `001/${exercicio}`,
    contratoNumero: `001/${exercicio}`,
    dataProcesso: String(exercicio),

    valorGlobal,
    valorMensalExtenso: numeroPorExtenso(valorMensal),
    valorGlobalExtenso: numeroPorExtenso(valorGlobal),

    fundoNome: `Fundo Municipal de Educação de ${municipioNome}`,
    foroComarca: municipioNome,
    foroUF: municipioUF,

    dataSolicitacao: formatarDataExtenso(dataSolicitacao),
    dataParecerJuridico: formatarDataExtenso(dataParecerJuridico),
    dataRatificacao: formatarDataExtenso(dataRatificacao),
    dataHomologacao: formatarDataExtenso(dataHomologacao),
    dataAssinatura: formatarDataExtenso(dataAssinatura),
    vigenciaInicio: formatarData(dataAssinatura),
    vigenciaFim: `31.12.${exercicio}`,

    prefeitoNacionalidade: "brasileiro(a)",
    prefeitoEstadoCivil: "casado(a)",
  };
}
