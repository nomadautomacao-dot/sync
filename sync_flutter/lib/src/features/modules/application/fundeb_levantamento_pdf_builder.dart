import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../../core/models/levantamento_fundeb_models.dart';

class FundebLevantamentoPdfBuilder {
  static const PdfColor _navy = PdfColor.fromInt(0xFF0F2747);
  static const PdfColor _blue = PdfColor.fromInt(0xFF1D5FAF);
  static const PdfColor _green = PdfColor.fromInt(0xFF15803D);
  static const PdfColor _orange = PdfColor.fromInt(0xFFE67E22);
  static const PdfColor _text = PdfColor.fromInt(0xFF172033);
  static const PdfColor _muted = PdfColor.fromInt(0xFF677184);
  static const PdfColor _line = PdfColor.fromInt(0xFFD7DFEA);
  static const PdfColor _softBlue = PdfColor.fromInt(0xFFEAF3FF);
  static const PdfColor _softGreen = PdfColor.fromInt(0xFFEDF7EF);
  static const PdfColor _softOrange = PdfColor.fromInt(0xFFFFF4E8);
  static const PdfColor _grey600 = PdfColor.fromInt(0xFF6B7280);
  static const PdfColor _grey700 = PdfColor.fromInt(0xFF374151);
  static const PdfColor _white = PdfColor.fromInt(0xFFFFFFFF);
  static const String _footerText =
      'Documento confidencial. Reprodução não autorizada.';
  static final NumberFormat _brlFormatter = NumberFormat.currency(
    locale: 'pt_BR',
    symbol: 'R\$',
  );
  static const String _layoutVersion = 'TECNICO RESPONSAVEL:ADRIEL TAVARES';
  static pw.Font? _interFont;
  static String? _cachedLogoSvg;
  static bool _logoLoaded = false;

  /// Pre-load font + logo once. Call before batch to eliminate I/O per PDF.
  static Future<void> warmupAssets() async {
    await _loadPdfFont();
    await _loadRochaPrimeLogoSvg();
  }

  static Future<Uint8List> build(RelatorioFundeb relatorio) async {
    return buildFromBundle(
      LevantamentoFundebBundle(
        relatorio: relatorio,
        fontes: const <FonteColetaStatus>[],
        relatorioDirigidoBase: null,
      ),
    );
  }

  static Future<Uint8List> buildFromBundle(
    LevantamentoFundebBundle bundle, {
    RelatorioDirigidoMunicipio? directedReport,
  }) async {
    final rochaLogoSvg = await _loadRochaPrimeLogoSvg();
    final contentFont = await _loadPdfFont();
    return buildFromBundleWithAssets(
      bundle,
      directedReport: directedReport,
      rochaLogoSvg: rochaLogoSvg,
      contentFont: contentFont,
    );
  }

  /// Batch-optimized: accepts pre-loaded assets to skip I/O per PDF.
  static Future<Uint8List> buildFromBundleWithAssets(
    LevantamentoFundebBundle bundle, {
    RelatorioDirigidoMunicipio? directedReport,
    required String? rochaLogoSvg,
    required pw.Font contentFont,
  }) async {
    final relatorio = bundle.relatorio;
    final generatedAt = DateTime.now();
    final pdf = pw.Document(
      title: 'Levantamento FUNDEB ${relatorio.identificacao.municipioNome}',
      author: 'PrimeOS',
    );
    _appendBundlePages(
      pdf,
      bundle,
      directedReport: directedReport,
      rochaLogoSvg: rochaLogoSvg,
      contentFont: contentFont,
      generatedAt: generatedAt,
    );

    return pdf.save();
  }

  static Future<Uint8List> buildLiteFromBundle(
    LevantamentoFundebBundle bundle, {
    RelatorioDirigidoMunicipio? directedReport,
  }) async {
    final relatorio = bundle.relatorio;
    final report = directedReport ?? bundle.relatorioDirigidoBase;
    final rochaLogoSvg = await _loadRochaPrimeLogoSvg();
    final contentFont = await _loadPdfFont();
    final generatedAt = DateTime.now();
    final pdf = pw.Document(
      title:
          'Levantamento Lite FUNDEB ${relatorio.identificacao.municipioNome}',
      author: 'PrimeOS',
      subject: 'Relatório infográfico de até duas páginas',
    );

    pdf.addPage(
      pw.MultiPage(
        maxPages: 2,
        pageTheme: _contentTheme(
          relatorio,
          rochaLogoSvg: rochaLogoSvg,
          contentFont: contentFont,
          generatedAt: generatedAt,
        ),
        build: (context) => _buildLitePages(relatorio, report, bundle),
      ),
    );

    return pdf.save();
  }

  static void _appendBundlePages(
    pw.Document pdf,
    LevantamentoFundebBundle bundle, {
    RelatorioDirigidoMunicipio? directedReport,
    String? rochaLogoSvg,
    required pw.Font contentFont,
    required DateTime generatedAt,
  }) {
    final relatorio = bundle.relatorio;
    final report = directedReport ?? bundle.relatorioDirigidoBase;

    pdf.addPage(
      _buildCover(
        relatorio,
        report: report,
        rochaLogoSvg: rochaLogoSvg,
        contentFont: contentFont,
        generatedAt: generatedAt,
      ),
    );
    pdf.addPage(
      pw.MultiPage(
        pageTheme: _contentTheme(
          relatorio,
          rochaLogoSvg: rochaLogoSvg,
          contentFont: contentFont,
          generatedAt: generatedAt,
        ),
        build: (context) => _buildExecutivePage(relatorio),
      ),
    );
    pdf.addPage(
      pw.MultiPage(
        pageTheme: _contentTheme(
          relatorio,
          rochaLogoSvg: rochaLogoSvg,
          contentFont: contentFont,
        ),
        build: (context) => _buildIdentificationAndReceitasPage(relatorio),
      ),
    );
    pdf.addPage(
      pw.MultiPage(
        pageTheme: _contentTheme(
          relatorio,
          rochaLogoSvg: rochaLogoSvg,
          contentFont: contentFont,
        ),
        build: (context) => _buildProjectionPage(relatorio),
      ),
    );
    if (relatorio.cronogramaVAAF.isNotEmpty) {
      pdf.addPage(
        pw.MultiPage(
          pageTheme: _contentTheme(
            relatorio,
            rochaLogoSvg: rochaLogoSvg,
            contentFont: contentFont,
          ),
          build: (context) => _buildCronogramaPage(relatorio),
        ),
      );
    }
    pdf.addPage(
      pw.MultiPage(
        pageTheme: _contentTheme(
          relatorio,
          rochaLogoSvg: rochaLogoSvg,
          contentFont: contentFont,
        ),
        build: (context) => _buildTechnicalAnnexPage(relatorio, report: report),
      ),
    );
    pdf.addPage(
      pw.MultiPage(
        pageTheme: _contentTheme(
          relatorio,
          rochaLogoSvg: rochaLogoSvg,
          contentFont: contentFont,
        ),
        build: (context) => _buildOperationalPage(relatorio),
      ),
    );
    if (relatorio.observacoesOperacionais.isNotEmpty) {
      pdf.addPage(
        pw.MultiPage(
          pageTheme: _contentTheme(
            relatorio,
            rochaLogoSvg: rochaLogoSvg,
            contentFont: contentFont,
          ),
          build: (context) => _buildObservacoesPage(relatorio),
        ),
      );
    }
    pdf.addPage(
      pw.MultiPage(
        pageTheme: _contentTheme(
          relatorio,
          rochaLogoSvg: rochaLogoSvg,
          contentFont: contentFont,
        ),
        build: (context) =>
            _buildEducationalBasePage(relatorio, report: report),
      ),
    );
    if (_tempoIntegralRows(relatorio).isNotEmpty) {
      pdf.addPage(
        pw.MultiPage(
          pageTheme: _contentTheme(
            relatorio,
            rochaLogoSvg: rochaLogoSvg,
            contentFont: contentFont,
          ),
          build: (context) => _buildTempoIntegralPage(relatorio),
        ),
      );
    }
    pdf.addPage(
      pw.MultiPage(
        pageTheme: _contentTheme(
          relatorio,
          rochaLogoSvg: rochaLogoSvg,
          contentFont: contentFont,
        ),
        build: (context) => _buildIdebPage(relatorio),
      ),
    );
    if (report?.indicadoresAprendizagem?.disponivel == true) {
      pdf.addPage(
        pw.MultiPage(
          pageTheme: _contentTheme(
            relatorio,
            rochaLogoSvg: rochaLogoSvg,
            contentFont: contentFont,
          ),
          build: (context) => _buildIndicadoresAprendizagemPage(report!),
        ),
      );
    }
    if (report?.infraestruturaEscolar?.disponivel == true) {
      pdf.addPage(
        pw.MultiPage(
          pageTheme: _contentTheme(
            relatorio,
            rochaLogoSvg: rochaLogoSvg,
            contentFont: contentFont,
          ),
          build: (context) => _buildInfraestruturaEscolarPage(report!),
        ),
      );
    }
    if (report?.narrativas != null) {
      pdf.addPage(
        pw.MultiPage(
          pageTheme: _contentTheme(
            relatorio,
            rochaLogoSvg: rochaLogoSvg,
            contentFont: contentFont,
          ),
          build: (context) => _buildNarrativasPage(report!),
        ),
      );
    }
    if (report?.saudeFiscal?.disponivel == true) {
      pdf.addPage(
        pw.MultiPage(
          pageTheme: _contentTheme(
            relatorio,
            rochaLogoSvg: rochaLogoSvg,
            contentFont: contentFont,
          ),
          build: (context) => _buildSaudeFiscalPage(report!),
        ),
      );
    }
    if (report?.cenarioEstruturacao != null) {
      pdf.addPage(
        pw.MultiPage(
          pageTheme: _contentTheme(
            relatorio,
            rochaLogoSvg: rochaLogoSvg,
            contentFont: contentFont,
          ),
          build: (context) => _buildCenarioEstruturacaoPage(report!),
        ),
      );
    }
    if (report != null) {
      pdf.addPage(
        pw.MultiPage(
          pageTheme: _contentTheme(
            relatorio,
            rochaLogoSvg: rochaLogoSvg,
            contentFont: contentFont,
          ),
          build: (context) => _buildDirectedHistoricPage(relatorio, report),
        ),
      );
      pdf.addPage(
        pw.MultiPage(
          pageTheme: _contentTheme(
            relatorio,
            rochaLogoSvg: rochaLogoSvg,
            contentFont: contentFont,
          ),
          build: (context) =>
              _buildDirectedComparativeOverviewPage(relatorio, report),
        ),
      );
      if (report.historico.anos.isNotEmpty) {
        pdf.addPage(
          pw.MultiPage(
            pageTheme: _contentTheme(
              relatorio,
              rochaLogoSvg: rochaLogoSvg,
              contentFont: contentFont,
            ),
            build: (context) =>
                _buildDirectedComparativeBasePage(relatorio, report),
          ),
        );
      }
      // Benchmark regional removido a pedido do cliente
      // pdf.addPage(
      //   pw.MultiPage(
      //     pageTheme: _contentTheme(relatorio, rochaLogoSvg: rochaLogoSvg, contentFont: contentFont),
      //     build: (context) => _buildDirectedBenchmarkPageCards(report),
      //   ),
      // );
      pdf.addPage(
        pw.MultiPage(
          pageTheme: _contentTheme(
            relatorio,
            rochaLogoSvg: rochaLogoSvg,
            contentFont: contentFont,
          ),
          build: (context) => _buildDirectedExecutivePart2(report),
        ),
      );
      pdf.addPage(
        pw.MultiPage(
          pageTheme: _contentTheme(
            relatorio,
            rochaLogoSvg: rochaLogoSvg,
            contentFont: contentFont,
          ),
          build: (context) => _buildDirectedExecutivePart1(report),
        ),
      );
    }
    if (bundle.fontes.isNotEmpty) {
      pdf.addPage(
        pw.MultiPage(
          pageTheme: _contentTheme(
            relatorio,
            rochaLogoSvg: rochaLogoSvg,
            contentFont: contentFont,
          ),
          build: (context) => _buildSourcesPage(bundle),
        ),
      );
    }
  }

