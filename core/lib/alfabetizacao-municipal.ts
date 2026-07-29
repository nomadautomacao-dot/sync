import dataset from "@/data/inep/alfabetizacao-municipios.json";

/**
 * Indicador Criança Alfabetizada (ICA) por município — resultado, meta
 * pactuada e participação na avaliação.
 *
 * O que torna este indicador diferente de todos os outros do dossiê: ele tem
 * **meta individual por município, ano a ano até 2030**. Não é referência
 * nacional nem mediana de pares — é o compromisso do próprio ente. Dá para
 * dizer, sem rodeio, se a meta do ano foi cumprida e quanto falta para a
 * próxima.
 */
export interface AlfabetizacaoAno {
  ano: number;
  valor: number;
  meta: number | null;
  cumpriu: boolean | null;
}

export interface AlfabetizacaoMunicipal {
  anoAvaliacao: number | null;
  /** Série observada, do ano mais antigo ao mais recente. */
  serie: AlfabetizacaoAno[];
  ultimo: AlfabetizacaoAno;
  /** Variação em pontos percentuais entre o primeiro e o último ano. */
  variacaoPontos: number | null;
  /** Meta do próximo ano ainda não avaliado e o esforço que ela exige. */
  proximaMeta: { ano: number; meta: number; faltamPontos: number } | null;
  /** Meta final do Compromisso e o ritmo anual que ela exige daqui para frente. */
  metaFinal: { ano: number; meta: number; ritmoNecessario: number } | null;
  /** Ritmo anual observado nos dois últimos anos da série. */
  ritmoObservado: number | null;
  nivel: number | null;
  nivelRotulo: string | null;
  participacao: number | null;
  /** Participação abaixo de 80% fragiliza a leitura do resultado. */
  participacaoFragil: boolean | null;
  /** Régua estadual: rede pública da UF no mesmo ano, quando publicada. */
  uf: { sigla: string; valor: number; ano: number } | null;
  fonte: string;
  fonteUfs: string;
}

interface RegistroBruto {
  uf: string;
  resultados: Record<string, number>;
  metas: Record<string, number>;
  nivel: number | null;
  participacao: number | null;
}

interface Bruto {
  geradoEm: string;
  fonte: string;
  fonteUfs: string;
  anoAvaliacao: number | null;
  niveis: Record<string, string>;
  municipios: Record<string, RegistroBruto>;
  ufs: Record<string, { resultados: Record<string, number>; metas: Record<string, number>; participacao: number | null }>;
}

const dados = dataset as unknown as Bruto;

function arredondar1(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/**
 * Análise pura — separada da leitura do dataset para ser testável com
 * qualquer trajetória, inclusive as que ainda não existem no Brasil.
 */
export function interpretarAlfabetizacao(
  registro: RegistroBruto,
  ufRegistro: { resultados: Record<string, number> } | null,
  contexto: { anoAvaliacao: number | null; niveis: Record<string, string>; fonte: string; fonteUfs: string },
): AlfabetizacaoMunicipal | null {
  const anos = Object.keys(registro.resultados)
    .map(Number)
    .filter((ano) => Number.isFinite(ano))
    .sort((a, b) => a - b);
  if (!anos.length) return null;

  const serie: AlfabetizacaoAno[] = anos.map((ano) => {
    const valor = registro.resultados[String(ano)];
    const meta = registro.metas[String(ano)] ?? null;
    return {
      ano,
      valor,
      meta,
      cumpriu: meta === null ? null : valor >= meta,
    };
  });
  const ultimo = serie[serie.length - 1];
  const primeiro = serie[0];

  const variacaoPontos = serie.length >= 2 ? arredondar1(ultimo.valor - primeiro.valor) : null;
  const ritmoObservado =
    serie.length >= 2
      ? arredondar1((ultimo.valor - serie[serie.length - 2].valor) / (ultimo.ano - serie[serie.length - 2].ano))
      : null;

  // Próxima meta = a do primeiro ano posterior ao último avaliado. Meta de ano
  // já avaliado não é "próxima" — é resultado, e já está na série.
  const anosMeta = Object.keys(registro.metas)
    .map(Number)
    .filter((ano) => Number.isFinite(ano))
    .sort((a, b) => a - b);
  const anoProxima = anosMeta.find((ano) => ano > ultimo.ano);
  const proximaMeta =
    anoProxima !== undefined
      ? {
          ano: anoProxima,
          meta: registro.metas[String(anoProxima)],
          faltamPontos: arredondar1(registro.metas[String(anoProxima)] - ultimo.valor),
        }
      : null;

  const anoFinal = anosMeta.length ? anosMeta[anosMeta.length - 1] : null;
  const metaFinal =
    anoFinal !== null && anoFinal > ultimo.ano
      ? {
          ano: anoFinal,
          meta: registro.metas[String(anoFinal)],
          ritmoNecessario: arredondar1(
            (registro.metas[String(anoFinal)] - ultimo.valor) / (anoFinal - ultimo.ano),
          ),
        }
      : null;

  const nivelRotulo =
    registro.nivel === null ? null : contexto.niveis[String(registro.nivel)] ?? null;

  const ufValor = ufRegistro?.resultados[String(ultimo.ano)];
  return {
    anoAvaliacao: contexto.anoAvaliacao,
    serie,
    ultimo,
    variacaoPontos,
    proximaMeta,
    metaFinal,
    ritmoObservado,
    nivel: registro.nivel,
    nivelRotulo,
    participacao: registro.participacao,
    participacaoFragil: registro.participacao === null ? null : registro.participacao < 80,
    uf:
      registro.uf && typeof ufValor === "number"
        ? { sigla: registro.uf, valor: ufValor, ano: ultimo.ano }
        : null,
    fonte: contexto.fonte,
    fonteUfs: contexto.fonteUfs,
  };
}

export function getAlfabetizacaoMunicipal(codigoIBGE: string): AlfabetizacaoMunicipal | null {
  const digits = codigoIBGE.replace(/\D/g, "");
  const registro = dados.municipios[digits];
  if (!registro) return null;
  return interpretarAlfabetizacao(registro, dados.ufs[registro.uf] ?? null, {
    anoAvaliacao: dados.anoAvaliacao,
    niveis: dados.niveis,
    fonte: dados.fonte,
    fonteUfs: dados.fonteUfs,
  });
}
