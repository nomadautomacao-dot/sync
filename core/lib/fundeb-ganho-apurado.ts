/**
 * Ganho **apurado** do FUNDEB — o que a base oficial sustenta, em reais.
 *
 * ## Por que este módulo existe
 *
 * O relatório exibia um KPI chamado "Já evidenciado" que vinha de
 * `projecaoRecuperavel` — na prática, `VAAF × 1,40 + VAAT × 1,30 + VAAR × 1,25`,
 * multiplicadores fixos iguais para todo município do país. Nada ali era
 * evidenciado: não saía de base nenhuma. E "evidenciado" em português significa
 * *comprovado*, então o gestor lia "esse dinheiro já existe e estou perdendo".
 * É a única afirmação do relatório que um secretário bem assessorado derruba
 * com uma pergunta — e derrubá-la contamina as outras catorze páginas.
 *
 * Este módulo monta o número que aquele KPI dizia ser: valor em reais, cada
 * parcela com fonte, fator e artigo de lei atrás.
 *
 * ## Como o valor é monetizado
 *
 * A receita do fundo é proporcional a Σ(matrícula × fator), e o art. 7º, §1º da
 * Lei 14.113/2020 fixa **anos iniciais do fundamental urbano em tempo parcial**
 * como a referência de fator 1,00. Logo o valor aluno/ano desse segmento na
 * Portaria Interministerial é, literalmente, o preço de uma matrícula-
 * equivalente na UF — conferido: em SE, BA e SP a razão entre cada segmento e
 * esse valor reproduz o fator de ponderação com quatro casas exatas.
 *
 * Monetizar ao VAAF é a leitura **conservadora**: quem recebe VAAT ou VAAR ganha
 * mais por equivalente adicional, porque essas complementações usam o mesmo
 * denominador ponderado. O relatório prefere errar para baixo.
 *
 * ## O que entra no total, e o que fica de fora
 *
 * Só entra no total o que é apurado sobre o dado do próprio município. A
 * referência do VAAR é mediana de terceiros — vai separada, nunca somada. Foi
 * exatamente misturar as duas naturezas que produziu o problema original.
 */

import { getPonderacaoMunicipal } from "@/core/lib/fundeb-ponderacao";
import { getSituacaoVaar } from "@/core/lib/fundeb-vaar";
import { getValorAlunoAno } from "@/core/lib/fundeb-valor-aluno";

/**
 * `apurado` sai do dado declarado pelo próprio município, cruzado com fator e
 * valor oficiais. `referencia` sai de mediana de outros entes — serve de ordem
 * de grandeza e não pode ser somada como se fosse do município.
 */
export type CertezaGanho = "apurado" | "referencia";

export interface ComponenteGanho {
  chave: "creche-integral" | "aee" | "vaar";
  titulo: string;
  /** Valor em R$/ano. */
  valor: number;
  certeza: CertezaGanho;
  /** Como o valor foi obtido, em uma linha, com o artigo de lei. */
  origem: string;
  /** O que precisa ser conferido antes de tratar o valor como recuperável. */
  conferir: string;
}

export interface GanhoApurado {
  exercicio: number;
  uf: string;
  /** Preço de uma matrícula-equivalente na UF (VAAF do segmento de fator 1,00). */
  valorPorEquivalente: number;
  /** Soma apenas dos componentes `apurado`. */
  total: number;
  /** Total sobre a receita atual do FUNDEB, em %. `null` sem receita informada. */
  percentualSobreReceita: number | null;
  componentes: ComponenteGanho[];
  /** Fora do total, por não serem apurados sobre o dado do município. */
  referencias: ComponenteGanho[];
}

function moeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * @param receitaAtual Receita total do FUNDEB no exercício, para o percentual.
 *   Opcional: sem ela o campo sai `null` em vez de um denominador inventado.
 */
