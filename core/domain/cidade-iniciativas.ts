/**
 * O que a Global abre dentro de um município: capacitação, projeto, programa,
 * serviço.
 *
 * ## Por que isto não é uma segunda linha do tempo
 *
 * `cidade-eventos.ts` abre com o argumento de que cinco coleções dariam cinco
 * abas e ninguém entende uma cidade abrindo cinco lugares. Ele continua valendo
 * — e é justamente por isso que a iniciativa **não** guarda acontecimento
 * nenhum. Ela é o **fio**: o evento continua morando em `eventos`, e passa a
 * carregar um `iniciativaId` dizendo de que assunto ele é.
 *
 * A tela de Projetos é, então, uma lente sobre a linha do tempo que já existe,
 * não uma concorrente dela. Quem filtra por "Capacitação de outubro" está
 * olhando os mesmos documentos, com um `where` a mais.
 *
 * O movimento é o mesmo de `CityDocument.relatorioId`, um nível acima: aquele
 * campo transformou um arquivo solto numa *análise sobre* um relatório; este
 * transforma seis registros soltos numa *capacitação*.
 *
 * ## O problema que ela resolve
 *
 * Sem o fio, a capacitação de Juvenília entra como uma reunião de alinhamento,
 * um cartaz anexado, um certificado, uma lista de presença, uma visita e uma
 * nota — seis registros no meio dos quarenta que a cidade já tem, sem nada
 * dizendo que são a mesma coisa. Em novembro ninguém responde "como foi a
 * capacitação de outubro?" sem rolar a tela inteira.
 *
 * ## O que ela deliberadamente não é
 *
 * Não é etapa de cronograma. O cronograma é o processo de implantação da
 * Global — um por cidade, semeado uma vez, com prazo contado do início. A
 * iniciativa é uma **entrega dentro dele**, pode haver várias, e nasce quando
 * alguém decide fazê-la. O elo entre os dois é `etapaModeloKey`, abaixo.
 */

import { papelAlcanca, type GroupRole } from "./rbac";

/**
 * A chave de um tipo. `string`, e não uma união fechada, porque a equipe cria
 * tipos próprios — "Formação continuada", "Assessoria", "Diagnóstico".
 *
 * O custo dessa abertura é que o compilador deixa de barrar chave inventada;
 * a contrapartida é `definicaoDaIniciativa`, que **nunca estoura**: tipo
 * desconhecido vira uma definição neutra com a própria chave por rótulo. Um
 * `throw` ali derrubaria a aba inteira no dia em que alguém apagasse um tipo
 * que ainda tem projeto usando — e projeto antigo não pode sumir porque o
 * catálogo mudou.
 */
export type TipoDeIniciativa = string;

export type EstadoDaIniciativa =
  | "planejada"
  | "em_andamento"
  | "concluida"
  | "cancelada";

export interface DefinicaoDeIniciativa {
  key: TipoDeIniciativa;
  rotulo: string;
  /**
   * Veio com o sistema. Os quatro do padrão não se apagam: são o vocabulário
   * comum entre municípios, e sem eles cada cidade acabaria com um nome
   * diferente para a mesma coisa.
   */
  doSistema?: boolean;
  /**
   * Se o tipo comporta carga horária, formador e número de participantes.
   *
   * Só a capacitação comporta — e o formulário some com esses campos nos
   * outros. Perguntar carga horária de um "serviço de assessoria contínua"
   * produz campo vazio em todo cadastro, e campo que ninguém preenche ensina a
   * ignorar o formulário inteiro.
   */
  temFormacao: boolean;
}

export const TIPOS_PADRAO: readonly DefinicaoDeIniciativa[] = [
  { key: "capacitacao", rotulo: "Capacitação", temFormacao: true, doSistema: true },
  { key: "projeto", rotulo: "Projeto", temFormacao: false, doSistema: true },
  { key: "programa", rotulo: "Programa", temFormacao: false, doSistema: true },
  { key: "servico", rotulo: "Serviço", temFormacao: false, doSistema: true },
];

/**
 * Os quatro do sistema mais os que a equipe criou, sem repetir chave.
 *
 * O padrão vem primeiro e **ganha** de um personalizado de mesma chave: sem
 * isso, cadastrar um tipo chamado "capacitacao" apagaria da tela o
 * comportamento de carga horária que o built-in carrega, e ninguém ligaria uma
 * coisa à outra.
 */
export function catalogoDeTipos(
  personalizados: readonly DefinicaoDeIniciativa[] = [],
): DefinicaoDeIniciativa[] {
  const chavesDoSistema = new Set(TIPOS_PADRAO.map((t) => t.key));
  return [
    ...TIPOS_PADRAO,
    ...personalizados
      .filter((t) => !chavesDoSistema.has(t.key))
      .map((t) => ({ ...t, doSistema: false })),
  ];
}

