import {
  AlignmentType,
  Document,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  WidthType,
} from "docx";
import type { Company } from "@/core/domain/organization";
import type { EmpresaConfig, PropostaFormData } from "../types";
import {
  buildCompanyAddress,
  buildEmitterConfig,
  createBulletedParagraph,
  createCellBorders,
  createParagraph,
  createProposalHeader,
  createStandardFooter,
  createStandardSection,
  formatCurrency,
  formatDateLong,
  formatPercent,
  monetaryExtenso,
  numberExtenso,
  resolveGenderTerms,
  sanitizeFileName,
  toUpper,
} from "./document-helpers";
import { calculateHonorarios } from "./proposta-calculos";

function createResumoCell(
  text: string,
  options?: {
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    fill?: string;
    width?: number;
    span?: number;
  },
) {
  return new TableCell({
    columnSpan: options?.span,
    width: options?.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options?.fill ? { fill: options.fill } : undefined,
    borders: createCellBorders(),
    children: [
      createParagraph(text, {
        align: options?.align ?? AlignmentType.LEFT,
        bold: options?.bold,
        spacingAfter: 40,
      }),
    ],
  });
}

function createSectionTitle(text: string) {
  return createParagraph(text, {
    bold: true,
    spacingBefore: 60,
    spacingAfter: 120,
  });
}

function buildObjetoParagraphs(municipioUpper: string) {
  return [
    createParagraph(
      `CONTRATAÇÃO DE PESSOA JURÍDICA PARA PRESTAÇÃO DE SERVIÇOS TÉCNICOS ESPECIALIZADOS VISANDO: ASSESSORAR O MUNICÍPIO NA GESTÃO, REGULARIZAÇÃO E REESTRUTURAÇÃO DOS SISTEMAS DO MINISTÉRIO DA EDUCAÇÃO (MEC) E DO FUNDO NACIONAL DE DESENVOLVIMENTO DA EDUCAÇÃO (FNDE), MEDIANTE A ANÁLISE E CORREÇÃO DE DADOS CADASTRAIS NO SIMEC (Sistema Integrado do MEC), SIGPC (Sistema de Gestão de Prestação de Contas), SIGARP (Sistema de Gerenciamento de Adesão a Registro de Preços) E HABILITA-FNDE, A REESTRUTURAÇÃO DO CENSO ESCOLAR E A RECUPERAÇÃO DE REPASSES DO FUNDEB E PROGRAMAS DO FNDE, VISANDO À MAXIMIZAÇÃO DOS RECURSOS FEDERAIS DESTINADOS À EDUCAÇÃO DO MUNICÍPIO DE ${municipioUpper}.`,
    ),
    createParagraph(
      `DEVERÁ A EMPRESA EFETUAR LEVANTAMENTO DOS CRÉDITOS A QUE FAZ JUS O MUNICÍPIO, REFERENTES AOS REPASSES NÃO RECEBIDOS OU MAL DIMENSIONADOS PELO FNDE, CONFORME OS PRAZOS E REGRAS ESTABELECIDOS NA LEGISLAÇÃO VIGENTE, PODENDO PARA TANTO REPRESENTAR ADMINISTRATIVAMENTE O MUNICÍPIO DE ${municipioUpper} PERANTE O FNDE, O MEC E DEMAIS ÓRGÃOS FEDERAIS, EM TODOS OS PROCESSOS, RECLAMAÇÕES, RECURSOS E DEMAIS ATOS DECORRENTES DE SUAS COMPETÊNCIAS, conforme especificações técnicas contidas neste projeto de serviços.`,
        { spacingAfter: 180 },
    ),
  ];
}

