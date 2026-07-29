/**
 * Cliente da API do Portal da Transparência (CGU) — convênios por município
 * (roadmap #29) e sanções CEIS/CNEP (roadmap #31).
 *
 * A API exige chave gratuita (`PORTAL_TRANSPARENCIA_TOKEN`, header
 * `chave-api-dados`). Sem a chave, tudo devolve `null` graciosamente e o
 * relatório imprime a ausência — nunca inventa.
 *
 * Limitações honestas, para não prometer o que a fonte não dá:
 * - `/convenios` filtra por código IBGE do **convenente**; o recorte
 *   municipal vem do filtro `tipoConvenente=Administração Pública Municipal`.
 * - CEIS/CNEP não têm filtro territorial: o que dá para responder ao vivo é
 *   (a) o próprio ente está sancionado? e (b) a prefeitura aplica e registra
 *   sanções contra fornecedores? A lista completa de fornecedores da
 *   educação sancionados exigiria o rol de contratados do ente, que não é
 *   público nesta API.
 */

const BASE = "https://api.portaldatransparencia.gov.br/api-de-dados";
/** 15 itens/página é fixo na API. 25 páginas cobrem a maior carteira
 *  municipal observada (Manaus ~350 convênios municipais). */
const MAX_PAGINAS_CONVENIOS = 25;
const MAX_PAGINAS_SANCOES = 5;

function token(): string | null {
  const value = process.env.PORTAL_TRANSPARENCIA_TOKEN?.trim();
  return value ? value : null;
}