/**
 * Nunca estoura. Tipo fora do catálogo devolve uma definição neutra com a
 * própria chave por rótulo.
 *
 * É o que sustenta apagar um tipo: o projeto que o usava continua abrindo,
 * mostrando o nome que tinha, em vez de derrubar a aba com uma exceção.
 */
export function definicaoDaIniciativa(
  tipo: TipoDeIniciativa,
  catalogo: readonly DefinicaoDeIniciativa[] = TIPOS_PADRAO,
): DefinicaoDeIniciativa {
  return (
    catalogo.find((t) => t.key === tipo) ?? {
      key: tipo,
      rotulo: tipo,
      temFormacao: false,
    }
  );
}

/**
 * Transforma o que a pessoa digitou numa chave estável.
 *
 * O rótulo é o que se lê; a chave é o que fica gravado em todo projeto daquele
 * tipo. Derivá-la do texto — sem acento, sem espaço — evita que "Formação
 * Continuada" e "formação continuada " virem dois tipos que a tela mostra como
 * iguais e a base trata como diferentes.
 */
export function chaveDoTipo(rotulo: string): string {
  return rotulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const ESTADO_DA_INICIATIVA_LABELS: Record<EstadoDaIniciativa, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export interface IniciativaDaCidade {
  id: string;
  tipo: TipoDeIniciativa;
  nome: string;
  objetivo?: string;
  estado: EstadoDaIniciativa;
  /** ISO `YYYY-MM-DD`. Data, não instante: iniciativa não tem hora. */
  inicio: string;
  /** Quando termina, ou terminou. Ausente na que não tem fim previsto. */
  fim?: string;
  responsavelId?: string;
  responsavelNome?: string;
  /**
   * A etapa do modelo de implantação que esta iniciativa cumpre.
   *
   * `MODELO_DE_IMPLANTACAO` já traz `capacitacao` no dia 90. Sem este elo, a
   * mesma ficha mostraria a capacitação concluída em Projetos e a etapa
   * pendente em Cronograma — duas telas do mesmo município se contradizendo,
   * que é pior que não ter nenhuma das duas.
   */
  etapaModeloKey?: string;
  /** Só em capacitação. Horas de formação — o que vai no certificado. */
  cargaHoraria?: number;
  /** Quem ministra. Texto livre: pode ser de fora da equipe. */
  formador?: string;
  autorUid: string;
  autorNome: string;
  criadoEm: string;
  atualizadoEm?: string;
  concluidaEm?: string;
}

/**
 * Nasce planejada ou já em andamento?
 *
 * Quem cadastra a capacitação de outubro em setembro está planejando; quem
 * cadastra em novembro a que aconteceu em outubro está registrando. Fazer tudo
 * nascer "planejada" encheria a tela de coisa planejada que já terminou.
 */
export function estadoInicial(inicio: string, hoje: string): EstadoDaIniciativa {
  return inicio > hoje ? "planejada" : "em_andamento";
}

/**
 * Passou do fim e ninguém encerrou.
 *
 * É a pergunta que a lista de projetos responde e a linha do tempo não
 * responderia: lá o que fica pendente é o compromisso marcado sem desfecho;
 * aqui é a entrega que estourou o prazo. Iniciativa sem `fim` nunca atrasa —
 * serviço contínuo não tem data para acabar, e marcá-lo de vermelho todo dia
 * ensinaria a equipe a ignorar o vermelho.
 */
export function estaAtrasada(iniciativa: IniciativaDaCidade, hoje: string): boolean {
  if (iniciativa.estado !== "em_andamento" && iniciativa.estado !== "planejada") {
    return false;
  }
  return Boolean(iniciativa.fim) && iniciativa.fim! < hoje;
}

/**
 * Quem mexe: quem abriu, quem responde pela iniciativa, e quem administra.
 *
 * Mais frouxo que evento de propósito. Evento é registro de autoria — o relato
 * de quem esteve na reunião — e por isso só o autor corrige. Iniciativa é
 * estado combinado de trabalho: quem está na cidade hoje encerra a capacitação
 * que a colega abriu no mês passado, e isso é o uso normal, não a exceção.
 */
export function podeEditarIniciativa(
  iniciativa: IniciativaDaCidade,
  uid: string,
  papel: GroupRole,
): boolean {
  return (
    iniciativa.autorUid === uid ||
    iniciativa.responsavelId === uid ||
    papelAlcanca(papel, "admin")
  );
}

/**
 * Encerrar cumpre a etapa do cronograma?
 *
 * Devolve a chave da etapa a concluir, ou `null`. Quem executa é a camada do
 * Firestore, no mesmo lote da conclusão — separar as duas escritas deixaria
 * passar o caso em que a segunda falha e as telas divergem.
 *
 * Só concluir cumpre. Cancelar é decisão de não fazer, e marcar a etapa como
 * cumprida por causa dela seria registrar entrega que não houve.
 */
export function etapaCumpridaAoEncerrar(
  iniciativa: Pick<IniciativaDaCidade, "etapaModeloKey">,
  estadoNovo: EstadoDaIniciativa,
): string | null {
  if (estadoNovo !== "concluida") return null;
  return iniciativa.etapaModeloKey ?? null;
}

export interface ListaDeIniciativas {
  /** O que está rodando agora, do prazo mais apertado ao mais folgado. */
  emAndamento: IniciativaDaCidade[];
  /** O que ainda vai começar, da mais próxima à mais distante. */
  planejadas: IniciativaDaCidade[];
  /** Concluída e cancelada, da mais recente à mais antiga. */
  encerradas: IniciativaDaCidade[];
}

/**
 * Reparte nas três leituras da tela.
 *
 * A ordenação inverte entre os blocos pelo mesmo motivo da linha do tempo: no
 * que está por vir interessa o **próximo**, no que passou interessa o
 * **último**. Em andamento ordena por fim, e não por início: a pergunta ali é
 * "o que vence primeiro", não "o que começou primeiro". Sem fim vai para o
 * final do bloco — não vence nunca.
 */
export function repartirIniciativas(
  iniciativas: readonly IniciativaDaCidade[],
  hoje: string,
): ListaDeIniciativas {
  const emAndamento: IniciativaDaCidade[] = [];
  const planejadas: IniciativaDaCidade[] = [];
  const encerradas: IniciativaDaCidade[] = [];

  for (const iniciativa of iniciativas) {
    if (iniciativa.estado === "concluida" || iniciativa.estado === "cancelada") {
      encerradas.push(iniciativa);
    } else if (iniciativa.estado === "planejada" && iniciativa.inicio > hoje) {
      planejadas.push(iniciativa);
    } else {
      emAndamento.push(iniciativa);
    }
  }

  emAndamento.sort((a, b) => (a.fim ?? "9999").localeCompare(b.fim ?? "9999"));
  planejadas.sort((a, b) => a.inicio.localeCompare(b.inicio));
  encerradas.sort((a, b) =>
    (b.concluidaEm ?? b.fim ?? b.inicio).localeCompare(a.concluidaEm ?? a.fim ?? a.inicio),
  );

  return { emAndamento, planejadas, encerradas };
}

/**
 * Os acontecimentos de uma iniciativa.
 *
 * `null` significa "tudo", e devolve a lista inteira — **incluindo o que não
 * tem iniciativa nenhuma**. É a regressão que importa nesta feature: a cidade
 * já tem dezenas de registros anteriores ao campo, e um filtro que exigisse
 * `iniciativaId` os faria sumir da tela em silêncio no dia do deploy.
 */
export function eventosDaIniciativa<T extends { iniciativaId?: string }>(
  eventos: readonly T[],
  iniciativaId: string | null,
): T[] {
  if (!iniciativaId) return [...eventos];
  return eventos.filter((evento) => evento.iniciativaId === iniciativaId);
}

export interface EntradaDeIniciativa {
  tipo: TipoDeIniciativa;
  nome: string;
  objetivo?: string;
  inicio: string;
  fim?: string;
  responsavelId?: string;
  responsavelNome?: string;
  etapaModeloKey?: string;
  cargaHoraria?: number;
  formador?: string;
}

export interface AutorDaIniciativa {
  uid: string;
  nome: string;
}

/**
 * Monta o documento que vai ao Firestore.
 *
 * Campo de formação só entra se o tipo comporta: uma capacitação convertida em
 * "serviço" na edição deixaria carga horária órfã no documento, e o próximo a
 * ler não saberia se é dado ou lixo.
 */
export function novaIniciativa(
  entrada: EntradaDeIniciativa,
  autor: AutorDaIniciativa,
  agora: Date,
  catalogo: readonly DefinicaoDeIniciativa[] = TIPOS_PADRAO,
): Omit<IniciativaDaCidade, "id"> {
  const hoje = agora.toISOString().slice(0, 10);
  const formacao = definicaoDaIniciativa(entrada.tipo, catalogo).temFormacao;
  const objetivo = entrada.objetivo?.trim();
  const formador = entrada.formador?.trim();

  return {
    tipo: entrada.tipo,
    nome: entrada.nome.trim(),
    ...(objetivo ? { objetivo } : {}),
    estado: estadoInicial(entrada.inicio, hoje),
    inicio: entrada.inicio,
    ...(entrada.fim ? { fim: entrada.fim } : {}),
    ...(entrada.responsavelId ? { responsavelId: entrada.responsavelId } : {}),
    ...(entrada.responsavelNome ? { responsavelNome: entrada.responsavelNome } : {}),
    ...(entrada.etapaModeloKey ? { etapaModeloKey: entrada.etapaModeloKey } : {}),
    ...(formacao && entrada.cargaHoraria ? { cargaHoraria: entrada.cargaHoraria } : {}),
    ...(formacao && formador ? { formador } : {}),
    autorUid: autor.uid,
    autorNome: autor.nome,
    criadoEm: agora.toISOString(),
  };
}
