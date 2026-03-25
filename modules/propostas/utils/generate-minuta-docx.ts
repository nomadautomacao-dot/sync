import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
} from "docx";
import type { Company } from "@/core/domain/organization";
import type { EmpresaConfig, PropostaFormData } from "../types";
import {
  buildEmitterConfig,
  createBulletedParagraph,
  createMinutaHeader,
  createParagraph,
  createStandardFooter,
  createStandardSection,
  formatCurrency,
  formatDateLong,
  formatDateMonthYear,
  monetaryExtenso,
  resolveGenderTerms,
  sanitizeFileName,
  toUpper,
} from "./document-helpers";

export async function generateMinutaDocx(
  data: PropostaFormData,
  config?: EmpresaConfig,
  company?: Company | null,
) {
  const empresa = buildEmitterConfig(config, company);
  const gender = resolveGenderTerms(data.generoAutoridade);
  const municipioRef = `${toUpper(data.municipioNome)}/${toUpper(data.municipioUf)}`;
  const municipioUpper = `MUNICÍPIO DE ${municipioRef}`;
  const municipioTitulo = `Município de ${data.municipioNome}/${data.municipioUf}`;
  const fundoClause =
    data.usarFundoEducacao && data.cnpjFundoEducacao
      ? `, por intermédio do ${data.nomeFundoEducacao} – ${data.siglaFundoEducacao}, inscrito no CNPJ nº ${data.cnpjFundoEducacao}`
      : "";
  const incremento = Math.max(0, data.receitaProjetada - data.receitaAtual);

  const doc = new Document({
    sections: [
      createStandardSection(
        [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            text: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS ESPECIALIZADOS",
          }),
          createParagraph(`Nº ${data.contratoNumero}`, {
            align: AlignmentType.CENTER,
            bold: true,
            spacingAfter: 40,
          }),
          createParagraph(`INEXIGIBILIDADE DE LICITAÇÃO Nº ${data.inexigibilidadeNumero}`, {
            align: AlignmentType.CENTER,
            bold: true,
            spacingAfter: 40,
          }),
          createParagraph(`PROCESSO ADMINISTRATIVO Nº ${data.processoAdministrativoNumero}`, {
            align: AlignmentType.CENTER,
            bold: true,
            spacingAfter: 180,
          }),
          createParagraph(
            `CONTRATO DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS ESPECIALIZADOS QUE ENTRE SI CELEBRAM O ${municipioUpper} E A EMPRESA ${empresa.nome}.`,
            { bold: true, spacingAfter: 180 },
          ),
          createParagraph("CONTRATANTE:", { bold: true, spacingAfter: 60 }),
          createParagraph(
            `${municipioUpper}, pessoa jurídica de direito público interno, inscrito no CNPJ nº ${data.cnpjMunicipio}, com sede administrativa em ${data.enderecoMunicipio}, CEP ${data.cepMunicipio}, neste ato representado por ${gender.possessivo} ${data.cargoAutoridade}, ${data.tituloSocialAutoridade} ${data.nomeAutoridade}, portador do RG nº ${data.rgAutoridade} ${data.orgaoExpedidorAutoridade} e CPF nº ${data.cpfAutoridade}, ${gender.residente} neste Município${fundoClause}, doravante denominado simplesmente CONTRATANTE, no uso de suas prerrogativas legais, com fundamento no art. 74, inciso III, da Lei Federal nº 14.133/2021, conforme Processo Administrativo nº ${data.processoAdministrativoNumero} e Inexigibilidade de Licitação nº ${data.inexigibilidadeNumero}.`,
            { spacingAfter: 120 },
          ),
          createParagraph("CONTRATADA:", { bold: true, spacingAfter: 60 }),
          createParagraph(
            `${empresa.nome}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${empresa.cnpj}, com sede em ${empresa.endereco}, Município de ${empresa.cidade}, Estado ${empresa.uf}, CEP ${empresa.cep}, neste ato representada por ${empresa.representanteCargo.toLowerCase()} ${empresa.representanteNome}, portador do RG nº ${empresa.representanteRg} e CPF nº ${empresa.representanteCpf}, doravante denominada simplesmente CONTRATADA.`,
            { spacingAfter: 180 },
          ),
          createParagraph(
            "As partes acima identificadas têm entre si justo e pactuado o presente CONTRATO DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS ESPECIALIZADOS DE CONSULTORIA, que se regerá pelas cláusulas e condições a seguir estabelecidas, em conformidade com a legislação aplicável.",
            { spacingAfter: 180 },
          ),
          createParagraph("CLÁUSULA PRIMEIRA – DO OBJETO", { bold: true }),
          createParagraph(
            `O presente contrato tem por objeto a prestação de serviços técnicos especializados de consultoria estratégica, administrativa e sistêmica em gestão educacional, voltados à organização, regularização, habilitação e incremento da capacidade do ${municipioUpper} na captação, manutenção e ampliação de recursos educacionais oriundos do FNDE, MEC, FUNDEB e sistemas correlatos.`,
          ),
          createParagraph(
            "Parágrafo único. Os serviços possuem natureza técnica especializada e caráter extraordinário, distinguindo-se de atividades administrativas ordinárias, não se confundindo com serviços jurídicos contenciosos ou de cobrança, consistindo, dentre outras ações técnicas, em diagnóstico de pendências, saneamento sistêmico e estruturação de projetos técnicos singulares.",
            { spacingAfter: 160 },
          ),
          createParagraph("CLÁUSULA SEGUNDA – DAS CONDIÇÕES DE PRESTAÇÃO DOS SERVIÇOS", {
            bold: true,
          }),
          createParagraph(
            `Os serviços serão executados de forma técnica e especializada, mediante intervenções presenciais e remotas, compreendendo idas técnicas ao ${municipioUpper}, sempre que necessárias ao acompanhamento, diagnóstico e implementação das ações previstas no objeto contratual, bem como a realização das demais etapas técnicas no escritório da CONTRATADA.`,
          ),
          createParagraph(
            "A execução observará integralmente as disposições da Lei Federal nº 14.133/2021, especialmente no que se refere à execução contratual, fiscalização, responsabilidades das partes e boa governança administrativa.",
          ),
          createParagraph(
            "Parágrafo primeiro. A CONTRATANTE deverá disponibilizar e manter, durante a execução do contrato, as informações, documentos, acessos sistêmicos e apoio institucional necessários à adequada execução do objeto.",
          ),
          createParagraph(
            "Parágrafo segundo. O presente contrato possui escopo técnico definido, sendo vedada a inclusão ou execução de serviços diversos daqueles expressamente previstos no objeto, salvo mediante novo procedimento administrativo próprio e observância integral da legislação aplicável.",
          ),
          createParagraph(
            "Parágrafo terceiro. Correrão por conta exclusiva da CONTRATADA todas as despesas necessárias à execução do objeto, inclusive transporte, alimentação e hospedagem da equipe técnica, não cabendo ônus adicional à CONTRATANTE.",
            { spacingAfter: 160 },
          ),
          createParagraph("CLÁUSULA TERCEIRA – DAS OBRIGAÇÕES DA CONTRATADA", {
            bold: true,
          }),
          createParagraph(
            "Constituem obrigações da CONTRATADA, além de outras previstas neste instrumento e na legislação aplicável:",
            { spacingAfter: 80 },
          ),
          createBulletedParagraph(
            "I.",
            "Executar os serviços de consultoria e assessoria técnica com zelo, diligência e elevado padrão de especialização, observando rigorosamente as normas do FNDE, MEC e da Lei Federal nº 14.133/2021;",
          ),
          createBulletedParagraph(
            "II.",
            "Atender com prioridade às solicitações e determinações formais da CONTRATANTE, prestando o suporte técnico necessário para o saneamento de pendências nos sistemas SIMEC, AUXÍLIOS, CAMINHO DA ESCOLA, PAR, PDDE, PNAE, PNATE, SIGPC, SIOPE, EDUCA CENSO e correlatos;",
          ),
          createBulletedParagraph(
            "III.",
            "Manter plena regularidade fiscal, trabalhista e previdenciária durante toda a execução contratual;",
          ),
          createBulletedParagraph(
            "IV.",
            "Disponibilizar equipe técnica especializada, assumindo integral responsabilidade por seus encargos profissionais e pela qualidade dos pareceres emitidos;",
          ),
          createBulletedParagraph(
            "V.",
            "Elaborar e entregar relatórios técnicos de diagnóstico e saneamento que servirão de base para aferição da execução e autorização de pagamentos;",
          ),
          createBulletedParagraph(
            "VI.",
            "Promover transferência de conhecimento técnico aos servidores da Secretaria Municipal de Educação, sem configuração de substituição de mão de obra;",
          ),
          createBulletedParagraph(
            "VII.",
            "Manter sigilo absoluto sobre dados e informações estratégicas do Município;",
          ),
          createBulletedParagraph(
            "VIII.",
            "Cientificar a CONTRATANTE sobre qualquer impedimento técnico ou legal que possa comprometer a regularização dos repasses financeiros.",
          ),
          createParagraph("CLÁUSULA QUARTA – DAS OBRIGAÇÕES DA CONTRATANTE", {
            bold: true,
            spacingBefore: 80,
          }),
          createBulletedParagraph(
            "I.",
            "Efetuar o pagamento da remuneração devida nos termos da Cláusula Quinta, mediante comprovação do resultado técnico obtido, apresentação da nota fiscal correspondente e atesto do fiscal do contrato;",
          ),
          createBulletedParagraph(
            "II.",
            "Fornecer à CONTRATADA as informações, documentos e acessos necessários à adequada execução do objeto contratual;",
          ),
          createBulletedParagraph(
            "III.",
            "Acompanhar, fiscalizar e avaliar a execução dos serviços por meio de servidor formalmente designado;",
          ),
          createBulletedParagraph(
            "IV.",
            "Emitir ordens de serviço ou solicitações formais quando necessárias, de acordo com a programação da Secretaria responsável.",
          ),
          createParagraph("CLÁUSULA QUINTA – DO PREÇO E DA REMUNERAÇÃO TÉCNICA", {
            bold: true,
            spacingBefore: 80,
          }),
          createParagraph(
            "A remuneração da CONTRATADA fundamenta-se na entrega de serviços técnicos especializados de natureza singular, sendo o valor devido proporcional à complexidade e ao resultado efetivo da consultoria prestada em favor do Município.",
          ),
          createParagraph(
            "5.1. A remuneração será composta pelo somatório de honorários técnicos de resultados, vinculados à entrega de produtos técnicos cuja complexidade é mensurada pelo proveito econômico e administrativo gerado ao Município.",
          ),
          createParagraph(
            "5.2. Para fins de fixação do valor de cada produto técnico entregue, observar-se-á a seguinte tabela de escalonamento, baseada na complexidade do processo e no valor do recurso regularizado:",
          ),
          createBulletedParagraph(
            "I.",
            `Nível I (até ${data.escalonamento.nivel1LimiteSm} salários-mínimos): R$ ${(
              data.escalonamento.nivel1Percentual / 100
            )
              .toFixed(2)
              .replace(".", ",")} a cada R$ 1,00 efetivamente implementado ou regularizado;`,
          ),
          createBulletedParagraph(
            "II.",
            `Nível II (de ${data.escalonamento.nivel1LimiteSm} a ${data.escalonamento.nivel2LimiteSm} salários-mínimos): R$ ${(
              data.escalonamento.nivel2Percentual / 100
            )
              .toFixed(2)
              .replace(".", ",")} a cada R$ 1,00 sobre a parcela excedente;`,
          ),
          createBulletedParagraph(
            "III.",
            `Nível III (acima de ${data.escalonamento.nivel2LimiteSm} salários-mínimos): R$ ${(
              data.escalonamento.nivel3Percentual / 100
            )
              .toFixed(2)
              .replace(".", ",")} a cada R$ 1,00 sobre a parcela excedente.`,
          ),
          createParagraph(
            "5.3. Considerando a natureza de risco integral deste contrato, não haverá limite máximo nominal para a remuneração técnica total, sendo a proteção ao Erário garantida pela própria tabela de escalonamento.",
          ),
          createParagraph(
            "5.4. O pagamento somente será processado mediante entrega do produto técnico, aferição do resultado e atesto de conformidade pelo fiscal do contrato.",
          ),
          createParagraph(
            "5.5. É vedado o pagamento da contratada com recursos vinculados. O pagamento deverá ocorrer através de recursos próprios do Tesouro Municipal.",
          ),
          createParagraph(
            "5.6. Caso os diagnósticos técnicos, relatórios e intervenções não resultem em efetivo ingresso de receitas, desbloqueio de contas ou regularização mensurável, nenhum valor será devido pelo MUNICÍPIO.",
            { spacingAfter: 160 },
          ),
          createParagraph("CLÁUSULA SEXTA – DA DOTAÇÃO ORÇAMENTÁRIA", { bold: true }),
          createParagraph(
            `As despesas decorrentes da execução do presente contrato correrão à conta de dotação orçamentária própria do ${municipioUpper}, consignada no orçamento vigente, proveniente de recursos livres e devidamente classificada conforme a legislação aplicável.`,
          ),
          createParagraph(
            "6.1. Fica expressamente vedada a utilização de recursos federais vinculados, especialmente aqueles oriundos do FNDE, MEC ou de rubricas específicas da Educação, para o pagamento da remuneração prevista neste contrato.",
          ),
          createParagraph(
            "6.2. Excepcionalmente, poderá ser admitida a utilização de recursos com previsão legal de custeio administrativo, tais como Quota do Salário-Educação, desde que observados os requisitos legais e as orientações dos órgãos de controle.",
            { spacingAfter: 160 },
          ),
          createParagraph("CLÁUSULA SÉTIMA – DA VIGÊNCIA", { bold: true }),
          createParagraph(
            `O presente contrato terá vigência a partir da data de sua assinatura até ${formatDateLong(data.vigenciaEncerramento)}, limitada ao período necessário à execução do objeto contratado.`,
          ),
          createParagraph(
            "7.1. A vigência poderá ser prorrogada excepcionalmente, mediante termo aditivo, desde que persistam atividades técnicas diretamente relacionadas ao objeto, haja justificativa formal e seja observada a compatibilidade com o art. 105 da Lei Federal nº 14.133/2021.",
          ),
          createParagraph(
            "7.2. É vedada a prorrogação automática deste contrato, bem como sua continuidade sem formalização do respectivo termo aditivo.",
            { spacingAfter: 160 },
          ),
          createParagraph("CLÁUSULA OITAVA – DO REEQUILÍBRIO ECONÔMICO-FINANCEIRO", {
            bold: true,
          }),
          createParagraph(
            "Considerando que a remuneração prevista neste contrato possui natureza variável e condicionada ao êxito, não se aplica reajuste periódico de preços, índices inflacionários ou revisão automática de valores.",
          ),
          createParagraph(
            "8.1. O reequilíbrio econômico-financeiro somente poderá ser admitido em caráter excepcional, mediante requerimento formal da CONTRATADA e comprovação de fato superveniente, imprevisível ou previsível de consequências incalculáveis, nos termos do art. 124, inciso II, alínea d, da Lei Federal nº 14.133/2021.",
            { spacingAfter: 160 },
          ),
          createParagraph("CLÁUSULA NONA – DA VINCULAÇÃO LEGAL", { bold: true }),
          createParagraph(
            "O presente contrato rege-se pelas disposições da Lei Federal nº 14.133, de 1º de abril de 2021, bem como pela legislação correlata aplicável, ficando as partes a ela vinculadas para a resolução de casos omissos e interpretação das cláusulas contratuais.",
            { spacingAfter: 160 },
          ),
          createParagraph("CLÁUSULA DÉCIMA – DO ACOMPANHAMENTO", { bold: true }),
          createParagraph(
            `Caberá a ${data.secretariaAcompanhamento} do ${municipioTitulo} o acompanhamento e a supervisão administrativa da execução dos serviços que constituem o objeto deste contrato, sem prejuízo da autonomia técnica da CONTRATADA.`,
            { spacingAfter: 160 },
          ),
          createParagraph("CLÁUSULA DÉCIMA PRIMEIRA – DA FISCALIZAÇÃO", { bold: true }),
          createParagraph(
            `A fiscalização da execução do presente contrato caberá a ${data.secretariaFiscalizacao} do ${municipioTitulo}, por meio de servidor formalmente designado como fiscal do contrato, responsável por acompanhar, verificar e atestar a execução dos serviços.`,
            { spacingAfter: 160 },
          ),
          createParagraph("CLÁUSULA DÉCIMA SEGUNDA – DA EXECUÇÃO DO CONTRATO", {
            bold: true,
          }),
          createParagraph(
            "O presente contrato deverá ser executado fielmente pelas partes, de acordo com as cláusulas aqui estabelecidas, observadas as disposições do Capítulo VI da Lei Federal nº 14.133/2021, bem como os princípios da legalidade, eficiência, economicidade e interesse público.",
            { spacingAfter: 160 },
          ),
          createParagraph("CLÁUSULA DÉCIMA TERCEIRA – DA RESCISÃO CONTRATUAL", {
            bold: true,
          }),
          createParagraph(
            "O presente contrato poderá ser rescindido, a qualquer tempo, mediante processo administrativo regularmente instaurado, assegurados o contraditório e a ampla defesa, nas hipóteses previstas na Lei Federal nº 14.133/2021.",
          ),
          createParagraph(
            "13.1. Constituem hipóteses de rescisão o descumprimento injustificado de cláusulas contratuais, a inexecução total ou parcial do objeto, a paralisação dos serviços sem motivo justificado e a superveniência de fato que torne a execução do contrato ilegal ou contrária ao interesse público.",
            { spacingAfter: 160 },
          ),
          createParagraph("CLÁUSULA DÉCIMA QUARTA – DAS PENALIDADES ADMINISTRATIVAS", {
            bold: true,
          }),
          createParagraph(
            "O descumprimento injustificado das obrigações assumidas neste contrato sujeitará a CONTRATADA às sanções previstas na Lei Federal nº 14.133/2021, garantido o prévio contraditório e a ampla defesa, observada a gravidade da falta, a reincidência e o dano efetivo causado à Administração.",
            { spacingAfter: 160 },
          ),
          createParagraph("CLÁUSULA DÉCIMA QUINTA – DO FORO", { bold: true }),
          createParagraph(
            `Fica eleito o Foro da Comarca de ${data.comarcaNome || data.municipioNome} – Estado de ${data.estadoNome}, para dirimir quaisquer dúvidas ou controvérsias oriundas da execução do presente contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`,
            { spacingAfter: 220 },
          ),
          createParagraph(`${data.municipioNome}/${data.municipioUf}, ${formatDateLong(data.dataDocumento)}.`, {
            align: AlignmentType.CENTER,
            spacingAfter: 220,
          }),
          createParagraph(`${municipioUpper}`, {
            align: AlignmentType.CENTER,
            bold: true,
            spacingAfter: 40,
          }),
          createParagraph(empresa.nome, {
            align: AlignmentType.CENTER,
            bold: true,
            spacingAfter: 120,
          }),
          createParagraph("_________________________________", {
            align: AlignmentType.CENTER,
            spacingAfter: 40,
          }),
          createParagraph("_________________________________", {
            align: AlignmentType.CENTER,
            spacingAfter: 40,
          }),
          createParagraph(data.cargoAutoridade, {
            align: AlignmentType.CENTER,
            spacingAfter: 40,
          }),
          createParagraph(empresa.representanteNome, {
            align: AlignmentType.CENTER,
            spacingAfter: 220,
          }),
          createParagraph("Testemunhas:", { bold: true, spacingAfter: 80 }),
          createParagraph("1. _____________________________", { spacingAfter: 20 }),
          createParagraph("RG: ___________________________", { spacingAfter: 80 }),
          createParagraph("2. _____________________________", { spacingAfter: 20 }),
          createParagraph("RG: ___________________________", { spacingAfter: 220 }),
          new Paragraph({ children: [new PageBreak()] }),
          createParagraph("ANEXO I – ESCOPO TÉCNICO E ESTUDO DE VIABILIDADE ECONÔMICA", {
            align: AlignmentType.CENTER,
            bold: true,
          }),
          createParagraph(
            "1. Objeto do Anexo. O presente Anexo tem por finalidade delimitar tecnicamente o escopo dos serviços e apresentar a projeção de potencial econômico que justifica a contratação, sem caracterizar promessa de resultado.",
          ),
          createParagraph(
            "2. Natureza dos Serviços. Os serviços possuem natureza estratégica e de inteligência técnica, voltados à solução de passivos no SIMEC/FNDE e à qualificação dos dados do Censo Escolar e SIOPE para maximização das receitas constitucionais.",
          ),
          createParagraph(
            "3. Eixos Técnicos de Atuação. Diagnóstico e saneamento, desbloqueio e regularização, incremento de receitas e transferência de conhecimento aos gestores municipais.",
          ),
          createParagraph(
            "4. Programas e Sistemas. A consultoria abrangerá, conforme necessidade, os sistemas SIMEC, SIGPC, SIOPE, PDDE Interativo, PAR, PNAE, PNATE e a metodologia do Novo FUNDEB (Lei 14.113/2020).",
          ),
          createParagraph(
            "5. Relatórios Técnicos e Produtos. A remuneração será baseada na entrega de relatórios conclusivos que comprovem o saneamento de pendências ou o incremento de receita.",
          ),
          createParagraph(
            `6. ESTUDO DE PROJEÇÃO DE RECEITAS (${data.anoBase}/${data.anoProjetado}). Com base no diagnóstico preliminar realizado pela CONTRATADA, identifica-se um passivo técnico na alimentação dos sistemas de ensino que, se corrigido, projeta incremento substancial nas complementações da União.`,
            { bold: true },
          ),
          createParagraph(
            `6.1. Cenário Atual (Linha de Base - ${data.anoBase}). Conforme extrato oficial do FUNDEB para o exercício corrente, o ${municipioUpper} apresenta o seguinte quadro de receitas de complementação: ${formatCurrency(data.receitaAtual)}.`,
          ),
          createParagraph(
            `6.2. Cenário Projetado (Meta Técnica - ${data.anoProjetado}). Mediante a execução dos serviços de reestruturação do Censo Escolar, SIOPE e capacitação técnica para cumprimento das condicionalidades do VAAT/VAAR, projeta-se a receita estimada de ${formatCurrency(data.receitaProjetada)}.`,
          ),
          createParagraph(
            `6.3. Estimativa de Êxito. A diferença projetada representa um potencial de incremento de receita na ordem de aproximadamente ${formatCurrency(incremento)} (${monetaryExtenso(incremento)}).`,
          ),
          createParagraph(
            `Nota técnica: Este valor refere-se à estimativa de impacto financeiro decorrente da correção de distorções e otimização dos indicadores do Novo FUNDEB, sujeito à variação dos índices nacionais e da arrecadação federal. Documento emitido em ${formatDateMonthYear(data.dataDocumento)}.`,
          ),
        ],
        createMinutaHeader(),
        createStandardFooter("Página "),
      ),
    ],
  });

  const blob = await Packer.toBlob(doc);

  return {
    blob,
    fileName: `minuta-contratual-${sanitizeFileName(data.municipioNome)}.docx`,
  };
}