async function fetchPagina(caminho: string, chave: string): Promise<unknown[]> {
  const resposta = await fetch(`${BASE}/${caminho}`, {
    headers: { "chave-api-dados": chave, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resposta.ok) {
    throw new Error(`Portal da Transparência: HTTP ${resposta.status} em ${caminho}`);
  }
  const corpo = (await resposta.json()) as unknown;
  return Array.isArray(corpo) ? corpo : [];
}

async function fetchTodas(
  montarCaminho: (pagina: number) => string,
  chave: string,
  maxPaginas: number,
): Promise<{ registros: unknown[]; truncado: boolean }> {
  const registros: unknown[] = [];
  for (let pagina = 1; pagina <= maxPaginas; pagina += 1) {
    const lote = await fetchPagina(montarCaminho(pagina), chave);
    registros.push(...lote);
    if (lote.length < 15) return { registros, truncado: false };
  }
  return { registros, truncado: true };
}

// ---------------------------------------------------------------------------
// Convênios (Transferegov via Portal da Transparência)
// ---------------------------------------------------------------------------

export interface ConvenioResumo {
  objeto: string;
  orgao: string;
  situacao: string;
  fimVigencia: string | null;
  valor: number;
  valorLiberado: number;
  educacao: boolean;
}

export interface ConveniosMunicipio {
  total: number;
  truncado: boolean;
  vigentes: number;
  valorVigentes: number;
  liberadoVigentes: number;
  educacaoVigentes: number;
  valorEducacaoVigentes: number;
  topVigentes: ConvenioResumo[];
  semLiberacao: number;
}

type JsonRecord = Record<string, unknown>;

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function numero(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

function mapearConvenio(bruto: unknown): ConvenioResumo {
  const r = bruto as JsonRecord;
  const dim = (r.dimConvenio ?? {}) as JsonRecord;
  const orgao = (r.orgao ?? {}) as JsonRecord;
  const subfuncao = (r.subfuncao ?? {}) as JsonRecord;
  const funcao = (subfuncao.funcao ?? {}) as JsonRecord;
  return {
    objeto: texto(dim.objeto),
    orgao: texto(orgao.nome),
    situacao: texto(r.situacao),
    fimVigencia: texto(r.dataFinalVigencia) || null,
    valor: numero(r.valor),
    valorLiberado: numero(r.valorLiberado),
    // Educação pela classificação funcional oficial (função 12) — texto do
    // objeto não entra: heurística de palavra viraria afirmação sem fonte.
    educacao: texto(funcao.codigoFuncao) === "12",
  };
}

/** Situações que encerram o instrumento independentemente da vigência. */
const SITUACOES_ENCERRADAS = new Set(["CONCLUÍDO", "CONCLUIDO", "CANCELADO", "EXCLUÍDO", "EXCLUIDO"]);

export function resumirConvenios(
  brutos: unknown[],
  truncado: boolean,
  hoje: Date,
): ConveniosMunicipio {
  const convenios = brutos.map(mapearConvenio);
  const corte = hoje.toISOString().slice(0, 10);
  const vigentes = convenios.filter(
    (c) =>
      c.fimVigencia !== null &&
      c.fimVigencia >= corte &&
      !SITUACOES_ENCERRADAS.has(c.situacao.toUpperCase()),
  );
  const educacaoVigentes = vigentes.filter((c) => c.educacao);
  return {
    total: convenios.length,
    truncado,
    vigentes: vigentes.length,
    valorVigentes: vigentes.reduce((soma, c) => soma + c.valor, 0),
    liberadoVigentes: vigentes.reduce((soma, c) => soma + c.valorLiberado, 0),
    educacaoVigentes: educacaoVigentes.length,
    valorEducacaoVigentes: educacaoVigentes.reduce((soma, c) => soma + c.valor, 0),
    topVigentes: [...vigentes].sort((a, b) => b.valor - a.valor).slice(0, 5),
    semLiberacao: vigentes.filter((c) => c.valorLiberado === 0).length,
  };
}

export async function getConveniosMunicipio(codigoIBGE: string): Promise<ConveniosMunicipio | null> {
  const chave = token();
  if (!chave) return null;
  const digits = codigoIBGE.replace(/\D/g, "");
  if (digits.length !== 7) return null;
  const tipo = encodeURIComponent("Administração Pública Municipal");
  const { registros, truncado } = await fetchTodas(
    (pagina) => `convenios?codigoIBGE=${digits}&tipoConvenente=${tipo}&pagina=${pagina}`,
    chave,
    MAX_PAGINAS_CONVENIOS,
  );
  return resumirConvenios(registros, truncado, new Date());
}

// ---------------------------------------------------------------------------
// Sanções CEIS/CNEP
// ---------------------------------------------------------------------------

export interface SancaoResumo {
  cadastro: "CEIS" | "CNEP";
  sancionado: string;
  orgaoSancionador: string;
  tipo: string;
  fimSancao: string | null;
}

export interface SancoesMunicipio {
  /** Sanções em que o próprio ente municipal é o sancionado. */
  enteSancionado: SancaoResumo[];
  /** Sanções aplicadas por órgãos do próprio município (prefeitura, secretarias). */
  aplicadasPeloEnte: number;
  exemplosAplicadas: SancaoResumo[];
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

function mapearSancao(bruto: unknown, cadastro: "CEIS" | "CNEP"): SancaoResumo {
  const r = bruto as JsonRecord;
  const sancionado = (r.sancionado ?? {}) as JsonRecord;
  const orgao = (r.orgaoSancionador ?? {}) as JsonRecord;
  const tipo = (r.tipoSancao ?? {}) as JsonRecord;
  const fim = texto(r.dataFimSancao);
  return {
    cadastro,
    sancionado: texto(sancionado.nome),
    orgaoSancionador: texto(orgao.nome),
    tipo: texto(tipo.descricaoResumida),
    fimSancao: fim && fim !== "Sem informação" ? fim : null,
  };
}

/** O sancionado é o próprio ente municipal? (MUNICIPIO DE X, PREFEITURA …) */
export function ehEnteMunicipal(nomeSancionado: string, municipio: string): boolean {
  const nome = normalizar(nomeSancionado);
  const alvo = normalizar(municipio);
  return /\b(MUNICIPIO|PREFEITURA|FUNDO MUNICIPAL|CAMARA MUNICIPAL)\b/.test(nome) && nome.includes(alvo);
}

/** O órgão sancionador pertence ao próprio município? */
export function ehOrgaoDoMunicipio(orgaoSancionador: string, municipio: string): boolean {
  const orgao = normalizar(orgaoSancionador);
  const alvo = normalizar(municipio);
  return /\b(PREFEITURA|MUNICIPAL|MUNICIPIO)\b/.test(orgao) && orgao.includes(alvo);
}

export async function getSancoesMunicipio(
  municipio: string,
  _uf: string,
): Promise<SancoesMunicipio | null> {
  const chave = token();
  if (!chave) return null;
  const nome = encodeURIComponent(municipio);

  const consultas = await Promise.all([
    fetchTodas((p) => `ceis?nomeSancionado=${nome}&pagina=${p}`, chave, MAX_PAGINAS_SANCOES),
    fetchTodas((p) => `cnep?nomeSancionado=${nome}&pagina=${p}`, chave, MAX_PAGINAS_SANCOES),
    fetchTodas((p) => `ceis?orgaoSancionador=${nome}&pagina=${p}`, chave, MAX_PAGINAS_SANCOES),
    fetchTodas((p) => `cnep?orgaoSancionador=${nome}&pagina=${p}`, chave, MAX_PAGINAS_SANCOES),
  ]);

  const [ceisNome, cnepNome, ceisOrgao, cnepOrgao] = consultas;
  const enteSancionado = [
    ...ceisNome.registros.map((r) => mapearSancao(r, "CEIS" as const)),
    ...cnepNome.registros.map((r) => mapearSancao(r, "CNEP" as const)),
  ].filter((s) => ehEnteMunicipal(s.sancionado, municipio));

  const aplicadas = [
    ...ceisOrgao.registros.map((r) => mapearSancao(r, "CEIS" as const)),
    ...cnepOrgao.registros.map((r) => mapearSancao(r, "CNEP" as const)),
  ].filter((s) => ehOrgaoDoMunicipio(s.orgaoSancionador, municipio));

  return {
    enteSancionado,
    aplicadasPeloEnte: aplicadas.length,
    exemplosAplicadas: aplicadas.slice(0, 3),
  };
}