function buildServicosParagraphs() {
  return [
    "2.1. Assessoria especializada destinada a dar assistência e suporte técnico na regularização e atualização dos sistemas corporativos do FNDE, incluindo SIMEC, SIGPC, SIGARP e HABILITA-FNDE, garantindo a correta habilitação da entidade para recebimento de transferências voluntárias de recursos federais.",
    "2.2. Assessoramento especializado no suporte técnico para reestruturação e correção dos dados do Censo Escolar, visando à correta contabilização das matrículas e ao aumento da arrecadação do FUNDEB (Fundo de Manutenção e Desenvolvimento da Educação Básica).",
    "2.3. Assessoria técnica para destravamento e acompanhamento de obras paralisadas dos programas PAR (Plano de Ações Articuladas) e PAC (Programa de Aceleração do Crescimento), incluindo regularização de prestação de contas e liberação de novos repasses.",
    "2.4. Assessoramento especializado na regularização de adesões aos programas Caminho da Escola (aquisição de ônibus, lanchas e bicicletas escolares) e Mobiliário Escolar, garantindo o correto cadastramento de demandas e acesso aos recursos disponíveis.",
    "2.5. Assessoria e suporte técnico para acompanhamento das prestações de contas dos programas do FNDE, visando a regularização de pendências e o sucesso na liberação de novos recursos.",
    "2.6. Assessoramento especializado na análise e recuperação de repasses do Programa Educação Integral (EI Manutenção), identificando e corrigindo falhas cadastrais que impeçam o recebimento dos valores devidos.",
    "2.7. Assessoria técnica para elaboração de pareceres, cálculos e atualizações de valores, conforme legislação específica do FNDE, para recuperação de créditos referentes a diferenças de repasses do FUNDEB e demais programas federais.",
    "2.8. Assessorar no levantamento de dados, diagnóstico, acompanhamento, elaboração de pareceres e atualizações cadastrais para correção de inconsistências no PDDE (Programa Dinheiro Direto na Escola) e demais sistemas vinculados ao FNDE.",
    "2.9. Assessoria especializada no atendimento a diligências, notificações e processos de Tomada de Contas Especial (TCE) instaurados pelo FNDE, com fulcro de anular ou reduzir os valores de tais cobranças. Vale salientar que o pagamento dos honorários recairá sobre o valor efetivamente reduzido e/ou anulado em relação à cobrança original.",
    "2.10. Assessorar na análise do cálculo das estimativas de repasses do FUNDEB apresentado pelo FNDE, verificando a correta aplicação dos coeficientes e a integralidade dos valores devidos ao município.",
    "2.11. Bem como no auxílio da apresentação de estudo contendo a metodologia dos cálculos, sua justificativa legal e a memória de cálculo para recuperação de valores.",
    "2.12. Assessoria na gestão de petições e acompanhamento dos processos junto ao FNDE, MEC e demais órgãos federais responsáveis pela transferência de recursos à educação.",
    "2.13. Assessoria na realização de estudo e diagnóstico relacionados ao compartilhamento de infraestrutura escolar e análise dos respectivos convênios e termos de colaboração.",
    "2.14. Assessorar e assegurar que todas as unidades escolares sejam verificadas quanto ao correto cadastramento nos sistemas do FNDE, que as matrículas sejam mapeadas e que sejam apuradas eventuais inconsistências, com a finalidade de melhorar a eficiência da gestão educacional e buscar a maximização dos recursos federais, conforme a legislação vigente.",
  ].map((text) => createParagraph(text));
}

