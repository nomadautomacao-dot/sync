import JSZip from "jszip";
import type { ObraPAC2 } from "@/modules/levantamento-fundeb/types";

const PACTO_RETORNADA_XLSX_URL =
  "https://www.fnde.gov.br/BI_PainelPactoRetormadaObras/DownloadCGU/Dados_pacto_retomada.xlsx";
const INFRAESTRUTURA_PDF_URL = "https://www.gov.br/fnde/pt-br/docs/brasil_por_municipio.pdf";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

interface PactoRetomadaRow {
  id: string;
  anoTermoConvenio: number | null;
  municipio: string;
  uf: string;
  situacaoAtual: string;
  esfera: string;
  classificacao: string;
  tipoObra: string;
  situacaoSolicitacao: string;
  situacaoTermo: string;
  termoGerado: string;
  termoValidado: string;
  execucaoFinanceira: number;
  aprovacaoRepasse: number;
  saldoBancarioAprovacao: number;
  estimativaRepasseFnde: number;
}

interface InfraestruturaRepasseRow {
  uf: string;
  razaoSocial: string;
  valorPago: number;
}

interface ObrasCache<T> {
  loadedAt: number;
  data: T;
}

/**
 * Obra em situação crítica no painel do Pacto de Retomada — paralisada,
 * inacabada ou em retomada. É dinheiro federal já contratado que não virou
 * escola: cada uma é vaga que não abre e fator de jornada que não sobe.
 */
export interface ObraCritica {
  ano: number | null;
  tipo: string;
  classificacao: string;
  situacao: string;
  estimativaRepasse: number;
  execucao: number;
  saldoBancario: number;
}

/**
 * Uma obra do painel, com tudo o que a planilha traz sobre ela — inclusive as
 * concluídas e as canceladas.
 *
 * `obrasCriticas` existe para o Raio-X, que só nomeia o que está parado, e
 * `obrasPAC2` agrega por tipo para o Levantamento. Nenhum dos dois serve ao
 * inventário obra a obra: para saber se uma obra parada tem termo gerado e
 * validado — que é o que diz se a retomada está travada no FNDE ou no
 * município — é preciso a linha inteira.
 */
export interface ObraDetalhada extends ObraCritica {
  id: string;
  /** Situação da solicitação de repactuação: DEFERIDO, DILIGÊNCIA, INDEFERIDO… */
  situacaoSolicitacao: string;
  situacaoTermo: string;
  termoGerado: string;
  termoValidado: string;
  esfera: string;
  /** Valor do FNDE a repassar aprovado no novo pacto. */
  aprovacaoRepasse: number;
}

interface FndeObrasEnrichment {
  obrasPAC2: ObraPAC2[];
  observacoes: string[];
  fontes: string[];
  simECStatusHint: string | null;
  totalObras: number;
  valorEstimadoRepactuacao: number | null;
  valorPagoInfraestrutura: number | null;
  /** Paralisadas, inacabadas e em retomada, com os valores do painel. */
  obrasCriticas: ObraCritica[];
  /** Todas as obras do município no painel, do maior ao menor repasse estimado. */
  obras: ObraDetalhada[];
  paralisadas: number;
  inacabadas: number;
  emRetomada: number;
  /** Estimativa de repasse FNDE somada nas obras críticas. */
  valorParadoEstimado: number;
}

const PACTO_HEADERS = {
  id: "ID",
  anoTermoConvenio: "Ano Termo/Convênio",
  municipio: "Município",
  uf: "UF",
  situacaoAtual: "Situação atual da Obra",
  esfera: "Esfera",
  classificacao: "Classificação",
  tipoObra: "Tipo de Obra",
  situacaoSolicitacao: "Situação da solicitação",
  termoGerado: "Termo Gerado",
  termoValidado: "Termo validado",
  situacaoTermo: "Situação do termo",
  execucaoFinanceira: "Execução financeira (repasse do FNDE executado)",
  aprovacaoRepasse: "Aprovação: Valor do fnde a repassar no novo pacto",
  saldoBancarioAprovacao: "Aprovação: valor de saldo bancário existente na data da aprovação",
  estimativaRepasseFnde: "ESTIMATIVA:  valor final a ser repassado pelo FNDE",
} as const;

let pactoCache: ObrasCache<PactoRetomadaRow[]> | null = null;
let infraestruturaCache: ObrasCache<InfraestruturaRepasseRow[]> | null = null;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function nowWithinCache<T>(cache: ObrasCache<T> | null) {
  return cache && Date.now() - cache.loadedAt < CACHE_TTL_MS;
}

function parseCurrencyLikeNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) {
    return 0;
  }

  const text = String(value).trim();

  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    const direct = Number(text);
    return Number.isFinite(direct) ? direct : 0;
  }

  const normalized = text.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function excelColumnToIndex(column: string) {
  let index = 0;
  for (const char of column) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

function parseSharedStrings(xml: string) {
  const items = Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g));
  return items.map((item) => {
    const texts = Array.from(item[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)).map((match) =>
      decodeXmlEntities(match[1]),
    );
    return texts.join("");
  });
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  const rows = Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g));
  return rows.map((rowMatch) => {
    const row: string[] = [];
    const cells = Array.from(rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g));

    for (const cell of cells) {
      const attrs = cell[1];
      const body = cell[2];
      const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
      if (!ref) {
        continue;
      }

      const index = excelColumnToIndex(ref);
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";

      if (!rawValue) {
        row[index] = "";
        continue;
      }

      if (type === "s") {
        row[index] = sharedStrings[Number(rawValue)] ?? "";
        continue;
      }

      row[index] = decodeXmlEntities(rawValue);
    }

    return row;
  });
}

function mapPactoRow(header: string[], row: string[]): PactoRetomadaRow {
  const get = (key: keyof typeof PACTO_HEADERS) => row[header.indexOf(PACTO_HEADERS[key])] ?? "";

  return {
    id: get("id"),
    anoTermoConvenio: parseCurrencyLikeNumber(get("anoTermoConvenio")) || null,
    municipio: get("municipio"),
    uf: get("uf"),
    situacaoAtual: get("situacaoAtual"),
    esfera: get("esfera"),
    classificacao: get("classificacao"),
    tipoObra: get("tipoObra"),
    situacaoSolicitacao: get("situacaoSolicitacao"),
    situacaoTermo: get("situacaoTermo"),
    termoGerado: get("termoGerado"),
    termoValidado: get("termoValidado"),
    execucaoFinanceira: parseCurrencyLikeNumber(get("execucaoFinanceira")),
    aprovacaoRepasse: parseCurrencyLikeNumber(get("aprovacaoRepasse")),
    saldoBancarioAprovacao: parseCurrencyLikeNumber(get("saldoBancarioAprovacao")),
    estimativaRepasseFnde: parseCurrencyLikeNumber(get("estimativaRepasseFnde")),
  };
}

