import { coletarAssistencia } from "./assistencia";
import { coletarConformidadeEducacional } from "./conformidade-educacional";
import { coletarEmprego } from "./emprego";
import { coletarGovernancaEducacional } from "./governanca-educacional";
import { coletarInstitucional } from "./institucional";
import { coletarSaneamento } from "./saneamento";
import { coletarSaude } from "./saude";
import type { FalhaColeta, MunicipalProfile } from "./types";

export * from "./types";

interface ResultadoColeta<T> {
  bloco: T | null;
  falhas: FalhaColeta[];
}

/**
 * Extrai o bloco de um `Promise.allSettled`. Um coletor que rejeita — o que
 * não deveria acontecer, já que todos capturam internamente — vira falha
 * registrada em vez de derrubar o perfil inteiro.
 */
function desempacotar<T>(
  resultado: PromiseSettledResult<ResultadoColeta<T>>,
  bloco: string,
): ResultadoColeta<T> {
  if (resultado.status === "fulfilled") return resultado.value;
  const motivo = resultado.reason instanceof Error ? resultado.reason.message : String(resultado.reason);
  return { bloco: null, falhas: [{ bloco, fonte: "coletor", motivo }] };
}

/**
 * Monta o Perfil Municipal — a leitura da cidade inteira que antecede o
 * levantamento FUNDEB.
 *
 * Os cinco coletores são independentes e rodam em paralelo: cada um fala com
 * bases diferentes (IBGE/SIDRA, DATASUS, IPEADATA, MDS), e a queda de uma não
 * pode zerar as outras. O perfil sempre volta — o que falha vira `falhas`, que
 * o relatório imprime em vez de fingir que o dado é zero.
 */
export async function buildMunicipalProfile(params: {
  codigoIbge: string;
  uf: string;
  municipio: string;
}): Promise<MunicipalProfile> {
  const [saneamento, institucional, emprego, saude, assistencia, governanca, conformidade] =
    await Promise.allSettled([
      coletarSaneamento(params),
      coletarInstitucional(params),
      coletarEmprego(params),
      coletarSaude(params),
      coletarAssistencia(params),
      coletarGovernancaEducacional(params),
      coletarConformidadeEducacional(params),
    ]);

  const blocos = [
    desempacotar(saneamento, "saneamento"),
    desempacotar(institucional, "institucional"),
    desempacotar(emprego, "emprego"),
    desempacotar(saude, "saude"),
    desempacotar(assistencia, "assistencia"),
    desempacotar(governanca, "governanca-educacional"),
    desempacotar(conformidade, "conformidade-educacional"),
  ] as const;

  return {
    codigoIbge: params.codigoIbge,
    municipio: params.municipio,
    uf: params.uf,
    coletadoEm: new Date(),
    saneamento: blocos[0].bloco,
    institucional: blocos[1].bloco,
    emprego: blocos[2].bloco,
    saude: blocos[3].bloco,
    assistencia: blocos[4].bloco,
    governancaEducacional: blocos[5].bloco,
    conformidadeEducacional: blocos[6].bloco,
    falhas: blocos.flatMap((b) => b.falhas),
  };
}
