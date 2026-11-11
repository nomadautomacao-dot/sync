import type {
  CenarioOtimistaFundeb,
  HorizonteOtimistaFundeb,
  ParcelaGanhoFundeb,
  ProjecaoFundeb,
  ReceitasFundeb,
  UpsideCondicionadoFundeb,
} from "@/modules/levantamento-fundeb/types";
import { getSituacaoVaar, listarBeneficiariosVaar } from "@/core/lib/fundeb-vaar";
import { getInepCensoMunicipalRecord } from "@/core/lib/inep-censo";

/**
 * O ganho da capa — soma de parcelas, cada uma com a sua conta.
 *
 * Já foi `receita × multiplicador`, com o multiplicador saindo de um score de
 * perfil comercial (1,68× em Senador Canedo/GO, 1,88× em Fortaleza). O número
 * abria a peça — +R$ 136 milhões, +68% — e não tinha de onde sair: um município
 * que não recebe complementação nenhuma da União teria de ver a redistribuição
 * do fundo estadual crescer dois terços em um ano. Com o cenário de matrículas
 * já racionalizado, a mesma peça dizia R$ 2,5 a 3,8 milhões na página 14.
 *
 * Aqui o total é a soma do que o próprio relatório demonstra, e cada parcela
 * aponta a página onde se abre:
 *
 * 1. **VAAR a recuperar** — a parcela que se perde inteira. Referência por
 *    matrícula entre os habilitados do estado.
 * 2. **Lacunas de declaração** — `fundeb-ganho-apurado.ts`, fator legal sobre a
 *    matrícula que o município declarou.
 * 3. **Cenário de matrículas** — um ano no ritmo padrão da Parte V, valorizado
 *    pelo mecanismo do fundo (`fundeb-cenario-metas.ts`).
 *
 * O número encolhe uma ordem de grandeza e passa a resistir à pergunta "de onde
 * vem isso?", que é a primeira que um secretário de finanças faz.
 */

