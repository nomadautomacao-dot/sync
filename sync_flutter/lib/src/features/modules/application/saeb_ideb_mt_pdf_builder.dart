import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

/// SAEB/IDEB Premium Report Builder — MT municipalities
/// Identidade visual Rocha Prime — padrão Sync
class SaebIdebMtPdfBuilder {
  // ========================= PALETA =========================
  static const PdfColor _navy = PdfColor.fromInt(0xFF0F2747);
  static const PdfColor _blue = PdfColor.fromInt(0xFF1D5FAF);
  static const PdfColor _green = PdfColor.fromInt(0xFF15803D);
  static const PdfColor _orange = PdfColor.fromInt(0xFFE67E22);
  static const PdfColor _red = PdfColor.fromInt(0xFFDC2626);
  static const PdfColor _text = PdfColor.fromInt(0xFF172033);
  static const PdfColor _muted = PdfColor.fromInt(0xFF677184);
  static const PdfColor _line = PdfColor.fromInt(0xFFD7DFEA);
  static const PdfColor _softBlue = PdfColor.fromInt(0xFFEAF3FF);
  static const PdfColor _softGreen = PdfColor.fromInt(0xFFEDF7EF);
  static const PdfColor _softOrange = PdfColor.fromInt(0xFFFFF4E8);
  static const PdfColor _gold = PdfColor.fromInt(0xFFD4A017);
  static const PdfColor _grey600 = PdfColor.fromInt(0xFF6B7280);
  static const PdfColor _grey700 = PdfColor.fromInt(0xFF374151);
  static const PdfColor _white = PdfColor.fromInt(0xFFFFFFFF);

  // Níveis de aprendizagem
  static const PdfColor _lvlMb = PdfColor.fromInt(0xFFDC2626);
  static const PdfColor _lvlBa = PdfColor.fromInt(0xFFF59E0B);
  static const PdfColor _lvlIn = PdfColor.fromInt(0xFF3B82F6);
  static const PdfColor _lvlAd = PdfColor.fromInt(0xFF84CC16);
  static const PdfColor _lvlAv = PdfColor.fromInt(0xFF15803D);

  // ========================= BUILD ALL =========================
  static Future<Uint8List> buildAll({
    required List<Map<String, dynamic>> municipios,
    required String? rochaLogoSvg,
    required pw.Font contentFont,
    required DateTime generatedAt,
    required String estadoNome,
    required String uf,
    required int anoIdeb,
    required int anoSaeb,
    required int anoCenso,
  }) async {
    final pdf = pw.Document(
      title: 'Resultados IDEB + SAEB — $estadoNome ($uf)',
      author: 'Rocha Prime Consultorias',
    );

    pdf.addPage(_buildCoverPage(
      estadoNome: estadoNome,
      uf: uf,
      totalMunicipios: municipios.length,
      anoIdeb: anoIdeb,
      anoSaeb: anoSaeb,
      rochaLogoSvg: rochaLogoSvg,
      contentFont: contentFont,
      generatedAt: generatedAt,
    ));

    for (final mun in municipios) {
      pdf.addPage(
        pw.MultiPage(
          pageTheme: _pageTheme(
            municipioNome: mun['municipio']?.toString() ?? '???',
            uf: uf,
            rochaLogoSvg: rochaLogoSvg,
            contentFont: contentFont,
            generatedAt: generatedAt,
          ),
          build: (ctx) => [_buildMunicipioPage(
            mun: mun,
            uf: uf,
            anoIdeb: anoIdeb,
            anoSaeb: anoSaeb,
            anoCenso: anoCenso,
            contentFont: contentFont,
          )],
        ),
      );
    }

    return pdf.save();
  }