function buildAnexoParagraphs(empresaNome: string) {
  return [
    createParagraph("ANEXO I – METODOLOGIA DE LEVANTAMENTO DE DADOS E FONTES OFICIAIS", {
      align: AlignmentType.CENTER,
      bold: true,
      spacingAfter: 180,
    }),
    createParagraph(
      `Para garantir a total transparência, assertividade e segurança jurídica dos levantamentos preliminares e das projeções de incremento de receita apresentadas nesta proposta, a equipe técnica da ${empresaNome} pauta os seus estudos estritamente nas bases de dados, relatórios gerenciais e legislações oficiais do Governo Federal.`,
    ),
    createParagraph(
      "Abaixo, detalhamos as rubricas e programas educacionais analisados para a composição do proveito econômico estimado, bem como as respectivas fontes governamentais de extração de dados e diretrizes utilizadas:",
      { spacingAfter: 180 },
    ),
    createParagraph("1. COMPLEMENTAÇÕES DA UNIÃO (NOVO FUNDEB)", {
      bold: true,
      spacingAfter: 120,
    }),
    createParagraph(
      "A reestruturação dos dados do Censo Escolar e do SIOPE impacta diretamente as três modalidades de complementação da União ao FUNDEB:",
    ),
    createBulletedParagraph(
      "VAAF",
      "Valor Anual por Aluno – Fundo. Fonte oficial: https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/vaaf",
    ),
    createBulletedParagraph(
      "VAAT",
      "Valor Anual Total por Aluno. Fonte oficial: https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/vaat",
    ),
    createBulletedParagraph(
      "VAAR",
      "Valor Anual por Aluno – Resultados. Fonte oficial: https://www.gov.br/transferegov/pt-br/noticias/eventos/fntu/viiifntu/apresentacoes/evento-79-condicionalidades-para-o-recebimento-da-complementacao-fundeb-vaar.pdf",
    ),
    createParagraph("2. PROGRAMAS SUPLEMENTARES E REPASSES FEDERAIS (FNDE)", {
      bold: true,
      spacingBefore: 80,
      spacingAfter: 120,
    }),
    createParagraph(
      "O saneamento de pendências no SIMEC, SIGPC e HABILITA-FNDE visa o destravamento e a maximização dos seguintes programas complementares:",
    ),
    createBulletedParagraph(
      "QSE",
      "Quota do Salário-Educação. Fonte oficial: https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/salario-educacao",
    ),
    createBulletedParagraph(
      "PDDE",
      "Programa Dinheiro Direto na Escola. Fonte oficial: https://www.gov.br/mec/pt-br/pdde",
    ),
    createBulletedParagraph(
      "PNAE",
      "Programa Nacional de Alimentação Escolar. Fonte oficial: https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/programas/pnae",
    ),
    createBulletedParagraph(
      "PNATE",
      "Programa Nacional de Apoio ao Transporte do Escolar. Fonte oficial: https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/programas/pnate",
    ),
    createParagraph("3. SISTEMAS E BASES DE APOIO À REGULARIZAÇÃO", {
      bold: true,
      spacingBefore: 80,
      spacingAfter: 120,
    }),
    createBulletedParagraph(
      "SIMEC",
      "Sistema Integrado de Monitoramento, Execução e Controle do MEC, utilizado para obras, PAR e programas estruturantes.",
    ),
    createBulletedParagraph(
      "SIGPC",
      "Sistema de Gestão de Prestação de Contas, voltado à regularização de pendências históricas junto ao FNDE.",
    ),
    createBulletedParagraph(
      "SIGARP",
      "Sistema de Gerenciamento de Atas de Registro de Preços, essencial para adesões e demandas de ônibus e mobiliário escolar.",
    ),
    createBulletedParagraph(
      "HABILITA-FNDE",
      "Ambiente de habilitação para transferências e análise das condições cadastrais e documentais do ente.",
    ),
  ];
}

