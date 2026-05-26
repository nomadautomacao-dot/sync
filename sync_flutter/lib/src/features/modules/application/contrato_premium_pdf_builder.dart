import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

enum ContractModality {
  successFee,
  fixedFee,
}

class ContractServiceItem {
  const ContractServiceItem({
    required this.description,
    required this.unit,
    required this.quantity,
    required this.unitValue,
  });

  final String description;
  final String unit;
  final double quantity;
  final double unitValue;

  double get total => quantity * unitValue;
}

class ContractFinancialItem {
  const ContractFinancialItem({
    required this.description,
    required this.value,
    this.highlight = false,
  });

  final String description;
  final double value;
  final bool highlight;
}

class ContractHonorariosTier {
  const ContractHonorariosTier({
    required this.label,
    required this.minimumWages,
    required this.baseValue,
    required this.rate,
    required this.feeValue,
  });

  final String label;
  final double minimumWages;
  final double baseValue;
  final double rate;
  final double feeValue;
}

class PremiumContractData {
  const PremiumContractData({
    required this.proposalNumber,
    required this.clientName,
    required this.clientDocument,
    required this.clientAddress,
    this.mayorName,
    required this.processName,
    required this.city,
    required this.state,
    required this.referenceDate,
    required this.validityDays,
    required this.executionTerm,
    required this.object,
    required this.scopeItems,
    this.financialItems = const <ContractFinancialItem>[],
    this.honorariosTiers = const <ContractHonorariosTier>[],
    this.minimumWageValue = ContratoPremiumPdfBuilder.minimumWage2026,
    this.minimumWageLegalBasis =
        ContratoPremiumPdfBuilder.minimumWage2026LegalBasis,
    required this.serviceItems,
    required this.commercialConditions,
    required this.declarations,
    required this.contractClauses,
    this.modality = ContractModality.successFee,
    this.fixedFeeMinimumWages,
    this.networkProfileText,
    this.diagnosticText,
    this.consultingCompanyName = 'ROCHA PRIME SERVIÇOS ESPECIALIZADOS LTDA',
    this.consultingCompanyCnpj = '29.342.691/0001-93',
    this.consultingCompanyAddress = 'Rua Planalto, nº 305, Sandra Regina\nCEP 47.802-064 - Barreiras/BA',
    this.consultingCompanyContact = '(61) 99866-7834 | comercial@rochaprime.com.br',
    this.consultingCompanyRepresentative = 'Paulo Ferreira da Rocha',
    this.consultingCompanyRole = 'Diretor Executivo',
    this.consultingCompanyArea = 'Consultoria em gestão pública educacional, assessoria em regularização técnico-financeira, inteligência em financiamento educacional (FUNDEB/FNDE).',
    this.consultingCompanyShortName = 'ROCHA PRIME',
  });

  final String proposalNumber;
  final String clientName;
  final String clientDocument;
  final String clientAddress;
  final String? mayorName;
  final String processName;
  final String city;
  final String state;
  final DateTime referenceDate;
  final int validityDays;
  final String executionTerm;
  final String object;
  final List<String> scopeItems;
  final List<ContractFinancialItem> financialItems;
  final List<ContractHonorariosTier> honorariosTiers;
  final double minimumWageValue;
  final String minimumWageLegalBasis;
  final List<ContractServiceItem> serviceItems;
  final List<String> commercialConditions;
  final List<String> declarations;
  final List<String> contractClauses;
  final ContractModality modality;
  final double? fixedFeeMinimumWages;
  final String? networkProfileText;
  final String? diagnosticText;
  final String consultingCompanyName;
  final String consultingCompanyCnpj;
  final String consultingCompanyAddress;
  final String consultingCompanyContact;
  final String consultingCompanyRepresentative;
  final String consultingCompanyRole;
  final String consultingCompanyArea;
  final String consultingCompanyShortName;

  double get total =>
      serviceItems.fold<double>(0, (sum, item) => sum + item.total);
}

class ContratoPremiumPdfBuilder {
  static const double minimumWage2026 = 1621;
  static const String minimumWage2026LegalBasis =
      'Salario minimo nacional vigente em 2026: R\$ 1.621,00, conforme Decreto n. 12.797/2025, com vigencia a partir de 1 de janeiro de 2026.';
  static const PdfColor _navy = PdfColor.fromInt(0xFF071D34);
  static const PdfColor _navy2 = PdfColor.fromInt(0xFF0D2D4F);
  static const PdfColor _gold = PdfColor.fromInt(0xFFC9A354);
  static const PdfColor _goldSoft = PdfColor.fromInt(0xFFF7E8C5);
  static const PdfColor _ink = PdfColor.fromInt(0xFF182236);
  static const PdfColor _muted = PdfColor.fromInt(0xFF667085);
  static const PdfColor _line = PdfColor.fromInt(0xFFD8DEE8);
  static const PdfColor _paper = PdfColor.fromInt(0xFFFAFBFD);
  static const PdfColor _white = PdfColor.fromInt(0xFFFFFFFF);

  static final NumberFormat _currency = NumberFormat.currency(
    locale: 'pt_BR',
    symbol: 'R\$',
  );
  static final DateFormat _longDate = DateFormat("d 'de' MMMM 'de' y", 'pt_BR');
  static pw.Font? _interFont;

  static PremiumContractData sample() {
    return PremiumContractData(
      proposalNumber: '012/2026',
      clientName: 'Consorcio Intermunicipal de Infraestrutura',
      clientDocument: '00.000.000/0001-00',
      clientAddress: 'Rua das Flores, n 100, Centro',
      processName: 'Concorrencia Publica n 012/2026',
      city: 'Belo Horizonte',
      state: 'MG',
      referenceDate: DateTime(2026, 4, 29),
      validityDays: 60,
      executionTerm: '12 meses, contados da assinatura do contrato',
      object:
          'Contratacao de empresa especializada para prestacao de servicos tecnicos, operacionais e administrativos, com fornecimento de equipe, ferramentas e relatorios executivos.',
      scopeItems: const [
        'Diagnostico inicial, plano de mobilizacao e abertura de projeto.',
        'Gestao de entregas tecnicas, evidencias, cronograma e rotinas de acompanhamento.',
        'Apoio administrativo, reunioes executivas e relatorios de performance.',
        'Padronizacao documental para proposta, contrato, declaracoes e anexos.',
      ],
      financialItems: const [
        ContractFinancialItem(
          description: 'Receita FUNDEB 2026 - valor atual',
          value: 8153368.58,
        ),
        ContractFinancialItem(
          description: 'Receita FUNDEB 2027 - valor projetado',
          value: 14268395.02,
        ),
        ContractFinancialItem(
          description: 'Total geral a recuperar/incrementar',
          value: 6115026.44,
          highlight: true,
        ),
        ContractFinancialItem(
          description: 'Estimativa de honorarios tecnicos',
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
          minimumWages: 1772.378,
          baseValue: 2873026.44,
          rate: 0.08,
          feeValue: 229842.11,
        ),
      ],
      serviceItems: const [
        ContractServiceItem(
          description: 'Manutencao predial preventiva',
          unit: 'MES',
          quantity: 12,
          unitValue: 18450,
        ),
        ContractServiceItem(
          description: 'Manutencao predial corretiva',
          unit: 'MES',
          quantity: 12,
          unitValue: 16800,
        ),
        ContractServiceItem(
          description: 'Servicos de alvenaria',
          unit: 'M2',
          quantity: 1000,
          unitValue: 68.50,
        ),
        ContractServiceItem(
          description: 'Servicos de pintura',
          unit: 'M2',
          quantity: 1000,
          unitValue: 35.90,
        ),
        ContractServiceItem(
          description: 'Instalacoes eletricas',
          unit: 'PONTO',
          quantity: 800,
          unitValue: 45,
        ),
        ContractServiceItem(
          description: 'Apoio operacional',
          unit: 'MES',
          quantity: 12,
          unitValue: 9350,
        ),
      ],
      commercialConditions: const [
        'Validade da proposta: 60 dias.',
        'Condicoes de pagamento: conforme medicoes mensais aprovadas.',
        'Prazo de execucao: conforme ordem de servico e cronograma pactuado.',
        'Impostos e encargos inclusos nos valores apresentados.',
        'Garantia dos servicos conforme edital, contrato e legislacao aplicavel.',
      ],
      declarations: const [
        'Os precos contemplam custos diretos, tributos, encargos trabalhistas, materiais e suporte operacional.',
        'A empresa aceita integralmente as condicoes do edital e seus anexos.',
        'A equipe tecnica sera disponibilizada conforme cronograma de mobilizacao aprovado.',
      ],
      contractClauses: const [
        'Das partes: contratante e contratada ficam qualificadas pelos dados constantes desta proposta e documentos anexos.',
        'Do objeto: prestacao de servicos tecnicos e operacionais descritos nesta proposta, em conformidade com as exigencias do processo.',
        'Do prazo: vigencia de 12 meses, podendo ser prorrogada conforme legislacao aplicavel.',
        'Do pagamento: as medicoes serao apresentadas mensalmente e pagas apos aprovacao da contratante.',
        'Da rescisao: o contrato podera ser rescindido nas hipoteses previstas em lei e nas condicoes pactuadas.',
      ],
    );
  }

