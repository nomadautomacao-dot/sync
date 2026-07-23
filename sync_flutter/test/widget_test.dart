import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_core_platform_interface/test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/app/app.dart';

void main() {
  setUpAll(() async {
    // O widget agora constroi um CollaboratorFirestoreService no initState,
    // que resolve FirebaseFirestore.instance na hora — precisa de um app
    // Firebase "default" registrado, mesmo que fake, para nao lancar
    // [core/no-app] durante o pump do teste.
    TestWidgetsFlutterBinding.ensureInitialized();
    setupFirebaseCoreMocks();
    await Firebase.initializeApp();
  });

  testWidgets('SyncFlutterApp inicia com shell ou estado de bootstrap', (
    tester,
  ) async {
    await tester.pumpWidget(const SyncFlutterApp());
    await tester.pump();

    expect(
      find.byWidgetPredicate(
        (widget) => widget is CircularProgressIndicator || widget is Scaffold,
      ),
      findsWidgets,
    );
  });
}
