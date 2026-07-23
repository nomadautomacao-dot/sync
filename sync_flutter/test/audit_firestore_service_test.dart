import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/audit_firestore_service.dart';

AuditFirestoreService _svc(FakeFirebaseFirestore db, {String? g = 'grupo-1'}) =>
    AuditFirestoreService(firestore: db, groupIdLoader: () async => g);

void main() {
  test('colecao vazia devolve lista vazia (sem erro)', () async {
    final db = FakeFirebaseFirestore();
    expect(await _svc(db).list(), isEmpty);
  });

  test('devolve so os do grupo, mais novos primeiro, respeitando limit', () async {
    final db = FakeFirebaseFirestore();
    await db.collection('audit').add({
      'groupId': 'grupo-1', 'action': 'company.created',
      'createdAt': Timestamp.fromDate(DateTime.utc(2026, 7, 1, 10)),
    });
    await db.collection('audit').add({
      'groupId': 'grupo-1', 'action': 'city.created',
      'createdAt': Timestamp.fromDate(DateTime.utc(2026, 7, 2, 10)),
    });
    await db.collection('audit').add({
      'groupId': 'grupo-2', 'action': 'outro.grupo',
      'createdAt': Timestamp.fromDate(DateTime.utc(2026, 7, 3, 10)),
    });

    final list = await _svc(db).list(limit: 10);
    expect(list, hasLength(2)); // so grupo-1
    expect(list.first.action, 'city.created'); // mais novo primeiro
  });

  test('sem groupId lanca StateError', () async {
    final db = FakeFirebaseFirestore();
    expect(() => _svc(db, g: null).list(), throwsA(isA<StateError>()));
  });
}
