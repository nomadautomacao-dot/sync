import {
  getDemografiaEducacional,
  type CoorteNascimento,
  type DemografiaEducacional,
} from "./demografia-educacional";
import { getFrequenciaBolsaFamilia, type FrequenciaBolsaFamilia } from "./bolsa-familia-frequencia";
import { getPopulacaoRural, type PopulacaoRural } from "./densidade-rede";
import { getInepCensoMunicipalRecord, type InepCensoMunicipalRecord } from "./inep-censo";
import { getCatalogoSegmentos } from "./fundeb-ponderacao";
import { getValorAlunoAno } from "./fundeb-valor-aluno";

/**
 * Dossiê da Demanda — a rede de 2032 já nasceu.
 *
 * ## A tese
 *
 * A matrícula segue o nascimento com **atraso fixo e conhecido**: quem nasceu
 * em 2024 entra na pré-escola em 2028 e no 1º ano em 2030. O Registro Civil já
 * contou todas essas crianças, uma a uma, por município de residência da mãe.
 * Não existe incerteza demográfica de curto prazo em educação básica — existe
 * gente que não olhou.
 *
 * Este dossiê transforma isso em planejamento: quantas vagas, em que ano, em
 * que etapa. E, do outro lado, quantas crianças da idade obrigatória **não
 * estão em rede nenhuma** — que é criança fora da escola antes de ser receita
 * não capturada.
 *
 * ## Os dois denominadores, e por que os dois aparecem
 *
 * Cobertura calculada só com a matrícula municipal responde "quanto desta faixa
 * a prefeitura atende". Calculada com a matrícula de todas as redes responde
 * "quanto desta faixa está na escola". A primeira é o piso do município; a
 * segunda é a foto do território. A distância entre elas é o que outra rede
 * atende; o que falta na segunda para 100% é criança fora da escola.
 *
 * Apresentar só uma das duas produz erro em direções opostas — e as duas juntas
 * não custam nada, porque o Censo Escolar publica os dois recortes.
 */

/** Meta 1 do PNE: 50% da população de 0 a 3 anos em creche. */
const META_PNE_CRECHE = 50;
/** Metas de universalização: pré-escola (4–5) e fundamental (6–14). */
const META_PNE_UNIVERSAL = 100;

/** O fator de maior retorno por matrícula sem mudar o público atendido. */
const SEGMENTO_CRECHE_INTEGRAL = "Creche Integral Pública Urbano";

export type ChaveFaixa = "creche" | "preEscola" | "anosIniciais" | "anosFinais";

export interface FaixaCobertura {
  chave: ChaveFaixa;
  rotulo: string;
  idade: string;
  populacao: number;
  matriculaMunicipal: number;
  matriculaTotal: number;
  /** Matrícula da rede municipal ÷ população da faixa, em %. */
  coberturaMunicipal: number | null;
  /** Matrícula de todas as redes ÷ mesma população, em %. */
  coberturaTotal: number | null;
  metaPne: number;
  /**
   * `true` para as faixas de matrícula **obrigatória** — 4 a 17 anos, pela EC
   * 59/2009. Creche não é: 0 a 3 é direito da família e dever de oferta do
   * Estado, não obrigação de matrícula.
   *
   * A distinção não é jurídica de gabinete, é o que separa dois números que
   * não podem ser somados. Criança de 7 anos fora da escola é ilegalidade;
   * criança de 2 anos fora da creche é demanda não atendida. Em Paulo Afonso a
   * soma das duas dá 5.428 e a leitura correta é 563 — dizer 5.428 é o tipo de
   * exagero que o secretário desmonta em uma frase.
   */
  obrigatoria: boolean;
  /**
   * Crianças da faixa que não aparecem em rede nenhuma. `null` quando a
   * cobertura total passa de 100% — ali a conta perde sentido, porque o
   * numerador inclui alunos que moram em outro município.
   */
  foraDaEscola: number | null;
  /** Matrículas que faltam para a meta do PNE, na foto completa. */
  faltamParaMeta: number;
  /**
   * `true` quando a cobertura total passa de 100%. Não é erro: significa que a
   * rede atrai alunos de municípios vizinhos, e o denominador é a população
   * residente daqui.
   */
  atraiDeFora: boolean;
}