  static Future<Uint8List> build(PremiumContractData data) async {
    final font = await _loadPdfFont();
    final logoWhiteSvg = await _loadLogoSvg(isWhite: true);
    final logoBlueSvg = await _loadLogoSvg(isWhite: false);
    final coverBg = await _loadCoverBgPng();
    final generatedAt = DateTime.now();

    final pdf = pw.Document(
      title: 'Proposta Comercial e Técnica — ${data.clientName}',
      author: data.consultingCompanyName,
      subject: 'Proposta comercial e contrato de prestação de serviços',
    );

    pdf.addPage(_coverPage(data, font, logoWhiteSvg, coverBg));
    _sectionCounter = 0; // reset numbered sections
    pdf.addPage(
      pw.MultiPage(
        pageTheme: _contentTheme(
          font: font,
          logoSvg: logoBlueSvg,
          generatedAt: generatedAt,
          clientName: data.clientName,
          consultingCompanyName: data.consultingCompanyName,
        ),
        build: (context) => [
          // 1. SUMÁRIO EXECUTIVO (impacto — página dedicada)
          ..._impactSection(data),
          _pageBreak(),
          
          // 2. PROVA SOCIAL / CASES DE SUCESSO
          _sectionTitle('Cases de Sucesso em Destaque'),
          _successCaseSitioDoMato(),
          pw.SizedBox(height: 12),
          _successCaseCoribe(),
          pw.SizedBox(height: 16),
          pw.Container(
            padding: const pw.EdgeInsets.all(12),
            decoration: pw.BoxDecoration(
              color: const PdfColor.fromInt(0xFFF9FAFB),
              border: pw.Border.all(color: _line, width: 0.6),
              borderRadius: pw.BorderRadius.circular(6),
            ),
            child: pw.Text(
              'Aviso Legal: Os estudos, projeções e estimativas apresentados possuem caráter técnico-preliminar e indicativo, baseados em dados oficiais disponíveis à época da análise, não constituindo garantia de ingresso financeiro futuro, uma vez que os resultados dependem de fatores administrativos, operacionais, normativos e da validação pelos órgãos federais competentes.',
              style: const pw.TextStyle(color: _muted, fontSize: 7, lineSpacing: 1.5),
            ),
          ),
          _pageBreak(),

          // 3. DO OBJETO + VISÃO GERAL
          _sectionTitle('Do Objeto'),
          pw.Container(
            padding: const pw.EdgeInsets.all(14),
            decoration: pw.BoxDecoration(
              color: const PdfColor.fromInt(0xFFF9FAFB),
              border: pw.Border(left: pw.BorderSide(color: _navy, width: 3)),
            ),
            child: _paragraph(data.object),
          ),
          pw.SizedBox(height: 24),
          _sectionTitle('Fases de Implementação e Metodologia'),
          _methodologyPhases(),
          pw.SizedBox(height: 32),
          _sectionTitle('Eixos de Atuação'),
          _eixosAtuacao(),
          pw.SizedBox(height: 36),
          _sectionTitle('Cronograma Executivo Trimestral'),
          pw.SizedBox(height: 12),
          _executionTimeline(),
          pw.SizedBox(height: 32),
          _sectionTitle('Matriz de Entregáveis'),
          pw.SizedBox(height: 12),
          _deliverablesMatrix(),
          _pageBreak(),

          // 3. MODELO DE REMUNERAÇÃO (honorários + risco zero)
          if (data.modality == ContractModality.successFee && data.honorariosTiers.isNotEmpty) ...[
            _sectionTitle('Modelo de Remuneração'),
            _minimumWageBox(data),
            pw.SizedBox(height: 14),
            _honorariosBreakdownTable(data.honorariosTiers),
            pw.SizedBox(height: 48),
            _riscoZeroSection(),
            _pageBreak(),
          ] else if (data.modality == ContractModality.fixedFee) ...[
            _sectionTitle('Modelo de Remuneração'),
            _minimumWageBox(data),
            pw.SizedBox(height: 14),
            _fixedFeeBox(data.fixedFeeMinimumWages ?? 0, data.minimumWageValue, data.referenceDate),
            pw.SizedBox(height: 48),
            _fixedFeeConditionsSection(),
            _pageBreak(),
          ],

          // 5. FUNDAMENTAÇÃO JURÍDICA
          _legalGroundingSection(),
          _pageBreak(),

          // 6. SOBRE A EMPRESA
          _sectionTitle('Sobre a Empresa e Equipe Multidisciplinar'),
          _keyValueGrid([
            ('Razão Social', data.consultingCompanyName.toUpperCase()),
            ('CNPJ', data.consultingCompanyCnpj),
            ('Endereço', data.consultingCompanyAddress),
            ('Telefone / E-mail', data.consultingCompanyContact),
            ('Representante Legal', '${data.consultingCompanyRepresentative}\n${data.consultingCompanyRole}'),
            ('Área de Atuação', data.consultingCompanyArea),
          ]),
          pw.SizedBox(height: 24),
          _equipeMultidisciplinar(),
          _pageBreak(),
          // 7. CONDIÇÕES GERAIS
          _sectionTitle('Condições Gerais'),
          ...data.commercialConditions.map(_bullet),
          pw.SizedBox(height: 20),
          _paragraph('Declaramos, para os devidos fins, que:'),
          pw.SizedBox(height: 8),
          ...data.declarations.map(_bullet),
          pw.SizedBox(height: 28),
          _paragraph(
            '${data.city} - ${data.state}, ${_longDate.format(data.referenceDate)}.',
          ),
          pw.SizedBox(height: 24),
          _signatureBlock('${data.consultingCompanyRepresentative}\n${data.consultingCompanyRole}', data.consultingCompanyName.toUpperCase()),
          _pageBreak(),
          _methodologyAnnex(data),
          // ── ANEXO: CONTRATO ──
          _pageBreak(),
          _annexTitle('ANEXO II — CONTRATO DE PRESTAÇÃO DE SERVIÇOS'),
          _paragraph(
            'Pelo presente instrumento particular, as partes a seguir identificadas têm entre si, justo e contratado o que se segue:',
          ),
          pw.SizedBox(height: 12),
          ...data.contractClauses.map(_numberedClause),
          pw.SizedBox(height: 24),
          _paragraph(
            'E, por estarem justas e contratadas, as partes firmam o presente instrumento em 2 (duas) vias de igual teor e forma.',
          ),
          pw.SizedBox(height: 12),
          pw.Align(
            alignment: pw.Alignment.center,
            child: pw.Text(
              '${data.city} - ${data.state}, ${_longDate.format(data.referenceDate)}.',
              style: const pw.TextStyle(color: _ink, fontSize: 10),
            ),
          ),
          pw.SizedBox(height: 36),
          _dualSignatures(data),
        ],
      ),
    );

    return pdf.save();
  }

