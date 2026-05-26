import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:sync_flutter/src/features/modules/application/contrato_premium_pdf_builder.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('gera PDF premium de contrato capa a capa', () async {
    await initializeDateFormatting('pt_BR');

    final bytes = await ContratoPremiumPdfBuilder.build(
      ContratoPremiumPdfBuilder.sample(),
    );

    expect(bytes, isNotEmpty);
    await Directory('build').create();
    await File('build/contrato_premium_test.pdf').writeAsBytes(bytes);
  });

  test('gera proposta FUNDEB Miradouro refinada por salarios-minimos', () async {
    await initializeDateFormatting('pt_BR');

    final data = PremiumContractData(
      proposalNumber: 'FUNDEB-3142106/2026',
      clientName: 'Prefeitura Municipal de Miradouro/MG',
      clientDocument: 'CNPJ a confirmar',
      clientAddress: 'Miradouro/MG - Juiz de Fora',
      processName:
          'Proposta de servicos tecnicos especializados FUNDEB/FNDE - 2026',
      city: 'Miradouro',
      state: 'MG',
      referenceDate: DateTime(2026, 4, 28),
      validityDays: 60,
      executionTerm:
          '48 meses, com acompanhamento plurianual dos ciclos FNDE, MEC e FUNDEB',
      object:
          'Contratacao de pessoa juridica para prestacao de servicos tecnicos especializados visando assessorar o Municipio de Miradouro/MG na gestao, regularizacao e reestruturacao dos sistemas do MEC/FNDE, com analise de SIMEC, SIGPC, SIGARP, HABILITA-FNDE, Censo Escolar e potencial recuperacao/incremento de repasses educacionais.',
      scopeItems: const [
        'Diagnostico tecnico dos sistemas MEC/FNDE e das bases educacionais do municipio.',
        'Analise e correcao de inconsistencias no SIMEC, SIGPC, SIGARP e HABILITA-FNDE.',
        'Reestruturacao do Censo Escolar para correta contabilizacao de matriculas e potencial incremento do FUNDEB.',
        'Acompanhamento de pendencias, diligencias, prestacoes de contas e processos administrativos junto ao FNDE/MEC.',
        'Elaboracao de memoria de calculo, pareceres tecnicos e estrategia de recuperacao de valores.',
        'Relatorios executivos de evolucao, evidencias, riscos e proximos passos para tomada de decisao.',
      ],
      financialItems: const [
        ContractFinancialItem(
          description: 'Receita/incremento FUNDEB atual estimado',
          value: 8153368.58,
        ),
        ContractFinancialItem(
          description: 'Receita/incremento projetado apos reestruturacao',
          value: 14268395.02,
        ),
        ContractFinancialItem(
          description: 'Total estimado a recuperar/incrementar (75,00%)',
          value: 6115026.44,
          highlight: true,
        ),
        ContractFinancialItem(
          description: 'Estimativa de honorarios tecnicos progressivos',
          value: 586462.11,
          highlight: true,
        ),
      ],
      honorariosTiers: const [
        ContractHonorariosTier(
          label: 'Nivel I - ate 200 salarios-minimos',
          minimumWages: 200,
          baseValue: 324200,
          rate: 0.20,
          feeValue: 64840,
        ),
        ContractHonorariosTier(
          label: 'Nivel II - de 200 a 2.000 salarios-minimos',
          minimumWages: 1800,
          baseValue: 2917800,
          rate: 0.10,
          feeValue: 291780,
        ),
        ContractHonorariosTier(
          label: 'Nivel III - acima de 2.000 salarios-minimos',
          minimumWages: 1772.38,
          baseValue: 2873026.44,
          rate: 0.08,
          feeValue: 229842.11,
        ),
      ],
      serviceItems: const [
        ContractServiceItem(
          description:
              'Honorarios tecnicos de resultado FUNDEB/FNDE - base em salarios-minimos',
          unit: 'EXITO',
          quantity: 1,
          unitValue: 586462.11,
        ),
      ],
      commercialConditions: const [
        'Validade da proposta: 60 dias.',
        'Pagamento condicionado ao proveito economico efetivo gerado ao municipio.',
        'Honorarios calculados de forma progressiva em faixas de salarios-minimos vigentes.',
        'Risco financeiro zero para o municipio: sem exito mensuravel, nao ha honorarios de resultado.',
        'Valores estimados sujeitos a validacao documental, bases oficiais e tramitacao administrativa.',
      ],
      declarations: const [
        'A estimativa foi estruturada a partir do levantamento FUNDEB disponivel na plataforma Sync.',
        'A contratada utilizara bases oficiais do FNDE, MEC, SIOPE, Censo Escolar e sistemas correlatos.',
        'A proposta considera o prefeito Cloves da Silva Botelho como autoridade municipal de referencia para tratativas institucionais.',
      ],
      contractClauses: const [
        'Das partes: contratante e contratada ficam qualificadas pelos dados constantes desta proposta e documentos anexos.',
        'Do objeto: prestacao de servicos tecnicos especializados em regularizacao de sistemas MEC/FNDE, reestruturacao do Censo Escolar e recuperacao/incremento de repasses educacionais.',
        'Do prazo: recomenda-se vigencia de 48 meses, em razao da natureza plurianual dos ciclos de transferencia, acompanhamento e validacao administrativa.',
        'Do pagamento: os honorarios serao devidos somente sobre valores efetivamente recuperados, incrementados ou compensados em favor do municipio.',
        'Da transparencia: as entregas deverao ser acompanhadas por relatorios, memorias de calculo, evidencias e registros de protocolo quando aplicavel.',
        'Da rescisao: o contrato podera ser rescindido nas hipoteses legais e nas condicoes pactuadas entre as partes.',
      ],
    );

    final bytes = await ContratoPremiumPdfBuilder.build(data);

    expect(bytes, isNotEmpty);
    await Directory('build').create();
    await File(
      'build/contrato-capa-a-capa-FUNDEB-3142106-2026-refinado.pdf',
    ).writeAsBytes(bytes);
  });
}