async function fetchPactoRetomadaRows() {
  if (nowWithinCache(pactoCache) && pactoCache) {
    return pactoCache.data;
  }

  const response = await fetch(PACTO_RETORNADA_XLSX_URL, {
    headers: { "User-Agent": "Sync/1.0" },
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar planilha do Pacto de Retomada: ${response.status}`);
  }

  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const worksheetXml = await zip.file("xl/worksheets/sheet1.xml")?.async("string");

  if (!sharedStringsXml || !worksheetXml) {
    throw new Error("Estrutura inesperada na planilha do Pacto de Retomada.");
  }

  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const rows = parseWorksheetRows(worksheetXml, sharedStrings);
  const [header, ...dataRows] = rows;
  const mapped = dataRows
    .filter((row) => row.some((cell) => cell))
    .map((row) => mapPactoRow(header, row));

  pactoCache = { loadedAt: Date.now(), data: mapped };
  return mapped;
}

async function fetchInfraestruturaRepasseRows() {
  const { PDFParse } = await import("pdf-parse");
  if (nowWithinCache(infraestruturaCache) && infraestruturaCache) {
    return infraestruturaCache.data;
  }

  const response = await fetch(INFRAESTRUTURA_PDF_URL, {
    headers: { "User-Agent": "Sync/1.0" },
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar PDF de repasses de infraestrutura: ${response.status}`);
  }

  const parser = new PDFParse({ data: Buffer.from(await response.arrayBuffer()) });
  const result = await parser.getText();
  await parser.destroy();

  const rows: InfraestruturaRepasseRow[] = [];
  const lines = result.text
    .split(/\r?\n/)
    .map((line) => line.replace(/\t+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const line of lines) {
    if (/^-- \d+ of \d+ --$/i.test(line) || /^UF\s+Raz[aã]o Social\s+Valor Pago$/i.test(line)) {
      continue;
    }

    const match = line.match(/^([A-Z]{2})\s+(.+?)\s+([\d.]+,\d{2})$/);
    if (!match) {
      continue;
    }

    rows.push({
      uf: match[1],
      razaoSocial: match[2].trim(),
      valorPago: parseCurrencyLikeNumber(match[3]),
    });
  }

  infraestruturaCache = { loadedAt: Date.now(), data: rows };
  return rows;
}

function resolveMunicipioRows(rows: PactoRetomadaRow[], municipio: string, uf: string) {
  const target = normalizeText(municipio);
  const ufTarget = uf.trim().toUpperCase();

  return rows.filter((row) => {
    const candidate = normalizeText(row.municipio);
    return row.uf.toUpperCase() === ufTarget && (candidate === target || candidate.includes(target) || target.includes(candidate));
  });
}

function mapTipoObraLabel(tipo: string) {
  const normalized = normalizeText(tipo);

  if (normalized === "EDUCACAO INFANTIL") {
    return "Creches e pre-escolas";
  }

  if (normalized === "QUADRAS E COBERTURA DE QUADRAS") {
    return "Construcao de quadras esportivas";
  }

  if (normalized === "ENSINO FUNDAMENTAL") {
    return "Escolas de ensino fundamental";
  }

  if (normalized === "ENSINO PROFISSIONALIZANTE") {
    return "Ensino profissionalizante";
  }

  if (normalized === "AMPLIACAO") {
    return "Ampliacoes";
  }

  if (normalized === "REFORMA") {
    return "Reformas";
  }

  return tipo || "Outras obras";
}

function isCancelledStatus(row: PactoRetomadaRow) {
  const atual = normalizeText(row.situacaoAtual);
  const solicitacao = normalizeText(row.situacaoSolicitacao);
  return atual === "OBRA CANCELADA" || solicitacao === "INDEFERIDO" || solicitacao === "CANCELADO";
}

function isConcludedStatus(row: PactoRetomadaRow) {
  return normalizeText(row.situacaoAtual) === "CONCLUIDA";
}

function isExecutionStatus(row: PactoRetomadaRow) {
  const atual = normalizeText(row.situacaoAtual);
  return atual === "EM EXECUCAO" || atual === "EM RETOMADA" || atual === "PARALISADA" || atual === "INACABADA";
}

function isApprovedStatus(row: PactoRetomadaRow) {
  const atual = normalizeText(row.situacaoAtual);
  const solicitacao = normalizeText(row.situacaoSolicitacao);
  const termo = normalizeText(row.situacaoTermo);

  if (atual === "EM LICITACAO") {
    return true;
  }

  if (isCancelledStatus(row) || isConcludedStatus(row) || isExecutionStatus(row)) {
    return false;
  }

  return solicitacao === "DEFERIDO" || termo === "TERMO VALIDADO" || termo.startsWith("AGUARDANDO");
}

function buildObrasPac2(rows: PactoRetomadaRow[]): ObraPAC2[] {
  const grouped = new Map<string, ObraPAC2>();

  for (const row of rows) {
    const tipo = mapTipoObraLabel(row.tipoObra);
    const bucket = grouped.get(tipo) ?? {
      tipo,
      aprovadas: 0,
      execucao: 0,
      canceladas: 0,
      concluidas: 0,
      total: 0,
    };

    bucket.total = (bucket.total ?? 0) + 1;

    if (isApprovedStatus(row)) {
      bucket.aprovadas = (bucket.aprovadas ?? 0) + 1;
    }

    if (isExecutionStatus(row)) {
      bucket.execucao = (bucket.execucao ?? 0) + 1;
    }

    if (isCancelledStatus(row)) {
      bucket.canceladas = (bucket.canceladas ?? 0) + 1;
    }

    if (isConcludedStatus(row)) {
      bucket.concluidas = (bucket.concluidas ?? 0) + 1;
    }

    grouped.set(tipo, bucket);
  }

  const preferredOrder = [
    "Creches e pre-escolas",
    "Construcao de quadras esportivas",
    "Escolas de ensino fundamental",
    "Ensino profissionalizante",
    "Ampliacoes",
    "Reformas",
  ];

  return Array.from(grouped.values()).sort((left, right) => {
    const leftIndex = preferredOrder.indexOf(left.tipo);
    const rightIndex = preferredOrder.indexOf(right.tipo);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.tipo.localeCompare(right.tipo, "pt-BR");
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

function sumBy(rows: PactoRetomadaRow[], selector: (row: PactoRetomadaRow) => number) {
  return rows.reduce((total, row) => total + selector(row), 0);
}

function uniqueMunicipios(rows: PactoRetomadaRow[]) {
  const seen = new Set<string>();
  const items: { municipio: string; uf: string; obras: number }[] = [];

  for (const row of rows) {
    const key = `${row.uf}:${normalizeText(row.municipio)}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    const obras = rows.filter(
      (candidate) =>
        candidate.uf === row.uf && normalizeText(candidate.municipio) === normalizeText(row.municipio),
    ).length;
    items.push({ municipio: row.municipio, uf: row.uf, obras });
  }

  return items.sort((left, right) => left.municipio.localeCompare(right.municipio, "pt-BR"));
}

export async function getFndeObrasEnrichment(params: { municipio: string; uf: string }): Promise<FndeObrasEnrichment> {
  const [pactoRows, infraestruturaRows] = await Promise.all([
    fetchPactoRetomadaRows(),
    fetchInfraestruturaRepasseRows(),
  ]);

  const municipioRows = resolveMunicipioRows(pactoRows, params.municipio, params.uf);
  const obrasPAC2 = buildObrasPac2(municipioRows);
  const estimativaRepactuacao = sumBy(municipioRows, (row) => row.estimativaRepasseFnde);
  const execucaoFinanceira = sumBy(municipioRows, (row) => row.execucaoFinanceira);
  const deferidas = municipioRows.filter((row) => normalizeText(row.situacaoSolicitacao) === "DEFERIDO").length;
  const diligencias = municipioRows.filter((row) => normalizeText(row.situacaoSolicitacao) === "DILIGENCIA").length;
  const paralisadas = municipioRows.filter((row) => normalizeText(row.situacaoAtual) === "PARALISADA").length;
  const inacabadas = municipioRows.filter((row) => normalizeText(row.situacaoAtual) === "INACABADA").length;

  const infraestruturaRepasse = infraestruturaRows.find((row) => {
    const razao = normalizeText(row.razaoSocial);
    const municipio = normalizeText(params.municipio);
    return row.uf === params.uf.toUpperCase() && razao.includes(municipio);
  });

  const observacoes: string[] = [];

  if (municipioRows.length > 0) {
    observacoes.push(
      `Painel público do Pacto de Retomada localizou ${municipioRows.length} obra(s) para ${params.municipio}/${params.uf.toUpperCase()}.`,
    );

    if (deferidas > 0) {
      observacoes.push(`${deferidas} obra(s) aparecem como deferidas no processo de pactuação/retomada.`);
    }

    if (estimativaRepactuacao > 0) {
      observacoes.push(
        `Estimativa agregada de repasse do FNDE no novo pacto: ${estimativaRepactuacao.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}.`,
      );
    }

    if (execucaoFinanceira > 0) {
      observacoes.push(
        `Execução financeira já registrada no painel: ${execucaoFinanceira.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}.`,
      );
    }

    if (paralisadas > 0 || inacabadas > 0) {
      observacoes.push(
        `O painel aponta ${paralisadas} obra(s) paralisada(s) e ${inacabadas} inacabada(s), indicando frente potencial de regularização e retomada.`,
      );
    }

    if (diligencias > 0) {
      observacoes.push(`${diligencias} obra(s) ainda constam em diligência na base pública do pacto.`);
    }
  }

  if (infraestruturaRepasse && infraestruturaRepasse.valorPago > 0) {
    observacoes.push(
      `O FNDE publicou repasse público de infraestrutura escolar para o município no valor de ${infraestruturaRepasse.valorPago.toLocaleString(
        "pt-BR",
        {
          style: "currency",
          currency: "BRL",
        },
      )}.`,
    );
  }

  const simECStatusHint =
    municipioRows.length > 0
      ? `Painel público do Pacto/FNDE localizou ${municipioRows.length} obra(s) vinculada(s) ao município. O acompanhamento operacional detalhado no Simec segue dependente de credencial do ente.`
      : infraestruturaRepasse
      ? "Painel público do FNDE identificou repasse de infraestrutura escolar para o município. O detalhamento operacional no Simec segue dependente de credencial do ente."
      : null;

  const obras: ObraDetalhada[] = municipioRows
    .map((row) => ({
      id: row.id,
      ano: row.anoTermoConvenio,
      tipo: row.tipoObra,
      classificacao: row.classificacao,
      situacao: normalizeText(row.situacaoAtual),
      estimativaRepasse: row.estimativaRepasseFnde,
      execucao: row.execucaoFinanceira,
      saldoBancario: row.saldoBancarioAprovacao,
      situacaoSolicitacao: row.situacaoSolicitacao,
      situacaoTermo: row.situacaoTermo,
      termoGerado: row.termoGerado,
      termoValidado: row.termoValidado,
      esfera: row.esfera,
      aprovacaoRepasse: row.aprovacaoRepasse,
    }))
    .sort((a, b) => b.estimativaRepasse - a.estimativaRepasse);

  const CRITICAS = new Set(["PARALISADA", "INACABADA", "EM RETOMADA"]);
  const obrasCriticas: ObraCritica[] = obras.filter((obra) => CRITICAS.has(obra.situacao));

  return {
    obrasPAC2,
    observacoes,
    fontes: [
      "FNDE / Painel Pacto de Retomada de Obras (dados abertos)",
      "FNDE / Repasses de infraestrutura escolar por município",
    ],
    simECStatusHint,
    totalObras: municipioRows.length,
    valorEstimadoRepactuacao: estimativaRepactuacao > 0 ? estimativaRepactuacao : null,
    valorPagoInfraestrutura: infraestruturaRepasse?.valorPago ?? null,
    obrasCriticas,
    obras,
    paralisadas,
    inacabadas,
    emRetomada: municipioRows.filter((row) => normalizeText(row.situacaoAtual) === "EM RETOMADA").length,
    valorParadoEstimado: obrasCriticas.reduce((total, obra) => total + obra.estimativaRepasse, 0),
  };
}

