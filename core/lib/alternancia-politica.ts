import prefeitos2020 from "@/data/tse-prefeitos-2020.json";
import prefeitos2024 from "@/data/tse-prefeitos-2024.json";

/**
 * Ciclo político do município (roadmap #41) — quem governa, se houve
 * alternância na última eleição e onde o mandato está no calendário.
 *
 * Não é curiosidade eleitoral. Três consequências práticas para o
 * financiamento da educação:
 *
 * 1. **Alternância troca a secretaria** — diagnóstico, sistemas e contratos
 *    recomeçam, e a declaração do Censo (que define a receita do fundo no ano
 *    seguinte) é feita por uma equipe que acabou de chegar.
 * 2. **Reeleição acumula responsabilidade** — a série histórica de resultado
 *    é do próprio gestor, e a cobrança deixa de ter "herança" como resposta.
 * 3. **Ano eleitoral fecha janelas** — a Lei nº 9.504/1997, art. 73, VI, "a"
 *    veda transferência voluntária da União e dos estados aos municípios nos
 *    três meses que antecedem o pleito, e a LRF (art. 21 e 42) restringe
 *    despesa de pessoal e restos a pagar no último ano de mandato. Emenda e
 *    convênio têm calendário; quem descobre isso em julho do ano eleitoral
 *    perde o exercício.
 */
export interface MandatoEleito {
  prefeito: string;
  partido: string;
  eleicao: number;
}

export type SituacaoAlternancia =
  | "reeleicao"
  | "sucessao_mesmo_partido"
  | "alternancia"
  | "indeterminado";

export interface CicloPolitico {
  atual: MandatoEleito;
  anterior: MandatoEleito | null;
  situacao: SituacaoAlternancia;
  /** Anos do mandato em curso, do primeiro ao último. */
  mandato: { inicio: number; fim: number };
  /** Ano do próximo pleito municipal. */
  proximaEleicao: number;
  /** Panorama nacional da última eleição, como régua da situação local. */
  panorama: { reeleitos: number; sucessoes: number; alternancias: number; total: number } | null;
}

interface RegistroTse {
  municipio: string;
  uf: string;
  prefeito?: string;
  nomeUrna?: string;
  partido?: string;
  nomeCompleto?: string;
  eleicao?: string;
}

const base2020 = prefeitos2020 as unknown as Record<string, RegistroTse>;
const base2024 = prefeitos2024 as unknown as Record<string, RegistroTse>;

/** Mandato municipal: eleição em ano X, posse em X+1, quatro anos. */
function mandatoDaEleicao(eleicao: number) {
  return { inicio: eleicao + 1, fim: eleicao + 4 };
}

function nomeNormalizado(registro: RegistroTse): string {
  return (registro.nomeCompleto ?? registro.prefeito ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compara dois mandatos consecutivos. Puro de propósito: a regra de o que
 * conta como alternância é a parte que precisa de teste, não a leitura dos
 * arquivos.
 */
export function compararMandatos(
  anterior: RegistroTse | null,
  atual: RegistroTse,
): SituacaoAlternancia {
  if (!anterior) return "indeterminado";
  const nomeAnterior = nomeNormalizado(anterior);
  const nomeAtual = nomeNormalizado(atual);
  if (nomeAnterior && nomeAnterior === nomeAtual) return "reeleicao";
  // Sem partido em um dos lados não dá para distinguir sucessão de alternância
  // — e chamar de alternância o que pode ser continuidade partidária seria
  // afirmar mais do que a base sustenta.
  if (!anterior.partido || !atual.partido) return "indeterminado";
  return anterior.partido === atual.partido ? "sucessao_mesmo_partido" : "alternancia";
}

let panoramaCache: CicloPolitico["panorama"] = null;
let panoramaCalculado = false;

function panoramaNacional(): CicloPolitico["panorama"] {
  if (panoramaCalculado) return panoramaCache;
  panoramaCalculado = true;
  let reeleitos = 0;
  let sucessoes = 0;
  let alternancias = 0;
  let total = 0;
  for (const [codigo, atual] of Object.entries(base2024)) {
    const anterior = base2020[codigo] ?? null;
    if (!anterior) continue;
    const situacao = compararMandatos(anterior, atual);
    if (situacao === "indeterminado") continue;
    total += 1;
    if (situacao === "reeleicao") reeleitos += 1;
    else if (situacao === "sucessao_mesmo_partido") sucessoes += 1;
    else alternancias += 1;
  }
  panoramaCache = total > 0 ? { reeleitos, sucessoes, alternancias, total } : null;
  return panoramaCache;
}

export function getCicloPolitico(codigoIBGE: string): CicloPolitico | null {
  const digits = codigoIBGE.replace(/\D/g, "");
  const atual = base2024[digits];
  if (!atual) return null;
  const anterior = base2020[digits] ?? null;
  const eleicaoAtual = Number(atual.eleicao) || 2024;

  return {
    atual: {
      prefeito: atual.nomeUrna ?? atual.prefeito ?? "Não informado",
      partido: atual.partido ?? "",
      eleicao: eleicaoAtual,
    },
    anterior: anterior
      ? {
          prefeito: anterior.nomeUrna ?? anterior.prefeito ?? "Não informado",
          partido: anterior.partido ?? "",
          eleicao: Number(anterior.eleicao) || 2020,
        }
      : null,
    situacao: compararMandatos(anterior, atual),
    mandato: mandatoDaEleicao(eleicaoAtual),
    proximaEleicao: eleicaoAtual + 4,
    panorama: panoramaNacional(),
  };
}
