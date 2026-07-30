import coberturaBruta from "@/data/datasus/cobertura-vacinal.json";
import violenciaBruta from "@/data/datasus/violencia-infantil.json";

/**
 * Dois termômetros de saúde que dizem algo sobre a escola — e as duas regras
 * de leitura que impedem cada um de virar rótulo do município.
 *
 * ## Cobertura vacinal (PNI)
 *
 * Não é indicador de educação. É o melhor termômetro público de **capilaridade
 * da atenção primária no território**, e a atenção primária é quem executa o
 * Programa Saúde na Escola. Onde a equipe não alcança a criança para vacinar,
 * dificilmente alcança para o PSE.
 *
 * **Cobertura acima de 100% é comum e não é erro.** Numerador é dose aplicada,
 * denominador é população estimada: dose em não residente e estimativa
 * defasada empurram o índice acima de 100. Por isso, acima de 100% este módulo
 * devolve `semLeitura` — não "excelente".
 *
 * A régua é a **mediana nacional do próprio dataset**, não uma meta. O módulo
 * não afirma parâmetro do PNI que não leu na fonte.
 *
 * ## Violência notificada (SINAN)
 *
 * A regra vem antes do número: **é contagem de notificação, não de
 * ocorrência.** Notificar mais pode ser vigilância melhor. Notificar zero quase
 * nunca é ausência de violência — é ausência de registro.
 *
 * Por isso este módulo **não** ordena municípios por violência e **não**
 * calcula taxa por 100 mil para comparar. Ele responde uma pergunta só, que é
 * sobre fluxo e não sobre crianças: *a rede de proteção registra?* A Lei nº
 * 13.431/2017 e o ECA (art. 245) obrigam o profissional de educação a notificar
 * suspeita de violência, então zero notificação numa rede grande é indício
 * sobre o fluxo — e é assim que a página trata.
 */

interface ArquivoCobertura {
  fonte?: string;
  ressalva?: string;
  anos?: number[];
  vacinas?: { chave: string; rotulo: string }[];
  municipios?: Record<string, Record<string, Record<string, number>>>;
}

interface ArquivoViolencia {
  fonte?: string;
  ressalva?: string;
  faixaEtaria?: string;
  anos?: number[];
  municipios?: Record<string, Record<string, number>>;
}

const cobertura = coberturaBruta as ArquivoCobertura;
const violencia = violenciaBruta as ArquivoViolencia;

/** Acima disto o índice não sustenta leitura de déficit — ver doc-comment. */
const TETO_LEITURA = 100;

export interface VacinaMunicipio {
  chave: string;
  rotulo: string;
  ano: number;
  valor: number;
  /** Mediana nacional do mesmo ano, sobre os municípios com dado. */
  medianaNacional: number | null;
  /** Acima de 100%: o índice existe, mas não sustenta leitura. */
  semLeitura: boolean;
  /** Abaixo da mediana nacional e dentro da faixa que sustenta leitura. */
  abaixoDaMediana: boolean;
}

export interface CoberturaVacinalMunicipio {
  fonte: string;
  ressalva: string;
  ano: number;
  vacinas: VacinaMunicipio[];
  /** Quantas vacinas ficam abaixo da mediana nacional. */
  abaixoDaMediana: number;
  /** Quantas passam de 100% e por isso não entram na leitura. */
  semLeitura: number;
}

export interface ViolenciaInfantilMunicipio {
  fonte: string;
  ressalva: string;
  faixaEtaria: string;
  serie: { ano: number; notificacoes: number }[];
  ultimo: { ano: number; notificacoes: number } | null;
  total: number;
  /** Nenhuma notificação em nenhum exercício da série. */
  silencioTotal: boolean;
  /** Quantos municípios do país registraram algo no último exercício. */
  municipiosNotificantes: number;
  municipiosNoPais: number;
}

/** Mediana nacional por vacina e ano, calculada uma vez por processo. */
const medianas = new Map<string, number | null>();

