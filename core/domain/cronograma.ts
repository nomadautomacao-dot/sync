/**
 * O cronograma de implantação de um município.
 *
 * ## Modelo em código, não em coleção de configuração
 *
 * As etapas padrão são uma constante deste arquivo. A alternativa — guardá-las
 * numa coleção editável — parece mais flexível e tem um efeito ruim: mudar o
 * modelo passaria a mexer, ou a divergir, do cronograma de cidades que já estão
 * andando há meses. Aqui o modelo é só a **semente**: cada cidade recebe uma
 * cópia no dia em que começa, e daí em diante o cronograma é dela.
 *
 * Corolário: revisar o modelo não conserta cidade nenhuma que já começou. Isso
 * é a intenção, não uma limitação.
 *
 * ## Etapa do modelo e etapa avulsa
 *
 * Toda etapa aceita ser renomeada, adiada e concluída — inclusive as que vieram
 * do modelo. `modeloKey` só registra a origem, para que se saiba o que é o
 * processo padrão e o que foi acrescentado por causa daquele município.
 */

export type EstadoDaEtapa = "pendente" | "em_andamento" | "concluida";

export const ESTADO_DA_ETAPA_LABELS: Record<EstadoDaEtapa, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

export interface EtapaDoCronograma {
  id: string;
  /** Posição na lista. Etapa avulsa entra no fim. */
  ordem: number;
  nome: string;
  descricao?: string;
  /** ISO `YYYY-MM-DD`. Data, não instante: prazo não tem hora. */
  prazo: string;
  estado: EstadoDaEtapa;
  responsavelId?: string;
  responsavelNome?: string;
  concluidaEm?: string;
  concluidaPor?: string;
  /** De qual etapa do modelo veio. Ausente em etapa avulsa. */
  modeloKey?: string;
  criadoEm: string;
  atualizadoEm?: string;
}

export interface EtapaModelo {
  key: string;
  nome: string;
  descricao: string;
  /** Dias corridos a partir do início da implantação. */
  diasAposInicio: number;
}

/**
 * O processo padrão de implantação.
 *
 * Os prazos são dias corridos a partir da data de início, e são um ponto de
 * partida: a tela deixa mudar cada um. Este é o lugar de corrigir o processo
 * quando ele mudar — uma edição aqui vale para as **próximas** cidades.
 */
export const MODELO_DE_IMPLANTACAO: readonly EtapaModelo[] = [
  {
    key: "contrato",
    nome: "Contrato assinado e publicado",
    descricao: "Inexigibilidade publicada e processo administrativo fechado.",
    diasAposInicio: 0,
  },
  {
    key: "abertura",
    nome: "Reunião de abertura",
    descricao: "Apresentação da equipe à secretaria e alinhamento de expectativas.",
    diasAposInicio: 7,
  },
  {
    key: "acessos",
    nome: "Acessos e documentos recebidos",
    descricao: "SIOPE, Censo Escolar, folha de pagamento e dados da rede.",
    diasAposInicio: 15,
  },
  {
    key: "diagnostico",
    nome: "Diagnóstico entregue",
    descricao: "Levantamento FUNDEB apresentado à gestão municipal.",
    diasAposInicio: 30,
  },
  {
    key: "correcoes",
    nome: "Correções da matrícula ponderada",
    descricao: "Ajustes no Censo que afetam VAAF, VAAT e VAAR.",
    diasAposInicio: 60,
  },
  {
    key: "capacitacao",
    nome: "Capacitação da equipe municipal",
    descricao: "Formação da equipe da secretaria nos procedimentos.",
    diasAposInicio: 90,
  },
  {
    key: "operacao",
    nome: "Operação assistida",
    descricao: "Acompanhamento mensal com a rede já rodando.",
    diasAposInicio: 120,
  },
  {
    key: "resultados",
    nome: "Relatório de resultados",
    descricao: "Ganho apurado e prestação de contas do trabalho.",
    diasAposInicio: 180,
  },
];

/**
 * Soma dias corridos a uma data `YYYY-MM-DD`, devolvendo `YYYY-MM-DD`.
 *
 * Monta em UTC de propósito. `new Date("2026-08-13")` já é UTC, mas
 * `new Date(2026, 7, 13)` seria local — e num fuso a oeste de Greenwich a volta
 * para texto cairia no dia anterior. Prazo que anda um dia sozinho é o tipo de
 * defeito que ninguém reporta e todo mundo desconta da confiança na ferramenta.
 */
