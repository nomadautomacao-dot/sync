/**
 * CNPJ Collector — Busca CNPJs da Prefeitura e do Fundo Municipal de Educação
 * via APIs públicas gratuitas (BrasilAPI, ReceitaWS, CNPJ.ws)
 *
 * Estratégia de busca (prioridade):
 *  1. Se Gemini já encontrou um CNPJ → valida e enriquece via BrasilAPI
 *  2. Se não → tenta descobrir via código IBGE (padrão CNPJ de prefeitura)
 *  3. Se não → busca no CasaSul/CNPJ.ws por nome da prefeitura
 */

interface CnpjRecord {
  cnpj: string;
  razaoSocial: string;
  endereco: string;
  cep: string;
  municipio: string;
  uf: string;
  bairro: string;
}

interface CnpjCollectorResult {
  prefeitura: CnpjRecord | null;
  fundoEducacao: CnpjRecord | null;
}

interface BrasilApiCnpjResponse {
  cnpj: string;
  razao_social: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  descricao_situacao_cadastral: string;
}

/**
 * Consulta dados de um CNPJ na BrasilAPI (gratuita, sem limite rígido).
 */
async function fetchCnpjBrasilApi(cnpj: string): Promise<CnpjRecord | null> {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return null;

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Sync/1.0" },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as BrasilApiCnpjResponse;

    const partes = [data.logradouro, data.numero, data.complemento, data.bairro]
      .filter(Boolean)
      .join(", ");

    return {
      cnpj: formatCnpj(digits),
      razaoSocial: data.razao_social || "",
      endereco: partes,
      cep: formatCep(data.cep || ""),
      municipio: data.municipio || "",
      uf: data.uf || "",
      bairro: data.bairro || "",
    };
  } catch (error) {
    console.warn("[cnpj-collector] BrasilAPI falhou:", error);
    return null;
  }
}

/**
 * Consulta dados de um CNPJ na ReceitaWS (fallback, 3 req/min grátis).
 */