export async function generatePropostaDocx(
  data: PropostaFormData,
  config?: EmpresaConfig,
  company?: Company | null,
) {
  const empresa = buildEmitterConfig(config, company);
  const empresaNome = toUpper(empresa.nome);
  const { tituloSocial } = resolveGenderTerms(data.generoAutoridade);
  const { incremento, honorarios, percentualIncremento, percentualEfetivo } = calculateHonorarios(data);
  const municipioUpper = `${toUpper(data.municipioNome)}/${toUpper(data.municipioUf)}`;
  const destinatario = `À ${data.destinatarioTitulo.toUpperCase()} ${toUpper(data.municipioNome)}/${toUpper(data.municipioUf)}`;

  const resumoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          createResumoCell(`MUNICÍPIO DE ${municipioUpper} | VALOR ESTIMADO A RECUPERAR`, {
            bold: true,
            align: AlignmentType.CENTER,
            fill: "1D4ED8",
            span: 2,
          }),
        ],
      }),
      new TableRow({
        children: [
          createResumoCell("DESCRIÇÃO", {
            bold: true,
            align: AlignmentType.CENTER,
            fill: "DBEAFE",
            width: 74,
          }),
          createResumoCell("VALOR (R$)", {
            bold: true,
            align: AlignmentType.CENTER,
            fill: "DBEAFE",
            width: 26,
          }),
        ],
      }),
      new TableRow({
        children: [
          createResumoCell(`INCREMENTO FUNDEB ${data.anoBase} - Valor atual`, { width: 74 }),
          createResumoCell(formatCurrency(data.receitaAtual), {
            align: AlignmentType.RIGHT,
            width: 26,
          }),
        ],
      }),
      new TableRow({
        children: [
          createResumoCell(
            `INCREMENTO FUNDEB ${data.anoProjetado} - Valor projetado após reestruturação`,
            { width: 74 },
          ),
          createResumoCell(formatCurrency(data.receitaProjetada), {
            align: AlignmentType.RIGHT,
            width: 26,
          }),
        ],
      }),
      new TableRow({
        children: [
          createResumoCell("TOTAL GERAL A RECUPERAR/INCREMENTAR", {
            bold: true,
            width: 74,
          }),
          createResumoCell(formatCurrency(incremento), {
            bold: true,
            align: AlignmentType.RIGHT,
            width: 26,
          }),
        ],
      }),
      new TableRow({
        children: [
          createResumoCell(
            "ESTIMATIVA DE HONORÁRIOS TÉCNICOS (Conforme escalonamento progressivo abaixo)",
            {
              bold: true,
              width: 74,
            },
          ),
          createResumoCell(`${formatCurrency(honorarios)}*`, {
            bold: true,
            align: AlignmentType.RIGHT,
            width: 26,
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      createStandardSection(
        [
          createParagraph("PROPOSTA DE SERVIÇO", {
            align: AlignmentType.CENTER,
            bold: true,
            spacingAfter: 220,
          }),
          createParagraph(destinatario, { bold: true }),
          createParagraph(
            `${data.pronomeTratamento} ${data.cargoAutoridade} ${tituloSocial} ${data.nomeAutoridade}`,
            { bold: true },
          ),
          createParagraph(
            "ASSUNTO: Proposta de serviços técnicos especializados de assessoria, visando a regularização de sistemas do MEC/FNDE, reestruturação do Censo Escolar/FUNDEB e recuperação de repasses na área educacional do Município.",
            { bold: true, spacingAfter: 180 },
          ),
          createParagraph(data.saudacaoInicial),
          createParagraph(
            `É com grata satisfação que a empresa ${empresaNome}, inscrita no CNPJ nº ${empresa.cnpj}, localizada na ${buildCompanyAddress(empresa)}, encaminha a presente proposta para prestação de serviços técnicos especializados na área educacional para este Município.`,
          ),
          createParagraph(
            `A ${empresaNome} detém notória especialização na sua área de atuação, prestando serviços desta natureza a diversas entidades governamentais, com foco na regularização de sistemas do Fundo Nacional de Desenvolvimento da Educação (FNDE), Ministério da Educação (MEC) e na recuperação de recursos federais para a educação.`,
          ),
          createParagraph(
            "Na certeza de que poderemos contribuir para o êxito desta relevante iniciativa, permanecemos na expectativa da aceitação da nossa proposta.",
          ),
          createParagraph("Aproveitamos o ensejo para renovar protestos de consideração e apreço.", {
            spacingAfter: 200,
          }),
          createSectionTitle("1. DO OBJETO"),
          ...buildObjetoParagraphs(municipioUpper),
          createSectionTitle("2. DA ESPECIFICAÇÃO DOS SERVIÇOS - SISTEMAS MEC/FNDE"),
          ...buildServicosParagraphs(),
          createSectionTitle("3. DO VALOR ESTIMADO DOS SERVIÇOS CONTRATADOS"),
          resumoTable,
          createParagraph(
            `3.1. O valor estimado de recuperação e incremento de receitas para o Município é de ${formatCurrency(incremento)} (${monetaryExtenso(incremento)}), o que representa um aumento potencial de ${formatPercent(percentualIncremento)}% sobre a receita atual, sem considerar a correção monetária e os acréscimos legais.`,
            { spacingBefore: 160 },
          ),
          createParagraph(
            "3.2. Em estrito alinhamento com os princípios da economicidade e da razoabilidade da Administração Pública, a remuneração da CONTRATADA não incidirá como percentual fixo global, mas sim através de uma estrutura proporcional e progressiva de honorários de resultado, calculada estritamente sobre o proveito econômico real gerado aos cofres municipais.",
          ),
          createParagraph(
            `3.3. A remuneração observará a seguinte tabela de escalonamento por faixas, utilizando como base o salário-mínimo vigente de ${formatCurrency(data.escalonamento.salarioMinimo)}:`,
          ),
          createBulletedParagraph(
            "I.",
            `Nível I (até ${data.escalonamento.nivel1LimiteSm} salários-mínimos de proveito econômico): ${data.escalonamento.nivel1Percentual}% (${numberExtenso(data.escalonamento.nivel1Percentual)} por cento) sobre a referida faixa;`,
          ),
          createBulletedParagraph(
            "II.",
            `Nível II (de ${data.escalonamento.nivel1LimiteSm} a ${data.escalonamento.nivel2LimiteSm} salários-mínimos de proveito econômico): ${data.escalonamento.nivel2Percentual}% (${numberExtenso(data.escalonamento.nivel2Percentual)} por cento) sobre a parcela excedente;`,
          ),
          createBulletedParagraph(
            "III.",
            `Nível III (acima de ${data.escalonamento.nivel2LimiteSm} salários-mínimos de proveito econômico): ${data.escalonamento.nivel3Percentual}% (${numberExtenso(data.escalonamento.nivel3Percentual)} por cento) sobre a parcela excedente.`,
          ),
          createParagraph(
            `*Nota técnica: Ao aplicar o escalonamento progressivo sobre o total projetado, a estimativa de honorários representa um custo efetivo médio de aproximadamente ${formatPercent(percentualEfetivo)}% para o Município, evidenciando a alta vantajosidade financeira da contratação.`,
            { italics: true },
          ),
          createParagraph(
            "3.4. Da condição de risco integral (risco zero para o Município): o pagamento dos honorários ocorrerá única e exclusivamente na hipótese de efetiva recuperação de valores ou ingresso financeiro nas contas do Município. Caso os diagnósticos e intervenções não resultem em proveito econômico mensurável, nenhum valor será devido à CONTRATADA a título de indenização ou custeio de despesas.",
          ),
          createParagraph(
            "3.5. Para efeito do cálculo da remuneração devida pela prestação dos serviços, considerar-se-ão recuperados tão somente os valores indevidamente não repassados ou mal dimensionados pelo FNDE, restituídos, readequados ou compensados em decisão administrativa terminativa que ingressar nos cofres públicos, em virtude dos procedimentos realizados pela empresa contratada. Havendo ingresso de valores em parcela única, os pagamentos correspondentes à contratada serão efetuados na sua integralidade; em caso de parcelamento, os valores serão igualmente transferidos à contratada na proporção de cada uma das parcelas.",
          ),
          createParagraph(
            "3.6. Os referidos valores serão pagos com recursos próprios (Fonte 00) e/ou sem vinculação específica, nos moldes da jurisprudência assentada sobre a matéria, não se permitindo a sua dedução direta das rubricas vinculadas da Educação.",
            { spacingAfter: 180 },
          ),
          createSectionTitle("4. VIGÊNCIA DO CONTRATO"),
          createParagraph(
            `4.1. Recomenda-se a vigência do contrato dentro de um período de ${data.prazoVigenciaMeses} (${numberExtenso(data.prazoVigenciaMeses)}) meses, contados a partir da data de sua assinatura, pelos seguintes motivos de fato:`,
          ),
          createBulletedParagraph(
            "a)",
            "Justifica-se o período sugerido do contrato, pois os ciclos do FNDE (PAR, PDDE e Programa Caminho da Escola), as atualizações do Censo Escolar e as transferências do FUNDEB ocorrem de forma plurianual, demandando acompanhamento contínuo para maximização dos resultados. A tramitação das demandas pertinentes à regularização de sistemas, destravamento de obras e recuperação de repasses percorre diversas instâncias administrativas federais.",
          ),
          createBulletedParagraph(
            "b)",
            "Em face da análise dos valores devidos pelo FNDE, a instauração de processos administrativos para a recuperação dos respectivos créditos demanda tempo hábil para conclusão, sendo razoável a adoção de prazo médio plurianual para a perfeita execução dos serviços.",
          ),
          createParagraph(
            "4.2. Os prazos de vigência deste contrato poderão ser prorrogados nos termos do art. 106 da Lei nº 14.133/2021. O prazo de validade desta proposta é de 60 (sessenta) dias, a contar da data de sua assinatura.",
            { spacingAfter: 220 },
          ),
          createParagraph(`${empresa.cidade}/${empresa.uf}, ${formatDateLong(data.dataDocumento)}.`, {
            align: AlignmentType.CENTER,
            spacingAfter: 220,
          }),
          createParagraph("______________________________________________", {
            align: AlignmentType.CENTER,
            bold: true,
            spacingAfter: 40,
          }),
          createParagraph(empresaNome, {
            align: AlignmentType.CENTER,
            bold: true,
            spacingAfter: 40,
          }),
          createParagraph(`CNPJ nº ${empresa.cnpj}`, {
            align: AlignmentType.CENTER,
            spacingAfter: 40,
          }),
          createParagraph(`Representante Legal: ${toUpper(empresa.representanteNome)}`, {
            align: AlignmentType.CENTER,
            spacingAfter: 240,
          }),
          new Paragraph({ children: [new PageBreak()] }),
          ...buildAnexoParagraphs(empresaNome),
        ],
        createProposalHeader(empresa),
        createStandardFooter("Proposta gerada pela plataforma SYNC | "),
      ),
    ],
  });

  const blob = await Packer.toBlob(doc);

  return {
    blob,
    fileName: `proposta-comercial-${sanitizeFileName(data.municipioNome)}.docx`,
  };
}
