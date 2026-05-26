import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:sync_flutter/src/core/models/levantamento_fundeb_models.dart';
import 'package:sync_flutter/src/core/repositories/mock_sync_repository.dart';
import 'package:sync_flutter/src/features/modules/application/fundeb_levantamento_pdf_builder.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('gera PDF completo do levantamento FUNDEB', () async {
    await initializeDateFormatting('pt_BR');

    final repository = MockSyncRepository();
    final bundle = await repository.getLevantamentoFundeb(
      const MunicipioLookupRequest(nome: 'Pocoes', uf: 'BA', exercicio: 2026),
    );

    final bytes = await FundebLevantamentoPdfBuilder.buildFromBundle(
      bundle,
      directedReport: bundle.relatorioDirigidoBase,
    );

    expect(bytes, isNotEmpty);
    await Directory('build').create();
    await File('build/fundeb_full_test.pdf').writeAsBytes(bytes);
  });
}
