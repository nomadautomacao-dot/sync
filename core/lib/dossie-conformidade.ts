import { getCaucMunicipio, type CaucMunicipio, type RequisitoCauc } from "./cauc-requisitos";
import { getConformidadeSiope, type ConformidadeSiope } from "./siope-indicadores";
import { getPontualidadeFiscal, type PontualidadeFiscal } from "./siconfi-entregas";
import { getSituacaoVaar, type SituacaoVaar } from "./fundeb-vaar";
import { getRemuneracaoMunicipal, type RemuneracaoMunicipal } from "./remuneracao-docente";

/**
 * Dossiê da Conformidade e Prestação de Contas.
 *
 * ## O que ele faz que o Raio-X não faz
 *
 * O Raio-X dedica duas folhas a isto e nomeia **só as pendências**. Aqui entram
 * todos os requisitos — inclusive os comprovados, com a data de validade de
 * cada comprovação.
 *
 * A diferença não é de volume, é de utilidade. Item comprovado não é notícia
 * velha: ele **vence**, e vira pendência sozinho quando o prazo passa. A rotina
 * que protege a carteira de convênios é olhar o extrato antes do vencimento,
 * não depois da recusa — e a `agenda` abaixo é essa rotina, ordenada por data.
 *
 * ## A distinção que o dossiê existe para desfazer
 *
 * Descumprimento de vinculação **não bloqueia o FUNDEB**: o art. 21 da Lei nº
 * 14.113/2020 manda repassar o fundo automaticamente, e a LRF exclui as
 * transferências de educação do conceito de transferência voluntária. O que
 * pendência fiscal derruba é (1) a habilitação ao VAAT do exercício seguinte,
 * (2) convênios e transferências voluntárias, via CAUC, e (3) a aprovação das
 * contas no tribunal. Confundir as três é o erro mais comum do setor.
 */

/** Dias a partir dos quais um vencimento deixa de ser urgente. */
const JANELA_URGENTE_DIAS = 60;

export interface ItemAgenda {
  codigo: string;
  rotulo: string;
  validadeAte: string;
  /** Negativo quando já venceu. */
  diasRestantes: number;
  urgente: boolean;
  /**
   * `true` quando o extrato repete a **data da consulta** no lugar de um prazo.
   * Significa "comprovado e válido hoje, sem vencimento futuro informado" — e
   * não "vence hoje". Apresentar esses itens como vencendo produziria um
   * documento que anuncia doze vencimentos para hoje em qualquer município do
   * país, todo dia, o que o secretário de finanças descarta na hora.
   */
  semPrazoFuturo: boolean;
  /** `true` para os cinco itens que o Tesouro confere na educação. */
  educacao: boolean;
}

export interface DossieConformidade {
  cauc: CaucMunicipio | null;
  siope: ConformidadeSiope | null;
  pontualidade: PontualidadeFiscal | null;
  vaar: SituacaoVaar | null;
  remuneracao: RemuneracaoMunicipal | null;
  /** Comprovados com data, do que vence primeiro ao que vence por último. */
  agenda: ItemAgenda[];
  resumo: {
    requisitos: number;
    comprovados: number;
    pendentes: number;
    desabilitados: number;
    pendentesEducacao: number;
    vencemEm60Dias: number;
    jaVencidos: number;
    /** Comprovados em que o extrato repete a data da consulta, sem prazo. */
    semPrazoFuturo: number;
    indicadoresSiope: number;
    descumpridas: number;
    condicionalidadesReprovadas: number;
  };
}

/**
 * Os cinco itens do extrato em que o Tesouro confere a aplicação da educação.
 * O CAUC já separa em `pendenciasEducacao`, mas só os pendentes — a agenda
 * precisa marcar também os comprovados, que são os que vencem.
 */
function ehEducacao(cauc: CaucMunicipio, r: RequisitoCauc): boolean {
  return cauc.pendenciasEducacao.some((p) => p.codigo === r.codigo) || /educa|fundeb|siope/i.test(r.rotulo);
}

