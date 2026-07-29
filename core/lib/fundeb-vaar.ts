/**
 * Situação da rede municipal perante a **complementação VAAR** do FUNDEB.
 *
 * Os dados vêm de `data/fnde/vaar-2026.json`, gerado offline por
 * `scripts/dados/gerar-vaar-municipios.mjs` a partir de duas publicações do
 * FNDE (lista de beneficiários e Anexo VI da Portaria Interministerial).
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * VAAF e VAAT são calculados por fórmula: todo município recebe algum valor.
 * O VAAR não — o art. 14, §1º da Lei 14.113/2020 impõe cinco condicionalidades
 * e **reprovar em uma zera a parcela inteira**. Em 2026 isso deixou 2.502
 * redes municipais de fora, e as 3.025 habilitadas dividiram R$ 5,35 bilhões.
 *
 * Um levantamento que informa a receita do FUNDEB sem dizer se o município
 * está fora do VAAR — e por qual condicionalidade — omite a única parcela do
 * fundo que ele pode reverter por ato de gestão.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ARQUIVO = join("data", "fnde", "vaar-2026.json");

export type Condicionalidade = "I" | "II" | "III" | "IV" | "V";

/**
 * Texto curto de cada condicionalidade. O relatório vai ao gestor municipal,
 * então a redação descreve a obrigação, não o número do inciso.
 */
export const DESCRICAO_CONDICIONALIDADE: Record<Condicionalidade, string> = {
  I: "Provimento do cargo de gestor escolar por critério técnico de mérito e desempenho",
  II: "Participação de ao menos 80% dos estudantes no Saeb",
  III: "Redução das desigualdades socioeconômicas e raciais de aprendizagem",
  IV: "Regime de colaboração com o estado (ICMS educacional) — avaliado no estado",
  V: "Referencial curricular alinhado à BNCC aprovado pelo conselho de educação",
};

export interface ReferenciaVaar {
  /** Mediana da complementação entre os municípios beneficiados do país. */
  medianaNacional: number;
  /** Mediana entre os beneficiados da mesma UF — `null` se a UF não tiver nenhum. */
  medianaUf: number | null;
  ufBeneficiadas: number;
  ufAvaliadas: number;
}

export interface SituacaoVaar {
  exercicio: number;
  fonte: string;
  uf: string;
  ente: string;
  habilitado: boolean;
  beneficiario: boolean;
  /** Complementação recebida, em R$. Zero para quem não é beneficiário. */
  complementacao: number;
  coeficiente: number | null;
  /** `true` cumprida, `false` reprovada, `null` quando o FNDE não informou. */
  condicionalidades: Record<Condicionalidade, boolean | null>;
  /** Só as reprovadas, em ordem. Vazio quando habilitado. */
  reprovadas: Condicionalidade[];
  evoluiuAtendimento: boolean | null;
  evoluiuAprendizagem: boolean | null;
  pendencia: string | null;
  /**
   * `true` quando a Cond. IV foi reprovada em **todos** os municípios da UF.
   * A Resolução CIF nº 15/2025, art. 3º, §2º manda aplicar aos municípios a
   * habilitação do respectivo estado — então nesse caso a reprovação não é
   * do município e nenhuma ação local a reverte. Dizer o contrário ao gestor
   * seria vender solução para problema alheio.
   */
  condIVEstadual: boolean;
  /**
   * Habilitado que não recebeu nada: passou nas cinco condicionalidades mas
   * não evoluiu em nenhum dos dois indicadores. O rateio é proporcional ao
   * avanço, então habilitação sem evolução vale zero.
   */
  habilitadoSemRepasse: boolean;
  referencia: ReferenciaVaar;
}

interface RegistroMunicipio {
  uf?: string;
  ente?: string;
  cond?: Partial<Record<Condicionalidade, boolean | null>>;
  habilitado?: boolean;
  evoluiuAtendimento?: boolean | null;
  evoluiuAprendizagem?: boolean | null;
  beneficiario?: boolean;
  pendencia?: number | null;
  coeficiente?: number | null;
  complementacao?: number;
}

interface ArquivoVaar {
  exercicio?: number;
  fonte?: string;
  pendencias?: string[];
  municipios?: Record<string, RegistroMunicipio>;
}

const CONDICIONALIDADES: Condicionalidade[] = ["I", "II", "III", "IV", "V"];

let cache: ArquivoVaar | null | undefined;