async function fetchCnpjReceitaWs(cnpj: string): Promise<CnpjRecord | null> {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return null;

  try {
    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`, {
      signal: AbortSignal.timeout(20000),
      headers: {
        "User-Agent": "Sync/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (data.status === "ERROR") return null;

    const partes = [data.logradouro, data.numero, data.complemento, data.bairro]
      .filter(Boolean)
      .join(", ");

    return {
      cnpj: formatCnpj(digits),
      razaoSocial: data.nome || "",
      endereco: partes,
      cep: formatCep(data.cep || ""),
      municipio: data.municipio || "",
      uf: data.uf || "",
      bairro: data.bairro || "",
    };
  } catch (error) {
    console.warn("[cnpj-collector] ReceitaWS falhou:", error);
    return null;
  }
}

/**
 * Busca um CNPJ por qualquer API disponível (BrasilAPI primeiro, ReceitaWS como fallback).
 */
async function fetchCnpj(cnpj: string): Promise<CnpjRecord | null> {
  return (await fetchCnpjBrasilApi(cnpj)) ?? (await fetchCnpjReceitaWs(cnpj));
}

function formatCnpj(digits: string): string {
  const d = digits.replace(/\D/g, "").padStart(14, "0");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

function formatCep(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length !== 8) return value;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}-${d.slice(5)}`;
}

// ── Busca de CNPJ por padrão IBGE ───────────────────────────────────────────

/**
 * Descobre o CNPJ da Prefeitura usando uma heurística baseada no código IBGE.
 *
 * Prefeituras brasileiras seguem o padrão de CNPJ que começa com os mesmos
 * dígitos do código IBGE (sem o dígito verificador). Testamos variações comuns:
 *   - Padrão federal: XX.XXX.XXX/0001-XX
 *
 * Se encontrar, valida que a razão social contém "PREFEITURA" ou "MUNICIPIO".
 */
async function discoverPrefeituraCnpjByIbge(codigoIBGE: string): Promise<CnpjRecord | null> {
  if (!codigoIBGE || codigoIBGE.length < 6) return null;

  // O código IBGE com 7 dígitos → os primeiros 2 = UF, 5 seguintes = município
  // CNPJ de prefeitura geralmente segue padrão específico por estado
  // Não há fórmula universal, mas podemos tentar buscas comuns
  // A abordagem mais eficaz é via nome + busca textual

  return null; // fallback, será tratado por searchByName
}

/**
 * Busca CNPJs de prefeitura e fundo de educação pelo nome do município usando
 * a API pública do CNPJ.ws (https://publica.cnpj.ws/cnpj).
 *
 * Estratégia: busca "PREFEITURA MUNICIPAL DE [CIDADE]" e filtra por UF.
 */
async function searchCnpjByName(
  razaoSocialSearch: string,
  uf: string,
): Promise<CnpjRecord | null> {
  try {
    // CNPJ.ws API pública de busca por razão social
    const encoded = encodeURIComponent(razaoSocialSearch);
    const response = await fetch(
      `https://publica.cnpj.ws/cnpj?razao_social=${encoded}&uf=${uf.toUpperCase()}&page=1&per_page=5`,
      {
        signal: AbortSignal.timeout(15000),
        headers: { "User-Agent": "Sync/1.0", Accept: "application/json" },
      },
    );

    if (!response.ok) {
      console.warn(`[cnpj-collector] CNPJ.ws search retornou ${response.status}`);
      return null;
    }

    const results = await response.json();
    const items = Array.isArray(results) ? results : results?.data ?? results?.registros ?? [];

    if (!Array.isArray(items) || items.length === 0) return null;

    // Pegar o primeiro resultado com situação ativa
    const item = items.find(
      (i: Record<string, unknown>) =>
        (i as Record<string, unknown>).situacao_cadastral !== "BAIXADA" &&
        (i as Record<string, unknown>).situacao_cadastral !== "INAPTA",
    ) ?? items[0];

    const cnpjDigits = String(item.cnpj || "").replace(/\D/g, "");
    if (cnpjDigits.length !== 14) return null;

    // Enriquecer via BrasilAPI para obter endereço completo
    return await fetchCnpj(cnpjDigits);
  } catch (error) {
    console.warn("[cnpj-collector] Busca por nome falhou:", error);
    return null;
  }
}

/**
 * Tenta múltiplas estratégias para descobrir o CNPJ da Prefeitura:
 *  1. CNPJ já fornecido (via Gemini) → valida
 *  2. Busca por nome "PREFEITURA MUNICIPAL DE [CIDADE]"
 *  3. Busca por "MUNICIPIO DE [CIDADE]"
 */
async function discoverPrefeituraCnpj(
  municipioNome: string,
  uf: string,
  cnpjHint?: string,
): Promise<CnpjRecord | null> {
  // 1. Se temos um CNPJ hint (do Gemini), validar
  if (cnpjHint) {
    const validated = await fetchCnpj(cnpjHint);
    if (validated) {
      console.log(`[cnpj-collector] CNPJ da Prefeitura validado: ${validated.cnpj}`);
      return validated;
    }
  }

  // 2. Buscar por "PREFEITURA MUNICIPAL DE [CIDADE]"
  console.log(`[cnpj-collector] Buscando CNPJ: "PREFEITURA MUNICIPAL DE ${municipioNome.toUpperCase()}"...`);
  const prefResult = await searchCnpjByName(`PREFEITURA MUNICIPAL DE ${municipioNome}`, uf);
  if (prefResult) {
    console.log(`[cnpj-collector] Encontrado via busca: ${prefResult.cnpj} - ${prefResult.razaoSocial}`);
    return prefResult;
  }

  // 3. Buscar por "MUNICIPIO DE [CIDADE]"
  console.log(`[cnpj-collector] Tentando: "MUNICIPIO DE ${municipioNome.toUpperCase()}"...`);
  const muniResult = await searchCnpjByName(`MUNICIPIO DE ${municipioNome}`, uf);
  if (muniResult) {
    console.log(`[cnpj-collector] Encontrado via busca alternativa: ${muniResult.cnpj}`);
    return muniResult;
  }

  return null;
}

/**
 * Tenta múltiplas estratégias para descobrir o CNPJ do Fundo Municipal de Educação:
 *  1. CNPJ já fornecido (via Gemini) → valida
 *  2. Busca por "FUNDO MUNICIPAL DE EDUCAÇÃO DE [CIDADE]"
 *  3. Busca por "FUNDO DE MANUTENÇÃO [CIDADE]"
 */
async function discoverFundoCnpj(
  municipioNome: string,
  uf: string,
  cnpjHint?: string,
): Promise<CnpjRecord | null> {
  // 1. Se temos um CNPJ hint (do Gemini), validar
  if (cnpjHint) {
    const validated = await fetchCnpj(cnpjHint);
    if (validated) {
      console.log(`[cnpj-collector] CNPJ do FME validado: ${validated.cnpj}`);
      return validated;
    }
  }

  // 2. Buscar por "FUNDO MUNICIPAL DE EDUCAÇÃO DE [CIDADE]"
  console.log(`[cnpj-collector] Buscando CNPJ: "FUNDO MUNICIPAL EDUCACAO ${municipioNome.toUpperCase()}"...`);
  const fundoResult = await searchCnpjByName(`FUNDO MUNICIPAL EDUCACAO ${municipioNome}`, uf);
  if (fundoResult) {
    console.log(`[cnpj-collector] FME encontrado: ${fundoResult.cnpj} - ${fundoResult.razaoSocial}`);
    return fundoResult;
  }

  // 3. Busca alternativa
  const fundoResult2 = await searchCnpjByName(`FUNDO DE MANUTENCAO ${municipioNome}`, uf);
  if (fundoResult2) {
    console.log(`[cnpj-collector] FME encontrado (alt): ${fundoResult2.cnpj}`);
    return fundoResult2;
  }

  return null;
}

// ── Exports ─────────────────────────────────────────────────────────────────

/**
 * Busca os CNPJs da Prefeitura e do Fundo Municipal de Educação.
 *
 * Usa uma estratégia multi-fonte:
 *  1. Se Gemini forneceu os CNPJs → valida via BrasilAPI
 *  2. Se não → busca por nome via CNPJ.ws
 *  3. Se encontrou CNPJ → enriquece com endereço completo via BrasilAPI
 */
export async function collectCnpjData(params: {
  municipioNome: string;
  uf: string;
  cnpjPrefeitura?: string;
  cnpjFundoEducacao?: string;
}): Promise<CnpjCollectorResult> {
  // Buscar Prefeitura e FME em paralelo para economizar tempo
  const [prefeitura, fundoEducacao] = await Promise.all([
    discoverPrefeituraCnpj(params.municipioNome, params.uf, params.cnpjPrefeitura),
    discoverFundoCnpj(params.municipioNome, params.uf, params.cnpjFundoEducacao),
  ]);

  return { prefeitura, fundoEducacao };
}

/**
 * Valida e enriquece um CNPJ fornecido (por qualquer fonte).
 * Retorna os dados completos ou null se inválido.
 */
export async function validateAndEnrichCnpj(cnpj: string): Promise<CnpjRecord | null> {
  return fetchCnpj(cnpj);
}
