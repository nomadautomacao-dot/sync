// Smoke de layout das telas do console.
//
// Monta cada tela em largura de desktop com o repositorio mock e falha se o
// framework lancar qualquer excecao de layout. Existe porque `dart analyze` e
// `flutter build` passam com folga em erros de constraint (ex.: um
// `CrossAxisAlignment.stretch` dentro de altura ilimitada), que so aparecem
// quando a arvore e realmente montada — e derrubam a tela inteira em silencio.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/repositories/mock_sync_repository.dart';
import 'package:sync_flutter/src/core/theme/app_theme.dart';
import 'package:sync_flutter/src/features/companies/presentation/companies_screen.dart';
import 'package:sync_flutter/src/features/dashboard/presentation/dashboard_screen.dart';
import 'package:sync_flutter/src/features/inbox/presentation/inbox_screen.dart';
import 'package:sync_flutter/src/features/modules/presentation/modules_screen.dart';
import 'package:sync_flutter/src/features/people/presentation/people_screen.dart';
import 'package:sync_flutter/src/features/pipeline/presentation/pipeline_screen.dart';
import 'package:sync_flutter/src/features/settings/presentation/settings_screen.dart';

void main() {
  // No app real as telas vivem dentro do SyncShell, que ja provê Scaffold e
  // Material; o host replica esse enquadramento.
  Widget host(Widget child) => MaterialApp(
        theme: AppTheme.themeData,
        home: Scaffold(
          backgroundColor: SaaSTokens.scaffold,
          body: child,
        ),
      );

  /// Monta [build] em [size] e devolve as excecoes capturadas pelo framework.
  Future<List<String>> mount(
    WidgetTester tester,
    Widget Function(MockSyncRepository repo) build,
    Size size,
  ) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(host(build(MockSyncRepository())));
    await tester.pumpAndSettle(const Duration(seconds: 2));

    final found = <String>[];
    for (var i = 0; i < 50; i++) {
      final e = tester.takeException();
      if (e == null) break;
      found.add(e.toString().split('\n').first);
    }
    return found;
  }

  final telas = <String, Widget Function(MockSyncRepository)>{
    'dashboard': (r) => DashboardScreen(repository: r),
    'inbox': (r) => InboxScreen(repository: r),
    'empresas': (r) => CompaniesScreen(repository: r, onOpenCompany: (_) {}),
    'pessoas': (r) => PeopleScreen(repository: r),
    'pipeline': (r) => PipelineScreen(repository: r),
    // selectedKey nulo mantem o catalogo na tela; uma chave valida desviaria
    // para a sub-tela do gerador, que nao e o alvo deste smoke.
    'modulos': (r) => ModulesScreen(
          repository: r,
          selectedKey: null,
          onSelectModule: (_) {},
        ),
    'configuracoes': (r) => SettingsScreen(repository: r),
  };

  // 1440x950 e a janela de desktop alvo; 820x1180 cobre o breakpoint estreito,
  // onde as telas trocam de duas colunas para conteudo empilhado.
  for (final larguras in const [Size(1440, 950), Size(820, 1180)]) {
    for (final entry in telas.entries) {
      testWidgets(
        '${entry.key} monta sem excecao de layout em ${larguras.width.toInt()}px',
        (tester) async {
          final erros = await mount(tester, entry.value, larguras);
          expect(erros, isEmpty, reason: erros.join(' | '));
        },
      );
    }
  }

  testWidgets('pipeline abre 5 colunas e recolhe o resto no indice', (tester) async {
    final erros = await mount(
      tester,
      (r) => PipelineScreen(repository: r),
      const Size(1440, 950),
    );
    expect(erros, isEmpty, reason: erros.join(' | '));

    // O funil tem 13 estagios; a direcao Console Tecnico abre so os 5 de
    // trabalho e recolhe os 8 restantes numa coluna de indice.
    for (final coluna in const [
      'Mapeamento',
      '1º Contato',
      'Diag. Técnico',
      'Proposta Apres.',
      'Contratual',
    ]) {
      expect(find.text(coluna), findsOneWidget, reason: 'coluna $coluna ausente');
    }
    expect(find.text('+8 ESTÁGIOS'), findsOneWidget);
  });
}
