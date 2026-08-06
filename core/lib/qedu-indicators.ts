import { lerJsonDeDados } from "@/core/lib/dados-arquivo";

/**
 * Indicadores de aprendizagem, rendimento e fluxo escolar por município.
 *
 * A versão anterior lia as planilhas XLSX do INEP direto de `data/`, mas
 * `.gitignore` bloqueia `*.xlsx`: os arquivos nunca existiam e o coletor
 * devolvia `null` para os 5.570 municípios. Agora o recorte municipal das
 * quatro planilhas oficiais vive versionado em
 * `data/inep-rendimento-municipal-2023.json` (ver `meta.fontes` lá dentro,
 * com URL e MD5 de cada origem).
 *
 * O import é estático de propósito: o Dockerfile só copia `data/fnde` para a
 * imagem final, então qualquer leitura via `fs` em `process.cwd()/data`
 * quebraria em produção. Estático, o webpack embute o JSON no bundle
 * standalone — é o padrão que `ideb-municipal.ts` já usa.
 */

const ANO_REFERENCIA = 2023;

/** Ordem de preferência de rede: um diagnóstico municipal fala da rede do prefeito. */
const PRECEDENCIA_REDE = ["municipal", "publica", "total"] as const;

type RecorteRede = (typeof PRECEDENCIA_REDE)[number];

const ROTULO_REDE: Record<RecorteRede, string> = {
  municipal: "Municipal",
  publica: "Pública",
  total: "Total",
};

/** Campos são opcionais porque o gerador poda chaves nulas — ausência não ocupa byte. */
interface AprendizagemRaw {
  taxaAprovacao?: number;
  indicadorRendimento?: number;
  notaMatematica?: number;
  notaPortugues?: number;
  notaMedia?: number;
  idebObservado?: number;
}

interface DistorcaoRaw {
  fundamentalTotal?: number;
  anosIniciais?: number;
  anosFinais?: number;
}

interface TaxaEtapaRaw {
  total?: number;
  anosIniciais?: number;
  anosFinais?: number;
}

interface RendimentoRaw {
  aprovacao?: TaxaEtapaRaw;
  reprovacao?: TaxaEtapaRaw;
  abandono?: TaxaEtapaRaw;
}

type PorRede<T> = Partial<Record<RecorteRede, T>>;

interface MunicipioRaw {
  municipio?: string;
  uf?: string;
  anosIniciais?: PorRede<AprendizagemRaw>;
  anosFinais?: PorRede<AprendizagemRaw>;
  distorcao?: PorRede<DistorcaoRaw>;
  rendimento?: PorRede<RendimentoRaw>;
}

interface DatasetRaw {
  meta?: { anoReferencia?: number };
  municipios?: Record<string, MunicipioRaw>;
}

interface EtapaIndicators {
  taxaAprovacao: number | null;
  indicadorRendimento: number | null;
  notaMatematica: number | null;
  notaPortugues: number | null;
  notaMedia: number | null;
  idebObservado: number | null;
}

interface TaxaEtapa {
  total: number | null;
  anosIniciais: number | null;
  anosFinais: number | null;
}

interface QeduMunicipalIndicators {
  codigoIBGE: string;
  municipio: string;
  uf: string;
  anoReferencia: number;
  recorteRede: string;
  fonte: string;
  fonteDistorcao: string;
  fonteRendimento: string;
  anosIniciais: EtapaIndicators | null;
  anosFinais: EtapaIndicators | null;
  distorcaoIdadeSerie: {
    fundamentalTotal: number | null;
    anosIniciais: number | null;
    anosFinais: number | null;
  } | null;
  taxasRendimento: {
    aprovacao: TaxaEtapa;
    reprovacao: TaxaEtapa;
    abandono: TaxaEtapa;
  } | null;
}

// Cast nomeado: o JSON é artefato versionado do próprio repo, gerado a partir das
// planilhas do INEP, então a forma é conhecida em tempo de build — não é entrada externa.
const dataset = lerJsonDeDados<DatasetRaw>("data/inep-rendimento-municipal-2023.json");

// Fallback para `{}` em vez de estourar: dataset corrompido vira ausência de dado,
// nunca uma exceção que derruba a geração do PDF.
const municipios: Record<string, MunicipioRaw> = dataset.municipios ?? {};

/** Ausência no INEP ("-", "--", célula vazia) foi podada do JSON: vira null, jamais 0. */
function numero(valor: number | undefined): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function escolherRecorte<T>(porRede: PorRede<T> | undefined) {
  if (!porRede) {
    return null;
  }

  for (const recorte of PRECEDENCIA_REDE) {
    const dados = porRede[recorte];
    if (dados) {
      return { recorte, dados };
    }
  }

  return null;
}

function mapearEtapa(raw: AprendizagemRaw): EtapaIndicators {
  return {
    taxaAprovacao: numero(raw.taxaAprovacao),
    indicadorRendimento: numero(raw.indicadorRendimento),
    notaMatematica: numero(raw.notaMatematica),
    notaPortugues: numero(raw.notaPortugues),
    notaMedia: numero(raw.notaMedia),
    idebObservado: numero(raw.idebObservado),
  };
}

function mapearTaxaEtapa(raw: TaxaEtapaRaw | undefined): TaxaEtapa {
  return {
    total: numero(raw?.total),
    anosIniciais: numero(raw?.anosIniciais),
    anosFinais: numero(raw?.anosFinais),
  };
}

export async function getQeduMunicipalIndicators(codigoIBGE: string): Promise<QeduMunicipalIndicators | null> {
  const digits = codigoIBGE.replace(/\D/g, "");
  if (digits.length !== 7) {
    return null;
  }

  const registro = municipios[digits];
  if (!registro) {
    return null;
  }

  const anosIniciais = escolherRecorte(registro.anosIniciais);
  const anosFinais = escolherRecorte(registro.anosFinais);
  const distorcao = escolherRecorte(registro.distorcao);
  const rendimento = escolherRecorte(registro.rendimento);

  if (!anosIniciais && !anosFinais && !distorcao && !rendimento) {
    return null;
  }

  const recorte =
    anosIniciais?.recorte ?? anosFinais?.recorte ?? distorcao?.recorte ?? rendimento?.recorte ?? "total";

  return {
    codigoIBGE: digits,
    municipio: registro.municipio ?? "",
    uf: registro.uf ?? "",
    anoReferencia: ANO_REFERENCIA,
    recorteRede: ROTULO_REDE[recorte],
    fonte: "INEP divulgação municipal 2023 (aprendizagem, aprovação e IDEB)",
    fonteDistorcao: "INEP taxa de distorção idade-série 2023",
    fonteRendimento: "INEP taxas de rendimento escolar 2023",
    anosIniciais: anosIniciais ? mapearEtapa(anosIniciais.dados) : null,
    anosFinais: anosFinais ? mapearEtapa(anosFinais.dados) : null,
    distorcaoIdadeSerie: distorcao
      ? {
          fundamentalTotal: numero(distorcao.dados.fundamentalTotal),
          anosIniciais: numero(distorcao.dados.anosIniciais),
          anosFinais: numero(distorcao.dados.anosFinais),
        }
      : null,
    taxasRendimento: rendimento
      ? {
          aprovacao: mapearTaxaEtapa(rendimento.dados.aprovacao),
          reprovacao: mapearTaxaEtapa(rendimento.dados.reprovacao),
          abandono: mapearTaxaEtapa(rendimento.dados.abandono),
        }
      : null,
  };
}
