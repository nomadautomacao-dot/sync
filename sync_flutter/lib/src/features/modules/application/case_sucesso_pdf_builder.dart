import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import '../../../core/models/case_sucesso_models.dart';

class CaseSucessoPdfBuilder {
  static const PdfColor _navy = PdfColor.fromInt(0xFF0F2747);
  static const PdfColor _blue = PdfColor.fromInt(0xFF1D5FAF);
  static const PdfColor _green = PdfColor.fromInt(0xFF15803D);
  static const PdfColor _red = PdfColor.fromInt(0xFFB91C1C);
  static const PdfColor _orange = PdfColor.fromInt(0xFFE67E22);
  static const PdfColor _text = PdfColor.fromInt(0xFF172033);
  static const PdfColor _muted = PdfColor.fromInt(0xFF677184);
  static const PdfColor _line = PdfColor.fromInt(0xFFD7DFEA);

  static const PdfColor _white = PdfColor.fromInt(0xFFFFFFFF);
  static const PdfColor _softRow = PdfColor.fromInt(0xFFF8FAFC);

  static final NumberFormat _brl = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
  static pw.Font? _font;
  static String? _logoSvg;
  static bool _logoLoaded = false;

  static Future<Uint8List> build(CaseSucessoBundle bundle) async {
    final logo = await _loadLogo();
    final font = await _loadFont();
    final now = DateTime.now();
    final pdf = pw.Document(
      title: 'Case de Sucesso FUNDEB ${bundle.anoBase}-${bundle.anoAtual}',
      author: 'Rocha Prime',
    );

    // Cover page
    pdf.addPage(_coverPage(bundle, font, logo, now));

    // One page per municipality
    for (final m in bundle.municipios) {
      pdf.addPage(pw.MultiPage(
        pageTheme: _theme(font, logo, now),
        build: (_) => _municipioPage(m, bundle),
      ));
    }

    // Closing page
    pdf.addPage(pw.MultiPage(
      pageTheme: _theme(font, logo, now),
      build: (_) => _closingPage(bundle),
    ));

    return pdf.save();
  }

