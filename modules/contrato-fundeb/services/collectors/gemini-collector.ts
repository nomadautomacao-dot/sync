/**
 * AI Collector — Pesquisa profunda de dados públicos municipais via Perplexity Sonar.
 *
 * Estratégia "Divide-and-Conquer" otimizada:
 *   - 5 queries ultra-focadas executadas em PARALELO
 *   - Cada query pede 2-4 dados específicos com contexto de onde encontrar
 *   - Perplexity Sonar faz busca web NATIVA para cada query
 *   - Resultados são mergeados automaticamente
 *
 * Custo estimado: ~$0.025 por contrato (5 queries × ~$0.005 cada)
 */

interface GeminiCollectorResult {
  prefeitoCPF: string;
  prefeitoRG: string;
  prefeitoRGOrgao: string;
  prefeitoEstadoCivil: string;
  prefeitoEndereco: string;
  secretarioNome: string;
  secretarioDecreto: string;
  fiscalNome: string;
  fiscalPortaria: string;
  fiscalCargo: string;
  assessorJuridicoNome: string;
  assessorJuridicoOAB: string;
  agenteContratacaoNome: string;
  agenteContratacaoDecreto: string;
  cnpjPrefeitura: string;
  cnpjFundoEducacao: string;
  dotacaoUnidade: string;
  dotacaoAtividade: string;
  dotacaoElemento: string;
  dotacaoFonte: string;
  fontesConsultadas: string[];
  camposNaoEncontrados: string[];
  confiancaGeral: number;
}

// ── Config ──────────────────────────────────────────────────────────────────

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "perplexity/sonar"; // busca web nativa, $1/M in, $1/M out

// ── Queries Ultra-Focadas ───────────────────────────────────────────────────

interface FocusedQuery {
  id: string;
  label: string;
  fields: string[];
  buildPrompt: (ctx: QueryContext) => string;
}

interface QueryContext {
  municipioNome: string;
  uf: string;
  prefeitoNome: string;
  exercicio: number;
}

