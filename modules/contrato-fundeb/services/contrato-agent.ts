/**
 * Contrato Agent — Orquestrador principal do agente de IA para preenchimento
 * autônomo de contratos FUNDEB.
 *
 * Recebe apenas município + UF e coordena todos os coletores para preencher
 * os 64 campos do ContratosFundebData automaticamente.
 */

import type {
  ContratosFundebData,
  ContratoFundebCampoMeta,
  ContratoFundebCampoStatus,
} from "../types";
import { collectIbgeData } from "./collectors/ibge-collector";
import { collectTseData } from "./collectors/tse-collector";
import { collectDefaults } from "./collectors/defaults-collector";
import { collectComputedFields } from "./collectors/computed-collector";
import { collectCnpjData, validateAndEnrichCnpj } from "./collectors/cnpj-collector";
import { collectGeminiData } from "./collectors/gemini-collector";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ContratoAgentInput {
  municipioNome: string;
  uf: string;
  codigoIBGE?: string;
  exercicio?: number;
  valorMensal?: number;
  quantidadeMeses?: number;
  /** Se true, pula a busca por IA (Gemini) — útil para testes rápidos */
  skipGemini?: boolean;
}

export interface ContratoAgentOutput {
  success: boolean;
  contrato: ContratosFundebData;
  metas: ContratoFundebCampoMeta[];
  stats: {
    total: number;
    preenchidoAutomatico: number;
    preenchidoIA: number;
    vazio: number;
    percentualPreenchido: number;
  };
  warnings: string[];
  tempoExecucaoMs: number;
  geminiConfianca: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function meta(
  campo: string,
  label: string,
  valor: string | number,
  fonte: string,
): ContratoFundebCampoMeta {
  const valorStr = String(valor ?? "");
  let status: ContratoFundebCampoStatus;
  if (!valorStr) {
    status = "vazio";
  } else if (fonte.startsWith("gemini")) {
    status = "preenchido_automatico";
  } else if (fonte === "manual" || fonte === "indisponivel") {
    status = fonte === "manual" ? "preenchido_manual" : "indisponivel";
  } else {
    status = "preenchido_automatico";
  }
  return { campo, label, status, fonte, valor: valorStr };
}

// ── Agent Orchestrator ─────────────────────────────────────────────────────

/**
 * Executa o agente de IA para preenchimento autônomo do contrato FUNDEB.
 *
 * Fluxo:
 *  1. IBGE → resolve município oficial
 *  2. TSE → identifica prefeito
 *  3. Gemini → busca dados públicos (RG, CPF, secretário, fiscal, CNPJs, dotação)
 *  4. CNPJ → enriquece/valida CNPJs encontrados pelo Gemini
 *  5. Defaults → valores fixos da empresa e constantes legais
 *  6. Computed → cálculos financeiros e datas cronológicas
 *  7. Merge → consolida tudo em ContratosFundebData
 */
export async function executeContratoAgent(
  input: ContratoAgentInput,
): Promise<ContratoAgentOutput> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const metas: ContratoFundebCampoMeta[] = [];
  const exercicio = input.exercicio || new Date().getFullYear();

  // ── 1. IBGE ──────────────────────────────────────────────────────────
  console.log(`[contrato-agent] Iniciando para ${input.municipioNome}/${input.uf}...`);

  const ibge = await collectIbgeData({
    municipioNome: input.municipioNome,
    uf: input.uf,
    codigoIBGE: input.codigoIBGE,
  });

  if (!ibge) {
    return {
      success: false,
      contrato: {} as ContratosFundebData,
      metas: [],
      stats: { total: 0, preenchidoAutomatico: 0, preenchidoIA: 0, vazio: 0, percentualPreenchido: 0 },
      warnings: [`Município "${input.municipioNome}/${input.uf}" não encontrado na base do IBGE.`],
      tempoExecucaoMs: Date.now() - startTime,
      geminiConfianca: null,
    };
  }

  metas.push(meta("municipioNome", "Nome do Município", ibge.municipioNome, "IBGE API"));
  metas.push(meta("municipioUF", "UF", ibge.municipioUF, "IBGE API"));
  console.log(`[contrato-agent] IBGE: ${ibge.municipioNome}/${ibge.municipioUF} (${ibge.codigoIBGE})`);

  // ── 2. TSE ───────────────────────────────────────────────────────────
  const tse = collectTseData(ibge.codigoIBGE);
  const prefeitoNome = tse?.prefeitoNome || "";
  metas.push(meta("prefeitoNome", "Prefeito(a)", prefeitoNome, tse ? "TSE 2024" : "indisponivel"));
  if (!tse) {
    warnings.push("Prefeito não localizado na base eleitoral TSE 2024.");
  } else {
    console.log(`[contrato-agent] TSE: Prefeito ${prefeitoNome} (${tse.partido})`);
  }

