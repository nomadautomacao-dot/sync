
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import '../../../core/models/levantamento_fundeb_models.dart';

class FundebComercialPdfBuilder {
  // ─── Colors ──────────────────────────────────────────────────────────
  static const PdfColor _navy = PdfColor.fromInt(0xFF0F2747);
  static const PdfColor _gold = PdfColor.fromInt(0xFFD4A843);
  static const PdfColor _green = PdfColor.fromInt(0xFF15803D);
  static const PdfColor _blue = PdfColor.fromInt(0xFF1D5FAF);
  static const PdfColor _text = PdfColor.fromInt(0xFF172033);
  static const PdfColor _muted = PdfColor.fromInt(0xFF677184);
  static const PdfColor _line = PdfColor.fromInt(0xFFD7DFEA);
  static const PdfColor _white = PdfColor.fromInt(0xFFFFFFFF);
  static const PdfColor _softBlue = PdfColor.fromInt(0xFFEAF3FF);
  static const PdfColor _softGreen = PdfColor.fromInt(0xFFEDF7EF);
  static const PdfColor _softGold = PdfColor.fromInt(0xFFFFF9ED);
  static const PdfColor _orange = PdfColor.fromInt(0xFFE67E22);

  static final NumberFormat _brl =
      NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
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
  static Future<Uint8List> buildFromBundle(
    LevantamentoFundebBundle bundle, {
    RelatorioDirigidoMunicipio? directedReport,
  }) async {
    final font = await _loadFont();
    final relatorio = bundle.relatorio;
    final report = directedReport ?? bundle.relatorioDirigidoBase;
    final pdf = pw.Document(
      title:
          'Diagnóstico Educacional - ${relatorio.identificacao.municipioNome}',
      author: 'Rocha Prime',
    );

    _appendPages(pdf, relatorio, report, font, bundle);
    return pdf.save();
  }