  // ========================= CAPA =========================
  static pw.Page _buildCoverPage({
    required String estadoNome,
    required String uf,
    required int totalMunicipios,
    required int anoIdeb,
    required int anoSaeb,
    String? rochaLogoSvg,
    required pw.Font contentFont,
    required DateTime generatedAt,
  }) {
    return pw.Page(
      pageTheme: pw.PageTheme(
        pageFormat: PdfPageFormat.a4,
        margin: pw.EdgeInsets.zero,
        theme: pw.ThemeData.withFont(base: contentFont, bold: contentFont),
      ),
      build: (ctx) => pw.Container(
        width: PdfPageFormat.a4.width,
        height: PdfPageFormat.a4.height,
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.stretch,
          children: [
            pw.Container(
              height: 54,
              color: _navy,
              padding: const pw.EdgeInsets.symmetric(horizontal: 40, vertical: 12),
              child: pw.Row(
                children: [
                  if (rochaLogoSvg != null)
                    pw.Container(
                      width: 66,
                      height: 30,
                      child: pw.SvgImage(svg: rochaLogoSvg, fit: pw.BoxFit.contain),
                    ),
                  pw.Spacer(),
                  pw.Text(
                    'ROCHA PRIME CONSULTORIAS',
                    style: pw.TextStyle(
                      color: _white,
                      fontSize: 10,
                      fontWeight: pw.FontWeight.bold,
                      letterSpacing: 1.2,
                    ),
                  ),
                ],
              ),
            ),
            pw.Spacer(),
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(horizontal: 50),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Container(
                    padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: pw.BoxDecoration(
                      color: _gold,
                      borderRadius: pw.BorderRadius.circular(4),
                    ),
                    child: pw.Text(
                      'RELATÓRIO EDUCACIONAL CONSOLIDADO',
                      style: pw.TextStyle(
                        color: _white,
                        fontSize: 10,
                        fontWeight: pw.FontWeight.bold,
                        letterSpacing: 1.4,
                      ),
                    ),
                  ),
                  pw.SizedBox(height: 26),
                  pw.Text(
                    estadoNome.toUpperCase(),
                    style: pw.TextStyle(
                      color: _navy,
                      fontSize: 52,
                      fontWeight: pw.FontWeight.bold,
                      letterSpacing: 2.5,
                    ),
                  ),
                  pw.SizedBox(height: 8),
                  pw.Container(height: 3, width: 110, color: _gold),
                  pw.SizedBox(height: 24),
                  pw.Text(
                    'Resultados IDEB $anoIdeb + SAEB $anoSaeb  |  Rede Pública',
                    style: pw.TextStyle(
                      color: _text,
                      fontSize: 15,
                      fontWeight: pw.FontWeight.normal,
                    ),
                  ),
                  pw.SizedBox(height: 6),
                  pw.Text(
                    '$totalMunicipios municípios mapeados',
                    style: const pw.TextStyle(color: PdfColor.fromInt(0xFF677184), fontSize: 13),
                  ),
                ],
              ),
            ),
            pw.Spacer(),
            pw.Container(
              height: 80,
              color: PdfColor.fromInt(0xFFF7FAFE),
              padding: const pw.EdgeInsets.symmetric(horizontal: 50, vertical: 14),
              child: pw.Row(
                children: [
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      mainAxisAlignment: pw.MainAxisAlignment.center,
                      children: [
                        pw.Text(
                          'Fontes oficiais',
                          style: pw.TextStyle(color: _navy, fontSize: 9.5, fontWeight: pw.FontWeight.bold),
                        ),
                        pw.Text(
                          'INEP / MEC  •  FNDE  •  Censo Escolar',
                          style: pw.TextStyle(color: PdfColor.fromInt(0xFF677184), fontSize: 8),
                        ),
                      ],
                    ),
                  ),
                  pw.Container(width: 1, color: _line),
                  pw.SizedBox(width: 16),
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.end,
                      mainAxisAlignment: pw.MainAxisAlignment.center,
                      children: [
                        pw.Text('CNPJ: 29.342.691/0001-93', style: pw.TextStyle(color: PdfColor.fromInt(0xFF172033), fontSize: 8)),
                        pw.Text('Tel: (61) 99866-7834', style: pw.TextStyle(color: PdfColor.fromInt(0xFF677184), fontSize: 8)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ========================= PÁGINA MUNICÍPIO =========================
  static pw.PageTheme _pageTheme({
    required String municipioNome,
    required String uf,
    String? rochaLogoSvg,
    required pw.Font contentFont,
    required DateTime generatedAt,
  }) {
    return pw.PageTheme(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.fromLTRB(34, 84, 34, 48),
      theme: pw.ThemeData.withFont(base: contentFont, bold: contentFont),
      buildBackground: (ctx) => pw.FullPage(
        ignoreMargins: true,
        child: pw.Stack(
          children: [
            pw.Positioned(
              left: 34,
              right: 34,
              top: 22,
              child: _header(municipioNome, uf: uf, rochaLogoSvg: rochaLogoSvg),
            ),
            pw.Positioned(
              left: 34,
              right: 34,
              bottom: 16,
              child: _footer(ctx.pageNumber, ctx.pagesCount, generatedAt: generatedAt),
            ),
          ],
        ),
      ),
    );
  }

  static pw.Widget _buildMunicipioPage({
    required Map<String, dynamic> mun,
    required String uf,
    required int anoIdeb,
    required int anoSaeb,
    required int anoCenso,
    required pw.Font contentFont,
  }) {
    final nome = (mun['municipio']?.toString() ?? '???').toUpperCase();
    final ibge = mun['ibge']?.toString() ?? '';
    final ideb5 = _toDouble(mun['ideb5_$anoIdeb']);
    final ideb9 = _toDouble(mun['ideb9_$anoIdeb']);
    final hist5 = (mun['hist5'] as List? ?? []).cast<Map<String, dynamic>>();
    final hist9 = (mun['hist9'] as List? ?? []).cast<Map<String, dynamic>>();
    final media5LP = _toDouble(mun['media5LP']);
    final media5MT = _toDouble(mun['media5MT']);
    final media9LP = _toDouble(mun['media9LP']);
    final media9MT = _toDouble(mun['media9MT']);
    final escolas = _toInt(mun['escolasPublicas']);
    final matriculas = _toInt(mun['matriculasPublicas']);
    final docentes = _toInt(mun['docentesPublicos']);
    final escolasInternetPct = _toDouble(mun['escolasInternetPct']);
    final lp9Niveis = _toListNum(mun['lp9Niveis']);
    final mt9Niveis = _toListNum(mun['mt9Niveis']);
    final lp5Niveis = _toListNum(mun['lp5Niveis']);
    final mt5Niveis = _toListNum(mun['mt5Niveis']);

    final hasSaeb5 = media5LP != null && media5MT != null;
    final hasSaeb9 = media9LP != null && media9MT != null;

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.stretch,
      children: [
        // === TOP: Título + IBGE ===
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.end,
          children: [
            pw.Text(
             (nome),
            style: pw.TextStyle(color: _navy, fontSize: 18, fontWeight: pw.FontWeight.bold),
            ),
            pw.Spacer(),
            pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
            decoration: pw.BoxDecoration(
              color: _blue,
              borderRadius: pw.BorderRadius.circular(3),
            ),
            child: pw.Text(
              'IBGE $ibge',
              style: pw.TextStyle(color: _white, fontSize: 7.5, fontWeight: pw.FontWeight.bold),
            ),
            ),
          ],
        ),
        pw.SizedBox(height: 2),
        pw.Text(
          'IDEB $anoIdeb  |  SAEB $anoSaeb  |  Censo $anoCenso  |  Rede P\u00fablica ($uf)',
          style: pw.TextStyle(color: _muted, fontSize: 7.5),
        ),
        pw.SizedBox(height: 4),
        pw.Container(height: 0.6, color: _line),
        pw.SizedBox(height: 10),

        // === 4 KPIs ===
        pw.Row(
          children: [
            pw.Expanded(child: _kpiCard(label: 'IDEB Iniciais', valor: ideb5, meta: 6.0, anoRef: anoIdeb)),
            pw.SizedBox(width: 6),
            pw.Expanded(child: _kpiCard(label: 'IDEB Finais', valor: ideb9, meta: 5.0, anoRef: anoIdeb)),
            pw.SizedBox(width: 6),
            pw.Expanded(child: _proficienciaCard(label: 'LP 5', valor: media5LP, anoRef: anoSaeb)),
            pw.SizedBox(width: 6),
            pw.Expanded(child: _proficienciaCard(label: 'MT 5', valor: media5MT, anoRef: anoSaeb)),
          ],
        ),
        pw.SizedBox(height: 12),

        // === SéRE HISTóRICA IDEB (2 linhas) ===
        _sectionTitle('Série Histórica IDEB'),
        pw.SizedBox(height: 5),
        _idebHistoryBlock(hist5: hist5, hist9: hist9, anoIdeb: anoIdeb),

        pw.SizedBox(height: 10),

        // === SAEB (condicional) ===
        if (hasSaeb5 && !hasSaeb9) ...[
          _sectionTitle('SAEB $anoSaeb — 5º ano'),
          pw.SizedBox(height: 5),
          _saebDisciplineBlock(mediaLP: media5LP, mediaMT: media5MT, niveisLP: lp5Niveis, niveisMT: mt5Niveis),
          pw.SizedBox(height: 6),
          _callout(
            'Município não avaliado no 9º ano do SAEB $anoSaeb (amostragem do INEP).',
            accent: _orange,
            background: _softOrange,
          ),
        ] else if (hasSaeb5 && hasSaeb9) ...[
          _sectionTitle('SAEB $anoSaeb — 5º ano'),
          pw.SizedBox(height: 5),
          _saebDisciplineBlock(mediaLP: media5LP, mediaMT: media5MT, niveisLP: lp5Niveis, niveisMT: mt5Niveis),
          pw.SizedBox(height: 10),
          _sectionTitle('SAEB $anoSaeb — 9º ano'),
          pw.SizedBox(height: 5),
          _saebDisciplineBlock(mediaLP: media9LP, mediaMT: media9MT, niveisLP: lp9Niveis, niveisMT: mt9Niveis),
        ] else if (!hasSaeb5 && hasSaeb9) ...[
          _sectionTitle('SAEB $anoSaeb — 9º ano'),
          pw.SizedBox(height: 5),
          _saebDisciplineBlock(mediaLP: media9LP, mediaMT: media9MT, niveisLP: lp9Niveis, niveisMT: mt9Niveis),
          pw.SizedBox(height: 6),
          _callout(
            'Município não avaliado no 5º ano do SAEB $anoSaeb (amostragem do INEP).',
            accent: _orange,
            background: _softOrange,
          ),
        ] else ...[
          _sectionTitle('SAEB'),
          pw.SizedBox(height: 5),
          _callout(
            'Município não avaliado no SAEB $anoSaeb (amostragem abaixo do limiar do INEP).',
            accent: _orange,
            background: _softOrange,
          ),
        ],

        pw.SizedBox(height: 12),

        // === RODAPÉ CENSO ===
        _rodapeCenso(
          escolas: escolas,
          matriculas: matriculas,
          docentes: docentes,
          internetPct: escolasInternetPct,
          anoCenso: anoCenso,
        ),
      ],
    );
  }

  // ========================= COMPONENTES =========================

  static pw.Widget _header(
    String municipio, {
    required String uf,
    String? rochaLogoSvg,
  }) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Row(
          children: [
            if (rochaLogoSvg != null)
          pw.Container(
            width: 52,
            height: 26,
            margin: const pw.EdgeInsets.only(right: 12),
            child: pw.SvgImage(svg: rochaLogoSvg, fit: pw.BoxFit.contain),
          ),
            pw.Expanded(
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(
            'ROCHA PRIME SERVIÇOS ESPECIALIZADOS',
            style: pw.TextStyle(color: _navy, fontSize: 9.8, fontWeight: pw.FontWeight.bold),
              ),
              pw.SizedBox(height: 1.5),
              pw.Text(
            'CNPJ: 29.342.691/0001-93  |  Tel: (61) 99866-7834',
            style: const pw.TextStyle(color: PdfColor.fromInt(0xFF172033), fontSize: 5.2),
              ),
              pw.SizedBox(height: 2.5),
              pw.Text(
            'Diagnóstico Educacional Consolidado — IDEB + SAEB',
            style: pw.TextStyle(color: _navy, fontSize: 8.8, fontWeight: pw.FontWeight.bold),
              ),
              pw.Text(
            '$municipio  |  $uf',
            style: const pw.TextStyle(color: PdfColor.fromInt(0xFF172033), fontSize: 7.6),
              ),
              pw.Text(
            'Fonte: INEP / SAEB / FNDE / Censo Escolar',
            style: const pw.TextStyle(color: PdfColor.fromInt(0xFF677184), fontSize: 5.1),
              ),
            ],
          ),
            ),
            pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
          decoration: pw.BoxDecoration(
            color: _orange,
            borderRadius: pw.BorderRadius.circular(3),
          ),
          child: pw.Text(
            'DOCUMENTO CONFIDENCIAL',
            style: pw.TextStyle(color: PdfColor.fromInt(0xFFFFFFFF), fontSize: 5.1, fontWeight: pw.FontWeight.bold),
          ),
            ),
          ],
        ),
        pw.SizedBox(height: 7),
        pw.Container(height: 1.1, color: _navy),
      ],
    );
  }

  static pw.Widget _footer(
    int pageNumber,
    int pagesCount, {
    required DateTime generatedAt,
  }) {
    return pw.Column(
      children: [
        pw.Container(height: 0.5, color: _line),
        pw.SizedBox(height: 4),
        pw.Row(
          children: [
            pw.Text(
          'Documento confidencial. Reprodução não autorizada.',
          style: const pw.TextStyle(color: PdfColor.fromInt(0xFF677184), fontSize: 5.2, fontStyle: pw.FontStyle.italic),
            ),
            pw.Spacer(),
            pw.Text(
          'Gerado em ${_dateFmt(generatedAt)}',
          style: const pw.TextStyle(color: PdfColor.fromInt(0xFF677184), fontSize: 5.2),
            ),
            pw.SizedBox(width: 10),
          pw.Text(
            'TECNICO RESPONSÁVEL: ADRIEL TAVARES',
            style: pw.TextStyle(color: PdfColor.fromInt(0xFF6B7280), fontSize: 5.2),
          ),
            pw.SizedBox(width: 10),
            pw.Text(
          'Pág. $pageNumber / $pagesCount',
          style: pw.TextStyle(color: _navy, fontSize: 5.6, fontWeight: pw.FontWeight.bold),
            ),
          ],
        ),
      ],
    );
  }

  static pw.Widget _kpiCard({
    required String label,
    required double? valor,
    required double meta,
    required int anoRef,
  }) {
    final abaixo = valor != null && valor < meta;
    final acima = valor != null && valor >= meta;
    final color = abaixo ? _orange : (_green);
    final bg = abaixo ? _softOrange : _softGreen;
    final border = abaixo ? _orange : _green;
    final valorText = valor == null ? '—' : valor.toStringAsFixed(1);

    return pw.Container(
      padding: const pw.EdgeInsets.all(8),
      decoration: pw.BoxDecoration(
        color: bg,
        borderRadius: pw.BorderRadius.circular(6),
        border: pw.Border.all(color: border, width: 0.5),
      ),
      child: pw.Column(
    crossAxisAlignment: pw.CrossAxisAlignment.start,
    children: [
      pw.Text(
        label.toUpperCase(),
     style: pw.TextStyle(color: _grey700, fontSize: 6.8, fontWeight: pw.FontWeight.bold),
      ),
      pw.SizedBox(height: 3),
      pw.Row( crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
       pw.Text(
      valorText,
      style: pw.TextStyle(color: color, fontSize: 19, fontWeight: pw.FontWeight.bold),
       ),
       pw.SizedBox(width: 4),
       pw.Text(anoRef.toString(), style: pw.TextStyle(color: _muted, fontSize: 7, fontWeight: pw.FontWeight.bold)),
      ]),
      pw.SizedBox(height: 3),
      pw.Row(
       children: [
       pw.Text('Meta: ${meta.toStringAsFixed(1)}', style: pw.TextStyle(color: _muted, fontSize: 6)),
          pw.Spacer(),
       if (valor != null)
         pw.Container(
           padding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 1.2),
           decoration: pw.BoxDecoration(
           color: abaixo ? _orange : _green,
         borderRadius: pw.BorderRadius.circular(2.5),
           ),
       child: pw.Text(
         abaixo ? 'ABAIXO' : 'ACIMA',
            style: pw.TextStyle(color: _white, fontSize: 5.8, fontWeight: pw.FontWeight.bold),
          ),
         ),
       ],
      ),
    ],
      ),
    );
  }

  static pw.Widget _proficienciaCard({
    required String label,
    required double? valor,
    required int anoRef,
  }) {
    final valorText = valor == null ? '—' : valor.toStringAsFixed(0);
    return pw.Container(
      padding: const pw.EdgeInsets.all(8),
      decoration: pw.BoxDecoration(
    color: _softBlue,
    borderRadius: pw.BorderRadius.circular(6),
        border: pw.Border.all(color: _blue, width: 0.5),
      ),
      child: pw.Column(
    crossAxisAlignment: pw.CrossAxisAlignment.start,
    children: [
      pw.Text(label.toUpperCase(), style: pw.TextStyle(color: _grey700, fontSize: 6.8, fontWeight: pw.FontWeight.bold)),
      pw.SizedBox(height: 3),
      pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
        pw.Text(valorText, style: pw.TextStyle(color: _blue, fontSize: 19, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(width: 4),
        pw.Text('pts', style: pw.TextStyle(color: PdfColor.fromInt(0xFF677184), fontSize: 7, fontWeight: pw.FontWeight.bold)),
      ]),
      pw.SizedBox(height: 3),
      pw.Text(
        'SAEB $anoRef · 5º ano',
        style: pw.TextStyle(color: _muted, fontSize: 6),
       ),
    ],
      ),
    );
  }

  static pw.Widget _sectionTitle(String title) {
    return pw.Row(
      children: [
    pw.Container(width: 4, height: 11, color: _blue),
        pw.SizedBox(width: 6),
        pw.Text(
          title,
          style: pw.TextStyle(color: _navy, fontSize: 10, fontWeight: pw.FontWeight.bold),
        ),
        pw.Spacer(),
        pw.Container(height: 0.4, width: 40, color: _line),
      ],
    );
  }

  /// Bloco da série histórica IDEB com duas linhas (Iniciais e Finais)
  static pw.Widget _idebHistoryBlock({
    required List<Map<String, dynamic>> hist5,
    required List<Map<String, dynamic>> hist9,
    required int anoIdeb,
  }) {
    final d5 = _filterHist(hist5)..sort((a, b) => (_toInt(a['ano']) ?? 0).compareTo(_toInt(b['ano']) ?? 0));
    final d9 = _filterHist(hist9)..sort((a, b) => (_toInt(a['ano']) ?? 0).compareTo(_toInt(b['ano']) ?? 0));

    return pw.Container(
      padding: const pw.EdgeInsets.all(8),
      decoration: pw.BoxDecoration(
        color: PdfColor.fromInt(0xFFFBFCFE),
        borderRadius: pw.BorderRadius.circular(5),
        border: pw.Border.all(color: _line, width: 0.4),
      ),
      child: pw.Column(
    children: [
      _idebHistoryRow('Anos Iniciais', d5, _blue),
      pw.SizedBox(height: 8),
      _idebHistoryRow('Anos Finais', d9, _orange),
    ],
      ),
    );
  }

  static List<Map<String, dynamic>> _filterHist(List<Map<String, dynamic>> hist) {
    return hist.where((h) => _toInt(h['ano']) != null && _toDouble(h['valor']) != null).toList();
  }

  static pw.Widget _idebHistoryRow(String label, List<Map<String, dynamic>> data, PdfColor accent) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
    pw.Row(
      children: [
        pw.Container(width: 6, height: 7, color: accent),
        pw.SizedBox(width: 5),
        pw.Text(
      label,
      style: pw.TextStyle(color: _navy, fontSize: 7.5, fontWeight: pw.FontWeight.bold),
        ),
      ],
    ),
    pw.SizedBox(height: 4),
    if (data.isEmpty)
      pw.Text(
     'Sem série disponível',
     style: pw.TextStyle(color: _muted, fontSize: 7, fontStyle: pw.FontStyle.italic),
      )
    else
      _historyMiniCards(data, accent),
      ],
    );
  }

  /// Cards mini de valor + ano
  static pw.Widget _historyMiniCards(List<Map<String, dynamic>> data, PdfColor accent) {
    return pw.Row(
      children: [
    for (int i = 0; i < data.length; i++) ...[
      if (i > 0) pw.SizedBox(width: 5),
      pw.Expanded(
        child: pw.Container(
        padding: const pw.EdgeInsets.symmetric(vertical: 5),
     decoration: pw.BoxDecoration(
       color: i == data.length - 1 ? _softBlue : PdfColor.fromInt(0xFFFBFCFE),
       borderRadius: pw.BorderRadius.circular(3),
       border: i == data.length - 1
       ? pw.Border.all(color: accent, width: 0.6)
       : pw.Border.all(color: PdfColor.fromInt(0xFFFBFCFE), width: 0.3),
     ),
     child: pw.Column(children: [
       pw.Text(
       _toDouble(data[i]['valor'])!.toStringAsFixed(1),
           style: pw.TextStyle(
         color: i == data.length - 1 ? accent : _text,
          fontSize: 10,
          fontWeight: pw.FontWeight.bold,
       ),
         textAlign: pw.TextAlign.center,
       ),
       pw.SizedBox(height: 2),
       pw.Text(
         _toInt(data[i]['ano']).toString(),
         style: pw.TextStyle(color: _muted, fontSize: 6.8),
       textAlign: pw.TextAlign.center,
          ),
         ]),
        ),
      ),
    ],
      ],
    );
  }

  /// Bloco de disciplina com 2 colunas: LP e MT
  static pw.Widget _saebDisciplineBlock({
    required double? mediaLP,
    required double? mediaMT,
    required List<num> niveisLP,
    required List<num> niveisMT,
  }) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(8),
      decoration: pw.BoxDecoration(
        color: PdfColor.fromInt(0xFFFBFCFE),
        borderRadius: pw.BorderRadius.circular(5),
        border: pw.Border.all(color: _line, width: 0.4),
      ),
      child: pw.Row(
    crossAxisAlignment: pw.CrossAxisAlignment.start,
    children: [
      pw.Expanded(
     child: _disciplineColumn(titulo: 'Língua Portuguesa', media: mediaLP, niveis: niveisLP, accent: _blue),
      ),
      pw.SizedBox(width: 8),
      pw.Expanded(
     child: _disciplineColumn(titulo: 'Matemática', media: mediaMT, niveis: niveisMT, accent: _orange),
      ),
    ],
      ),
    );
  }

  /// Uma disciplina: título, valor (pts), barras de níveis
  static pw.Widget _disciplineColumn({
    required String titulo,
    required double? media,
    required List<num> niveis,
    required PdfColor accent,
  }) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
    pw.Text(
      titulo.toUpperCase(),
      style: pw.TextStyle(color: _navy, fontSize: 8, fontWeight: pw.FontWeight.bold),
        ),
        pw.SizedBox(height: 3),
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.end,
          children: [
        pw.Text(
          media == null ? '—' : media.toStringAsFixed(0),
      style: pw.TextStyle(
         color: media == null ? _grey600 : accent,
       fontSize: 15,
       fontWeight: pw.FontWeight.bold,
      ),
        ),
        pw.SizedBox(width: 2),
        pw.Text(
      'pts',
      style: const pw.TextStyle(color: PdfColor.fromInt(0xFF677184), fontSize: 7, fontWeight: pw.FontWeight.bold),
       ),
          ],
        ),
        pw.SizedBox(height: 4),
        if (niveis.isNotEmpty) _nivelBars(niveis),
      ],
    );
  }

  static pw.Widget _nivelBars(List<num> niveis) {
    final mb = niveis.length > 2
        ? niveis[0].toDouble() + niveis[1].toDouble() + niveis[2].toDouble()
        : 0.0;
    final ba = niveis.length > 4 ? niveis[3].toDouble() + niveis[4].toDouble() : 0.0;
    final in_ = niveis.length > 6 ? niveis[5].toDouble() + niveis[6].toDouble() : 0.0;
    final ad = niveis.length > 7 ? niveis[7].toDouble() : 0.0;
    final av = niveis.length > 9 ? niveis[8].toDouble() + niveis[9].toDouble() : 0.0;

    final items = [
      ('Muito Baixo', mb, _lvlMb),
      ('Baixo', ba, _lvlBa),
      ('Intermed.', in_, _lvlIn),
      ('Adequado', ad, _lvlAd),
      ('Avançado', av, _lvlAv),
    ];

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.stretch,
      children: [
    for (final e in items)
      pw.Padding(
        padding: const pw.EdgeInsets.only(bottom: 2.5),
        child: _nivelRow(label: e.$1, valor: e.$2, color: e.$3),
      ),
      ],
     );
  }

  static pw.Widget _nivelRow({
    required String label,
    required double valor,
    required PdfColor color,
  }) {
    final pct = valor.clamp(0.0, 100.0);
    return pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.center,
      children: [
    pw.Container(
      width: 56,
      padding: const pw.EdgeInsets.only(right: 4),
      child: pw.Text(
        label,
     style: pw.TextStyle(color: _grey700, fontSize: 7, fontWeight: pw.FontWeight.bold),
     textAlign: pw.TextAlign.right,
      ),
    ),
    pw.Expanded(
      child: pw.Container(
        height: 11,
        decoration: pw.BoxDecoration(
      color: PdfColor.fromInt(0xFFF3F4F6),
      borderRadius: pw.BorderRadius.circular(2.5),
        ),
        child: pw.Row(
      children: [
        if (pct > 0)
       pw.Expanded(
         flex: (pct * 10).round().clamp(1, 1000),
         child: pw.Container(color: color),
       ),
        if (pct < 100)
        pw.Expanded(
          flex: ((100 - pct) * 10).round().clamp(1, 1000),
       child: pw.SizedBox(),
       ),
      ],
        ),
      ),
        ),
    pw.SizedBox(width: 5),
    pw.Container(
      width: 35,
      alignment: pw.Alignment.centerRight,
      child: pw.Text(
        '${pct.toStringAsFixed(1)}%',
    style: pw.TextStyle(color: _text, fontSize: 7, fontWeight: pw.FontWeight.bold),
      ),
        ),
      ],
    );
  }

  static pw.Widget _rodapeCenso({
    required int? escolas,
    required int? matriculas,
    required int? docentes,
    required double? internetPct,
    required int anoCenso,
  }) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(10),
      decoration: pw.BoxDecoration(
    color: _softBlue,
    borderRadius: pw.BorderRadius.circular(6),
    border: pw.Border.all(color: _blue, width: 0.5),
      ),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.center,
        children: [
      _miniStat(_fmtInt(escolas ?? 0), 'Escolas públicas', anoCenso),
      pw.SizedBox(width: 12),
      pw.Container(width: 1, height: 30, color: _blue),
      pw.SizedBox(width: 12),
      _miniStat(_fmtInt(matriculas ?? 0), 'Matrículas', anoCenso),
      pw.SizedBox(width: 12),
      pw.Container(width: 1, height: 30, color: _blue),
      pw.SizedBox(width: 12),
      _miniStat(_fmtInt(docentes ?? 0), 'Docentes', anoCenso),
           pw.SizedBox(width: 12),
      pw.Container(width: 1, height: 30, color: _blue),
      pw.SizedBox(width: 12),
      _miniStat('${internetPct ?? 0}%', 'Internet', anoCenso),
      pw.Spacer(),
      pw.Text(
        'Fonte: Censo Escolar / INEP $anoCenso',
        style: pw.TextStyle(color: _muted, fontSize: 5.5, fontStyle: pw.FontStyle.italic),
      ),
        ],
      ),
    );
  }

  static pw.Widget _miniStat(String valor, String label, int ano) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
    pw.Text(
      valor,
      style: pw.TextStyle(color: _navy, fontSize: 11.5, fontWeight: pw.FontWeight.bold),
    ),
    pw.Text(
      label,
      style: const pw.TextStyle(color: PdfColor.fromInt(0xFF374151), fontSize: 6.5),
    ),
      ],
    );
  }

  static pw.Widget _callout(
    String text, {
    required PdfColor accent,
    required PdfColor background,
  }) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(9),
      decoration: pw.BoxDecoration(
    color: background,
    borderRadius: pw.BorderRadius.circular(4),
    border: pw.Border.all(color: accent, width: 0.5),
      ),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
    children: [
      pw.Container(width: 3, height: 14, color: accent),
      pw.SizedBox(width: 8),
      pw.Expanded(
        child: pw.Text(text, style: const pw.TextStyle(color: PdfColor.fromInt(0xFF172033), fontSize: 7.5)),
      ),
     ],
      ),
    );
  }

  // ========================= UTILIDADES =========================

  static double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is num) return v.toDouble();
    if (v is String) {
      final parsed = double.tryParse(v.replaceAll(',', '.'));
      return parsed;
    }
    return null;
  }

  static int? _toInt(dynamic v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v);
    return null;
  }

  static List<num> _toListNum(dynamic v) {
    if (v is List) return v.map((e) => (e as num?) ?? 0).toList();
    return const [];
  }

  static String _fmtInt(int v) {
    if (v < 1000) return v.toString();
    final s = v.toString().split('').reversed.join('');
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && i % 3 == 0) buf.write('.');
      buf.write(s[i]);
    }
    return buf.toString().split('').reversed.join('');
  }

  static String _dateFmt(DateTime d) {
    String pad(int n) => n.toString().padLeft(2, '0');
    return '${pad(d.day)}/${pad(d.month)}/${d.year} ${pad(d.hour)}:${pad(d.minute)}';
  }
}
