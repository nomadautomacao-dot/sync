import type {
  ObraPAC2,
  RepassePDDE,
  SistemaHabilitacao,
  VeiculoCaminhoEscola,
} from "@/modules/levantamento-fundeb/types";
import { getFndeObrasEnrichment } from "@/core/lib/fnde-obras";

interface PddeMunicipioItem {
  CO_MUNICIPIO_FNDE: string;
  NO_MUNICIPIO: string;
}

interface PddeMunicipioResumo {
  ano: number;
  codigoMunicipioFnde: string;
  totalEscolas: number | null;
  totalPago: number | null;
  adesaoEntidade: string | null;
  prestacaoEntidade: string | null;
  consultaParcial: boolean;
}

interface FndePublicEnrichment {
  sistemas: SistemaHabilitacao[];
  obrasPAC2: ObraPAC2[];
  situacaoPAR: string;
  caminhoEscola: VeiculoCaminhoEscola[];
  pdde: RepassePDDE[];
  fontes: string[];
  observacoes: string[];
}

interface SigarpEntityItem {
  NU_SEQ_ENTIDADE?: string;
  NO_RAZAO_SOCIAL?: string;
  NU_CGC_ENTIDADE?: string;
  SG_UF?: string;
}

const PDDE_MUNICIPIOS_ENDPOINT = "https://www.fnde.gov.br/pddeinfo/pddeinfo/corp/get-municipio/sg_uf";
const PDDE_ESCOLA_ENDPOINT = "https://www.fnde.gov.br/pddeinfo/pddeinfo/escola/consultar";
const SIGARP_PUBLIC_URL = "https://www.fnde.gov.br/sigarpweb/index/consultapublica";
const SIGARP_SEARCH_URL = "https://www.fnde.gov.br/sigarpweb/index.php/consultas/solicitacao-cgcom2/list";
const SIGARP_FIND_ENTIDADES_URL =
  "https://www.fnde.gov.br/sigarpweb/index.php/consultas/solicitacao-cgcom2/find-entidades";
const SIGPC_PUBLIC_URL = "https://www.fnde.gov.br/sigpcadm/sistema.pu?operation=localizar";
const PAR_PUBLIC_URL = "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/programas/par";
const SIGARP_CAMINHO_ESCOLA_PREGOES = [
  { tipoPregao: "1", pregao: "1981", descricao: "02/2022 - Onibus Rural Escolar" },
  { tipoPregao: "1", pregao: "1961", descricao: "06/2021 - Onibus Escolar" },
  { tipoPregao: "1", pregao: "2001", descricao: "06/2023 - Onibus Escolar" },
  { tipoPregao: "1", pregao: "581", descricao: "10/2012 - Onibus Urbano Escolar Acessivel" },
] as const;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&Ccedil;/gi, "Ç")
    .replace(/&atilde;/gi, "ã")
    .replace(/&Atilde;/gi, "Ã")
    .replace(/&otilde;/gi, "õ")
    .replace(/&Otilde;/gi, "Õ")
    .replace(/&aacute;/gi, "á")
    .replace(/&Aacute;/gi, "Á")
    .replace(/&eacute;/gi, "é")
    .replace(/&Eacute;/gi, "É")
    .replace(/&iacute;/gi, "í")
    .replace(/&Iacute;/gi, "Í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&Oacute;/gi, "Ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&Uacute;/gi, "Ú")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&Ecirc;/gi, "Ê")
    .replace(/&ordm;/gi, "º")
    .replace(/&raquo;/gi, "»")
    .replace(/&laquo;/gi, "«")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function parsePtBrNumber(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchText(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": "Sync/1.0",
      ...(init?.headers ?? {}),
    },
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${url}: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const useLatin1 = contentType.includes("iso-8859-1") || url.includes("fnde.gov.br");
  const decoder = new TextDecoder(useLatin1 ? "latin1" : "utf-8");
  return decoder.decode(buffer);
}