function carregar(): ArquivoVaar | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(join(process.cwd(), ARQUIVO), "utf8")) as ArquivoVaar;
  } catch {
    // Dataset ausente (clone sem `npm run dados:vaar`): o bloco some do
    // relatório em vez de derrubar a geração inteira.
    cache = null;
  }
  return cache;
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[meio - 1] + ordenados[meio]) / 2
    : ordenados[meio];
}

/**
 * Estatísticas agregadas são as mesmas para todos os municípios, então são
 * calculadas uma vez na primeira consulta e reaproveitadas. Percorrer 5.569
 * registros a cada município de um lote seria desperdício puro.
 */
interface Agregados {
  medianaNacional: number;
  porUf: Map<string, { mediana: number; beneficiadas: number; avaliadas: number; condIVTodasReprovadas: boolean }>;
}

let agregados: Agregados | null | undefined;

function calcularAgregados(arquivo: ArquivoVaar): Agregados {
  const nacional: number[] = [];
  const porUfValores = new Map<string, number[]>();
  const porUfContagem = new Map<string, { avaliadas: number; condIVReprovadas: number }>();

  for (const registro of Object.values(arquivo.municipios ?? {})) {
    const uf = registro.uf ?? "";
    const contagem = porUfContagem.get(uf) ?? { avaliadas: 0, condIVReprovadas: 0 };
    contagem.avaliadas += 1;
    if (registro.cond?.IV === false) contagem.condIVReprovadas += 1;
    porUfContagem.set(uf, contagem);

    if (!registro.beneficiario) continue;
    const valor = registro.complementacao ?? 0;
    nacional.push(valor);
    const lista = porUfValores.get(uf) ?? [];
    lista.push(valor);
    porUfValores.set(uf, lista);
  }

  const porUf = new Map<string, { mediana: number; beneficiadas: number; avaliadas: number; condIVTodasReprovadas: boolean }>();
  for (const [uf, contagem] of porUfContagem) {
    const valores = porUfValores.get(uf) ?? [];
    porUf.set(uf, {
      mediana: mediana(valores),
      beneficiadas: valores.length,
      avaliadas: contagem.avaliadas,
      // Uma UF inteira reprovada na Cond. IV só acontece por reprovação do
      // estado. Exigir a totalidade evita confundir com um estado em que
      // muitos municípios falharam por conta própria.
      condIVTodasReprovadas: contagem.avaliadas > 0 && contagem.condIVReprovadas === contagem.avaliadas,
    });
  }

  return { medianaNacional: mediana(nacional), porUf };
}

export function getSituacaoVaar(codigoIBGE: string): SituacaoVaar | null {
  const arquivo = carregar();
  if (!arquivo) return null;

  const digits = codigoIBGE.replace(/\D/g, "");
  const registro = arquivo.municipios?.[digits];
  if (!registro) return null;

  if (agregados === undefined) agregados = calcularAgregados(arquivo);

  const uf = registro.uf ?? "";
  const estatisticaUf = agregados?.porUf.get(uf);

  const condicionalidades = Object.fromEntries(
    CONDICIONALIDADES.map((n) => [n, registro.cond?.[n] ?? null]),
  ) as Record<Condicionalidade, boolean | null>;

  const reprovadas = CONDICIONALIDADES.filter((n) => condicionalidades[n] === false);
  const habilitado = registro.habilitado === true;
  const beneficiario = registro.beneficiario === true;

  const pendencia =
    typeof registro.pendencia === "number" ? arquivo.pendencias?.[registro.pendencia] ?? null : null;

  return {
    exercicio: arquivo.exercicio ?? 0,
    fonte: arquivo.fonte ?? "FNDE — complementação VAAR do FUNDEB",
    uf,
    ente: registro.ente ?? "",
    habilitado,
    beneficiario,
    complementacao: registro.complementacao ?? 0,
    coeficiente: registro.coeficiente ?? null,
    condicionalidades,
    reprovadas,
    evoluiuAtendimento: registro.evoluiuAtendimento ?? null,
    evoluiuAprendizagem: registro.evoluiuAprendizagem ?? null,
    pendencia,
    condIVEstadual: condicionalidades.IV === false && estatisticaUf?.condIVTodasReprovadas === true,
    habilitadoSemRepasse: habilitado && !beneficiario,
    referencia: {
      medianaNacional: agregados?.medianaNacional ?? 0,
      medianaUf: estatisticaUf?.beneficiadas ? estatisticaUf.mediana : null,
      ufBeneficiadas: estatisticaUf?.beneficiadas ?? 0,
      ufAvaliadas: estatisticaUf?.avaliadas ?? 0,
    },
  };
}
