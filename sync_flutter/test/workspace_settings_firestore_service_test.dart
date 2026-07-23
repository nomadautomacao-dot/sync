import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/workspace_settings_firestore_service.dart';
import 'package:sync_flutter/src/core/models/sync_models.dart';

WorkspaceSettingsFirestoreService _svc(FakeFirebaseFirestore db, {String? g = 'grupo-1'}) =>
    WorkspaceSettingsFirestoreService(firestore: db, groupIdLoader: () async => g);

void main() {
  test('get sem doc devolve default com id=groupId', () async {
    final db = FakeFirebaseFirestore();
    final s = await _svc(db).get();
    expect(s.id, 'grupo-1');
    expect(s.groupName, '');
    expect(s.rawSettings, isEmpty);
  });

  test('update grava e get le de volta', () async {
    final db = FakeFirebaseFirestore();
    final svc = _svc(db);
    await svc.update(WorkspaceSettings(
      id: 'grupo-1', groupName: 'Rocha Prime', slug: 'rocha-prime',
      rawSettings: {'tema': 'navy'},
    ));
    final s = await svc.get();
    expect(s.groupName, 'Rocha Prime');
    expect(s.slug, 'rocha-prime');
    expect(s.rawSettings['tema'], 'navy');

    final raw = (await db.collection('workspace_settings').doc('grupo-1').get()).data()!;
    expect(raw['groupId'], 'grupo-1');
  });

  test('doc é keyed por groupId (isolamento)', () async {
    final db = FakeFirebaseFirestore();
    await _svc(db, g: 'grupo-1').update(WorkspaceSettings(
      id: 'grupo-1', groupName: 'G1', slug: 's1', rawSettings: const {}));
    final s2 = await _svc(db, g: 'grupo-2').get();
    expect(s2.groupName, ''); // grupo-2 nao ve o de grupo-1
  });

  test('sem groupId lanca StateError', () async {
    final db = FakeFirebaseFirestore();
    expect(() => _svc(db, g: null).get(), throwsA(isA<StateError>()));
  });
}