  static List<pw.Widget> _buildLitePages(
    RelatorioFundeb relatorio,
    RelatorioDirigidoMunicipio? report,
    LevantamentoFundebBundle bundle,
  ) {
    final ident = relatorio.identificacao;
    final censo = relatorio.censoEscolar;
    final ibge = bundle.ibgePerfil;
    final projection = _projection(relatorio);
    final political = report?.contextoPolitico;
    final population = _officialPopulation(relatorio, report, ibge);
    final totalComplementation =
        relatorio.receitas.complementacaoVAAF +
        relatorio.receitas.complementacaoVAAT +
        relatorio.receitas.complementacaoVAAR;
    final timeline = _annualFundebRows(
      relatorio,
      report,
    ).where((item) => item.hasAnyValue).take(5).toList();
    final benchmark =
        report?.benchmarkRegional.municipios.take(2).toList() ??
        const <RelatorioDirigidoMunicipioComparavel>[];

    return [
      _pageTitle('Levantamento Lite FUNDEB'),
      pw.SizedBox(height: 8),
      pw.Container(
        padding: const pw.EdgeInsets.all(16),
        decoration: pw.BoxDecoration(
          color: _navy,
          borderRadius: pw.BorderRadius.circular(16),
        ),
        child: pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    _municipioLabel(relatorio).toUpperCase(),
                    style: pw.TextStyle(
                      color: _white,
                      fontSize: 24,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 8),
                  pw.Text(
                    'IBGE ${_safe(ident.codigoIBGE)}  |  ${_safe(ident.regiao)}  |  Exercício ${ident.exercicio}',
                    style: const pw.TextStyle(color: _white, fontSize: 8),
                  ),
                ],
              ),
            ),
            pw.SizedBox(width: 16),
            pw.Container(
              width: 96,
              padding: const pw.EdgeInsets.all(10),
              decoration: pw.BoxDecoration(
                color: const PdfColor.fromInt(0xFF183A66),
                borderRadius: pw.BorderRadius.circular(12),
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'Valor agregado',
                    style: const pw.TextStyle(color: _white, fontSize: 7),
                  ),
                  pw.SizedBox(height: 8),
                  pw.Text(
                    _moneyCompact(projection.totalGanho),
                    style: pw.TextStyle(
                      color: _white,
                      fontSize: 14,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.Text(
                    '+${_percent(projection.ganhoPercentual)} estimado',
                    style: const pw.TextStyle(color: _white, fontSize: 6.6),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      pw.SizedBox(height: 10),
      pw.Row(
        children: [
          pw.Expanded(
            child: _metricCard(
              'Habitantes',
              population == null ? '-' : _integer(population),
              population == null
                  ? 'Não informado pela base atual'
                  : 'Base IBGE',
              background: _softBlue,
              valueColor: _blue,
            ),
          ),
          pw.SizedBox(width: 10),
          pw.Expanded(
            child: _metricCard(
              'Receita FUNDEB',
              _moneyCompact(relatorio.receitas.totalReceitas),
              'Base oficial consolidada',
              background: _softGreen,
              valueColor: _green,
            ),
          ),
          pw.SizedBox(width: 10),
          pw.Expanded(
            child: _metricCard(
              'Ganho potencial',
              _moneyCompact(projection.totalGanho),
              '+${_percent(projection.ganhoPercentual)}',
              background: _softOrange,
              valueColor: _orange,
            ),
          ),
        ],
      ),
      pw.SizedBox(height: 8),
      pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Expanded(
            child: _litePanel('Cidade', [
              [
                'Prefeito',
                _safe(political?.prefeitoAtual, fallback: ident.prefeito),
              ],
              [
                'Partido',
                _safe(political?.partidoAtual, fallback: ident.partido),
              ],
              [
                'Mandato',
                _safe(political?.classificacaoMandato, fallback: '-'),
              ],
              ['Detalhe', _safe(political?.detalheMandato, fallback: '-')],
            ]),
          ),
          pw.SizedBox(width: 10),
          pw.Expanded(
            child: _litePanel('Rede escolar', [
              ['Escolas', censo == null ? '-' : _integer(censo.totalEscolas)],
              [
                'Matrículas',
                censo == null ? '-' : _integer(censo.totalMatriculas),
              ],
              ['Docentes', censo == null ? '-' : _integer(censo.totalDocentes)],
              ['Tempo integral', _integerNullable(censo?.tempoIntegral.total)],
              [
                'Infantil',
                _integerNullable(censo?.matriculasEtapa.educacaoInfantil),
              ],
              [
                'Fundamental',
                _integerNullable(censo?.matriculasEtapa.ensinoFundamental),
              ],
              [
                'EJA / Especial',
                '${_integerNullable(censo?.matriculasEtapa.eja)} / ${_integerNullable(censo?.matriculasEtapa.educacaoEspecial)}',
              ],
            ]),
          ),
        ],
      ),
      pw.SizedBox(height: 8),
      if (ibge != null && ibge.hasAny) ...[
        _liteGridPanel('IBGE oficial', _ibgeLiteRows(ibge).take(10).toList()),
        pw.SizedBox(height: 8),
      ],
      pw.NewPage(),
      _pageTitle('Leitura para reunião'),
      pw.SizedBox(height: 10),
      _liteCompositionBar(
        title: 'Composição da receita',
        total: relatorio.receitas.totalReceitas,
        segments: [
          _LiteSegment(
            'Contribuição municipal',
            relatorio.receitas.receitaContribuicaoMunicipal,
            _blue,
          ),
          _LiteSegment('Complementação União', totalComplementation, _green),
        ],
      ),
      pw.Row(
        children: [
          pw.Expanded(
            child: _metricCard(
              'Projetado',
              _moneyCompact(projection.totalProjetado),
              'Cenário técnico ativo',
              background: _softBlue,
              valueColor: _blue,
            ),
          ),
          pw.SizedBox(width: 10),
          pw.Expanded(
            child: _metricCard(
              'Complementação',
              _moneyCompact(totalComplementation),
              'VAAF + VAAT + VAAR',
              background: _softGreen,
              valueColor: _green,
            ),
          ),
          pw.SizedBox(width: 10),
          pw.Expanded(
            child: _metricCard(
              'Score comercial',
              relatorio.perfilComercial == null
                  ? '-'
                  : relatorio.perfilComercial!.score.toStringAsFixed(0),
              '${_safe(relatorio.perfilComercial?.faixa, fallback: '-')} | ${_safe(relatorio.perfilComercial?.habilitacaoVaat, fallback: 'VAAT n/i')}',
              background: _softOrange,
              valueColor: _orange,
            ),
          ),
        ],
      ),
      pw.SizedBox(height: 8),
      if (timeline.isNotEmpty) ...[
        _sectionHeading('1', 'Série recente'),
        pw.SizedBox(height: 8),
        _table(
          headers: const [
            'Ano',
            'Receita FUNDEB',
            'Complementação',
            'Base censo',
          ],
          rows: timeline
              .map(
                (item) => [
                  item.year.toString(),
                  _moneyNullable(item.totalReceitasFundeb),
                  _moneyNullable(item.unionComplementation),
                  item.schoolBaseLabel,
                ],
              )
              .toList(),
          widths: const {
            0: pw.FixedColumnWidth(42),
            1: pw.FlexColumnWidth(1.3),
            2: pw.FlexColumnWidth(),
            3: pw.FlexColumnWidth(),
          },
        ),
        pw.SizedBox(height: 8),
      ],
      // Benchmark regional removido do Lite
      _sectionHeading('2', 'Checklist de abordagem'),
      pw.SizedBox(height: 8),
      pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Expanded(
            child: _bulletBox('Pontos de atenção', [
              ...?report?.pendenciasHumanas.take(2),
              if (report == null) 'Validar contexto político antes da reunião.',
            ]),
          ),
          pw.SizedBox(width: 10),
          pw.Expanded(
            child: _bulletBox('Próximos passos', [
              ...?report?.proximosPassos.take(2),
              if (report == null)
                'Abrir relatório dirigido para fechamento fino.',
            ]),
          ),
        ],
      ),
      pw.SizedBox(height: 10),
      _mutedText(
        'Fontes usadas: ${bundle.fontes.map((item) => item.label).join(', ')}.',
      ),
    ];
  }

  static pw.PageTheme _contentTheme(
    RelatorioFundeb relatorio, {
    String? rochaLogoSvg,
    required pw.Font contentFont,
    DateTime? generatedAt,
  }) {
    final municipio = _municipioLabel(relatorio);
    return pw.PageTheme(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.fromLTRB(34, 88, 34, 54),
      theme: _pdfTheme(contentFont),
      buildBackground: (context) => pw.FullPage(
        ignoreMargins: true,
        child: pw.Stack(
          children: [
            pw.Positioned(
              left: 34,
              right: 34,
              top: 24,
              child: _header(municipio, rochaLogoSvg: rochaLogoSvg),
            ),
            pw.Positioned(
              left: 34,
              right: 34,
              bottom: 18,
              child: _documentFooterCentered(
                context.pageNumber,
                context.pagesCount,
                generatedAt: generatedAt ?? DateTime.now(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static pw.Page _buildCover(
    RelatorioFundeb relatorio, {
    RelatorioDirigidoMunicipio? report,
    String? rochaLogoSvg,
    required pw.Font contentFont,
    required DateTime generatedAt,
  }) {
    final municipio = _municipioLabel(relatorio).toUpperCase();
    final generatedAtLabel = DateFormat(
      'dd/MM/yyyy HH:mm',
      'pt_BR',
    ).format(generatedAt);
    final receitas = relatorio.receitas;
    final totalProjected = _projection(relatorio).totalProjetado;
    final comparison = report == null
        ? null
        : _historicalComparison(report, relatorio: relatorio);
    final seriesLabel =
        comparison?.seriesLabel ?? '${relatorio.identificacao.exercicio}';
    final thesis = report == null
        ? 'Documento executivo para decisão técnica, com leitura financeira, operacional e educacional do FUNDEB.'
        : _safe(
            report.resumoExecutivo.isNotEmpty
                ? report.resumoExecutivo
                : report.historico.resumo,
            fallback:
                'Documento executivo para decisão técnica, com leitura financeira, operacional e educacional do FUNDEB.',
          );
    final metricLeftLabel = 'Receita ${relatorio.identificacao.exercicio}';
    final metricLeftValue = _moneyCompact(receitas.totalReceitas);
    final metricLeftHelper =
        comparison?.previous != null &&
            comparison!.previous!.totalReceitasFundeb != null &&
            comparison.current.totalReceitasFundeb != null
        ? '${comparison.previous!.ano} x ${comparison.current.ano}  |  ${_deltaPercentLabel(comparison.previous!.totalReceitasFundeb, comparison.current.totalReceitasFundeb)}'
        : 'Leitura consolidada do ciclo atual';
    final metricRightLabel = comparison?.previous != null
        ? 'Estimativa ${relatorio.identificacao.exercicio + 1}'
        : 'Estimativa ${relatorio.identificacao.exercicio + 1}';
    final metricRightValue = _moneyCompact(totalProjected);
    final metricRightHelper =
        'valor estimado com ganho potencial dos servicos especializados';
    final responsavelTecnico = _paramText(relatorio, 'responsavelTecnico');
    final layoutVersion = responsavelTecnico.isEmpty
        ? _layoutVersion
        : 'TECNICO RESPONSAVEL:${responsavelTecnico.toUpperCase()}';
    final coverTitle = _paramText(
      relatorio,
      'tituloRelatorio',
      fallback: 'Diagnóstico e análise\ncorporativa do FUNDEB',
    );
    final coverSubtitle = _paramText(
      relatorio,
      'subtituloRelatorio',
      fallback:
          'Leitura executiva, financeira e comparativa com base oficial consolidada no PrimeOS.',
    );
    final rightBullets = <String>[
      'receita oficial do FUNDEB e composição das complementações federais',
      'base pública comparável por ano disponível no histórico consolidado',
      'alertas de evolução, retração ou estagnação na rede e na receita',
      'análise técnica para suporte à tomada de decisão',
    ];

    return pw.Page(
      pageTheme: pw.PageTheme(
        pageFormat: PdfPageFormat.a4,
        margin: pw.EdgeInsets.zero,
        theme: _pdfTheme(contentFont),
      ),
      build: (context) {
        final totalWidth = PdfPageFormat.a4.width;
        final totalHeight = PdfPageFormat.a4.height;
        final leftWidth = totalWidth * 0.62;
        final rightWidth = totalWidth - leftWidth;
        return pw.Container(
          width: totalWidth,
          height: totalHeight,
          child: pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.stretch,
            children: [
              pw.Container(
                width: leftWidth,
                color: const PdfColor.fromInt(0xFFF7FAFE),
                padding: const pw.EdgeInsets.fromLTRB(40, 44, 28, 28),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Row(
                          crossAxisAlignment: pw.CrossAxisAlignment.start,
                          children: [
                            if (rochaLogoSvg != null)
                              pw.Container(
                                width: 54,
                                height: 30,
                                alignment: pw.Alignment.centerLeft,
                                child: pw.SvgImage(
                                  svg: rochaLogoSvg,
                                  fit: pw.BoxFit.contain,
                                ),
                              )
                            else
                              pw.Container(
                                width: 42,
                                height: 30,
                                alignment: pw.Alignment.centerLeft,
                                child: pw.Text(
                                  'RP',
                                  style: pw.TextStyle(
                                    color: _navy,
                                    fontSize: 18,
                                    fontWeight: pw.FontWeight.bold,
                                  ),
                                ),
                              ),
                            pw.SizedBox(width: 12),
                            pw.Column(
                              crossAxisAlignment: pw.CrossAxisAlignment.start,
                              children: [
                                pw.Container(
                                  padding: const pw.EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 5,
                                  ),
                                  decoration: pw.BoxDecoration(
                                    color: _softOrange,
                                    borderRadius: pw.BorderRadius.circular(10),
                                  ),
                                  child: pw.Text(
                                    '$layoutVersion  |  EMITIDO $generatedAtLabel',
                                    style: pw.TextStyle(
                                      color: _orange,
                                      fontSize: 6.4,
                                      fontWeight: pw.FontWeight.bold,
                                    ),
                                  ),
                                ),
                                pw.SizedBox(height: 10),
                                pw.Text(
                                  'ANALISE CORPORATIVA FUNDEB',
                                  style: pw.TextStyle(
                                    color: _navy,
                                    fontSize: 8.5,
                                    fontWeight: pw.FontWeight.bold,
                                  ),
                                ),
                                pw.SizedBox(height: 3),
                                pw.Text(
                                  'Rocha Prime Servicos Especializados',
                                  style: const pw.TextStyle(
                                    color: _muted,
                                    fontSize: 7,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        pw.SizedBox(height: 34),
                        pw.Text(
                          coverTitle,
                          style: pw.TextStyle(
                            color: _navy,
                            fontSize: 25,
                            fontWeight: pw.FontWeight.bold,
                            lineSpacing: 2,
                          ),
                        ),
                        pw.SizedBox(height: 10),
                        pw.Text(
                          coverSubtitle,
                          style: const pw.TextStyle(
                            color: _text,
                            fontSize: 10,
                            lineSpacing: 2,
                          ),
                        ),
                        pw.SizedBox(height: 16),
                        pw.Container(
                          padding: const pw.EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: pw.BoxDecoration(
                            color: _orange,
                            borderRadius: pw.BorderRadius.circular(12),
                          ),
                          child: pw.Text(
                            'SERIE $seriesLabel',
                            style: pw.TextStyle(
                              color: _white,
                              fontSize: 7,
                              fontWeight: pw.FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(
                          municipio,
                          style: pw.TextStyle(
                            color: _navy,
                            fontSize: 17,
                            fontWeight: pw.FontWeight.bold,
                          ),
                        ),
                        pw.SizedBox(height: 4),
                        pw.Text(
                          'Relatório técnico Rocha Prime',
                          style: const pw.TextStyle(
                            color: _muted,
                            fontSize: 8.5,
                          ),
                        ),
                        pw.SizedBox(height: 16),
                        pw.Row(
                          children: [
                            pw.Expanded(
                              child: _coverMetricCard(
                                metricLeftLabel,
                                metricLeftValue,
                                metricLeftHelper,
                                accent: _blue,
                                background: _softBlue,
                              ),
                            ),
                            pw.SizedBox(width: 10),
                            pw.Expanded(
                              child: _coverMetricCard(
                                metricRightLabel,
                                metricRightValue,
                                metricRightHelper,
                                accent: _green,
                                background: _softGreen,
                              ),
                            ),
                          ],
                        ),
                        pw.SizedBox(height: 8),
                        pw.Container(height: 1, color: _line),
                        pw.SizedBox(height: 8),
                        pw.Text(
                          'Fontes: FNDE, INEP, IBGE e bases oficiais consolidadas no PrimeOS.',
                          style: const pw.TextStyle(
                            color: _muted,
                            fontSize: 6.8,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              pw.Container(
                width: rightWidth,
                color: _navy,
                padding: const pw.EdgeInsets.fromLTRB(26, 48, 26, 32),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(
                          'SERIE ${seriesLabel.toUpperCase()}',
                          style: pw.TextStyle(
                            color: _white,
                            fontSize: 8,
                            fontWeight: pw.FontWeight.bold,
                          ),
                        ),
                        pw.SizedBox(height: 8),
                        pw.Text(
                          'Uma leitura clara do que evoluiu, do que recuou e de onde esta a alavanca financeira.',
                          style: pw.TextStyle(
                            color: _white,
                            fontSize: 19,
                            fontWeight: pw.FontWeight.bold,
                            lineSpacing: 2,
                          ),
                        ),
                        pw.SizedBox(height: 8),
                        pw.Text(
                          thesis,
                          style: const pw.TextStyle(
                            color: PdfColor.fromInt(0xFFD8E2F2),
                            fontSize: 9.3,
                            lineSpacing: 2,
                          ),
                        ),
                      ],
                    ),
                    pw.Container(
                      padding: const pw.EdgeInsets.all(18),
                      decoration: pw.BoxDecoration(
                        color: const PdfColor.fromInt(0xFF2E3F6E),
                        borderRadius: pw.BorderRadius.circular(16),
                      ),
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text(
                            'POR QUE ESTA PECA EXISTE',
                            style: pw.TextStyle(
                              color: _white,
                              fontSize: 7.5,
                              fontWeight: pw.FontWeight.bold,
                            ),
                          ),
                          pw.SizedBox(height: 10),
                          ...rightBullets.map(
                            (item) => pw.Padding(
                              padding: const pw.EdgeInsets.only(bottom: 7),
                              child: pw.Row(
                                crossAxisAlignment: pw.CrossAxisAlignment.start,
                                children: [
                                  pw.Text(
                                    '- ',
                                    style: const pw.TextStyle(
                                      color: _white,
                                      fontSize: 9,
                                    ),
                                  ),
                                  pw.Expanded(
                                    child: pw.Text(
                                      item,
                                      style: const pw.TextStyle(
                                        color: PdfColor.fromInt(0xFFD8E2F2),
                                        fontSize: 8.2,
                                        lineSpacing: 2,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  static pw.Widget _coverMetricCard(
    String label,
    String value,
    String helper, {
    required PdfColor accent,
    required PdfColor background,
  }) {
    return pw.Container(
      height: 74,
      padding: const pw.EdgeInsets.all(12),
      decoration: pw.BoxDecoration(
        color: background,
        borderRadius: pw.BorderRadius.circular(12),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            label.toUpperCase(),
            style: pw.TextStyle(
              color: accent,
              fontSize: 7,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 10),
          pw.Text(
            value,
            style: pw.TextStyle(
              color: _navy,
              fontSize: 15,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 6),
          pw.Text(
            helper,
            style: const pw.TextStyle(color: _text, fontSize: 7.1),
          ),
        ],
      ),
    );
  }

  static List<pw.Widget> _buildExecutivePage(RelatorioFundeb relatorio) {
    final projection = _projection(relatorio);
    final receitas = relatorio.receitas;
    final gain = projection.totalGanho;
    final gainPct = projection.ganhoPercentual;
    final totalProjected = projection.totalProjetado;
    final prefeito = _safe(
      relatorio.identificacao.prefeito,
      fallback: 'Gestor Municipal',
    );
    final partido = _safe(relatorio.identificacao.partido, fallback: '-');
    final perfil = relatorio.perfilComercial;
    final upside = relatorio.upsideCondicionado;
    final gainRecuperavel = relatorio.projecaoRecuperavel.totalGanho;
    final gainRecuperavelPct = relatorio.projecaoRecuperavel.ganhoPercentual;
    final observacaoAnalise = _paramText(relatorio, 'observacaoAnalise');

    final bullets = <String>[
      'Gestor identificado na base atual: $prefeito ($partido).',
      'Base de leitura: dados oficiais, histórico disponível e conferência das regras do FUNDEB.',
    ];
    if (perfil != null &&
        _safe(perfil.habilitacaoVaat, fallback: '').isNotEmpty) {
      bullets.add('Habilitação VAAT observada: ${perfil.habilitacaoVaat}.');
    }
    if (upside != null && upside.vetores.isNotEmpty) {
      bullets.add('Vetores observados: ${upside.vetores.take(3).join(', ')}.');
    } else {
      bullets.add(
        'O foco permanece na consistência da base e na validação documental das informações oficiais.',
      );
    }

    final opening =
        'Ilmo(a). Sr(a). $prefeito, gestor(a) municipal de ${_municipioLabel(relatorio)}. '
        'Este relatório organiza a leitura do FUNDEB de ${relatorio.identificacao.exercicio} em linguagem direta: quanto o município recebeu, '
        'qual é a estimativa para o próximo ciclo e quais pontos precisam ser conferidos nas bases oficiais antes de qualquer decisão.'
        '${observacaoAnalise.isNotEmpty ? ' $observacaoAnalise' : ''}';

    final analysis =
        'Para ${relatorio.identificacao.exercicio}, a receita considerada é de ${_money(receitas.totalReceitas)}. '
        'A estimativa para ${relatorio.identificacao.exercicio + 1} é de ${_money(totalProjected)}, com diferença potencial de ${_money(gain)} (${_percent(gainPct)}). '
        '${gainRecuperavel > 0 && (gainRecuperavel - gain).abs() > 0.01 ? 'Como referência adicional, os ganhos já evidenciados nas bases atuais somam ${_money(gainRecuperavel)} (${_percent(gainRecuperavelPct)}). ' : ''}'
        '${perfil != null && _safe(perfil.pendenciaVaat, fallback: '').isNotEmpty ? 'Há sinal administrativo relevante em VAAT: ${perfil.pendenciaVaat}. ' : ''}';

    return [
      _pageTitle('Abertura Executiva'),
      pw.SizedBox(height: 8),
      _callout(opening, accent: _blue, background: _softBlue),
      pw.SizedBox(height: 8),
      pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Expanded(
            child: _metricCard(
              'RECEITA ${relatorio.identificacao.exercicio}',
              _money(receitas.totalReceitas),
              'valor usado como base do ano',
              background: const PdfColor.fromInt(0xFFF3F7FF),
            ),
          ),
          pw.SizedBox(width: 12),
          pw.Expanded(
            child: _metricCard(
              'ESTIMATIVA ${relatorio.identificacao.exercicio + 1}',
              _money(totalProjected),
              'estimativa para o próximo ciclo',
              background: const PdfColor.fromInt(0xFFF2FAF4),
              valueColor: _green,
              labelColor: _green,
            ),
          ),
        ],
      ),
      pw.SizedBox(height: 8),
      _highlightBox(
        'Ganho potencial anual estimado',
        _money(gain),
        '${_percent(gainPct)} sobre a base oficial atual do FUNDEB.',
      ),
      pw.SizedBox(height: 8),
      _callout(analysis, accent: _orange, background: _softOrange),
      pw.SizedBox(height: 8),
      _bulletBox('Leitura executiva', bullets),
    ];
  }

  static List<pw.Widget> _buildIdentificationAndReceitasPage(
    RelatorioFundeb relatorio,
  ) {
    final ident = relatorio.identificacao;
    final receitas = relatorio.receitas;
    final total = receitas.totalReceitas;
    final rows = [
      ['Município', _municipioLabel(relatorio)],
      ['Código IBGE', ident.codigoIBGE],
      ['Gestor Municipal', _safe(ident.prefeito)],
      ['Partido', _safe(ident.partido)],
      ['Exercício de Análise', '${ident.exercicio}'],
      ['Base Legal', 'Lei no 14.113/2020 (Novo FUNDEB)'],
      ['Fonte de Dados', _safe(ident.fonte, fallback: 'FNDE / INEP / IBGE')],
      ['Mesorregiao', _safe(ident.mesorregiao)],
      ['Microrregiao', _safe(ident.microrregiao)],
      ['Metodologia', 'Análise comparativa baseada em dados oficiais'],
    ];
    _appendParamRow(
      rows,
      relatorio,
      'secretarioEducacao',
      'Secretário(a) de Educação',
    );
    _appendParamRow(rows, relatorio, 'orgaoDemandante', 'Órgão demandante');
    _appendParamRow(
      rows,
      relatorio,
      'responsavelTecnico',
      'Responsável técnico',
    );
    _appendParamRow(
      rows,
      relatorio,
      'numeroProcesso',
      'Processo administrativo',
    );
    _appendParamRow(
      rows,
      relatorio,
      'periodoReferencia',
      'Período de referência',
    );
    _appendParamRow(rows, relatorio, 'cenarioAnalise', 'Cenário de análise');
    _appendAdditionalParamRows(rows, relatorio);
    final receitasRows = [
      [
        'Contribuição do Município',
        _money(receitas.receitaContribuicaoMunicipal),
        _part(receitas.receitaContribuicaoMunicipal, total),
      ],
      [
        'Complementação da União - VAAF',
        _money(receitas.complementacaoVAAF),
        _part(receitas.complementacaoVAAF, total),
      ],
      [
        'Complementação da União - VAAT',
        _money(receitas.complementacaoVAAT),
        _part(receitas.complementacaoVAAT, total),
      ],
      [
        'Complementação da União - VAAR',
        _money(receitas.complementacaoVAAR),
        _part(receitas.complementacaoVAAR, total),
      ],
      ['TOTAL DE RECEITAS', _money(total), '100,0%'],
    ];
    final analysis =
        'A estrutura de receitas do FUNDEB para o exercício de ${ident.exercicio} apresenta predominância de receita de contribuição '
        'municipal, representando ${_part(receitas.receitaContribuicaoMunicipal, total)} do montante total. '
        '${receitas.complementacaoVAAR == 0 ? 'O município não está recebendo atualmente VAAR (vinculado a resultados). ' : ''}'
        'A ausência destas complementações pode estar relacionada às condições de habilitação junto ao FNDE ou à estrutura do fundo estadual. '
        'Recomenda-se análise detalhada dos requisitos de acesso.';

    return [
      _sectionHeading('1', 'Identificação do Ente Federativo'),
      pw.SizedBox(height: 10),
      _table(
        headers: const ['Campo', 'Valor'],
        rows: rows,
        widths: const {0: pw.FlexColumnWidth(38), 1: pw.FlexColumnWidth(62)},
      ),
      pw.SizedBox(height: 22),
      _sectionHeading('2', 'Composição das Receitas do FUNDEB'),
      pw.SizedBox(height: 6),
      _mutedText(
        'Valores estimados conforme Portaria FNDE vigente e dados consolidados do exercício.',
      ),
      pw.SizedBox(height: 8),
      _table(
        headers: const [
          'Componente da Receita',
          'Valor Estimado (R\$)',
          'Participação',
        ],
        rows: receitasRows,
        widths: const {
          0: pw.FlexColumnWidth(50),
          1: pw.FlexColumnWidth(32),
          2: pw.FlexColumnWidth(18),
        },
      ),
      pw.SizedBox(height: 16),
      _callout(analysis, accent: _blue, background: _softBlue),
    ];
  }

  static List<pw.Widget> _buildProjectionPage(RelatorioFundeb relatorio) {
    final proj = _projection(relatorio);
    final recuperavel = relatorio.projecaoRecuperavel;
    final gain = proj.totalGanho;
    final gainPct = proj.ganhoPercentual;
    final totalProjected = proj.totalProjetado;
    final gainRecuperavel = recuperavel.totalGanho;
    final gainRecuperavelPct = recuperavel.ganhoPercentual;
    final metodologiaComplementar = _paramText(
      relatorio,
      'metodologiaComplementar',
    );
    final methodologyText =
        'A estimativa abaixo mostra uma leitura possível para o próximo ciclo, usando a receita atual, o histórico disponível e os pontos de conferência do FUNDEB. '
        'Ela não substitui a validação nas bases oficiais: serve para mostrar onde pode haver diferença de receita e o que precisa ser revisado. '
        'Referência usada: ${_safe(proj.metodologia, fallback: 'dados oficiais e histórico disponível')}.'
        '${metodologiaComplementar.isNotEmpty ? ' Metodologia complementar: $metodologiaComplementar.' : ''}'
        '${gainRecuperavel > 0 && (gainRecuperavel - gain).abs() > 0.01 ? ' Os valores já sinalizados nas bases atuais somam ${_money(gainRecuperavel)}.' : ''}';

    return [
      _sectionHeading('3', 'Estimativa para o próximo ciclo'),
      pw.SizedBox(height: 10),
      pw.Row(
        children: [
          pw.Expanded(
            child: _smallMetricCard(
              'VAAF',
              _money(proj.vaafProjetado),
              '+${_percent(gainPct)}',
            ),
          ),
          pw.SizedBox(width: 4),
          pw.Expanded(
            child: _smallMetricCard(
              'VAAT',
              _money(proj.vaatProjetado),
              '+${_percent(gainPct)}',
            ),
          ),
          pw.SizedBox(width: 4),
          pw.Expanded(
            child: _smallMetricCard(
              'VAAR',
              _money(proj.vaarProjetado),
              proj.vaarProjetado == 0 ? '-' : '+${_percent(gainPct)}',
            ),
          ),
          pw.SizedBox(width: 4),
          pw.Expanded(
            child: _smallMetricCard(
              'GANHO',
              _money(gain),
              '+${_percent(gainPct)}',
            ),
          ),
        ],
      ),
      pw.SizedBox(height: 10),
      _table(
        headers: const [
          'Componente',
          'Cenário Atual',
          'Cenário Projetado',
          'Variação',
        ],
        rows: [
          [
            'VAAF (Valor Aluno Fundo)',
            _money(proj.vaafAtual),
            _money(proj.vaafProjetado),
            _money(proj.vaafGanho),
          ],
          [
            'VAAT (Valor Aluno Total)',
            _money(proj.vaatAtual),
            _money(proj.vaatProjetado),
            _money(proj.vaatGanho),
          ],
          [
            'VAAR (Vinculado a Resultados)',
            _money(proj.vaarAtual),
            _money(proj.vaarProjetado),
            _money(proj.vaarGanho),
          ],
          [
            'TOTAL',
            _money(proj.totalAtual),
            _money(totalProjected),
            _money(gain),
          ],
        ],
        widths: const {
          0: pw.FlexColumnWidth(37),
          1: pw.FlexColumnWidth(21),
          2: pw.FlexColumnWidth(21),
          3: pw.FlexColumnWidth(21),
        },
      ),
      pw.SizedBox(height: 16),
      _callout(methodologyText, accent: _blue, background: _softBlue),
      pw.SizedBox(height: 16),
      _highlightBox(
        'RECEITA TOTAL PROJETADA (CENARIO OTIMIZADO)',
        _money(totalProjected),
        'Potencial de incremento: ${_money(gain)} (+${_percent(gainPct)})',
      ),
      if (gainRecuperavel > 0 && (gainRecuperavel - gain).abs() > 0.01) ...[
        pw.SizedBox(height: 10),
        _callout(
          'Camada recuperavel evidenciada nas bases oficiais: ${_money(gainRecuperavel)} (+${_percent(gainRecuperavelPct)} sobre a base atual). '
          'Os valores projetados têm caráter estimativo e dependem de validação documental nas bases oficiais do FUNDEB e dos sistemas MEC/FNDE.',
          accent: _orange,
          background: _softOrange,
        ),
      ],
    ];
  }

  static List<pw.Widget> _buildTechnicalAnnexPage(
    RelatorioFundeb relatorio, {
    RelatorioDirigidoMunicipio? report,
  }) {
    final ident = relatorio.identificacao;
    final perfil = relatorio.perfilComercial;
    final proj = _projection(relatorio);
    final bullets = <String>[];
    if (perfil?.matriculasMunicipaisPorHabitante != null) {
      bullets.add(
        'A rede municipal concentra ${_percent(perfil!.matriculasMunicipaisPorHabitante!)} de matrículas por habitante, indicador que reforça a relevância do município no contexto regional.',
      );
    }
    if (perfil?.educacaoInfantilMunicipalPorHabitante != null) {
      bullets.add(
        'A cobertura municipal de educação infantil alcança ${_percent(perfil!.educacaoInfantilMunicipalPorHabitante!)} por habitante, reforçando o potencial de leitura favorável em VAAT e IEI.',
      );
    }
    if (perfil?.crecheMunicipalPorHabitante != null) {
      bullets.add(
        'A presença de creche municipal em ${_percent(perfil!.crecheMunicipalPorHabitante!)} por habitante reforça a leitura técnica para políticas de primeira infância.',
      );
    }
    if (perfil?.fundebPerCapita != null) {
      bullets.add(
        'O FUNDEB per capita estimado em ${_money(perfil!.fundebPerCapita!)} sugere intensidade financeira relevante para o porte da rede local.',
      );
    }
    if (perfil != null &&
        _safe(perfil.habilitacaoVaat, fallback: '').isNotEmpty) {
      bullets.add(
        'Habilitação VAAT atual: ${_simplifyVaatStatus(perfil.habilitacaoVaat)}.',
      );
    }
    if (bullets.isEmpty) {
      bullets.add(
        'Os indicadores disponiveis exigem leitura complementar para detalhar fatores regionais e comportamento historico da base.',
      );
    }

    return [
      _pageTitle('PARTE I - RECEITA E PROJEÇÃO'),
      pw.SizedBox(height: 10),
      _sectionHeading('5', 'Indicadores de Eficiência Arrecadatória'),
      pw.SizedBox(height: 10),
      _table(
        headers: const ['Indicador Tecnico', 'Valor'],
        rows: [
          [
            'Índice de Eficiência Arrecadatória',
            perfil == null ? '-' : _number(perfil.score),
          ],
          [
            'Fator de ajuste regional aplicado',
            proj.multiplicadorAplicado == null
                ? '-'
                : _number(proj.multiplicadorAplicado!, digits: 2),
          ],
          [
            'FUNDEB per capita',
            perfil?.fundebPerCapita == null
                ? '-'
                : _money(perfil!.fundebPerCapita!),
          ],
          [
            'Matrículas municipais por habitante',
            perfil?.matriculasMunicipaisPorHabitante == null
                ? '-'
                : _percent(perfil!.matriculasMunicipaisPorHabitante!),
          ],
          [
            'Educação infantil municipal por habitante',
            perfil?.educacaoInfantilMunicipalPorHabitante == null
                ? '-'
                : _percent(perfil!.educacaoInfantilMunicipalPorHabitante!),
          ],
          [
            'Creche municipal por habitante',
            perfil?.crecheMunicipalPorHabitante == null
                ? '-'
                : _percent(perfil!.crecheMunicipalPorHabitante!),
          ],
          [
            'Habilitação VAAT',
            perfil == null ? '-' : _simplifyVaatStatus(perfil.habilitacaoVaat),
          ],
          [
            'UF / fundo estadual',
            '${_safe(ident.uf)} / ${_safe(ident.regiao, fallback: '-')}',
          ],
          [
            'Ajuste estadual aplicado',
            proj.multiplicadorAplicado == null
                ? '-'
                : _number(proj.multiplicadorAplicado!, digits: 2),
          ],
        ],
        widths: const {0: pw.FlexColumnWidth(60), 1: pw.FlexColumnWidth(40)},
      ),
      pw.SizedBox(height: 8),
      _sectionHeading('5.1', 'Fundamentação dos Indicadores'),
      pw.SizedBox(height: 8),
      _bulletBox('Análise Técnica', bullets),
      if (report != null) ..._buildPerfilIBGEGrid(report),
    ];
  }

  static List<pw.Widget> _buildSourcesPage(LevantamentoFundebBundle bundle) {
    final relatorio = bundle.relatorio;
    final rows = bundle.fontes
        .map(
          (fonte) => <String>[
            fonte.label,
            fonte.status.toUpperCase(),
            _crop(fonte.descricao, 140),
          ],
        )
        .toList();

    final bullets = <String>[
      'As fontes abaixo mostram o que entrou automaticamente, o que depende de estimativa e o que ainda exige confirmação manual.',
      'Esta camada de rastreabilidade ajuda a explicar a confiança operacional do relatório antes da emissão final.',
    ];
    if (relatorio.observacoesOperacionais.isNotEmpty) {
      bullets.add(
        'A versão atual registra ${relatorio.observacoesOperacionais.length} observações operacionais relevantes para leitura técnica.',
      );
    }

    return [
      _pageTitle('ANEXO - RASTREABILIDADE E FONTES'),
      pw.SizedBox(height: 8),
      _sectionHeading('A.1', 'Mapa de fontes'),
      pw.SizedBox(height: 10),
      _table(
        headers: const ['Fonte', 'Status', 'Leitura operacional'],
        rows: rows,
        widths: const {
          0: pw.FlexColumnWidth(22),
          1: pw.FlexColumnWidth(16),
          2: pw.FlexColumnWidth(62),
        },
      ),
      pw.SizedBox(height: 16),
      _bulletBox('Como ler a rastreabilidade', bullets),
    ];
  }

  static List<pw.Widget> _buildCronogramaPage(RelatorioFundeb relatorio) {
    final proj = _projection(relatorio);
    return [
      _sectionHeading('4', 'Cronograma Mensal Projetado'),
      pw.SizedBox(height: 8),
      _table(
        headers: const ['Mês', 'Valor Projetado (R\$)', 'Participação (%)'],
        rows: relatorio.cronogramaVAAF
            .map(
              (item) => [
                item.mes,
                _money(item.valorProjetado),
                _percent(item.percentual),
              ],
            )
            .toList(),
        widths: const {
          0: pw.FlexColumnWidth(20),
          1: pw.FlexColumnWidth(50),
          2: pw.FlexColumnWidth(30),
        },
      ),
      pw.SizedBox(height: 16),
      _highlightBox(
        'POTENCIAL DE INCREMENTO ANUAL (TOTAL)',
        _money(proj.totalGanho),
        '+${_percent(proj.ganhoPercentual)} sobre o cenário atual',
      ),
    ];
  }

  static List<pw.Widget> _buildOperationalPage(RelatorioFundeb relatorio) {
    final systemsRows = relatorio.sistemas
        .map(
          (item) => [item.instituicao, item.sistema, _crop(item.situacao, 120)],
        )
        .toList();
    final pddeRows = relatorio.pdde
        .map((item) => ['${item.ano}', _money(item.valor)])
        .toList();

    return [
      _pageTitle('PARTE II - SITUAÇÃO OPERACIONAL MEC/FNDE'),
      pw.SizedBox(height: 8),
      _sectionHeading('6', 'Sistemas, Obras e Programas Federais'),
      pw.SizedBox(height: 10),
      if (systemsRows.isNotEmpty)
        _table(
          headers: const ['Instituição', 'Sistema', 'Situação Cadastral'],
          rows: systemsRows,
          widths: const {
            0: pw.FlexColumnWidth(12),
            1: pw.FlexColumnWidth(16),
            2: pw.FlexColumnWidth(72),
          },
        )
      else
        _callout(
          'Nenhum sistema operacional foi consolidado nesta versao.',
          accent: _orange,
          background: _softOrange,
        ),
      if (pddeRows.isNotEmpty) ...[
        pw.SizedBox(height: 8),
        _sectionHeading('7', 'Histórico de Repasses PDDE'),
        pw.SizedBox(height: 10),
        _table(
          headers: const ['Ano', 'Valor Repassado'],
          rows: pddeRows,
          widths: const {0: pw.FlexColumnWidth(20), 1: pw.FlexColumnWidth(80)},
        ),
        pw.SizedBox(height: 8),
        _callout(
          'O histórico de repasses do PDDE reforça a leitura operacional do ente e oferece evidência concreta da movimentação recente de recursos federais na rede pública local.',
          accent: _orange,
          background: _softOrange,
        ),
      ],
      ..._buildObrasPAC2Section(relatorio),
      ..._buildCaminhoEscolaSection(relatorio),
    ];
  }

  static List<pw.Widget> _buildObservacoesPage(RelatorioFundeb relatorio) {
    return [
      _sectionHeading('8', 'Observações Operacionais'),
      pw.SizedBox(height: 10),
      ...relatorio.observacoesOperacionais.map(
        (obs) => pw.Padding(
          padding: const pw.EdgeInsets.only(bottom: 10),
          child: _callout(
            obs,
            title: 'Observação Operacional',
            accent: _orange,
            background: _softOrange,
          ),
        ),
      ),
    ];
  }

  static List<pw.Widget> _buildEducationalBasePage(
    RelatorioFundeb relatorio, {
    RelatorioDirigidoMunicipio? report,
  }) {
    final censo = relatorio.censoEscolar;
    if (censo == null) {
      return [
        _pageTitle('PARTE III - INDICADORES EDUCACIONAIS'),
        pw.SizedBox(height: 8),
        _callout(
          'Os dados de Censo Escolar ainda não foram consolidados para esta versão.',
          accent: _orange,
          background: _softOrange,
        ),
      ];
    }

    final etapas = censo.matriculasEtapa;
    final detalhadas = censo.matriculasDetalhadas;
    return [
      _pageTitle('PARTE III - INDICADORES EDUCACIONAIS'),
      pw.SizedBox(height: 10),
      _sectionHeading('9', 'Censo Escolar e IDEB'),
      pw.SizedBox(height: 8),
      pw.Row(
        children: [
          pw.Expanded(
            child: _metricCard(
              'UNIDADES ESCOLARES',
              _integer(censo.totalEscolas),
              null,
              background: _softBlue,
            ),
          ),
          pw.SizedBox(width: 10),
          pw.Expanded(
            child: _metricCard(
              'MATRÍCULAS MUNICIPAIS',
              _integer(censo.totalMatriculas),
              null,
              background: _softBlue,
            ),
          ),
          pw.SizedBox(width: 10),
          pw.Expanded(
            child: _metricCard(
              'DOCENTES',
              _integer(censo.totalDocentes),
              null,
              background: _softBlue,
            ),
          ),
          if (report?.recursosPorAluno != null &&
              report!.recursosPorAluno!.valor > 0) ...[
            pw.SizedBox(width: 10),
            pw.Expanded(
              child: _metricCard(
                'RECURSO POR ALUNO MUNICIPAL (R\$)',
                _integerFromDouble(report.recursosPorAluno!.valor),
                null,
                background: _softGreen,
                valueColor: _green,
              ),
            ),
          ],
        ],
      ),
      pw.SizedBox(height: 8),
      _sectionHeading('9.1', 'Distribuição de Matrículas por Etapa'),
      pw.SizedBox(height: 10),
      _table(
        headers: const ['Etapa de Ensino', 'Municipal', 'Rede Pública'],
        rows: [
          ['Educação Infantil', _integer(etapas.educacaoInfantil), '—'],
          ['Ensino Fundamental', _integer(etapas.ensinoFundamental), '—'],
          [
            'Ensino Médio',
            _integer(etapas.ensinoMedio),
            etapas.ensinoMedioPublica != null && etapas.ensinoMedioPublica! > 0
                ? _integer(etapas.ensinoMedioPublica!)
                : '—',
          ],
          ['EJA', _integer(etapas.eja), '—'],
          ['Educação Especial', _integer(etapas.educacaoEspecial), '—'],
        ],
        widths: const {
          0: pw.FlexColumnWidth(46),
          1: pw.FlexColumnWidth(27),
          2: pw.FlexColumnWidth(27),
        },
      ),
      if (censo.recorte == 'municipal' && etapas.ensinoMedio == 0) ...[
        pw.SizedBox(height: 10),
        if (etapas.ensinoMedioPublica != null && etapas.ensinoMedioPublica! > 0)
          _callout(
            'A rede pública de ${_municipioLabel(relatorio)} conta com ${_integer(etapas.ensinoMedioPublica!)} matrículas no Ensino Médio (rede estadual/federal). '
            'Essas matrículas não são consideradas no cálculo do FUNDEB municipal.',
            accent: _blue,
            background: _softBlue,
          )
        else
          _callout(
            'A rede municipal não opera o Ensino Médio. Esta etapa é de responsabilidade da rede estadual.',
            accent: _blue,
            background: _softBlue,
          ),
      ],
      pw.SizedBox(height: 8),
      _sectionHeading('9.2', 'Detalhamento da Rede Pública'),
      pw.SizedBox(height: 10),
      _table(
        headers: const ['Recorte detalhado', 'Municipal', 'Rede Pública'],
        rows: [
          ['Creche', _integer(detalhadas.creche), '—'],
          ['Pré-escola', _integer(detalhadas.preEscola), '—'],
          [
            'Anos iniciais do Fundamental',
            _integer(detalhadas.anosIniciais),
            '—',
          ],
          [
            'Anos finais do Fundamental',
            _integer(detalhadas.anosFinais),
            detalhadas.anosFinaisPublica != null &&
                    detalhadas.anosFinaisPublica! > 0
                ? _integer(detalhadas.anosFinaisPublica!)
                : '—',
          ],
          [
            'Ensino Médio',
            _integer(etapas.ensinoMedio),
            etapas.ensinoMedioPublica != null && etapas.ensinoMedioPublica! > 0
                ? _integer(etapas.ensinoMedioPublica!)
                : '—',
          ],
          ['EJA', _integer(etapas.eja), '—'],
          ['Educação Especial', _integer(etapas.educacaoEspecial), '—'],
        ],
        widths: const {
          0: pw.FlexColumnWidth(46),
          1: pw.FlexColumnWidth(27),
          2: pw.FlexColumnWidth(27),
        },
      ),
      if (detalhadas.anosFinais == 0 &&
          detalhadas.anosFinaisPublica != null &&
          detalhadas.anosFinaisPublica! > 0) ...[
        pw.SizedBox(height: 8),
        _callout(
          'Os anos finais do Ensino Fundamental (${_integer(detalhadas.anosFinaisPublica!)} matrículas) '
          'são operados pela rede estadual/federal neste município.',
          accent: _blue,
          background: _softBlue,
        ),
      ],
      // Valor Aluno Oficial VAAF (MEC/FNDE)
      if (report?.valorAlunoOficial != null) ...[
        pw.SizedBox(height: 8),
        _sectionHeading(
          '9.3',
          'Valor Aluno/Ano Oficial VAAF — ${report!.valorAlunoOficial!.uf}',
        ),
        pw.SizedBox(height: 6),
        _mutedText(
          'Portaria Interministerial MEC/MF nº 14, de 29/12/2025 (Anexo I) — Exercício 2026',
        ),
        pw.SizedBox(height: 10),
        _table(
          headers: const ['Etapa de Ensino', 'Valor/Aluno Ano (R\$)'],
          rows: [
            [
              'Creche Integral (pública)',
              _money(report.valorAlunoOficial!.crecheIntegralPublica),
            ],
            [
              'Creche Parcial (pública)',
              _money(report.valorAlunoOficial!.crecheParcialPublica),
            ],
            [
              'Pré-Escola Integral (pública)',
              _money(report.valorAlunoOficial!.preEscolaIntegralPublica),
            ],
            [
              'Pré-Escola Parcial (pública)',
              _money(report.valorAlunoOficial!.preEscolaParcialPublica),
            ],
            [
              'Fundamental Integral',
              _money(report.valorAlunoOficial!.fundamentalIntegral),
            ],
            [
              'Fundamental Anos Iniciais (parcial)',
              _money(report.valorAlunoOficial!.fundamentalAnosIniciais),
            ],
            [
              'Fundamental Anos Finais (parcial)',
              _money(report.valorAlunoOficial!.fundamentalAnosFinais),
            ],
            ['EJA', _money(report.valorAlunoOficial!.eja)],
          ],
          widths: const {0: pw.FlexColumnWidth(60), 1: pw.FlexColumnWidth(40)},
        ),
        // Comparison: actual vs official
        if (report.recursosPorAluno != null) ...[
          pw.SizedBox(height: 8),
          pw.Row(
            children: [
              pw.Expanded(
                child: _metricCard(
                  'RECURSO REAL POR ALUNO',
                  _money(report.recursosPorAluno!.valor),
                  'Receita FUNDEB ÷ Matrículas',
                  background: _softBlue,
                ),
              ),
              pw.SizedBox(width: 8),
              pw.Expanded(
                child: _metricCard(
                  'VAAF OFICIAL (Fund. AI)',
                  _money(report.valorAlunoOficial!.fundamentalAnosIniciais),
                  'Referência MEC para ${report.valorAlunoOficial!.uf}',
                  background: _softGreen,
                  valueColor: _green,
                ),
              ),
              pw.SizedBox(width: 8),
              pw.Expanded(
                child: (() {
                  final diff =
                      report.recursosPorAluno!.valor -
                      report.valorAlunoOficial!.fundamentalAnosIniciais;
                  final pct =
                      (diff /
                      report.valorAlunoOficial!.fundamentalAnosIniciais *
                      100);
                  final label = diff >= 0
                      ? '+${pct.toStringAsFixed(1)}% acima'
                      : '${pct.toStringAsFixed(1)}% abaixo';
                  return _metricCard(
                    'DIFERENÇA',
                    _money(diff.abs()),
                    label,
                    background: diff >= 0 ? _softGreen : _softOrange,
                    valueColor: diff >= 0 ? _green : _orange,
                  );
                })(),
              ),
            ],
          ),
        ],
      ],
    ];
  }

  static List<pw.Widget> _buildTempoIntegralPage(RelatorioFundeb relatorio) {
    final censo = relatorio.censoEscolar;
    final tempo = censo?.tempoIntegral;
    return [
      _pageTitle('PARTE III - INDICADORES EDUCACIONAIS (cont.)'),
      pw.SizedBox(height: 10),
      _sectionHeading('10', 'Cobertura em Tempo Integral'),
      pw.SizedBox(height: 10),
      _table(
        headers: const ['Etapa', 'Integral', 'Base de matrículas', 'Cobertura'],
        rows: _tempoIntegralRows(relatorio),
        widths: const {
          0: pw.FlexColumnWidth(40),
          1: pw.FlexColumnWidth(18),
          2: pw.FlexColumnWidth(24),
          3: pw.FlexColumnWidth(18),
        },
      ),
      pw.SizedBox(height: 10),
      _callout(
        'A rede pública de ${_municipioLabel(relatorio)} registra ${_integerNullable(tempo?.total)} matrículas em tempo integral '
        'sobre uma base de ${_integerNullable(censo?.totalMatriculas)} matrículas públicas no Censo Escolar. '
        'Isto representa cobertura aproximada de ${_safeRatio(tempo?.total, censo?.totalMatriculas)} e ajuda a qualificar a leitura da oferta de jornada ampliada por etapa.',
        accent: _blue,
        background: _softBlue,
      ),
    ];
  }

  static List<pw.Widget> _buildIdebPage(RelatorioFundeb relatorio) {
    // Find latest year with data for each etapa
    IDEBDado? latestIniciais;
    IDEBDado? latestFinais;
    for (final item in relatorio.idebAnosIniciais.reversed) {
      if (item.idebVerificado != null) {
        latestIniciais = item;
        break;
      }
    }
    for (final item in relatorio.idebAnosFinais.reversed) {
      if (item.idebVerificado != null) {
        latestFinais = item;
        break;
      }
    }

    // Filter rows that have at least meta or verificado
    List<List<String>> buildEtapaRows(List<IDEBDado> items) {
      final filtered = items.where(
        (i) => i.metaProjetada != null || i.idebVerificado != null,
      );
      return filtered
          .map(
            (item) => [
              '${item.ano}',
              _nullableNumber(item.metaProjetada),
              _nullableNumber(item.idebVerificado),
              _idebStatusLabel(item),
            ],
          )
          .toList();
    }

    final rowsIniciais = buildEtapaRows(relatorio.idebAnosIniciais);
    final rowsFinais = buildEtapaRows(relatorio.idebAnosFinais);
    final rowsEM = buildEtapaRows(relatorio.idebEnsinoMedio);
    final hasAnyData =
        rowsIniciais.isNotEmpty || rowsFinais.isNotEmpty || rowsEM.isNotEmpty;
    final hasOnlyLatest =
        hasAnyData &&
        relatorio.idebAnosIniciais
                .where((i) => i.idebVerificado != null)
                .length <=
            1 &&
        relatorio.idebAnosFinais
                .where((i) => i.idebVerificado != null)
                .length <=
            1;

    return [
      _pageTitle('PARTE III - INDICADORES EDUCACIONAIS (cont.)'),
      pw.SizedBox(height: 10),
      _sectionHeading('11', 'Série Histórica do IDEB'),
      pw.SizedBox(height: 10),

      // KPI cards for latest IDEB
      if (latestIniciais != null || latestFinais != null)
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            if (latestIniciais != null)
              pw.Expanded(child: _idebKpiCard('Anos Iniciais', latestIniciais)),
            if (latestIniciais != null && latestFinais != null)
              pw.SizedBox(width: 12),
            if (latestFinais != null)
              pw.Expanded(child: _idebKpiCard('Anos Finais', latestFinais)),
          ],
        ),
      if (latestIniciais != null || latestFinais != null)
        pw.SizedBox(height: 10),

      // Context callout if only latest year available
      if (hasOnlyLatest)
        _callout(
          'O IDEB verificado disponível refere-se à edição mais recente (${latestIniciais?.ano ?? latestFinais?.ano}). '
          'A série histórica completa com os valores observados de todas as edições anteriores será integrada '
          'após consulta à base completa do INEP/SAEB.',
          accent: _orange,
          background: _softOrange,
        ),
      if (hasOnlyLatest) pw.SizedBox(height: 8),

      // Tables
      if (rowsIniciais.isNotEmpty) ...[
        _sectionHeading('11.1', 'Anos Iniciais do Ensino Fundamental'),
        pw.SizedBox(height: 8),
        _table(
          headers: const [
            'Ano',
            'Meta Projetada',
            'IDEB Verificado',
            'Situação',
          ],
          rows: rowsIniciais,
          widths: const {
            0: pw.FlexColumnWidth(15),
            1: pw.FlexColumnWidth(25),
            2: pw.FlexColumnWidth(25),
            3: pw.FlexColumnWidth(35),
          },
        ),
        pw.SizedBox(height: 10),
      ],
      if (rowsFinais.isNotEmpty) ...[
        _sectionHeading('11.2', 'Anos Finais do Ensino Fundamental'),
        pw.SizedBox(height: 8),
        _table(
          headers: const [
            'Ano',
            'Meta Projetada',
            'IDEB Verificado',
            'Situação',
          ],
          rows: rowsFinais,
          widths: const {
            0: pw.FlexColumnWidth(15),
            1: pw.FlexColumnWidth(25),
            2: pw.FlexColumnWidth(25),
            3: pw.FlexColumnWidth(35),
          },
        ),
      ],
      // Ensino Médio (informational — state/federal network)
      if (rowsEM.isNotEmpty) ...[
        pw.SizedBox(height: 10),
        _sectionHeading('11.3', 'Ensino Médio (Rede Estadual/Federal)'),
        pw.SizedBox(height: 4),
        _callout(
          'Dados informativos da rede estadual/federal. O Ensino Médio não compõe o cálculo do FUNDEB municipal.',
          accent: PdfColor.fromInt(0xFF3B82F6),
          background: PdfColor.fromInt(0xFFEFF6FF),
        ),
        pw.SizedBox(height: 8),
        _table(
          headers: const [
            'Ano',
            'Meta Projetada',
            'IDEB Verificado',
            'Situação',
          ],
          rows: rowsEM,
          widths: const {
            0: pw.FlexColumnWidth(15),
            1: pw.FlexColumnWidth(25),
            2: pw.FlexColumnWidth(25),
            3: pw.FlexColumnWidth(35),
          },
        ),
      ],
      if (!hasAnyData)
        _callout(
          'Os dados de IDEB para este município serão integrados na próxima versão deste relatório após consulta ao portal do SIMEC. '
          'A série histórica do município pode ser verificada diretamente no portal.',
          title: 'IDEB',
          accent: _orange,
          background: _softOrange,
        ),
    ];
  }

  /// KPI card for latest IDEB value
  static pw.Widget _idebKpiCard(String etapaLabel, IDEBDado item) {
    final verificado = item.idebVerificado;
    final meta = item.metaProjetada;
    final abaixo = verificado != null && meta != null && verificado < meta;
    final acima = verificado != null && meta != null && verificado >= meta;

    return pw.Container(
      padding: const pw.EdgeInsets.all(12),
      decoration: pw.BoxDecoration(
        color: abaixo ? _softOrange : _softGreen,
        borderRadius: pw.BorderRadius.circular(6),
        border: pw.Border.all(color: abaixo ? _orange : _green, width: 0.5),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.center,
        children: [
          pw.Text(
            etapaLabel.toUpperCase(),
            style: pw.TextStyle(
              fontSize: 8,
              fontWeight: pw.FontWeight.bold,
              color: _grey700,
            ),
          ),
          pw.SizedBox(height: 4),
          pw.Text(
            verificado != null
                ? verificado.toStringAsFixed(1).replaceAll('.', ',')
                : '—',
            style: pw.TextStyle(
              fontSize: 22,
              fontWeight: pw.FontWeight.bold,
              color: abaixo ? _orange : _green,
            ),
          ),
          pw.SizedBox(height: 2),
          pw.Text(
            'IDEB ${item.ano}',
            style: pw.TextStyle(fontSize: 7, color: _grey600),
          ),
          if (meta != null) ...[
            pw.SizedBox(height: 4),
            pw.Text(
              acima
                  ? '+${(verificado! - meta).toStringAsFixed(1).replaceAll('.', ',')} acima da meta'
                  : abaixo
                  ? '${(verificado! - meta).toStringAsFixed(1).replaceAll('.', ',')} abaixo da meta'
                  : 'Meta: ${meta.toStringAsFixed(1).replaceAll('.', ',')}',
              style: pw.TextStyle(
                fontSize: 7,
                fontWeight: pw.FontWeight.bold,
                color: abaixo ? _orange : _green,
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// Status label for IDEB row
  static String _idebStatusLabel(IDEBDado item) {
    if (item.idebVerificado == null) return '—';
    if (item.metaProjetada == null) return 'Sem meta definida';
    if (item.idebVerificado! >= item.metaProjetada!) return '✓ Meta atingida';
    return '✗ Abaixo da meta';
  }

  static List<pw.Widget> _buildIndicadoresAprendizagemPage(
    RelatorioDirigidoMunicipio report,
  ) {
    final ind = report.indicadoresAprendizagem;
    if (ind == null || !ind.disponivel) {
      return [
        _pageTitle('PARTE III - INDICADORES EDUCACIONAIS (cont.)'),
        pw.SizedBox(height: 8),
        _callout(
          'Os indicadores de aprendizagem ainda não estão disponíveis para este município.',
          accent: _orange,
          background: _softOrange,
        ),
      ];
    }

    final anoLabel = ind.anoReferencia != null
        ? ' (SAEB ${ind.anoReferencia})'
        : '';

    List<List<String>> etapaRows(AprendizagemEtapa? etapa) {
      if (etapa == null) return const <List<String>>[];
      return [
        ['IDEB Observado', _nullableNumber(etapa.idebObservado)],
        ['Nota Português', _nullableNumber(etapa.notaPortugues)],
        ['Nota Matemática', _nullableNumber(etapa.notaMatematica)],
        ['Nota Média', _nullableNumber(etapa.notaMedia)],
        ['Taxa de Aprovação', _nullableNumber(etapa.taxaAprovacao)],
        ['Ind. Rendimento', _nullableNumber(etapa.indicadorRendimento)],
      ];
    }

    return [
      _pageTitle('PARTE III - INDICADORES EDUCACIONAIS (cont.)'),
      pw.SizedBox(height: 10),
      _sectionHeading('11.1', 'Indicadores de Aprendizagem$anoLabel'),
      pw.SizedBox(height: 8),
      _sectionHeading('11.1a', 'Anos Iniciais'),
      pw.SizedBox(height: 8),
      _table(
        headers: const ['Indicador', 'Valor'],
        rows: etapaRows(ind.anosIniciais),
        widths: const {0: pw.FlexColumnWidth(60), 1: pw.FlexColumnWidth(40)},
      ),
      pw.SizedBox(height: 10),
      _sectionHeading('11.1b', 'Anos Finais'),
      pw.SizedBox(height: 8),
      _table(
        headers: const ['Indicador', 'Valor'],
        rows: etapaRows(ind.anosFinais),
        widths: const {0: pw.FlexColumnWidth(60), 1: pw.FlexColumnWidth(40)},
      ),
      if (ind.distorcaoIdadeSerie != null) ...[
        pw.SizedBox(height: 10),
        _sectionHeading('11.1c', 'Distorção Idade-Série'),
        pw.SizedBox(height: 8),
        _table(
          headers: const ['Recorte', 'Taxa (%)'],
          rows: [
            [
              'Ensino Fundamental',
              _nullableNumber(ind.distorcaoIdadeSerie!.fundamentalTotal),
            ],
            [
              'Anos Iniciais',
              _nullableNumber(ind.distorcaoIdadeSerie!.anosIniciais),
            ],
            [
              'Anos Finais',
              _nullableNumber(ind.distorcaoIdadeSerie!.anosFinais),
            ],
          ],
          widths: const {0: pw.FlexColumnWidth(60), 1: pw.FlexColumnWidth(40)},
        ),
      ],
      pw.SizedBox(height: 8),
      if (ind.fonte != null) _mutedText('Fonte: ${ind.fonte}'),
      if (ind.fonteDistorcao != null) ...[
        pw.SizedBox(height: 4),
        _mutedText('Fonte distorção: ${ind.fonteDistorcao}'),
      ],
    ];
  }

  static List<pw.Widget> _buildInfraestruturaEscolarPage(
    RelatorioDirigidoMunicipio report,
  ) {
    final infra = report.infraestruturaEscolar;
    if (infra == null || !infra.disponivel) {
      return [
        _pageTitle('PARTE III - INDICADORES EDUCACIONAIS (cont.)'),
        pw.SizedBox(height: 8),
        _callout(
          'Os dados de infraestrutura escolar ainda não estão disponíveis para este município.',
          accent: _orange,
          background: _softOrange,
        ),
      ];
    }

    final anoLabel = infra.anoReferencia != null
        ? ' - ${infra.anoReferencia}'
        : '';

    return [
      _pageTitle('PARTE III - INDICADORES EDUCACIONAIS (cont.)'),
      pw.SizedBox(height: 10),
      _sectionHeading('11.2', 'Infraestrutura da Rede Pública$anoLabel'),
      pw.SizedBox(height: 8),
      _callout(
        'Total de escolas públicas (todas as redes): ${_integerNullable(infra.totalEscolasPublicas)}'
        '${infra.anoReferencia != null ? '  |  Ano de referência: ${infra.anoReferencia}' : ''}',
        accent: _blue,
        background: _softBlue,
      ),
      pw.SizedBox(height: 8),
      _table(
        headers: const ['Indicador', 'Escolas', 'Cobertura (%)'],
        rows: infra.indicadores
            .map(
              (item) => [
                _safe(item.nome),
                _integerNullable(item.total),
                _nullableNumber(item.percentual),
              ],
            )
            .toList(),
        widths: const {
          0: pw.FlexColumnWidth(50),
          1: pw.FlexColumnWidth(24),
          2: pw.FlexColumnWidth(26),
        },
      ),
    ];
  }

  static List<pw.Widget> _buildNarrativasPage(
    RelatorioDirigidoMunicipio report,
  ) {
    final narrativas = report.narrativas;
    if (narrativas == null) {
      return const <pw.Widget>[];
    }

    final sections = <({String titulo, String? texto})>[
      (titulo: 'Síntese', texto: narrativas.textoSintese),
      (titulo: 'Indicadores de qualidade', texto: narrativas.textoQedu),
      (
        titulo: 'Movimentos relevantes',
        texto: narrativas.textoMovimentosRelevantes,
      ),
      (
        titulo: 'Como a Rocha Prime pode atuar',
        texto: narrativas.textoComoRochaPrimeEntra,
      ),
      (titulo: 'Conclusão', texto: narrativas.textoConclusao),
    ].where((item) => item.texto != null && item.texto!.isNotEmpty).toList();

    if (sections.isEmpty) return const <pw.Widget>[];

    return [
      _pageTitle('PARTE IV - ANÁLISE ESTRATÉGICA'),
      pw.SizedBox(height: 10),
      _sectionHeading('12', 'Análise Estratégica'),
      pw.SizedBox(height: 8),
      ...sections.expand(
        (item) => [
          pw.Text(
            _safe(item.titulo),
            style: pw.TextStyle(
              color: _navy,
              fontSize: 9.5,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 6),
          pw.Text(
            _safe(item.texto),
            style: const pw.TextStyle(
              color: _text,
              fontSize: 8.3,
              lineSpacing: 1.8,
            ),
          ),
          pw.SizedBox(height: 10),
        ],
      ),
    ];
  }

  static List<pw.Widget> _buildDirectedExecutivePart1(
    RelatorioDirigidoMunicipio report,
  ) {
    return [
      _pageTitle('PARTE V - CADERNO TÉCNICO'),
      pw.SizedBox(height: 8),
      _callout(
        report.resumoExecutivo,
        title: 'Nota técnica de validação',
        accent: _blue,
        background: _softBlue,
      ),
      pw.SizedBox(height: 10),
      _sectionHeading('16', 'Recomendações Técnicas'),
      pw.SizedBox(height: 10),
      _bulletBox('Recomendações Técnicas', const <String>[
        'Validar a base de cálculo do ICMS e a aplicação do percentual mínimo de 28% com assessoria jurídico-tributária especializada.',
        'Conferir documentalmente as bases que determinam a captura de VAAF, VAAT e VAAR junto ao FNDE.',
        'Verificar atos normativos locais referentes à oferta de EJA, educação em tempo integral e eventuais parcerias intersetoriais com impacto no Censo Escolar.',
      ]),
      pw.SizedBox(height: 10),
      _sectionHeading('17', 'Próximos Passos'),
      pw.SizedBox(height: 10),
      _bulletBox(
        'Próximos Passos',
        report.proximosPassos.isEmpty
            ? const <String>['Sem proximos passos formalizados nesta versao.']
            : report.proximosPassos,
      ),
      if (report.alertasJuridicos.isNotEmpty) ...[
        pw.SizedBox(height: 10),
        _sectionHeading('18', 'Alertas Técnicos'),
        pw.SizedBox(height: 10),
        _bulletBox('Alertas Técnicos', report.alertasJuridicos),
      ],
    ];
  }

  static List<pw.Widget> _buildDirectedExecutivePart2(
    RelatorioDirigidoMunicipio report,
  ) {
    return [
      _pageTitle('PARTE V - CADERNO TÉCNICO (cont.)'),
      pw.SizedBox(height: 8),
      _sectionHeading('15', 'Perfil da Gestão Municipal'),
      pw.SizedBox(height: 10),
      _table(
        headers: const ['Campo', 'Leitura'],
        rows: [
          ['Prefeito atual', _safe(report.contextoPolitico.prefeitoAtual)],
          ['Partido atual', _safe(report.contextoPolitico.partidoAtual)],
          [
            'Classificação de mandato',
            _safe(
              report.contextoPolitico.classificacaoMandato,
            ).replaceAll('_', ' '),
          ],
        ],
        widths: const {0: pw.FlexColumnWidth(28), 1: pw.FlexColumnWidth(72)},
      ),
      pw.SizedBox(height: 8),
      _callout(
        report.contextoPolitico.detalheMandato,
        accent: _green,
        background: _softGreen,
      ),
    ];
  }

  static List<pw.Widget> _buildDirectedHistoricPage(
    RelatorioFundeb relatorio,
    RelatorioDirigidoMunicipio report,
  ) {
    final annualRows = _annualFundebRows(relatorio, report);
    final historyRows = annualRows
        .map(
          (item) => <String>[
            '${item.year}',
            _moneyNullable(item.totalReceitasFundeb),
            _integerNullable(item.totalMatriculasMunicipais),
            _integerNullable(item.tempoIntegral),
            item.status,
          ],
        )
        .toList();

    return [
      _pageTitle('Parte IV - Comparativo por Ano'),
      pw.SizedBox(height: 8),
      _sectionHeading(
        '12',
        'Linha do tempo 2022 a ${_comparisonEndYear(relatorio)}',
      ),
      pw.SizedBox(height: 10),
      _callout(
        'Esta página organiza os valores por exercício, de 2022 até ${_todayLabel()}. Anos sem número consolidado aparecem como pendentes para evitar comparação fora de base. A coluna de status mostra se o dado veio do histórico, do levantamento atual ou se ainda precisa ser carregado.\n\nNota: O ano de ${DateTime.now().year} pode não possuir dados de matrículas, tempo integral e base escolar porque o Censo Escolar ${DateTime.now().year} ainda está em fase de coleta pelo INEP e só será publicado em ${DateTime.now().year + 1}.',
        title: 'Como ler esta série',
        accent: _blue,
        background: _softBlue,
      ),
      pw.SizedBox(height: 8),
      if (historyRows.isNotEmpty)
        _table(
          headers: const [
            'Ano',
            'Receita FUNDEB',
            'Matrículas públicas',
            'Tempo integral',
            'Status',
          ],
          rows: historyRows,
          widths: const {
            0: pw.FlexColumnWidth(10),
            1: pw.FlexColumnWidth(25),
            2: pw.FlexColumnWidth(22),
            3: pw.FlexColumnWidth(18),
            4: pw.FlexColumnWidth(25),
          },
        )
      else
        _callout(
          'Ainda não há valores anuais suficientes para montar a linha do tempo.',
          accent: _orange,
          background: _softOrange,
        ),
      pw.SizedBox(height: 8),
      _callout(
        _plainHistoricalSummary(report.historico.resumo),
        title: 'Resumo em linguagem simples',
        accent: _green,
        background: _softGreen,
      ),
    ];
  }

  static List<pw.Widget> _buildDirectedComparativeOverviewPage(
    RelatorioFundeb relatorio,
    RelatorioDirigidoMunicipio report,
  ) {
    final comparison = _historicalComparison(report, relatorio: relatorio);
    if (comparison == null) {
      return [
        _sectionHeading('13', 'Comparação financeira'),
        pw.SizedBox(height: 10),
        _callout(
          'Ainda não há anos suficientes com valor de receita para comparar a evolução do FUNDEB.',
          accent: _orange,
          background: _softOrange,
        ),
      ];
    }

    final trendRows = _annualFundebRows(relatorio, report)
        .map(
          (item) => <String>[
            '${item.year}',
            _moneyNullable(item.totalReceitasFundeb),
            _moneyNullable(item.contribuicaoMunicipal),
            _moneyNullable(item.unionComplementation),
            item.status,
          ],
        )
        .toList();

    final revenueSeries = comparison.series
        .where((item) => item.totalReceitasFundeb != null)
        .toList();
    final revenueStart = revenueSeries.isEmpty
        ? comparison.current
        : revenueSeries.first;
    final revenueEnd = revenueSeries.isEmpty
        ? comparison.current
        : revenueSeries.last;
    final schoolSeries = comparison.series
        .where((item) => item.totalMatriculasMunicipais != null)
        .toList();
    final schoolStart = schoolSeries.isEmpty ? null : schoolSeries.first;
    final schoolEnd = schoolSeries.isEmpty ? null : schoolSeries.last;
    final rangeLabel = '2022 a ${_comparisonEndYear(relatorio)}';
    final overviewText =
        'O panorama abaixo acompanha a evolução de $rangeLabel. A receita do FUNDEB vai de ${_moneyNullable(revenueStart.totalReceitasFundeb)} em ${revenueStart.ano} para ${_moneyNullable(revenueEnd.totalReceitasFundeb)} em ${revenueEnd.ano}, '
        'com variação de ${_deltaPercentLabel(revenueStart.totalReceitasFundeb, revenueEnd.totalReceitasFundeb)}. '
        '${schoolStart == null || schoolEnd == null ? 'A base escolar ainda não trouxe dados suficientes para o mesmo recorte.' : 'Na base escolar, as matrículas vão de ${_integerNullable(schoolStart.totalMatriculasMunicipais)} em ${schoolStart.ano} para ${_integerNullable(schoolEnd.totalMatriculasMunicipais)} em ${schoolEnd.ano}, e o tempo integral vai de ${_integerNullable(schoolStart.tempoIntegral)} para ${_integerNullable(schoolEnd.tempoIntegral)}.'}';

    return [
      _pageTitle('Parte IV - Comparativo por Ano'),
      pw.SizedBox(height: 8),
      _sectionHeading('13', 'Comparativo anual ${comparison.seriesLabel}'),
      pw.SizedBox(height: 10),
      _callout(
        overviewText,
        title: 'Leitura rápida',
        accent: _blue,
        background: _softBlue,
      ),
      pw.SizedBox(height: 10),
      pw.Row(
        children: [
          pw.Expanded(
            child: _metricCard(
              'Receita $rangeLabel',
              _signedMoneyCompactLabel(
                revenueStart.totalReceitasFundeb,
                revenueEnd.totalReceitasFundeb,
              ),
              'de ${_moneyNullable(revenueStart.totalReceitasFundeb)} para ${_moneyNullable(revenueEnd.totalReceitasFundeb)}',
              background: _softBlue,
            ),
          ),
          pw.SizedBox(width: 8),
          pw.Expanded(
            child: _metricCard(
              'Matrículas $rangeLabel',
              _signedIntLabel(
                schoolStart?.totalMatriculasMunicipais,
                schoolEnd?.totalMatriculasMunicipais,
              ),
              'de ${_integerNullable(schoolStart?.totalMatriculasMunicipais)} para ${_integerNullable(schoolEnd?.totalMatriculasMunicipais)}',
              background: _softGreen,
            ),
          ),
          pw.SizedBox(width: 8),
          pw.Expanded(
            child: _metricCard(
              'Tempo integral',
              _signedIntLabel(
                schoolStart?.tempoIntegral,
                schoolEnd?.tempoIntegral,
              ),
              'de ${_integerNullable(schoolStart?.tempoIntegral)} para ${_integerNullable(schoolEnd?.tempoIntegral)}',
              background: _softOrange,
            ),
          ),
        ],
      ),
      pw.SizedBox(height: 16),
      _sectionHeading('13.1', 'Série oficial da receita FUNDEB'),
      pw.SizedBox(height: 10),
      _table(
        headers: const [
          'Ano',
          'Receita total',
          'Contribuição municipal',
          'Compl. União',
          'Status',
        ],
        rows: trendRows,
        widths: const {
          0: pw.FlexColumnWidth(10),
          1: pw.FlexColumnWidth(23),
          2: pw.FlexColumnWidth(23),
          3: pw.FlexColumnWidth(20),
          4: pw.FlexColumnWidth(24),
        },
      ),
      pw.SizedBox(height: 10),
      _callout(
        'O comparativo considera somente anos com valores preenchidos. Quando um ano aparece sem valor, ele fica na linha do tempo como pendência, mas não entra no cálculo da variação.',
        title: 'Regra de comparação',
        accent: _orange,
        background: _softOrange,
      ),
    ];
  }

  static List<pw.Widget> _buildDirectedComparativeBasePage(
    RelatorioFundeb relatorio,
    RelatorioDirigidoMunicipio report,
  ) {
    final annualRows = _annualFundebRows(relatorio, report);
    final hasAnyValue = annualRows.any((item) => item.hasAnyValue);
    if (!hasAnyValue) {
      return [
        _sectionHeading('13.2', 'Base comparável'),
        pw.SizedBox(height: 10),
        _callout(
          'Ainda não há valores anuais suficientes para montar o panorama 2022 a 2026.',
          accent: _orange,
          background: _softOrange,
        ),
      ];
    }

    final receitaRows = <List<String>>[];
    double? previousRevenue;
    int? previousRevenueYear;
    for (final row in annualRows) {
      final variation = row.totalReceitasFundeb == null
          ? '-'
          : previousRevenue == null
          ? 'base'
          : '${previousRevenueYear ?? '-'} -> ${row.year}: ${_deltaPercentLabel(previousRevenue, row.totalReceitasFundeb)}';
      receitaRows.add([
        '${row.year}',
        _moneyNullable(row.totalReceitasFundeb),
        _moneyNullable(row.contribuicaoMunicipal),
        _moneyNullable(row.unionComplementation),
        variation,
        row.status,
      ]);
      if (row.totalReceitasFundeb != null) {
        previousRevenue = row.totalReceitasFundeb;
        previousRevenueYear = row.year;
      }
    }

    final baseRows = annualRows
        .where(
          (row) =>
              row.totalMatriculasMunicipais != null ||
              row.tempoIntegral != null ||
              row.educacaoEspecial != null ||
              row.eja != null,
        )
        .map(
          (row) => <String>[
            '${row.year}',
            row.schoolBaseLabel,
            _integerNullable(row.totalEscolas),
            _integerNullable(row.totalMatriculasMunicipais),
            _integerNullable(row.tempoIntegral),
            _integerNullable(row.educacaoEspecial),
            _integerNullable(row.eja),
          ],
        )
        .toList();

    return [
      _sectionHeading(
        '13.2',
        'Evolução financeira 2022 a ${_comparisonEndYear(relatorio)}',
      ),
      pw.SizedBox(height: 10),
      _table(
        headers: const [
          'Ano',
          'Receita total',
          'Contribuição municipal',
          'Compl. União',
          'Variação',
          'Status',
        ],
        rows: receitaRows,
        widths: const {
          0: pw.FlexColumnWidth(8),
          1: pw.FlexColumnWidth(20),
          2: pw.FlexColumnWidth(20),
          3: pw.FlexColumnWidth(17),
          4: pw.FlexColumnWidth(18),
          5: pw.FlexColumnWidth(17),
        },
      ),
      pw.SizedBox(height: 16),
      _sectionHeading(
        '13.3',
        'Base escolar 2022 a ${_comparisonEndYear(relatorio)}',
      ),
      pw.SizedBox(height: 10),
      _table(
        headers: const [
          'Ano',
          'Base censo',
          'Escolas',
          'Matrículas',
          'Tempo integral',
          'Ed. especial',
          'EJA',
        ],
        rows: baseRows,
        widths: const {
          0: pw.FlexColumnWidth(8),
          1: pw.FlexColumnWidth(14),
          2: pw.FlexColumnWidth(13),
          3: pw.FlexColumnWidth(17),
          4: pw.FlexColumnWidth(17),
          5: pw.FlexColumnWidth(17),
          6: pw.FlexColumnWidth(14),
        },
      ),
      pw.SizedBox(height: 16),
      _bulletBox('Leitura simples', [
        'A evolução financeira mostra todos os exercícios de 2022 a ${_comparisonEndYear(relatorio)}, inclusive anos pendentes.',
        'A variação compara cada ano preenchido com o último ano anterior que também tinha valor.',
        'A base escolar segue o mesmo recorte anual para dar visão de escolas, matrículas, tempo integral, educação especial e EJA.',
        'Anos sem nenhum dado de censo publicado são omitidos da tabela escolar.',
      ]),
    ];
  }

  // ignore: unused_element
  static List<pw.Widget> _buildDirectedBenchmarkPage(
    RelatorioDirigidoMunicipio report,
  ) {
    final benchmarkRows = report.benchmarkRegional.municipios
        .map(
          (item) => <String>[
            '${item.municipio}/${item.uf}',
            item.totalReceitasFundeb == null
                ? '-'
                : _money(item.totalReceitasFundeb!),
            item.vantagemReceita == null ? '-' : _money(item.vantagemReceita!),
            _crop(item.insight, 90),
          ],
        )
        .toList();
    return [
      _pageTitle('PARTE IV - ANÁLISE COMPARATIVA'),
      pw.SizedBox(height: 8),
      _sectionHeading('14', 'Benchmark Regional'),
      pw.SizedBox(height: 10),
      _callout(
        'O comparativo regional apresenta municípios do mesmo eixo territorial com perfil populacional semelhante, permitindo avaliar o posicionamento de ${report.municipio} em relação ao potencial de receita do FUNDEB na região. Critério: ${report.benchmarkRegional.criterio}.',
        accent: _green,
        background: _softGreen,
      ),
      pw.SizedBox(height: 8),
      if (benchmarkRows.isNotEmpty)
        _table(
          headers: const ['Município', 'Receita', 'Vantagem', 'Insight'],
          rows: benchmarkRows,
          widths: const {
            0: pw.FlexColumnWidth(20),
            1: pw.FlexColumnWidth(22),
            2: pw.FlexColumnWidth(20),
            3: pw.FlexColumnWidth(38),
          },
        )
      else
        _callout(
          'Nenhum comparavel regional com superioridade clara foi consolidado nesta versao.',
          accent: _orange,
          background: _softOrange,
        ),
    ];
  }

  static List<pw.Widget> _buildDirectedBenchmarkPageCards(
    RelatorioDirigidoMunicipio report,
  ) {
    return [
      _pageTitle('PARTE IV - ANÁLISE COMPARATIVA (cont.)'),
      pw.SizedBox(height: 8),
      _sectionHeading('14', 'Benchmark Regional'),
      pw.SizedBox(height: 10),
      _callout(
        'O comparativo regional apresenta municípios do mesmo eixo territorial com perfil populacional semelhante, permitindo avaliar o posicionamento de ${report.municipio} em relação ao potencial de receita do FUNDEB na região. Critério: ${report.benchmarkRegional.criterio}.',
        accent: _green,
        background: _softGreen,
      ),
      pw.SizedBox(height: 8),
      if (report.benchmarkRegional.municipios.isNotEmpty)
        ...report.benchmarkRegional.municipios.map(
          (item) => pw.Padding(
            padding: const pw.EdgeInsets.only(bottom: 12),
            child: _benchmarkMunicipioCard(item),
          ),
        )
      else
        _callout(
          'Nenhum comparavel regional com superioridade clara foi consolidado nesta versao.',
          accent: _orange,
          background: _softOrange,
        ),
    ];
  }

  static pw.Widget _header(String municipio, {String? rochaLogoSvg}) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            if (rochaLogoSvg != null)
              pw.Container(
                width: 48,
                height: 24,
                margin: const pw.EdgeInsets.only(right: 12),
                child: pw.SvgImage(svg: rochaLogoSvg, fit: pw.BoxFit.contain),
              ),
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'ROCHA PRIME SERVIÇOS ESPECIALIZADOS',
                    style: pw.TextStyle(
                      color: _navy,
                      fontSize: 9.8,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 1.5),
                  pw.Text(
                    'CNPJ: 29.342.691/0001-93  |  Tel: (61) 99866-7834',
                    style: const pw.TextStyle(color: _text, fontSize: 5.2),
                  ),
                  pw.SizedBox(height: 2.5),
                  pw.Text(
                    'Diagnóstico Estratégico Educacional',
                    style: pw.TextStyle(
                      color: _navy,
                      fontSize: 8.8,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.Text(
                    municipio,
                    style: const pw.TextStyle(color: _text, fontSize: 7.6),
                  ),
                  pw.Text(
                    'Fonte: FNDE / INEP / IBGE',
                    style: const pw.TextStyle(color: _muted, fontSize: 5.1),
                  ),
                ],
              ),
            ),
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(
                horizontal: 7,
                vertical: 3.5,
              ),
              decoration: pw.BoxDecoration(
                color: _orange,
                borderRadius: pw.BorderRadius.circular(3),
              ),
              child: pw.Text(
                'DOCUMENTO CONFIDENCIAL',
                style: pw.TextStyle(
                  color: _white,
                  fontSize: 5.1,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        pw.SizedBox(height: 7),
        pw.Container(height: 1.1, color: _navy),
      ],
    );
  }

  // ignore: unused_element
  static pw.Widget _documentFooter(int pageNumber, int totalPages) {
    return pw.Column(
      children: [
        pw.Container(height: 0.6, color: _line),
        pw.SizedBox(height: 6),
        pw.Text(
          'Rocha Prime Serviços Especializados Ltda  |  CNPJ: 29.342.691/0001-93',
          style: const pw.TextStyle(color: _muted, fontSize: 5),
        ),
        pw.SizedBox(height: 2),
        pw.Row(
          children: [
            pw.Expanded(
              child: pw.Text(
                'Este documento é confidencial e destinado exclusivamente ao destinatário. Reprodução proibida.',
                style: const pw.TextStyle(color: _muted, fontSize: 4.6),
              ),
            ),
            pw.Text(
              'Página $pageNumber de $totalPages',
              style: const pw.TextStyle(color: _muted, fontSize: 4.8),
            ),
          ],
        ),
      ],
    );
  }

  static pw.Widget _documentFooterCentered(
    int pageNumber,
    int totalPages, {
    required DateTime generatedAt,
  }) {
    final generatedAtLabel = DateFormat(
      'dd/MM/yyyy HH:mm',
      'pt_BR',
    ).format(generatedAt);
    return pw.Column(
      children: [
        pw.Container(height: 0.6, color: _line),
        pw.SizedBox(height: 6),
        pw.Text(
          'Rocha Prime Serviços Especializados Ltda  |  CNPJ: 29.342.691/0001-93',
          style: const pw.TextStyle(color: _muted, fontSize: 5),
        ),
        pw.SizedBox(height: 2),
        pw.Row(
          children: [
            pw.Expanded(child: pw.SizedBox()),
            pw.Expanded(
              flex: 2,
              child: pw.Text(
                'Este documento é confidencial e destinado exclusivamente ao destinatário. Reprodução proibida.',
                textAlign: pw.TextAlign.center,
                style: const pw.TextStyle(color: _muted, fontSize: 4.6),
              ),
            ),
            pw.Expanded(
              child: pw.Align(
                alignment: pw.Alignment.centerRight,
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.end,
                  children: [
                    pw.Text(
                      generatedAtLabel,
                      style: const pw.TextStyle(color: _muted, fontSize: 4.4),
                    ),
                    pw.Text(
                      'Página $pageNumber de $totalPages',
                      style: const pw.TextStyle(color: _muted, fontSize: 4.8),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ignore: unused_element
  static pw.Widget _legacyFooter(int pageNumber, int totalPages) {
    return pw.Column(
      children: [
        pw.Container(height: 0.6, color: _line),
        pw.SizedBox(height: 6),
        pw.Text(
          'Rocha Prime Servicos Especializados Ltda  |  CNPJ: 29.342.691/0001-93',
          style: const pw.TextStyle(color: _muted, fontSize: 5),
        ),
        pw.SizedBox(height: 2),
        pw.Row(
          children: [
            pw.Expanded(
              child: pw.Text(
                _footerText,
                style: const pw.TextStyle(color: _muted, fontSize: 4.6),
              ),
            ),
            pw.Text(
              'Página $pageNumber de $totalPages',
              style: const pw.TextStyle(color: _muted, fontSize: 5),
            ),
          ],
        ),
      ],
    );
  }

  static pw.Widget _pageTitle(String title) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(top: 2),
      child: pw.Text(
        _safe(title, fallback: ''),
        style: pw.TextStyle(
          color: _navy,
          fontSize: 13,
          fontWeight: pw.FontWeight.bold,
        ),
      ),
    );
  }

  static pw.Widget _sectionHeading(String index, String title) {
    return pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.center,
      children: [
        pw.Container(
          width: index.length > 2 ? 32 : 24,
          height: 18,
          alignment: pw.Alignment.center,
          decoration: pw.BoxDecoration(
            color: _blue,
            borderRadius: pw.BorderRadius.circular(4),
          ),
          child: pw.Text(
            index,
            style: pw.TextStyle(
              color: _white,
              fontSize: index.length > 2 ? 7.2 : 8.2,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
        ),
        pw.SizedBox(width: 8),
        pw.Expanded(
          child: pw.Text(
            _safe(title, fallback: ''),
            style: pw.TextStyle(
              color: _navy,
              fontSize: 11.6,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }

  static pw.Widget _metricCard(
    String label,
    String value,
    String? helper, {
    PdfColor background = _white,
    PdfColor valueColor = _navy,
    PdfColor labelColor = _navy,
    PdfColor helperColor = _muted,
  }) {
    final safeValue = (value ?? '').trim().isEmpty ? '-' : value;
    final valueFontSize = safeValue.length > 18
        ? 12.6
        : safeValue.length > 14
        ? 14.2
        : 16.0;
    return pw.Container(
      height: 90,
      padding: const pw.EdgeInsets.fromLTRB(13, 13, 13, 11),
      decoration: pw.BoxDecoration(
        color: background,
        border: pw.Border.all(
          color: const PdfColor.fromInt(0xFFE4EBF4),
          width: 0.7,
        ),
        borderRadius: pw.BorderRadius.circular(10),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            _safe(label, fallback: ''),
            style: pw.TextStyle(
              color: labelColor,
              fontSize: 7.4,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 8),
          pw.Text(
            safeValue,
            maxLines: 1,
            style: pw.TextStyle(
              color: valueColor,
              fontSize: valueFontSize,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          if (helper != null) ...[
            pw.SizedBox(height: 6),
            pw.Text(
              _safe(helper, fallback: ''),
              style: pw.TextStyle(color: helperColor, fontSize: 7.2),
            ),
          ],
        ],
      ),
    );
  }

  static pw.Widget _smallMetricCard(String label, String value, String delta) {
    return pw.Container(
      height: 58,
      padding: const pw.EdgeInsets.all(8),
      decoration: pw.BoxDecoration(
        color: _white,
        border: pw.Border.all(
          color: const PdfColor.fromInt(0xFFE4EBF4),
          width: 0.7,
        ),
        borderRadius: pw.BorderRadius.circular(12),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            _safe(label, fallback: ''),
            style: pw.TextStyle(
              color: _navy,
              fontSize: 7,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 6),
          pw.Text(
            _safe(value, fallback: ''),
            style: pw.TextStyle(
              color: _navy,
              fontSize: 10.5,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 2),
          pw.Text(
            _safe(delta, fallback: ''),
            style: pw.TextStyle(
              color: _green,
              fontSize: 7,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _callout(
    String text, {
    String? title,
    PdfColor accent = _blue,
    PdfColor background = _softBlue,
  }) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(0),
      decoration: pw.BoxDecoration(
        color: background,
        border: pw.Border.all(
          color: const PdfColor.fromInt(0xFFE7EDF5),
          width: 0.6,
        ),
        borderRadius: pw.BorderRadius.circular(10),
      ),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(
            width: 4,
            decoration: pw.BoxDecoration(
              color: accent,
              borderRadius: const pw.BorderRadius.only(
                topLeft: pw.Radius.circular(10),
                bottomLeft: pw.Radius.circular(10),
              ),
            ),
          ),
          pw.Expanded(
            child: pw.Padding(
              padding: const pw.EdgeInsets.fromLTRB(14, 12, 14, 12),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  if (title != null) ...[
                    pw.Text(
                      _safe(title, fallback: ''),
                      style: pw.TextStyle(
                        color: _navy,
                        fontSize: 8.8,
                        fontWeight: pw.FontWeight.bold,
                      ),
                    ),
                    pw.SizedBox(height: 6),
                  ],
                  pw.Text(
                    _safe(text, fallback: ''),
                    style: const pw.TextStyle(
                      color: _text,
                      fontSize: 8.3,
                      lineSpacing: 1.8,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _bulletBox(String title, List<String> bullets) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(14),
      decoration: pw.BoxDecoration(
        color: _softBlue,
        border: pw.Border.all(
          color: const PdfColor.fromInt(0xFFE7EDF5),
          width: 0.6,
        ),
        borderRadius: pw.BorderRadius.circular(12),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            _safe(title, fallback: ''),
            style: pw.TextStyle(
              color: _navy,
              fontSize: 9,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 8),
          ...bullets.map(
            (item) => pw.Padding(
              padding: const pw.EdgeInsets.only(bottom: 6),
              child: pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    '- ',
                    style: const pw.TextStyle(color: _blue, fontSize: 10),
                  ),
                  pw.Expanded(
                    child: pw.Text(
                      _safe(item, fallback: ''),
                      style: const pw.TextStyle(
                        color: _text,
                        fontSize: 8.3,
                        lineSpacing: 2,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _litePanel(String title, List<List<String>> rows) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(12),
      decoration: pw.BoxDecoration(
        color: _white,
        border: pw.Border.all(
          color: const PdfColor.fromInt(0xFFE4EBF4),
          width: 0.7,
        ),
        borderRadius: pw.BorderRadius.circular(12),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            _safe(title, fallback: ''),
            style: pw.TextStyle(
              color: _navy,
              fontSize: 9,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 8),
          ...rows.map(
            (row) => pw.Padding(
              padding: const pw.EdgeInsets.only(bottom: 6),
              child: pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.SizedBox(
                    width: 78,
                    child: pw.Text(
                      _safe(row.first, fallback: ''),
                      style: const pw.TextStyle(color: _muted, fontSize: 7),
                    ),
                  ),
                  pw.Expanded(
                    child: pw.Text(
                      row.length > 1 ? _safe(row[1]) : '-',
                      style: pw.TextStyle(
                        color: _text,
                        fontSize: 7.6,
                        fontWeight: pw.FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _liteGridPanel(String title, List<List<String>> rows) {
    final leftRows = rows.take((rows.length / 2).ceil()).toList();
    final rightRows = rows.skip(leftRows.length).toList();

    pw.Widget column(List<List<String>> values) {
      return pw.Column(
        children: values
            .map(
              (row) => pw.Padding(
                padding: const pw.EdgeInsets.only(bottom: 5),
                child: pw.Row(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.SizedBox(
                      width: 72,
                      child: pw.Text(
                        _safe(row.first, fallback: ''),
                        style: const pw.TextStyle(color: _muted, fontSize: 6.7),
                      ),
                    ),
                    pw.Expanded(
                      child: pw.Text(
                        row.length > 1 ? _safe(row[1]) : '-',
                        style: pw.TextStyle(
                          color: _text,
                          fontSize: 7.1,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      );
    }

    return pw.Container(
      padding: const pw.EdgeInsets.all(12),
      decoration: pw.BoxDecoration(
        color: _white,
        border: pw.Border.all(
          color: const PdfColor.fromInt(0xFFE4EBF4),
          width: 0.7,
        ),
        borderRadius: pw.BorderRadius.circular(12),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            _safe(title, fallback: ''),
            style: pw.TextStyle(
              color: _navy,
              fontSize: 9,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 8),
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(child: column(leftRows)),
              pw.SizedBox(width: 14),
              pw.Expanded(child: column(rightRows)),
            ],
          ),
        ],
      ),
    );
  }

  static pw.Widget _liteCompositionBar({
    required String title,
    required double total,
    required List<_LiteSegment> segments,
  }) {
    final positiveSegments = segments.where((item) => item.value > 0).toList();
    return pw.Container(
      padding: const pw.EdgeInsets.all(12),
      decoration: pw.BoxDecoration(
        color: _white,
        border: pw.Border.all(
          color: const PdfColor.fromInt(0xFFE4EBF4),
          width: 0.7,
        ),
        borderRadius: pw.BorderRadius.circular(12),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Row(
            children: [
              pw.Expanded(
                child: pw.Text(
                  _safe(title, fallback: ''),
                  style: pw.TextStyle(
                    color: _navy,
                    fontSize: 9,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
              ),
              pw.Text(
                _moneyCompact(total),
                style: pw.TextStyle(
                  color: _navy,
                  fontSize: 10,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 10),
          pw.Row(
            children: positiveSegments
                .map(
                  (item) => pw.Expanded(
                    flex:
                        ((item.value / total.clamp(1, double.infinity)) * 1000)
                            .round()
                            .clamp(1, 1000)
                            .toInt(),
                    child: pw.Container(height: 12, color: item.color),
                  ),
                )
                .toList(),
          ),
          pw.SizedBox(height: 8),
          pw.Wrap(
            spacing: 14,
            runSpacing: 4,
            children: positiveSegments
                .map(
                  (item) => pw.Row(
                    mainAxisSize: pw.MainAxisSize.min,
                    children: [
                      pw.Container(width: 7, height: 7, color: item.color),
                      pw.SizedBox(width: 4),
                      pw.Text(
                        '${_safe(item.label)}: ${_part(item.value, total)}',
                        style: const pw.TextStyle(color: _muted, fontSize: 7),
                      ),
                    ],
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }

  static pw.Widget _highlightBox(String title, String value, String helper) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
        color: _softGreen,
        border: pw.Border.all(
          color: const PdfColor.fromInt(0xFFE1ECDD),
          width: 0.6,
        ),
        borderRadius: pw.BorderRadius.circular(12),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            _safe(title, fallback: ''),
            style: pw.TextStyle(
              color: _navy,
              fontSize: 8.5,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 8),
          pw.Text(
            _safe(value, fallback: ''),
            style: pw.TextStyle(
              color: _green,
              fontSize: 20,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 4),
          pw.Text(
            _safe(helper, fallback: ''),
            style: const pw.TextStyle(color: _text, fontSize: 8),
          ),
        ],
      ),
    );
  }

  static pw.Widget _benchmarkMunicipioCard(
    RelatorioDirigidoMunicipioComparavel item,
  ) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(14),
      decoration: pw.BoxDecoration(
        color: _white,
        border: pw.Border.all(
          color: const PdfColor.fromInt(0xFFE4EBF4),
          width: 0.7,
        ),
        borderRadius: pw.BorderRadius.circular(12),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(
                child: pw.Text(
                  '${_safe(item.municipio)}/${_safe(item.uf)}',
                  style: pw.TextStyle(
                    color: _navy,
                    fontSize: 10,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
              ),
              pw.Container(
                padding: const pw.EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 4,
                ),
                decoration: pw.BoxDecoration(
                  color: _softBlue,
                  borderRadius: pw.BorderRadius.circular(10),
                ),
                child: pw.Text(
                  'Vantagem ${item.vantagemReceita == null ? '-' : _money(item.vantagemReceita!)}',
                  style: pw.TextStyle(
                    color: _blue,
                    fontSize: 7,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 10),
          pw.Row(
            children: [
              pw.Expanded(
                child: _metricCard(
                  'Receita total',
                  item.totalReceitasFundeb == null
                      ? '-'
                      : _money(item.totalReceitasFundeb!),
                  'Posicionamento no eixo regional',
                  background: _softBlue,
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 10),
          _callout(
            _safe(item.insight),
            title: 'Leitura do município',
            accent: _green,
            background: _softGreen,
          ),
        ],
      ),
    );
  }

  static Future<pw.Font> _loadPdfFont() async {
    if (_interFont != null) {
      return _interFont!;
    }
    final data = await rootBundle.load('assets/fonts/InterVariable.ttf');
    _interFont = pw.Font.ttf(data);
    return _interFont!;
  }

  static pw.ThemeData _pdfTheme(pw.Font contentFont) {
    return pw.ThemeData.withFont(
      base: contentFont,
      bold: contentFont,
      italic: contentFont,
      boldItalic: contentFont,
    );
  }

  static Future<String?> _loadRochaPrimeLogoSvg() async {
    if (_logoLoaded) return _cachedLogoSvg;
    try {
      final raw = await rootBundle.loadString(
        'assets/branding/logo-rocha-prime-institucional.svg',
      );
      _cachedLogoSvg = _normalizeRawText(
        raw.replaceFirst('<rect width="520" height="360" fill="white"/>', ''),
      );
    } catch (_) {
      _cachedLogoSvg = null;
    }
    _logoLoaded = true;
    return _cachedLogoSvg;
  }

  static _HistoricalComparison? _historicalComparison(
    RelatorioDirigidoMunicipio report, {
    RelatorioFundeb? relatorio,
  }) {
    final series = _effectiveHistoricalSeries(report, relatorio: relatorio);
    if (series.isEmpty) {
      return null;
    }

    final comparableRevenue = series
        .where((item) => item.totalReceitasFundeb != null)
        .toList();
    final current = comparableRevenue.isNotEmpty
        ? comparableRevenue.last
        : series.last;
    final previous = comparableRevenue.length > 1
        ? comparableRevenue[comparableRevenue.length - 2]
        : null;
    final educationalSeries = [
      for (final item in series)
        if ((item.anoBaseCenso ?? item.ano) > 0 &&
            (item.totalMatriculasMunicipais != null ||
                item.totalEscolas != null ||
                item.eja != null ||
                item.tempoIntegral != null ||
                item.educacaoEspecial != null))
          item,
    ];
    final distinctEducationalSeries = <RelatorioDirigidoSerieHistoricaAno>[];
    final seenEducationalBases = <int>{};
    for (final item in educationalSeries.reversed) {
      final baseYear = item.anoBaseCenso ?? item.ano;
      if (seenEducationalBases.add(baseYear)) {
        distinctEducationalSeries.add(item);
      }
      if (distinctEducationalSeries.length == 2) {
        break;
      }
    }
    final currentEducation = distinctEducationalSeries.isNotEmpty
        ? distinctEducationalSeries.first
        : current;
    final previousEducation = distinctEducationalSeries.length > 1
        ? distinctEducationalSeries[1]
        : null;
    return _HistoricalComparison(
      series: series,
      current: current,
      previous: previous,
      currentEducation: currentEducation,
      previousEducation: previousEducation,
    );
  }

  static List<RelatorioDirigidoSerieHistoricaAno> _effectiveHistoricalSeries(
    RelatorioDirigidoMunicipio report, {
    RelatorioFundeb? relatorio,
  }) {
    final byYear = <int, RelatorioDirigidoSerieHistoricaAno>{
      for (final item in report.historico.anos) item.ano: item,
    };
    if (relatorio != null &&
        !byYear.containsKey(relatorio.identificacao.exercicio)) {
      final censo = relatorio.censoEscolar;
      byYear[relatorio
          .identificacao
          .exercicio] = RelatorioDirigidoSerieHistoricaAno(
        ano: relatorio.identificacao.exercicio,
        anoBaseCenso: censo?.anoReferencia,
        totalReceitasFundeb: relatorio.receitas.totalReceitas,
        contribuicaoMunicipal: relatorio.receitas.receitaContribuicaoMunicipal,
        complementacaoVAAF: relatorio.receitas.complementacaoVAAF,
        complementacaoVAAT: relatorio.receitas.complementacaoVAAT,
        complementacaoVAAR: relatorio.receitas.complementacaoVAAR,
        totalMatriculasMunicipais: censo?.totalMatriculas,
        totalEscolas: censo?.totalEscolas,
        eja: censo?.matriculasEtapa.eja,
        tempoIntegral: censo?.tempoIntegral.total,
        educacaoEspecial: censo?.matriculasEtapa.educacaoEspecial,
      );
    }
    return byYear.values.toList()
      ..sort((left, right) => left.ano.compareTo(right.ano));
  }

  static List<_AnnualFundebRow> _annualFundebRows(
    RelatorioFundeb relatorio,
    RelatorioDirigidoMunicipio? report,
  ) {
    final startYear = 2022;
    final endYear = _comparisonEndYear(relatorio, report: report);
    final historyByYear = <int, RelatorioDirigidoSerieHistoricaAno>{
      for (final item
          in report?.historico.anos ??
              const <RelatorioDirigidoSerieHistoricaAno>[])
        item.ano: item,
    };
    final rows = <_AnnualFundebRow>[];
    for (var year = startYear; year <= endYear; year++) {
      final historical = historyByYear[year];
      if (historical != null) {
        rows.add(
          _AnnualFundebRow.fromHistorical(
            historical,
            historical.fonteReceita ?? 'Histórico',
          ),
        );
        continue;
      }
      if (year == relatorio.identificacao.exercicio) {
        rows.add(_AnnualFundebRow.fromRelatorio(relatorio));
        continue;
      }
      rows.add(_AnnualFundebRow.empty(year));
    }
    return rows;
  }

  static int _comparisonEndYear(
    RelatorioFundeb relatorio, {
    RelatorioDirigidoMunicipio? report,
  }) {
    var endYear = DateTime.now().year;
    if (relatorio.identificacao.exercicio > endYear) {
      endYear = relatorio.identificacao.exercicio;
    }
    for (final item
        in report?.historico.anos ??
            const <RelatorioDirigidoSerieHistoricaAno>[]) {
      if (item.ano > endYear) {
        endYear = item.ano;
      }
    }
    return endYear < 2022 ? 2022 : endYear;
  }

  static String _todayLabel() {
    return DateFormat('dd/MM/yyyy', 'pt_BR').format(DateTime.now());
  }

  static double? _unionComplementation(
    RelatorioDirigidoSerieHistoricaAno item,
  ) {
    final values = [
      item.complementacaoVAAF,
      item.complementacaoVAAT,
      item.complementacaoVAAR,
    ].whereType<double>().toList();
    if (values.isEmpty) return null;
    return values.fold<double>(0, (sum, value) => sum + value);
  }

  static String _moneyNullable(double? value) =>
      value == null ? '-' : _money(value);

  static String _moneyCompact(double value) {
    final abs = value.abs();
    if (abs >= 1000000) {
      final reduced = (value / 1000000).toStringAsFixed(2).replaceAll('.', ',');
      return 'R\$ $reduced mi';
    }
    if (abs >= 1000) {
      final reduced = (value / 1000).toStringAsFixed(0).replaceAll('.', ',');
      return 'R\$ $reduced mil';
    }
    return _money(value);
  }

  static String _deltaPercentLabel(double? previous, double? current) {
    if (previous == null || current == null) return '-';
    if (previous == 0) return current == 0 ? '0,0%' : 'nova base';
    final delta = ((current - previous) / previous) * 100;
    final sign = delta >= 0 ? '+' : '';
    return '$sign${delta.toStringAsFixed(1).replaceAll('.', ',')}%';
  }

  static String _signedIntLabel(int? previous, int? current) {
    if (previous == null || current == null) return '-';
    final delta = current - previous;
    return _signedIntegerValue(delta);
  }

  static String _signedMoneyCompactLabel(double? previous, double? current) {
    if (previous == null || current == null) return '-';
    final delta = current - previous;
    if (delta == 0) return 'R\$ 0,00';
    final sign = delta > 0 ? '+' : '-';
    return '$sign${_moneyCompact(delta.abs())}';
  }

  static String _plainHistoricalSummary(String value) {
    final text = _safe(value, fallback: '');
    if (text.isEmpty || text == '-') {
      return 'A série anual foi organizada para separar valores consolidados, exercício atual e anos ainda sem valor carregado.';
    }
    return text
        .replaceAll('comparação', 'comparativo')
        .replaceAll('parâmetros regulatórios', 'regras aplicáveis')
        .replaceAll('condicionalidades', 'exigências')
        .replaceAll('evidência', 'indício');
  }

  static pw.Widget _table({
    required List<String> headers,
    required List<List<String>> rows,
    required Map<int, pw.TableColumnWidth> widths,
    Set<int> rightAlignedColumns = const <int>{},
  }) {
    final resolvedRightColumns = <int>{
      ..._inferRightAlignedColumns(headers, rows),
      ...rightAlignedColumns,
    };
    final cellAlignments = <int, pw.AlignmentGeometry>{};
    final headerAlignments = <int, pw.AlignmentGeometry>{};
    for (final columnIndex in resolvedRightColumns) {
      cellAlignments[columnIndex] = pw.Alignment.centerRight;
      headerAlignments[columnIndex] = pw.Alignment.centerRight;
    }
    return pw.TableHelper.fromTextArray(
      headers: headers.map((item) => _safe(item, fallback: '')).toList(),
      data: rows
          .map((row) => row.map((cell) => _safe(cell, fallback: '')).toList())
          .toList(),
      columnWidths: widths,
      headerStyle: pw.TextStyle(
        color: _white,
        fontSize: 7,
        fontWeight: pw.FontWeight.bold,
      ),
      headerDecoration: const pw.BoxDecoration(color: _navy),
      headerHeight: 24,
      cellStyle: const pw.TextStyle(color: _text, fontSize: 7.6),
      rowDecoration: const pw.BoxDecoration(color: _white),
      oddRowDecoration: const pw.BoxDecoration(
        color: PdfColor.fromInt(0xFFFBFDFF),
      ),
      cellPadding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      border: const pw.TableBorder(
        top: pw.BorderSide(color: PdfColor.fromInt(0xFFE5EAF2), width: 0.6),
        bottom: pw.BorderSide(color: PdfColor.fromInt(0xFFE5EAF2), width: 0.6),
        horizontalInside: pw.BorderSide(
          color: PdfColor.fromInt(0xFFE5EAF2),
          width: 0.45,
        ),
        verticalInside: pw.BorderSide(
          color: PdfColor.fromInt(0xFFF0F3F8),
          width: 0.35,
        ),
      ),
      cellAlignment: pw.Alignment.centerLeft,
      headerAlignment: pw.Alignment.centerLeft,
      cellAlignments: cellAlignments,
      headerAlignments: headerAlignments,
    );
  }

  static pw.Widget _mutedText(String text) {
    return pw.Text(
      _safe(text, fallback: ''),
      style: const pw.TextStyle(color: _muted, fontSize: 7),
    );
  }

  static Set<int> _inferRightAlignedColumns(
    List<String> headers,
    List<List<String>> rows,
  ) {
    final aligned = <int>{};
    for (var columnIndex = 0; columnIndex < headers.length; columnIndex++) {
      final header = _safe(headers[columnIndex], fallback: '').toLowerCase();
      final cells = rows
          .where((row) => columnIndex < row.length)
          .map((row) => _safe(row[columnIndex], fallback: ''))
          .where((cell) => cell.isNotEmpty && cell != '-')
          .toList();
      if (_isNumericHeader(header) || _isMostlyNumericColumn(cells)) {
        aligned.add(columnIndex);
      }
    }
    return aligned;
  }

  static bool _isNumericHeader(String header) {
    const numericTokens = <String>[
      'valor',
      'receita',
      'participa',
      'participação',
      'percent',
      '%',
      'total',
      'matric',
      'índice',
      'indice',
      'delta',
      'ganho',
      'codigo',
      'código',
      'ano',
    ];
    return numericTokens.any(header.contains);
  }

  static bool _isMostlyNumericColumn(List<String> cells) {
    if (cells.isEmpty) {
      return false;
    }
    final numericCount = cells.where(_looksNumericLike).length;
    return numericCount / cells.length >= 0.7;
  }

  static bool _looksNumericLike(String value) {
    final normalized = value
        .replaceAll('R\$', '')
        .replaceAll('%', '')
        .replaceAll('.', '')
        .replaceAll(',', '.')
        .replaceAll(' ', '')
        .trim();
    return double.tryParse(normalized) != null;
  }

  static ProjecaoRochaPrime _projection(RelatorioFundeb relatorio) =>
      relatorio.activeProjection;

  static String _municipioLabel(RelatorioFundeb relatorio) {
    final ident = relatorio.identificacao;
    final municipio = _safe(
      ident.municipioNome.isNotEmpty ? ident.municipioNome : ident.municipio,
      fallback: '',
    );
    final uf = _safe(ident.uf, fallback: '');

    if (municipio.isEmpty && uf.isEmpty) {
      return 'Município';
    }
    if (municipio.isEmpty) {
      return uf.isEmpty ? 'Município' : 'Município - $uf';
    }
    if (uf.isEmpty) {
      return municipio;
    }

    final upperMunicipio = municipio.toUpperCase();
    final upperUf = uf.toUpperCase();
    if (upperMunicipio.contains(' - $upperUf') ||
        upperMunicipio.endsWith('/$upperUf')) {
      return municipio;
    }

    return '$municipio - $uf';
  }

  static String _safe(String? value, {String fallback = '-'}) {
    final normalized = _sanitizeReportLanguage(
      _normalizeRawText(value ?? ''),
    ).trim();
    if (normalized.isEmpty) return fallback;

    final lower = normalized.toLowerCase();
    const placeholderValues = {
      'undefined',
      'null',
      'nan',
      '-',
      'uf',
      'undefined/uf',
      'undefined - uf',
      'null/uf',
      'null - uf',
    };
    if (placeholderValues.contains(lower)) return fallback;
    if (lower.contains('undefined')) return fallback;
    if (lower.contains('null')) return fallback;
    if (RegExp(r'\bnan\b').hasMatch(lower)) return fallback;
    return normalized;
  }

  static String _paramText(
    RelatorioFundeb relatorio,
    String key, {
    String fallback = '',
  }) {
    final value = relatorio.parametros[key];
    if (value == null) return fallback;
    return _safe(value.toString(), fallback: fallback);
  }

  static void _appendParamRow(
    List<List<String>> rows,
    RelatorioFundeb relatorio,
    String key,
    String label,
  ) {
    final value = _paramText(relatorio, key);
    if (value.isNotEmpty) {
      rows.add([label, value]);
    }
  }

  static void _appendAdditionalParamRows(
    List<List<String>> rows,
    RelatorioFundeb relatorio,
  ) {
    final fields = relatorio.parametros['camposAdicionais'];
    if (fields is! Map) return;
    var added = 0;
    for (final entry in fields.entries) {
      final label = _safe(entry.key.toString(), fallback: '');
      final value = _safe(entry.value?.toString(), fallback: '');
      if (label.isEmpty || value.isEmpty) continue;
      rows.add([label, value]);
      added += 1;
      if (added >= 8) break;
    }
  }

  static String _money(double value) {
    return _normalizeRawText(
      _brlFormatter.format(value),
    ).replaceAll('\u00A0', ' ');
  }

  static String _signedIntegerValue(int delta) {
    if (delta == 0) return '0';
    final sign = delta > 0 ? '+' : '-';
    return '$sign${_integer(delta.abs())}';
  }

  static String _simplifyVaatStatus(String? value) {
    final normalized = _safe(value, fallback: '-');
    final lower = normalized.toLowerCase();
    if (lower.contains('habilitado')) {
      return 'Habilitado';
    }
    if (lower.contains('nao habilitado') || lower.contains('não habilitado')) {
      return 'Não habilitado';
    }
    return normalized;
  }

  static String _normalizeRawText(String value) {
    var normalized = value;
    try {
      final repaired = utf8.decode(latin1.encode(normalized));
      if (_looksUtf8Repaired(normalized, repaired)) {
        normalized = repaired;
      }
    } catch (_) {}
    return normalized
        .replaceAll('\u00A0', ' ')
        .replaceAll('\u2011', '-')
        .replaceAll('\u2013', '-')
        .replaceAll('\u2014', '-')
        .replaceAll('\uFFFD', '')
        .trim();
  }

  static String _sanitizeReportLanguage(String value) {
    var text = value;
    const replacements = <MapEntry<String, String>>[
      MapEntry(
        'leitura Rocha Prime para decisao comercial e priorizacao tecnica',
        'análise técnica para suporte à tomada de decisão',
      ),
      MapEntry(
        'leitura Rocha Prime para decisão comercial e priorização técnica',
        'análise técnica para suporte à tomada de decisão',
      ),
      MapEntry(
        'peso comercial do municipio na carteira',
        'relevância do município no contexto regional',
      ),
      MapEntry(
        'peso comercial do município na carteira',
        'relevância do município no contexto regional',
      ),
      MapEntry(
        'Metodo principal: Benchmark comercial calibrado',
        'Metodologia: análise comparativa baseada em dados oficiais',
      ),
      MapEntry(
        'Método principal: Benchmark comercial calibrado',
        'Metodologia: análise comparativa baseada em dados oficiais',
      ),
      MapEntry(
        'projecao comercial historica do levantamento Rocha Prime',
        'projeção técnica elaborada com base em dados oficiais e parâmetros regulatórios vigentes',
      ),
      MapEntry(
        'projecao comercial historica do levantamento Rocha Prime',
        'projeção técnica elaborada com base em dados oficiais e parâmetros regulatórios vigentes',
      ),
      MapEntry(
        'metodologia comercial calibrada',
        'metodologia de análise comparativa',
      ),
      MapEntry('headline principal', 'projeção técnica principal'),
      MapEntry('headline do levantamento', 'projeção técnica do levantamento'),
      MapEntry('camada secundaria', 'referencia adicional'),
      MapEntry('camada secundária', 'referencia adicional'),
      MapEntry('sync-base-interna', ''),
      MapEntry('base_interna', ''),
      MapEntry('bloqueado', ''),
      MapEntry('rodada de pesquisa dirigida', ''),
      MapEntry('revisao humana', ''),
      MapEntry('revisão humana', ''),
      MapEntry('estrategia comercial', ''),
      MapEntry('estratégia comercial', ''),
      MapEntry('recorte comercial', ''),
      MapEntry(
        'quebrar a sensação de que o município já está bem o suficiente',
        '',
      ),
      MapEntry(
        'quebrar a sensacao de que o municipio ja esta bem o suficiente',
        '',
      ),
      MapEntry('clculo', 'calculo'),
      MapEntry('calculo', 'cálculo'),
      MapEntry('Codigo', 'Código'),
      MapEntry('codigo', 'código'),
      MapEntry('Composicao', 'Composição'),
      MapEntry('composicao', 'composição'),
      MapEntry('Complementacao', 'Complementação'),
      MapEntry('complementacao', 'complementação'),
      MapEntry('Uniao', 'União'),
      MapEntry('Exercicio', 'Exercício'),
      MapEntry('exercicio', 'exercício'),
      MapEntry('Municipio', 'Município'),
      MapEntry('municipio', 'município'),
      MapEntry('Relatorio', 'Relatório'),
      MapEntry('relatorio', 'relatório'),
      MapEntry('Analise', 'Análise'),
      MapEntry('analise', 'análise'),
      MapEntry('Tecnica', 'Técnica'),
      MapEntry('tecnica', 'técnica'),
      MapEntry('Decisao', 'Decisão'),
      MapEntry('decisao', 'decisão'),
      MapEntry('Serie', 'Série'),
      MapEntry('serie', 'série'),
      MapEntry('Historica', 'Histórica'),
      MapEntry('historica', 'histórica'),
      MapEntry('Evolucao', 'Evolução'),
      MapEntry('evolucao', 'evolução'),
      MapEntry('Gestao', 'Gestão'),
      MapEntry('gestao', 'gestão'),
      MapEntry('Nao', 'Não'),
      MapEntry('nao', 'não'),
      MapEntry('Indice', 'Índice'),
      MapEntry('indice', 'índice'),
      MapEntry('Eficiencia', 'Eficiência'),
      MapEntry('eficiencia', 'eficiência'),
      MapEntry('Arrecadatoria', 'Arrecadatória'),
      MapEntry('arrecadatoria', 'arrecadatória'),
      MapEntry('Projecao', 'Projeção'),
      MapEntry('projecao', 'projeção'),
      MapEntry('Cenario', 'Cenário'),
      MapEntry('cenario', 'cenário'),
      MapEntry('CENARIO', 'CENÁRIO'),
      MapEntry('Variacao', 'Variação'),
      MapEntry('variacao', 'variação'),
      MapEntry('VARIACAO', 'VARIAÇÃO'),
      MapEntry('Matriculas', 'Matrículas'),
      MapEntry('matriculas', 'matrículas'),
      MapEntry('MATRICULAS', 'MATRÍCULAS'),
      MapEntry('Educacao', 'Educação'),
      MapEntry('educacao', 'educação'),
      MapEntry('EDUCACAO', 'EDUCAÇÃO'),
      MapEntry('Contribuicao', 'Contribuição'),
      MapEntry('contribuicao', 'contribuição'),
      MapEntry('CONTRIBUICAO', 'CONTRIBUIÇÃO'),
      MapEntry('Participacao', 'Participação'),
      MapEntry('participacao', 'participação'),
      MapEntry('PARTICIPACAO', 'PARTICIPAÇÃO'),
      MapEntry('Distribuicao', 'Distribuição'),
      MapEntry('distribuicao', 'distribuição'),
      MapEntry('DISTRIBUICAO', 'DISTRIBUIÇÃO'),
      MapEntry('Validacao', 'Validação'),
      MapEntry('validacao', 'validação'),
      MapEntry('VALIDACAO', 'VALIDAÇÃO'),
      MapEntry('Revisao', 'Revisão'),
      MapEntry('revisao', 'revisão'),
      MapEntry('Habilitacao', 'Habilitação'),
      MapEntry('habilitacao', 'habilitação'),
      MapEntry('Pendencias', 'Pendências'),
      MapEntry('pendencias', 'pendências'),
      MapEntry('Atencao', 'Atenção'),
      MapEntry('atencao', 'atenção'),
      MapEntry('Politico', 'Político'),
      MapEntry('politico', 'político'),
      MapEntry('Consolidacao', 'Consolidação'),
      MapEntry('consolidacao', 'consolidação'),
      MapEntry('Padrao', 'Padrão'),
      MapEntry('padrao', 'padrão'),
      MapEntry('Parametros', 'Parâmetros'),
      MapEntry('parametros', 'parâmetros'),
      MapEntry('Condicoes', 'Condições'),
      MapEntry('condicoes', 'condições'),
      MapEntry('Informacoes', 'Informações'),
      MapEntry('informacoes', 'informações'),
      MapEntry('Carater', 'Caráter'),
      MapEntry('carater', 'caráter'),
      MapEntry('regiao', 'região'),
      MapEntry('Regiao', 'Região'),
      MapEntry('relacao', 'relação'),
      MapEntry('Relacao', 'Relação'),
      MapEntry('proxima', 'próxima'),
      MapEntry('Proxima', 'Próxima'),
      MapEntry('proximo', 'próximo'),
      MapEntry('Proximo', 'Próximo'),
      MapEntry('ate', 'até'),
      MapEntry('Ate', 'Até'),
      MapEntry('periodo', 'período'),
      MapEntry('Periodo', 'Período'),
      MapEntry('criterio', 'critério'),
      MapEntry('Criterio', 'Critério'),
      MapEntry('comparavel', 'comparável'),
      MapEntry('Comparavel', 'Comparável'),
      MapEntry('consolidado', 'consolidado'),
      MapEntry('consolidada', 'consolidada'),
      MapEntry('observacoes', 'observações'),
      MapEntry('Observacoes', 'Observações'),
      MapEntry('versao', 'versão'),
      MapEntry('Versao', 'Versão'),
      MapEntry('proximos', 'próximos'),
      MapEntry('Proximos', 'Próximos'),
      MapEntry('sera', 'será'),
      MapEntry('Sera', 'Será'),
      MapEntry('serao', 'serão'),
      MapEntry('Serao', 'Serão'),
      MapEntry('apos', 'após'),
      MapEntry('Apos', 'Após'),
      MapEntry('tambem', 'também'),
      MapEntry('Tambem', 'Também'),
      MapEntry('estavel', 'estável'),
      MapEntry('Estavel', 'Estável'),
      MapEntry('padrao', 'padrão'),
      MapEntry('Padrao', 'Padrão'),
      MapEntry('presenca', 'presença'),
      MapEntry('Presenca', 'Presença'),
      MapEntry('politicas', 'políticas'),
      MapEntry('Politicas', 'Políticas'),
      MapEntry('infancia', 'infância'),
      MapEntry('Infancia', 'Infância'),
      MapEntry('alcanca', 'alcança'),
      MapEntry('Alcanca', 'Alcança'),
      MapEntry('favoravel', 'favorável'),
      MapEntry('Favoravel', 'Favorável'),
      MapEntry('evidencia', 'evidência'),
      MapEntry('Evidencia', 'Evidência'),
      MapEntry('evidênciados', 'evidenciados'),
      MapEntry('Evidênciados', 'Evidenciados'),
      MapEntry('retracao', 'retração'),
      MapEntry('Retracao', 'Retração'),
      MapEntry('disponivel', 'disponível'),
      MapEntry('Disponivel', 'Disponível'),
      MapEntry('tomada de decisao', 'tomada de decisão'),
      MapEntry('publica', 'pública'),
      MapEntry('Publica', 'Pública'),
      MapEntry('publicas', 'públicas'),
      MapEntry('Publicas', 'Públicas'),
      MapEntry('AUTOMATICO', 'AUTOMÁTICO'),
      MapEntry('Automatico', 'Automático'),
      MapEntry('Pocoes', 'Poções'),
      MapEntry('Vitoria da Conquista', 'Vitória da Conquista'),
    ];
    for (final replacement in replacements) {
      text = text.replaceAll(replacement.key, replacement.value);
    }
    text = text.replaceAll(RegExp(r'\s{2,}'), ' ').replaceAll('..', '.').trim();
    return text;
  }

  static bool _looksUtf8Repaired(String original, String repaired) {
    const brokenMarkers = ['Ã', 'â', ''];
    final originalLooksBroken = brokenMarkers.any(original.contains);
    final repairedLooksCleaner = !brokenMarkers.any(repaired.contains);
    return originalLooksBroken && repairedLooksCleaner;
  }

  static int? _officialPopulation(
    RelatorioFundeb relatorio,
    RelatorioDirigidoMunicipio? report,
    IbgeMunicipioPerfil? ibge,
  ) {
    final ibgeEstimated = ibge?.populacaoEstimada;
    if (ibgeEstimated != null && ibgeEstimated > 0) {
      return ibgeEstimated;
    }
    final directedPopulation = report?.perfilMunicipio?.populacao;
    if (directedPopulation != null && directedPopulation > 0) {
      return directedPopulation;
    }
    final profilePopulation = relatorio.perfilComercial?.populacaoEstimada;
    if (profilePopulation != null && profilePopulation > 0) {
      return profilePopulation;
    }
    return null;
  }

  static List<List<String>> _ibgeLiteRows(IbgeMunicipioPerfil ibge) {
    return [
      [
        'Area territorial',
        '${_numberNullable(ibge.areaTerritorial)} km2${_yearSuffix(ibge.areaAnoReferencia)}',
      ],
      [
        'Ultimo censo',
        '${_integerNullable(ibge.populacaoUltimoCenso)} pessoas${_yearSuffix(ibge.populacaoUltimoCensoAnoReferencia)}',
      ],
      [
        'Densidade',
        '${_numberNullable(ibge.densidadeDemografica)} hab/km2${_yearSuffix(ibge.densidadeAnoReferencia)}',
      ],
      [
        'Pop. estimada',
        '${_integerNullable(ibge.populacaoEstimada)} pessoas${_yearSuffix(ibge.populacaoEstimadaAnoReferencia)}',
      ],
      [
        'Escolarizacao 6-14',
        '${_numberNullable(ibge.escolarizacao614)}%${_yearSuffix(ibge.escolarizacaoAnoReferencia)}',
      ],
      [
        'IDHM',
        '${_numberNullable(ibge.idhm, digits: 3)}${_yearSuffix(ibge.idhmAnoReferencia)}',
      ],
      [
        'Mortalidade infantil',
        '${_numberNullable(ibge.mortalidadeInfantil)} por mil${_yearSuffix(ibge.mortalidadeAnoReferencia)}',
      ],
      [
        'Receitas brutas',
        '${_moneyNullable(ibge.receitasBrutasRealizadas)}${_yearSuffix(ibge.receitasAnoReferencia)}',
      ],
      [
        'Despesas empenhadas',
        '${_moneyNullable(ibge.despesasBrutasEmpenhadas)}${_yearSuffix(ibge.despesasAnoReferencia)}',
      ],
      [
        'PIB per capita',
        '${_moneyNullable(ibge.pibPerCapita)}${_yearSuffix(ibge.pibAnoReferencia)}',
      ],
    ];
  }

  static String _numberNullable(double? value, {int digits = 2}) =>
      value == null ? '-' : _number(value, digits: digits);

  static String _yearSuffix(String? year) {
    final normalized = _safe(year, fallback: '');
    return normalized.isEmpty || normalized == '-' ? '' : ' [$normalized]';
  }

  static String _percent(double value) =>
      '${value.toStringAsFixed(1).replaceAll('.', ',')}%';

  static String _part(double value, double total) =>
      total <= 0 ? '-' : _percent((value / total) * 100);

  static String _integer(int value) => value.toString().replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (match) => '.',
  );

  static String _integerNullable(int? value) =>
      value == null ? '-' : _integer(value);

  /// Formats a double as "13.249,09" using only ASCII-safe characters.
  static String _integerFromDouble(double value) {
    final parts = value.toStringAsFixed(2).split('.');
    final intPart = parts[0].replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'),
      (match) => '.',
    );
    return '$intPart,${parts[1]}';
  }

  static String _number(double value, {int digits = 2}) =>
      value.toStringAsFixed(digits).replaceAll('.', ',');

  static String _nullableNumber(double? value) =>
      value == null ? '-' : value.toStringAsFixed(1).replaceAll('.', ',');

  static String _crop(String value, int maxLength) {
    final normalized = _safe(value, fallback: '');
    return normalized.length <= maxLength
        ? normalized
        : '${normalized.substring(0, maxLength - 3).trim()}...';
  }

  static String _safeRatio(int? part, int? total) {
    if (part == null || total == null || total <= 0) return '-';
    return _percent((part / total) * 100);
  }

  static List<List<String>> _tempoIntegralRows(RelatorioFundeb relatorio) {
    final censo = relatorio.censoEscolar;
    if (censo == null) return const <List<String>>[];
    final etapas = censo.matriculasEtapa;
    final detalhadas = censo.matriculasDetalhadas;
    final tempo = censo.tempoIntegral;
    final specs = <({String label, int? integral, int? total})>[
      (
        label: 'Rede pública total',
        integral: tempo.total,
        total: censo.totalMatriculas,
      ),
      (
        label: 'Educação Infantil',
        integral: tempo.educacaoInfantil,
        total: etapas.educacaoInfantil,
      ),
      (label: 'Creche', integral: tempo.creche, total: detalhadas.creche),
      (
        label: 'Pré-escola',
        integral: tempo.preEscola,
        total: detalhadas.preEscola,
      ),
      (
        label: 'Ensino Fundamental',
        integral: tempo.ensinoFundamental,
        total: etapas.ensinoFundamental,
      ),
      (
        label: 'Anos iniciais',
        integral: tempo.anosIniciais,
        total: detalhadas.anosIniciais,
      ),
      (
        label: 'Anos finais',
        integral: (tempo.anosFinais == null || tempo.anosFinais == 0)
            ? tempo.anosFinaisPublica
            : tempo.anosFinais,
        total: detalhadas.anosFinais > 0
            ? detalhadas.anosFinais
            : detalhadas.anosFinaisPublica,
      ),
      (
        label: 'Ensino Médio',
        integral: (tempo.ensinoMedio == null || tempo.ensinoMedio == 0)
            ? tempo.ensinoMedioPublica
            : tempo.ensinoMedio,
        total: etapas.ensinoMedio > 0
            ? etapas.ensinoMedio
            : etapas.ensinoMedioPublica,
      ),
      (label: 'EJA', integral: tempo.eja, total: etapas.eja),
      (
        label: 'Educação Especial',
        integral: tempo.educacaoEspecial,
        total: etapas.educacaoEspecial,
      ),
    ];

    return specs
        .where((item) => item.integral != null || (item.total ?? 0) > 0)
        .map(
          (item) => [
            item.label,
            _integerNullable(item.integral),
            _integerNullable(item.total),
            _safeRatio(item.integral, item.total),
          ],
        )
        .toList();
  }

  // ──────────────────────────────────────────────────────
  // v2.0 pages
  // ──────────────────────────────────────────────────────

  static List<pw.Widget> _buildSaudeFiscalPage(
    RelatorioDirigidoMunicipio report,
  ) {
    final sf = report.saudeFiscal;
    if (sf == null || !sf.disponivel) {
      return const <pw.Widget>[];
    }

    PdfColor statusColor;
    switch (sf.situacaoLrf?.toLowerCase() ?? '') {
      case 'verde':
      case 'ok':
      case 'abaixo do limite de alerta':
        statusColor = _green;
        break;
      case 'amarelo':
      case 'alerta':
      case 'acima do limite de alerta':
        statusColor = _orange;
        break;
      default:
        statusColor = const PdfColor.fromInt(0xFFDC2626);
    }

    return [
      _pageTitle('SAÚDE FISCAL'),
      pw.SizedBox(height: 10),
      _sectionHeading('§', 'Saúde Fiscal do Município'),
      pw.SizedBox(height: 8),
      pw.Container(
        padding: const pw.EdgeInsets.all(14),
        decoration: pw.BoxDecoration(
          color: _white,
          border: pw.Border.all(color: statusColor, width: 1.2),
          borderRadius: pw.BorderRadius.circular(10),
        ),
        child: pw.Row(
          children: [
            pw.Container(
              width: 10,
              height: 10,
              decoration: pw.BoxDecoration(
                color: statusColor,
                shape: pw.BoxShape.circle,
              ),
            ),
            pw.SizedBox(width: 10),
            pw.Text(
              'Status LRF: ${sf.situacaoLrf ?? 'Não informado'}',
              style: pw.TextStyle(
                color: statusColor,
                fontSize: 10,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
      pw.SizedBox(height: 10),
      _table(
        headers: const ['Indicador', 'Valor'],
        rows: [
          ['Receita Corrente Líquida (RCL)', _moneyNullable(sf.rcl)],
          ['RCL Ajustada', _moneyNullable(sf.rclAjustada)],
          ['Despesa com Pessoal', _moneyNullable(sf.despesaPessoalTotal)],
          [
            '% Despesa Pessoal / RCL',
            sf.percentualDespesaPessoal == null
                ? '-'
                : '${sf.percentualDespesaPessoal!.toStringAsFixed(2)}%',
          ],
          [
            'Limite Máximo LRF (54%)',
            sf.limiteMaximoPessoal == null
                ? '-'
                : '${sf.limiteMaximoPessoal!.toStringAsFixed(2)}%',
          ],
          [
            'Limite Prudencial LRF (51,3%)',
            sf.limitePrudencialPessoal == null
                ? '-'
                : '${sf.limitePrudencialPessoal!.toStringAsFixed(2)}%',
          ],
          [
            'Espaço Fiscal',
            sf.espacoFiscalPessoal == null
                ? '-'
                : '${sf.espacoFiscalPessoal!.toStringAsFixed(2)}%',
          ],
          ['Caixa e Equivalentes', _moneyNullable(sf.caixaEquivalentes)],
          ['Patrimônio Líquido', _moneyNullable(sf.patrimonioLiquido)],
        ],
        widths: const {0: pw.FlexColumnWidth(55), 1: pw.FlexColumnWidth(45)},
      ),
    ];
  }

  static List<pw.Widget> _buildObrasPAC2Section(RelatorioFundeb relatorio) {
    if (relatorio.obrasPAC2.isEmpty) return const <pw.Widget>[];
    return [
      pw.SizedBox(height: 8),
      _sectionHeading('7.1', 'Obras PAC2 / Pacto de Retomada'),
      pw.SizedBox(height: 10),
      _table(
        headers: const [
          'Tipo',
          'Aprovadas',
          'Em Execução',
          'Canceladas',
          'Concluídas',
          'Total',
        ],
        rows: relatorio.obrasPAC2
            .map(
              (item) => [
                _safe(item.tipo),
                _integerNullable(item.aprovadas),
                _integerNullable(item.execucao),
                _integerNullable(item.canceladas),
                _integerNullable(item.concluidas),
                _integerNullable(item.total),
              ],
            )
            .toList(),
        widths: const {
          0: pw.FlexColumnWidth(30),
          1: pw.FlexColumnWidth(14),
          2: pw.FlexColumnWidth(14),
          3: pw.FlexColumnWidth(14),
          4: pw.FlexColumnWidth(14),
          5: pw.FlexColumnWidth(14),
        },
      ),
    ];
  }

  static List<pw.Widget> _buildCaminhoEscolaSection(RelatorioFundeb relatorio) {
    if (relatorio.caminhoEscola.isEmpty) return const <pw.Widget>[];
    return [
      pw.SizedBox(height: 8),
      _sectionHeading('7.2', 'Frota Caminho da Escola'),
      pw.SizedBox(height: 10),
      _table(
        headers: const ['Tipo', 'Quantidade', 'Valor (R\$)'],
        rows: relatorio.caminhoEscola
            .map(
              (item) => [
                _safe(item.tipo),
                _integerNullable(item.quantidade),
                _moneyNullable(item.valor),
              ],
            )
            .toList(),
        widths: const {
          0: pw.FlexColumnWidth(40),
          1: pw.FlexColumnWidth(25),
          2: pw.FlexColumnWidth(35),
        },
      ),
    ];
  }

  static List<pw.Widget> _buildCenarioEstruturacaoPage(
    RelatorioDirigidoMunicipio report,
  ) {
    final ce = report.cenarioEstruturacao;
    if (ce == null) return const <pw.Widget>[];

    return [
      _pageTitle('CENÁRIO DE ESTRUTURAÇÃO'),
      pw.SizedBox(height: 10),
      _sectionHeading('CE', 'Cenário de Estruturação ${ce.anoAlvo}'),
      pw.SizedBox(height: 8),
      _table(
        headers: const [
          'Modalidade',
          'Base Atual',
          'Meta',
          'Ganho de Matrículas',
        ],
        rows: [
          [
            'EJA',
            _integerNullable(ce.baseAtual?.eja),
            _integerNullable(ce.metas?.eja),
            _integerNullable(ce.ganhosMatriculas?.eja),
          ],
          [
            'Tempo Integral',
            _integerNullable(ce.baseAtual?.integral),
            _integerNullable(ce.metas?.integral),
            _integerNullable(ce.ganhosMatriculas?.integral),
          ],
          [
            'Ed. Especial',
            _integerNullable(ce.baseAtual?.educacaoEspecial),
            _integerNullable(ce.metas?.educacaoEspecial),
            _integerNullable(ce.ganhosMatriculas?.educacaoEspecial),
          ],
          [
            'TOTAL',
            _integer(
              ce.baseAtual.eja +
                  ce.baseAtual.integral +
                  ce.baseAtual.educacaoEspecial,
            ),
            _integer(
              ce.metas.eja + ce.metas.integral + ce.metas.educacaoEspecial,
            ),
            _integerNullable(ce.ganhosMatriculas.total),
          ],
        ],
        widths: const {
          0: pw.FlexColumnWidth(28),
          1: pw.FlexColumnWidth(24),
          2: pw.FlexColumnWidth(24),
          3: pw.FlexColumnWidth(24),
        },
      ),
      pw.SizedBox(height: 10),
      _highlightBox(
        'IMPACTO FINANCEIRO INDICATIVO',
        '${_moneyNullable(ce.impactoFinanceiroIndicativo?.minimo)} — ${_moneyNullable(ce.impactoFinanceiroIndicativo?.maximo)}',
        ce.impactoFinanceiroIndicativo?.basePorMatricula == null
            ? 'Faixa estimada de impacto anual'
            : 'Base: ${_moneyNullable(ce.impactoFinanceiroIndicativo?.basePorMatricula)} por matrícula',
      ),
      if (ce.leituraExecutiva != null && ce.leituraExecutiva!.isNotEmpty) ...[
        pw.SizedBox(height: 10),
        _callout(
          ce.leituraExecutiva!,
          title: 'Leitura executiva',
          accent: _blue,
          background: _softBlue,
        ),
      ],
      if (ce.frentes != null && ce.frentes!.isNotEmpty) ...[
        pw.SizedBox(height: 10),
        _bulletBox('Frentes de atuação', ce.frentes!),
      ],
    ];
  }

  static List<pw.Widget> _buildPerfilIBGEGrid(
    RelatorioDirigidoMunicipio report,
  ) {
    final perfil = report.perfilIBGE;
    if (perfil == null || !perfil.disponivel) return const <pw.Widget>[];

    // Build a dynamic list of available metric cards — skip indicators without data
    final cards = <pw.Widget>[];

    // 1. População (always present if perfil is disponivel)
    cards.add(
      _metricCard(
        'POPULAÇÃO',
        _integerNullable(perfil.populacaoEstimada?.toInt()),
        perfil.populacaoAnoReferencia != null
            ? 'Estimativa ${perfil.populacaoAnoReferencia}'
            : null,
        background: _softBlue,
      ),
    );

    // 2. PIB per capita
    if (perfil.pibPerCapita != null) {
      cards.add(
        _metricCard(
          'PIB PER CAPITA',
          _moneyNullable(perfil.pibPerCapita),
          perfil.pibAnoReferencia != null
              ? 'Ref. ${perfil.pibAnoReferencia}'
              : null,
          background: _softGreen,
        ),
      );
    }

    // 3. Área territorial
    if (perfil.areaTerritorial != null) {
      cards.add(
        _metricCard(
          'ÁREA TERRITORIAL',
          '${perfil.areaTerritorial!.toStringAsFixed(1)} km²',
          null,
          background: _softBlue,
        ),
      );
    }

    // 4. Escolarização 6-14
    if (perfil.escolarizacao614 != null) {
      cards.add(
        _metricCard(
          'ESCOLARIZAÇÃO 6-14',
          '${perfil.escolarizacao614!.toStringAsFixed(1)}%',
          null,
          background: _softGreen,
        ),
      );
    }

    if (cards.isEmpty) return const <pw.Widget>[];

    // Arrange cards in rows of 3
    final rows = <pw.Widget>[];
    for (var i = 0; i < cards.length; i += 3) {
      final rowCards = <pw.Widget>[];
      for (var j = i; j < i + 3; j++) {
        if (j > i) rowCards.add(pw.SizedBox(width: 8));
        rowCards.add(
          pw.Expanded(child: j < cards.length ? cards[j] : pw.SizedBox()),
        );
      }
      if (i > 0) rows.add(pw.SizedBox(height: 8));
      rows.add(pw.Row(children: rowCards));
    }

    return [
      pw.SizedBox(height: 8),
      _sectionHeading('5.2', 'Perfil IBGE do Município'),
      pw.SizedBox(height: 8),
      ...rows,
    ];
  }
}

class _LiteSegment {
  const _LiteSegment(this.label, this.value, this.color);

  final String label;
  final double value;
  final PdfColor color;
}

class _AnnualFundebRow {
  const _AnnualFundebRow({
    required this.year,
    required this.status,
    this.schoolBaseYear,
    this.totalReceitasFundeb,
    this.contribuicaoMunicipal,
    this.unionComplementation,
    this.totalEscolas,
    this.totalMatriculasMunicipais,
    this.eja,
    this.tempoIntegral,
    this.educacaoEspecial,
  });

  factory _AnnualFundebRow.fromHistorical(
    RelatorioDirigidoSerieHistoricaAno item,
    String status,
  ) {
    // Only include school data when the census base year matches
    // the row year. Prevents repeating a previous year's numbers.
    final schoolDataValid =
        item.anoBaseCenso == null || item.anoBaseCenso == item.ano;
    final hasAnyCensusData =
        schoolDataValid &&
        (item.totalMatriculasMunicipais != null ||
            item.tempoIntegral != null ||
            item.educacaoEspecial != null ||
            item.eja != null);
    final effectiveStatus =
        !hasAnyCensusData && item.totalReceitasFundeb == null
        ? 'Censo não publicado'
        : status;
    return _AnnualFundebRow(
      year: item.ano,
      status: effectiveStatus,
      schoolBaseYear: schoolDataValid ? item.anoBaseCenso : null,
      totalReceitasFundeb: item.totalReceitasFundeb,
      contribuicaoMunicipal: item.contribuicaoMunicipal,
      unionComplementation: FundebLevantamentoPdfBuilder._unionComplementation(
        item,
      ),
      totalEscolas: schoolDataValid ? item.totalEscolas : null,
      totalMatriculasMunicipais: schoolDataValid
          ? item.totalMatriculasMunicipais
          : null,
      eja: schoolDataValid ? item.eja : null,
      tempoIntegral: schoolDataValid ? item.tempoIntegral : null,
      educacaoEspecial: schoolDataValid ? item.educacaoEspecial : null,
    );
  }

  factory _AnnualFundebRow.fromRelatorio(RelatorioFundeb relatorio) {
    final censo = relatorio.censoEscolar;
    final exercicio = relatorio.identificacao.exercicio;
    // Only attach school data when the censo reference year matches
    // the exercise year. Otherwise school columns would repeat
    // a previous year's numbers in the current-year row.
    final censoMatchesYear = censo != null && censo.anoReferencia == exercicio;
    return _AnnualFundebRow(
      year: exercicio,
      status: 'Levantamento atual',
      schoolBaseYear: censoMatchesYear ? censo.anoReferencia : null,
      totalReceitasFundeb: relatorio.receitas.totalReceitas,
      contribuicaoMunicipal: relatorio.receitas.receitaContribuicaoMunicipal,
      unionComplementation:
          relatorio.receitas.complementacaoVAAF +
          relatorio.receitas.complementacaoVAAT +
          relatorio.receitas.complementacaoVAAR,
      totalEscolas: censoMatchesYear ? censo.totalEscolas : null,
      totalMatriculasMunicipais: censoMatchesYear
          ? censo.totalMatriculas
          : null,
      eja: censoMatchesYear ? censo.matriculasEtapa.eja : null,
      tempoIntegral: censoMatchesYear ? censo.tempoIntegral.total : null,
      educacaoEspecial: censoMatchesYear
          ? censo.matriculasEtapa.educacaoEspecial
          : null,
    );
  }

  factory _AnnualFundebRow.empty(int year) {
    final currentYear = DateTime.now().year;
    final status = year >= currentYear
        ? 'Censo não publicado'
        : 'Sem valor carregado';
    return _AnnualFundebRow(year: year, status: status);
  }

  final int year;
  final String status;
  final int? schoolBaseYear;
  final double? totalReceitasFundeb;
  final double? contribuicaoMunicipal;
  final double? unionComplementation;
  final int? totalEscolas;
  final int? totalMatriculasMunicipais;
  final int? eja;
  final int? tempoIntegral;
  final int? educacaoEspecial;

  bool get hasAnyValue =>
      totalReceitasFundeb != null ||
      contribuicaoMunicipal != null ||
      unionComplementation != null ||
      totalEscolas != null ||
      totalMatriculasMunicipais != null ||
      eja != null ||
      tempoIntegral != null ||
      educacaoEspecial != null;

  String get schoolBaseLabel =>
      schoolBaseYear == null ? '-' : '$schoolBaseYear';
}

class _HistoricalComparison {
  const _HistoricalComparison({
    required this.series,
    required this.current,
    required this.previous,
    required this.currentEducation,
    required this.previousEducation,
  });

  final List<RelatorioDirigidoSerieHistoricaAno> series;
  final RelatorioDirigidoSerieHistoricaAno current;
  final RelatorioDirigidoSerieHistoricaAno? previous;
  final RelatorioDirigidoSerieHistoricaAno? currentEducation;
  final RelatorioDirigidoSerieHistoricaAno? previousEducation;

  String get seriesLabel => series.length <= 1
      ? '${current.ano}'
      : '${series.first.ano} a ${series.last.ano}';

  String get revenueSeriesLabel =>
      previous == null ? '${current.ano}' : '${previous!.ano} x ${current.ano}';

  String get baseSeriesLabel {
    final currentBase = currentEducation?.anoBaseCenso ?? currentEducation?.ano;
    final previousBase =
        previousEducation?.anoBaseCenso ?? previousEducation?.ano;
    if (currentBase == null) {
      return previous == null
          ? '${current.ano}'
          : '${previous!.ano} x ${current.ano}';
    }
    return previousBase == null
        ? '$currentBase'
        : '$previousBase x $currentBase';
  }
}