export function getGanhoApurado(
  codigoIBGE: string,
  uf: string,
  receitaAtual?: number,
): GanhoApurado | null {
  const ponderacao = getPonderacaoMunicipal(codigoIBGE);
  const valores = getValorAlunoAno(uf);

  // Sem o preço da matrícula-equivalente não há como monetizar nada. Devolver
  // null tira o bloco do relatório, que é melhor do que estimar o preço.
  if (!valores || valores.fundamentalParcialAnosIniciais <= 0) return null;

  const valorPorEquivalente = valores.fundamentalParcialAnosIniciais;
  const componentes: ComponenteGanho[] = [];
  const referencias: ComponenteGanho[] = [];

  const pct = (valor: number) => `${(valor * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

  for (const oportunidade of ponderacao?.oportunidades ?? []) {
    // Monetiza a distância até a mediana nacional, não o teto. Pelo teto, o AEE
    // de São Paulo sozinho daria R$ 173,9 milhões — cifra que a base não
    // sustenta, porque supõe AEE devido para todo aluno de educação especial.
    const valor = oportunidade.ganhoEquivalentesMediana * valorPorEquivalente;
    if (valor <= 0) continue;

    const contexto =
      `Hoje a rede está em ${pct(oportunidade.indicador)} e a mediana das redes municipais do país é ` +
      `${pct(oportunidade.mediana)}.`;
    const teto = oportunidade.ganhoEquivalentes * valorPorEquivalente;

    if (oportunidade.chave === "creche-integral") {
      componentes.push({
        chave: "creche-integral",
        titulo: "Creche declarada em jornada parcial",
        valor,
        certeza: "apurado",
        origem:
          `${contexto} Fechar essa distância são ${Math.round(oportunidade.matriculasAteMediana).toLocaleString("pt-BR")} ` +
          `matrículas saindo do fator 1,25 para 1,55 (art. 7º, §1º da Lei 14.113/2020), a ` +
          `R$ ${moeda(valorPorEquivalente)} por matrícula-equivalente na sua UF.`,
        conferir:
          "Tempo integral exige 35h semanais ou média de 7h diárias (Decreto 10.656/2021, art. 11), " +
          "somando os tempos por turma. Escola que já pratica a jornada mas declara turno fixo perde o " +
          `fator maior. Se toda a creche parcial fosse integral o valor chegaria a R$ ${moeda(teto)}, ` +
          "mas só 28% das redes do país declaram assim.",
      });
      continue;
    }

    if (oportunidade.chave === "aee") {
      componentes.push({
        chave: "aee",
        titulo: "Educação especial sem AEE correspondente",
        valor,
        certeza: "apurado",
        origem:
          `${contexto} Fechar essa distância são ${Math.round(oportunidade.matriculasAteMediana).toLocaleString("pt-BR")} ` +
          `matrículas de AEE, que gera dupla matrícula (art. 8º, §3º, I) e pondera 1,40.`,
        conferir:
          "O AEE só conta quando registrado como turma específica no Censo, e nem todo aluno de educação " +
          `especial tem AEE devido. Cobertura integral valeria R$ ${moeda(teto)}, mas só 17% das redes ` +
          "do país chegam lá — por isso a mediana é o alvo, e não o teto.",
      });
    }
  }

  const vaar = getSituacaoVaar(codigoIBGE);
  if (vaar) {
    const mediana = vaar.referencia.medianaUf ?? vaar.referencia.medianaNacional;
    const escopo = vaar.referencia.medianaUf !== null ? `em ${vaar.uf}` : "no país";

    // A Cond. IV reprovada em toda a UF é reprovação do estado (Res. CIF
    // 15/2025, art. 3º, §2º). Oferecer o valor como oportunidade seria vender
    // solução para problema que nenhuma ação municipal resolve.
    if (!vaar.habilitado && !vaar.condIVEstadual && mediana > 0) {
      referencias.push({
        chave: "vaar",
        titulo: "Complementação VAAR não capturada",
        valor: mediana,
        certeza: "referencia",
        origem:
          `Mediana recebida pelos ${vaar.referencia.ufBeneficiadas} municípios beneficiados ${escopo} ` +
          `em ${vaar.exercicio}. O município reprovou ${vaar.reprovadas.length === 1 ? "a condicionalidade" : "as condicionalidades"} ` +
          `${vaar.reprovadas.join(", ")} e reprovar em uma zera a parcela inteira (art. 14, §1º).`,
        conferir:
          "É mediana de outros entes, não cálculo deste município: o rateio é proporcional ao avanço " +
          "em atendimento e aprendizagem, então o valor efetivo depende do desempenho alcançado.",
      });
    } else if (vaar.habilitadoSemRepasse && mediana > 0) {
      referencias.push({
        chave: "vaar",
        titulo: "VAAR habilitado sem repasse",
        valor: mediana,
        certeza: "referencia",
        origem:
          `O município cumpriu as cinco condicionalidades mas não evoluiu em atendimento nem em ` +
          `aprendizagem, e o rateio é proporcional ao avanço. A mediana dos beneficiados ${escopo} ` +
          `foi de R$ ${moeda(mediana)}.`,
        conferir:
          "A habilitação já está resolvida; o que falta é evolução medida. Nenhum ajuste cadastral " +
          "converte este valor — depende de resultado educacional.",
      });
    }
  }

  const total = componentes.reduce((soma, c) => soma + c.valor, 0);

  return {
    exercicio: ponderacao?.exercicio ?? 0,
    uf: uf.trim().toUpperCase(),
    valorPorEquivalente,
    total,
    percentualSobreReceita:
      receitaAtual !== undefined && receitaAtual > 0 ? (total / receitaAtual) * 100 : null,
    componentes,
    referencias,
  };
}
