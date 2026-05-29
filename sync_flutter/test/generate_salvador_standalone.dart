// ignore_for_file: avoid_print
import 'dart:convert';
import 'dart:io';

import 'package:intl/date_symbol_data_local.dart';
import 'package:sync_flutter/src/core/models/levantamento_fundeb_models.dart';
import 'package:sync_flutter/src/features/modules/application/fundeb_levantamento_pdf_builder.dart';

/// Standalone Dart script — generates Salvador PDF via Flutter builder
/// using REAL data from localhost API.
///
/// Run with:
///   dart test test/generate_salvador_standalone.dart
///   OR
///   dart run test/generate_salvador_standalone.dart
Future<void> main() async {
  await initializeDateFormatting('pt_BR');

  // 1. Fetch real data from local server
  print('Fetching Salvador data from localhost:3000...');
  final client = HttpClient();
  final request = await client.postUrl(
    Uri.parse(
      'http://localhost:3000/api/modulos/levantamento-fundeb/autonomo?formato=json',
    ),
  );
  request.headers.set('Content-Type', 'application/json');
  request.write(jsonEncode({
    'nome': 'Salvador',
    'uf': 'BA',
    'exercicio': 2026,
  }));
  final response = await request.close();
  final body = await response.transform(utf8.decoder).join();
  client.close();

  if (response.statusCode != 200) {
    print('ERROR: HTTP ${response.statusCode}');
    print(body);
    exit(1);
  }

  final json = jsonDecode(body) as Map<String, dynamic>;
  if (json['success'] != true) {
    print('ERROR: ${json['error']}');
    exit(1);
  }

  final data = json['data'] as Map<String, dynamic>;
  print('Data fetched OK.');

  // 2. Parse into Flutter models
  final relatorioJson = data['relatorio_fundeb'] as Map<String, dynamic>;
  final relatorio = RelatorioFundeb.fromJson(relatorioJson);

  final directedJson = data['relatorio_dirigido_base'];
  RelatorioDirigidoMunicipio? directedReport;
  if (directedJson is Map<String, dynamic>) {
    directedReport = RelatorioDirigidoMunicipio.fromJson(directedJson);
  }

  // Build fontes
  final fontesRaw = data['fontes_utilizadas'];
  final fontes = <FonteColetaStatus>[];
  if (fontesRaw is List) {
    for (int i = 0; i < fontesRaw.length; i++) {
      final src = fontesRaw[i];
      if (src is String) {
        fontes.add(FonteColetaStatus(
          id: 'fonte_$i',
          label: src,
          status: 'automatico',
          descricao: src,
        ));
      }
    }
  }

  // Build IBGE perfil
  IbgeMunicipioPerfil? ibgePerfil;
  final demo = data['demografia'];
  if (demo is Map<String, dynamic>) {
    ibgePerfil = IbgeMunicipioPerfil(
      populacaoEstimada: (demo['populacao'] as num?)?.toInt(),
      populacaoEstimadaAnoReferencia: demo['populacao_ano_referencia']?.toString(),
      idhm: (demo['idh'] as num?)?.toDouble(),
      idhmAnoReferencia: demo['idh_ano_referencia']?.toString(),
    );
  }

  final bundle = LevantamentoFundebBundle(
    relatorio: relatorio,
    fontes: fontes,
    relatorioDirigidoBase: directedReport,
    ibgePerfil: ibgePerfil,
  );

  // 3. Diagnostic
  print('');
  print('=== DIAGNOSTICO ===');
  print('Municipio: ${relatorio.identificacao.municipioNome}/${relatorio.identificacao.uf}');
  print('Censo: ${relatorio.censoEscolar != null ? "SIM (${relatorio.censoEscolar!.totalMatriculas} matr)" : "NAO"}');
  print('IDEB ini: ${relatorio.idebAnosIniciais.length} registros');
  print('IDEB fin: ${relatorio.idebAnosFinais.length} registros');
  print('Dirigido: ${directedReport != null ? "SIM" : "NAO"}');
  if (directedReport != null) {
    print('  saudeFiscal: ${directedReport.saudeFiscal?.disponivel ?? false}');
    print('  infraestrutura: ${directedReport.infraestruturaEscolar?.disponivel ?? false}');
    print('  cenario: ${directedReport.cenarioEstruturacao != null}');
    print('  historico: ${directedReport.historico.anos.length} anos');
    print('  narrativas: ${directedReport.narrativas != null}');
    print('  aprendizagem: ${directedReport.indicadoresAprendizagem?.disponivel ?? false}');
    print('  contexto politico: ${directedReport.contextoPolitico.prefeitoAtual}');
  }
  print('Fontes: ${fontes.length}');
  print('IBGE: ${ibgePerfil?.hasAny ?? false}');
  print('');

  // 4. Generate PDF
  print('Generating PDF via Flutter builder...');
  final bytes = await FundebLevantamentoPdfBuilder.buildFromBundle(
    bundle,
    directedReport: directedReport,
  );

  // 5. Save
  final outDir = Directory('build');
  if (!outDir.existsSync()) outDir.createSync(recursive: true);
  final outFile = File('build/LEVANTAMENTO_Salvador-BA_FLUTTER.pdf');
  await outFile.writeAsBytes(bytes);

  print('');
  print('=== RESULTADO ===');
  print('PDF: ${outFile.absolute.path}');
  print('Tamanho: ${(bytes.length / 1024).toStringAsFixed(1)} KB');
  print('SUCESSO!');
}
