import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

class SlidesInstitucionalPdfBuilder {
  // ─── Colors ──────────────────────────────────────────────────────────
  static const PdfColor _navy = PdfColor.fromInt(0xFF0F2747);
  static const PdfColor _gold = PdfColor.fromInt(0xFFD4A843);
  static const PdfColor _blue = PdfColor.fromInt(0xFF1D5FAF);
  static const PdfColor _text = PdfColor.fromInt(0xFF172033);
  static const PdfColor _muted = PdfColor.fromInt(0xFF677184);
  static const PdfColor _line = PdfColor.fromInt(0xFFD7DFEA);
  static const PdfColor _white = PdfColor.fromInt(0xFFFFFFFF);
  static const PdfColor _softBlue = PdfColor.fromInt(0xFFEAF3FF);
  static const PdfColor _softGold = PdfColor.fromInt(0xFFFFF9ED);
  static const PdfColor _green = PdfColor.fromInt(0xFF15803D);

  // ─── Page format: landscape 16:9 ────────────────────────────────────
  static const PdfPageFormat _slideFormat = PdfPageFormat(960, 540);

  static pw.Font? _font;

  // ─── Font loading ────────────────────────────────────────────────────
  static Future<pw.Font> _loadFont() async {
    if (_font != null) return _font!;
    try {
      final data = await rootBundle.load('assets/fonts/InterVariable.ttf');
      _font = pw.Font.ttf(data);
    } catch (_) {
      _font = pw.Font.helvetica();
    }
    return _font!;
  }

  // ─── Entry point ────────────────────────────────────────────────────
  static Future<Uint8List> build() async {
    final font = await _loadFont();
    final pdf = pw.Document(
      title: 'Apresentação Institucional — Rocha Prime',
      author: 'Rocha Prime',
    );

    _appendPages(pdf, font);
    return pdf.save();
  }