export interface AnoProjetado {
  ano: number;
  /** Ano de nascimento da coorte que faz 6 anos neste ano. */
  coorteDoPrimeiroAno: number;
  chegamAoPrimeiroAno: number;
  /** Anos de nascimento das coortes de 4 e 5 anos. Vazio se não são conhecidas. */
  coortesDaPreEscola: number[];
  /** Soma das coortes de 4 e 5 anos. `null` quando falta alguma. */
  naPreEscola: number | null;
}

export interface ContaDaCreche {
  populacao: number;
  matriculaTotal: number;
  coberturaTotal: number | null;
  metaPct: number;
  /** Matrículas a criar para alcançar a meta do PNE. Zero se já alcançada. */
  matriculasAteMeta: number;
  /** Fator de ponderação da creche integral pública urbana. */
  fatorIntegral: number | null;
  /** `matriculasAteMeta × fator`. Derivado. */
  equivalentes: number | null;
  /** VAAF do segmento de fator 1,00 na UF. */
  valorPorEquivalente: number | null;
  /** `equivalentes × valorPorEquivalente`. Derivado — nunca "receita garantida". */
  valorDerivado: number | null;
}

export interface DossieDemanda {
  municipio: string;
  uf: string;
  demografia: DemografiaEducacional | null;
  censo: InepCensoMunicipalRecord | null;
  faixas: FaixaCobertura[];
  projecao: AnoProjetado[];
  creche: ContaDaCreche | null;
  buscaAtiva: FrequenciaBolsaFamilia | null;
  rural: PopulacaoRural | null;
  ausencias: string[];
  resumo: {
    /** Variação entre a primeira e a última coorte, em %. */
    tendenciaNascimentos: number | null;
    /** Total de crianças de 0 a 14 no Censo 2022. */
    populacaoEmIdadeEscolar: number;
    coberturaCrecheMunicipal: number | null;
    coberturaCrecheTotal: number | null;
    /**
     * Crianças de **idade obrigatória** (4 a 14) fora de qualquer rede. Creche
     * fica de fora de propósito — ver `FaixaCobertura.obrigatoria`.
     */
    foraDaEscolaObrigatoria: number | null;
    /** Crianças de 0 a 3 sem vaga. É demanda não atendida, não ilegalidade. */
    demandaCrecheNaoAtendida: number | null;
    naoLocalizadosBolsaFamilia: number | null;
    /** A coorte mais recente e o ano em que ela chega ao 1º ano. */
    proximaCoorte: { nascimento: number; nascidos: number; chegaEm: number } | null;
  };
}

const ROTULO_FAIXA: Record<ChaveFaixa, { rotulo: string; idade: string }> = {
  creche: { rotulo: "Creche", idade: "0 a 3 anos" },
  preEscola: { rotulo: "Pré-escola", idade: "4 e 5 anos" },
  anosIniciais: { rotulo: "Anos iniciais do fundamental", idade: "6 a 10 anos" },
  anosFinais: { rotulo: "Anos finais do fundamental", idade: "11 a 14 anos" },
};

const META_DA_FAIXA: Record<ChaveFaixa, number> = {
  creche: META_PNE_CRECHE,
  preEscola: META_PNE_UNIVERSAL,
  anosIniciais: META_PNE_UNIVERSAL,
  anosFinais: META_PNE_UNIVERSAL,
};

function pct(parte: number, total: number): number | null {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : null;
}

/**
 * Cobertura das quatro faixas, com os dois denominadores lado a lado.
 *
 * Exportada para teste: a regra de "cobertura acima de 100% não é erro" é o
 * tipo de coisa que se conserta errado quando alguém a encontra sem contexto.
 */