  // ─── Page orchestrator ──────────────────────────────────────────────
  static void _appendPages(
    pw.Document pdf,
    RelatorioFundeb relatorio,
    RelatorioDirigidoMunicipio? report,
    pw.Font font,
    LevantamentoFundebBundle bundle,
  ) {
    final theme = pw.ThemeData.withFont(
      base: font,
      bold: font,
      italic: font,
      boldItalic: font,
    );

    pdf.addPage(_buildCapa(relatorio, theme));
    pdf.addPage(_buildResumoExecutivo(relatorio, report, bundle, theme));
    pdf.addPage(_buildDiagnostico(relatorio, report, theme));
    pdf.addPage(_buildOportunidade(relatorio, report, theme));
    pdf.addPage(_buildEvolucao(relatorio, report, theme));
    pdf.addPage(_buildPropostaAtuacao(relatorio, theme));
    pdf.addPage(_buildProximosPassos(relatorio, theme));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PAGE 1 – CAPA
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildCapa(RelatorioFundeb relatorio, pw.ThemeData theme) {
    final ident = relatorio.identificacao;
    final now = DateTime.now();
    final dateLabel = DateFormat('dd/MM/yyyy', 'pt_BR').format(now);

    return pw.Page(
      pageFormat: PdfPageFormat.a4,
      theme: theme,
      margin: pw.EdgeInsets.zero,
      build: (context) => pw.Container(
        width: PdfPageFormat.a4.width,
        height: PdfPageFormat.a4.height,
        color: _navy,
        padding: const pw.EdgeInsets.symmetric(horizontal: 48, vertical: 40),
        child: pw.Column(
          mainAxisAlignment: pw.MainAxisAlignment.center,
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            pw.Text(
              'ROCHA PRIME',
              style: pw.TextStyle(
                color: _white,
                fontSize: 16,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            pw.SizedBox(height: 4),
            pw.Text(
              'SERVIÇOS ESPECIALIZADOS',
              style: const pw.TextStyle(color: _white, fontSize: 9),
            ),
            pw.SizedBox(height: 18),
            pw.Container(
              width: 80,
              height: 2,
              color: _gold,
            ),
            pw.SizedBox(height: 18),
            pw.Text(
              'DIAGNÓSTICO EDUCACIONAL',
              textAlign: pw.TextAlign.center,
              style: pw.TextStyle(
                color: _gold,
                fontSize: 20,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            pw.Text(
              'E FINANCEIRO',
              textAlign: pw.TextAlign.center,
              style: pw.TextStyle(
                color: _gold,
                fontSize: 20,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            pw.SizedBox(height: 48),
            pw.Text(
              ident.municipioNome.toUpperCase(),
              textAlign: pw.TextAlign.center,
              style: pw.TextStyle(
                color: _white,
                fontSize: 24,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            pw.SizedBox(height: 6),
            pw.Text(
              ident.uf,
              style: const pw.TextStyle(color: _white, fontSize: 12),
            ),
            pw.SizedBox(height: 24),
            pw.Text(
              'Exercício ${ident.exercicio}',
              style: pw.TextStyle(
                color: PdfColor.fromInt(0xFFAABBCC),
                fontSize: 10,
              ),
            ),
            pw.SizedBox(height: 60),
            pw.Text(
              dateLabel,
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
  //  PAGE 2 – RESUMO EXECUTIVO
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildResumoExecutivo(
    RelatorioFundeb relatorio,
    RelatorioDirigidoMunicipio? report,
    LevantamentoFundebBundle bundle,
    pw.ThemeData theme,
  ) {
    final projection = relatorio.activeProjection;
    final censo = relatorio.censoEscolar;
    final ibge = report?.perfilIBGE;
    final ibgePerfil = bundle.ibgePerfil;
    final nome = relatorio.identificacao.municipioNome;

    return pw.Page(
      pageFormat: PdfPageFormat.a4,
      theme: theme,
      margin: const pw.EdgeInsets.all(40),
      build: (context) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _pageHeader('RESUMO PARA O GESTOR'),
          pw.SizedBox(height: 16),
          // 3 metric cards
          pw.Row(
            children: [
              pw.Expanded(
                child: _bigCard(
                  'RECEITA EDUCACIONAL',
                  _money(relatorio.receitas.totalReceitas),
                  _softBlue,
                  _blue,
                ),
              ),
              pw.SizedBox(width: 10),
              pw.Expanded(
                child: _bigCard(
                  'POTENCIAL DE GANHO',
                  _money(projection.totalGanho),
                  _softGreen,
                  _green,
                ),
              ),
              pw.SizedBox(width: 10),
              pw.Expanded(
                child: _bigCard(
                  'ALUNOS NA REDE',
                  _integerNullable(censo?.totalMatriculas),
                  _softBlue,
                  _blue,
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 20),
          // Callout synthesis
          pw.Container(
            width: double.infinity,
            padding: const pw.EdgeInsets.all(14),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: _gold, width: 1.5),
              borderRadius: pw.BorderRadius.circular(6),
            ),
            child: pw.Text(
              'O município de $nome movimenta '
              '${_money(relatorio.receitas.totalReceitas)} em recursos '
              'educacionais. Nosso diagnóstico identificou um potencial de '
              '${_money(projection.totalGanho)} em receita que atualmente '
              'não está sendo captada pela administração municipal.',
              style: const pw.TextStyle(
                color: _text,
                fontSize: 9,
                lineSpacing: 3,
              ),
            ),
          ),
          pw.SizedBox(height: 14),
          // 4 mini-cards
          pw.Row(
            children: [
              pw.Expanded(
                child: _miniCard(
                  'População',
                  _populationLabel(ibge, ibgePerfil),
                ),
              ),
              pw.SizedBox(width: 8),
              pw.Expanded(
                child: _miniCard(
                  'IDHM',
                  _idhmLabel(ibge, ibgePerfil),
                ),
              ),
              pw.SizedBox(width: 8),
              pw.Expanded(
                child: _miniCard(
                  'Escolas',
                  _integerNullable(censo?.totalEscolas),
                ),
              ),
              pw.SizedBox(width: 8),
              pw.Expanded(
                child: _miniCard(
                  'Docentes',
                  _integerNullable(censo?.totalDocentes),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PAGE 3 – DIAGNÓSTICO
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildDiagnostico(
    RelatorioFundeb relatorio,
    RelatorioDirigidoMunicipio? report,
    pw.ThemeData theme,
  ) {
    final saudeFiscal = report?.saudeFiscal;
    final receitas = relatorio.receitas;

    // Fiscal health
    final fiscalOk = saudeFiscal?.situacaoLrf != null &&
        saudeFiscal!.situacaoLrf!.toLowerCase().contains('abaixo');
    final fiscalColor = saudeFiscal == null
        ? _muted
        : fiscalOk
            ? _green
            : _orange;
    final fiscalText = saudeFiscal == null
        ? 'Informação fiscal não disponível na base consultada.'
        : fiscalOk
            ? 'O município mantém as despesas com pessoal dentro dos limites legais, demonstrando equilíbrio na gestão dos recursos.'
            : 'As despesas com pessoal do município estão próximas ou acima dos limites recomendados, exigindo atenção.';

    // Education quality
    final hasIdeb = relatorio.idebAnosIniciais.isNotEmpty;
    final lastIdeb = hasIdeb ? relatorio.idebAnosIniciais.last : null;
    final educColor = hasIdeb && lastIdeb?.idebVerificado != null
        ? (lastIdeb!.idebVerificado! >= 5.0 ? _green : _orange)
        : _muted;
    final educText = hasIdeb && lastIdeb?.idebVerificado != null
        ? 'O indicador de qualidade educacional mais recente atingiu '
            '${lastIdeb!.idebVerificado!.toStringAsFixed(1)} pontos. '
            '${lastIdeb.idebVerificado! >= 5.0 ? 'Resultado positivo que fortalece a captação de recursos.' : 'Há espaço para melhorias que podem aumentar a receita.'}'
        : 'Indicadores de qualidade educacional não disponíveis na base consultada.';

    // Federal resources capture
    final missingLines = <String>[];
    if (receitas.complementacaoVAAF == 0) {
      missingLines.add('complementação por desempenho');
    }
    if (receitas.complementacaoVAAT == 0) {
      missingLines.add('complementação por resultado total');
    }
    if (receitas.complementacaoVAAR == 0) {
      missingLines.add('complementação por redução de desigualdades');
    }
    final captColor = missingLines.isEmpty ? _green : _orange;
    final captText = missingLines.isEmpty
        ? 'O município capta todas as linhas de recursos federais disponíveis.'
        : 'O município não está captando ${missingLines.length} '
            '${missingLines.length == 1 ? 'linha' : 'linhas'} de recursos '
            'federais: ${missingLines.join(', ')}.';

    return pw.Page(
      pageFormat: PdfPageFormat.a4,
      theme: theme,
      margin: const pw.EdgeInsets.all(40),
      build: (context) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _pageHeader('O QUE ENCONTRAMOS'),
          pw.SizedBox(height: 16),
          _statusRow(fiscalColor, 'SAÚDE FISCAL', fiscalText),
          pw.SizedBox(height: 12),
          _statusRow(educColor, 'BASE EDUCACIONAL', educText),
          pw.SizedBox(height: 12),
          _statusRow(captColor, 'CAPTAÇÃO DE RECURSOS FEDERAIS', captText),
          pw.SizedBox(height: 18),
          pw.Text(
            'Este diagnóstico cruza dados oficiais de diferentes órgãos '
            'federais para apresentar uma leitura integrada da situação '
            'educacional e financeira do município. Os indicadores acima '
            'representam os principais eixos de avaliação.',
            style: const pw.TextStyle(color: _muted, fontSize: 8),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PAGE 4 – OPORTUNIDADE
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildOportunidade(
    RelatorioFundeb relatorio,
    RelatorioDirigidoMunicipio? report,
    pw.ThemeData theme,
  ) {
    final projection = relatorio.activeProjection;
    final receitas = relatorio.receitas;
    final cenario = report?.cenarioEstruturacao;

    final receitaAtual = receitas.totalReceitas;
    final receitaProjetada = projection.totalProjetado;
    final maxVal =
        receitaProjetada > receitaAtual ? receitaProjetada : receitaAtual;
    final barMaxWidth = 340.0;
    final barAtual =
        maxVal > 0 ? (receitaAtual / maxVal) * barMaxWidth : barMaxWidth * 0.5;
    final barProj = maxVal > 0
        ? (receitaProjetada / maxVal) * barMaxWidth
        : barMaxWidth;

    // Opportunities
    final opportunities = <String>[];
    if (receitas.complementacaoVAAF == 0 ||
        receitas.complementacaoVAAT == 0 ||
        receitas.complementacaoVAAR == 0) {
      opportunities.add(
          'Recursos federais não captados — existem linhas de complementação '
          'que o município ainda não acessa');
    }
    if (cenario != null) {
      opportunities.add(
          'Matrículas que geram mais receita — ampliação estratégica de '
          'educação integral, EJA e educação especial');
    }
    opportunities.add(
        'Regularização e fortalecimento da base — ajustes cadastrais e '
        'documentais que protegem e ampliam a receita');

    return pw.Page(
      pageFormat: PdfPageFormat.a4,
      theme: theme,
      margin: const pw.EdgeInsets.all(40),
      build: (context) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _pageHeader('QUANTO O MUNICÍPIO PODE GANHAR'),
          pw.SizedBox(height: 16),
          // Central gold card
          pw.Container(
            width: double.infinity,
            padding: const pw.EdgeInsets.all(20),
            decoration: pw.BoxDecoration(
              color: _softGold,
              border: pw.Border.all(color: _gold, width: 1.5),
              borderRadius: pw.BorderRadius.circular(8),
            ),
            child: pw.Column(
              children: [
                pw.Text(
                  'POTENCIAL DE GANHO IDENTIFICADO',
                  style: const pw.TextStyle(color: _muted, fontSize: 9),
                ),
                pw.SizedBox(height: 6),
                pw.Text(
                  _money(projection.totalGanho),
                  style: pw.TextStyle(
                    color: _gold,
                    fontSize: 22,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  'sujeito a validação documental e plano de ação',
                  style: const pw.TextStyle(color: _muted, fontSize: 7),
                ),
              ],
            ),
          ),
          pw.SizedBox(height: 16),
          // Comparison bars
          _comparisonBar('RECEITA ATUAL', receitaAtual, barAtual, _blue),
          pw.SizedBox(height: 8),
          _comparisonBar(
              'RECEITA PROJETADA', receitaProjetada, barProj, _green),
          pw.SizedBox(height: 16),
          // Opportunities
          if (opportunities.isNotEmpty) ...[
            pw.Text(
              'ÁREAS DE OPORTUNIDADE',
              style: pw.TextStyle(
                color: _navy,
                fontSize: 10,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            pw.SizedBox(height: 8),
            ...opportunities.map(
              (item) => pw.Padding(
                padding: const pw.EdgeInsets.only(bottom: 6),
                child: pw.Row(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Container(
                      width: 5,
                      height: 5,
                      margin: const pw.EdgeInsets.only(top: 3, right: 8),
                      decoration: const pw.BoxDecoration(
                        color: _gold,
                        shape: pw.BoxShape.circle,
                      ),
                    ),
                    pw.Expanded(
                      child: pw.Text(
                        item,
                        style: const pw.TextStyle(
                          color: _text,
                          fontSize: 8.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PAGE 5 – EVOLUÇÃO
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildEvolucao(
    RelatorioFundeb relatorio,
    RelatorioDirigidoMunicipio? report,
    pw.ThemeData theme,
  ) {
    final historico = report?.historico.anos ?? <RelatorioDirigidoSerieHistoricaAno>[];
    final filtered = historico
        .where((a) =>
            a.totalReceitasFundeb != null && a.totalReceitasFundeb! > 0)
        .toList();
    final maxReceita = filtered.isNotEmpty
        ? filtered
            .map((a) => a.totalReceitasFundeb!)
            .reduce((a, b) => a > b ? a : b)
        : 1.0;
    final barMax = 320.0;
    final recursosPorAluno = report?.recursosPorAluno;

    return pw.Page(
      pageFormat: PdfPageFormat.a4,
      theme: theme,
      margin: const pw.EdgeInsets.all(40),
      build: (context) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _pageHeader('EVOLUÇÃO DOS RECURSOS'),
          pw.SizedBox(height: 16),
          if (filtered.isEmpty)
            pw.Text(
              'Dados históricos não disponíveis na base consultada.',
              style: const pw.TextStyle(color: _muted, fontSize: 9),
            )
          else
            ...filtered.map(
              (ano) {
                final w =
                    (ano.totalReceitasFundeb! / maxReceita) * barMax;
                return pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 8),
                  child: pw.Row(
                    children: [
                      pw.SizedBox(
                        width: 40,
                        child: pw.Text(
                          '${ano.ano}',
                          style: pw.TextStyle(
                            color: _navy,
                            fontSize: 9,
                            fontWeight: pw.FontWeight.bold,
                          ),
                        ),
                      ),
                      pw.Container(
                        width: w.clamp(4.0, barMax),
                        height: 20,
                        decoration: pw.BoxDecoration(
                          color: _blue,
                          borderRadius: pw.BorderRadius.circular(3),
                        ),
                      ),
                      pw.SizedBox(width: 8),
                      pw.Text(
                        _money(ano.totalReceitasFundeb!),
                        style: const pw.TextStyle(
                          color: _text,
                          fontSize: 8,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          pw.SizedBox(height: 18),
          if (recursosPorAluno != null) ...[
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.all(12),
              decoration: pw.BoxDecoration(
                color: _softBlue,
                borderRadius: pw.BorderRadius.circular(6),
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'RECURSO POR ALUNO',
                    style: pw.TextStyle(
                      color: _navy,
                      fontSize: 9,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 4),
                  pw.Text(
                    '${_money(recursosPorAluno.valor)} por aluno '
                    '(${_integer(recursosPorAluno.totalAlunosMunicipais)} alunos, '
                    'referência ${recursosPorAluno.anoReferencia})',
                    style: const pw.TextStyle(color: _text, fontSize: 8.5),
                  ),
                ],
              ),
            ),
            pw.SizedBox(height: 12),
          ],
          pw.Text(
            filtered.length >= 2
                ? 'A série acima mostra a evolução dos recursos educacionais '
                    'ao longo dos últimos anos. Acompanhar esse histórico '
                    'permite identificar tendências de crescimento, estagnação '
                    'ou retração na receita do município.'
                : 'Dados insuficientes para análise de tendência. '
                    'Com o plano de ação, será possível construir uma base '
                    'histórica sólida para acompanhamento.',
            style: const pw.TextStyle(color: _muted, fontSize: 8),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PAGE 6 – PROPOSTA DE ATUAÇÃO
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildPropostaAtuacao(
    RelatorioFundeb relatorio,
    pw.ThemeData theme,
  ) {
    final nome = relatorio.identificacao.municipioNome;

    return pw.Page(
      pageFormat: PdfPageFormat.a4,
      theme: theme,
      margin: const pw.EdgeInsets.all(40),
      build: (context) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _pageHeader('NOSSA PROPOSTA PARA ${nome.toUpperCase()}'),
          pw.SizedBox(height: 16),
          _serviceBlock(
            'Diagnóstico Completo',
            'Cruzamos bases oficiais do MEC, FNDE, INEP e Tesouro Nacional '
                'para identificar cada real que o município tem direito.',
          ),
          pw.SizedBox(height: 10),
          _serviceBlock(
            'Plano de Correções',
            'Elaboramos um roteiro priorizado de ações para regularizar '
                'a base e recuperar receita educacional.',
          ),
          pw.SizedBox(height: 10),
          _serviceBlock(
            'Acompanhamento Executivo',
            'Monitoramos os resultados, cobramos prazos e apresentamos '
                'relatórios periódicos ao gestor.',
          ),
          pw.SizedBox(height: 10),
          _serviceBlock(
            'Defesa Técnica',
            'Preparamos a argumentação institucional perante MEC e FNDE '
                'para proteger e ampliar os recursos.',
          ),
          pw.SizedBox(height: 20),
          pw.Text(
            'DIFERENCIAIS',
            style: pw.TextStyle(
              color: _navy,
              fontSize: 10,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 8),
          _checkItem('Especialistas em educação pública'),
          _checkItem('Resultados comprovados'),
          _checkItem('Material executivo'),
          _checkItem('Acompanhamento integral'),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PAGE 7 – PRÓXIMOS PASSOS
  // ═══════════════════════════════════════════════════════════════════
  static pw.Page _buildProximosPassos(
    RelatorioFundeb relatorio,
    pw.ThemeData theme,
  ) {
    return pw.Page(
      pageFormat: PdfPageFormat.a4,
      theme: theme,
      margin: const pw.EdgeInsets.all(40),
      build: (context) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _pageHeader('PRÓXIMOS PASSOS'),
          pw.SizedBox(height: 20),
          _timelineStep(
            '1',
            'Apresentação ao Gestor',
            'Alinhamos a leitura técnica e o plano de ação com o prefeito '
                'e secretário de educação.',
            showLine: true,
          ),
          _timelineStep(
            '2',
            'Mesa Técnica',
            'Abrimos mesa de trabalho com secretaria, financeiro e '
                'responsáveis pela base educacional.',
            showLine: true,
          ),
          _timelineStep(
            '3',
            'Plano de Ação',
            'Cronograma com prioridades, metas de recuperação e '
                'acompanhamento mensal de resultados.',
            showLine: false,
          ),
          pw.SizedBox(height: 24),
          // CTA box
          pw.Container(
            width: double.infinity,
            padding: const pw.EdgeInsets.symmetric(vertical: 18, horizontal: 24),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: _gold, width: 1.5),
              borderRadius: pw.BorderRadius.circular(8),
            ),
            child: pw.Column(
              children: [
                pw.Text(
                  'AGENDE UMA REUNIÃO DE APRESENTAÇÃO',
                  textAlign: pw.TextAlign.center,
                  style: pw.TextStyle(
                    color: _navy,
                    fontSize: 11,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 6),
                pw.Text(
                  'Rocha Prime Serviços Especializados Ltda',
                  textAlign: pw.TextAlign.center,
                  style: const pw.TextStyle(color: _muted, fontSize: 8),
                ),
                pw.SizedBox(height: 2),
                pw.Text(
                  'CNPJ: 29.342.691/0001-93',
                  textAlign: pw.TextAlign.center,
                  style: const pw.TextStyle(color: _muted, fontSize: 7),
                ),
              ],
            ),
          ),
          pw.SizedBox(height: 12),
          pw.Center(
            child: pw.Text(
              'Rocha Prime — Serviços Especializados em Educação Pública',
              style: const pw.TextStyle(color: _muted, fontSize: 7),
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  WIDGET HELPERS
  // ═══════════════════════════════════════════════════════════════════

  static pw.Widget _pageHeader(String title) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          title,
          style: pw.TextStyle(
            color: _navy,
            fontSize: 14,
            fontWeight: pw.FontWeight.bold,
          ),
        ),
        pw.SizedBox(height: 6),
        pw.Container(width: 50, height: 2, color: _gold),
      ],
    );
  }

  static pw.Widget _bigCard(
    String label,
    String value,
    PdfColor background,
    PdfColor valueColor,
  ) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(14),
      decoration: pw.BoxDecoration(
        color: background,
        borderRadius: pw.BorderRadius.circular(6),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            label,
            style: const pw.TextStyle(color: _muted, fontSize: 7),
          ),
          pw.SizedBox(height: 6),
          pw.Text(
            value,
            style: pw.TextStyle(
              color: valueColor,
              fontSize: 13,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _miniCard(String label, String value) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(10),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: _line),
        borderRadius: pw.BorderRadius.circular(4),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            label,
            style: const pw.TextStyle(color: _muted, fontSize: 7),
          ),
          pw.SizedBox(height: 4),
          pw.Text(
            value,
            style: pw.TextStyle(
              color: _navy,
              fontSize: 10,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _statusRow(
    PdfColor indicatorColor,
    String label,
    String description,
  ) {
    return pw.Container(
      width: double.infinity,
      padding: const pw.EdgeInsets.all(12),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: _line),
        borderRadius: pw.BorderRadius.circular(6),
      ),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(
            width: 10,
            height: 10,
            margin: const pw.EdgeInsets.only(top: 2, right: 10),
            decoration: pw.BoxDecoration(
              color: indicatorColor,
              shape: pw.BoxShape.circle,
            ),
          ),
          pw.Expanded(
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  label,
                  style: pw.TextStyle(
                    color: _navy,
                    fontSize: 9,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  description,
                  style: const pw.TextStyle(color: _text, fontSize: 8),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _comparisonBar(
    String label,
    double value,
    double barWidth,
    PdfColor barColor,
  ) {
    return pw.Row(
      children: [
        pw.SizedBox(
          width: 100,
          child: pw.Text(
            label,
            style: pw.TextStyle(
              color: _navy,
              fontSize: 8,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
        ),
        pw.Container(
          width: barWidth.clamp(4.0, 340.0),
          height: 18,
          decoration: pw.BoxDecoration(
            color: barColor,
            borderRadius: pw.BorderRadius.circular(3),
          ),
        ),
        pw.SizedBox(width: 8),
        pw.Text(
          _money(value),
          style: const pw.TextStyle(color: _text, fontSize: 8),
        ),
      ],
    );
  }

  static pw.Widget _serviceBlock(String title, String description) {
    return pw.Container(
      width: double.infinity,
      padding: const pw.EdgeInsets.all(12),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: _line),
        borderRadius: pw.BorderRadius.circular(6),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            title,
            style: pw.TextStyle(
              color: _navy,
              fontSize: 10,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 4),
          pw.Text(
            description,
            style: const pw.TextStyle(color: _muted, fontSize: 8),
          ),
        ],
      ),
    );
  }

  static pw.Widget _checkItem(String text) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 4),
      child: pw.Row(
        children: [
          pw.Text(
            '  ',
            style: const pw.TextStyle(color: _green, fontSize: 9),
          ),
          pw.SizedBox(width: 6),
          pw.Text(
            text,
            style: const pw.TextStyle(color: _text, fontSize: 8.5),
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
              width: 24,
              height: 24,
              decoration: const pw.BoxDecoration(
                color: _navy,
                shape: pw.BoxShape.circle,
              ),
              alignment: pw.Alignment.center,
              child: pw.Text(
                number,
                style: pw.TextStyle(
                  color: _white,
                  fontSize: 10,
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
        pw.SizedBox(width: 12),
        pw.Expanded(
          child: pw.Padding(
            padding: const pw.EdgeInsets.only(bottom: 12),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  title,
                  style: pw.TextStyle(
                    color: _navy,
                    fontSize: 10,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  description,
                  style: const pw.TextStyle(color: _text, fontSize: 8.5),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DATA HELPERS
  // ═══════════════════════════════════════════════════════════════════

  static String _money(double value) => _brl.format(value);


  static String _integer(int value) =>
      NumberFormat('#,###', 'pt_BR').format(value);

  static String _integerNullable(int? value) =>
      value == null ? '-' : _integer(value);

  static String _populationLabel(
    PerfilIBGE? ibge,
    IbgeMunicipioPerfil? perfil,
  ) {
    if (ibge?.populacaoEstimada != null) {
      return _integer(ibge!.populacaoEstimada!.round());
    }
    if (perfil?.populacaoEstimada != null) {
      return _integer(perfil!.populacaoEstimada!);
    }
    if (perfil?.populacaoUltimoCenso != null) {
      return _integer(perfil!.populacaoUltimoCenso!);
    }
    return '-';
  }

  static String _idhmLabel(
    PerfilIBGE? ibge,
    IbgeMunicipioPerfil? perfil,
  ) {
    if (ibge?.idhm != null) return ibge!.idhm!.toStringAsFixed(3);
    if (perfil?.idhm != null) return perfil!.idhm!.toStringAsFixed(3);
    return '-';
  }
}