  // ─── Page orchestrator ──────────────────────────────────────────────
  static void _appendPages(pw.Document pdf, pw.Font font) {
    final theme = pw.ThemeData.withFont(
      base: font,
      bold: font,
      italic: font,
      boldItalic: font,
    );

    pdf.addPage(_buildCapa(theme));
    pdf.addPage(_buildQuemSomos(theme));
    pdf.addPage(_buildMissao(theme));
    pdf.addPage(_buildNumeros(theme));
    pdf.addPage(_buildConsultoriaFundeb(theme));
    pdf.addPage(_buildLevantamentoTecnico(theme));
    pdf.addPage(_buildRelatorioIA(theme));
    pdf.addPage(_buildContratos(theme));
    pdf.addPage(_buildMetodologia(theme));
    pdf.addPage(_buildTecnologia(theme));
    pdf.addPage(_buildDiferenciais(theme));
    pdf.addPage(_buildCases(theme));
    pdf.addPage(_buildDepoimentos(theme));
    pdf.addPage(_buildParceiros(theme));
    pdf.addPage(_buildProximosPassos(theme));
    pdf.addPage(_buildContato(theme));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 1 – CAPA
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildCapa(pw.ThemeData theme) {
    final now = DateTime.now();
    final dateLabel = DateFormat('dd/MM/yyyy', 'pt_BR').format(now);

    return pw.Page(
      pageFormat: _slideFormat,
      theme: theme,
      margin: pw.EdgeInsets.zero,
      build: (context) => pw.Container(
        width: _slideFormat.width,
        height: _slideFormat.height,
        color: _navy,
        padding: const pw.EdgeInsets.symmetric(horizontal: 60, vertical: 40),
        child: pw.Column(
          mainAxisAlignment: pw.MainAxisAlignment.center,
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            pw.Text(
              'ROCHA PRIME',
              style: pw.TextStyle(
                color: _white,
                fontSize: 32,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            pw.SizedBox(height: 6),
            pw.Text(
              'SERVIÇOS ESPECIALIZADOS',
              style: const pw.TextStyle(color: _white, fontSize: 14),
            ),
            pw.SizedBox(height: 24),
            pw.Container(
              width: 120,
              height: 3,
              color: _gold,
            ),
            pw.SizedBox(height: 24),
            pw.Text(
              'Apresentação Institucional',
              textAlign: pw.TextAlign.center,
              style: pw.TextStyle(
                color: _gold,
                fontSize: 22,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            pw.SizedBox(height: 60),
            pw.Text(
              dateLabel,
              style: pw.TextStyle(
                color: PdfColor.fromInt(0xFFAABBCC),
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 2 – QUEM SOMOS
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildQuemSomos(pw.ThemeData theme) {
    return _contentPage(
      theme: theme,
      pageNumber: 2,
      title: 'Quem Somos',
      body: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _paragraph(
            'A Rocha Prime é uma empresa especializada em consultoria '
            'educacional e financeira para municípios brasileiros.',
          ),
          pw.SizedBox(height: 14),
          _paragraph(
            'Atuamos na maximização de recursos do FUNDEB, qualificação '
            'da gestão educacional e estruturação de processos '
            'administrativos.',
          ),
          pw.SizedBox(height: 14),
          _paragraph(
            'Nossa missão é garantir que cada município receba e aplique '
            'corretamente todos os recursos a que tem direito.',
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 3 – NOSSA MISSÃO
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildMissao(pw.ThemeData theme) {
    return _contentPage(
      theme: theme,
      pageNumber: 3,
      title: 'Nossa Missão',
      body: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _paragraph(
            'Transformar a gestão educacional dos municípios brasileiros '
            'através de inteligência financeira, tecnologia e consultoria '
            'especializada.',
          ),
          pw.SizedBox(height: 30),
          pw.Row(
            children: [
              pw.Expanded(child: _pillarCard('Excelência\nTécnica')),
              pw.SizedBox(width: 16),
              pw.Expanded(child: _pillarCard('Resultado\nComprovado')),
              pw.SizedBox(width: 16),
              pw.Expanded(
                child: _pillarCard('Compromisso com\na Educação'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 4 – NÚMEROS
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildNumeros(pw.ThemeData theme) {
    return _contentPage(
      theme: theme,
      pageNumber: 4,
      title: 'Nossos Números',
      body: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(height: 20),
          pw.Row(
            children: [
              pw.Expanded(
                child: _kpiCard('+150', 'Municípios\nAtendidos', _blue),
              ),
              pw.SizedBox(width: 16),
              pw.Expanded(
                child: _kpiCard('+R\$ 500M', 'Recursos\nRecuperados', _green),
              ),
            ],
          ),
          pw.SizedBox(height: 16),
          pw.Row(
            children: [
              pw.Expanded(
                child: _kpiCard('+2.000', 'Relatórios\nGerados', _gold),
              ),
              pw.SizedBox(width: 16),
              pw.Expanded(
                child: _kpiCard('26', 'Estados com\nAtuação', _navy),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 5 – CONSULTORIA FUNDEB
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildConsultoriaFundeb(pw.ThemeData theme) {
    return _contentPage(
      theme: theme,
      pageNumber: 5,
      title: 'Consultoria FUNDEB',
      body: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _paragraph(
            'Diagnóstico completo da receita educacional do município',
          ),
          pw.SizedBox(height: 18),
          _bulletItem('Análise de receitas VAAF, VAAT e VAAR'),
          _bulletItem('Projeção de ganhos com base em dados oficiais'),
          _bulletItem('Identificação de recursos não captados'),
          _bulletItem('Plano de ação para maximização'),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 6 – LEVANTAMENTO TÉCNICO
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildLevantamentoTecnico(pw.ThemeData theme) {
    return _contentPage(
      theme: theme,
      pageNumber: 6,
      title: 'Levantamento Técnico',
      body: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _paragraph(
            'Cruzamos dados de 7 bases oficiais: FNDE, INEP, SICONFI, '
            'IBGE, TSE, QEdu e MEC.',
          ),
          pw.SizedBox(height: 20),
          pw.Container(
            width: double.infinity,
            padding: const pw.EdgeInsets.all(20),
            decoration: pw.BoxDecoration(
              color: _softBlue,
              borderRadius: pw.BorderRadius.circular(8),
            ),
            child: pw.Column(
              children: [
                pw.Text(
                  'RESULTADO',
                  style: pw.TextStyle(
                    color: _blue,
                    fontSize: 10,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 8),
                pw.Text(
                  'Relatório completo com projeção financeira e '
                  'mapa de oportunidades.',
                  textAlign: pw.TextAlign.center,
                  style: const pw.TextStyle(color: _text, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 7 – RELATÓRIO DIRIGIDO COM IA
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildRelatorioIA(pw.ThemeData theme) {
    return _contentPage(
      theme: theme,
      pageNumber: 7,
      title: 'Relatório Dirigido com IA',
      body: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _paragraph(
            'Análise automatizada com inteligência artificial que '
            'interpreta os dados educacionais e financeiros do município.',
          ),
          pw.SizedBox(height: 14),
          _paragraph(
            'Insights acionáveis para o gestor em linguagem clara '
            'e objetiva.',
          ),
          pw.SizedBox(height: 24),
          pw.Container(
            width: double.infinity,
            padding: const pw.EdgeInsets.symmetric(
              vertical: 16,
              horizontal: 24,
            ),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: _gold, width: 1.5),
              borderRadius: pw.BorderRadius.circular(8),
            ),
            child: pw.Row(
              children: [
                pw.Container(
                  width: 40,
                  height: 40,
                  decoration: const pw.BoxDecoration(
                    color: _softGold,
                    shape: pw.BoxShape.circle,
                  ),
                  alignment: pw.Alignment.center,
                  child: pw.Text(
                    'IA',
                    style: pw.TextStyle(
                      color: _gold,
                      fontSize: 14,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                ),
                pw.SizedBox(width: 16),
                pw.Expanded(
                  child: pw.Text(
                    'Tecnologia proprietária que transforma dados brutos '
                    'em recomendações estratégicas.',
                    style: const pw.TextStyle(color: _text, fontSize: 10),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 8 – GESTÃO DE CONTRATOS
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildContratos(pw.ThemeData theme) {
    return _contentPage(
      theme: theme,
      pageNumber: 8,
      title: 'Gestão de Contratos',
      body: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _paragraph(
            'Kit documental completo para contratação municipal:',
          ),
          pw.SizedBox(height: 18),
          _contractItem('01', 'Termo de Referência'),
          _contractItem('02', 'Parecer Jurídico'),
          _contractItem('03', 'Justificativa de Inexigibilidade'),
          _contractItem('04', 'Contrato Técnico'),
          _contractItem('05', 'Proposta Comercial'),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 9 – METODOLOGIA
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildMetodologia(pw.ThemeData theme) {
    return _contentPage(
      theme: theme,
      pageNumber: 9,
      title: 'Nossa Metodologia',
      body: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(height: 10),
          _timelineStep(
            '1',
            'Diagnóstico',
            'Coleta e análise de dados oficiais',
            showLine: true,
          ),
          _timelineStep(
            '2',
            'Planejamento',
            'Roteiro priorizado de ações',
            showLine: true,
          ),
          _timelineStep(
            '3',
            'Execução',
            'Implementação acompanhada',
            showLine: true,
          ),
          _timelineStep(
            '4',
            'Monitoramento',
            'Resultados e ajustes contínuos',
            showLine: false,
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 10 – TECNOLOGIA
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildTecnologia(pw.ThemeData theme) {
    return _contentPage(
      theme: theme,
      pageNumber: 10,
      title: 'Tecnologia a Serviço da Educação',
      body: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(
            width: double.infinity,
            padding: const pw.EdgeInsets.all(16),
            decoration: pw.BoxDecoration(
              color: _navy,
              borderRadius: pw.BorderRadius.circular(8),
            ),
            child: pw.Text(
              'Plataforma própria: PrimeOS',
              textAlign: pw.TextAlign.center,
              style: pw.TextStyle(
                color: _gold,
                fontSize: 16,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
          ),
          pw.SizedBox(height: 20),
          _bulletItem('Dashboard com indicadores em tempo real'),
          _bulletItem('Geração automática de relatórios'),
          _bulletItem('Projeções financeiras com IA'),
          _bulletItem('Monitoramento de metas educacionais'),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 11 – DIFERENCIAIS
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildDiferenciais(pw.ThemeData theme) {
    return _contentPage(
      theme: theme,
      pageNumber: 11,
      title: 'Por que a Rocha Prime?',
      body: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _checkItem('Especialização exclusiva em educação pública'),
          pw.SizedBox(height: 6),
          _checkItem(
            'Base de dados proprietária com +5.000 municípios',
          ),
          pw.SizedBox(height: 6),
          _checkItem('Tecnologia própria de análise e projeção'),
          pw.SizedBox(height: 6),
          _checkItem(
            'Equipe multidisciplinar (educação, finanças, direito)',
          ),
          pw.SizedBox(height: 6),
          _checkItem('Resultados mensuráveis e comprovados'),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 12 – CASES
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildCases(pw.ThemeData theme) {
    return _contentPage(
      theme: theme,
      pageNumber: 12,
      title: 'Cases de Sucesso',
      body: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _caseCard(
            'Município de pequeno porte',
            'Recuperação de R\$ 2.1M em complementação '
                'VAAT não captada',
          ),
          pw.SizedBox(height: 14),
          _caseCard(
            'Município de médio porte',
            'Incremento de 34% na receita FUNDEB '
                'após reestruturação',
          ),
          pw.SizedBox(height: 14),
          _caseCard(
            'Capital estadual',
            'Otimização de R\$ 15M em recursos educacionais',
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 13 – DEPOIMENTOS
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildDepoimentos(pw.ThemeData theme) {
    return _contentPage(
      theme: theme,
      pageNumber: 13,
      title: 'O que dizem nossos clientes',
      body: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(height: 10),
          _quoteCard(
            '"A Rocha Prime nos mostrou recursos que nem '
            'sabíamos existir."',
            '— Secretário de Educação',
          ),
          pw.SizedBox(height: 20),
          _quoteCard(
            '"O relatório técnico foi fundamental para a '
            'tomada de decisão."',
            '— Prefeito Municipal',
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 14 – PARCEIROS
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildParceiros(pw.ThemeData theme) {
    return _contentPage(
      theme: theme,
      pageNumber: 14,
      title: 'Ecossistema de Atuação',
      body: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _paragraph(
            'Atuamos em conjunto com os principais órgãos:',
          ),
          pw.SizedBox(height: 18),
          _partnerRow(
            'FNDE',
            'Fundo Nacional de Desenvolvimento da Educação',
          ),
          pw.SizedBox(height: 10),
          _partnerRow(
            'INEP',
            'Instituto Nacional de Estudos e Pesquisas Educacionais',
          ),
          pw.SizedBox(height: 10),
          _partnerRow(
            'MEC',
            'Ministério da Educação',
          ),
          pw.SizedBox(height: 10),
          _partnerRow(
            'TCU / TCE',
            'Tribunais de Contas',
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 15 – PRÓXIMOS PASSOS
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildProximosPassos(pw.ThemeData theme) {
    return _contentPage(
      theme: theme,
      pageNumber: 15,
      title: 'Próximos Passos',
      body: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(height: 10),
          _timelineStep(
            '1',
            'Agendamento',
            'Agendamento de reunião técnica',
            showLine: true,
          ),
          _timelineStep(
            '2',
            'Diagnóstico',
            'Apresentação do diagnóstico personalizado',
            showLine: true,
          ),
          _timelineStep(
            '3',
            'Proposta',
            'Proposta de atuação e cronograma',
            showLine: false,
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SLIDE 16 – CONTATO
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildContato(pw.ThemeData theme) {
    return pw.Page(
      pageFormat: _slideFormat,
      theme: theme,
      margin: pw.EdgeInsets.zero,
      build: (context) => pw.Container(
        width: _slideFormat.width,
        height: _slideFormat.height,
        color: _navy,
        padding: const pw.EdgeInsets.symmetric(horizontal: 60, vertical: 40),
        child: pw.Column(
          mainAxisAlignment: pw.MainAxisAlignment.center,
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            pw.Text(
              'Fale Conosco',
              style: pw.TextStyle(
                color: _gold,
                fontSize: 28,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            pw.SizedBox(height: 30),
            pw.Text(
              'Rocha Prime Serviços Especializados Ltda',
              style: pw.TextStyle(
                color: _white,
                fontSize: 14,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            pw.SizedBox(height: 10),
            pw.Text(
              'CNPJ: 29.342.691/0001-93',
              style: const pw.TextStyle(color: _white, fontSize: 11),
            ),
            pw.SizedBox(height: 18),
            pw.Container(
              width: 80,
              height: 2,
              color: _gold,
            ),
            pw.SizedBox(height: 18),
            pw.Text(
              'contato@rochaprime.com.br',
              style: const pw.TextStyle(color: _white, fontSize: 12),
            ),
            pw.SizedBox(height: 6),
            pw.Text(
              'www.rochaprime.com.br',
              style: const pw.TextStyle(color: _white, fontSize: 12),
            ),
            pw.SizedBox(height: 30),
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(
                vertical: 12,
                horizontal: 40,
              ),
              decoration: pw.BoxDecoration(
                color: _gold,
                borderRadius: pw.BorderRadius.circular(6),
              ),
              child: pw.Text(
                'AGENDE UMA REUNIÃO',
                style: pw.TextStyle(
                  color: _navy,
                  fontSize: 13,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
            ),
            pw.SizedBox(height: 30),
            pw.Text(
              '16 / 16',
              style: pw.TextStyle(
                color: PdfColor.fromInt(0xFFAABBCC),
                fontSize: 8,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CONTENT PAGE TEMPLATE
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _contentPage({
    required pw.ThemeData theme,
    required int pageNumber,
    required String title,
    required pw.Widget body,
  }) {
    return pw.Page(
      pageFormat: _slideFormat,
      theme: theme,
      margin: pw.EdgeInsets.zero,
      build: (context) => pw.Container(
        width: _slideFormat.width,
        height: _slideFormat.height,
        color: _white,
        child: pw.Stack(
          children: [
            // Main content
            pw.Padding(
              padding: const pw.EdgeInsets.symmetric(
                horizontal: 60,
                vertical: 40,
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  _slideHeader(title),
                  pw.SizedBox(height: 20),
                  pw.Expanded(child: body),
                ],
              ),
            ),
            // Bottom-left: brand
            pw.Positioned(
              left: 60,
              bottom: 18,
              child: pw.Text(
                'ROCHA PRIME',
                style: pw.TextStyle(
                  color: _muted,
                  fontSize: 7,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
            ),
            // Bottom-right: page number
            pw.Positioned(
              right: 60,
              bottom: 18,
              child: pw.Text(
                '$pageNumber / 16',
                style: const pw.TextStyle(color: _muted, fontSize: 7),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  WIDGET HELPERS
  // ═══════════════════════════════════════════════════════════════════

  static pw.Widget _slideHeader(String title) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          title,
          style: pw.TextStyle(
            color: _navy,
            fontSize: 22,
            fontWeight: pw.FontWeight.bold,
          ),
        ),
        pw.SizedBox(height: 8),
        pw.Container(width: 60, height: 3, color: _gold),
      ],
    );
  }

  static pw.Widget _paragraph(String text) {
    return pw.Text(
      text,
      style: const pw.TextStyle(
        color: _text,
        fontSize: 12,
        lineSpacing: 4,
      ),
    );
  }

  static pw.Widget _bulletItem(String text) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 8),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(
            width: 6,
            height: 6,
            margin: const pw.EdgeInsets.only(top: 4, right: 10),
            decoration: const pw.BoxDecoration(
              color: _gold,
              shape: pw.BoxShape.circle,
            ),
          ),
          pw.Expanded(
            child: pw.Text(
              text,
              style: const pw.TextStyle(color: _text, fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _pillarCard(String label) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(vertical: 24, horizontal: 12),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: _gold, width: 1.5),
        borderRadius: pw.BorderRadius.circular(8),
      ),
      child: pw.Center(
        child: pw.Text(
          label,
          textAlign: pw.TextAlign.center,
          style: pw.TextStyle(
            color: _navy,
            fontSize: 13,
            fontWeight: pw.FontWeight.bold,
          ),
        ),
      ),
    );
  }

  static pw.Widget _kpiCard(
    String value,
    String label,
    PdfColor accentColor,
  ) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(20),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: _line),
        borderRadius: pw.BorderRadius.circular(8),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.center,
        children: [
          pw.Text(
            value,
            style: pw.TextStyle(
              color: accentColor,
              fontSize: 24,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 6),
          pw.Text(
            label,
            textAlign: pw.TextAlign.center,
            style: const pw.TextStyle(color: _muted, fontSize: 10),
          ),
        ],
      ),
    );
  }

  static pw.Widget _contractItem(String number, String label) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 10),
      child: pw.Row(
        children: [
          pw.Container(
            width: 28,
            height: 28,
            decoration: const pw.BoxDecoration(
              color: _softGold,
              shape: pw.BoxShape.circle,
            ),
            alignment: pw.Alignment.center,
            child: pw.Text(
              number,
              style: pw.TextStyle(
                color: _gold,
                fontSize: 10,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
          ),
          pw.SizedBox(width: 14),
          pw.Text(
            label,
            style: pw.TextStyle(
              color: _navy,
              fontSize: 12,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _timelineStep(
    String number,
    String title,
    String description, {
    required bool showLine,
  }) {
    return pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Column(
          children: [
            pw.Container(
              width: 28,
              height: 28,
              decoration: const pw.BoxDecoration(
                color: _navy,
                shape: pw.BoxShape.circle,
              ),
              alignment: pw.Alignment.center,
              child: pw.Text(
                number,
                style: pw.TextStyle(
                  color: _white,
                  fontSize: 12,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
            ),
            if (showLine)
              pw.Container(
                width: 2,
                height: 36,
                color: _line,
              ),
          ],
        ),
        pw.SizedBox(width: 14),
        pw.Expanded(
          child: pw.Padding(
            padding: const pw.EdgeInsets.only(bottom: 14),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  title,
                  style: pw.TextStyle(
                    color: _navy,
                    fontSize: 13,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  description,
                  style: const pw.TextStyle(color: _text, fontSize: 11),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  static pw.Widget _checkItem(String text) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 4),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(
            width: 20,
            height: 20,
            margin: const pw.EdgeInsets.only(right: 10),
            decoration: pw.BoxDecoration(
              color: _softGold,
              borderRadius: pw.BorderRadius.circular(4),
            ),
            alignment: pw.Alignment.center,
            child: pw.Text(
              '✓',
              style: pw.TextStyle(
                color: _gold,
                fontSize: 11,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
          ),
          pw.Expanded(
            child: pw.Padding(
              padding: const pw.EdgeInsets.only(top: 2),
              child: pw.Text(
                text,
                style: const pw.TextStyle(color: _text, fontSize: 11),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _caseCard(String title, String description) {
    return pw.Container(
      width: double.infinity,
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: _line),
        borderRadius: pw.BorderRadius.circular(8),
      ),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(
            width: 8,
            height: 8,
            margin: const pw.EdgeInsets.only(top: 4, right: 12),
            decoration: const pw.BoxDecoration(
              color: _green,
              shape: pw.BoxShape.circle,
            ),
          ),
          pw.Expanded(
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  title,
                  style: pw.TextStyle(
                    color: _navy,
                    fontSize: 11,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  description,
                  style: const pw.TextStyle(color: _text, fontSize: 10),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _quoteCard(String quote, String author) {
    return pw.Container(
      width: double.infinity,
      padding: const pw.EdgeInsets.all(20),
      decoration: pw.BoxDecoration(
        color: _softGold,
        borderRadius: pw.BorderRadius.circular(8),
        border: pw.Border(
          left: pw.BorderSide(color: _gold, width: 4),
        ),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            quote,
            style: pw.TextStyle(
              color: _navy,
              fontSize: 12,
              fontWeight: pw.FontWeight.bold,
              fontStyle: pw.FontStyle.italic,
              lineSpacing: 4,
            ),
          ),
          pw.SizedBox(height: 10),
          pw.Text(
            author,
            style: const pw.TextStyle(color: _muted, fontSize: 10),
          ),
        ],
      ),
    );
  }

  static pw.Widget _partnerRow(String acronym, String fullName) {
    return pw.Row(
      children: [
        pw.Container(
          width: 70,
          padding: const pw.EdgeInsets.symmetric(vertical: 8, horizontal: 10),
          decoration: pw.BoxDecoration(
            color: _navy,
            borderRadius: pw.BorderRadius.circular(4),
          ),
          child: pw.Center(
            child: pw.Text(
              acronym,
              style: pw.TextStyle(
                color: _white,
                fontSize: 10,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
          ),
        ),
        pw.SizedBox(width: 14),
        pw.Expanded(
          child: pw.Text(
            fullName,
            style: const pw.TextStyle(color: _text, fontSize: 11),
          ),
        ),
      ],
    );
  }
}