const FOCUSED_QUERIES: FocusedQuery[] = [
  // ── Query 1: CNPJs ──
  {
    id: "cnpjs",
    label: "CNPJs da Prefeitura e Fundo de Educação",
    fields: ["cnpjPrefeitura", "cnpjFundoEducacao"],
    buildPrompt: (ctx) =>
`Busque os CNPJs oficiais de ${ctx.municipioNome}/${ctx.uf}:

1) CNPJ da PREFEITURA MUNICIPAL DE ${ctx.municipioNome.toUpperCase()} (formato XX.XXX.XXX/0001-XX)
2) CNPJ do FUNDO MUNICIPAL DE EDUCAÇÃO DE ${ctx.municipioNome.toUpperCase()} (é separado da prefeitura)

Fontes: portaldatransparencia.gov.br, consultacnpj.receita.fazenda.gov.br, casacivil.${ctx.uf.toLowerCase()}.gov.br

Retorne JSON: {"cnpjPrefeitura": "", "cnpjFundoEducacao": "", "fontes": []}`,
  },

  // ── Query 2: Secretário de Educação ──
  {
    id: "secretario",
    label: "Secretário(a) de Educação + Decreto",
    fields: ["secretarioNome", "secretarioDecreto"],
    buildPrompt: (ctx) =>
`Quem é o atual Secretário(a) Municipal de Educação de ${ctx.municipioNome}/${ctx.uf}?

Prefeito atual: ${ctx.prefeitoNome} (mandato 2025-2028).

Busque em:
- Site da prefeitura de ${ctx.municipioNome} (seção "Secretarias" ou "Governo")
- Diário oficial do município (decretos de nomeação de janeiro/fevereiro 2025)
- Notícias locais sobre nomeação de secretários

Preciso do nome completo e do decreto de nomeação (número e ano).

Retorne JSON: {"secretarioNome": "", "secretarioDecreto": "", "fontes": []}`,
  },

  // ── Query 3: CPF e RG do Prefeito (TSE + Diário Oficial) ──
  {
    id: "prefeito_docs",
    label: "CPF e RG do Prefeito",
    fields: ["prefeitoCPF", "prefeitoRG", "prefeitoRGOrgao"],
    buildPrompt: (ctx) =>
`Preciso do CPF e RG do prefeito ${ctx.prefeitoNome} de ${ctx.municipioNome}/${ctx.uf}.

ONDE ENCONTRAR:
- divulgacandcontas.tse.jus.br — ficha de candidatura eleições 2024 de "${ctx.prefeitoNome}" (contém CPF)
- Diário oficial de ${ctx.municipioNome} — "termo de posse" do prefeito de janeiro 2025 (contém CPF, RG e órgão expedidor)
- Contratos publicados no diário oficial assinados pelo prefeito ${ctx.prefeitoNome} (contém qualificação com CPF e RG)
- Portal de transparência do município — declaração de bens ou atos de nomeação
- Atas da Câmara Municipal de ${ctx.municipioNome} — sessão de posse

Preciso:
1) CPF (formato XXX.XXX.XXX-XX)
2) RG (número)
3) Órgão expedidor do RG (ex: SSP/${ctx.uf})

Esses dados são PÚBLICOS — prefeitos são agentes públicos e seus dados constam em documentos oficiais publicados.

Retorne JSON: {"prefeitoCPF": "", "prefeitoRG": "", "prefeitoRGOrgao": "", "fontes": []}`,
  },

  // ── Query 4: Estado civil + endereço do Prefeito ──
  {
    id: "prefeito_complemento",
    label: "Estado civil e endereço do Prefeito",
    fields: ["prefeitoEstadoCivil", "prefeitoEndereco"],
    buildPrompt: (ctx) =>
`Qual o estado civil e endereço residencial do prefeito ${ctx.prefeitoNome} de ${ctx.municipioNome}/${ctx.uf}?

ONDE ENCONTRAR:
- Termo de posse no diário oficial (janeiro 2025) — contém qualificação completa
- Ficha de candidatura no TSE (divulgacandcontas.tse.jus.br) — pode ter estado civil
- Contratos administrativos publicados assinados por ${ctx.prefeitoNome} — a qualificação do prefeito como representante legal contém estado civil e endereço
- Declaração de bens publicada no portal de transparência

1) Estado civil (casado, solteiro, divorciado, viúvo, união estável)
2) Endereço residencial (rua, número, bairro, ${ctx.municipioNome}/${ctx.uf})

Retorne JSON: {"prefeitoEstadoCivil": "", "prefeitoEndereco": "", "fontes": []}`,
  },

  // ── Query 5: Assessor Jurídico + Agente de Contratação ──
  {
    id: "assessor_agente",
    label: "Assessor Jurídico e Agente de Contratação",
    fields: ["assessorJuridicoNome", "assessorJuridicoOAB", "agenteContratacaoNome", "agenteContratacaoDecreto"],
    buildPrompt: (ctx) =>
`Preciso identificar o Procurador/Assessor Jurídico e o Agente de Contratação de ${ctx.municipioNome}/${ctx.uf}.

ONDE ENCONTRAR:
- Processos de licitação/inexigibilidade publicados no diário oficial de ${ctx.municipioNome}
- Portal de licitações da prefeitura
- Pareceres jurídicos publicados (sempre têm nome + OAB do procurador)
- Decretos de nomeação do agente de contratação/pregoeiro

1) PROCURADOR MUNICIPAL ou ASSESSOR JURÍDICO:
   - Nome completo
   - Número OAB/${ctx.uf}

2) AGENTE DE CONTRATAÇÃO ou PREGOEIRO oficial:
   - Nome completo
   - Decreto de nomeação (número/ano)

Retorne JSON: {"assessorJuridicoNome": "", "assessorJuridicoOAB": "", "agenteContratacaoNome": "", "agenteContratacaoDecreto": "", "fontes": []}`,
  },

  // ── Query 6: Fiscal de Contratos ──
  {
    id: "fiscal",
    label: "Fiscal de Contratos da Educação",
    fields: ["fiscalNome", "fiscalPortaria", "fiscalCargo"],
    buildPrompt: (ctx) =>
`Quem é o fiscal de contratos da Secretaria de Educação ou do Fundo Municipal de Educação de ${ctx.municipioNome}/${ctx.uf}?

ONDE ENCONTRAR:
- Extratos de contratos publicados no diário oficial (seção de educação/FUNDEB)
- Portarias de designação de fiscal publicadas no diário oficial
- Portal de transparência > contratos > educação
- Atas de registro de preços da Secretaria de Educação

1) Nome completo do fiscal de contratos
2) Portaria de designação (ex: "Portaria nº 123/2025")
3) Cargo efetivo (ex: "Coordenador Administrativo", "Analista de Contratos")

Retorne JSON: {"fiscalNome": "", "fiscalPortaria": "", "fiscalCargo": "", "fontes": []}`,
  },

  // ── Query 7: Dotação orçamentária ──
  {
    id: "dotacao",
    label: "Dotação Orçamentária LOA/Educação",
    fields: ["dotacaoUnidade", "dotacaoAtividade", "dotacaoElemento", "dotacaoFonte"],
    buildPrompt: (ctx) =>
`Qual a dotação orçamentária na LOA ${ctx.exercicio} de ${ctx.municipioNome}/${ctx.uf} para contratação de serviços de assessoria/consultoria na área de Educação com recursos do FUNDEB?

Busque na LOA ${ctx.exercicio} do município, portal de transparência ou QDD (Quadro de Detalhamento de Despesa).

1) Unidade Orçamentária (código e nome, ex: 02.08 - Secretaria Municipal de Educação)
2) Projeto/Atividade (código e descrição, ex: 12.361.0010.2.030 - Manutenção do Ensino)
3) Elemento de Despesa (geralmente 3.3.90.39.00 - Outros Serviços de Terceiros PJ)
4) Fonte de Recurso FUNDEB (geralmente 1.540.0000 - Transferências do FUNDEB)

Retorne JSON: {"dotacaoUnidade": "", "dotacaoAtividade": "", "dotacaoElemento": "", "dotacaoFonte": "", "fontes": []}`,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function cleanValue(val: string | undefined | null): string {
  if (!val || typeof val !== "string") return "";
  const trimmed = val.trim();
  const upper = trimmed.toUpperCase();

  // Lista de marcadores de "não encontrado"
  const emptyMarkers = [
    "N/D", "NÃO ENCONTRADO", "NAO ENCONTRADO", "NÃO INFORMADO",
    "NAO INFORMADO", "INDISPONÍVEL", "INDISPONIVEL", "A DEFINIR",
    "NULL", "UNDEFINED", "NÃO LOCALIZADO", "NAO LOCALIZADO",
    "NÃO DISPONÍVEL", "NAO DISPONIVEL", "DESCONHECIDO",
    "A CONFIRMAR", "NÃO IDENTIFICADO", "NAO IDENTIFICADO",
    "INFORMAÇÃO NÃO ENCONTRADA", "INFORMACAO NAO ENCONTRADA",
    "NÃO DISPONÍVEL NOS PORTAIS CONSULTADOS", "NÃO FOI POSSÍVEL",
    "NAO FOI POSSIVEL", "DADO NÃO ENCONTRADO", "DADO NAO ENCONTRADO",
    "VERIFICAR", "A VERIFICAR", "PENDENTE", "EM ANÁLISE",
  ];

  if (emptyMarkers.includes(upper)) return "";
  if (upper.startsWith("NÃO ") || upper.startsWith("NAO ")) return "";
  if (upper.startsWith("INFORMAÇÃO ") || upper.startsWith("INFORMACAO ")) return "";
  if (upper.startsWith("DADO ")) return "";
  if (trimmed === "" || trimmed === "-" || trimmed === "--") return "";

  return trimmed;
}

function normalizeCnpj(val: string): string {
  const digits = val.replace(/\D/g, "");
  if (digits.length !== 14) return val; // retorna como está se inválido
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

function extractJsonFromText(text: string): Record<string, unknown> | null {
  const withoutThinking = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const cleanText = withoutThinking || text;

  // Tenta ```json ... ```
  const jsonBlockMatch = cleanText.match(/```json\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try { return JSON.parse(jsonBlockMatch[1]); } catch { /* fallthrough */ }
  }

  // Tenta { ... }
  const braceMatch = cleanText.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      // Tenta consertar JSON com aspas duplicadas ou mal formatadas
      try {
        const fixed = braceMatch[0]
          .replace(/""([^"]*)""/g, '"$1"')  // ""text"" → "text"
          .replace(/: ""$/gm, ': ""')        // trailing ""
          .replace(/""\s*,/g, '"",')         // "" antes de vírgula
          .replace(/""\s*}/g, '""}')
          .replace(/\\n/g, ' ')
          .replace(/[\x00-\x1F]/g, ' ');
        return JSON.parse(fixed);
      } catch {
        // Última tentativa: extrair campos manualmente via regex
        return extractFieldsManually(braceMatch[0]);
      }
    }
  }

  try { return JSON.parse(cleanText); } catch { return null; }
}

/**
 * Extrai campos de um JSON mal formatado usando regex.
 * Fallback para quando o parser JSON falha.
 */
function extractFieldsManually(text: string): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  // Captura "chave": "valor" ou "chave": [...]
  const fieldRegex = /"(\w+)"\s*:\s*"([^"]*(?:""[^"]*)*)"/g;
  let match;
  while ((match = fieldRegex.exec(text)) !== null) {
    result[match[1]] = match[2].replace(/""/g, '"');
  }
  // Captura arrays
  const arrayRegex = /"(\w+)"\s*:\s*\[(.*?)\]/g;
  while ((match = arrayRegex.exec(text)) !== null) {
    try {
      result[match[1]] = JSON.parse(`[${match[2]}]`);
    } catch {
      result[match[1]] = [];
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

// ── Executor de Query ───────────────────────────────────────────────────────

async function executeFocusedQuery(
  query: FocusedQuery,
  ctx: QueryContext,
  apiKey: string,
): Promise<Record<string, string>> {
  const prompt = query.buildPrompt(ctx);

  try {
    console.log(`[ai-collector] [${query.id}] Buscando: ${query.label}...`);

    const response = await fetch(OPENROUTER_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Sync - FUNDEB Agent",
      },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: `Você é um pesquisador de administração pública municipal brasileira.
Pesquise nos sites oficiais do governo, diários oficiais, portais de transparência e bases públicas.
Retorne APENAS o JSON solicitado. Se não encontrar um dado, use "" (string vazia). Nunca invente dados.`,
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn(`[ai-collector] [${query.id}] Erro ${response.status}: ${errText.slice(0, 200)}`);
      return {};
    }

    const result = await response.json();
    const text = result?.choices?.[0]?.message?.content ?? "";

    // Extrair citações web
    const annotations = result?.choices?.[0]?.message?.annotations ?? [];
    const webSources: string[] = annotations
      .filter((a: Record<string, unknown>) => a.type === "url_citation")
      .map((a: Record<string, unknown>) => ((a.url_citation as Record<string, unknown>)?.url ?? "") as string)
      .filter(Boolean);

    if (!text) {
      console.warn(`[ai-collector] [${query.id}] Resposta vazia.`);
      return {};
    }

    const parsed = extractJsonFromText(text);
    if (!parsed) {
      console.error(`[ai-collector] [${query.id}] JSON inválido. Primeiros 500 chars: ${text.slice(0, 500)}`);
      return {};
    }

    // Coletar campos + fontes
    const resultFields: Record<string, string> = {};
    for (const field of query.fields) {
      let val = cleanValue(parsed[field] as string | undefined);
      // Normalizar CNPJs (aceitar formato com/sem pontuação)
      if (val && (field === "cnpjPrefeitura" || field === "cnpjFundoEducacao")) {
        val = normalizeCnpj(val);
      }
      if (val) {
        resultFields[field] = val;
      }
    }

    // Merge fontes do JSON + citações web
    const jsonFontes = Array.isArray(parsed["fontes"]) ? (parsed["fontes"] as string[]) : [];
    const allFontes = [...new Set([...jsonFontes, ...webSources])].filter(Boolean);
    if (allFontes.length > 0) {
      resultFields["_fontes_" + query.id] = allFontes.join("|");
    }

    const filledCount = query.fields.filter(f => resultFields[f]).length;
    console.log(`[ai-collector] [${query.id}] ✅ ${filledCount}/${query.fields.length} campos preenchidos`);
    for (const field of query.fields) {
      if (resultFields[field]) {
        console.log(`[ai-collector]   → ${field}: ${resultFields[field]}`);
      }
    }

    return resultFields;
  } catch (error) {
    console.error(`[ai-collector] [${query.id}] Erro:`, error);
    return {};
  }
}

// ── Orquestrador Principal ────────────────────────────────────────────────

export async function collectGeminiData(params: {
  municipioNome: string;
  uf: string;
  prefeitoNome: string;
  exercicio: number;
}): Promise<GeminiCollectorResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("[ai-collector] OPENROUTER_API_KEY não configurada — pulando coleta por IA.");
    return null;
  }

  const ctx: QueryContext = {
    municipioNome: params.municipioNome,
    uf: params.uf,
    prefeitoNome: params.prefeitoNome,
    exercicio: params.exercicio,
  };

  console.log(`[ai-collector] Pesquisa profunda: ${FOCUSED_QUERIES.length} queries paralelas via ${MODEL}...`);

  // Executar TODAS as queries em paralelo
  const results = await Promise.allSettled(
    FOCUSED_QUERIES.map(q => executeFocusedQuery(q, ctx, apiKey)),
  );

  // Merge todos os resultados
  const merged: Record<string, string> = {};
  const allFontes: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled" && result.value) {
      for (const [key, val] of Object.entries(result.value)) {
        if (key.startsWith("_fontes_")) {
          allFontes.push(...val.split("|"));
        } else if (val && !merged[key]) {
          merged[key] = val;
        }
      }
    } else if (result.status === "rejected") {
      console.error(`[ai-collector] Query ${FOCUSED_QUERIES[i].id} rejeitada:`, result.reason);
    }
  }

  const uniqueFontes = [...new Set(allFontes.filter(Boolean))];
  const allFields = FOCUSED_QUERIES.flatMap(q => q.fields);
  const camposNaoEncontrados = allFields.filter(f => !merged[f]);
  const asStr = (key: string) => merged[key] || "";

  const collected: GeminiCollectorResult = {
    prefeitoCPF: asStr("prefeitoCPF"),
    prefeitoRG: asStr("prefeitoRG"),
    prefeitoRGOrgao: asStr("prefeitoRGOrgao"),
    prefeitoEstadoCivil: asStr("prefeitoEstadoCivil"),
    prefeitoEndereco: asStr("prefeitoEndereco"),
    secretarioNome: asStr("secretarioNome"),
    secretarioDecreto: asStr("secretarioDecreto"),
    fiscalNome: asStr("fiscalNome"),
    fiscalPortaria: asStr("fiscalPortaria"),
    fiscalCargo: asStr("fiscalCargo"),
    assessorJuridicoNome: asStr("assessorJuridicoNome"),
    assessorJuridicoOAB: asStr("assessorJuridicoOAB"),
    agenteContratacaoNome: asStr("agenteContratacaoNome"),
    agenteContratacaoDecreto: asStr("agenteContratacaoDecreto"),
    cnpjPrefeitura: asStr("cnpjPrefeitura"),
    cnpjFundoEducacao: asStr("cnpjFundoEducacao"),
    dotacaoUnidade: asStr("dotacaoUnidade"),
    dotacaoAtividade: asStr("dotacaoAtividade"),
    dotacaoElemento: asStr("dotacaoElemento"),
    dotacaoFonte: asStr("dotacaoFonte"),
    fontesConsultadas: uniqueFontes,
    camposNaoEncontrados,
    confiancaGeral: Math.round(((allFields.length - camposNaoEncontrados.length) / allFields.length) * 100),
  };

  const keyFields = [
    collected.prefeitoCPF, collected.prefeitoRG, collected.secretarioNome,
    collected.fiscalNome, collected.assessorJuridicoNome, collected.agenteContratacaoNome,
    collected.cnpjPrefeitura, collected.cnpjFundoEducacao,
  ].filter(Boolean).length;

  console.log(`[ai-collector] ✅ Final: ${keyFields}/8 campos-chave | ${allFields.length - camposNaoEncontrados.length}/${allFields.length} total | confiança: ${collected.confiancaGeral}%`);
  console.log(`[ai-collector] 📚 ${uniqueFontes.length} fontes web consultadas`);

  if (keyFields === 0 && camposNaoEncontrados.length === allFields.length) {
    console.warn("[ai-collector] Nenhum campo preenchido — retornando null.");
    return null;
  }

  return collected;
}
