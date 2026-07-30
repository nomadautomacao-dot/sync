/**
 * Precatório do FUNDEF — o dinheiro que a União pagou ao município por
 * decisão judicial, e a subvinculação que pesa sobre ele.
 *
 * ## O que é
 *
 * Entre 1998 e 2006 a União calculou a complementação do FUNDEF por um valor
 * mínimo por aluno abaixo do que a Lei nº 9.424/1996 mandava. Centenas de
 * municípios processaram e ganharam. O pagamento estava travado até a **EC nº
 * 114/2021**, que criou o regime de quitação — e, no mesmo ato, amarrou o
 * destino do dinheiro.
 *
 * ## As duas regras que fazem esta página valer a visita
 *
 * **EC nº 114/2021, art. 5º:** as receitas recebidas "deverão ser aplicadas na
 * manutenção e desenvolvimento do ensino fundamental público e na valorização
 * de seu magistério, conforme destinação originária do Fundo".
 *
 * **Parágrafo único:** "no mínimo 60% (sessenta por cento) deverão ser
 * repassados aos profissionais do magistério, inclusive aposentados e
 * pensionistas, na forma de abono, vedada a incorporação na remuneração, na
 * aposentadoria ou na pensão".
 *
 * A **Lei nº 14.325/2022** acrescentou o art. 47-A à Lei nº 14.113/2020: diz
 * quem tem direito ao rateio (quem estava em efetivo exercício no período dos
 * repasses a menor, aposentados e herdeiros), manda cada ente definir os
 * critérios **em lei específica** (art. 2º) e prevê a sanção — a União
 * **suspende transferências voluntárias** de quem descumprir (art. 3º). É a
 * mesma porta que o CAUC tranca, e por isso esta página conversa com a de
 * requisitos fiscais.
 *
 * ## A fonte, e a armadilha que ela esconde
 *
 * O SICONFI publica a receita na DCA, Anexo I-C, declarada pelo próprio
 * município. A armadilha: **o código da conta mudou**. Até 2021 o precatório
 * do FUNDEF era `1.7.1.8.13.0.0`; de 2022 em diante é `1.7.1.9.56.0.0`, com o
 * mesmo nome. Um leitor que procurasse só o código novo veria zero em 2020 e
 * 2021 — e num único município da amostra de sondagem 2020 tinha R$ 40,8
 * milhões nessa conta. Por isso o casamento aqui é **pelo nome** (precisa
 * conter "precatórios" e "FUNDEF"), com o código guardado como o dado que a
 * fonte usou, não como a chave de busca.
 *
 * ## O que esta leitura não prova
 *
 * Ausência de receita declarada **não** significa ausência de direito: pode
 * ser precatório ainda não pago, ação em curso, ou classificação contábil em
 * outra conta. E o lado da despesa não é público — nem a DCA nem o SIOPE têm
 * conta ou indicador de aplicação do abono. Se os 60% foram pagos, quem
 * responde é o município. As duas lacunas viram pergunta de campo com o valor
 * apurado embutido.
 */

const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const SICONFI_BASE_URL = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt";
const ANEXO = "DCA-Anexo I-C";
const COLUNA_REALIZADA = "Receitas Brutas Realizadas";

/** Quantos exercícios para trás a consulta varre, a partir do último fechado. */
const JANELA_EXERCICIOS = 6;

/** EC nº 114/2021, promulgada em 16/12/2021. */
export const SUBVINCULACAO_ABONO = 0.6;
/**
 * Primeiro exercício integralmente sob a EC. 2021 fica de fora do cálculo dos
 * 60% de propósito: a Emenda foi promulgada a quinze dias do fim do ano, e
 * afirmar que ela alcança o que entrou em janeiro daquele exercício seria
 * tese jurídica, não leitura de fonte. Vira pergunta ao jurídico do município.
 */
export const PRIMEIRO_EXERCICIO_EC114 = 2022;

interface DcaItem {
  exercicio?: number;
  cod_conta?: string;
  conta?: string;
  coluna?: string;
  valor?: number;
}

