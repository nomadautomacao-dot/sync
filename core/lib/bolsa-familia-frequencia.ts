/**
 * Frequência escolar do Bolsa Família — o censo mensal da evasão que já
 * existe e quase nenhuma secretaria usa.
 *
 * A condicionalidade de educação do PBF exige frequência mínima (60% para
 * 4–5 anos, 75% para 6–17) e é **acompanhada bimestralmente, criança a
 * criança**, pelo SICON. A Matriz de Informação Social do MDS publica o
 * agregado municipal — consultado aqui ao vivo, na geração do relatório.
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * Três leituras, todas com dinheiro atrás:
 *
 * 1. **"Não localizados"** são beneficiários em idade escolar que a rede não
 *    encontrou para registrar frequência — evasão com nome e endereço, porque
 *    o gestor municipal do PBF tem a lista nominal no SICON. Busca ativa não
 *    precisa começar do zero: começa dessa lista.
 * 2. Cada aluno recuperado vira matrícula no Censo — e o Censo define o
 *    FUNDEB do exercício seguinte.
 * 3. Sanções (advertência → bloqueio → suspensão) medem descumprimento já
 *    formalizado — famílias que estão perdendo renda por falta às aulas.
 *
 * A moldura importa: a condicionalidade é **proteção, não punição** — o
 * descumprimento aciona a rede de assistência antes de virar sanção, e a
 * página trata o número como alerta de busca ativa, nunca como culpa da
 * família.
 */

const BASE = "https://aplicacoes.mds.gov.br/sagi/servicos/misocial";

export interface FrequenciaBolsaFamilia {
  fonte: string;
  /** Competência do acompanhamento, formato AAAAMM. */
  competencia: string;
  /** Beneficiários com perfil de educação (4–17 anos). */
  publicoEducacao: number;
  acompanhados: number;
  percAcompanhados: number | null;
  /** A escola não os localizou — a lista nominal da busca ativa. */
  naoLocalizados: number;
  percNaoLocalizados: number | null;
  semInformacaoFrequencia: number;
  /** Dos acompanhados com informação, % com frequência acima do mínimo. */
  percFrequenciaAcima: number | null;
  sancoes: {
    advertencias: number;
    bloqueios: number;
    suspensoes: number;
    cancelamentos: number;
    familiasEmFaseDeSuspensao: number;
  };
}

interface DocMisocial {
  anomes_s?: string;
  [campo: string]: unknown;
}

function inteiro(doc: DocMisocial, campo: string): number {
  const valor = doc[campo];
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

function percentual(doc: DocMisocial, campo: string): number | null {
  const valor = doc[campo];
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

/** Interpretação pura do documento da Matriz, testável com fixture. */
export function interpretarFrequencia(doc: DocMisocial): FrequenciaBolsaFamilia | null {
  const publicoEducacao = inteiro(doc, "sicon_qtde_benef_perfil_educacao_4_17_anos_apartir_2023_l");
  if (publicoEducacao === 0) return null;

  const soma = (...campos: string[]) => campos.reduce((total, campo) => total + inteiro(doc, campo), 0);

  return {
    fonte: "MDS — Matriz de Informação Social / SICON (condicionalidade de educação do PBF)",
    competencia: String(doc.anomes_s ?? ""),
    publicoEducacao,
    acompanhados: inteiro(doc, "sicon_qtde_benef_acomp_educacao_4_17_anos_apartir_2023_l"),
    percAcompanhados: percentual(doc, "sicon_perc_benef_acomp_educacao_4_17_anos_apartir_2023_d"),
    naoLocalizados: inteiro(doc, "sicon_qtde_benef_nao_localizados_4_17_anos_apartir_2023_l"),
    percNaoLocalizados: percentual(doc, "sicon_perc_benef_nao_localizados_4_17_anos_apartir_2023_d"),
    semInformacaoFrequencia: inteiro(doc, "sicon_qtde_benef_sem_info_freq_4_17_anos_apartir_2023_l"),
    percFrequenciaAcima: percentual(doc, "sicon_perc_acomp_freq_acima_4_17_anos_apartir_2023_d"),
    sancoes: {
      advertencias: soma("sicon_qtde_advertencia_bf_apartir_2023_l", "sicon_qtde_advertencia_bva_apartir_2023_l"),
      bloqueios: soma("sicon_qtde_bloqueio_bf_apartir_2023_l", "sicon_qtde_bloqueio_bva_apartir_2023_l"),
      suspensoes: soma("sicon_qtde_suspensao_bf_apartir_2023_l", "sicon_qtde_suspensao_bva_apartir_2023_l"),
      cancelamentos: soma("sicon_qtde_cancelamento_bf_apartir_2023_l", "sicon_qtde_cancelamento_bva_apartir_2023_l"),
      familiasEmFaseDeSuspensao: inteiro(doc, "sicon_qtd_famlilias_fase_suspensao_apartir_2023_l"),
    },
  };
}

export async function getFrequenciaBolsaFamilia(
  codigoIBGE: string,
): Promise<FrequenciaBolsaFamilia | null> {
  const digits = codigoIBGE.replace(/\D/g, "");
  if (digits.length < 6) return null;

  try {
    // A Matriz indexa pelo código IBGE de **6 dígitos**, sem o verificador —
    // a mesma convenção do SIOPE. O filtro no campo do SICON garante a última
    // competência que tem o acompanhamento, não só o último mês publicado.
    const consulta =
      `q=codigo_ibge:${digits.slice(0, 6)} AND ` +
      `sicon_qtde_benef_perfil_educacao_4_17_anos_apartir_2023_l:[1 TO *]` +
      `&rows=1&wt=json&sort=anomes_s desc`;

    const resposta = await fetch(`${BASE}?${encodeURI(consulta)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!resposta.ok) throw new Error(`misocial HTTP ${resposta.status}`);

    const corpo = (await resposta.json()) as { response?: { docs?: DocMisocial[] } };
    const doc = corpo.response?.docs?.[0];
    return doc ? interpretarFrequencia(doc) : null;
  } catch {
    // MDS fora do ar: o bloco some do relatório em vez de derrubá-lo.
    return null;
  }
}
