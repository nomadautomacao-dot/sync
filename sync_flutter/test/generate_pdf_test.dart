import 'dart:io';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:sync_flutter/src/features/modules/application/contrato_premium_pdf_builder.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('Generate Premium PDF — Miradouro/MG', () async {
    await initializeDateFormatting('pt_BR');

    final data = PremiumContractData(
      proposalNumber: 'PROP-MIRADOURO-2026',
      clientName: 'PREFEITURA MUNICIPAL DE MIRADOURO/MG',
      clientDocument: '18.188.292/0001-04',
      clientAddress: 'Praca Santa Rita, 288, Centro - Miradouro/MG - CEP 36.880-000',
      processName: 'Contratacao direta - Inexigibilidade de licitacao (Art. 74, III, Lei n 14.133/2021)',
      city: 'Barreiras',
      state: 'BA',
      referenceDate: DateTime(2026, 4, 29),
      validityDays: 60,
      executionTerm: '48 (quarenta e oito) meses, contados a partir da data de assinatura',
      object:
          'Contratação de pessoa jurídica para prestação de serviços técnicos especializados visando: '
          'assessorar o Município na gestão, regularização e reestruturação dos sistemas do Ministério '
          'da Educação (MEC) e do Fundo Nacional de Desenvolvimento da Educação (FNDE), mediante a '
          'análise e correção de dados cadastrais no SIMEC, SIGPC, SIGARP e Habilita-FNDE, a reestruturação '
          'do Censo Escolar e a recuperação de repasses do FUNDEB e programas do FNDE, visando à '
          'maximização dos recursos federais destinados à educação do município de Miradouro/MG.',
      scopeItems: const [
        'Assessoria especializada na regularização e atualização dos sistemas corporativos do FNDE, incluindo SIMEC, SIGPC, SIGARP e HABILITA-FNDE, garantindo a correta habilitação da entidade para recebimento de transferências voluntárias de recursos federais.',
        'Assessoramento especializado no suporte técnico para reestruturação e correção dos dados do Censo Escolar, visando à correta contabilização das matrículas e ao aumento da arrecadação do FUNDEB.',
        'Assessoria técnica para destravamento e acompanhamento de obras paralisadas dos programas PAR e PAC, incluindo regularização de prestação de contas e liberação de novos repasses.',
        'Assessoramento especializado na regularização de adesões aos programas Caminho da Escola (aquisição de ônibus, lanchas e bicicletas escolares) e Mobiliário Escolar.',
        'Assessoria e suporte técnico para acompanhamento das prestações de contas dos programas do FNDE, visando à regularização de pendências e o sucesso na liberação de novos recursos.',
        'Assessoramento especializado na análise e recuperação de repasses do Programa Educação Integral (EI Manutenção).',
        'Assessoria técnica para elaboração de pareceres, cálculos e atualizações de valores, conforme legislação específica do FNDE, para recuperação de créditos referentes a diferenças de repasses do FUNDEB e demais programas federais.',
        'Assessorar no levantamento de dados, diagnóstico, acompanhamento, elaboração de pareceres e atualizações cadastrais para correção de inconsistências no PDDE e demais sistemas vinculados ao FNDE.',
        'Assessoria especializada no atendimento a diligências, notificações e processos de Tomada de Contas Especial (TCE) instaurados pelo FNDE.',
        'Assessorar na análise do cálculo das estimativas de repasses do FUNDEB apresentado pelo FNDE, verificando a correta aplicação dos coeficientes e a integralidade dos valores devidos ao município.',
        'Assessoria na gestão de petições e acompanhamento dos processos junto ao FNDE, MEC e demais órgãos federais responsáveis pela transferência de recursos à educação.',
        'Assessoria na realização de estudo e diagnóstico relacionados ao compartilhamento de infraestrutura escolar e análise dos respectivos convênios e termos de colaboração.',
        'Assessorar e assegurar que todas as unidades escolares sejam verificadas quanto ao correto cadastramento nos sistemas do FNDE, que as matrículas sejam mapeadas e que sejam apuradas eventuais inconsistências.',
      ],
      financialItems: const [
        ContractFinancialItem(
          description: 'INCREMENTO FUNDEB 2026 - Valor atual',
          value: 8153368.58,
        ),
        ContractFinancialItem(
          description: 'INCREMENTO FUNDEB 2027 - Valor projetado apos reestruturacao',
          value: 14268395.02,
        ),
        ContractFinancialItem(
          description: 'TOTAL GERAL A RECUPERAR/INCREMENTAR',
          value: 6115026.44,
          highlight: true,
        ),
        ContractFinancialItem(
          description: 'ESTIMATIVA DE HONORÁRIOS FIXOS',
          value: 9726.00,
          highlight: true,
        ),
      ],
      honorariosTiers: const [
        ContractHonorariosTier(
          label: 'Nível I (até 200 SM de proveito econômico)',
          minimumWages: 200,
          baseValue: 324200.00,
          rate: 0.20,
          feeValue: 64840.00,
        ),
        ContractHonorariosTier(
          label: 'Nível II (de 200 a 2000 SM de proveito econômico)',
          minimumWages: 1800,
          baseValue: 2917800.00,
          rate: 0.10,
          feeValue: 291780.00,
        ),
        ContractHonorariosTier(
          label: 'Nível III (acima de 2000 SM de proveito econômico)',
          minimumWages: 1772.07,
          baseValue: 2873026.44,
          rate: 0.08,
          feeValue: 229842.11,
        ),
      ],
      serviceItems: const [
        ContractServiceItem(
          description: 'Diagnostico, analise e regularizacao dos sistemas SIMEC, SIGPC, SIGARP e HABILITA-FNDE',
          unit: 'SM',
          quantity: 6,
          unitValue: 1621.00,
        ),
      ],
      commercialConditions: const [
        'O pagamento dos honorários ocorrerá em valor fixo mensal, atrelado à prestação dos serviços técnicos especializados, garantindo total previsibilidade financeira.',
        'A remuneração mensal será devida a partir do mês subsequente à assinatura do contrato, estendendo-se até dezembro do ano vigente.',
        'A remuneração independe da constatação ou do efetivo ingresso financeiro de novos recursos, sendo devida pelo cumprimento do escopo técnico, análises e diagnósticos realizados mensamente.',
        'Os valores serão pagos com recursos próprios (Fonte 00), não se permitindo a sua dedução direta das rubricas vinculadas da Educação.',
        'Validade da proposta: 60 (sessenta) dias a contar da data de sua assinatura.'
      ],
      declarations: const [
        'A empresa possui notória especialização na área de atuação, prestando serviços desta natureza a diversas entidades governamentais.',
        'Os serviços serão prestados com total transparência, assertividade e segurança jurídica dos levantamentos e das projeções apresentadas.',
        'A metodologia dos cálculos está pautada estritamente nas bases de dados, relatórios gerenciais e legislações oficiais do Governo Federal.',
      ],
      contractClauses: const [
        'Cláusula Primeira – Do Objeto: Contratação de pessoa jurídica para prestação de serviços técnicos especializados visando assessorar o Município na gestão, regularização e reestruturação dos sistemas do MEC/FNDE.',
        'Cláusula Segunda – Do Valor e Forma de Pagamento: A remuneração é fixada em Salários Mínimos mensais (devidos do mês subsequente à assinatura até dezembro do ano vigente), conforme detalhado no escopo comercial desta proposta, garantindo previsibilidade e segurança jurídica para a execução dos serviços.',
        'Cláusula Terceira – Da Vigência: O presente contrato terá vigência de 48 (quarenta e oito) meses, contados a partir da data de assinatura, podendo ser prorrogado nos termos do art. 106 da Lei nº 14.133/2021.',
        'Cláusula Quarta – Das Obrigações da Contratada: Realizar levantamento dos créditos, representar administrativamente o Município perante o FNDE, MEC e demais órgãos federais.',
        'Cláusula Quinta – Das Obrigações do Contratante: Fornecer documentos, dados e informações necessários à execução dos serviços.',
        'Cláusula Sexta – Da Rescisão: O contrato poderá ser rescindido a qualquer tempo, mediante comunicação prévia de 30 (trinta) dias.',
        'Cláusula Sétima – Do Foro: Fica eleito o foro da Comarca de Miradouro/MG para dirimir quaisquer controvérsias.',
      ],
      minimumWageValue: 1621.00,
      mayorName: 'Cloves da Silva Botelho',
      minimumWageLegalBasis:
          'Salario minimo nacional vigente em 2026: R\$ 1.621,00, conforme Decreto n. 12.797/2025, com vigencia a partir de 1 de janeiro de 2026.',
      modality: ContractModality.fixedFee,
      fixedFeeMinimumWages: 6.0,
    );

    final bytes = await ContratoPremiumPdfBuilder.build(data);
    final file = File('build/docx_review/proposta-enterprise-miradouro.pdf');
    if (!file.parent.existsSync()) {
      file.parent.createSync(recursive: true);
    }
    await file.writeAsBytes(bytes);
    print('PDF generated: ${file.path} (${bytes.length} bytes)');
  });
}
