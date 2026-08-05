/**
 * Defaults Collector — Valores fixos da empresa contratada e constantes legais
 */

import { EMPRESA } from "@/core/domain/empresa";

interface DefaultsCollectorResult {
  // Empresa (Contratado)
  empresaRazaoSocial: string;
  empresaCNPJ: string;
  empresaEndereco: string;
  empresaCidade: string;
  empresaUF: string;
  empresaCEP: string;
  representanteNome: string;
  representanteCPF: string;
  representanteRG: string;
  representanteOrgaoExp: string;
  representanteNacionalidade: string;
  representanteEstadoCivil: string;
  representanteQualificacao: string;

  // Constantes legais
  baseLegal: string;
  percentualInsumos: number;
  percentualPessoal: number;
  fiscalCargo: string;

  // Financeiro padrão
  valorMensal: number;
  quantidadeMeses: number;

  // Dotação padrão (pode ser sobrescrita pelo Gemini)
  dotacaoUnidade: string;
  dotacaoAtividade: string;
  dotacaoElemento: string;
  dotacaoFonte: string;
}

/**
 * Retorna todos os valores fixos/padrão do contrato.
 * Os dados da empresa são constantes; dotação é um padrão genérico que
 * pode ser sobrescrito pelo GeminiCollector se encontrar a LOA real.
 */
export function collectDefaults(opcoes?: {
  valorMensal?: number;
  quantidadeMeses?: number;
}): DefaultsCollectorResult {
  return {
    // Empresa contratada — fonte única em core/domain/empresa.ts
    empresaRazaoSocial: EMPRESA.razaoSocial,
    empresaCNPJ: EMPRESA.cnpj,
    empresaEndereco: EMPRESA.endereco,
    empresaCidade: EMPRESA.cidade,
    empresaUF: EMPRESA.uf,
    empresaCEP: EMPRESA.cep,
    representanteNome: EMPRESA.representante.nome,
    representanteCPF: EMPRESA.representante.cpf,
    representanteRG: EMPRESA.representante.rg,
    representanteOrgaoExp: EMPRESA.representante.orgaoExpedidor,
    representanteNacionalidade: EMPRESA.representante.nacionalidade,
    representanteEstadoCivil: EMPRESA.representante.estadoCivil,
    representanteQualificacao: EMPRESA.representante.qualificacao,

    // Constantes legais
    baseLegal: `Art. 74, inciso III, alínea "f", da Lei Federal nº 14.133/2021`,
    percentualInsumos: 40,
    percentualPessoal: 60,
    fiscalCargo: "Servidor Público",

    // Financeiro
    valorMensal: opcoes?.valorMensal ?? 27500,
    quantidadeMeses: opcoes?.quantidadeMeses ?? 12,

    // Dotação padrão genérica (FUNDEB)
    dotacaoUnidade: "SECRETARIA MUNICIPAL DE EDUCAÇÃO",
    dotacaoAtividade: "Manutenção das Atividades do Ensino Básico",
    dotacaoElemento: "3.3.90.39.00 Outros Serviços de Terceiros - Pessoa Jurídica",
    dotacaoFonte: "1540.0000 Transferências do FUNDEB - Impostos e Transferências de Impostos",
  };
}
