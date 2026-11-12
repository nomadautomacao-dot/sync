import { CENSO_2026 } from "@/core/lib/calendario-educacional";

/**
 * Em que ponto do ano do Censo a emissão cai — e o que ainda dá tempo de fazer.
 *
 * A receita do FUNDEB de um exercício sai do Censo Escolar do ano anterior, e o
 * Censo fotografa a rede numa data só: a última quarta-feira de maio. Matrícula
 * aberta depois dela não conta para aquele ciclo. Por isso o mesmo levantamento
 * diz coisas diferentes em março e em novembro:
 *
 * - até dois meses antes da data de referência há tempo para crescer a rede —
 *   busca ativa de EJA, turmas em jornada integral, registro de AEE;
 * - nos dois meses finais só cabe o que é rápido (EJA, AEE, jornada já praticada);
 * - entre a data de referência e 31 de julho a rede está congelada: só se
 *   corrige a declaração do que já existe;
 * - na retificação, só se corrige o que foi publicado;
 * - fechada a retificação, o Censo do ano acabou para o FUNDEB do ano seguinte,
 *   e o trabalho passa a mirar o Censo do ano que vem — que vira receita dois
 *   exercícios depois da emissão.
 *
 * `fracaoDoPrimeiroCiclo` é a parte de um ano de trabalho que cabe até a data
 * de referência do Censo-alvo. O ritmo de crescimento dos casos foi medido de
 * um Censo para o seguinte, doze meses; emitido em novembro, sobram seis e meio.
 */

export type FaseDoCenso = "preparacao" | "reta-final" | "coleta" | "retificacao" | "encerrado";

export interface JanelaDoCenso {
  fase: FaseDoCenso;
  /** Data da emissão, `AAAA-MM-DD`. */
  emitidoEm: string;
  /** Censo em que matrícula nova ainda pode entrar. */
  censoDaMatricula: number;
  /** Exercício em que essa matrícula vira receita. */
  receitaDaMatricula: number;
  /** Data de referência daquele Censo (última quarta-feira de maio). */
  dataDeReferencia: string;
  /** Meses entre a emissão e a data de referência do Censo da matrícula. */
  mesesAteReferencia: number;
  /** Fração de um ano de trabalho que cabe nesse intervalo (0 a 1). */
  fracaoDoPrimeiroCiclo: number;
  /** Censo em que ainda se pode corrigir a declaração (jornada, AEE, localização). */
  censoDaDeclaracao: number;
  /** Exercício em que essa correção vira receita. */
  receitaDaDeclaracao: number;
  /** Fim da retificação do ano da emissão, e se a data é oficial ou estimada. */
  fimDaRetificacao: string;
  retificacaoEstimada: boolean;
  /** Título curto da fase, pronto para impressão. */
  titulo: string;
  /** O que ainda dá tempo de fazer. */
  acoes: string[];
}

const DIA = 86_400_000;