export interface PrecatorioExercicio {
  exercicio: number;
  valor: number;
  /** O código que a fonte usou naquele ano — muda de 2021 para 2022. */
  codigoConta: string;
  /** A EC nº 114/2021 alcança este exercício? */
  sobEc114: boolean;
}

export interface PrecatorioFundefRecord {
  codigoIBGE: string;
  /** Exercícios varridos, do mais antigo ao mais recente. */
  janela: number[];
  /** Exercícios em que o município não entregou DCA — lacuna, não ausência. */
  semDeclaracao: number[];
  /** Só os exercícios com receita declarada. */
  exercicios: PrecatorioExercicio[];
  recebeu: boolean;
  total: number;
  /** Recebido a partir de 2022, base do cálculo dos 60%. */
  totalSobEc114: number;
  totalAnterior: number;
  /** 60% do que entrou sob a EC — o que a lei destina, não o que foi pago. */
  minimoAbono: number;
  /** Os 40% restantes, que continuam carimbados em MDE do ensino fundamental. */
  saldoMde: number;
  primeiroExercicio: number | null;
  ultimoExercicio: number | null;
  fontes: string[];
  observacoes: string[];
}

interface CacheEntry {
  loadedAt: number;
  data: PrecatorioFundefRecord | null;
}

const cache = new Map<string, CacheEntry>();

/**
 * Casamento pelo nome da conta. O acento vem quebrado da fonte (o traço vira
 * `¿`), então a comparação é sobre o texto sem diacríticos e em caixa alta.
 */
export function ehContaPrecatorioFundef(conta: string | undefined): boolean {
  if (!conta) return false;
  const plano = conta
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
  return plano.includes("PRECATORIO") && plano.includes("FUNDEF");
}

/** Janela de exercícios varrida, do mais antigo ao mais recente. */
export function janelaExercicios(anoDeReferencia: number): number[] {
  // A DCA de um exercício só é publicada no ano seguinte; o último fechado é
  // sempre o anterior ao de referência.
  const ultimo = anoDeReferencia - 1;
  return Array.from({ length: JANELA_EXERCICIOS }, (_, i) => ultimo - (JANELA_EXERCICIOS - 1 - i));
}

/**
 * Monta o registro a partir das respostas já obtidas — separado da rede para
 * que o teste possa exercitar a mudança de código de conta sem sair da máquina.
 */
export function lerPrecatorioFundef(
  codigoIBGE: string,
  respostas: { exercicio: number; itens: DcaItem[]; entregou: boolean }[],
): PrecatorioFundefRecord {
  const janela = respostas.map((r) => r.exercicio).sort((a, b) => a - b);
  const semDeclaracao = respostas.filter((r) => !r.entregou).map((r) => r.exercicio).sort((a, b) => a - b);

  const exercicios: PrecatorioExercicio[] = [];
  for (const resposta of respostas) {
    if (!resposta.entregou) continue;
    const linha = resposta.itens.find(
      (item) =>
        ehContaPrecatorioFundef(item.conta) &&
        (item.coluna ?? COLUNA_REALIZADA) === COLUNA_REALIZADA,
    );
    const valor = Number(linha?.valor);
    if (!linha || !Number.isFinite(valor) || valor <= 0) continue;
    exercicios.push({
      exercicio: resposta.exercicio,
      valor: Math.round(valor * 100) / 100,
      codigoConta: String(linha.cod_conta ?? "").replace(/^RO/, ""),
      sobEc114: resposta.exercicio >= PRIMEIRO_EXERCICIO_EC114,
    });
  }
  exercicios.sort((a, b) => a.exercicio - b.exercicio);

  const total = soma(exercicios.map((e) => e.valor));
  const totalSobEc114 = soma(exercicios.filter((e) => e.sobEc114).map((e) => e.valor));
  const totalAnterior = Math.round((total - totalSobEc114) * 100) / 100;

  const observacoes: string[] = [];
  if (semDeclaracao.length > 0) {
    observacoes.push(
      `Sem DCA entregue ao SICONFI em ${semDeclaracao.join(", ")} — nesses exercícios a leitura é lacuna, não ausência de recebimento.`,
    );
  }
  if (totalAnterior > 0) {
    observacoes.push(
      `${brl(totalAnterior)} entraram antes de ${PRIMEIRO_EXERCICIO_EC114}, quando a subvinculação de 60% em abono ainda não existia. O valor fica fora do cálculo do mínimo e vira pergunta ao jurídico do município.`,
    );
  }
  const codigos = [...new Set(exercicios.map((e) => e.codigoConta))];
  if (codigos.length > 1) {
    observacoes.push(
      `O SICONFI usou mais de um código para a mesma conta na janela (${codigos.join(" e ")}); a leitura casa pelo nome da conta, não pelo código.`,
    );
  }

  return {
    codigoIBGE,
    janela,
    semDeclaracao,
    exercicios,
    recebeu: exercicios.length > 0,
    total,
    totalSobEc114,
    totalAnterior,
    minimoAbono: Math.round(totalSobEc114 * SUBVINCULACAO_ABONO * 100) / 100,
    saldoMde: Math.round(totalSobEc114 * (1 - SUBVINCULACAO_ABONO) * 100) / 100,
    primeiroExercicio: exercicios[0]?.exercicio ?? null,
    ultimoExercicio: exercicios[exercicios.length - 1]?.exercicio ?? null,
    fontes: [
      `SICONFI/Tesouro Nacional — Declaração de Contas Anuais, Anexo I-C, exercícios ${janela[0]}–${janela[janela.length - 1]}`,
    ],
    observacoes,
  };
}

