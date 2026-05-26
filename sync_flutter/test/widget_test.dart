import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/app/app.dart';

void main() {
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