/** Última quarta-feira de maio, em UTC. */
export function dataDeReferenciaDoCenso(ano: number): string {
  const d = new Date(Date.UTC(ano, 4, 31));
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Fim da retificação: oficial quando o calendário do ano é conhecido, estimado nos demais. */
export function fimDaRetificacao(ano: number): { data: string; estimada: boolean } {
  if (ano === 2026) return { data: CENSO_2026.retificacaoFim, estimada: false };
  return { data: `${ano}-10-31`, estimada: true };
}

/** O dia da emissão no fuso das redes atendidas — 23h de 31/12 em Brasília ainda é 31/12. */
function diaLocal(emissao: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(emissao);
}

const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const umaCasa = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${v === 1 ? "mês" : "meses"}`;
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function janelaDoCenso(emissao: Date): JanelaDoCenso {
  if (!Number.isFinite(emissao.getTime())) throw new Error("Data de emissão inválida para o calendário do Censo.");
  const hoje = diaLocal(emissao);
  const ano = Number(hoje.slice(0, 4));
  const referencia = dataDeReferenciaDoCenso(ano);
  const retificacao = fimDaRetificacao(ano);
  const inicioDaRetaFinal = new Date(utc(referencia) - 60 * DIA).toISOString().slice(0, 10);
  const fimDaColeta = `${ano}-07-31`;

  const fase: FaseDoCenso =
    hoje < inicioDaRetaFinal
      ? "preparacao"
      : hoje < referencia
        ? "reta-final"
        : hoje <= fimDaColeta
          ? "coleta"
          : hoje <= retificacao.data
            ? "retificacao"
            : "encerrado";

  const matriculaNesteAno = fase === "preparacao" || fase === "reta-final";
  const declaracaoNesteAno = fase !== "encerrado";
  const censoDaMatricula = matriculaNesteAno ? ano : ano + 1;
  const dataAlvo = dataDeReferenciaDoCenso(censoDaMatricula);
  const meses = Math.max(0, (utc(dataAlvo) - utc(hoje)) / DIA / 30.44);
  const censoDaDeclaracao = declaracaoNesteAno ? ano : ano + 1;

  const titulos: Record<FaseDoCenso, string> = {
    preparacao: `Preparação do Censo ${ano}: há tempo para crescer a rede`,
    "reta-final": `Reta final do Censo ${ano}: só cabe o que é rápido`,
    coleta: `Coleta do Censo ${ano}: a rede está congelada`,
    retificacao: `Retificação do Censo ${ano}: só se corrige o que foi publicado`,
    encerrado: `Censo ${ano} encerrado: o trabalho mira o Censo ${ano + 1}`,
  };

  const acoes: Record<FaseDoCenso, string[]> = {
    preparacao: [
      `Busca ativa de EJA e abertura de turmas até ${br(referencia)}, a data de referência`,
      "Expansão de jornada integral nas escolas que já têm estrutura",
      "Registro do AEE como turma específica para cada aluno de educação especial com atendimento",
      "Conferência escola a escola de localização, jornada declarada e duplicidade",
    ],
    "reta-final": [
      `EJA: turma aberta até ${br(referencia)} ainda conta`,
      "AEE já praticado e ainda não registrado como turma",
      "Jornada integral que a escola já pratica e declara como parcial",
      `Expansão estrutural de jornada fica para o Censo ${ano + 1}`,
    ],
    coleta: [
      `Até 31/07: declarar corretamente jornada, localização e AEE do que já existia em ${br(referencia)}`,
      `Matrícula aberta depois de ${br(referencia)} só conta no Censo ${ano + 1}`,
      `Começar agora a preparação do Censo ${ano + 1}: ${umaCasa(Math.round(meses * 10) / 10)} até a data de referência`,
    ],
    retificacao: [
      `Até ${br(retificacao.data)}${retificacao.estimada ? " (confirmar o comunicado do Inep)" : ""}: retificar o que foi publicado com erro`,
      "Confirmar matrículas em duplicidade com outra rede, na janela própria",
      `Preparação do Censo ${ano + 1}: ${umaCasa(Math.round(meses * 10) / 10)} até a data de referência`,
    ],
    encerrado: [
      `O que foi declarado no Censo ${ano} define o FUNDEB de ${ano + 1} e não muda mais`,
      `Censo ${ano + 1}: ${umaCasa(Math.round(meses * 10) / 10)} até ${br(dataAlvo)} para busca ativa, jornada integral e AEE`,
      `Conferência cadastral escola a escola antes de abrir a coleta de ${ano + 1}`,
    ],
  };

  return {
    fase,
    emitidoEm: hoje,
    censoDaMatricula,
    receitaDaMatricula: censoDaMatricula + 1,
    dataDeReferencia: dataAlvo,
    mesesAteReferencia: Math.round(meses * 10) / 10,
    fracaoDoPrimeiroCiclo: Math.min(1, Math.round((meses / 12) * 100) / 100),
    censoDaDeclaracao,
    receitaDaDeclaracao: censoDaDeclaracao + 1,
    fimDaRetificacao: retificacao.data,
    retificacaoEstimada: retificacao.estimada,
    titulo: titulos[fase],
    acoes: acoes[fase],
  };
}