function diasAte(iso: string, referencia: Date): number {
  const alvo = new Date(`${iso}T12:00:00Z`).getTime();
  const hoje = new Date(
    Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), referencia.getUTCDate(), 12),
  ).getTime();
  return Math.round((alvo - hoje) / 86_400_000);
}

/**
 * A agenda de vencimentos — separada da rede para poder ser testada.
 *
 * A armadilha que ela existe para desarmar: parte dos requisitos traz, no
 * campo de validade, a **própria data da consulta** em vez de um prazo. Lidos
 * como vencimento, eles produzem um documento que anuncia doze vencimentos
 * para hoje em qualquer município do país, todo dia — e o secretário de
 * finanças descarta o relatório inteiro na primeira linha.
 */
export function montarAgenda(cauc: CaucMunicipio | null, referencia: Date): ItemAgenda[] {
  if (!cauc) return [];

  return cauc.requisitos
    .filter((r): r is RequisitoCauc & { validadeAte: string } => Boolean(r.validadeAte))
    .map((r) => {
      const dias = diasAte(r.validadeAte, referencia);
      const semPrazoFuturo = r.validadeAte === cauc.dataPesquisa;
      return {
        codigo: r.codigo,
        rotulo: r.rotulo,
        validadeAte: r.validadeAte,
        diasRestantes: dias,
        urgente: !semPrazoFuturo && dias <= JANELA_URGENTE_DIAS,
        semPrazoFuturo,
        educacao: ehEducacao(cauc, r),
      };
    })
    // Os sem prazo futuro vão para o fim: a agenda existe para mostrar o que
    // tem data, e eles não têm.
    .sort((a, b) => {
      if (a.semPrazoFuturo !== b.semPrazoFuturo) return a.semPrazoFuturo ? 1 : -1;
      return a.diasRestantes - b.diasRestantes;
    });
}

export async function montarDossieConformidade(
  codigoIBGE: string,
  referencia = new Date(),
): Promise<DossieConformidade> {
  // O extrato de entregas do Tesouro é consultado pelo exercício corrente: é
  // dele que saem as DCAs dos anos anteriores contra os dois prazos.

  // O CAUC e a pontualidade vão à rede; os outros três leem dataset local.
  // Nenhum deles derruba o dossiê se falhar: cada seção some com a explicação
  // de por quê, em vez de o documento inteiro não sair.
  const [caucRes, pontRes] = await Promise.allSettled([
    getCaucMunicipio(codigoIBGE),
    getPontualidadeFiscal(codigoIBGE, referencia.getFullYear()),
  ]);

  const cauc = caucRes.status === "fulfilled" ? caucRes.value : null;
  const pontualidade = pontRes.status === "fulfilled" ? pontRes.value : null;
  const siope = getConformidadeSiope(codigoIBGE);
  const vaar = getSituacaoVaar(codigoIBGE);
  const remuneracao = getRemuneracaoMunicipal(codigoIBGE);

  const agenda = montarAgenda(cauc, referencia);

  return {
    cauc,
    siope,
    pontualidade,
    vaar,
    remuneracao,
    agenda,
    resumo: {
      requisitos: cauc?.requisitos.length ?? 0,
      comprovados: cauc?.comprovados ?? 0,
      pendentes: cauc?.pendencias.length ?? 0,
      desabilitados: cauc?.desabilitados ?? 0,
      pendentesEducacao: cauc?.pendenciasEducacao.length ?? 0,
      vencemEm60Dias: agenda.filter((a) => a.diasRestantes >= 0 && a.urgente).length,
      jaVencidos: agenda.filter((a) => !a.semPrazoFuturo && a.diasRestantes < 0).length,
      semPrazoFuturo: agenda.filter((a) => a.semPrazoFuturo).length,
      indicadoresSiope: siope?.indicadores.length ?? 0,
      descumpridas: siope?.descumpridas.length ?? 0,
      condicionalidadesReprovadas: vaar?.reprovadas.length ?? 0,
    },
  };
}
