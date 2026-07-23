import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/city_firestore_service.dart';

CityFirestoreService _svc(FakeFirebaseFirestore db, {String? group = 'grupo-1'}) =>
    CityFirestoreService(firestore: db, groupIdLoader: () async => group);

Map<String, dynamic> _city([Map<String, dynamic> over = const {}]) => {
      'name': 'Arapiraca', 'uf': 'AL', 'codigoIbge': '2700300',
      'stage': 'mapping', 'estimatedAnnualRevenue': 150000.0, 'probability': 20,
      ...over,
    };

void main() {
  test('create grava com groupId e cents; list devolve', () async {
    final db = FakeFirebaseFirestore();
    final svc = _svc(db);
    final c = await svc.create(_city());
    expect(c.name, 'Arapiraca');
    expect(c.estimatedAnnualRevenue, 150000.0);

    final list = await svc.list();
    expect(list, hasLength(1));
    final raw = (await db.collection('cities').get()).docs.single.data();
    expect(raw['groupId'], 'grupo-1');
    expect(raw['estimatedAnnualRevenueCents'], 15000000);
    expect(raw['deletedAt'], isNull);
  });

  test('list filtra por grupo', () async {
    final db = FakeFirebaseFirestore();
    await _svc(db, group: 'grupo-1').create(_city());
    await _svc(db, group: 'grupo-2').create(_city({'name': 'Outra'}));
    final list = await _svc(db, group: 'grupo-1').list();
    expect(list, hasLength(1));
    expect(list.single.name, 'Arapiraca');
  });

  test('list filtra por stage e busca', () async {
    final db = FakeFirebaseFirestore();
    final svc = _svc(db);
    await svc.create(_city({'name': 'Mapa', 'stage': 'mapping'}));
    await svc.create(_city({'name': 'Contrato', 'stage': 'contractual'}));
    expect(await svc.list(stage: 'contractual'), hasLength(1));
    expect((await svc.list(stage: 'contractual')).single.name, 'Contrato');
    expect(await svc.list(search: 'mapa'), hasLength(1));
  });

  test('updateStage altera o estagio', () async {
    final db = FakeFirebaseFirestore();
    final svc = _svc(db);
    final c = await svc.create(_city());
    await svc.updateStage(c.id, 'contractual');
    final list = await svc.list();
    expect(list.single.stage, 'contractual');
  });

  test('updatePipeline atualiza campos (revenue vira cents)', () async {
    final db = FakeFirebaseFirestore();
    final svc = _svc(db);
    final c = await svc.create(_city());
    await svc.updatePipeline(c.id, {'estimatedAnnualRevenue': 200000.0, 'probability': 60});
    final raw = (await db.collection('cities').doc(c.id).get()).data()!;
    expect(raw['estimatedAnnualRevenueCents'], 20000000);
    expect(raw['probability'], 60);
  });

  test('sem groupId lanca StateError', () async {
    final db = FakeFirebaseFirestore();
    expect(() => _svc(db, group: null).create(_city()), throwsA(isA<StateError>()));
  });
}