  // ── Cover ──────────────────────────────────────────────────
  static pw.Page _coverPage(CaseSucessoBundle b, pw.Font font, String? logo, DateTime now) {
    final title = b.titulo ?? 'Case de Sucesso Rocha Prime';

    final cities = b.municipios.map((m) => m.nome).join(' | ');

    return pw.Page(
      pageTheme: pw.PageTheme(
        pageFormat: PdfPageFormat.a4,
        margin: pw.EdgeInsets.zero,
        theme: pw.ThemeData.withFont(base: font, bold: font, italic: font, boldItalic: font),
      ),
      build: (_) {
        final w = PdfPageFormat.a4.width;
        final lw = w * 0.62;
        return pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
          pw.Container(
            width: lw,
            color: const PdfColor.fromInt(0xFFF7FAFE),
            padding: const pw.EdgeInsets.fromLTRB(40, 44, 28, 28),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                  pw.Row(children: [
                    if (logo != null)
                      pw.Container(
                        width: 54, height: 30,
                        child: pw.SvgImage(svg: logo, fit: pw.BoxFit.contain),
                      )
                    else
                      pw.Text('RP', style: pw.TextStyle(color: _navy, fontSize: 18, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(width: 12),
                    pw.Text('APRESENTAÇÃO EXECUTIVA', style: pw.TextStyle(color: _navy, fontSize: 8.5, fontWeight: pw.FontWeight.bold)),
                  ]),
                  pw.SizedBox(height: 34),
                  pw.Text(title, style: pw.TextStyle(color: _navy, fontSize: 25, fontWeight: pw.FontWeight.bold, lineSpacing: 2)),
                  pw.SizedBox(height: 14),
                  pw.Text(
                    '${b.municipios.length} cidades analisadas. Estratégia: reorganizar base, qualificar Censo/FUNDEB e ampliar a injeção de recursos na educação.',
                    style: const pw.TextStyle(color: _text, fontSize: 10, lineSpacing: 2),
                  ),
                ]),
                pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                  pw.Container(
                    padding: const pw.EdgeInsets.all(16),
                    decoration: pw.BoxDecoration(color: const PdfColor.fromInt(0xFFF0F4FA), borderRadius: pw.BorderRadius.circular(14)),
                    child: pw.Column(children: [
                      pw.Row(children: [
                        pw.Expanded(child: _accentMetricCard('COMPLEMENTAÇÃO CAPTURADA EM ${b.anoAtual}', _moneyCompact(b.totalComplementacao(b.anoAtual)), 'Ganho agregado de ${b.anoBase} para ${b.anoAtual} nas ${b.municipios.length} cidades.', accent: _orange)),
                        pw.SizedBox(width: 12),
                        pw.Expanded(child: _accentMetricCard('RECEITA FUNDEB AMPLIADA', _moneyCompact(b.totalReceitas(b.anoAtual)), 'Variação agregada da receita total do FUNDEB de ${b.anoBase} para ${b.anoAtual}.', accent: _green)),
                      ]),
                    ]),
                  ),
                  pw.SizedBox(height: 10),
                  pw.Container(height: 1, color: _line),
                  pw.SizedBox(height: 6),
                  pw.Text('Fontes: INEP ${b.anoBase}/${b.anoAtual}, Portarias FUNDEB ${b.anoBase}-${b.anoAtual} e documentos contratuais anexados.', style: const pw.TextStyle(color: _muted, fontSize: 6.8)),
                ]),
              ],
            ),
          ),
          pw.Expanded(
            child: pw.Container(
              color: _navy,
              padding: const pw.EdgeInsets.fromLTRB(26, 48, 26, 32),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                    pw.Text('PORTFÓLIO BAHIA | ${b.anoBase}-${b.anoAtual}', style: pw.TextStyle(color: _white, fontSize: 8, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 22),
                    pw.Text('${b.municipios.length} cidades', style: pw.TextStyle(color: _white, fontSize: 32, fontWeight: pw.FontWeight.bold, lineSpacing: 6)),
                    pw.Text('1 tese', style: pw.TextStyle(color: _white, fontSize: 32, fontWeight: pw.FontWeight.bold, lineSpacing: 6)),
                    pw.Text('resultado', style: pw.TextStyle(color: _white, fontSize: 32, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 18),
                    pw.Text(
                      'A Rocha Prime atuou sobre base, governança, monitoramento e leitura técnica do FUNDEB. Serra do Ramalho entra como município principal e perspectiva de escala financeira do case.',
                      style: const pw.TextStyle(color: PdfColor.fromInt(0xFFD8E2F2), fontSize: 9, lineSpacing: 2),
                    ),
                    pw.SizedBox(height: 14),
                    pw.Container(
                      padding: const pw.EdgeInsets.all(14),
                      decoration: pw.BoxDecoration(color: const PdfColor.fromInt(0xFF1A3058), borderRadius: pw.BorderRadius.circular(10)),
                      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                        pw.Text('NÚCLEO DO CASE', style: pw.TextStyle(color: _white, fontSize: 7, fontWeight: pw.FontWeight.bold)),
                        pw.SizedBox(height: 6),
                        pw.Text('${b.anoBase - 1}: base do problema. ${b.anoBase}: atuação Rocha Prime. ${b.anoAtual}: efeito financeiro oficial capturado nas portarias do fundo.', style: const pw.TextStyle(color: PdfColor.fromInt(0xFFD8E2F2), fontSize: 8, lineSpacing: 1.5)),
                      ]),
                    ),
                  ]),
                  pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                    pw.Container(
                      padding: const pw.EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: pw.BoxDecoration(color: _orange, borderRadius: pw.BorderRadius.circular(12)),
                      child: pw.Text('DOCUMENTO CONFIDENCIAL', style: pw.TextStyle(color: _white, fontSize: 7, fontWeight: pw.FontWeight.bold)),
                    ),
                    pw.SizedBox(height: 14),
                    pw.Text('Cidades analisadas', style: const pw.TextStyle(color: _muted, fontSize: 7)),
                    pw.SizedBox(height: 4),
                    pw.Text(cities, style: pw.TextStyle(color: _white, fontSize: 8.5, fontWeight: pw.FontWeight.bold)),
                  ]),
                ],
              ),
            ),
          ),
        ]);
      },
    );
  }

  // ── Municipality detail page ────────────────────────────────
  static List<pw.Widget> _municipioPage(CaseSucessoMunicipio m, CaseSucessoBundle b) {
    final deltas = b.deltasForMunicipio(m);
    final anos = m.sortedYears;
    final widgets = <pw.Widget>[
      pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Text('${m.nome} | Município ${b.municipios.indexOf(m) == 0 ? "principal do case" : "do case"}', style: pw.TextStyle(color: _navy, fontSize: 20, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 4),
          pw.Text('Base ${b.anoBase - 1}, atuação em ${b.anoBase} e efeito financeiro oficial em ${b.anoAtual}.', style: const pw.TextStyle(color: _muted, fontSize: 8.5)),
        ])),
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: pw.BoxDecoration(border: pw.Border.all(color: _blue), borderRadius: pw.BorderRadius.circular(16)),
          child: pw.Text(m.nome.toUpperCase(), style: pw.TextStyle(color: _blue, fontSize: 7, fontWeight: pw.FontWeight.bold)),
        ),
      ]),
      pw.SizedBox(height: 10),
      pw.Container(height: 2, color: _navy),
      pw.SizedBox(height: 20),
    ];

    // Delta cards row with colored left accent bars
    if (deltas.isNotEmpty) {
      final base = m.anoByYear(b.anoBase);
      final atual = m.anoByYear(b.anoAtual);
      if (base != null && atual != null) {
        widgets.add(pw.Row(children: [
          pw.Expanded(child: _accentDeltaCard('EJA ${b.anoBase - 1} -> ${b.anoBase}', _deltaIntLabel(0, 0), '', accent: _red)),
          pw.SizedBox(width: 8),
          pw.Expanded(child: _accentDeltaCard('INTEGRAL ${b.anoBase - 1} -> ${b.anoBase}', _deltaIntLabel(0, 0), '', accent: _green)),
          pw.SizedBox(width: 8),
          pw.Expanded(child: _accentDeltaCard('COMP. ${b.anoBase} -> ${b.anoAtual}', _moneyCompact(atual.totalComplementacao), _pctLabel(base.totalComplementacao, atual.totalComplementacao), accent: _green)),
        ]));
        widgets.add(pw.SizedBox(height: 18));
      }
    }

    // Comparison table
    if (deltas.isNotEmpty) {
      widgets.add(_comparisonTable(deltas, b.anoBase, b.anoAtual));
      widgets.add(pw.SizedBox(height: 14));
    }

    // Timeline + evolution chart side by side
    if (anos.length > 1) {
      widgets.add(pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Expanded(flex: 3, child: pw.Container(
          padding: const pw.EdgeInsets.all(14),
          decoration: pw.BoxDecoration(border: pw.Border.all(color: _line), borderRadius: pw.BorderRadius.circular(10)),
          child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text('Linha do tempo da transformação', style: pw.TextStyle(color: _navy, fontSize: 11, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 4),
            pw.Text('Proposta Técnica Rocha Prime | Reestruturação Censo/FUNDEB', style: const pw.TextStyle(color: _blue, fontSize: 7)),
            pw.SizedBox(height: 10),
            pw.Row(children: [
              for (int i = 0; i < anos.length; i++) ...[
                if (i > 0) pw.SizedBox(width: 6),
                pw.Expanded(child: _timelineCard(m, anos[i], i == 0 ? 'BASE' : i == anos.length - 1 ? 'RESULTADO FINANCEIRO' : 'ATUAÇÃO / CENSO')),
              ],
            ]),
          ]),
        )),
        pw.SizedBox(width: 10),
        pw.Expanded(flex: 2, child: pw.Container(
          padding: const pw.EdgeInsets.all(14),
          decoration: pw.BoxDecoration(border: pw.Border.all(color: _line), borderRadius: pw.BorderRadius.circular(10)),
          child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text('Evolução da complementação da União', style: pw.TextStyle(color: _navy, fontSize: 10, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 12),
            _evolutionChart(m, anos),
            pw.SizedBox(height: 10),
            pw.Text('A leitura financeira oficial foi feita com base nas portarias do FUNDEB ${anos.first} a ${anos.last}.', style: const pw.TextStyle(color: _muted, fontSize: 6.5, lineSpacing: 1.5)),
          ]),
        )),
      ]));
      widgets.add(pw.SizedBox(height: 14));
    }

    // Services
    if (m.servicos.isNotEmpty) {
      widgets.add(pw.Text('Leitura executiva e atuação Rocha Prime', style: pw.TextStyle(color: _navy, fontSize: 10, fontWeight: pw.FontWeight.bold)));
      widgets.add(pw.SizedBox(height: 6));
      for (final s in m.servicos) {
        widgets.add(pw.Padding(
          padding: const pw.EdgeInsets.only(bottom: 3),
          child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text('• ', style: const pw.TextStyle(color: _text, fontSize: 8)),
            pw.Expanded(child: pw.Text(s, style: const pw.TextStyle(color: _text, fontSize: 8, lineSpacing: 1.5))),
          ]),
        ));
      }
    }

    return widgets;
  }

  // ── Closing page ────────────────────────────────────────────
  static List<pw.Widget> _closingPage(CaseSucessoBundle b) {
    final compAtual = b.totalComplementacao(b.anoAtual);
    final cities = b.municipios.map((m) => m.nome).join(', ');
    return [
      pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Text('Mensagem final para apresentação', style: pw.TextStyle(color: _navy, fontSize: 20, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 4),
          pw.Text('O que o superior precisa enxergar em uma única leitura.', style: const pw.TextStyle(color: _muted, fontSize: 8.5)),
        ])),
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: pw.BoxDecoration(border: pw.Border.all(color: _blue), borderRadius: pw.BorderRadius.circular(16)),
          child: pw.Text('FECHAMENTO', style: pw.TextStyle(color: _blue, fontSize: 7, fontWeight: pw.FontWeight.bold)),
        ),
      ]),
      pw.SizedBox(height: 10),
      pw.Container(height: 2, color: _navy),
      pw.SizedBox(height: 18),
      // Hero navy block
      pw.Container(
        padding: const pw.EdgeInsets.all(24),
        decoration: pw.BoxDecoration(color: _navy, borderRadius: pw.BorderRadius.circular(14)),
        child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Expanded(flex: 3, child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text(
              'A Rocha Prime não entregou só consultoria.\nEntregou base mais forte e mais caixa para a educação.',
              style: pw.TextStyle(color: _white, fontSize: 18, fontWeight: pw.FontWeight.bold, lineSpacing: 4),
            ),
            pw.SizedBox(height: 16),
            pw.Text(
              'Nos municípios em que a estratégia ganhou tração, o efeito foi direto: crescimento de EJA, avanço forte de tempo integral e maior captura financeira no FUNDEB ${b.anoAtual}. Onde a base física ainda não acelerou, a governança técnica ajudou a preservar crescimento e estabilidade de receita.',
              style: const pw.TextStyle(color: PdfColor.fromInt(0xFFD8E2F2), fontSize: 9, lineSpacing: 2),
            ),
          ])),
          pw.SizedBox(width: 18),
          pw.Container(
            width: 130,
            padding: const pw.EdgeInsets.all(16),
            decoration: pw.BoxDecoration(color: const PdfColor.fromInt(0xFF2E3F6E), borderRadius: pw.BorderRadius.circular(12)),
            child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Text('PORTFÓLIO ${b.anoAtual}', style: pw.TextStyle(color: _white, fontSize: 7, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 10),
              pw.Text(_moneyCompact(compAtual), style: pw.TextStyle(color: _white, fontSize: 20, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 6),
              pw.Text('de complementação adicional capturada nas ${b.municipios.length} cidades', style: const pw.TextStyle(color: PdfColor.fromInt(0xFFD8E2F2), fontSize: 7, lineSpacing: 1.5)),
            ]),
          ),
        ]),
      ),
      pw.SizedBox(height: 22),
      // "Mensagem que pode abrir a reunião" callout
      pw.Text('Mensagem que pode abrir a reunião', style: pw.TextStyle(color: _navy, fontSize: 11, fontWeight: pw.FontWeight.bold)),
      pw.SizedBox(height: 10),
      pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.all(20),
        decoration: pw.BoxDecoration(color: const PdfColor.fromInt(0xFFF5F8FC), borderRadius: pw.BorderRadius.circular(12)),
        child: pw.Text(
          'Entre ${b.anoBase - 1} e ${b.anoAtual}, mostramos que consultoria boa não é discurso: é matrícula estratégica bem capturada, é base técnica organizada e é recurso novo entrando de forma concreta na educação municipal.',
          style: pw.TextStyle(color: _navy, fontSize: 10, fontWeight: pw.FontWeight.bold, lineSpacing: 2),
        ),
      ),
      pw.SizedBox(height: 22),
      // Sources
      pw.Text('Base metodológica e fontes', style: pw.TextStyle(color: _navy, fontSize: 10, fontWeight: pw.FontWeight.bold)),
      pw.SizedBox(height: 10),
      ...<String>[
        'Censo Escolar INEP ${b.anoBase - 1} e ${b.anoBase} (recorte municipal, base local do projeto).',
        'Portarias oficiais FUNDEB ${b.anoBase - 1}, ${b.anoBase} e ${b.anoAtual} (arquivos locais em /complementacao).',
        'Documentos contratuais anexados pelo usuário para $cities.',
        'Proposta técnica Rocha Prime localizada no diretório de Downloads.',
      ].map((s) => pw.Padding(
        padding: const pw.EdgeInsets.only(bottom: 4),
        child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Text('• ', style: const pw.TextStyle(color: _text, fontSize: 8)),
          pw.Expanded(child: pw.Text(s, style: const pw.TextStyle(color: _text, fontSize: 8, lineSpacing: 1.5))),
        ]),
      )),
    ];
  }

  // ── Reusable widgets ────────────────────────────────────────

  /// Cover metric card with colored left accent bar (like reference design)
  static pw.Widget _accentMetricCard(String label, String value, String helper, {required PdfColor accent}) {
    return pw.Container(
      decoration: pw.BoxDecoration(color: _white, borderRadius: pw.BorderRadius.circular(10)),
      child: pw.Row(children: [
        pw.Container(width: 4, height: 70, decoration: pw.BoxDecoration(color: accent, borderRadius: const pw.BorderRadius.only(topLeft: pw.Radius.circular(10), bottomLeft: pw.Radius.circular(10)))),
        pw.Expanded(child: pw.Padding(
          padding: const pw.EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text(label, style: pw.TextStyle(color: _muted, fontSize: 6.5, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 6),
            pw.Text(value, style: pw.TextStyle(color: _navy, fontSize: 18, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 4),
            pw.Text(helper, style: const pw.TextStyle(color: _muted, fontSize: 6.5, lineSpacing: 1.3)),
          ]),
        )),
      ]),
    );
  }

  /// Delta card for municipality page with colored left accent bar
  static pw.Widget _accentDeltaCard(String label, String value, String pct, {required PdfColor accent}) {
    return pw.Container(
      decoration: pw.BoxDecoration(color: const PdfColor.fromInt(0xFFF8FAFC), borderRadius: pw.BorderRadius.circular(8)),
      child: pw.Row(children: [
        pw.Container(width: 4, height: 65, decoration: pw.BoxDecoration(color: accent, borderRadius: const pw.BorderRadius.only(topLeft: pw.Radius.circular(8), bottomLeft: pw.Radius.circular(8)))),
        pw.Expanded(child: pw.Padding(
          padding: const pw.EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text(label, style: pw.TextStyle(color: _muted, fontSize: 6.5, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 6),
            pw.Text(value, style: pw.TextStyle(color: accent, fontSize: 16, fontWeight: pw.FontWeight.bold)),
            if (pct.isNotEmpty) ...[
              pw.SizedBox(height: 2),
              pw.Text(pct, style: const pw.TextStyle(color: _muted, fontSize: 7)),
            ],
          ]),
        )),
      ]),
    );
  }

  static pw.Widget _timelineCard(CaseSucessoMunicipio m, int year, String role) {
    final a = m.anoByYear(year);
    return pw.Container(
      padding: const pw.EdgeInsets.all(12),
      decoration: pw.BoxDecoration(color: const PdfColor.fromInt(0xFFF5F8FC), borderRadius: pw.BorderRadius.circular(8)),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Text('$year', style: pw.TextStyle(color: _navy, fontSize: 14, fontWeight: pw.FontWeight.bold)),
        pw.Text(role, style: pw.TextStyle(color: _muted, fontSize: 6, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        if (a != null) ...[
          pw.Text('Comp.: ${_moneyCompact(a.totalComplementacao)}', style: const pw.TextStyle(color: _text, fontSize: 7.5)),
          pw.SizedBox(height: 2),
          pw.Text('FUNDEB: ${_moneyCompact(a.totalReceitas)}', style: const pw.TextStyle(color: _text, fontSize: 7.5)),
        ] else
          pw.Text('Portarias oficiais', style: const pw.TextStyle(color: _muted, fontSize: 7.5)),
      ]),
    );
  }

  /// Simple bar chart showing complementation evolution across years
  static pw.Widget _evolutionChart(CaseSucessoMunicipio m, List<int> anos) {
    final values = anos.map((y) => m.anoByYear(y)?.totalComplementacao ?? 0).toList();
    final maxVal = values.fold<double>(0, (a, b) => a > b ? a : b);
    final colors = [const PdfColor.fromInt(0xFFB0C4DE), const PdfColor.fromInt(0xFF6495ED), _green];
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceEvenly,
      crossAxisAlignment: pw.CrossAxisAlignment.end,
      children: [
        for (int i = 0; i < anos.length; i++)
          pw.Column(children: [
            pw.Container(
              width: 36,
              height: maxVal > 0 ? (values[i] / maxVal * 60).clamp(8, 60) : 8,
              decoration: pw.BoxDecoration(color: i < colors.length ? colors[i] : _blue, borderRadius: pw.BorderRadius.circular(4)),
            ),
            pw.SizedBox(height: 4),
            pw.Text('${anos[i]}', style: pw.TextStyle(color: _navy, fontSize: 7, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 2),
            pw.Text('${anos[i]}: ${_moneyCompact(values[i])}', style: const pw.TextStyle(color: _muted, fontSize: 5.5)),
          ]),
      ],
    );
  }

  static String _deltaIntLabel(int before, int after) {
    final diff = after - before;
    return '${diff >= 0 ? "+" : ""}$diff';
  }

  static pw.Widget _comparisonTable(List<CaseSucessoDelta> deltas, int anoBase, int anoAtual) {
    return pw.Table(
      border: null,
      columnWidths: const {0: pw.FlexColumnWidth(1.5), 1: pw.FlexColumnWidth(), 2: pw.FlexColumnWidth(), 3: pw.FlexColumnWidth(0.7)},
      children: [
        pw.TableRow(
          decoration: const pw.BoxDecoration(color: _navy),
          children: ['Indicador', 'Valor $anoBase', 'Valor $anoAtual', 'Variação'].map((h) => pw.Padding(
            padding: const pw.EdgeInsets.all(6),
            child: pw.Text(h, style: pw.TextStyle(color: _white, fontSize: 7.5, fontWeight: pw.FontWeight.bold)),
          )).toList(),
        ),
        ...deltas.asMap().entries.map((e) {
          final d = e.value;
          final bg = e.key.isEven ? _white : _softRow;
          final pctColor = d.isPositive ? _green : _red;
          return pw.TableRow(
            decoration: pw.BoxDecoration(color: bg),
            children: [
              pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text(d.label, style: pw.TextStyle(color: _text, fontSize: 7.5, fontWeight: pw.FontWeight.bold))),
              pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text(_brl.format(d.valorAnterior), style: const pw.TextStyle(color: _text, fontSize: 7.5))),
              pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text(_brl.format(d.valorAtual), style: const pw.TextStyle(color: _text, fontSize: 7.5))),
              pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text(d.percentualFormatted, style: pw.TextStyle(color: pctColor, fontSize: 7.5, fontWeight: pw.FontWeight.bold))),
            ],
          );
        }),
      ],
    );
  }

  // ── Theme / header / footer ─────────────────────────────────
  static pw.PageTheme _theme(pw.Font font, String? logo, DateTime now) {
    return pw.PageTheme(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.fromLTRB(34, 88, 34, 54),
      theme: pw.ThemeData.withFont(base: font, bold: font, italic: font, boldItalic: font),
      buildBackground: (ctx) => pw.FullPage(
        ignoreMargins: true,
        child: pw.Stack(children: [
          pw.Positioned(left: 34, right: 34, top: 24, child: _header(logo)),
          pw.Positioned(left: 34, right: 34, bottom: 18, child: _footer(ctx.pageNumber, now)),
        ]),
      ),
    );
  }

  static pw.Widget _header(String? logo) {
    return pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.center, children: [
      if (logo != null)
        pw.Container(width: 34, height: 22, child: pw.SvgImage(svg: logo, fit: pw.BoxFit.contain))
      else
        pw.Text('RP', style: pw.TextStyle(color: _navy, fontSize: 12, fontWeight: pw.FontWeight.bold)),
      pw.SizedBox(width: 10),
      pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Text('ROCHA PRIME SERVIÇOS ESPECIALIZADOS', style: pw.TextStyle(color: _navy, fontSize: 8.5, fontWeight: pw.FontWeight.bold)),
        pw.Text('Material executivo | Case de sucesso FUNDEB', style: const pw.TextStyle(color: _muted, fontSize: 6.5)),
      ]),
    ]);
  }

  static pw.Widget _footer(int page, DateTime now) {
    final label = DateFormat('dd/MM/yyyy HH:mm', 'pt_BR').format(now);
    return pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
      pw.Text('Fontes: INEP, Portarias FUNDEB e documentos contratuais anexados.', style: const pw.TextStyle(color: _muted, fontSize: 6)),
      pw.Text('$label  |  ${page.toString().padLeft(2, '0')}', style: const pw.TextStyle(color: _muted, fontSize: 6)),
    ]);
  }

  // ── Helpers ─────────────────────────────────────────────────
  static String _moneyCompact(double v) {
    if (v.abs() >= 1e9) return 'R\$ ${(v / 1e9).toStringAsFixed(2)} bi';
    if (v.abs() >= 1e6) return 'R\$ ${(v / 1e6).toStringAsFixed(2)} mi';
    if (v.abs() >= 1e3) return 'R\$ ${(v / 1e3).toStringAsFixed(1)} mil';
    return _brl.format(v);
  }

  static String _pctLabel(double before, double after) {
    if (before == 0) return '-';
    final pct = ((after - before) / before) * 100;
    return '${pct >= 0 ? "+" : ""}${pct.toStringAsFixed(1)}%';
  }

  static Future<pw.Font> _loadFont() async {
    if (_font != null) return _font!;
    try {
      final data = await rootBundle.load('assets/fonts/Inter-Regular.ttf');
      _font = pw.Font.ttf(data);
    } catch (_) {
      _font = pw.Font.helvetica();
    }
    return _font!;
  }

  static Future<String?> _loadLogo() async {
    if (_logoLoaded) return _logoSvg;
    try {
      final raw = await rootBundle.loadString('assets/branding/logo-rocha-prime-institucional.svg');
      _logoSvg = raw.replaceFirst('<rect width="520" height="360" fill="white"/>', '');
    } catch (_) {
      _logoSvg = null;
    }
    _logoLoaded = true;
    return _logoSvg;
  }
}