async function fetchPddeMunicipios(uf: string) {
  const response = await fetch(`${PDDE_MUNICIPIOS_ENDPOINT}/${encodeURIComponent(uf.toUpperCase())}`, {
    headers: { "User-Agent": "Sync/1.0" },
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    return [] as PddeMunicipioItem[];
  }

  return (await response.json()) as PddeMunicipioItem[];
}

async function resolvePddeMunicipioCode(uf: string, municipio: string) {
  const municipios = await fetchPddeMunicipios(uf);
  const target = normalizeText(municipio);
  const found =
    municipios.find((item) => normalizeText(item.NO_MUNICIPIO) === target) ??
    municipios.find((item) => normalizeText(item.NO_MUNICIPIO).includes(target));

  return found?.CO_MUNICIPIO_FNDE ?? null;
}

function buildPddeConsultaUrl(ano: number, uf: string, codigoMunicipioFnde: string, page = 1) {
  return `${PDDE_ESCOLA_ENDPOINT}/ano/${ano}/co_escola//cnpj//co_esfera_adm/2/sg_uf/${encodeURIComponent(
    uf.toUpperCase(),
  )}/co_municipio_fnde/${encodeURIComponent(codigoMunicipioFnde)}/consultar/Consultar/page/${page}`;
}

function extractPddeTotalRegistros(html: string) {
  const match = html.match(/Exibindo\s+\d+\s*-\s*\d+\s+de\s+(\d+)\s+Registro\(s\)/i);
  return match ? Number(match[1]) : null;
}

function extractPddeEntityField(html: string, type: "adesao" | "prestacao") {
  const sectionMatch = html.match(
    /<caption>[\s\S]*?Entidade Executora - EEx[\s\S]*?<\/table>/i,
  );

  if (!sectionMatch) {
    return null;
  }

  const labelPattern = type === "adesao" ? /<th>[\s\S]*?PDDE<\/th>\s*<td>([\s\S]*?)<\/td>/i : /<th>[\s\S]*?Prest[\s\S]*?<\/th>\s*<td>([\s\S]*?)<\/td>/i;
  const fieldMatch = sectionMatch[0].match(labelPattern);
  return fieldMatch ? stripHtml(fieldMatch[1]) : null;
}

function extractPddeTotalPagoPage(html: string) {
  let total = 0;
  const rowPattern = /<tr>\s*<th[^>]*>Total Geral<\/th>([\s\S]*?)<\/tr>/gi;

  for (const match of html.matchAll(rowPattern)) {
    const numbers = Array.from(match[1].matchAll(/<th[^>]*align="right"[^>]*>([\d.,-]+)<\/th>/gi)).map((item) =>
      parsePtBrNumber(item[1]),
    );

    if (numbers.length >= 10) {
      total += numbers[9];
      continue;
    }

    if (numbers.length > 0) {
      total += numbers[numbers.length - 1];
    }
  }

  return total;
}

async function fetchPddeMunicipioResumo(params: { municipio: string; uf: string; ano: number }) {
  const codigoMunicipioFnde = await resolvePddeMunicipioCode(params.uf, params.municipio);

  if (!codigoMunicipioFnde) {
    return null;
  }

  const firstPageHtml = await fetchText(buildPddeConsultaUrl(params.ano, params.uf, codigoMunicipioFnde, 1));
  const totalRegistros = extractPddeTotalRegistros(firstPageHtml);
  const totalPages = totalRegistros ? Math.ceil(totalRegistros / 10) : 1;
  const adesaoEntidade = extractPddeEntityField(firstPageHtml, "adesao");
  const prestacaoEntidade = extractPddeEntityField(firstPageHtml, "prestacao");

  let totalPago = extractPddeTotalPagoPage(firstPageHtml);
  let consultaParcial = false;

  if (totalPages > 1) {
    if (totalPages <= 12) {
      const pages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
      const htmlPages = await Promise.all(
        pages.map((page) => fetchText(buildPddeConsultaUrl(params.ano, params.uf, codigoMunicipioFnde, page))),
      );

      for (const html of htmlPages) {
        totalPago += extractPddeTotalPagoPage(html);
      }
    } else {
      consultaParcial = true;
      totalPago = 0;
    }
  }

  return {
    ano: params.ano,
    codigoMunicipioFnde,
    totalEscolas: totalRegistros,
    totalPago: totalPages <= 12 ? totalPago : null,
    adesaoEntidade,
    prestacaoEntidade,
    consultaParcial,
  } satisfies PddeMunicipioResumo;
}

async function isPublicPageAvailable(url: string) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Sync/1.0" },
      next: { revalidate: 60 * 60 * 12 },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchSigarpEntities(uf: string, codigoMunicipioFnde: string, query: string) {
  const response = await fetch(SIGARP_FIND_ENTIDADES_URL, {
    method: "POST",
    headers: {
      "User-Agent": "Sync/1.0",
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, text/javascript, */*; q=0.01",
      Referer: SIGARP_SEARCH_URL,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: new URLSearchParams({
      q: query,
      uf: uf.toUpperCase(),
      municipio: codigoMunicipioFnde,
    }),
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    return [] as SigarpEntityItem[];
  }

  const items = (await response.json()) as SigarpEntityItem[];
  return items.filter(
    (item) =>
      item.NO_RAZAO_SOCIAL && !normalizeText(item.NO_RAZAO_SOCIAL).includes("NAO EXISTEM ENTIDADES"),
  );
}

async function fetchSigarpMunicipioResumo(uf: string, municipio: string) {
  const codigoMunicipioFnde = await resolvePddeMunicipioCode(uf, municipio);

  if (!codigoMunicipioFnde) {
    return null;
  }

  const [prefeituras, fundos] = await Promise.all([
    fetchSigarpEntities(uf, codigoMunicipioFnde, "PREF").catch(() => []),
    fetchSigarpEntities(uf, codigoMunicipioFnde, "FUNDO").catch(() => []),
  ]);

  const prefeitura =
    prefeituras.find((item) => /pref/i.test(item.NO_RAZAO_SOCIAL ?? "")) ??
    prefeituras.find((item) => /mun/i.test(item.NO_RAZAO_SOCIAL ?? "")) ??
    prefeituras[0] ??
    null;
  const fundoEducacao =
    fundos.find((item) => /educ/i.test(item.NO_RAZAO_SOCIAL ?? "")) ?? fundos[0] ?? null;

  return {
    codigoMunicipioFnde,
    prefeitura,
    fundoEducacao,
  };
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function parseSigarpNumber(value: string) {
  return parsePtBrNumber(stripHtml(value));
}

function parseSigarpSolicitationLinks(html: string) {
  const matches = Array.from(
    html.matchAll(/href="(\/sigarpweb\/index\.php\/consultas\/solicitacao-cgcom2\/view\/cnpj\/[^"]+)"/gi),
  ).map((match) => `https://www.fnde.gov.br${match[1]}`);

  return unique(matches);
}

async function searchSigarpSolicitationLinks(params: {
  uf: string;
  codigoMunicipioFnde: string;
  entidadeNome: string;
  cnpj: string;
  tipoPregao: string;
  pregao: string;
}) {
  const response = await fetch(SIGARP_SEARCH_URL, {
    method: "POST",
    headers: {
      "User-Agent": "Sync/1.0",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: SIGARP_SEARCH_URL,
    },
    body: new URLSearchParams({
      tp_uf_orgao: params.uf.toUpperCase(),
      tp_municipio: params.codigoMunicipioFnde,
      tp_entidade: params.entidadeNome,
      tp_cnpj: params.cnpj,
      tp_pregao: params.pregao,
      nu_seq_tipo_pregao: params.tipoPregao,
      tx_solicitacao: "",
      confirmar: "Pesquisar",
    }),
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    return [] as string[];
  }

  const buffer = await response.arrayBuffer();
  const html = new TextDecoder("latin1").decode(buffer);
  return parseSigarpSolicitationLinks(html);
}

function parseSigarpVehicleRows(html: string) {
  const rows = Array.from(
    html.matchAll(
      /<tr[^>]*>\s*<td>\s*\d+\s*<\/td>\s*<td[^>]*colspan="2"[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*align="center"[^>]*>\s*([\d.,]+)\s*<\/td>\s*<td[^>]*align="right"[^>]*>\s*([\d.,]+)\s*<\/td>\s*<\/tr>/gi,
    ),
  ).map((match) => ({
    item: stripHtml(match[1]),
    quantidade: parseSigarpNumber(match[2]),
    valorTotal: parseSigarpNumber(match[3]),
  }));

  return rows.filter((row) => /onibus|ore|embarca/i.test(normalizeText(row.item)));
}

async function fetchSigarpCaminhoEscola(params: {
  uf: string;
  codigoMunicipioFnde: string;
  prefeitura: SigarpEntityItem | null;
  fundoEducacao: SigarpEntityItem | null;
}) {
  const entities = [params.prefeitura, params.fundoEducacao].filter(
    (item): item is SigarpEntityItem => Boolean(item?.NO_RAZAO_SOCIAL && item?.NU_CGC_ENTIDADE),
  );

  const links = new Set<string>();
  const searchJobs: Promise<string[]>[] = [];

  for (const entity of entities) {
    const cnpj = entity.NU_CGC_ENTIDADE ?? "";
    const cnpjMask = `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`;

    for (const pregao of SIGARP_CAMINHO_ESCOLA_PREGOES) {
      searchJobs.push(
        searchSigarpSolicitationLinks({
          uf: params.uf,
          codigoMunicipioFnde: params.codigoMunicipioFnde,
          entidadeNome: entity.NO_RAZAO_SOCIAL ?? "",
          cnpj: cnpjMask,
          tipoPregao: pregao.tipoPregao,
          pregao: pregao.pregao,
        }).catch(() => []),
      );
    }
  }

  for (const result of await Promise.all(searchJobs)) {
    for (const link of result) {
      links.add(link);
    }
  }

  if (links.size === 0) {
    return {
      caminhoEscola: [] as VeiculoCaminhoEscola[],
      observacoes: [
        "SIGARPWEB nao retornou solicitacoes publicas de Caminho da Escola nos pregoes de onibus pesquisados nesta rodada.",
      ] as string[],
    };
  }

  let onibusQuantidade = 0;
  let onibusValor = 0;
  let embarcacaoQuantidade = 0;
  let embarcacaoValor = 0;

  const detailPages = Array.from(links).slice(0, 12);
  const htmlPages = await Promise.all(detailPages.map((link) => fetchText(link).catch(() => "")));

  for (const html of htmlPages) {
    for (const row of parseSigarpVehicleRows(html)) {
      if (/embarca/i.test(normalizeText(row.item))) {
        embarcacaoQuantidade += row.quantidade;
        embarcacaoValor += row.valorTotal;
      } else {
        onibusQuantidade += row.quantidade;
        onibusValor += row.valorTotal;
      }
    }
  }

  const caminhoEscola: VeiculoCaminhoEscola[] = [
    {
      tipo: "Onibus escolar",
      quantidade: onibusQuantidade > 0 ? onibusQuantidade : null,
      valor: onibusValor > 0 ? onibusValor : null,
    },
    {
      tipo: "Embarcacao escolar",
      quantidade: embarcacaoQuantidade > 0 ? embarcacaoQuantidade : null,
      valor: embarcacaoValor > 0 ? embarcacaoValor : null,
    },
  ];

  const observacoes = [
    `SIGARPWEB localizou ${links.size} solicitacao(oes) publica(s) relacionada(s) ao Caminho da Escola para o municipio.`,
  ];

  return { caminhoEscola, observacoes };
}

export async function getFndePublicEnrichment(params: {
  municipio: string;
  uf: string;
  exercicio: number;
}) {
  const pddeAno = Math.max(2023, params.exercicio - 1);

  const [pddeResumo, sigarpDisponivel, sigpcDisponivel, parDisponivel, sigarpResumo, obrasPublicas] = await Promise.all([
    fetchPddeMunicipioResumo({ municipio: params.municipio, uf: params.uf, ano: pddeAno }).catch(() => null),
    isPublicPageAvailable(SIGARP_PUBLIC_URL),
    isPublicPageAvailable(SIGPC_PUBLIC_URL),
    isPublicPageAvailable(PAR_PUBLIC_URL),
    fetchSigarpMunicipioResumo(params.uf, params.municipio).catch(() => null),
    getFndeObrasEnrichment({ municipio: params.municipio, uf: params.uf }).catch(() => ({
      obrasPAC2: [] as ObraPAC2[],
      observacoes: [] as string[],
      fontes: [] as string[],
      simECStatusHint: null,
      totalObras: 0,
      valorEstimadoRepactuacao: null,
      valorPagoInfraestrutura: null,
    })),
  ]);

  const pdde: RepassePDDE[] =
    pddeResumo && pddeResumo.totalPago !== null && pddeResumo.totalPago > 0
      ? [{ ano: pddeResumo.ano, valor: pddeResumo.totalPago }]
      : [];
  const sigarpCaminhoEscola = sigarpResumo
    ? await fetchSigarpCaminhoEscola({
        uf: params.uf,
        codigoMunicipioFnde: sigarpResumo.codigoMunicipioFnde,
        prefeitura: sigarpResumo.prefeitura,
        fundoEducacao: sigarpResumo.fundoEducacao,
      }).catch(() => ({ caminhoEscola: [], observacoes: [] }))
    : { caminhoEscola: [], observacoes: [] };

  const pddeContextoEscolas = pddeResumo?.totalEscolas
    ? `Consulta pública localizou ${pddeResumo.totalEscolas} escola(s) neste município.`
    : "";
  const pddeStatus =
    pddeResumo?.adesaoEntidade ??
    (pddeResumo ? "Consulta pública do PDDE Info localizada para o município." : "Consulta pública disponível.");
  const pddePrestacao =
    pddeResumo?.prestacaoEntidade ?? "Prestação de contas exige diligência complementar quando necessário.";
  const sigarpEntityDescription = sigarpResumo?.prefeitura?.NO_RAZAO_SOCIAL
    ? `Entidade localizada: ${sigarpResumo.prefeitura.NO_RAZAO_SOCIAL}.`
    : sigarpResumo?.fundoEducacao?.NO_RAZAO_SOCIAL
    ? `Fundo/entidade de educação localizado: ${sigarpResumo.fundoEducacao.NO_RAZAO_SOCIAL}.`
    : "";
  const sigarpStatus = sigarpDisponivel
    ? `Consulta pública disponível no FNDE. ${sigarpEntityDescription}`.trim()
    : "Consulta pública não respondeu nesta tentativa.";
  const sigpcStatus = sigpcDisponivel
    ? "Consulta pública de prestação de contas disponível no FNDE."
    : "Consulta pública não respondeu nesta tentativa.";

  const sistemas: SistemaHabilitacao[] = [
    {
      instituicao: "MEC",
      sistema: "SIMEC",
      situacao: obrasPublicas.simECStatusHint ?? "Requer credencial do ente para status operacional detalhado.",
    },
    {
      instituicao: "FNDE",
      sistema: "Habilita",
      situacao: "Requer credencial do ente para acompanhamento operacional.",
    },
    {
      instituicao: "FNDE",
      sistema: "SIGARPWEB",
      situacao: sigarpStatus,
    },
    {
      instituicao: "FNDE",
      sistema: "SIGPC",
      situacao: sigpcStatus,
    },
    {
      instituicao: "FNDE",
      sistema: "PDDE Info",
      situacao: `${pddeContextoEscolas} ${pddeStatus} ${pddePrestacao}`.trim(),
    },
  ];

  const observacoes: string[] = [];

  if (pddeResumo?.totalEscolas) {
    observacoes.push(`PDDE Info localizou ${pddeResumo.totalEscolas} escola(s) na rede publica do municipio para ${pddeResumo.ano}.`);
  }

  if (pddeResumo?.consultaParcial) {
    observacoes.push(
      `O municipio possui ${pddeResumo.totalEscolas ?? "muitas"} escolas no PDDE Info; o valor monetario nao foi consolidado automaticamente nesta rodada por limite de paginacao.`,
    );
  }

  if (pdde.length > 0) {
    observacoes.push(`PDDE ${pdde[0].ano}: valor pago total consolidado automaticamente a partir da consulta publica do FNDE.`);
  }
  if (sigarpResumo?.prefeitura?.NO_RAZAO_SOCIAL) {
    observacoes.push(`SIGARPWEB identificou a entidade interessada ${sigarpResumo.prefeitura.NO_RAZAO_SOCIAL} na consulta publica do municipio.`);
  }
  if (
    sigarpResumo?.fundoEducacao?.NO_RAZAO_SOCIAL &&
    normalizeText(sigarpResumo.fundoEducacao.NO_RAZAO_SOCIAL) !==
      normalizeText(sigarpResumo?.prefeitura?.NO_RAZAO_SOCIAL ?? "")
  ) {
    observacoes.push(`SIGARPWEB localizou tambem ${sigarpResumo.fundoEducacao.NO_RAZAO_SOCIAL} como entidade vinculada ao municipio.`);
  }
  observacoes.push(...obrasPublicas.observacoes);
  observacoes.push(...sigarpCaminhoEscola.observacoes);

  const situacaoPAR = parDisponivel
    ? "Portal institucional do PAR localizado no FNDE. Status operacional detalhado do ente depende de credencial e validação documental."
    : "Pagina publica institucional do PAR nao respondeu nesta tentativa; status detalhado segue dependente de credencial.";

  const fontes = [
    "FNDE / PDDE Info",
    "FNDE / SIGARPWEB Consulta Pública",
    "FNDE / SIGPC Consulta Pública",
    "FNDE / PAR institucional",
    ...obrasPublicas.fontes,
  ];

  return {
    sistemas,
    obrasPAC2: obrasPublicas.obrasPAC2,
    situacaoPAR,
    caminhoEscola: sigarpCaminhoEscola.caminhoEscola,
    pdde,
    fontes,
    observacoes,
  } satisfies FndePublicEnrichment;
}
