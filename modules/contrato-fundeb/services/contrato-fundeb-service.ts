import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
  ContratoFundebDados,
  ContratoFundebContratante,
  ContratoFundebIdentificacao,
  ContratoFundebValor,
  ContratoFundebDotacaoOrcamentaria,
  ContratoFundebForo,
  ContratoFundebCampoMeta,
  ContratoFundebCampoStatus,
} from "../types";
import type { RelatorioFundeb } from "@/modules/levantamento-fundeb/types";
import { EMPRESA, enderecoCompleto } from "@/core/domain/empresa";

const CONTRATADO_DEFAULT = {
  empresaRazaoSocial: EMPRESA.razaoSocial,
  empresaCNPJ: EMPRESA.cnpj,
  empresaEndereco: enderecoCompleto(),
  empresaCidade: `${EMPRESA.cidade} - ${EMPRESA.uf}`,
  empresaCEP: EMPRESA.cep,
  representanteNome: EMPRESA.representante.nome,
  representanteCPF: EMPRESA.representante.cpf,
  representanteQualificacao: EMPRESA.representante.qualificacao,
};

const VALOR_MENSAL_PADRAO = 27_500;
const QUANTIDADE_MESES_PADRAO = 12;

const DESCRICAO_SERVICO =
  "Contratação de empresa para prestação de serviços de consultoria técnica especializada em assessoria para elaboração e monitoramento dos programas vinculados ao Portal do Fundo Nacional da Educação – FNDE e Ministério da Educação – MEC, nas condições estabelecidas no Termo de Referência.";

const DOTACAO_PADRAO: ContratoFundebDotacaoOrcamentaria = {
  unidadesExecutoras: [
    "04.01 SECRETARIA DE EDUCAÇÃO, CULTURA, ESPORTES E LAZER",
    "04.02 FUNDO MUNICIPAL DE EDUCAÇÃO",
  ],
  funcionais: [
    "12.361.0003-2.009 Manutenção das Atividades do Ensino Básico",
    "12.361.0003-2.022 Capacitação de Profissionais da Educação",
    "12.361.0003-4.009 Gestão dos Recursos de Precatórios – FUNDEF",
    "12.365.0003-2.008 Manutenção das Atividades do Ensino Infantil",
    "12.361.0003-2.010 Manutenção do Ensino Fundamental - FUNDEB 30%",
    "12.361.0003-2.047 Formação de Profissionais do Magistério - FUNDEB 30%",
    "12.365.0003-2.074 Gestão das Ações da Educação Infantil - FUNDEB 30%",
  ],
  elementoDespesa: "3.3.90.39.00 Outros Serviços de Terceiros - Pessoa Jurídica",
  fontesRecursos: [
    "1500.1001 25% - Educação",
    "1550.0000 Transferência do Salário-Educação",
    "1544.0000 Recursos de Precatórios do FUNDEF",
    "1540.0000 Transferências do FUNDEB - Impostos e Transferências de Impostos",
  ],
};

const FORO_POR_UF: Record<string, { comarca: string; estado: string }> = {
  BA: { comarca: "Santa Maria da Vitória", estado: "BA" },
};

function campo(
  campo: string,
  label: string,
  valor: string,
  fonte: string,
): ContratoFundebCampoMeta {
  const status: ContratoFundebCampoStatus = valor
    ? fonte === "manual"
      ? "preenchido_manual"
      : "preenchido_automatico"
    : "vazio";
  return { campo, label, status, fonte, valor };
}

function formatarData(data: Date): string {
  return format(data, "dd.MM.yyyy");
}