export function montarFaixas(
  demografia: DemografiaEducacional | null,
  censo: InepCensoMunicipalRecord | null,
): FaixaCobertura[] {
  if (!demografia || !censo) return [];

  const matriculas: Record<ChaveFaixa, { municipal: number; total: number }> = {
    creche: { municipal: censo.crecheMunicipal, total: censo.crecheTotal },
    preEscola: { municipal: censo.preEscolaMunicipal, total: censo.preEscolaTotal },
    anosIniciais: {
      municipal: censo.anosIniciaisFundamentalMunicipal ?? 0,
      total: censo.anosIniciaisFundamentalTotal ?? 0,
    },
    anosFinais: {
      municipal: censo.anosFinaisFundamentalMunicipal ?? 0,
      total: censo.anosFinaisFundamentalTotal ?? 0,
    },
  };

  return (Object.keys(ROTULO_FAIXA) as ChaveFaixa[])
    .filter((chave) => demografia.faixas[chave] > 0)
    .map((chave) => {
      const populacao = demografia.faixas[chave];
      const { municipal, total } = matriculas[chave];
      const coberturaTotal = pct(total, populacao);
      const meta = META_DA_FAIXA[chave];
      const atraiDeFora = coberturaTotal !== null && coberturaTotal > 100;

      return {
        chave,
        rotulo: ROTULO_FAIXA[chave].rotulo,
        idade: ROTULO_FAIXA[chave].idade,
        populacao,
        matriculaMunicipal: municipal,
        matriculaTotal: total,
        coberturaMunicipal: pct(municipal, populacao),
        coberturaTotal,
        metaPne: meta,
        obrigatoria: chave !== "creche",
        foraDaEscola: atraiDeFora ? null : Math.max(0, populacao - total),
        faltamParaMeta: Math.max(0, Math.round((meta / 100) * populacao) - total),
        atraiDeFora,
      };
    });
}

/**
 * O calendário de chegada, ano a ano, a partir das coortes já nascidas.
 *
 * Só entra ano cuja coorte do 1º ano é conhecida — projetar sobre nascimento
 * que ainda não aconteceu seria projeção populacional, que é outra coisa e tem
 * outro erro. O que este dossiê faz é contar quem já existe.
 */
export function montarProjecao(nascimentos: CoorteNascimento[]): AnoProjetado[] {
  const porAnoDeNascimento = new Map(nascimentos.map((n) => [n.anoNascimento, n.nascidos]));

  return nascimentos
    .map((coorte) => {
      const ano = coorte.chegaPrimeiroAnoEm;
      // Na pré-escola do mesmo ano estão as coortes de 4 e 5 anos.
      const anosPre = [ano - 5, ano - 4];
      const conhecidas = anosPre.filter((a) => porAnoDeNascimento.has(a));

      return {
        ano,
        coorteDoPrimeiroAno: coorte.anoNascimento,
        chegamAoPrimeiroAno: coorte.nascidos,
        coortesDaPreEscola: conhecidas,
        naPreEscola:
          conhecidas.length === anosPre.length
            ? conhecidas.reduce((t, a) => t + (porAnoDeNascimento.get(a) ?? 0), 0)
            : null,
      };
    })
    .sort((a, b) => a.ano - b.ano);
}

/**
 * A conta da creche — o maior fator disponível sem mudar o público atendido.
 *
 * O valor em reais é **derivado**, pela mesma aritmética da Portaria que o
 * Dossiê da Matrícula Ponderada usa. E carrega uma ressalva que aquele não
 * precisa: abrir vaga de creche **custa**. A receita por matrícula é real e
 * entra no exercício seguinte, mas não paga a vaga sozinha — o número serve
 * para dimensionar a decisão, não para vendê-la como lucro.
 */
export function montarContaDaCreche(
  faixa: FaixaCobertura | undefined,
  uf: string,
): ContaDaCreche | null {
  if (!faixa || faixa.chave !== "creche") return null;

  const catalogo = getCatalogoSegmentos();
  const fatorIntegral = catalogo.find((s) => s.nome === SEGMENTO_CRECHE_INTEGRAL)?.fatorVaaf ?? null;
  const valores = getValorAlunoAno(uf);
  const valorPorEquivalente =
    valores && valores.fundamentalParcialAnosIniciais > 0
      ? valores.fundamentalParcialAnosIniciais
      : null;

  const equivalentes = fatorIntegral === null ? null : faixa.faltamParaMeta * fatorIntegral;

  return {
    populacao: faixa.populacao,
    matriculaTotal: faixa.matriculaTotal,
    coberturaTotal: faixa.coberturaTotal,
    metaPct: faixa.metaPne,
    matriculasAteMeta: faixa.faltamParaMeta,
    fatorIntegral,
    equivalentes,
    valorPorEquivalente,
    valorDerivado:
      equivalentes === null || valorPorEquivalente === null
        ? null
        : equivalentes * valorPorEquivalente,
  };
}

