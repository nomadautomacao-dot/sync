/**
 * Gemini Collector — Usa IA com Google Search Grounding para buscar dados
 * públicos de gestores municipais em diários oficiais, portais de transparência
 * e fontes governamentais.
 *
 * Estratégia em 2 etapas:
 *   1. Chamada com Google Search Grounding → texto livre com dados pesquisados
 *   2. Parse do texto para JSON estruturado
 *
 * Isso contorna a limitação de responseSchema + googleSearch não serem
 * compatíveis simultaneamente.
 */

export interface GeminiCollectorResult {
  // Prefeito
  prefeitoCPF: string;
  prefeitoRG: string;
  prefeitoRGOrgao: string;
  prefeitoEstadoCivil: string;
  prefeitoEndereco: string;

  // Secretário de Educação
  secretarioNome: string;
  secretarioDecreto: string;

  // Fiscal de Contratos
  fiscalNome: string;
  fiscalPortaria: string;
  fiscalCargo: string;

  // Assessor Jurídico / Procurador
  assessorJuridicoNome: string;
  assessorJuridicoOAB: string;

  // Agente de Contratação
  agenteContratacaoNome: string;
  agenteContratacaoDecreto: string;

  // CNPJs
  cnpjPrefeitura: string;
  cnpjFundoEducacao: string;

  // Dotação Orçamentária (LOA)
  dotacaoUnidade: string;
  dotacaoAtividade: string;
  dotacaoElemento: string;
  dotacaoFonte: string;

  // Metadados
  fontesConsultadas: string[];
  camposNaoEncontrados: string[];
  confiancaGeral: number; // 0-100
}

function buildSearchPrompt(municipioNome: string, uf: string, prefeitoNome: string, exercicio: number): string {
  return `Busque informações públicas oficiais sobre o município de ${municipioNome}/${uf} para preencher um contrato de inexigibilidade de licitação FUNDEB, exercício ${exercicio}.

O prefeito atual é: ${prefeitoNome || "não identificado"}.

Pesquise nos diários oficiais, portais de transparência e fontes governamentais:

1. PREFEITO(A) MUNICIPAL (${prefeitoNome || "a identificar"}):
   - CPF, RG (número + órgão expedidor), estado civil, endereço (do termo de posse)

2. SECRETÁRIO(A) MUNICIPAL DE EDUCAÇÃO:
   - Nome completo e decreto de nomeação

3. FISCAL DE CONTRATOS DO FUNDO MUNICIPAL DE EDUCAÇÃO:
   - Nome, portaria de designação, cargo

4. PROCURADOR(A) / ASSESSOR(A) JURÍDICO(A) MUNICIPAL:
   - Nome completo e OAB

5. AGENTE DE CONTRATAÇÃO / PREGOEIRO(A):
   - Nome e decreto de nomeação

6. CNPJ DA PREFEITURA MUNICIPAL DE ${municipioNome.toUpperCase()}

7. CNPJ DO FUNDO MUNICIPAL DE EDUCAÇÃO DE ${municipioNome.toUpperCase()}

8. DOTAÇÃO ORÇAMENTÁRIA (LOA ${exercicio} — Educação/FUNDEB):
   - Unidade, Atividade, Elemento de despesa, Fonte de recurso

IMPORTANTE: Use APENAS dados de fontes oficiais. Se não encontrar, diga claramente "não encontrado".
Retorne os dados em formato JSON com as chaves:
prefeitoCPF, prefeitoRG, prefeitoRGOrgao, prefeitoEstadoCivil, prefeitoEndereco,
secretarioNome, secretarioDecreto, fiscalNome, fiscalPortaria, fiscalCargo,
assessorJuridicoNome, assessorJuridicoOAB, agenteContratacaoNome, agenteContratacaoDecreto,
cnpjPrefeitura, cnpjFundoEducacao, dotacaoUnidade, dotacaoAtividade, dotacaoElemento,
dotacaoFonte, fontesConsultadas (array), camposNaoEncontrados (array), confiancaGeral (0-100).
Use string vazia "" para campos não encontrados.`;
}

function cleanValue(val: string | undefined | null): string {
  if (!val) return "";
  const normalized = val.trim().toUpperCase();
  const emptyMarkers = [
    "N/D", "NÃO ENCONTRADO", "NAO ENCONTRADO", "NÃO INFORMADO",
    "NAO INFORMADO", "INDISPONÍVEL", "INDISPONIVEL", "A DEFINIR",
    "NULL", "UNDEFINED", "NÃO LOCALIZADO", "NAO LOCALIZADO",
    "NÃO DISPONÍVEL", "NAO DISPONIVEL", "DESCONHECIDO",
  ];
  if (emptyMarkers.includes(normalized) || normalized === "") {
    return "";
  }
  return val.trim();
}