  static pw.Page _coverPage(
    PremiumContractData data,
    pw.Font font,
    String? logoSvg,
    pw.MemoryImage? coverBg,
  ) {
    return pw.Page(
      pageTheme: pw.PageTheme(
        pageFormat: PdfPageFormat.a4,
        margin: pw.EdgeInsets.zero,
        theme: _pdfTheme(font),
      ),
      build: (context) {
        return pw.Stack(
          children: [
            if (coverBg != null)
              pw.Positioned.fill(child: pw.Image(coverBg, fit: pw.BoxFit.cover))
            else
              pw.Positioned.fill(child: pw.Container(color: _navy)),
            pw.Padding(
              padding: const pw.EdgeInsets.fromLTRB(48, 48, 48, 36),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  if (logoSvg != null)
                    pw.Container(
                      height: 80,
                      child: pw.SvgImage(svg: logoSvg, fit: pw.BoxFit.contain),
                    )
                  else
                    pw.Text(data.consultingCompanyShortName.toUpperCase(), style: pw.TextStyle(
                      color: _white, fontSize: 14,
                      fontWeight: pw.FontWeight.bold, letterSpacing: 1,
                    )),
                  pw.Spacer(),
                  pw.Text(
                    'Otimização e Regularização\nde Repasses Federais\nna Educação Municipal',
                    style: pw.TextStyle(
                      color: _white, fontSize: 28,
                      fontWeight: pw.FontWeight.bold, lineSpacing: 4,
                    ),
                  ),
                  pw.Spacer(),
                  pw.Container(height: 0.6, color: PdfColor.fromInt(0x44FFFFFF)),
                  pw.SizedBox(height: 16),
                  pw.Text(data.clientName.toUpperCase(), style: pw.TextStyle(
                    color: _white, fontSize: 11,
                    fontWeight: pw.FontWeight.bold, letterSpacing: 0.5,
                  )),
                  if (data.mayorName != null) ...[
                    pw.SizedBox(height: 4),
                    pw.Text('Exmo. Prefeito Municipal Sr. ${data.mayorName}', style: const pw.TextStyle(
                      color: _white, fontSize: 10,
                    )),
                  ],
                  pw.SizedBox(height: 6),
                  pw.Row(children: [
                    pw.Text(
                      '${data.city} - ${data.state}  |  ${_longDate.format(data.referenceDate)}',
                      style: const pw.TextStyle(color: PdfColor.fromInt(0xAAFFFFFF), fontSize: 9),
                    ),
                    pw.Spacer(),
                    pw.Container(
                      padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: pw.BoxDecoration(
                        border: pw.Border.all(color: _gold, width: 0.6),
                        borderRadius: pw.BorderRadius.circular(3),
                      ),
                      child: pw.Text('DOCUMENTO CONFIDENCIAL', style: pw.TextStyle(
                        color: _gold, fontSize: 5.5,
                        fontWeight: pw.FontWeight.bold, letterSpacing: 0.5,
                      )),
                    ),
                  ]),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  static String _compactMoney(double value) {
    if (value >= 1000000) {
      return '${(value / 1000000).toStringAsFixed(1).replaceAll('.', ',')} milhoes';
    }
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(0)} mil';
    return value.toStringAsFixed(0);
  }

  static List<pw.Widget> _impactSection(PremiumContractData data) {
    final baseAtual = data.financialItems.isNotEmpty ? _currency.format(data.financialItems.first.value) : '-';
    final projetado = data.financialItems.length > 1 ? _currency.format(data.financialItems[1].value) : '-';
    final ganho = data.financialItems.length > 2 ? _currency.format(data.financialItems[2].value) : '-';
    final honorarios = data.financialItems.length > 3 ? _currency.format(data.financialItems[3].value) : '-';

    final fee = data.modality == ContractModality.fixedFee && data.fixedFeeMinimumWages != null
        ? _currency.format(data.fixedFeeMinimumWages! * data.minimumWageValue)
        : (data.serviceItems.isNotEmpty ? _currency.format(data.serviceItems[0].quantity * data.serviceItems[0].unitValue) : 'R\$ 14.500,00');

    return [
      _sectionTitle('Sumário Executivo'),
      pw.SizedBox(height: 8),
      _paragraph('A ${data.consultingCompanyName.toUpperCase()} apresenta proposta de assessoria especializada mensal para a Prefeitura Municipal de ${data.city}/${data.state}.'),
      
      if (data.networkProfileText != null) ...[
        pw.SizedBox(height: 12),
        pw.Text('Perfil da Rede Municipal:', style: pw.TextStyle(color: _navy, fontSize: 10, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 6),
        _paragraph(data.networkProfileText!),
      ],

      pw.SizedBox(height: 16),
      pw.Text('Potencial Financeiro Identificado:', style: pw.TextStyle(color: _navy, fontSize: 10, fontWeight: pw.FontWeight.bold)),
      pw.SizedBox(height: 6),
      pw.Container(
        padding: const pw.EdgeInsets.all(12),
        decoration: pw.BoxDecoration(
          color: const PdfColor.fromInt(0xFFF9FAFB),
          border: pw.Border.all(color: _line, width: 0.6),
          borderRadius: pw.BorderRadius.circular(6),
        ),
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text('• Receita Atual FUNDEB: $baseAtual', style: const pw.TextStyle(color: _ink, fontSize: 9)),
            pw.SizedBox(height: 4),
            pw.Text('• Receita Potencial: até $projetado', style: const pw.TextStyle(color: _ink, fontSize: 9)),
            pw.SizedBox(height: 4),
            pw.Text('• Potencial de Recomposição: $ganho', style: pw.TextStyle(color: _gold, fontSize: 10, fontWeight: pw.FontWeight.bold)),
          ]
        ),
      ),
      pw.SizedBox(height: 16),
      _paragraph('Por um investimento mensal fixo de apenas ${data.fixedFeeMinimumWages != null ? data.fixedFeeMinimumWages!.toInt() : 6} salários-mínimos ($fee), o Município garante uma assessoria de alto nível cujo custo representa menos de 0,15% da recomposição arrecadatória projetada, eliminando qualquer barreira orçamentária para a regularização imediata da educação.', bold: true),
      
      if (data.diagnosticText != null) ...[
        pw.SizedBox(height: 32),
        _sectionTitle('Diagnóstico Preliminar de ${data.city}'),
        pw.SizedBox(height: 8),
        _paragraph(data.diagnosticText!),
        pw.SizedBox(height: 12),
        pw.Text('*Nota: Os valores de recomposição são estimativas baseadas em análises técnicas preliminares e dependem da efetiva execução das ações de regularização e das variações nos índices do FUNDEB.', style: const pw.TextStyle(color: _muted, fontSize: 8, fontStyle: pw.FontStyle.italic)),
      ],
    ];
  }

  static pw.Widget _impactCard(String label, String value, String helper, PdfColor accent) {
    return pw.Container(
      height: 74, padding: const pw.EdgeInsets.all(12),
      decoration: pw.BoxDecoration(
        color: _white, 
        border: pw.Border.all(color: _line, width: 0.6), 
        borderRadius: pw.BorderRadius.circular(8)
      ),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Text(label.toUpperCase(), style: pw.TextStyle(color: accent, fontSize: 7, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 10),
        pw.Text(value, style: pw.TextStyle(color: _navy, fontSize: 15, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 6),
        pw.Text(helper, style: const pw.TextStyle(color: _ink, fontSize: 7.1)),
      ]),
    );
  }

  static pw.Widget _eixosAtuacao() {
    const eixos = [
      ('REGULARIZAÇÃO DE SISTEMAS', 'Habilitação e saneamento de pendências no SIMEC, SIGPC, SIGARP e HABILITA-FNDE.'),
      ('DESTRAVAMENTO DE PROJETOS', 'Retomada de obras e acesso a recursos do PAR, PAC, PDDE e Caminho da Escola.'),
      ('REVISÃO TÉCNICA DE REPASSES', 'Identificação e regularização técnica de repasses do PNAE, PNATE e QSE.'),
      ('CENSO ESCOLAR / FUNDEB', 'Reestruturação de dados e correção de matrículas para otimização dos indicadores do Novo FUNDEB.'),
    ];
    return pw.Wrap(spacing: 10, runSpacing: 10, children: eixos.map((e) => pw.Container(
      width: 244, padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(color: _paper, border: pw.Border.all(color: _line, width: 0.5), borderRadius: pw.BorderRadius.circular(10)),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Container(width: 6, height: 6, decoration: const pw.BoxDecoration(color: _gold, shape: pw.BoxShape.circle)),
        pw.SizedBox(height: 10),
        pw.Text(e.$1, style: pw.TextStyle(color: _navy, fontSize: 8.5, fontWeight: pw.FontWeight.bold, letterSpacing: 0.3)),
        pw.SizedBox(height: 6),
        pw.Text(e.$2, style: const pw.TextStyle(color: _ink, fontSize: 8.5, lineSpacing: 1.8)),
      ]),
    )).toList());
  }

  static pw.Widget _methodologyPhases() {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        _phaseBox(
          'Fase 1: Diagnóstico e Planejamento (30 a 60 dias)',
          '• Auditoria completa em todos os sistemas (SIMEC, SIGPC, SIGARP, Habilita-FNDE, Censo Escolar e SIOPE)\n• Mapeamento de todas as unidades escolares\n• Relatório executivo com pendências, inconsistências e oportunidades quantificadas\n• Apresentação de Plano de Ação Priorizado',
        ),
        pw.SizedBox(height: 12),
        _phaseBox(
          'Fase 2: Execução Estratégica (meses 2 a 12)',
          '• Correção cadastral massiva e reestruturação do Censo Escolar\n• Abertura e acompanhamento de processos administrativos junto ao FNDE/MEC\n• Defesa em eventuais Tomadas de Contas Especiais (TCE)\n• Regularização de adesões (Caminho da Escola, PDDE, PNAE, etc.)',
        ),
        pw.SizedBox(height: 12),
        _phaseBox(
          'Fase 3: Monitoramento Contínuo e Autonomia (a partir do 6º mês)',
          '• Acompanhamento mensal dos repasses e ciclos do FNDE\n• Suporte remoto ilimitado + 3 a 4 visitas presenciais por ano\n• Capacitação técnica da equipe municipal (secretaria e diretores)\n• Relatórios mensais de performance e KPIs',
        ),
        pw.SizedBox(height: 16),
        pw.Container(
          padding: const pw.EdgeInsets.all(12),
          decoration: pw.BoxDecoration(
            color: const PdfColor.fromInt(0xFFF9FAFB),
            border: pw.Border.all(color: _line, width: 0.6),
            borderRadius: pw.BorderRadius.circular(6),
          ),
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text('KPIs Principais:', style: pw.TextStyle(color: _navy, fontSize: 9, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 6),
              pw.Text(
                '• Percentual de sistemas regularizados\n• Quantidade de matrículas ajustadas e validadas\n• Valor de recursos liberados/recuperados\n• Redução de pendências e notificações',
                style: const pw.TextStyle(color: _ink, fontSize: 8.5, lineSpacing: 1.5),
              ),
            ]
          )
        ),
      ],
    );
  }

  static pw.Widget _phaseBox(String title, String description) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(12),
      decoration: pw.BoxDecoration(
        color: _white,
        border: pw.Border(left: pw.BorderSide(color: _gold, width: 3)),
        boxShadow: [
          pw.BoxShadow(color: const PdfColor.fromInt(0x0A000000), blurRadius: 4, spreadRadius: 0, offset: const PdfPoint(0, 2))
        ]
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(title, style: pw.TextStyle(color: _navy, fontSize: 10, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 4),
          pw.Text(description, style: const pw.TextStyle(color: _ink, fontSize: 9, lineSpacing: 1.5)),
        ],
      ),
    );
  }

  static pw.Widget _successCaseSitioDoMato() {
    return pw.Container(
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
        color: _white,
        border: pw.Border.all(color: _line, width: 0.6),
        borderRadius: pw.BorderRadius.circular(8),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text('Estudo Institucional: Sítio do Mato / BA', style: pw.TextStyle(color: _navy, fontSize: 11, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 4),
          pw.Text('Reestruturação Educacional e Ampliação de Cobertura (Atuação em 2025 -> Efeito 2026)', style: const pw.TextStyle(color: _muted, fontSize: 9)),
          pw.SizedBox(height: 16),
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('EVOLUÇÃO DE MATRÍCULAS', style: pw.TextStyle(color: _navy, fontSize: 8, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 8),
                    _statRow('EJA (Educação de Jovens e Adultos)', '273', '725', 'Expansão de acesso'),
                    pw.SizedBox(height: 8),
                    _statRow('Tempo Integral', '96', '591', 'Evolução estrutural'),
                  ],
                ),
              ),
              pw.SizedBox(width: 24),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('EVOLUÇÃO DOS INDICADORES FINANCEIROS', style: pw.TextStyle(color: _navy, fontSize: 8, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 8),
                    _statRow('Complementação da União', 'R\$ 10,75 mi', 'R\$ 28,75 mi', 'Otimização de repasse'),
                    pw.SizedBox(height: 8),
                    _statRow('Receita Total FUNDEB', 'R\$ 27,53 mi', 'R\$ 49,40 mi', 'Crescimento consolidado'),
                  ],
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 16),
          pw.Text(
            '\"O município passou por uma reestruturação profunda em 2025, ampliando o acesso à EJA e ao tempo integral, refletindo em 2026 em uma evolução sustentável dos indicadores e complementações da União.\"',
            style: pw.TextStyle(color: _ink, fontSize: 9, fontStyle: pw.FontStyle.italic),
          ),
          pw.SizedBox(height: 8),
          pw.Text('Fonte: SIOPE/FNDE e Censo Escolar/INEP — dados extraídos em abril/2026.', style: const pw.TextStyle(color: _muted, fontSize: 7)),
        ],
      ),
    );
  }

  static pw.Widget _successCaseCoribe() {
    return pw.Container(
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
        color: _white,
        border: pw.Border.all(color: _line, width: 0.6),
        borderRadius: pw.BorderRadius.circular(8),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text('Estudo Institucional: Coribe / BA', style: pw.TextStyle(color: _navy, fontSize: 11, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 4),
          pw.Text('Otimização de Base Sistêmica (Atuação em 2025 -> Efeito 2026)', style: const pw.TextStyle(color: _muted, fontSize: 9)),
          pw.SizedBox(height: 16),
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('EVOLUÇÃO DE MATRÍCULAS', style: pw.TextStyle(color: _navy, fontSize: 8, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 8),
                    _statRow('EJA (Educação de Jovens e Adultos)', '43', '161', 'Expansão de acesso'),
                    pw.SizedBox(height: 8),
                    _statRow('Tempo Integral', '271', '2.088', 'Expansão expressiva'),
                  ],
                ),
              ),
              pw.SizedBox(width: 24),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('EVOLUÇÃO DOS INDICADORES FINANCEIROS', style: pw.TextStyle(color: _navy, fontSize: 8, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 8),
                    _statRow('Complementação da União', 'R\$ 9,89 mi', 'R\$ 27,27 mi', 'Otimização de repasse'),
                    pw.SizedBox(height: 8),
                    _statRow('Receita Total FUNDEB', 'R\$ 22,73 mi', 'R\$ 47,36 mi', 'Crescimento consolidado'),
                  ],
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 16),
          pw.Text(
            '\"A revisão sistêmica da rede municipal proporcionou a correta adequação das informações educacionais, garantindo uma otimização institucional dos repasses do FUNDEB no ano subsequente.\"',
            style: pw.TextStyle(color: _ink, fontSize: 9, fontStyle: pw.FontStyle.italic),
          ),
          pw.SizedBox(height: 8),
          pw.Text('Fonte: SIOPE/FNDE e Censo Escolar/INEP — dados extraídos em abril/2026.', style: const pw.TextStyle(color: _muted, fontSize: 7)),
        ],
      ),
    );
  }

  static pw.Widget _statRow(String label, String antes, String depois, String crescimento) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(label, style: const pw.TextStyle(color: _ink, fontSize: 8.5)),
        pw.SizedBox(height: 2),
        pw.Row(
          children: [
            pw.Text(antes, style: const pw.TextStyle(color: _muted, fontSize: 9, decoration: pw.TextDecoration.lineThrough)),
            pw.SizedBox(width: 6),
            pw.Text('->', style: const pw.TextStyle(color: _muted, fontSize: 9)),
            pw.SizedBox(width: 6),
            pw.Text(depois, style: pw.TextStyle(color: _navy, fontSize: 10, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(width: 8),
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: pw.BoxDecoration(color: const PdfColor.fromInt(0xFFEDF7EF), borderRadius: pw.BorderRadius.circular(4)),
              child: pw.Text(crescimento, style: pw.TextStyle(color: const PdfColor.fromInt(0xFF0F5A2A), fontSize: 8, fontWeight: pw.FontWeight.bold)),
            ),
          ],
        ),
      ],
    );
  }

  static pw.Widget _methodologyAnnex(PremiumContractData data) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        _annexTitle('ANEXO I – METODOLOGIA DE LEVANTAMENTO DE DADOS E FONTES OFICIAIS'),
        _paragraph('Para garantir a transparência, acurácia e segurança jurídica dos levantamentos preliminares e das projeções de recomposição de receita apresentadas nesta proposta, a equipe técnica da ${data.consultingCompanyName.toUpperCase()} pauta os seus estudos nas bases de dados, relatórios gerenciais e legislações oficiais do Governo Federal.'),
        pw.SizedBox(height: 12),
        _paragraph('Abaixo, detalhamos as rubricas e programas educacionais analisados para a composição do proveito econômico estimado, bem como as respectivas fontes governamentais de extração de dados e diretrizes utilizadas:'),
        pw.SizedBox(height: 24),
        _annexSubTitle('1. Complementações da União (Novo FUNDEB)'),
        _paragraph('A reestruturação dos dados do Censo Escolar e do SIOPE impacta diretamente as três modalidades de complementação da União ao FUNDEB:'),
        pw.SizedBox(height: 12),
        _methodologyItem('VAAF', 'Valor Anual por Aluno – Fundo', 'Fonte oficial: gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/vaaf', 'Referência Técnica: Diretrizes de cálculo e distribuição.'),
        _methodologyItem('VAAT', 'Valor Anual Total por Aluno', 'Fonte oficial: gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/vaat', 'Referência Técnica: Indicadores para repasse de recursos visando a redução de desigualdades educacionais.'),
        _methodologyItem('VAAR', 'Valor Anual por Aluno – Resultados', 'Fonte oficial: FNDE - Condicionalidades para o recebimento da complementação FUNDEB-VAAR', 'Referência Técnica: Critérios e condicionalidades de gestão para o recebimento da complementação por melhoria de resultados.'),
        pw.SizedBox(height: 24),
        _annexSubTitle('2. Programas Suplementares e Repasses Federais (FNDE)'),
        _paragraph('O saneamento de pendências no SIMEC, SIGPC e HABILITA-FNDE visa o destravamento e a otimização dos seguintes programas complementares:'),
        pw.SizedBox(height: 12),
        _methodologyItem('QSE', 'Quota do Salário-Educação', 'Fonte oficial: gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/salario-educacao', 'Referência Técnica: Repasses automáticos para financiamento de programas e ações na educação básica.'),
        _methodologyItem('PDDE', 'Programa Dinheiro Direto na Escola', 'Fonte oficial: gov.br/mec/pt-br/pdde', 'Referência Técnica: Assistência financeira suplementar e regularização de conselhos escolares.'),
        _methodologyItem('PNAE', 'Programa Nacional de Alimentação Escolar', 'Fonte oficial: gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/programas/pnae', 'Referência Técnica: Atualização cadastral para garantia de repasses da alimentação escolar.'),
        _methodologyItem('PNATE', 'Programa Nacional de Apoio ao Transporte do Escolar', 'Fonte oficial: gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/programas/pnate', 'Referência Técnica: Liberação de custeio para o transporte de estudantes da rede pública.'),
      ],
    );
  }

  static pw.Widget _methodologyItem(String title, String subtitle, String source, [String? reference]) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 12),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(
            width: 50,
            child: pw.Text(title, style: pw.TextStyle(color: _navy, fontSize: 10, fontWeight: pw.FontWeight.bold)),
          ),
          pw.Expanded(
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(subtitle, style: pw.TextStyle(color: _ink, fontSize: 10, fontWeight: pw.FontWeight.bold)),
                if (reference != null) ...[
                  pw.SizedBox(height: 2),
                  pw.Text(reference, style: const pw.TextStyle(color: _ink, fontSize: 8.5)),
                ],
                pw.SizedBox(height: 2),
                pw.Text(source, style: const pw.TextStyle(color: _muted, fontSize: 8.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _annexSubTitle(String title) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 12),
      child: pw.Text(
        title,
        style: pw.TextStyle(
          color: _navy2,
          fontSize: 12,
          fontWeight: pw.FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  static pw.Widget _legalGroundingSection() {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        _sectionTitle('Fundamentação Jurídica da Contratação'),
        pw.SizedBox(height: 16),
        _paragraph('A presente contratação enquadra-se como serviço técnico especializado de natureza predominantemente intelectual, nos termos do art. 6º, inciso XVIII, da Lei Federal nº 14.133/2021, envolvendo atividades de assessoramento técnico, diagnóstico sistêmico, análise de dados educacionais, regularização federativa e suporte junto aos sistemas estruturantes do MEC/FNDE. Os serviços demandam conhecimento multidisciplinar nas áreas de financiamento educacional, gestão pública, Censo Escolar, FUNDEB, prestação de contas federais e tramitação administrativa perante órgãos da União.', bold: false),
        pw.SizedBox(height: 12),
        pw.Text('Notória Especialização', style: pw.TextStyle(color: _navy, fontSize: 10, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 6),
        _paragraph('A singularidade técnica decorre da necessidade de atuação em sistemas federais estruturantes da educação pública (SIMEC, SIGPC, Habilita-FNDE, PAR, SIOPE e mecanismos de composição do FUNDEB), cujas operacionalizações exigem expertise específica, metodologia própria e domínio técnico não ordinariamente disponíveis na estrutura administrativa municipal. Cf. Acórdão 1924/2021-TCU e Acórdão 2616/2015-TCU (singularidade e impossibilidade de padronização plena de consultoria multidisciplinar).', bold: false),
        pw.SizedBox(height: 12),
        pw.Text('Economicidade e Vantajosidade', style: pw.TextStyle(color: _navy, fontSize: 10, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 6),
        _paragraph('A contratação apresenta vantajosidade administrativa e financeira ao Município, considerando que o investimento representa fração reduzida do potencial de recomposição arrecadatória estimado, além de promover regularização sistêmica, prevenção de perdas financeiras, saneamento de pendências federais e fortalecimento da capacidade institucional da rede municipal de ensino.', bold: false),
      ],
    );
  }

  static pw.Widget _equipeMultidisciplinar() {
    return pw.Container(
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
        color: const PdfColor.fromInt(0xFFF8FAFC),
        border: pw.Border.all(color: _line, width: 0.6),
        borderRadius: pw.BorderRadius.circular(8),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text('Nossa Autoridade Humana', style: pw.TextStyle(color: _navy, fontSize: 10, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 12),
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('Especialistas em Gestão Escolar', style: pw.TextStyle(color: _navy, fontSize: 8.5, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 4),
                    pw.Text('Análise profunda do Censo Escolar, SIOPE, e articulação com as exigências pedagógicas do MEC.', style: const pw.TextStyle(color: _ink, fontSize: 8, lineSpacing: 1.5)),
                  ],
                ),
              ),
              pw.SizedBox(width: 16),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('Analistas Contábeis & FNDE', style: pw.TextStyle(color: _navy, fontSize: 8.5, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 4),
                    pw.Text('Gestão técnica de repasses, coeficientes do VAAF/VAAT/VAAR e prestação de contas no SIGPC.', style: const pw.TextStyle(color: _ink, fontSize: 8, lineSpacing: 1.5)),
                  ],
                ),
              ),
              pw.SizedBox(width: 16),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('Corpo Jurídico Especializado', style: pw.TextStyle(color: _navy, fontSize: 8.5, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 4),
                    pw.Text('Direito Administrativo e Público, atuação estratégica em Tomadas de Contas Especiais (TCE) e defesas.', style: const pw.TextStyle(color: _ink, fontSize: 8, lineSpacing: 1.5)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static pw.Widget _riscoZeroSection() {
    const bullets = [
      'Pagamento APENAS com resultado comprovado',
      'Zero custo inicial ao município',
      'Sem risco orçamentário — pagamento com recursos próprios (Fonte 00)',
      'Alinhamento total de interesses entre contratante e contratada',
    ];
    return pw.Container(
      width: double.infinity, padding: const pw.EdgeInsets.all(20),
      decoration: pw.BoxDecoration(
        color: const PdfColor.fromInt(0xFFF9FAFB),
        border: pw.Border.all(color: _line, width: 0.6),
        borderRadius: pw.BorderRadius.circular(8),
      ),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Text('MODELO DE CONTRATAÇÃO SEM RISCO', style: pw.TextStyle(color: _navy, fontSize: 9, fontWeight: pw.FontWeight.bold, letterSpacing: 0.5)),
        pw.SizedBox(height: 14),
        ...bullets.map((item) => pw.Padding(
          padding: const pw.EdgeInsets.only(bottom: 8),
          child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text('✓ ', style: pw.TextStyle(color: const PdfColor.fromInt(0xFF15803D), fontSize: 10, fontWeight: pw.FontWeight.bold)),
            pw.Expanded(child: pw.Text(item, style: const pw.TextStyle(color: _ink, fontSize: 9.5, lineSpacing: 2))),
          ]),
        )),
      ]),
    );
  }

  static pw.Widget _fixedFeeConditionsSection() {
    const bullets = [
      'Previsibilidade total do investimento necessário',
      'Sem custos variáveis ou percentuais surpresa ao longo do contrato',
      'Pagamento com recursos próprios (Fonte 00)',
      'Escopo fechado e serviços perfeitamente definidos',
    ];
    return pw.Container(
      width: double.infinity, padding: const pw.EdgeInsets.all(20),
      decoration: pw.BoxDecoration(
        color: const PdfColor.fromInt(0xFFF9FAFB),
        border: pw.Border.all(color: _line, width: 0.6),
        borderRadius: pw.BorderRadius.circular(8),
      ),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Text('SEGURANÇA E PREVISIBILIDADE (HONORÁRIOS FIXOS)', style: pw.TextStyle(color: _navy, fontSize: 9, fontWeight: pw.FontWeight.bold, letterSpacing: 0.5)),
        pw.SizedBox(height: 14),
        ...bullets.map((item) => pw.Padding(
          padding: const pw.EdgeInsets.only(bottom: 8),
          child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text('✓ ', style: pw.TextStyle(color: const PdfColor.fromInt(0xFF15803D), fontSize: 10, fontWeight: pw.FontWeight.bold)),
            pw.Expanded(child: pw.Text(item, style: const pw.TextStyle(color: _ink, fontSize: 9.5, lineSpacing: 2))),
          ]),
        )),
      ]),
    );
  }

  static pw.Widget _fixedFeeBox(double qty, double smValue, DateTime referenceDate) {
    final total = qty * smValue;

    return pw.Container(
      decoration: pw.BoxDecoration(
        color: _white,
        border: pw.Border.all(color: _line, width: 0.6),
        borderRadius: pw.BorderRadius.circular(6),
      ),
      child: pw.Column(
        children: [
          pw.Container(
            padding: const pw.EdgeInsets.all(12),
            decoration: const pw.BoxDecoration(
              color: PdfColor.fromInt(0xFFF9FAFB),
              borderRadius: pw.BorderRadius.only(topLeft: pw.Radius.circular(6), topRight: pw.Radius.circular(6)),
            ),
            child: pw.Row(
              children: [
                pw.Expanded(
                  child: pw.Text('Modalidade', style: pw.TextStyle(color: const PdfColor.fromInt(0xFF4B5563), fontSize: 7.4, fontWeight: pw.FontWeight.bold)),
                ),
                pw.Expanded(
                  child: pw.Text('Quantidade', textAlign: pw.TextAlign.right, style: pw.TextStyle(color: const PdfColor.fromInt(0xFF4B5563), fontSize: 7.4, fontWeight: pw.FontWeight.bold)),
                ),
                pw.Expanded(
                  child: pw.Text('Investimento Mensal', textAlign: pw.TextAlign.right, style: pw.TextStyle(color: const PdfColor.fromInt(0xFF4B5563), fontSize: 7.4, fontWeight: pw.FontWeight.bold)),
                ),
              ],
            ),
          ),
          pw.Container(height: 0.6, color: _line),
          pw.Container(
            padding: const pw.EdgeInsets.all(16),
            child: pw.Row(
              children: [
                pw.Expanded(
                  child: pw.Text('Honorários Técnicos de Assessoria Contínua', style: const pw.TextStyle(color: _ink, fontSize: 9)),
                ),
                pw.Expanded(
                  child: pw.Text('${qty.toStringAsFixed(0)} Salários Mínimos / mês', textAlign: pw.TextAlign.right, style: pw.TextStyle(color: _ink, fontSize: 9, fontWeight: pw.FontWeight.bold)),
                ),
                pw.Expanded(
                  child: pw.Text(_currency.format(total), textAlign: pw.TextAlign.right, style: pw.TextStyle(color: const PdfColor.fromInt(0xFF15803D), fontSize: 11, fontWeight: pw.FontWeight.bold)),
                ),
              ],
            ),
          ),
          pw.Container(height: 0.6, color: _line),
          pw.Container(
            padding: const pw.EdgeInsets.all(12),
            decoration: const pw.BoxDecoration(
              color: PdfColor.fromInt(0xFFF8FAFC),
              borderRadius: pw.BorderRadius.only(bottomLeft: pw.Radius.circular(6), bottomRight: pw.Radius.circular(6)),
            ),
            child: pw.Row(
              children: [
                pw.Expanded(
                  child: pw.Text('Elevada Economicidade Contratual', style: pw.TextStyle(color: const PdfColor.fromInt(0xFF1E3A8A), fontSize: 8.5, fontWeight: pw.FontWeight.bold)),
                ),
                pw.Expanded(
                  flex: 2,
                  child: pw.Text('O modelo de remuneração fixa proporciona previsibilidade orçamentária ao Município e evita a incidência de custos variáveis atrelados ao desempenho arrecadatório futuro.', textAlign: pw.TextAlign.right, style: const pw.TextStyle(color: PdfColor.fromInt(0xFF1E3A8A), fontSize: 8.5, lineSpacing: 1.5)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _annexTitle(String title) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 18, top: 4),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.center, children: [
        pw.Text(title.toUpperCase(), style: pw.TextStyle(color: _muted, fontSize: 11, fontWeight: pw.FontWeight.bold, letterSpacing: 0.5), textAlign: pw.TextAlign.center),
        pw.SizedBox(height: 6),
        pw.Container(width: 280, height: 0.8, color: _line),
      ]),
    );
  }


  /// Page theme mirroring the FUNDEB levantamento — pixel-perfect header/footer.
  static pw.PageTheme _contentTheme({
    required pw.Font font,
    String? logoSvg,
    required DateTime generatedAt,
    String clientName = '',
    String consultingCompanyName = '',
  }) {
    return pw.PageTheme(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.fromLTRB(34, 88, 34, 54),
      theme: _pdfTheme(font),
      buildBackground: (context) => pw.FullPage(
        ignoreMargins: true,
        child: pw.Stack(
          children: [
            pw.Positioned(
              left: 34,
              right: 34,
              top: 24,
              child: _enterpriseHeader(logoSvg, clientName, consultingCompanyName),
            ),
            pw.Positioned(
              left: 34,
              right: 34,
              bottom: 18,
              child: _enterpriseFooter(
                context.pageNumber,
                context.pagesCount,
                generatedAt: generatedAt,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Full institutional header — matches FUNDEB _header exactly.
  static pw.Widget _enterpriseHeader(
    String? logoSvg,
    String clientName,
    String consultingCompanyName,
  ) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            if (logoSvg != null)
              pw.Container(
                width: 48,
                height: 24,
                margin: const pw.EdgeInsets.only(right: 12),
                child: pw.SvgImage(svg: logoSvg, fit: pw.BoxFit.contain),
              ),
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    consultingCompanyName.toUpperCase(),
                    style: pw.TextStyle(
                      color: _navy,
                      fontSize: 9.8,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 2.5),
                  pw.Text(
                    'Proposta Comercial e Técnica',
                    style: pw.TextStyle(
                      color: _navy,
                      fontSize: 8.8,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  if (clientName.isNotEmpty)
                    pw.Text(
                      clientName,
                      style: const pw.TextStyle(color: _ink, fontSize: 7.6),
                    ),
                ],
              ),
            ),
          ],
        ),
        pw.SizedBox(height: 7),
        pw.Container(height: 0.6, color: _line),
      ],
    );
  }

  /// Clean institutional footer — page number + confidential only.
  static pw.Widget _enterpriseFooter(
    int pageNumber,
    int totalPages, {
    required DateTime generatedAt,
  }) {
    final pageLabel = '${pageNumber.toString().padLeft(2, '0')} / ${totalPages.toString().padLeft(2, '0')}';
    return pw.Column(
      children: [
        pw.Container(height: 0.4, color: _line),
        pw.SizedBox(height: 6),
        pw.Row(
          children: [
            pw.Text(
              'Documento Confidencial',
              style: const pw.TextStyle(color: _muted, fontSize: 6),
            ),
            pw.Spacer(),
            pw.Text(
              pageLabel,
              style: pw.TextStyle(
                color: _muted,
                fontSize: 6.5,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
          ],
        ),
      ],
    );
  }

  /// Numbered section heading — matches FUNDEB _sectionHeading.
  static int _sectionCounter = 0;
  static pw.Widget _sectionTitle(String title, {bool alignCenter = false}) {
    _sectionCounter++;
    final idx = _sectionCounter.toString();
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 12, top: 4),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.center,
        children: [
          pw.Text(
            '$idx.',
            style: pw.TextStyle(
              color: _ink,
              fontSize: 14,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(width: 8),
          pw.Expanded(
            child: pw.Text(
              title,
              style: pw.TextStyle(
                color: _ink,
                fontSize: 14,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _paragraph(String text, {bool bold = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 10),
      child: pw.Text(
        text,
        textAlign: pw.TextAlign.justify,
        style: pw.TextStyle(
          color: _ink,
          fontSize: 10,
          fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal,
          lineSpacing: 2.2,
        ),
      ),
    );
  }

  /// Soft paragraph — sentence case, charcoal gray, generous line spacing.
  /// Use for long technical text (like the object clause) to avoid "shouting".
  static pw.Widget _softParagraph(String text) {
    // Normalize to sentence case if text is all-caps
    var normalized = text == text.toUpperCase()
        ? text[0] + text.substring(1).toLowerCase()
        : text;

    // Restore institutional acronyms
    normalized = normalized.replaceAllMapped(
      RegExp(r'\b(mec|fnde|simec|sigpc|sigarp|fundeb)\b', caseSensitive: false),
      (match) => match.group(1)!.toUpperCase(),
    );

    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 12),
      child: pw.Text(
        normalized,
        textAlign: pw.TextAlign.justify,
        style: const pw.TextStyle(
          color: PdfColor.fromInt(0xFF374151),
          fontSize: 9.5,
          lineSpacing: 2.8,
        ),
      ),
    );
  }

  static pw.Widget _bullet(String text) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 8, left: 6),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(
            margin: const pw.EdgeInsets.only(top: 4.5),
            width: 4,
            height: 4,
            decoration: const pw.BoxDecoration(
              color: _gold,
              shape: pw.BoxShape.circle,
            ),
          ),
          pw.SizedBox(width: 10),
          pw.Expanded(
            child: pw.Text(
              text,
              style: const pw.TextStyle(
                color: _ink,
                fontSize: 9.6,
                lineSpacing: 2,
              ),
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _numberedClause(String text) {
    final parts = text.split(':');
    final title = parts.first;
    final body = parts.length > 1 ? parts.sublist(1).join(':').trim() : text;
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 10),
      child: pw.RichText(
        text: pw.TextSpan(
          children: [
            pw.TextSpan(
              text: '$title: ',
              style: pw.TextStyle(
                color: _ink,
                fontWeight: pw.FontWeight.bold,
                fontSize: 10,
              ),
            ),
            pw.TextSpan(
              text: body,
              style: const pw.TextStyle(
                color: _ink,
                fontSize: 10,
                height: 1.35,
              ),
            ),
          ],
        ),
      ),
    );
  }

  static pw.Widget _keyValueGrid(List<(String, String)> rows) {
    return pw.Wrap(
      spacing: 16,
      runSpacing: 24,
      children: rows
          .map(
            (row) => pw.Container(
              width: 236,
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    row.$1.toUpperCase(),
                    style: pw.TextStyle(
                      color: _muted,
                      fontSize: 7.5,
                      fontWeight: pw.FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                  pw.SizedBox(height: 6),
                  pw.Text(
                    row.$2,
                    style: const pw.TextStyle(
                      color: _ink,
                      fontSize: 10,
                      lineSpacing: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }

  static pw.Widget _executiveSnapshot(PremiumContractData data) {
    final current = _financialValueAt(data, 0);
    final projected = _financialValueAt(data, 1);
    final gain = _financialValueAt(data, 2);
    final fees = data.total;
    return pw.Container(
      padding: const pw.EdgeInsets.all(13),
      decoration: pw.BoxDecoration(
        color: _paper,
        border: pw.Border.all(color: _line, width: 0.6),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            'RESUMO EXECUTIVO DA PROPOSTA',
            style: pw.TextStyle(
              color: _navy,
              fontSize: 8,
              fontWeight: pw.FontWeight.bold,
              letterSpacing: 0.6,
            ),
          ),
          pw.SizedBox(height: 10),
          pw.Row(
            children: [
              _miniMetric('Base atual', _currency.format(current), _muted),
              pw.SizedBox(width: 8),
              _miniMetric('Projetado', _currency.format(projected), _navy),
              pw.SizedBox(width: 8),
              _miniMetric('Potencial', _currency.format(gain), _gold),
              pw.SizedBox(width: 8),
              _miniMetric('Honorarios', _currency.format(fees), _navy),
            ],
          ),
        ],
      ),
    );
  }

  static pw.Widget _financialDashboard(PremiumContractData data) {
    final items = data.financialItems;
    return pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        for (var index = 0; index < items.take(4).length; index++) ...[
          pw.Expanded(
            child: _metricCard(
              items[index].description,
              _currency.format(items[index].value),
              items[index].highlight,
            ),
          ),
          if (index < items.take(4).length - 1) pw.SizedBox(width: 8),
        ],
      ],
    );
  }

  static pw.Widget _miniMetric(String label, String value, PdfColor accent) {
    return pw.Expanded(
      child: pw.Container(
        padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: pw.BoxDecoration(
          color: _white,
          border: pw.Border(left: pw.BorderSide(color: accent, width: 2.4)),
        ),
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(
              label.toUpperCase(),
              style: pw.TextStyle(
                color: _muted,
                fontSize: 6.5,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            pw.SizedBox(height: 3),
            pw.Text(
              value,
              style: pw.TextStyle(
                color: _ink,
                fontSize: 8.2,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  static pw.Widget _metricCard(String label, String value, bool highlight) {
    return pw.SizedBox(
      height: 66,
      child: pw.Container(
        padding: const pw.EdgeInsets.all(10),
        decoration: pw.BoxDecoration(
          color: highlight ? _navy : _paper,
          border: pw.Border.all(color: highlight ? _navy : _line, width: 0.6),
        ),
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(
              label.toUpperCase(),
              maxLines: 2,
              style: pw.TextStyle(
                color: highlight ? _goldSoft : _muted,
                fontSize: 6.4,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            pw.Text(
              value,
              style: pw.TextStyle(
                color: highlight ? _white : _ink,
                fontSize: 10.2,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  static pw.Widget _premiumCallout(String title, String value, String helper) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
        color: _navy,
        borderRadius: pw.BorderRadius.circular(3),
      ),
      child: pw.Row(
        children: [
          pw.Container(width: 3, height: 48, color: _gold),
          pw.SizedBox(width: 12),
          pw.Expanded(
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  title.toUpperCase(),
                  style: pw.TextStyle(
                    color: _goldSoft,
                    fontSize: 8,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  value,
                  style: pw.TextStyle(
                    color: _white,
                    fontSize: 14,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 3),
                pw.Text(
                  helper,
                  style: const pw.TextStyle(
                    color: PdfColor.fromInt(0xFFB7C5D8),
                    fontSize: 9,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _financialTable(List<ContractFinancialItem> items) {
    final rows = items
        .map((item) => [item.description, _currency.format(item.value)])
        .toList();

    return pw.TableHelper.fromTextArray(
      headers: const ['Descricao', 'Valor estimado'],
      data: rows,
      headerDecoration: const pw.BoxDecoration(color: _navy),
      headerStyle: pw.TextStyle(
        color: _white,
        fontSize: 8,
        fontWeight: pw.FontWeight.bold,
      ),
      cellStyle: const pw.TextStyle(color: _ink, fontSize: 8.4),
      oddRowDecoration: const pw.BoxDecoration(color: _paper),
      border: pw.TableBorder.all(color: _line, width: 0.5),
      cellAlignments: const {
        0: pw.Alignment.centerLeft,
        1: pw.Alignment.centerRight,
      },
      columnWidths: const {
        0: pw.FlexColumnWidth(2.6),
        1: pw.FlexColumnWidth(1),
      },
      cellPadding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 8),
    );
  }

  static pw.Widget _minimumWageBox(PremiumContractData data) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(14),
      decoration: pw.BoxDecoration(
        color: PdfColor.fromInt(0xFFFFFBF2),
        border: pw.Border.all(color: _gold, width: 0.7),
      ),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(width: 4, height: 52, color: _gold),
          pw.SizedBox(width: 10),
          pw.Expanded(
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  'BASE DE CÁLCULO DOS HONORÁRIOS',
                  style: pw.TextStyle(
                    color: _navy,
                    fontSize: 8,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 5),
                pw.Text(
                  'Salário-mínimo vigente: ${_currency.format(data.minimumWageValue)}',
                  style: pw.TextStyle(
                    color: _ink,
                    fontSize: 13,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  data.minimumWageLegalBasis,
                  style: const pw.TextStyle(
                    color: _muted,
                    fontSize: 8.4,
                    height: 1.28,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _honorariosBreakdownTable(
    List<ContractHonorariosTier> tiers,
  ) {
    final rows = tiers
        .map(
          (tier) => [
            tier.label,
            '${_formatQuantity(tier.minimumWages)} SM',
            _currency.format(tier.baseValue),
            '${(tier.rate * 100).toStringAsFixed(0)}%',
            _currency.format(tier.feeValue),
          ],
        )
        .toList();

    return pw.Container(
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: _line, width: 0.6),
        borderRadius: pw.BorderRadius.circular(6),
      ),
      child: pw.TableHelper.fromTextArray(
        headers: const [
          'Faixa',
          'Quantidade',
          'Base da faixa',
          'Alíquota',
          'Honorários',
        ],
        data: rows,
        headerDecoration: const pw.BoxDecoration(
          color: PdfColor.fromInt(0xFFF9FAFB),
          borderRadius: pw.BorderRadius.only(topLeft: pw.Radius.circular(6), topRight: pw.Radius.circular(6))
        ),
        headerStyle: pw.TextStyle(
          color: const PdfColor.fromInt(0xFF4B5563),
          fontSize: 7.4,
          fontWeight: pw.FontWeight.bold,
        ),
        cellStyle: const pw.TextStyle(color: _ink, fontSize: 7.6),
        oddRowDecoration: null,
        border: const pw.TableBorder(
          horizontalInside: pw.BorderSide(color: _line, width: 0.5),
          verticalInside: pw.BorderSide.none,
          top: pw.BorderSide.none,
          bottom: pw.BorderSide.none,
          left: pw.BorderSide.none,
          right: pw.BorderSide.none,
        ),
        cellAlignments: const {
          0: pw.Alignment.centerLeft,
          1: pw.Alignment.centerRight,
          2: pw.Alignment.centerRight,
          3: pw.Alignment.centerRight,
          4: pw.Alignment.centerRight,
        },
        headerAlignments: const {
          0: pw.Alignment.centerLeft,
          1: pw.Alignment.centerRight,
          2: pw.Alignment.centerRight,
          3: pw.Alignment.centerRight,
          4: pw.Alignment.centerRight,
        },
        columnWidths: const {
          0: pw.FlexColumnWidth(2.2),
          1: pw.FlexColumnWidth(0.75),
          2: pw.FlexColumnWidth(1.1),
          3: pw.FlexColumnWidth(0.75),
          4: pw.FlexColumnWidth(1.1),
        },
      ),
    );
  }

  static pw.Widget _priceTable(List<ContractServiceItem> items) {
    final rows = <List<String>>[
      for (var index = 0; index < items.length; index++)
        [
          '${index + 1}',
          items[index].description,
          items[index].unit,
          _formatQuantity(items[index].quantity),
          _currency.format(items[index].unitValue),
          _currency.format(items[index].total),
        ],
    ];

    return pw.TableHelper.fromTextArray(
      headers: const [
        'ITEM',
        'DESCRIÇÃO DOS SERVIÇOS',
        'UNIDADE',
        'QUANT.',
        'VALOR\nUNITÁRIO (R\$)',
        'VALOR\nTOTAL (R\$)',
      ],
      data: rows,
      headerDecoration: const pw.BoxDecoration(color: _navy),
      headerStyle: pw.TextStyle(
        color: _white,
        fontSize: 7.6,
        fontWeight: pw.FontWeight.bold,
      ),
      cellStyle: const pw.TextStyle(color: _ink, fontSize: 7.8),
      oddRowDecoration: const pw.BoxDecoration(color: _paper),
      border: pw.TableBorder.all(color: _line, width: 0.5),
      cellAlignment: pw.Alignment.center,
      cellAlignments: const {
        1: pw.Alignment.centerLeft,
        4: pw.Alignment.centerRight,
        5: pw.Alignment.centerRight,
      },
      columnWidths: const {
        0: pw.FixedColumnWidth(28),
        1: pw.FlexColumnWidth(2.5),
        2: pw.FixedColumnWidth(45),
        3: pw.FixedColumnWidth(45),
        4: pw.FixedColumnWidth(62),
        5: pw.FixedColumnWidth(66),
      },
      cellPadding: const pw.EdgeInsets.symmetric(horizontal: 5, vertical: 7),
    );
  }

  static pw.Widget _signatureBlock(String name, String role) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(top: 8),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(height: 28),
          pw.Container(
            width: 190,
            decoration: pw.BoxDecoration(
              border: pw.Border(top: pw.BorderSide(color: const PdfColor.fromInt(0xFF9CA3AF), width: 0.6)),
            ),
          ),
          pw.SizedBox(height: 6),
          pw.Text(
            name,
            style: pw.TextStyle(
              color: _ink,
              fontSize: 9.6,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 1),
          pw.Text(
            role,
            style: const pw.TextStyle(color: _muted, fontSize: 8),
          ),
        ],
      ),
    );
  }

  static pw.Widget _dualSignatures(PremiumContractData data) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(top: 10),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Expanded(
            child: pw.Column(
              children: [
                pw.SizedBox(height: 36),
                pw.Container(height: 0.8, color: _ink),
                pw.SizedBox(height: 5),
                pw.Text(
                  data.clientName,
                  textAlign: pw.TextAlign.center,
                  style: pw.TextStyle(
                    color: _ink,
                    fontSize: 8.4,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 1),
                pw.Text(
                  'CONTRATANTE',
                  textAlign: pw.TextAlign.center,
                  style: pw.TextStyle(
                    color: _muted,
                    fontSize: 6.8,
                    fontWeight: pw.FontWeight.bold,
                    letterSpacing: 0.6,
                  ),
                ),
              ],
            ),
          ),
          pw.SizedBox(width: 40),
          pw.Expanded(
            child: pw.Column(
              children: [
                pw.SizedBox(height: 36),
                pw.Container(height: 0.8, color: _ink),
                pw.SizedBox(height: 5),
                pw.Text(
                  data.consultingCompanyName.toUpperCase(),
                  textAlign: pw.TextAlign.center,
                  style: pw.TextStyle(
                    color: _ink,
                    fontSize: 8.4,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 1),
                pw.Text(
                  'CONTRATADA',
                  textAlign: pw.TextAlign.center,
                  style: pw.TextStyle(
                    color: _muted,
                    fontSize: 6.8,
                    fontWeight: pw.FontWeight.bold,
                    letterSpacing: 0.6,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _pageBreak() => pw.NewPage();

  static double _financialValueAt(PremiumContractData data, int index) {
    if (index < 0 || index >= data.financialItems.length) return 0;
    return data.financialItems[index].value;
  }

  static String _formatQuantity(double value) {
    if (value == value.roundToDouble()) {
      return value.toStringAsFixed(0);
    }
    return value.toStringAsFixed(2).replaceAll('.', ',');
  }

  static pw.Widget _deliverablesMatrix() {
    return pw.Container(
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: _line, width: 0.6),
        borderRadius: pw.BorderRadius.circular(6),
      ),
      child: pw.Column(
        children: [
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: const pw.BoxDecoration(
              color: PdfColor.fromInt(0xFFF9FAFB),
              borderRadius: pw.BorderRadius.vertical(top: pw.Radius.circular(6)),
            ),
            child: pw.Row(
              children: [
                pw.Expanded(flex: 3, child: pw.Text('Entrega Técnica', style: pw.TextStyle(color: _navy, fontSize: 8.5, fontWeight: pw.FontWeight.bold))),
                pw.Expanded(flex: 2, child: pw.Text('Frequência', style: pw.TextStyle(color: _navy, fontSize: 8.5, fontWeight: pw.FontWeight.bold))),
              ],
            ),
          ),
          pw.Container(height: 0.6, color: _line),
          _matrixRow('Relatório Técnico Executivo', 'Mensal', true),
          _matrixRow('Gestão de Ofícios e Pendências (FNDE/MEC)', 'Mensal', false),
          _matrixRow('Revisão Cadastral e Acompanhamento de Metas', 'Trimestral', true),
          _matrixRow('Capacitação Técnica da Equipe Escolar', 'Trimestral', false),
          _matrixRow('Pareceres Técnicos e Defesas de TCE', 'Sob Demanda', true),
        ],
      ),
    );
  }

  static pw.Widget _matrixRow(String label, String value, bool isEven) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      color: isEven ? _white : const PdfColor.fromInt(0xFFFAFBFD),
      child: pw.Row(
        children: [
          pw.Expanded(flex: 3, child: pw.Text(label, style: const pw.TextStyle(color: _ink, fontSize: 8.5))),
          pw.Expanded(flex: 2, child: pw.Text(value, style: pw.TextStyle(color: _muted, fontSize: 8.5, fontWeight: pw.FontWeight.bold))),
        ],
      ),
    );
  }

  static pw.Widget _executionTimeline() {
    return pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        _timelineStep('Mês 1 a 3', 'Diagnóstico e\nPlanejamento', true),
        _timelineStep('Mês 4 a 6', 'Reestruturação\nCadastral', false),
        _timelineStep('Mês 7 a 9', 'Regularização\nde Repasses', false),
        _timelineStep('Mês 10 a 12', 'Consolidação e\nMonitoramento', false),
      ],
    );
  }

  static pw.Widget _timelineStep(String tempo, String label, bool first) {
    return pw.Expanded(
      child: pw.Container(
        padding: const pw.EdgeInsets.symmetric(horizontal: 4),
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(tempo, style: pw.TextStyle(color: _gold, fontSize: 7, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 4),
            pw.Container(height: 2, color: first ? _gold : _line),
            pw.SizedBox(height: 6),
            pw.Text(label, style: pw.TextStyle(color: _navy, fontSize: 8.5, fontWeight: pw.FontWeight.bold, lineSpacing: 1.5)),
          ],
        ),
      ),
    );
  }

  static Future<pw.Font> _loadPdfFont() async {
    if (_interFont != null) return _interFont!;
    final data = await rootBundle.load('assets/fonts/InterVariable.ttf');
    _interFont = pw.Font.ttf(data);
    return _interFont!;
  }

  static pw.ThemeData _pdfTheme(pw.Font font) {
    return pw.ThemeData.withFont(
      base: font,
      bold: font,
      italic: font,
      boldItalic: font,
    );
  }

  static Future<String?> _loadRochaPrimeLogoSvg() async {
    try {
      return rootBundle.loadString(
        'assets/branding/logo-rocha-prime-institucional.svg',
      );
    } catch (_) {
      return null;
    }
  }

  static Future<String?> _loadLogoSvg({bool isWhite = false}) async {
    try {
      final fileName = isWhite ? 'logo-rocha-prime-white.svg' : 'logo-rocha-prime-blue.svg';
      return await rootBundle.loadString('assets/branding/$fileName');
    } catch (_) {
      return null;
    }
  }

  static Future<pw.MemoryImage?> _loadCoverBgPng() async {
    try {
      final data = await rootBundle.load('assets/branding/bg-capa-premium.jpg');
      return pw.MemoryImage(data.buffer.asUint8List());
    } catch (e) {
      print('Error loading bg-capa-premium.jpg: $e');
      return null;
    }
  }
}
