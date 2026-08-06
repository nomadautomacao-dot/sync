import { lerJsonDeDados } from "@/core/lib/dados-arquivo";

/**
 * Rendimento escolar e distorção idade-série por município — a metade do IDEB
 * que não é prova.
 *
 * O IDEB é `nota padronizada × indicador de rendimento`. A nota vem do Saeb e
 * demora dois anos para responder a qualquer política; o rendimento vem do
 * Censo e responde no ano seguinte. Um município que quer subir o índice tem
 * dois caminhos, e o segundo é sempre o mais rápido.
 *
 * ## Precedência de rede
 *
 * O dataset guarda os recortes `municipal`, `publica` e `total`, nesta ordem de
 * preferência. `total` mistura estadual e privada e só existe onde não há
 * municipal nem pública — nesses casos o dado descreve o território, não a
 * rede, e quem lê precisa saber disso: por isso o recorte usado sai no retorno.
 *
 * ## Ausência não é zero
 *
 * Chave ausente significa "o INEP não publicou", nunca 0%. Toda leitura devolve
 * `null` no lugar, e o relatório imprime `—`.
 */

export type RecorteRede = "municipal" | "publica" | "total";

export interface FluxoEtapa {
  aprovacao: number | null;
  reprovacao: number | null;
  abandono: number | null;
  distorcao: number | null;
}

export interface RendimentoMunicipal {
  municipio: string;
  uf: string;
  anoReferencia: number;
  /** Qual recorte de rede o retorno usou — muda o que os números descrevem. */
  recorte: RecorteRede;
  anosIniciais: FluxoEtapa;
  anosFinais: FluxoEtapa;
  fundamental: FluxoEtapa;
  /** Componentes do IDEB, quando publicados para a etapa. */
  idebAnosIniciais: ComponentesIdeb | null;
  idebAnosFinais: ComponentesIdeb | null;
  fonte: string;
}

export interface ComponentesIdeb {
  taxaAprovacao: number | null;
  /** Aprovação convertida no fator do IDEB (0 a 1). */
  indicadorRendimento: number | null;
  notaMatematica: number | null;
  notaPortugues: number | null;
  /** Nota padronizada média (escala 0–10) — o outro fator do produto. */
  notaMedia: number | null;
  idebObservado: number | null;
}

interface BlocoIdeb {
  taxaAprovacao?: number;
  indicadorRendimento?: number;
  notaMatematica?: number;
  notaPortugues?: number;
  notaMedia?: number;
  idebObservado?: number;
}

interface BlocoRendimento {
  aprovacao?: Record<string, number>;
  reprovacao?: Record<string, number>;
  abandono?: Record<string, number>;
}

interface RegistroBruto {
  municipio?: string;
  uf?: string;
  anosIniciais?: Partial<Record<RecorteRede, BlocoIdeb>>;
  anosFinais?: Partial<Record<RecorteRede, BlocoIdeb>>;
  distorcao?: Partial<Record<RecorteRede, Record<string, number>>>;
  rendimento?: Partial<Record<RecorteRede, BlocoRendimento>>;
}

interface Bruto {
  meta?: { anoReferencia?: number; fontes?: unknown };
  municipios: Record<string, RegistroBruto>;
}

/* Lido em execução: 6 MB que o TypeScript deduziria a cada checagem.
 * Ver `core/lib/dados-arquivo.ts`. */
const dados = lerJsonDeDados<Bruto>("data/inep-rendimento-municipal-2023.json");

const PRECEDENCIA: RecorteRede[] = ["municipal", "publica", "total"];

function num(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function componentes(bloco: BlocoIdeb | undefined): ComponentesIdeb | null {
  if (!bloco) return null;
  return {
    taxaAprovacao: num(bloco.taxaAprovacao),
    indicadorRendimento: num(bloco.indicadorRendimento),
    notaMatematica: num(bloco.notaMatematica),
    notaPortugues: num(bloco.notaPortugues),
    notaMedia: num(bloco.notaMedia),
    idebObservado: num(bloco.idebObservado),
  };
}

export function getRendimentoMunicipal(codigoIBGE: string): RendimentoMunicipal | null {
  const digits = codigoIBGE.replace(/\D/g, "");
  const registro = dados.municipios?.[digits];
  if (!registro) return null;

  // O recorte é escolhido uma vez, pelo bloco de rendimento, e vale para o
  // documento inteiro: misturar municipal aqui e público ali produziria uma
  // tabela em que as linhas não descrevem a mesma rede.
  const recorte = PRECEDENCIA.find((r) => registro.rendimento?.[r]) ?? null;
  if (!recorte) return null;

  const fluxo = registro.rendimento?.[recorte];
  const distorcao = registro.distorcao?.[recorte] ?? registro.distorcao?.municipal;

  const etapa = (chaveFluxo: string, chaveDistorcao: string): FluxoEtapa => ({
    aprovacao: num(fluxo?.aprovacao?.[chaveFluxo]),
    reprovacao: num(fluxo?.reprovacao?.[chaveFluxo]),
    abandono: num(fluxo?.abandono?.[chaveFluxo]),
    distorcao: num(distorcao?.[chaveDistorcao]),
  });

  return {
    municipio: registro.municipio ?? "",
    uf: registro.uf ?? "",
    anoReferencia: dados.meta?.anoReferencia ?? 0,
    recorte,
    anosIniciais: etapa("anosIniciais", "anosIniciais"),
    anosFinais: etapa("anosFinais", "anosFinais"),
    fundamental: etapa("total", "fundamentalTotal"),
    idebAnosIniciais: componentes(registro.anosIniciais?.[recorte] ?? registro.anosIniciais?.municipal),
    idebAnosFinais: componentes(registro.anosFinais?.[recorte] ?? registro.anosFinais?.municipal),
    fonte: "INEP — divulgação do IDEB e taxas de rendimento por município, 2023",
  };
}
