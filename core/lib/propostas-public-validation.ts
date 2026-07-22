import type {
  PropostaPublicValidationData,
  PropostaPublicValidationField,
  PropostaPublicValidationFieldKey,
  PropostaPublicValidationStatus,
} from "@/modules/propostas/types";

// ── OpenRouter Config (primary) ────────────────────────────────────────────
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "qwen/qwen3.7-plus";

// ── Gemini Fallback Config ─────────────────────────────────────────────────
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const FIELD_LABELS: Record<PropostaPublicValidationFieldKey, string> = {
  cnpjMunicipio: "CNPJ do municipio",
  enderecoMunicipio: "Endereco institucional",
  cepMunicipio: "CEP",
  nomeFundoEducacao: "Nome do fundo de educacao",
  siglaFundoEducacao: "Sigla do fundo",
  cnpjFundoEducacao: "CNPJ do fundo",
};

interface ValidationContext {
  codigoIbge: string;
  municipioNome: string;
  municipioUf: string;
  estadoNome: string;
  nomeAutoridade: string;
  partidoAutoridade: string;
}

interface RawGeminiField {
  value?: string | null;
  confidence?: number | null;
  status?: string | null;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  notes?: string | null;
}

interface RawGeminiValidationResponse {
  summary?: string | null;
  warnings?: string[] | null;
  fields?: Partial<Record<PropostaPublicValidationFieldKey, RawGeminiField>> | null;
  pendingManual?: string[] | null;
}

interface GeminiGroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

interface GeminiGroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: GeminiGroundingChunk[];
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    groundingMetadata?: GeminiGroundingMetadata;
  }>;
}

function getOpenRouterApiKey() {
  return process.env.OPENROUTER_API_KEY?.trim() || "";
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GEMINI_API_KEY?.trim() || "";
}

function normalizeText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) {
    return value.trim();
  }

  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) {
    return value.trim();
  }

  return digits.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

function normalizeFieldValue(key: PropostaPublicValidationFieldKey, value: string) {
  if (!value) {
    return "";
  }

  if (key === "cnpjMunicipio" || key === "cnpjFundoEducacao") {
    return formatCnpj(value);
  }

  if (key === "cepMunicipio") {
    return formatCep(value);
  }

  return value.trim();
}

function normalizeStatus(value: string | null | undefined, fallbackValue: string): PropostaPublicValidationStatus {
  if (value === "manual_only" || value === "validated" || value === "not_found") {
    return value;
  }

  return fallbackValue ? "validated" : "not_found";
}

function buildDefaultField(key: PropostaPublicValidationFieldKey): PropostaPublicValidationField {
  return {
    key,
    label: FIELD_LABELS[key],
    value: "",
    confidence: 0,
    status: "not_found",
    sourceUrl: "",
    sourceLabel: "",
    notes: "",
  };
}

function normalizeField(
  key: PropostaPublicValidationFieldKey,
  field: RawGeminiField | undefined,
): PropostaPublicValidationField {
  const fallback = buildDefaultField(key);
  const value = normalizeFieldValue(key, normalizeText(field?.value));
  const confidence = Number.isFinite(field?.confidence)
    ? Math.max(0, Math.min(100, Math.round(Number(field?.confidence))))
    : value
      ? 70
      : 0;

  return {
    ...fallback,
    value,
    confidence,
    status: normalizeStatus(field?.status, value),
    sourceUrl: normalizeText(field?.sourceUrl),
    sourceLabel: normalizeText(field?.sourceLabel),
    notes: normalizeText(field?.notes),
  };
}

