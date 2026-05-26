import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:sync_flutter/src/features/modules/application/contrato_premium_pdf_builder.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('generate miradouro pdf', () async {
    await initializeDateFormatting('pt_BR', null);
    final sampleData = ContratoPremiumPdfBuilder.sample();
    
    final data = PremiumContractData(
      proposalNumber: '012/2026',
      clientName: 'PREFEITURA MUNICIPAL DE MIRADOURO/MG',
      clientDocument: '18.369.306/0001-38',
      clientAddress: 'Praça Silviano Brandão, 58 - Centro, Miradouro - MG',
      mayorName: 'Cloves da Silva Botelho',
      processName: 'Dispensa de Licitação',
      city: 'Miradouro',
      state: 'MG',
      referenceDate: DateTime(2026, 5, 8),
      validityDays: 60,
      executionTerm: '12 meses, prorrogáveis nos termos da Lei 14.133/2021',
      object: 'Contratação de pessoa jurídica para prestação de serviços técnicos especializados visando: assessorar o Município na gestão, regularização e reestruturação dos sistemas do Ministério da Educação (MEC) e do Fundo Nacional de Desenvolvimento da Educação (FNDE), mediante a análise e correção de dados cadastrais no SIMEC, SIGPC, SIGARP e Habilita-FNDE, a reestruturação do Censo Escolar e a regularização de repasses do FUNDEB e programas do FNDE, visando à otimização técnica dos recursos federais destinados à educação do município de Miradouro/MG.',
      scopeItems: const [
        'Regularização e atualização técnica dos sistemas corporativos do FNDE (SIMEC, SIGPC, SIGARP e HABILITA-FNDE).',
        'Reestruturação dos dados do Censo Escolar para apuração exata das matrículas e indicadores do FUNDEB.',
        'Apoio técnico para destravamento de obras paralisadas dos programas PAR e PAC.',
        'Saneamento de adesões aos programas Caminho da Escola e Mobiliário Escolar.',
        'Acompanhamento e correção sistêmica nas prestações de contas de programas federais.',
        'Revisão técnica de falhas cadastrais no Programa Educação Integral (EI Manutenção).',
        'Elaboração de pareceres e atualização de dados no PDDE (Programa Dinheiro Direto na Escola).',
        'Defesa administrativa e suporte técnico preventivo em processos de Tomada de Contas Especial (TCE).',
        'Gestão de ofícios, diligências e petições junto ao MEC, FNDE e demais órgãos federais.',
        'Auditoria e mapeamento técnico de todas as unidades escolares para mitigação de inconsistências sistêmicas.',
      ],
      financialItems: const [
        ContractFinancialItem(
          description: 'Receita atual FUNDEB',
          value: 8153368.58,
        ),
        ContractFinancialItem(
          description: 'Receita potencial',
          value: 14268395.02,
        ),
        ContractFinancialItem(
          description: 'POTENCIAL DE RECOMPOSIÇÃO',
          value: 6115026.44,
          highlight: true,
        ),
      ],
      honorariosTiers: sampleData.honorariosTiers,
      minimumWageValue: sampleData.minimumWageValue,
      minimumWageLegalBasis: sampleData.minimumWageLegalBasis,
      modality: ContractModality.fixedFee,
      fixedFeeMinimumWages: 6.0,
      networkProfileText: '''
• 13 unidades escolares
• 1.430 matrículas consolidadas no Censo Escolar (Fonte: INEP/MEC)
• Índice de Eficiência Arrecadatória atual: 49,41
• Cobertura de Tempo Integral: 13,6% da rede (indicador com margem de otimização)''',
      diagnosticText: '''
De acordo com levantamento técnico realizado em maio/2026, com base em dados oficiais do SIOPE/FNDE e Censo Escolar/INEP:

• O município apresenta 13 unidades escolares e 1.430 matrículas consolidadas.
• Atualmente não recebe complementação da União (VAAF, VAAT e VAAR = R\$ 0,00).
• Índice de Eficiência Arrecadatória: 49,41.
• Cobertura de Tempo Integral: 13,6% da rede.
• Receita FUNDEB 2026: R\$ 8.153.368,58 (100% de contribuição municipal).

Oportunidades técnicas identificadas:
• Potencial de ampliação de matrículas em EJA e Tempo Integral.
• Revisão dos coeficientes VAAT/VAAR.
• Regularização dos sistemas SIMEC, SIGPC e Habilita-FNDE.
• Habilitação para complementações da União.

Os estudos preliminares indicam potencial técnico de recomposição dos indicadores de financiamento educacional, condicionado à implementação das medidas administrativas, validação dos dados pelos órgãos federais competentes e evolução normativa dos critérios do FUNDEB.''',
      serviceItems: const [
        ContractServiceItem(
          description: 'Assessoria Técnica Mensal',
          unit: 'Mês',
          quantity: 12,
          unitValue: 8472.0,
        ),
      ],
      commercialConditions: const [
        'SLA (Service Level Agreement) Premium: Garantia de resposta técnica em até 24/48 horas úteis para diligências, notificações do FNDE e suporte remoto à equipe gestora, assegurando fluxo contínuo de resultados.',
        'O pagamento dos honorários ocorrerá em valor fixo, atrelado à prestação dos serviços técnicos especializados, garantindo total previsibilidade financeira.',
        'A remuneração independe da constatação ou do efetivo ingresso financeiro de novos recursos, sendo devida pelo cumprimento do escopo técnico, análises e diagnósticos realizados.',
        'Os valores serão pagos com recursos próprios (Fonte 00), não se permitindo a sua dedução direta das rubricas vinculadas da Educação.',
        'Validade da proposta: 60 (sessenta) dias a contar da data de sua assinatura.',
        'Conformidade LGPD e Sigilo Absoluto: Todo diagnóstico e dado municipal transacionado estão sob rígido protocolo de confidencialidade de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).'
      ],
      declarations: const [
        'A empresa possui notória especialização na área de atuação, prestando serviços desta natureza a diversas entidades governamentais.',
        'Os serviços serão prestados com total transparência, assertividade e segurança jurídica dos levantamentos e das projeções apresentadas.',
        'A metodologia dos cálculos está pautada estritamente nas bases de dados, relatórios gerenciais e legislações oficiais do Governo Federal.'
      ],
      contractClauses: const [
        'Cláusula Primeira – Do Objeto: Contratação de pessoa jurídica para prestação de serviços técnicos especializados visando assessorar o Município na gestão, regularização e reestruturação dos sistemas do MEC/FNDE, a reestruturação do Censo Escolar e a regularização de repasses do FUNDEB e programas do FNDE.',
        'Cláusula Segunda – Da Remuneração: Pelos serviços técnicos prestados, o CONTRATANTE pagará à CONTRATADA o valor mensal correspondente a 06 (seis) salários-mínimos vigentes, mediante apresentação de nota fiscal e relatório de atividades. Parágrafo Único: A remuneração aqui estabelecida é de natureza fixa e independe do montante total de recursos recuperados, sendo devida em razão da disponibilidade técnica especializada, suporte aos sistemas MEC/FNDE e elaboração de defesas administrativas e pareceres.',
        'Cláusula Terceira – Da Vigência: Recomenda-se a vigência inicial do contrato por um período de 12 (doze) meses, contados a partir da data de sua assinatura. Os prazos poderão ser prorrogados nos termos do art. 106 da Lei nº 14.133/2021, para continuidade do acompanhamento plurianual dos ciclos do FNDE.',
        'Cláusula Quarta – Das Obrigações da Contratada (Limitação de Responsabilidade): Efetuar o diagnóstico técnico, representar administrativamente o Município perante o FNDE, MEC e demais órgãos federais, elaborando memórias de cálculo, defesas em processos de TCE, e pareceres técnicos pormenorizados. A CONTRATADA não se responsabiliza por inconsistências decorrentes da omissão de informações, ausência de alimentação tempestiva dos sistemas oficiais, fornecimento incompleto de documentos ou decisões administrativas internas do Município.',
        'Cláusula Quinta – Das Obrigações do Contratante (Matriz de Responsabilidades): Fornecer tempestivamente os documentos, dados e acessos aos sistemas governamentais, bem como realizar a alimentação dos sistemas oficiais e validar os planos de ação necessários à execução plena dos serviços contratados.',
        'Cláusula Sexta – Da Governança Institucional: O acompanhamento da execução dar-se-á por meio de comitê técnico formado por pontos focais de ambas as partes, com registro em atas e emissão de relatórios mensais de atividades, assegurando total transparência.',
        'Cláusula Sétima – Da Confidencialidade e LGPD: A Contratada obriga-se a manter sob o mais absoluto sigilo todos os dados, diagnósticos, acessos (senhas de sistemas) e informações estratégicas do Município, em rigorosa conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).',
        'Cláusula Oitava – Da Rescisão: O contrato poderá ser rescindido administrativamente, a qualquer tempo, por razões de interesse público ou descumprimento de cláusulas, mediante notificação formal com antecedência mínima de 30 (trinta) dias, assegurado o contraditório e o pagamento proporcional pelos serviços efetivamente prestados e relatórios entregues até a data do distrato.',
        'Cláusula Nona – Do Foro: Fica eleito o foro da Comarca do Município para dirimir quaisquer controvérsias não solucionadas administrativamente.',
        'Cláusula Décima – Do Reajuste e Reequilíbrio Econômico-Financeiro: O valor contratual será reajustado anualmente pelo INPC/IBGE (ou outro índice oficial substituto), sendo assegurado às partes o direito à recomposição do equilíbrio econômico-financeiro em caso de fatos supervenientes, nos termos da legislação pertinente.'
      ],

      consultingCompanyName: sampleData.consultingCompanyName,
      consultingCompanyCnpj: sampleData.consultingCompanyCnpj,
      consultingCompanyAddress: sampleData.consultingCompanyAddress,
      consultingCompanyContact: sampleData.consultingCompanyContact,
      consultingCompanyRepresentative: sampleData.consultingCompanyRepresentative,
      consultingCompanyRole: sampleData.consultingCompanyRole,
      consultingCompanyArea: sampleData.consultingCompanyArea,
      consultingCompanyShortName: sampleData.consultingCompanyShortName,
    );

    final bytes = await ContratoPremiumPdfBuilder.build(data);
    final file = File('assets/proposta-enterprise-miradouro.pdf');
    await file.writeAsBytes(bytes);
  });
}
