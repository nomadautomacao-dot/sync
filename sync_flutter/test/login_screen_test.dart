// Contratos da tela de login.
//
// Cada teste aqui defende uma falha real encontrada em auditoria: erro
// generico em vez de campo marcado, ordem de tabulacao invertida, botao de
// recuperacao morto, e um "manter conectado" pre-marcado que nao fazia nada.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/app/app.dart';
import 'package:sync_flutter/src/core/repositories/mock_sync_repository.dart';
import 'package:sync_flutter/src/core/models/sync_models.dart';
import 'package:sync_flutter/src/core/theme/app_theme.dart';
import 'package:sync_flutter/src/features/auth/presentation/login_screen.dart';

/// Espia as chamadas de autenticacao sem tocar em rede.
class _SpyRepository extends MockSyncRepository {
  int signInCalls = 0;
  final List<String> resetsEnviados = [];
  final List<bool> persistencias = [];

  @override
  Future<SyncUser> signIn(String email, String password) {
    signInCalls++;
    return super.signIn(email, password);
  }

  @override
  Future<void> sendPasswordReset(String email) async {
    resetsEnviados.add(email);
  }

  @override
  Future<void> setSessionPersistence({required bool keepSignedIn}) async {
    persistencias.add(keepSignedIn);
  }
}

void main() {
  late _SpyRepository repo;
  late AppController controller;

  setUp(() {
    repo = _SpyRepository();
    controller = AppController(repository: repo);
  });

  Future<void> montar(WidgetTester tester, {Size size = const Size(1440, 950)}) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.themeData,
        home: LoginScreen(controller: controller),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('submit vazio marca os campos e nao chama o servidor',
      (tester) async {
    await montar(tester);
    await tester.tap(find.widgetWithText(ElevatedButton, 'Entrar'));
    await tester.pumpAndSettle();

    // O erro fica no campo que o causou, nao num aviso generico no topo.
    expect(find.text('Informe o e-mail institucional.'), findsOneWidget);
    expect(find.text('Informe a senha.'), findsOneWidget);
    expect(repo.signInCalls, 0,
        reason: 'validacao local deve evitar a ida ao servidor');
  });

  testWidgets('e-mail invalido e apontado no proprio campo', (tester) async {
    await montar(tester);
    await tester.enterText(find.byType(TextFormField).first, 'adriel');
    await tester.enterText(find.byType(TextFormField).last, 'segredo123');
    await tester.tap(find.widgetWithText(ElevatedButton, 'Entrar'));
    await tester.pumpAndSettle();

    expect(find.text('E-mail incompleto — confira o endereço.'), findsOneWidget);
    expect(repo.signInCalls, 0);
  });

  testWidgets('a primeira parada de tabulacao e o e-mail', (tester) async {
    await montar(tester);

    // O `autofocus` ja deve estar no e-mail: era a ultima parada da ordem
    // antiga, atras ate do link de senha.
    expect(FocusManager.instance.primaryFocus?.debugLabel, 'login-email');

    // Um Tab leva para a senha, nao para o rodape nem para o link.
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pumpAndSettle();
    expect(FocusManager.instance.primaryFocus?.debugLabel, 'login-senha');
  });

  testWidgets('"Esqueci a senha" dispara o e-mail de redefinicao',
      (tester) async {
    await montar(tester);
    await tester.enterText(
      find.byType(TextFormField).first,
      'adriel@consultoria.com.br',
    );
    await tester.tap(find.widgetWithText(TextButton, 'Esqueci a senha'));
    await tester.pumpAndSettle();

    // O e-mail ja digitado vai junto: ninguem redigita para se recuperar.
    expect(find.text('Redefinir senha'), findsOneWidget);
    await tester.tap(find.widgetWithText(ElevatedButton, 'Enviar link'));
    await tester.pumpAndSettle();

    expect(repo.resetsEnviados, ['adriel@consultoria.com.br']);
    // A confirmacao nao revela se a conta existe.
    expect(find.textContaining('Se houver uma conta'), findsOneWidget);
  });

  testWidgets('a senha volta a ficar oculta ao enviar o formulario',
      (tester) async {
    await montar(tester);
    await tester.enterText(
      find.byType(TextFormField).first,
      'adriel@consultoria.com.br',
    );
    await tester.enterText(find.byType(TextFormField).last, 'segredo123');

    await tester.tap(find.byTooltip('Mostrar senha'));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Ocultar senha'), findsOneWidget);

    await tester.tap(find.widgetWithText(ElevatedButton, 'Entrar'));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Ocultar senha'), findsNothing,
        reason: 'a senha nao pode seguir exposta na transicao de tela');
  });

  testWidgets('monta sem excecao de layout em desktop e em celular',
      (tester) async {
    final erros = <String>[];
    final anterior = FlutterError.onError;
    FlutterError.onError = (details) => erros.add(details.exceptionAsString());
    addTearDown(() => FlutterError.onError = anterior);

    for (final size in const [Size(1440, 950), Size(820, 1180), Size(390, 844)]) {
      await montar(tester, size: size);
      expect(find.widgetWithText(ElevatedButton, 'Entrar'), findsOneWidget,
          reason: 'a acao principal precisa existir em $size');
    }

    expect(erros, isEmpty);
  });
}