  // ── 3. Gemini (IA) + CNPJ (paralelo) ─────────────────────────────────
  // Rodam em paralelo para economizar tempo:
  //  - Gemini busca secretário, fiscal, assessor, dotação, CPF/RG do prefeito
  //  - CNPJ Collector busca CNPJ/endereço/CEP da Prefeitura e FME por nome
  let gemini: Awaited<ReturnType<typeof collectGeminiData>> = null;
  let cnpjData: Awaited<ReturnType<typeof collectCnpjData>> = {
    prefeitura: null,
    fundoEducacao: null,
  };

  const geminiPromise = !input.skipGemini
    ? (async () => {
        console.log("[contrato-agent] Iniciando busca por IA (Gemini + Google Search)...");
        return collectGeminiData({
          municipioNome: ibge.municipioNome,
          uf: ibge.municipioUF,
          prefeitoNome,
          exercicio,
        });
      })()
    : Promise.resolve(null);

  // CNPJ Collector SEMPRE roda — busca por nome do município, independente do Gemini
  const cnpjPromise = (async () => {
    console.log("[contrato-agent] Buscando CNPJs por nome do município...");
    return collectCnpjData({
      municipioNome: ibge.municipioNome,
      uf: ibge.municipioUF,
    });
  })();

  // Aguarda ambos em paralelo
  const [geminiResult, cnpjResult] = await Promise.all([geminiPromise, cnpjPromise]);
  gemini = geminiResult;
  cnpjData = cnpjResult;

  if (gemini) {
    console.log(`[contrato-agent] Gemini: confiança ${gemini.confiancaGeral}%, ${gemini.camposNaoEncontrados.length} campos não encontrados`);
    if (gemini.camposNaoEncontrados.length > 0) {
      warnings.push(
        `Gemini não localizou: ${gemini.camposNaoEncontrados.join(", ")}. Esses campos precisam de preenchimento manual.`,
      );
    }

    // Se Gemini encontrou CNPJs que o collector não achou, validar e enriquecer
    if (!cnpjData.prefeitura && gemini.cnpjPrefeitura) {
      console.log("[contrato-agent] Validando CNPJ da Prefeitura encontrado pelo Gemini...");
      cnpjData.prefeitura = await validateAndEnrichCnpj(gemini.cnpjPrefeitura);
    }
    if (!cnpjData.fundoEducacao && gemini.cnpjFundoEducacao) {
      console.log("[contrato-agent] Validando CNPJ do FME encontrado pelo Gemini...");
      cnpjData.fundoEducacao = await validateAndEnrichCnpj(gemini.cnpjFundoEducacao);
    }
  } else if (!input.skipGemini) {
    warnings.push(
      "Busca por IA (Gemini) indisponível — dados do prefeito, secretário e fiscal não foram preenchidos automaticamente.",
    );
  }

  // ── 4. Consolidar dados de CNPJ ────────────────────────────────────────
  const municipioCNPJ = cnpjData.prefeitura?.cnpj || gemini?.cnpjPrefeitura || "";
  const municipioEndereco = cnpjData.prefeitura?.endereco || "";
  const municipioCEP = cnpjData.prefeitura?.cep || "";
  const fundoCNPJ = cnpjData.fundoEducacao?.cnpj || gemini?.cnpjFundoEducacao || "";

  metas.push(meta("municipioCNPJ", "CNPJ da Prefeitura", municipioCNPJ, municipioCNPJ ? (cnpjData.prefeitura ? "BrasilAPI" : "gemini") : "indisponivel"));
  metas.push(meta("municipioEndereco", "Endereço da Prefeitura", municipioEndereco, municipioEndereco ? "BrasilAPI" : "indisponivel"));
  metas.push(meta("municipioCEP", "CEP da Prefeitura", municipioCEP, municipioCEP ? "BrasilAPI" : "indisponivel"));
  metas.push(meta("fundoCNPJ", "CNPJ do Fundo de Educação", fundoCNPJ, fundoCNPJ ? (cnpjData.fundoEducacao ? "BrasilAPI" : "gemini") : "indisponivel"));

  if (!municipioCNPJ) warnings.push("CNPJ da Prefeitura não localizado — preencha manualmente.");
  if (!fundoCNPJ) warnings.push("CNPJ do Fundo Municipal de Educação não localizado — preencha manualmente.");

  // ── 5. Defaults ──────────────────────────────────────────────────────
  const defaults = collectDefaults({
    valorMensal: input.valorMensal,
    quantidadeMeses: input.quantidadeMeses,
  });

