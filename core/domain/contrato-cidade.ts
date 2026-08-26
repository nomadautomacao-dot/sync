/**
 * O contrato de um município — a entidade que faltava.
 *
 * Até 2026-08-14 um contrato era um ZIP com `category: "contrato"` no acervo:
 * sem status, sem vigência legível, sem vínculo confiável com a cidade, e os
 * dados que o agente coletou (pagos em chamada de IA) morriam no fim do
 * request. Este registro é a memória do fechamento: o que foi gerado, com que
 * valores, em que estado está e até quando vale.
 *
 * O documento em si (kit capa a capa, proposta) continua no acervo da cidade
 * (`cityDocuments`); aqui ficam os ponteiros para ele.
 */

export type EstadoDoContrato =
  | "minuta" // kit gerado, aguardando assinatura da prefeitura
  | "assinado" // assinado e dentro da vigência
  | "encerrado" // vigência cumprida
  | "cancelado"; // negociação não foi adiante; o registro fica

export const ESTADO_DO_CONTRATO_LABELS: Record<EstadoDoContrato, string> = {
  minuta: "Minuta",
  assinado: "Assinado",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

export interface ContratoDaCidade {
  id: string;
  cityId: string;
  cityName: string;
  cityUf: string;
  codigoIbge?: string;

  estado: EstadoDoContrato;
  numeroContrato?: string;
  numeroProcesso?: string;

  /** Em centavos, como o resto da base (`estimatedAnnualRevenueCents`). */
  valorMensalCents: number;
  quantidadeMeses: number;

  /** `YYYY-MM-DD`. */
  vigenciaInicio?: string;
  vigenciaFim?: string;
  assinadoEm?: string;

  /**
   * O payload completo que alimentou os templates (as ~55 chaves do gerador),
   * guardado para reemitir sem rodar o agente — e sem pagar a IA — de novo.
   */
  dadosGeracao?: Record<string, unknown>;
  /** Avisos da coleta (campo não encontrado, fonte incerta), para a revisão. */
  avisosColeta?: string[];

  /** Ponteiros para o acervo da cidade. */
  kitDocumentoId?: string;
  propostaDocumentoId?: string;
  /** Copiado do acervo para a lista não fazer uma leitura por contrato. */
  propostaDownloadUrl?: string;

  criadoEm: string;
  atualizadoEm?: string;
  criadoPorNome?: string;
}

/** Valor global em centavos — sempre derivado, nunca digitado. */
export function valorGlobalCents(contrato: {
  valorMensalCents: number;
  quantidadeMeses: number;
}): number {
  return contrato.valorMensalCents * contrato.quantidadeMeses;
}

/**
 * Assinado e dentro do prazo. Contrato sem `vigenciaFim` registrado conta como
 * vigente enquanto assinado: ausência de data é dado incompleto, e rebaixar o
 * contrato por dado incompleto esconderia justamente o que está de pé.
 */
export function estaVigente(
  contrato: Pick<ContratoDaCidade, "estado" | "vigenciaFim">,
  agora: Date,
): boolean {
  if (contrato.estado !== "assinado") return false;
  if (!contrato.vigenciaFim) return true;
  return contrato.vigenciaFim >= hojeEmData(agora);
}

/**
 * Dias até o fim da vigência — negativo quando já passou, `null` quando não há
 * data ou o contrato não está assinado. É o número que alimenta o aviso de
 * renovação: contrato que vence sem ninguém ver é receita que para de entrar
 * sem ninguém decidir isso.
 */
export function diasParaVencer(
  contrato: Pick<ContratoDaCidade, "estado" | "vigenciaFim">,
  agora: Date,
): number | null {
  if (contrato.estado !== "assinado" || !contrato.vigenciaFim) return null;
  const fim = Date.parse(`${contrato.vigenciaFim}T00:00:00Z`);
  const hoje = Date.parse(`${hojeEmData(agora)}T00:00:00Z`);
  if (Number.isNaN(fim)) return null;
  return Math.round((fim - hoje) / 86_400_000);
}

/**
 * As transições permitidas. Minuta não pula para encerrado: encerrar é o fim
 * de um contrato que existiu, e o que morre antes de assinar é cancelamento.
 */
export function podeTransicionar(
  de: EstadoDoContrato,
  para: EstadoDoContrato,
): boolean {
  if (de === para) return false;
  switch (de) {
    case "minuta":
      return para === "assinado" || para === "cancelado";
    case "assinado":
      return para === "encerrado" || para === "cancelado";
    case "encerrado":
    case "cancelado":
      // Reativar é criar contrato novo — reescrever o encerrado apagaria a
      // história do que valeu.
      return false;
  }
}

export function hojeEmData(agora: Date): string {
  return agora.toISOString().slice(0, 10);
}
