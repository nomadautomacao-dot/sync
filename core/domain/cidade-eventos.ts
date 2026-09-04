/**
 * A linha do tempo de um município.
 *
 * ## Por que um tipo só, e não cinco
 *
 * Reunião, visita, ligação, relatório de campo, documento anexado e nota são
 * **tipos** de acontecimento, não seções da tela. Cinco coleções separadas
 * dariam cinco abas, e ninguém entende o que se passou numa cidade abrindo
 * cinco lugares — que é exatamente o que este app existe para resolver.
 *
 * ## Por que compromisso e acontecimento são o mesmo documento
 *
 * A reunião marcada para quinta é o mesmo registro que, na sexta, tem o relato
 * dentro: muda o `estado`, não a identidade. Modelar como duas entidades
 * ("agendamentos" e "registros") parece mais arrumado e perde a única pergunta
 * que uma equipe realmente faz — *o que foi marcado e ficou sem desfecho*. Com
 * entidades separadas, a reunião que não aconteceu não vira nada: some.
 *
 * `estaPendente()` é essa pergunta, e é uma linha porque o modelo a permite.
 */

import { papelAlcanca, type GroupRole } from "./rbac";

export type TipoDeEvento =
  | "reuniao"
  | "visita"
  | "ligacao"
  | "relatorio_campo"
  | "documento"
  | "etapa"
  | "iniciativa"
  | "nota";

export type EstadoDoEvento = "marcado" | "realizado" | "cancelado";

export interface EventoDaCidade {
  id: string;
  tipo: TipoDeEvento;
  titulo: string;
  /** ISO. Quando aconteceu — ou quando vai acontecer, se ainda está marcado. */
  quando: string;
  estado: EstadoDoEvento;
  /** O que se passou. Vazio enquanto o compromisso não tem desfecho. */
  relato?: string;
  /** Quem participou ou vai participar, em texto livre. */
  participantes?: string;
  autorUid: string;
  autorNome: string;
  criadoEm: string;
  atualizadoEm?: string;
  /** Contagem mantida no próprio documento: a lista não lê a subcoleção. */
  comentarios?: number;
  /**
   * O arquivo de que este acontecimento trata.
   *
   * A URL fica **copiada** aqui em vez de ser buscada pelo `documentoId` a cada
   * exibição. Vinte eventos com anexo seriam vinte leituras extras só para
   * desenhar vinte links — e a linha do tempo é a primeira coisa que abre. O
   * `documentoId` viaja junto para quem precisar do documento inteiro.
   */
  anexo?: AnexoDoEvento;
  /**
   * De que assunto este acontecimento é: a capacitação, o projeto, o programa.
   *
   * Ausente é o caso comum e continua sendo — a maior parte do que acontece
   * numa cidade não pertence a iniciativa nenhuma, e o filtro "tudo" da tela
   * não pode escondê-los. Ver `eventosDaIniciativa` em `cidade-iniciativas.ts`.
   */
  iniciativaId?: string;
}

export interface AnexoDoEvento {
  titulo: string;
  url: string;
  documentoId?: string;
  /** O relatório que este arquivo complementa, quando for uma análise. */
  relatorioTitulo?: string;
}

export interface Comentario {
  id: string;
  texto: string;
  autorUid: string;
  autorNome: string;
  criadoEm: string;
}

export interface DefinicaoDeTipo {
  key: TipoDeEvento;
  rotulo: string;
  /** Se faz sentido marcar para uma data futura. */
  agendavel: boolean;
  /**
   * Se a pessoa cria este tipo à mão. `documento` e `etapa` nascem de outra
   * ação do sistema — anexar arquivo, concluir etapa do cronograma — e
   * oferecê-los no formulário produziria registro que não corresponde a nada.
   */
  manual: boolean;
}

export const TIPOS_DE_EVENTO: readonly DefinicaoDeTipo[] = [
  { key: "reuniao", rotulo: "Reunião", agendavel: true, manual: true },
  { key: "visita", rotulo: "Visita", agendavel: true, manual: true },
  { key: "ligacao", rotulo: "Ligação", agendavel: false, manual: true },
  { key: "relatorio_campo", rotulo: "Relatório de campo", agendavel: false, manual: true },
  { key: "nota", rotulo: "Nota", agendavel: false, manual: true },
  { key: "documento", rotulo: "Documento anexado", agendavel: false, manual: false },
  { key: "etapa", rotulo: "Etapa do cronograma", agendavel: false, manual: false },
  // Nasce de abrir ou encerrar um projeto na aba Projetos, nunca do
  // formulário: um "acontecimento do tipo iniciativa" escrito à mão não
  // corresponderia a iniciativa nenhuma.
  { key: "iniciativa", rotulo: "Projeto", agendavel: false, manual: false },
];

export const TIPOS_MANUAIS = TIPOS_DE_EVENTO.filter((t) => t.manual);