  // ── 6. Computed ──────────────────────────────────────────────────────
  const computed = collectComputedFields({
    exercicio,
    municipioNome: ibge.municipioNome,
    municipioUF: ibge.municipioUF,
    valorMensal: defaults.valorMensal,
    quantidadeMeses: defaults.quantidadeMeses,
  });

  // ── 7. Merge — Consolidar tudo ───────────────────────────────────────

  // Dados do prefeito via Gemini (com fallback para vazio)
  const prefeitoCPF = gemini?.prefeitoCPF || "";
  const prefeitoRG = gemini?.prefeitoRG ? `${gemini.prefeitoRG}${gemini.prefeitoRGOrgao ? ` ${gemini.prefeitoRGOrgao}` : ""}` : "";
  const prefeitoEstadoCivil = gemini?.prefeitoEstadoCivil || computed.prefeitoEstadoCivil;
  const prefeitoEndereco = gemini?.prefeitoEndereco || "";

  metas.push(meta("prefeitoCPF", "CPF do Prefeito", prefeitoCPF, prefeitoCPF ? "gemini-diario-oficial" : "indisponivel"));
  metas.push(meta("prefeitoRG", "RG do Prefeito", prefeitoRG, prefeitoRG ? "gemini-diario-oficial" : "indisponivel"));
  metas.push(meta("prefeitoEndereco", "Endereço do Prefeito", prefeitoEndereco, prefeitoEndereco ? "gemini-diario-oficial" : "indisponivel"));

  // Secretário de Educação
  const secretarioNome = gemini?.secretarioNome || "";
  const secretarioDecreto = gemini?.secretarioDecreto || "";
  metas.push(meta("secretarioNome", "Secretário(a) de Educação", secretarioNome, secretarioNome ? "gemini-diario-oficial" : "indisponivel"));
  metas.push(meta("secretarioDecreto", "Decreto do Secretário", secretarioDecreto, secretarioDecreto ? "gemini-diario-oficial" : "indisponivel"));

  // Fiscal de Contratos
  const fiscalNome = gemini?.fiscalNome || "";
  const fiscalPortaria = gemini?.fiscalPortaria || "";
  const fiscalCargo = gemini?.fiscalCargo || defaults.fiscalCargo;
  metas.push(meta("fiscalNome", "Fiscal de Contratos", fiscalNome, fiscalNome ? "gemini-diario-oficial" : "indisponivel"));
  metas.push(meta("fiscalPortaria", "Portaria do Fiscal", fiscalPortaria, fiscalPortaria ? "gemini-diario-oficial" : "indisponivel"));

  // Assessor Jurídico
  const assessorJuridicoNome = gemini?.assessorJuridicoNome || "";
  const assessorJuridicoOAB = gemini?.assessorJuridicoOAB || "";
  metas.push(meta("assessorJuridicoNome", "Assessor Jurídico", assessorJuridicoNome, assessorJuridicoNome ? "gemini-diario-oficial" : "indisponivel"));
  metas.push(meta("assessorJuridicoOAB", "OAB do Assessor", assessorJuridicoOAB, assessorJuridicoOAB ? "gemini-diario-oficial" : "indisponivel"));

  // Agente de Contratação
  const agenteContratacaoNome = gemini?.agenteContratacaoNome || "";
  const agenteContratacaoDecreto = gemini?.agenteContratacaoDecreto || "";
  metas.push(meta("agenteContratacaoNome", "Agente de Contratação", agenteContratacaoNome, agenteContratacaoNome ? "gemini-diario-oficial" : "indisponivel"));
  metas.push(meta("agenteContratacaoDecreto", "Decreto do Agente", agenteContratacaoDecreto, agenteContratacaoDecreto ? "gemini-diario-oficial" : "indisponivel"));

  // Dotação — usa Gemini se encontrou, senão usa default
  const dotacaoUnidade = gemini?.dotacaoUnidade || defaults.dotacaoUnidade;
  const dotacaoAtividade = gemini?.dotacaoAtividade || defaults.dotacaoAtividade;
  const dotacaoElemento = gemini?.dotacaoElemento || defaults.dotacaoElemento;
  const dotacaoFonte = gemini?.dotacaoFonte || defaults.dotacaoFonte;

  metas.push(meta("dotacaoUnidade", "Unidade Orçamentária", dotacaoUnidade, gemini?.dotacaoUnidade ? "gemini-LOA" : "padrao-fundeb"));
  metas.push(meta("dotacaoAtividade", "Atividade Orçamentária", dotacaoAtividade, gemini?.dotacaoAtividade ? "gemini-LOA" : "padrao-fundeb"));
  metas.push(meta("dotacaoElemento", "Elemento de Despesa", dotacaoElemento, gemini?.dotacaoElemento ? "gemini-LOA" : "padrao-fundeb"));
  metas.push(meta("dotacaoFonte", "Fonte de Recurso", dotacaoFonte, gemini?.dotacaoFonte ? "gemini-LOA" : "padrao-fundeb"));