export async function montarDossieDemanda(
  codigoIBGE: string,
  municipio: string,
  uf: string,
): Promise<DossieDemanda> {
  // Três consultas ao vivo, independentes. Nenhuma derruba o dossiê: cada
  // seção some com a explicação de por quê.
  const [demografiaRes, buscaRes, ruralRes] = await Promise.allSettled([
    getDemografiaEducacional(codigoIBGE),
    getFrequenciaBolsaFamilia(codigoIBGE),
    getPopulacaoRural(codigoIBGE),
  ]);

  const demografia = demografiaRes.status === "fulfilled" ? demografiaRes.value : null;
  const buscaAtiva = buscaRes.status === "fulfilled" ? buscaRes.value : null;
  const rural = ruralRes.status === "fulfilled" ? ruralRes.value : null;
  const censo = getInepCensoMunicipalRecord(codigoIBGE);

  const ausencias: string[] = [];
  if (!demografia) {
    ausencias.push(
      "As duas consultas ao IBGE — população por idade do Censo 2022 e nascidos vivos do Registro Civil — não responderam nesta emissão. Sem elas não há coorte nem denominador de cobertura, e as folhas correspondentes saem vazias em vez de estimadas.",
    );
  }
  if (!censo) {
    ausencias.push(
      "O Censo Escolar não trouxe matrícula por etapa para este município — sem o numerador não há cobertura.",
    );
  }
  if (!buscaAtiva) {
    ausencias.push(
      "A Matriz de Informação Social do MDS não respondeu, ou o município não tem público de educação no Bolsa Família na competência publicada. A folha de busca ativa sai vazia.",
    );
  }
  if (!rural) {
    ausencias.push("A consulta de população urbana e rural ao SIDRA não respondeu nesta emissão.");
  }

  const faixas = montarFaixas(demografia, censo);
  const projecao = montarProjecao(demografia?.nascimentos ?? []);
  const creche = montarContaDaCreche(
    faixas.find((f) => f.chave === "creche"),
    uf,
  );

  const fora = faixas
    .filter((f) => f.obrigatoria)
    .map((f) => f.foraDaEscola)
    .filter((v): v is number => v !== null);

  const ultima = demografia?.nascimentos[demografia.nascimentos.length - 1] ?? null;

  return {
    municipio,
    uf,
    demografia,
    censo,
    faixas,
    projecao,
    creche,
    buscaAtiva,
    rural,
    ausencias,
    resumo: {
      tendenciaNascimentos: demografia?.tendenciaNascimentosPct ?? null,
      populacaoEmIdadeEscolar: demografia
        ? Object.values(demografia.faixas).reduce((t, v) => t + v, 0)
        : 0,
      coberturaCrecheMunicipal: faixas.find((f) => f.chave === "creche")?.coberturaMunicipal ?? null,
      coberturaCrecheTotal: faixas.find((f) => f.chave === "creche")?.coberturaTotal ?? null,
      foraDaEscolaObrigatoria: fora.length > 0 ? fora.reduce((t, v) => t + v, 0) : null,
      demandaCrecheNaoAtendida: faixas.find((f) => f.chave === "creche")?.foraDaEscola ?? null,
      naoLocalizadosBolsaFamilia: buscaAtiva?.naoLocalizados ?? null,
      proximaCoorte: ultima
        ? {
            nascimento: ultima.anoNascimento,
            nascidos: ultima.nascidos,
            chegaEm: ultima.chegaPrimeiroAnoEm,
          }
        : null,
    },
  };
}
