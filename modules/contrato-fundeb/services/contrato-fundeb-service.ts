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

const CONTRATADO_DEFAULT = {
  empresaRazaoSocial: "ROCHA PRIME SERVIÇOS ESPECIALIZADOS LTDA",
  empresaCNPJ: "29.342.691/0001-93",
  empresaEndereco: "Rua Riachão, 23, CEP: 47.970-000",
  empresaCidade: "Caripare, Riachão das Neves - BA",
  empresaCEP: "47.970-000",
  representanteNome: "Paulo Ferreira da Rocha",
  representanteCPF: "014.815.995-85",
  representanteQualificacao: "Procurador",
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

export function buildContratoEmBranco(): ContratoFundebDados {
  const now = new Date();
  const meses = QUANTIDADE_MESES_PADRAO;
  const vigenciaFim = new Date(now);
  vigenciaFim.setMonth(vigenciaFim.getMonth() + meses);

  return {
    identificacao: {
      contratoNumero: "",
      dataAssinatura: formatarData(now),
      vigenciaInicio: formatarData(now),
      vigenciaFim: formatarData(vigenciaFim),
      processoNumero: "",
    },
    contratante: {
      municipioNome: "",
      municipioEndereco: "",
      municipioCidade: "",
      municipioEstado: "",
      municipioCNPJ: "",
      municipioCEP: "",
      prefeitoNome: "",
      prefeitoNacionalidade: "brasileiro",
      prefeitoRG: "",
      prefeitoCPF: "",
      prefeitoEndereco: "",
      prefeitoCEP: "",
      fundoMunicipalNome: "",
      fundoMunicipalEndereco: "",
      fundoMunicipalCNPJ: "",
    },
    contratado: { ...CONTRATADO_DEFAULT },
    valor: {
      valorTotal: VALOR_MENSAL_PADRAO * QUANTIDADE_MESES_PADRAO,
      valorMensal: VALOR_MENSAL_PADRAO,
      quantidadeMeses: QUANTIDADE_MESES_PADRAO,
      descricaoServico: DESCRICAO_SERVICO,
    },
    dotacaoOrcamentaria: { ...DOTACAO_PADRAO },
    foro: { comarca: "", estado: "" },
  };
}

export function gerarContratoMarkdown(dados: ContratoFundebDados): string {
  const { identificacao, contratante, contratado, valor, foro } = dados;
  const dataAssinaturaDate = parseDataBR(identificacao.dataAssinatura);
  const dataExtenso = dataAssinaturaDate
    ? formatarDataExtenso(dataAssinaturaDate)
    : identificacao.dataAssinatura;

  const valorExtenso = numeroPorExtenso(valor.valorTotal);
  const valorMensalExtenso = numeroPorExtenso(valor.valorMensal);

  return `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATO: ${identificacao.contratoNumero}
DATA: ${identificacao.dataAssinatura}
VIGÊNCIA: ${identificacao.vigenciaFim}
PROCESSO: ${identificacao.processoNumero}

CONTRATO ADMINISTRATIVO DE PRESTAÇÃO DE SERVIÇOS QUE FAZEM ENTRE SI O MUNICÍPIO DE ${contratante.municipioNome.toUpperCase()} E A EMPRESA ${contratado.empresaRazaoSocial.toUpperCase()}.

O MUNICÍPIO DE ${contratante.municipioNome.toUpperCase()}, entidade de Direito Público interno, com sede à ${contratante.municipioEndereco}, ${contratante.municipioCidade} - ${contratante.municipioEstado}, inscrita no CNPJ sob o nº ${contratante.municipioCNPJ}, neste ato representado pelo Prefeito Municipal, o Sr. ${contratante.prefeitoNome}, ${contratante.prefeitoNacionalidade}, portador da Cédula de Identidade R.G. nº ${contratante.prefeitoRG} e inscrito no CPF nº ${contratante.prefeitoCPF}, residente e domiciliado na ${contratante.prefeitoEndereco}, CEP: ${contratante.prefeitoCEP}, por intermédio do ${contratante.fundoMunicipalNome}, entidade de Direito Público interno, com sede à ${contratante.fundoMunicipalEndereco}, inscrita no CNPJ sob o nº ${contratante.fundoMunicipalCNPJ}, doravante denominado CONTRATANTE, e a empresa ${contratado.empresaRazaoSocial.toUpperCase()}, inscrita no CNPJ sob o nº ${contratado.empresaCNPJ}, sediada à ${contratado.empresaEndereco}, ${contratado.empresaCidade}, neste ato representada pelo ${contratado.representanteQualificacao}, o Sr. ${contratado.representanteNome}, inscrito no CPF sob o nº ${contratado.representanteCPF}, doravante designado CONTRATADO, resolvem celebrar o presente Termo de Contrato, decorrente do Termo de Inexigibilidade nº ${identificacao.processoNumero}, mediante as cláusulas e condições a seguir enunciadas.

CLÁUSULA PRIMEIRA – OBJETO (art. 92, I e II)

1.1. O objeto do presente instrumento é: Item 01 – ${valor.descricaoServico}

1.2. Vinculam esta contratação, independentemente de transcrição:
1.2.1. O Termo de Referência;
1.2.2. A Proposta do contratado;
1.2.3. Eventuais anexos dos documentos supracitados.

CLÁUSULA SEGUNDA – VIGÊNCIA E PRORROGAÇÃO

2.1. O prazo de vigência da contratação é da seguinte forma: iniciando em ${dataExtenso} e término em ${identificacao.vigenciaFim}, podendo ser prorrogado conforme Art. 107 da Lei 14.133/21.

CLÁUSULA TERCEIRA – MODELOS DE EXECUÇÃO E GESTÃO CONTRATUAIS (art. 92, IV, VII e XVIII)

3.1. O regime de execução contratual, os modelos de gestão e de execução, assim como os prazos e condições de conclusão, entrega, observação e recebimento do objeto constam no Termo de Referência, anexo a este Contrato.

CLÁUSULA QUARTA – SUBCONTRATAÇÃO

4.1. Não será admitida a subcontratação do objeto contratual.

CLÁUSULA QUINTA – PREÇO (art. 92, V)

5.1. O valor total da contratação é de ${formatCurrency(valor.valorTotal)} (${valorExtenso}), para execução dos serviços, conforme especificação abaixo:

| Item | Descrição dos Serviços | Unid. | Quant. | V. Unit. | V. Total |
|------|------------------------|-------|--------|----------|----------|
| 1 | ${valor.descricaoServico.substring(0, 80)}... | Mês | ${valor.quantidadeMeses} | ${formatCurrency(valor.valorMensal)} | ${formatCurrency(valor.valorTotal)} |

Valor Global: ${formatCurrency(valor.valorTotal)}

5.2. No valor acima estão incluídas todas as despesas ordinárias diretas e indiretas decorrentes da execução do objeto, inclusive tributos e/ou impostos, encargos sociais, trabalhistas, previdenciários, fiscais e comerciais incidentes.

CLÁUSULA SEXTA - PAGAMENTO (art. 92, V e VI)

6.1. O pagamento será efetuado de forma mensal em ${valor.quantidadeMeses} parcelas no valor de ${formatCurrency(valor.valorMensal)} (${valorMensalExtenso}).

CLÁUSULA SÉTIMA - REAJUSTE (art. 92, V)

7.1. Os preços inicialmente contratados são fixos e irreajustáveis.

CLÁUSULA OITAVA - OBRIGAÇÕES DO CONTRATANTE (art. 92, X, XI e XIV)

8.1. São obrigações do Contratante:
8.2. Exigir o cumprimento de todas as obrigações assumidas pelo Contratado;
8.3. Receber o objeto no prazo e condições estabelecidas no Termo de Referência;
8.4. Notificar o Contratado, por escrito, sobre vícios, defeitos ou incorreções verificadas no objeto;
8.5. Acompanhar e fiscalizar a execução do contrato;
8.6. Efetuar o pagamento ao Contratado do valor correspondente à execução do objeto;
8.7. Aplicar ao Contratado as sanções previstas na lei e neste Contrato.

CLÁUSULA NONA - OBRIGAÇÕES DO CONTRATADO (art. 92, XIV, XVI e XVII)

9.1. O Contratado deve cumprir todas as obrigações constantes deste Contrato e de seus anexos, assumindo como exclusivamente seus os riscos e as despesas decorrentes da boa e perfeita execução do objeto.

CLÁUSULA DÉCIMA– GARANTIA DE EXECUÇÃO (art. 92, XII)

10.1. Não haverá exigência de garantia de execução contratual.

CLÁUSULA DÉCIMA PRIMEIRA – INFRAÇÕES E SANÇÕES ADMINISTRATIVAS (art. 92, XIV)

11.1. Comete infração administrativa, nos termos da Lei nº 14.133, de 2021, o contratado que:
a) der causa à inexecução parcial do contrato;
b) der causa à inexecução parcial do contrato que cause grave dano à Administração;
c) der causa à inexecução total do contrato;
d) ensejar o retardamento da execução ou da entrega do objeto;
e) apresentar documentação falsa ou prestar declaração falsa;
f) praticar ato fraudulento na execução do contrato;
g) comportar-se de modo inidôneo ou cometer fraude;
h) praticar ato lesivo previsto no art. 5º da Lei nº 12.846/2013.

CLÁUSULA DÉCIMA SEGUNDA – DA EXTINÇÃO CONTRATUAL (art. 92, XIX)

12.1. O contrato poderá ser extinto antes de cumpridas as obrigações, por algum dos motivos previstos no artigo 137 da Lei nº 14.133/21.

CLÁUSULA DÉCIMA TERCEIRA – DOTAÇÃO ORÇAMENTÁRIA (art. 92, VIII)

13.1. As despesas decorrentes da presente contratação correrão à conta de recursos específicos consignados no Orçamento Municipal.

CLÁUSULA DÉCIMA QUARTA – DOS CASOS OMISSOS (art. 92, III)

14.1. Os casos omissos serão decididos pelo contratante, segundo a Lei nº 14.133/2021.

CLÁUSULA DÉCIMA QUINTA – ALTERAÇÕES

15.1. Eventuais alterações contratuais reger-se-ão pela disciplina dos arts. 124 e seguintes da Lei nº 14.133/2021.

CLÁUSULA DÉCIMA SEXTA – PUBLICAÇÃO

16.1. Incumbirá ao contratante divulgar o presente instrumento no Portal Nacional de Contratações Públicas (PNCP).

CLÁUSULA DÉCIMA SÉTIMA– FORO (art. 92, §1º)

17.1. Fica eleito a Comarca de ${foro.comarca} - ${foro.estado} para dirimir os litígios que decorrerem da execução deste Termo de Contrato.

${contratante.municipioCidade} - ${contratante.municipioEstado}, ${dataExtenso}.

_______________________________
MUNICÍPIO DE ${contratante.municipioNome.toUpperCase()}
CNPJ: ${contratante.municipioCNPJ}
${contratante.prefeitoNome}
Prefeito
CONTRATANTE

_______________________________
${contratado.empresaRazaoSocial.toUpperCase()}
CNPJ: ${contratado.empresaCNPJ}
${contratado.representanteNome}
${contratado.representanteQualificacao}
CONTRATADO

TESTEMUNHAS:
1- _____________________________
2- _____________________________
`.trim();
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
  return mapa[sigla.toUpperCase()] || sigla;
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
