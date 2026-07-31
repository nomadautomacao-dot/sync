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

/**
 * A API limita requisições por minuto na chave gratuita, e o limite chega
 * como **400**, não como 429 — a mesma consulta que falha volta a responder
 * 200 segundos depois. Sem repetição, um dossiê que pagina dezenas de vezes
 * perde seções inteiras por sorte de cronômetro.
 */
const TENTATIVAS = 3;
const ESPERA_BASE_MS = 1500;

/**
 * 20 segundos era pouco. Medido em produção em 31/07/2026: a consulta de
 * sanções por nome de órgão é textual e cara, e o Portal chegou a devolver
 * **HTTP 504** — gateway timeout do lado dele. Da máquina de desenvolvimento
 * a mesma chamada passa; do Cloud Run, não.
 */
const TIMEOUT_MS = 30_000;

/**
 * Teto de tempo para uma consulta inteira, somando páginas e repetições. Sem
 * ele, cinco páginas × três tentativas × 30s comeriam o `maxDuration` de 300s
 * da rota e derrubariam o relatório inteiro por causa de uma fonte lenta.
 * Estourado o teto, devolve o que já tem e marca como truncado.
 */
const ORCAMENTO_MS = 75_000;

function dormir(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

async function fetchPagina(caminho: string, chave: string): Promise<unknown[]> {
  let ultimoStatus = 0;

  let ultimoErro = "";

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa += 1) {
    // O `try` é o conserto principal: `AbortSignal.timeout` lança, e a versão
    // anterior deixava a exceção escapar do laço — ou seja, **timeout não era
    // repetido**, virava falha na primeira ocorrência. Era o que apagava
    // convênios e sanções de todo relatório gerado em produção.
    try {
      const resposta = await fetch(`${BASE}/${caminho}`, {
        headers: { "chave-api-dados": chave, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (resposta.ok) {
        const corpo = (await resposta.json()) as unknown;
        return Array.isArray(corpo) ? corpo : [];
      }

      ultimoStatus = resposta.status;
      // 404 é ausência de dado, não excesso de chamada: repetir não muda nada.
      if (resposta.status === 404) return [];
      ultimoErro = `HTTP ${resposta.status}`;
    } catch (erro) {
      ultimoErro = erro instanceof Error ? erro.message : String(erro);
    }

    if (tentativa < TENTATIVAS) await dormir(ESPERA_BASE_MS * tentativa);
  }

  throw new Error(
    `Portal da Transparência: ${ultimoErro || `HTTP ${ultimoStatus}`} em ${caminho}`,
  );
}

async function fetchTodas(
  montarCaminho: (pagina: number) => string,
  chave: string,
  maxPaginas: number,
): Promise<{ registros: unknown[]; truncado: boolean }> {
  const registros: unknown[] = [];
  const limite = Date.now() + ORCAMENTO_MS;

  for (let pagina = 1; pagina <= maxPaginas; pagina += 1) {
    // Meia página a mais não vale derrubar o relatório: se o orçamento acabou,
    // devolve o que já veio e assume o truncamento em voz alta. A primeira
    // página é sempre tentada — sem ela não há dado nenhum a preservar.
    if (pagina > 1 && Date.now() > limite) return { registros, truncado: true };

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
  /**
   * Todos os vigentes, do maior valor ao menor. `topVigentes` é o recorte de
   * cinco que o Raio-X imprime; o dossiê precisa da carteira inteira, e
   * recortar em cinco lá seria o truncamento silencioso que a regra 6 proíbe.
   */
  vigentesLista: ConvenioResumo[];
  /** Encerrados por conclusão, cancelamento ou fim de vigência. */
  encerrados: number;
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
  const ordenados = [...vigentes].sort((a, b) => b.valor - a.valor);
  return {
    total: convenios.length,
    truncado,
    vigentes: vigentes.length,
    valorVigentes: vigentes.reduce((soma, c) => soma + c.valor, 0),
    liberadoVigentes: vigentes.reduce((soma, c) => soma + c.valorLiberado, 0),
    educacaoVigentes: educacaoVigentes.length,
    valorEducacaoVigentes: educacaoVigentes.reduce((soma, c) => soma + c.valor, 0),
    topVigentes: ordenados.slice(0, 5),
    vigentesLista: ordenados,
    encerrados: convenios.length - vigentes.length,
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
  /** A lista inteira das aplicadas. `exemplosAplicadas` é o recorte do Raio-X. */
  listaAplicadas: SancaoResumo[];
  /** `true` quando a paginação bateu no teto e há sanção fora da lista. */
  truncado: boolean;
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
    listaAplicadas: aplicadas,
    truncado: consultas.some((c) => c.truncado),
  };
}
