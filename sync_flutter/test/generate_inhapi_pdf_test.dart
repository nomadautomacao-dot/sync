import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:sync_flutter/src/core/models/levantamento_fundeb_models.dart';
import 'package:sync_flutter/src/features/modules/application/fundeb_levantamento_pdf_builder.dart';

/// Gera o relatorio premium (Flutter builder) de Inhapi/AL a partir do payload
/// pre-buscado em test/fixtures/inhapi_payload.json (autonomo?formato=json).
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('Generate Inhapi PDF from fixture via Flutter builder', () async {
    await initializeDateFormatting('pt_BR');

    final fixtureFile = File('test/fixtures/inhapi_payload.json');
    expect(fixtureFile.existsSync(), isTrue);
    final raw = await fixtureFile.readAsString();
    final json = jsonDecode(raw) as Map<String, dynamic>;
    expect(json['success'], isTrue);

    final data = json['data'] as Map<String, dynamic>;

    final relatorioJson = data['relatorio_fundeb'] as Map<String, dynamic>;
    final relatorio = RelatorioFundeb.fromJson(relatorioJson);

    final directedJson = data['relatorio_dirigido_base'];
    RelatorioDirigidoMunicipio? directedReport;
    if (directedJson is Map<String, dynamic>) {
      directedReport = RelatorioDirigidoMunicipio.fromJson(directedJson);
    }

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

    IbgeMunicipioPerfil? ibgePerfil;
    final demo = data['demografia'];
    if (demo is Map<String, dynamic>) {
      ibgePerfil = IbgeMunicipioPerfil(
        populacaoEstimada: (demo['populacao'] as num?)?.toInt(),
        populacaoEstimadaAnoReferencia:
            demo['populacao_ano_referencia']?.toString(),
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

    print('');
    print('=== DIAGNOSTICO INHAPI ===');
    print(
        'Municipio: ${relatorio.identificacao.municipioNome}/${relatorio.identificacao.uf}');
    print(
        'Censo: ${relatorio.censoEscolar != null ? "SIM (${relatorio.censoEscolar!.totalMatriculas} matr)" : "NAO"}');
    print('Dirigido: ${directedReport != null ? "SIM" : "NAO"}');
    print('Fontes: ${fontes.length}');

    print('Gerando PDF via Flutter builder...');
    final bytes = await FundebLevantamentoPdfBuilder.buildFromBundle(
      bundle,
      directedReport: directedReport,
    );

    final outDir = Directory('build');
    if (!outDir.existsSync()) outDir.createSync(recursive: true);
    final outFile = File('build/LEVANTAMENTO_Inhapi-AL_FLUTTER.pdf');
    await outFile.writeAsBytes(bytes);

    print('=== RESULTADO ===');
    print('PDF: ${outFile.path}');
    print('Tamanho: ${(bytes.length / 1024).toStringAsFixed(1)} KB');

    expect(bytes, isNotEmpty);
    expect(bytes.length, greaterThan(30000));
  }, timeout: const Timeout(Duration(minutes: 3)));
}