function mediana(valores: number[]): number {
  if (!valores.length) return 0;
  const s = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(s.length / 2);
  return s.length % 2 ? s[meio] : (s[meio - 1] + s[meio]) / 2;
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inteiro = (v: number) => Math.round(v).toLocaleString("pt-BR");
const round2 = (v: number) => Math.round(v * 100) / 100;

const referenciaPorUf = new Map<string, { porMatricula: number; entes: number } | null>();

/**
 * VAAR por matrícula entre os municípios da UF que receberam.
 *
 * A mediana **em reais** dos habilitados não serve de referência: é o valor de
 * um município de porte mediano, e em Goiás dava R$ 528 mil para uma rede de
 * 25 mil alunos. Por matrícula a distribuição é estreita — em GO, BA e CE o
 * intervalo entre o 1º e o 3º quartil fica dentro de ±9% da mediana —, então a
 * conta escala com o tamanho da rede sem inventar nada.
 */
export function referenciaVaarPorMatricula(uf: string, exercicio: number): { porMatricula: number; entes: number } | null {
  const chave = `${uf}-${exercicio}`;
  if (referenciaPorUf.has(chave)) return referenciaPorUf.get(chave) ?? null;
  const razoes: number[] = [];
  for (const ente of listarBeneficiariosVaar(uf, exercicio)) {
    const matriculas = getInepCensoMunicipalRecord(ente.codigoIBGE)?.matriculasMunicipaisTotal ?? 0;
    if (matriculas > 0) razoes.push(ente.complementacao / matriculas);
  }
  // Com menos de cinco entes a mediana é o valor de um vizinho, não referência.
  const resultado = razoes.length >= 5 ? { porMatricula: round2(mediana(razoes)), entes: razoes.length } : null;
  referenciaPorUf.set(chave, resultado);
  return resultado;
}

/** A parcela do VAAR para quem está fora do rateio. `null` quando não há o que reivindicar. */
export function parcelaVaar(codigoIBGE: string, exercicio: number, matriculasMunicipais: number): ParcelaGanhoFundeb | null {
  const situacao = getSituacaoVaar(codigoIBGE, exercicio);
  if (!situacao || situacao.beneficiario || situacao.complementacao > 0) return null;
  // Reprovação do estado na condicionalidade IV não se resolve no município.
  if (situacao.condIVEstadual) return null;
  if (!(matriculasMunicipais > 0)) return null;
  const referencia = referenciaVaarPorMatricula(situacao.uf, exercicio);
  if (!referencia) return null;
  const reprovadas = situacao.reprovadas;
  return {
    chave: "vaar",
    titulo: reprovadas.length
      ? `VAAR a recuperar — ${reprovadas.length === 1 ? "condicionalidade" : "condicionalidades"} ${reprovadas.join(" e ")}`
      : "VAAR a recuperar — habilitado, sem repasse por falta de evolução",
    valor: round2(referencia.porMatricula * matriculasMunicipais),
    regra:
      `R$ ${moeda(referencia.porMatricula)} por matrícula — mediana dos ${inteiro(referencia.entes)} municípios de ${situacao.uf} ` +
      `que receberam VAAR em ${exercicio} — × ${inteiro(matriculasMunicipais)} matrículas da rede`,
    pagina: 5,
    natureza: "referencia",
  };
}

export interface EntradaGanhoComposto {
  receitas: ReceitasFundeb;
  vaar: ParcelaGanhoFundeb | null;
  /** Total de `getGanhoApurado` — lacunas de declaração monetizadas. */
  lacunas: { total: number; maiorTitulo?: string | null } | null;
  /** Cenário de matrículas no ritmo padrão (Parte V): valor de um ano e como foi apurado. */
  cenario: {
    valor: number;
    matriculas: number;
    mecanismo?: string | null;
    /** Os dois horizontes do ritmo acelerado, para o cenário otimista. */
    acelerado?: { valor: number; matriculas: number } | null;
    aceleradoTresAnos?: { valor: number; matriculas: number; entraNoVaat?: boolean } | null;
  } | null;
}

export interface GanhoComposto {
  /** A projeção principal: as três parcelas. */
  total: ProjecaoFundeb;
  /** Só o que é apurado sobre a base do próprio município. */
  recuperavel: ProjecaoFundeb;
  /** O que depende de habilitação e de execução — a diferença entre as duas. */
  upside: UpsideCondicionadoFundeb | null;
}

function projecaoDasParcelas(receitas: ReceitasFundeb, parcelas: ParcelaGanhoFundeb[], natureza: "composta" | "recuperavel"): ProjecaoFundeb {
  const vaar = parcelas.filter((p) => p.chave === "vaar").reduce((s, p) => s + p.valor, 0);
  // Lacunas e cenário mexem na matrícula ponderada, que é o denominador da
  // redistribuição, do VAAF e do VAAT ao mesmo tempo. O ganho entra em cada um
  // na proporção do que o município já recebe por ali.
  const porMatricula = parcelas.filter((p) => p.chave !== "vaar").reduce((s, p) => s + p.valor, 0);
  const baseMatricula = receitas.receitaContribuicaoMunicipal + receitas.complementacaoVAAF + receitas.complementacaoVAAT;
  const fatia = (parte: number) => (baseMatricula > 0 ? (porMatricula * parte) / baseMatricula : 0);
  const vaafGanho = round2(fatia(receitas.complementacaoVAAF));
  const vaatGanho = round2(fatia(receitas.complementacaoVAAT));
  const totalGanho = round2(parcelas.reduce((s, p) => s + p.valor, 0));
  const totalAtual = receitas.totalReceitas;

  return {
    vaafAtual: receitas.complementacaoVAAF,
    vaafProjetado: round2(receitas.complementacaoVAAF + vaafGanho),
    vaafGanho,
    vaatAtual: receitas.complementacaoVAAT,
    vaatProjetado: round2(receitas.complementacaoVAAT + vaatGanho),
    vaatGanho,
    vaarAtual: receitas.complementacaoVAAR,
    vaarProjetado: round2(receitas.complementacaoVAAR + vaar),
    vaarGanho: round2(vaar),
    totalAtual,
    totalProjetado: round2(totalAtual + totalGanho),
    totalGanho,
    ganhoPercentual: totalAtual > 0 ? (totalGanho / totalAtual) * 100 : 0,
    possuiComplementacao:
      receitas.complementacaoVAAF > 0 || receitas.complementacaoVAAT > 0 || receitas.complementacaoVAAR > 0,
    metodologia:
      natureza === "composta"
        ? "Soma de parcelas com regra própria: VAAR a recuperar, lacunas de declaração ao Censo e cenário de matrículas de um ano."
        : "Lacunas de declaração apuradas pelo fator legal sobre a matrícula que o município declarou ao Censo.",
    multiplicadorAplicado: null,
    natureza,
    ressalva:
      natureza === "composta"
        ? "Potencial condicionado à habilitação ao VAAR, à conferência do Censo e à execução das metas de matrícula. Não é receita garantida."
        : parcelas.length
          ? "Mede o que o fundo pagaria a mais se a declaração alcançasse a mediana nacional. Não é valor perdido comprovado."
          : "Sem lacuna de declaração a monetizar: a rede já declara na mediana nacional ou acima.",
    parcelas,
  };
}

/**
 * O cenário otimista — o teto **deste** município, não um multiplicador.
 *
 * As alavancas são as mesmas do potencial; muda só o ritmo das matrículas, que
 * passa do quartil para o decil de cima, em um e em três anos. O VAAR e as
 * lacunas de declaração não esticam: o VAAR já entra inteiro (o otimismo está
 * em supor a habilitação), e a lacuna continua medida até a mediana nacional —
 * pelo teto teórico o AEE de São Paulo sozinho daria R$ 174 milhões.
 *
 * O resultado é diferente em cada cidade porque a estrutura é diferente: onde
 * a União já completa a rede, cada matrícula vale o VAAT-MIN; onde a rede está
 * logo acima do piso, três anos de crescimento a fazem cruzá-lo; onde não há
 * VAAR a recuperar nem base para crescer, o teto fica perto do potencial.
 */
function comporOtimista(e: EntradaGanhoComposto, parcelas: ParcelaGanhoFundeb[]): CenarioOtimistaFundeb | null {
  const c = e.cenario;
  if (!c?.acelerado || !c.aceleradoTresAnos) return null;
  const fixas = parcelas.filter((p) => p.chave !== "matriculas");
  const horizonte = (valor: number, matriculas: number, quando: string, sufixo = ""): HorizonteOtimistaFundeb => {
    const lista: ParcelaGanhoFundeb[] = [...fixas];
    if (valor > 0) {
      lista.push({
        chave: "matriculas",
        titulo: "Cenário de matrículas — ritmo acelerado",
        valor: round2(valor),
        regra: `${inteiro(matriculas)} matrículas a mais ${quando}, no ritmo que uma em cada dez redes do país alcançou${sufixo}`,
        pagina: 14,
        natureza: "cenario",
      });
    }
    const total = round2(lista.reduce((s, p) => s + p.valor, 0));
    return { total, percentual: e.receitas.totalReceitas > 0 ? (total / e.receitas.totalReceitas) * 100 : 0, parcelas: lista };
  };
  const entraNoVaat = c.aceleradoTresAnos.entraNoVaat === true;
  return {
    umAno: horizonte(c.acelerado.valor, c.acelerado.matriculas, "em um ano"),
    tresAnos: horizonte(
      c.aceleradoTresAnos.valor,
      c.aceleradoTresAnos.matriculas,
      "em três anos",
      entraNoVaat ? "; com isso a rede cruza o VAAT-MIN e passa a receber complementação" : "",
    ),
    entraNoVaat,
  };
}

export function comporGanho(e: EntradaGanhoComposto): GanhoComposto {
  const parcelas: ParcelaGanhoFundeb[] = [];
  if (e.vaar && e.vaar.valor > 0) parcelas.push(e.vaar);

  const lacunas: ParcelaGanhoFundeb | null =
    e.lacunas && e.lacunas.total > 0
      ? {
          chave: "lacunas",
          titulo: `Lacunas de declaração ao Censo${e.lacunas.maiorTitulo ? ` — ${e.lacunas.maiorTitulo.charAt(0).toLowerCase()}${e.lacunas.maiorTitulo.slice(1)}` : ""}`,
          valor: round2(e.lacunas.total),
          regra: "fator de ponderação legal × valor aluno/ano da UF × matrículas que faltam para a declaração alcançar a mediana nacional",
          pagina: 8,
          natureza: "apurado",
        }
      : null;
  if (lacunas) parcelas.push(lacunas);

  if (e.cenario && e.cenario.valor > 0) {
    parcelas.push({
      chave: "matriculas",
      titulo: "Cenário de matrículas — EJA, tempo integral e educação especial",
      valor: round2(e.cenario.valor),
      regra:
        `${inteiro(e.cenario.matriculas)} matrículas a mais em um ano, no ritmo que uma em cada quatro redes do país alcançou` +
        (e.cenario.mecanismo ? `; ${e.cenario.mecanismo}` : ""),
      pagina: 14,
      natureza: "cenario",
    });
  }

  const total = projecaoDasParcelas(e.receitas, parcelas, "composta");
  total.otimista = comporOtimista(e, parcelas);
  const recuperavel = projecaoDasParcelas(e.receitas, lacunas ? [lacunas] : [], "recuperavel");
  const ganhoAdicional = round2(total.totalGanho - recuperavel.totalGanho);

  return {
    total,
    recuperavel,
    upside:
      ganhoAdicional > 0
        ? {
            totalProjetado: total.totalProjetado,
            ganhoAdicional,
            ganhoPercentual: total.totalAtual > 0 ? (ganhoAdicional / total.totalAtual) * 100 : 0,
            metodologia:
              "Parcelas que dependem de ação da rede: habilitação ao VAAR e execução das metas de matrícula. Não se confundem com a lacuna apurada.",
            vetores: parcelas.filter((p) => p.chave !== "lacunas").map((p) => p.titulo),
          }
        : null,
  };
}