  if (!gemini?.dotacaoUnidade) {
    warnings.push("Dotação orçamentária não localizada na LOA — usando padrão genérico FUNDEB. Confirme com a contadoria do município.");
  }

  // ── Montar ContratosFundebData final ─────────────────────────────────
  const contrato: ContratosFundebData = {
    // Processo
    processoNumero: computed.processoNumero,
    inexigibilidadeNumero: computed.inexigibilidadeNumero,
    contratoNumero: computed.contratoNumero,
    exercicio,
    baseLegal: defaults.baseLegal,
    dataProcesso: computed.dataProcesso,

    // Contratante (Município)
    municipioNome: ibge.municipioNome,
    municipioCNPJ,
    municipioEndereco,
    municipioCEP,
    municipioUF: ibge.municipioUF,
    fundoCNPJ,
    fundoNome: computed.fundoNome,
    prefeitoNome,
    prefeitoNacionalidade: computed.prefeitoNacionalidade,
    prefeitoRG,
    prefeitoCPF,
    prefeitoEstadoCivil,
    prefeitoEndereco,

    // Agentes
    secretarioNome,
    secretarioDecreto,
    fiscalNome,
    fiscalPortaria,
    fiscalCargo,
    assessorJuridicoNome,
    assessorJuridicoOAB,
    agenteContratacaoNome,
    agenteContratacaoDecreto,

    // Empresa (Contratado)
    empresaRazaoSocial: defaults.empresaRazaoSocial,
    empresaCNPJ: defaults.empresaCNPJ,
    empresaEndereco: defaults.empresaEndereco,
    empresaCidade: defaults.empresaCidade,
    empresaUF: defaults.empresaUF,
    empresaCEP: defaults.empresaCEP,
    representanteNome: defaults.representanteNome,
    representanteCPF: defaults.representanteCPF,
    representanteRG: defaults.representanteRG,
    representanteOrgaoExp: defaults.representanteOrgaoExp,
    representanteNacionalidade: defaults.representanteNacionalidade,
    representanteEstadoCivil: defaults.representanteEstadoCivil,
    representanteQualificacao: defaults.representanteQualificacao,

    // Financeiro
    valorMensal: defaults.valorMensal,
    quantidadeMeses: defaults.quantidadeMeses,
    valorGlobal: computed.valorGlobal,
    valorMensalExtenso: computed.valorMensalExtenso,
    valorGlobalExtenso: computed.valorGlobalExtenso,
    percentualInsumos: defaults.percentualInsumos,
    percentualPessoal: defaults.percentualPessoal,

    // Dotação
    dotacaoUnidade,
    dotacaoAtividade,
    dotacaoElemento,
    dotacaoFonte,

    // Foro
    foroComarca: computed.foroComarca,
    foroUF: computed.foroUF,

    // Datas
    dataSolicitacao: computed.dataSolicitacao,
    dataParecerJuridico: computed.dataParecerJuridico,
    dataRatificacao: computed.dataRatificacao,
    dataHomologacao: computed.dataHomologacao,
    dataAssinatura: computed.dataAssinatura,
    vigenciaInicio: computed.vigenciaInicio,
    vigenciaFim: computed.vigenciaFim,
  };

  // ── Estatísticas ─────────────────────────────────────────────────────
  const camposContrato = Object.entries(contrato);
  const total = camposContrato.length;
  const preenchidos = camposContrato.filter(
    ([, v]) => v !== "" && v !== null && v !== undefined,
  ).length;
  const preenchidoIA = metas.filter(
    (m) => m.fonte.startsWith("gemini") && m.valor !== "",
  ).length;
  const vazios = total - preenchidos;

  const tempoExecucaoMs = Date.now() - startTime;
  console.log(
    `[contrato-agent] Concluído em ${tempoExecucaoMs}ms — ${preenchidos}/${total} campos preenchidos (${preenchidoIA} via IA, ${vazios} vazios)`,
  );

  return {
    success: true,
    contrato,
    metas,
    stats: {
      total,
      preenchidoAutomatico: preenchidos - preenchidoIA,
      preenchidoIA,
      vazio: vazios,
      percentualPreenchido: Math.round((preenchidos / total) * 100),
    },
    warnings,
    tempoExecucaoMs,
    geminiConfianca: gemini?.confiancaGeral ?? null,
  };
}
