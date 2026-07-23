import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/collaborator_firestore_service.dart';

void main() {
  late FakeFirebaseFirestore firestore;
  late CollaboratorFirestoreService service;

  setUp(() {
    firestore = FakeFirebaseFirestore();
    service = CollaboratorFirestoreService(
      firestore: firestore,
      groupIdLoader: () async => 'grupo-1',
    );
  });

  test('create grava no Firestore e devolve o summary', () async {
    final summary = await service.create({
      'fullName': 'Maria Silva',
      'collaboratorType': 'external_partner',
      'primaryRole': 'Articuladora',
      'state': 'BA',
      'defaultCommissionPercent': 5,
    });

    expect(summary.fullName, 'Maria Silva');
    expect(summary.state, 'BA');

    final snap = await firestore.collection('collaborators').get();
    expect(snap.docs.length, 1);
    expect(snap.docs.first.data()['groupId'], 'grupo-1');
    expect(snap.docs.first.data()['defaultCommissionPercentBps'], 50000);
  });

  test('list devolve so os do grupo do usuario', () async {
    await firestore.collection('collaborators').add({
      'fullName': 'Do Grupo 1', 'groupId': 'grupo-1',
      'primaryRole': 'X', 'collaboratorType': 'introducer',
      'partnershipStatus': 'active', 'deletedAt': null,
    });
    await firestore.collection('collaborators').add({
      'fullName': 'De Outro Grupo', 'groupId': 'grupo-2',
      'primaryRole': 'Y', 'collaboratorType': 'introducer',
      'partnershipStatus': 'active', 'deletedAt': null,
    });

    final list = await service.list();
    expect(list.length, 1);
    expect(list.first.fullName, 'Do Grupo 1');
  });

  test('list ignora os soft-deletados', () async {
    await firestore.collection('collaborators').add({
      'fullName': 'Ativo', 'groupId': 'grupo-1', 'primaryRole': 'X',
      'collaboratorType': 'introducer', 'partnershipStatus': 'active',
      'deletedAt': null,
    });
    await firestore.collection('collaborators').add({
      'fullName': 'Removido', 'groupId': 'grupo-1', 'primaryRole': 'X',
      'collaboratorType': 'introducer', 'partnershipStatus': 'active',
      'deletedAt': DateTime(2026, 1, 1),
    });

    final list = await service.list();
    expect(list.length, 1);
    expect(list.first.fullName, 'Ativo');
  });

  test('update altera campos e details reflete', () async {
    final created = await service.create({
      'fullName': 'Antes',
      'collaboratorType': 'external_partner',
      'primaryRole': 'Articuladora',
    });

    await service.update(created.id, {
      'fullName': 'Depois',
      'collaboratorType': 'external_partner',
      'primaryRole': 'Articuladora',
      'email': 'novo@x.com',
    });

    final d = await service.details(created.id);
    expect(d.fullName, 'Depois');
    expect(d.email, 'novo@x.com');
  });

  test('softDelete marca deletedAt sem apagar o doc', () async {
    final created = await service.create({
      'fullName': 'Vai Sair',
      'collaboratorType': 'introducer',
      'primaryRole': 'X',
    });

    await service.softDelete(created.id);

    final doc = await firestore.collection('collaborators').doc(created.id).get();
    expect(doc.exists, isTrue, reason: 'soft delete nao apaga o documento');
    expect(doc.data()!['deletedAt'], isNotNull);
    expect((await service.list()).isEmpty, isTrue);
  });

  test('create sem groupId no token lanca StateError', () async {
    final semGrupo = CollaboratorFirestoreService(
      firestore: firestore,
      groupIdLoader: () async => null,
    );
    expect(
      () => semGrupo.create({'fullName': 'X', 'collaboratorType': 'a', 'primaryRole': 'b'}),
      throwsA(isA<StateError>()),
    );
  });
}