export function definicaoDoTipo(tipo: TipoDeEvento): DefinicaoDeTipo {
  const achada = TIPOS_DE_EVENTO.find((t) => t.key === tipo);
  if (!achada) throw new Error(`Tipo de evento desconhecido: ${tipo}`);
  return achada;
}

export const ESTADO_LABELS: Record<EstadoDoEvento, string> = {
  marcado: "Marcado",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

/**
 * Nasce marcado ou já realizado?
 *
 * Ligação, nota e relatório de campo se registram **depois** de acontecerem —
 * nascer "marcado" faria cada um deles aparecer na lista de pendências no
 * instante seguinte ao de ser escrito. Reunião e visita dependem da data: quem
 * lança a reunião da semana passada está registrando, não agendando.
 */
export function estadoInicial(
  tipo: TipoDeEvento,
  quando: string,
  agora: Date,
): EstadoDoEvento {
  if (!definicaoDoTipo(tipo).agendavel) return "realizado";
  return new Date(quando).getTime() > agora.getTime() ? "marcado" : "realizado";
}

/**
 * Marcado, a data passou, e ninguém disse o que houve.
 *
 * É a única pergunta que a linha do tempo responde e um mural de avisos não
 * responderia. Cancelado não é pendência: alguém decidiu.
 */
export function estaPendente(evento: EventoDaCidade, agora: Date): boolean {
  return evento.estado === "marcado" && new Date(evento.quando).getTime() < agora.getTime();
}

/**
 * Quem pode mexer no registro: quem escreveu, e quem administra.
 *
 * A trava que vale é a de `firestore.rules` — esta função só decide se o botão
 * aparece. Duplicar a regra aqui é deliberado: sem ela a tela ofereceria uma
 * edição que o servidor recusa, e o usuário levaria a culpa por um erro do
 * sistema.
 */
export function podeEditarEvento(
  evento: EventoDaCidade,
  uid: string,
  papel: GroupRole,
): boolean {
  return evento.autorUid === uid || papelAlcanca(papel, "admin");
}

export interface LinhaDoTempo {
  /** O que ainda vai acontecer, do mais próximo ao mais distante. */
  agenda: EventoDaCidade[];
  /** Marcado, a data passou, sem desfecho — o mais antigo primeiro. */
  pendencias: EventoDaCidade[];
  /** O que já se passou, do mais recente ao mais antigo. */
  historico: EventoDaCidade[];
}

/**
 * Reparte a lista nas três leituras que a tela faz.
 *
 * A ordenação inverte entre os blocos de propósito: no que está por vir
 * interessa o **próximo** compromisso, e no que passou interessa o **último**
 * acontecimento. Uma lista só, em ordem única, obriga a rolar até o meio para
 * achar o presente.
 */
export function repartirLinhaDoTempo(
  eventos: readonly EventoDaCidade[],
  agora: Date,
): LinhaDoTempo {
  const agenda: EventoDaCidade[] = [];
  const pendencias: EventoDaCidade[] = [];
  const historico: EventoDaCidade[] = [];

  for (const evento of eventos) {
    if (evento.estado === "marcado") {
      (estaPendente(evento, agora) ? pendencias : agenda).push(evento);
    } else {
      historico.push(evento);
    }
  }

  const crescente = (a: EventoDaCidade, b: EventoDaCidade) => a.quando.localeCompare(b.quando);

  agenda.sort(crescente);
  pendencias.sort(crescente);
  historico.sort((a, b) => b.quando.localeCompare(a.quando));

  return { agenda, pendencias, historico };
}

export interface EntradaDeEvento {
  tipo: TipoDeEvento;
  titulo: string;
  quando: string;
  participantes?: string;
  relato?: string;
  anexo?: AnexoDoEvento;
  iniciativaId?: string;
}

export interface Autor {
  uid: string;
  nome: string;
}

/**
 * Monta o documento que vai ao Firestore.
 *
 * Autoria entra aqui, e não na tela, porque registro sem autor num mural que a
 * equipe inteira usa é registro que ninguém confia nem contesta — e é
 * impossível de retroagir depois que a base tem histórico.
 */
export function novoEvento(
  entrada: EntradaDeEvento,
  autor: Autor,
  agora: Date,
): Omit<EventoDaCidade, "id"> {
  const relato = entrada.relato?.trim();
  const participantes = entrada.participantes?.trim();

  return {
    tipo: entrada.tipo,
    titulo: entrada.titulo.trim(),
    quando: entrada.quando,
    estado: estadoInicial(entrada.tipo, entrada.quando, agora),
    ...(relato ? { relato } : {}),
    ...(participantes ? { participantes } : {}),
    ...(entrada.anexo ? { anexo: entrada.anexo } : {}),
    ...(entrada.iniciativaId ? { iniciativaId: entrada.iniciativaId } : {}),
    autorUid: autor.uid,
    autorNome: autor.nome,
    criadoEm: agora.toISOString(),
    comentarios: 0,
  };
}