function formatarDataExtenso(data: Date): string {
  return format(data, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

function inferirForo(uf: string): ContratoFundebForo {
  const entrada = FORO_POR_UF[uf.toUpperCase()];
  if (entrada) {
    return entrada;
  }
  return { comarca: "A ser definida", estado: uf.toUpperCase() };
}

function inferirNumeroContrato(exercicio: number): string {
  return `001/${exercicio}`;
}

function inferirNumeroProcesso(exercicio: number): string {
  return `IL001/${exercicio}`;
}

function inferirVigencia(dataAssinatura: Date, meses: number): string {
  const termino = new Date(dataAssinatura);
  termino.setMonth(termino.getMonth() + meses);
  return formatarData(termino);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

export function buildContratoFromLevantamento(
  relatorio: RelatorioFundeb,
  opcoes?: {
    valorMensal?: number;
    quantidadeMeses?: number;
    dataAssinatura?: string;
    contratoNumero?: string;
    processoNumero?: string;
    prefeitoRG?: string;
    prefeitoEndereco?: string;
    municipioEndereco?: string;
    municipioCNPJ?: string;
    municipioCEP?: string;
    fundoMunicipalCNPJ?: string;
    comarca?: string;
  },
): { contrato: ContratoFundebDados; metas: ContratoFundebCampoMeta[] } {
  const id = relatorio.identificacao;
  const exercicio = id.exercicio || new Date().getFullYear();
  const valorMensal = opcoes?.valorMensal ?? VALOR_MENSAL_PADRAO;
  const meses = opcoes?.quantidadeMeses ?? QUANTIDADE_MESES_PADRAO;
  const dataAssinatura = opcoes?.dataAssinatura
    ? new Date(opcoes.dataAssinatura)
    : new Date();
  const metas: ContratoFundebCampoMeta[] = [];

  const prefeitoNome = id.prefeito || "";
  metas.push(campo("prefeitoNome", "Prefeito(a)", prefeitoNome, "levantamento-fundeb"));

  const municipioCNPJ = opcoes?.municipioCNPJ || "";
  metas.push(campo("municipioCNPJ", "CNPJ do Município", municipioCNPJ, municipioCNPJ ? "manual" : "indisponivel"));

  const municipioEndereco = opcoes?.municipioEndereco || "";
  metas.push(campo("municipioEndereco", "Endereço do Município", municipioEndereco, municipioEndereco ? "manual" : "indisponivel"));

  const municipioCEP = opcoes?.municipioCEP || "";
  metas.push(campo("municipioCEP", "CEP do Município", municipioCEP, municipioCEP ? "manual" : "indisponivel"));

  const prefeitoRG = opcoes?.prefeitoRG || "";
  metas.push(campo("prefeitoRG", "RG do Prefeito", prefeitoRG, prefeitoRG ? "manual" : "indisponivel"));

  const prefeitoEndereco = opcoes?.prefeitoEndereco || "";
  metas.push(campo("prefeitoEndereco", "Endereço do Prefeito", prefeitoEndereco, prefeitoEndereco ? "manual" : "indisponivel"));

  const fundoMunicipalCNPJ = opcoes?.fundoMunicipalCNPJ || "";
  metas.push(campo("fundoMunicipalCNPJ", "CNPJ do Fundo Municipal", fundoMunicipalCNPJ, fundoMunicipalCNPJ ? "manual" : "indisponivel"));

  const estadoNome = estadoBySigla(id.uf) || id.uf;
  const contratoNumero =
    opcoes?.contratoNumero || inferirNumeroContrato(exercicio);
  const processoNumero =
    opcoes?.processoNumero || inferirNumeroProcesso(exercicio);
  const vigenciaFim = inferirVigencia(dataAssinatura, meses);
  const foro = opcoes?.comarca
    ? { comarca: opcoes.comarca, estado: id.uf }
    : inferirForo(id.uf);

  const identificacao: ContratoFundebIdentificacao = {
    contratoNumero,
    dataAssinatura: formatarData(dataAssinatura),
    vigenciaInicio: formatarData(dataAssinatura),
    vigenciaFim,
    processoNumero,
  };

  metas.push(campo("contratoNumero", "Número do Contrato", contratoNumero, opcoes?.contratoNumero ? "manual" : "auto-inferido"));
  metas.push(campo("dataAssinatura", "Data de Assinatura", identificacao.dataAssinatura, opcoes?.dataAssinatura ? "manual" : "auto-inferido"));
  metas.push(campo("processoNumero", "Número do Processo", processoNumero, opcoes?.processoNumero ? "manual" : "auto-inferido"));

  const contratante: ContratoFundebContratante = {
    municipioNome: id.municipioNome || id.municipio || "",
    municipioEndereco,
    municipioCidade: id.municipioNome || id.municipio || "",
    municipioEstado: estadoNome,
    municipioCNPJ,
    municipioCEP,
    prefeitoNome,
    prefeitoNacionalidade: "brasileiro",
    prefeitoRG,
    prefeitoCPF: "",
    prefeitoEndereco,
    prefeitoCEP: municipioCEP,
    fundoMunicipalNome: `Fundo Municipal de Educação de ${id.municipioNome || id.municipio || ""}`,
    fundoMunicipalEndereco: municipioEndereco,
    fundoMunicipalCNPJ,
  };

  const valor: ContratoFundebValor = {
    valorTotal: valorMensal * meses,
    valorMensal,
    quantidadeMeses: meses,
    descricaoServico: DESCRICAO_SERVICO,
  };

  metas.push(campo("valorTotal", "Valor Total", formatCurrency(valor.valorTotal), "auto-calculado"));
  metas.push(campo("valorMensal", "Valor Mensal", formatCurrency(valor.valorMensal), opcoes?.valorMensal ? "manual" : "padrao"));

  const contrato: ContratoFundebDados = {
    identificacao,
    contratante,
    contratado: CONTRATADO_DEFAULT,
    valor,
    dotacaoOrcamentaria: DOTACAO_PADRAO,
    foro,
  };

  return { contrato, metas };
}

function estadoBySigla(sigla: string): string {
  const mapa: Record<string, string> = {
    AC: "Acre",
    AL: "Alagoas",
    AM: "Amazonas",
    AP: "Amapá",
    BA: "Bahia",
    CE: "Ceará",
    DF: "Distrito Federal",
    ES: "Espírito Santo",
    GO: "Goiás",
    MA: "Maranhão",
    MG: "Minas Gerais",
    MS: "Mato Grosso do Sul",
    MT: "Mato Grosso",
    PA: "Pará",
    PB: "Paraíba",
    PE: "Pernambuco",
    PI: "Piauí",
    PR: "Paraná",
    RJ: "Rio de Janeiro",
    RN: "Rio Grande do Norte",
    RO: "Rondônia",
    RR: "Roraima",
    RS: "Rio Grande do Sul",
    SC: "Santa Catarina",
    SE: "Sergipe",
    SP: "São Paulo",
    TO: "Tocantins",
  };
  // A UF pode não vir: o kit é emitido a partir de fichas de cidade que às
  // vezes só têm o nome. Antes isso estourava `toUpperCase of undefined` lá
  // dentro do gerador e derrubava o kit inteiro por causa de duas letras.
  const normalizada = String(sigla ?? "").trim();
  return mapa[normalizada.toUpperCase()] || normalizada;
}

function parseDataBR(dataBR: string): Date | null {
  const partes = dataBR.split(".");
  if (partes.length !== 3) return null;
  const [dia, mes, ano] = partes.map(Number);
  if (!dia || !mes || !ano) return null;
  return new Date(ano, mes - 1, dia);
}

function numeroPorExtenso(valor: number): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const extenso = require("numero-por-extenso");
    return extenso.porExtenso(valor, extenso.estilo.monetario);
  } catch {
    return `${formatCurrency(valor)}`;
  }
}

export { formatCurrency, formatarData, formatarDataExtenso, estadoBySigla, CONTRATADO_DEFAULT, DESCRICAO_SERVICO, DOTACAO_PADRAO, VALOR_MENSAL_PADRAO, QUANTIDADE_MESES_PADRAO };