function soma(valores: number[]): number {
  return Math.round(valores.reduce((t, v) => t + v, 0) * 100) / 100;
}

function brl(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function consultarExercicio(
  codigoIBGE: string,
  exercicio: number,
): Promise<{ exercicio: number; itens: DcaItem[]; entregou: boolean }> {
  const url =
    `${SICONFI_BASE_URL}/dca?an_exercicio=${exercicio}` +
    `&no_anexo=${encodeURIComponent(ANEXO)}&id_ente=${encodeURIComponent(codigoIBGE)}`;

  const resposta = await fetch(url, {
    headers: { "User-Agent": "Sync/1.0", Accept: "application/json" },
    next: { revalidate: 60 * 60 * 12 },
  });
  if (!resposta.ok) throw new Error(`SICONFI respondeu HTTP ${resposta.status} para ${exercicio}`);

  const corpo = (await resposta.json()) as { items?: DcaItem[] };
  const itens = Array.isArray(corpo.items) ? corpo.items : [];
  return { exercicio, itens, entregou: itens.length > 0 };
}

/**
 * Consulta viva. Um exercício que falhar na rede entra como "sem declaração" —
 * a página diz a lacuna em voz alta em vez de somar um zero silencioso.
 */
export async function getPrecatorioFundef(
  codigoIBGE: string,
  anoDeReferencia: number,
): Promise<PrecatorioFundefRecord | null> {
  const codigo = String(codigoIBGE ?? "").trim();
  if (!/^\d{7}$/.test(codigo)) return null;

  const janela = janelaExercicios(anoDeReferencia);
  const chave = `${codigo}:${janela[0]}-${janela[janela.length - 1]}`;
  const emCache = cache.get(chave);
  if (emCache && Date.now() - emCache.loadedAt < CACHE_TTL_MS) return emCache.data;

  const respostas = await Promise.all(
    janela.map((exercicio) =>
      consultarExercicio(codigo, exercicio).catch(() => ({
        exercicio,
        itens: [] as DcaItem[],
        entregou: false,
      })),
    ),
  );

  // Se nenhum exercício respondeu, o problema é a fonte, não o município —
  // devolver um registro "não recebeu" seria afirmar o que não foi medido.
  if (respostas.every((r) => !r.entregou)) {
    cache.set(chave, { loadedAt: Date.now(), data: null });
    return null;
  }

  const registro = lerPrecatorioFundef(codigo, respostas);
  cache.set(chave, { loadedAt: Date.now(), data: registro });
  return registro;
}
