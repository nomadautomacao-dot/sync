import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/dashboard_firestore_service.dart';

DashboardFirestoreService _svc(FakeFirebaseFirestore db, {String? g = 'grupo-1'}) =>
    DashboardFirestoreService(firestore: db, groupIdLoader: () async => g);

Future<void> _seed(FakeFirebaseFirestore db, String col, String group, {bool deleted = false}) {
  return db.collection(col).add({'groupId': group, 'deletedAt': deleted ? DateTime.now() : null});
}

void main() {
  test('overview com colecoes vazias nao quebra (contagens zero)', () async {
    final db = FakeFirebaseFirestore();
    final o = await _svc(db).overview(year: 2026);
    expect(o.year, 2026);
    expect(o.kpis, isNotEmpty); // sempre monta os KPIs, so com valores 0
    // KPI de cidades = "0"
    final cidades = o.kpis.firstWhere((k) => k.label.toLowerCase().contains('cidade'));
    expect(cidades.value, '0');
  });

  test('conta so docs do grupo e nao-deletados', () async {
    final db = FakeFirebaseFirestore();
    await _seed(db, 'cities', 'grupo-1');
    await _seed(db, 'cities', 'grupo-1');
    await _seed(db, 'cities', 'grupo-1', deleted: true); // ignorado
    await _seed(db, 'cities', 'grupo-2'); // outro grupo
    await _seed(db, 'collaborators', 'grupo-1');

    final o = await _svc(db).overview(year: 2026);
    final cidades = o.kpis.firstWhere((k) => k.label.toLowerCase().contains('cidade'));
    expect(cidades.value, '2');
  });

  test('KPIs de dinheiro ficam zerados', () async {
    final db = FakeFirebaseFirestore();
    final o = await _svc(db).overview(year: 2026);
    expect(o.projectedGrossRevenue, 0);
    expect(o.projectedProfit, 0);
  });

  test('sem groupId lanca StateError', () async {
    final db = FakeFirebaseFirestore();
    expect(() => _svc(db, g: null).overview(), throwsA(isA<StateError>()));
  });
}