export function somarDias(data: string, dias: number): string {
  const base = new Date(`${data}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) throw new Error(`Data inválida: ${data}`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** A data de hoje em `YYYY-MM-DD`, na mesma régua UTC dos prazos. */
export function hojeEmData(agora: Date): string {
  return agora.toISOString().slice(0, 10);
}

/**
 * A cópia do modelo para uma cidade que está começando.
 *
 * @param inicio `YYYY-MM-DD` — normalmente a assinatura do contrato.
 */
export function montarCronogramaDoModelo(
  inicio: string,
  agora: Date,
): Omit<EtapaDoCronograma, "id">[] {
  const criadoEm = agora.toISOString();
  return MODELO_DE_IMPLANTACAO.map((etapa, indice) => ({
    ordem: indice,
    nome: etapa.nome,
    descricao: etapa.descricao,
    prazo: somarDias(inicio, etapa.diasAposInicio),
    estado: "pendente" as const,
    modeloKey: etapa.key,
    criadoEm,
  }));
}

/** Onde entra uma etapa avulsa: no fim, sem disputar posição com o modelo. */
export function proximaOrdem(etapas: readonly EtapaDoCronograma[]): number {
  return etapas.reduce((maior, etapa) => Math.max(maior, etapa.ordem), -1) + 1;
}

/**
 * Passou do prazo e não foi concluída.
 *
 * A comparação é `<`, não `<=`: uma etapa cujo prazo é hoje ainda tem o dia
 * inteiro. Marcar como atrasada às 00h01 do próprio dia seria mentira.
 */
export function estaAtrasada(etapa: EtapaDoCronograma, agora: Date): boolean {
  return etapa.estado !== "concluida" && etapa.prazo < hojeEmData(agora);
}

export interface ResumoDoCronograma {
  total: number;
  concluidas: number;
  atrasadas: number;
  /** A próxima que ainda não foi concluída, na ordem do cronograma. */
  proxima: EtapaDoCronograma | null;
  /** 0 a 100. `0` quando não há etapa nenhuma — e não `NaN`. */
  percentual: number;
}

export function resumoDoCronograma(
  etapas: readonly EtapaDoCronograma[],
  agora: Date,
): ResumoDoCronograma {
  const ordenadas = ordenarCronograma(etapas);
  const concluidas = ordenadas.filter((e) => e.estado === "concluida").length;

  return {
    total: ordenadas.length,
    concluidas,
    atrasadas: ordenadas.filter((e) => estaAtrasada(e, agora)).length,
    proxima: ordenadas.find((e) => e.estado !== "concluida") ?? null,
    percentual: ordenadas.length === 0 ? 0 : Math.round((concluidas / ordenadas.length) * 100),
  };
}

/**
 * A ordem nova depois de arrastar uma etapa para cima de outra.
 *
 * Recebe a lista **já na ordem da tela** e devolve a atribuição completa de
 * `ordem` — sequencial, do zero — e não só as posições que mudaram. A
 * renumeração completa é deliberada: os cronogramas antigos têm `ordem` com
 * buracos e empates (etapa avulsa entra com o máximo + 1, o modelo começou no
 * zero), e um ajuste parcial em cima de empate produz ordem diferente da que a
 * pessoa acabou de ver.
 *
 * Devolve `null` quando não há o que mover — id desconhecido ou soltar no
 * mesmo lugar — para quem chama não gravar à toa.
 */
export function novaOrdemAposMover(
  ordenadas: readonly EtapaDoCronograma[],
  deId: string,
  paraId: string,
): { id: string; ordem: number }[] | null {
  const de = ordenadas.findIndex((etapa) => etapa.id === deId);
  const para = ordenadas.findIndex((etapa) => etapa.id === paraId);
  if (de < 0 || para < 0 || de === para) return null;

  const novas = [...ordenadas];
  const [movida] = novas.splice(de, 1);
  novas.splice(para, 0, movida);
  return novas.map((etapa, indice) => ({ id: etapa.id, ordem: indice }));
}

/**
 * Ordem do cronograma: a posição manda, e o prazo desempata.
 *
 * O desempate importa porque etapa avulsa entra no fim da lista mesmo quando o
 * prazo dela é para semana que vem — sem ele, duas avulsas criadas no mesmo
 * instante apareceriam em ordem imprevisível entre uma carga e outra.
 */
export function ordenarCronograma(
  etapas: readonly EtapaDoCronograma[],
): EtapaDoCronograma[] {
  return [...etapas].sort(
    (a, b) => a.ordem - b.ordem || a.prazo.localeCompare(b.prazo) || a.id.localeCompare(b.id),
  );
}