function extractCandidateText(payload: GeminiGenerateContentResponse) {
  return (
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function extractJsonBlock(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function extractSearchQueries(payload: GeminiGenerateContentResponse) {
  return payload.candidates?.[0]?.groundingMetadata?.webSearchQueries?.filter(Boolean) ?? [];
}

function extractFallbackSources(payload: GeminiGenerateContentResponse) {
  const chunks = payload.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  return chunks
    .map((chunk) => ({
      url: chunk.web?.uri?.trim() ?? "",
      label: chunk.web?.title?.trim() ?? "",
    }))
    .filter((item) => item.url);
}

// ── OpenRouter Request (Primary) ──────────────────────────────────────────

async function requestOpenRouter(prompt: string, apiKey: string) {
  const response = await fetch(OPENROUTER_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Sync - Propostas Validation",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content: "Você é um assistente especializado em administração pública municipal brasileira. Use a busca web para verificar dados atuais. Responda APENAS em formato JSON válido, sem markdown, sem explicações adicionais fora do JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      // Web Search Plugin — busca dados reais em tempo real
      plugins: [
        {
          id: "web",
          max_results: 8,
          search_prompt: `Busca web realizada em ${new Date().toLocaleDateString("pt-BR")}. Use os resultados para validar dados institucionais do município.`,
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter respondeu ${response.status}: ${errorText.slice(0, 400)}`);
  }

  const result = await response.json();
  const text = result?.choices?.[0]?.message?.content ?? "";
  
  // Converter para o formato GeminiGenerateContentResponse para compatibilidade
  return {
    candidates: [{
      content: {
        parts: [{ text }],
      },
    }],
  } as GeminiGenerateContentResponse;
}

// ── Gemini Request (Fallback) ─────────────────────────────────────────────

async function requestGemini(prompt: string, apiKey: string, preferJsonMode: boolean) {
  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.1,
        ...(preferJsonMode ? { responseMimeType: "application/json" } : {}),
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini respondeu ${response.status}: ${errorText.slice(0, 400)}`);
  }

  return (await response.json()) as GeminiGenerateContentResponse;
}

function buildPrompt(context: ValidationContext) {
  return [
    "Voce valida dados publicos institucionais de municipios brasileiros para proposta comercial.",
    "Use apenas informacoes publicas e atuais encontradas na web com grounding de busca.",
    "Priorize, nesta ordem: site oficial da prefeitura, portal da transparencia, dominio gov.br, diario oficial, pagina oficial do fundo municipal de educacao, paginas oficiais do FNDE e paginas oficiais de CNPJ vinculadas ao ente publico.",
    "Nao invente nem complete lacunas por inferencia fraca.",
    "Nunca retorne CPF, RG, endereco residencial, telefone pessoal ou email pessoal do prefeito.",
    "Retorne SOMENTE um JSON valido, sem markdown, no formato:",
    JSON.stringify({
      summary: "string",
      warnings: ["string"],
      pendingManual: ["cpfAutoridade", "rgAutoridade"],
      fields: {
        cnpjMunicipio: {
          value: "string|null",
          confidence: 0,
          status: "validated|not_found",
          sourceUrl: "string|null",
          sourceLabel: "string|null",
          notes: "string",
        },
        enderecoMunicipio: {
          value: "string|null",
          confidence: 0,
          status: "validated|not_found",
          sourceUrl: "string|null",
          sourceLabel: "string|null",
          notes: "string",
        },
        cepMunicipio: {
          value: "string|null",
          confidence: 0,
          status: "validated|not_found",
          sourceUrl: "string|null",
          sourceLabel: "string|null",
          notes: "string",
        },
        nomeFundoEducacao: {
          value: "string|null",
          confidence: 0,
          status: "validated|not_found",
          sourceUrl: "string|null",
          sourceLabel: "string|null",
          notes: "string",
        },
        siglaFundoEducacao: {
          value: "string|null",
          confidence: 0,
          status: "validated|not_found",
          sourceUrl: "string|null",
          sourceLabel: "string|null",
          notes: "string",
        },
        cnpjFundoEducacao: {
          value: "string|null",
          confidence: 0,
          status: "validated|not_found",
          sourceUrl: "string|null",
          sourceLabel: "string|null",
          notes: "string",
        },
      },
    }),
    "Regras adicionais:",
    "1. O CNPJ do municipio deve ser o CNPJ institucional da prefeitura municipal, nao do prefeito.",
    "2. O endereco deve ser institucional e o mais completo possivel.",
    "3. O CEP deve corresponder ao endereco institucional da prefeitura, quando encontrado.",
    "4. Fundo de educacao: preencha apenas se encontrar indicio publico robusto do nome oficial e/ou CNPJ do fundo.",
    "5. Se nao houver evidencia suficiente, use value null, confidence 0 e status not_found.",
    "6. confidence deve ser um inteiro de 0 a 100.",
    "7. sourceUrl e sourceLabel devem apontar para a fonte principal usada em cada campo.",
    "Contexto confirmado no sistema:",
    `- Municipio: ${context.municipioNome}/${context.municipioUf}`,
    `- Codigo IBGE: ${context.codigoIbge}`,
    `- Estado: ${context.estadoNome}`,
    `- Prefeito na base local: ${context.nomeAutoridade || "nao informado"}`,
    `- Partido na base local: ${context.partidoAutoridade || "nao informado"}`,
  ].join("\n");
}

function parseGeminiJson(text: string) {
  const jsonBlock = extractJsonBlock(text);
  if (!jsonBlock) {
    throw new Error("A resposta da IA veio vazia.");
  }

  return JSON.parse(jsonBlock) as RawGeminiValidationResponse;
}

export async function validateMunicipioPublicDataWithAi(
  context: ValidationContext,
): Promise<PropostaPublicValidationData> {
  const openRouterKey = getOpenRouterApiKey();
  const geminiKey = getGeminiApiKey();

  if (!openRouterKey && !geminiKey) {
    throw new Error("OPENROUTER_API_KEY ou GEMINI_API_KEY nao configurada.");
  }

  const prompt = buildPrompt(context);
  let payload: GeminiGenerateContentResponse | null = null;
  let parsed: RawGeminiValidationResponse | null = null;
  let lastError: Error | null = null;
  let modelUsed = OPENROUTER_MODEL;

  // Tenta OpenRouter primeiro (se configurado)
  if (openRouterKey) {
    try {
      console.log(`[propostas-validation] Usando OpenRouter (${OPENROUTER_MODEL})...`);
      payload = await requestOpenRouter(prompt, openRouterKey);
      parsed = parseGeminiJson(extractCandidateText(payload));
      modelUsed = OPENROUTER_MODEL;
    } catch (error) {
      console.warn("[propostas-validation] OpenRouter falhou, tentando Gemini fallback...", error);
      lastError = error instanceof Error ? error : new Error("Falha OpenRouter.");
      payload = null;
      parsed = null;
    }
  }

  // Fallback para Gemini (se OpenRouter não funcionou)
  if (!parsed && geminiKey) {
    for (const preferJsonMode of [true, false]) {
      try {
        console.log(`[propostas-validation] Usando Gemini fallback (${GEMINI_MODEL})...`);
        payload = await requestGemini(prompt, geminiKey, preferJsonMode);
        parsed = parseGeminiJson(extractCandidateText(payload));
        modelUsed = GEMINI_MODEL;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Falha ao consultar a IA.");
      }
    }
  }

  if (!payload || !parsed) {
    throw lastError ?? new Error("Falha ao validar os dados publicos com IA.");
  }

  const fallbackSources = extractFallbackSources(payload);
  const applyFallbackSource = (field: PropostaPublicValidationField) => {
    if (field.sourceUrl || fallbackSources.length === 0) {
      return field;
    }

    const fallback = fallbackSources[0];
    return {
      ...field,
      sourceUrl: fallback.url,
      sourceLabel: field.sourceLabel || fallback.label,
    };
  };

  const fields = {
    cnpjMunicipio: applyFallbackSource(normalizeField("cnpjMunicipio", parsed.fields?.cnpjMunicipio)),
    enderecoMunicipio: applyFallbackSource(normalizeField("enderecoMunicipio", parsed.fields?.enderecoMunicipio)),
    cepMunicipio: applyFallbackSource(normalizeField("cepMunicipio", parsed.fields?.cepMunicipio)),
    nomeFundoEducacao: applyFallbackSource(normalizeField("nomeFundoEducacao", parsed.fields?.nomeFundoEducacao)),
    siglaFundoEducacao: applyFallbackSource(normalizeField("siglaFundoEducacao", parsed.fields?.siglaFundoEducacao)),
    cnpjFundoEducacao: applyFallbackSource(normalizeField("cnpjFundoEducacao", parsed.fields?.cnpjFundoEducacao)),
  } satisfies Record<PropostaPublicValidationFieldKey, PropostaPublicValidationField>;

  return {
    codigoIbge: context.codigoIbge,
    municipioNome: context.municipioNome,
    municipioUf: context.municipioUf,
    estadoNome: context.estadoNome,
    validatedAt: new Date().toISOString(),
    model: modelUsed,
    summary: normalizeText(parsed.summary) || "Validacao publica concluida pela camada de IA.",
    searchQueries: extractSearchQueries(payload),
    warnings: parsed.warnings?.map((item) => normalizeText(item)).filter(Boolean) ?? [],
    pendingManual: Array.from(
      new Set([
        "cpfAutoridade",
        "rgAutoridade",
        ...(parsed.pendingManual?.map((item) => normalizeText(item)).filter(Boolean) ?? []),
      ]),
    ),
    fields,
  };
}