function medianaNacional(vacina: string, ano: number): number | null {
  const chave = `${vacina}:${ano}`;
  const memo = medianas.get(chave);
  if (memo !== undefined) return memo;

  const valores: number[] = [];
  for (const registro of Object.values(cobertura.municipios ?? {})) {
    const valor = registro?.[vacina]?.[String(ano)];
    if (typeof valor === "number" && Number.isFinite(valor)) valores.push(valor);
  }
  valores.sort((a, b) => a - b);
  const meio = Math.floor(valores.length / 2);
  const resultado =
    valores.length === 0
      ? null
      : Math.round(
          (valores.length % 2 === 0 ? (valores[meio - 1] + valores[meio]) / 2 : valores[meio]) * 10,
        ) / 10;
  medianas.set(chave, resultado);
  return resultado;
}

/** A fonte publica com 6 dígitos; o resto do projeto usa 7. */
function seisDigitos(codigoIBGE: string): string {
  return String(codigoIBGE ?? "").replace(/\D/g, "").slice(0, 6);
}

export function getCoberturaVacinal(codigoIBGE: string): CoberturaVacinalMunicipio | null {
  const registro = cobertura.municipios?.[seisDigitos(codigoIBGE)];
  if (!registro) return null;

  const catalogo = cobertura.vacinas ?? [];
  const vacinas: VacinaMunicipio[] = [];

  for (const { chave, rotulo } of catalogo) {
    const serie = registro[chave];
    if (!serie) continue;
    // O último exercício com dado desta vacina neste município — vacinas
    // diferentes podem parar em anos diferentes.
    const anos = Object.keys(serie)
      .map(Number)
      .filter((a) => Number.isFinite(a))
      .sort((a, b) => b - a);
    const ano = anos[0];
    const valor = ano === undefined ? undefined : serie[String(ano)];
    if (ano === undefined || typeof valor !== "number") continue;

    const mediana = medianaNacional(chave, ano);
    const semLeitura = valor > TETO_LEITURA;
    vacinas.push({
      chave,
      rotulo,
      ano,
      valor,
      medianaNacional: mediana,
      semLeitura,
      abaixoDaMediana: !semLeitura && mediana !== null && valor < mediana,
    });
  }

  if (vacinas.length === 0) return null;

  return {
    fonte: cobertura.fonte ?? "Ministério da Saúde — PNI/DATASUS",
    ressalva: cobertura.ressalva ?? "",
    ano: Math.max(...vacinas.map((v) => v.ano)),
    vacinas,
    abaixoDaMediana: vacinas.filter((v) => v.abaixoDaMediana).length,
    semLeitura: vacinas.filter((v) => v.semLeitura).length,
  };
}

/** Municípios com ao menos uma notificação no exercício — calculado uma vez. */
let notificantesPorAno: Map<number, number> | null = null;

function contarNotificantes(ano: number): number {
  if (!notificantesPorAno) {
    notificantesPorAno = new Map();
    for (const registro of Object.values(violencia.municipios ?? {})) {
      for (const [chave, valor] of Object.entries(registro ?? {})) {
        if (typeof valor === "number" && valor > 0) {
          const a = Number(chave);
          notificantesPorAno.set(a, (notificantesPorAno.get(a) ?? 0) + 1);
        }
      }
    }
  }
  return notificantesPorAno.get(ano) ?? 0;
}

/**
 * Devolve registro mesmo para município **sem nenhuma notificação** — o
 * silêncio é o achado, e devolver `null` o esconderia. Só devolve `null` quando
 * o código não é de município válido.
 */
export function getViolenciaInfantil(codigoIBGE: string): ViolenciaInfantilMunicipio | null {
  const codigo = seisDigitos(codigoIBGE);
  if (codigo.length !== 6) return null;

  const anos = (violencia.anos ?? []).slice().sort((a, b) => a - b);
  if (anos.length === 0) return null;

  const registro = violencia.municipios?.[codigo] ?? {};
  const serie = anos.map((ano) => ({
    ano,
    notificacoes: typeof registro[String(ano)] === "number" ? registro[String(ano)] : 0,
  }));
  const total = serie.reduce((t, x) => t + x.notificacoes, 0);
  const ultimoAno = anos[anos.length - 1];

  return {
    fonte: violencia.fonte ?? "Ministério da Saúde/SVSA — SINAN Net",
    ressalva: violencia.ressalva ?? "",
    faixaEtaria: violencia.faixaEtaria ?? "5 a 14 anos",
    serie,
    ultimo: serie[serie.length - 1] ?? null,
    total,
    silencioTotal: total === 0,
    municipiosNotificantes: contarNotificantes(ultimoAno),
    municipiosNoPais: 5570,
  };
}