/**
 * Extrai JSON de uma resposta textual do Gemini que pode conter markdown ou texto extra.
 */
function extractJsonFromText(text: string): Record<string, unknown> | null {
  // Tenta extrair bloco ```json ... ```
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1]);
    } catch { /* fallthrough */ }
  }

  // Tenta extrair bloco { ... } diretamente
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch { /* fallthrough */ }
  }

  // Tenta parse direto
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Busca dados do município via Gemini API com Google Search Grounding.
 *
 * Usa uma chamada única com `google_search_retrieval` para permitir
 * que o Gemini faça buscas na web e retorne os dados encontrados.
 */
export async function collectGeminiData(params: {
  municipioNome: string;
  uf: string;
  prefeitoNome: string;
  exercicio: number;
}): Promise<GeminiCollectorResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[gemini-collector] GEMINI_API_KEY não configurada — pulando coleta por IA.");
    return null;
  }

  // Usa modelo estável que suporta Google Search
  const model = "gemini-3.5-flash";
  const prompt = buildSearchPrompt(params.municipioNome, params.uf, params.prefeitoNome, params.exercicio);

  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delayMs = 2000 * Math.pow(2, attempt - 1); // 2s, 4s
        console.log(`[gemini-collector] Retry ${attempt}/${MAX_RETRIES} após ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      console.log(`[gemini-collector] Chamando Gemini (${model}) com Google Search... (tentativa ${attempt + 1})`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(300_000), // 5 min
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096,
            },
            tools: [
              {
                googleSearch: {},
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error(`[gemini-collector] API retornou ${response.status}: ${errText.slice(0, 500)}`);
        // Retry em caso de 429 (rate limit), 500, 503
        if ([429, 500, 503].includes(response.status) && attempt < MAX_RETRIES) {
          continue;
        }
        return null;
      }

      const result = await response.json();
      
      // Concatenar TODAS as partes de texto (Google Search pode dividir em múltiplas parts)
      const parts = result?.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter((p: Record<string, unknown>) => typeof p.text === "string")
        .map((p: Record<string, unknown>) => p.text)
        .join("\n");

      if (!text) {
        console.warn("[gemini-collector] Resposta vazia do Gemini.");
        if (attempt < MAX_RETRIES) continue;
        return null;
      }

      console.log(`[gemini-collector] Resposta recebida (${text.length} chars). Parseando JSON...`);

      const parsed = extractJsonFromText(text);
      if (!parsed) {
        console.error("[gemini-collector] Não foi possível extrair JSON da resposta.");
        console.error("[gemini-collector] Texto recebido (primeiros 800 chars):", text.slice(0, 800));
        if (attempt < MAX_RETRIES) continue;
        return null;
      }

      const asStr = (key: string) => cleanValue(parsed[key] as string | undefined);
      const asArr = (key: string) => (Array.isArray(parsed[key]) ? (parsed[key] as string[]) : []);
      const asNum = (key: string) => (typeof parsed[key] === "number" ? (parsed[key] as number) : 0);

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
        fontesConsultadas: asArr("fontesConsultadas"),
        camposNaoEncontrados: asArr("camposNaoEncontrados"),
        confiancaGeral: asNum("confiancaGeral"),
      };

      // Contar campos preenchidos
      const camposPreenchidos = [
        collected.prefeitoCPF, collected.prefeitoRG, collected.secretarioNome,
        collected.fiscalNome, collected.assessorJuridicoNome, collected.agenteContratacaoNome,
        collected.cnpjPrefeitura, collected.cnpjFundoEducacao,
      ].filter(Boolean).length;

      console.log(
        `[gemini-collector] ${camposPreenchidos}/8 campos-chave preenchidos, confiança: ${collected.confiancaGeral}%`,
      );

      // Se poucos campos preenchidos e ainda temos retries, tentar novamente
      if (camposPreenchidos <= 2 && attempt < MAX_RETRIES) {
        console.warn(`[gemini-collector] Poucos campos (${camposPreenchidos}/8). Tentando novamente...`);
        continue;
      }

      return collected;
    } catch (error) {
      console.error(`[gemini-collector] Erro na tentativa ${attempt + 1}:`, error);
      if (attempt >= MAX_RETRIES) {
        return null;
      }
    }
  }

  return null;
}
