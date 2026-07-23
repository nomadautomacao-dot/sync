import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/company_firestore_service.dart';

CompanyFirestoreService _service(FakeFirebaseFirestore db, {String? group = 'grupo-1'}) {
  return CompanyFirestoreService(
    firestore: db,
    groupIdLoader: () async => group,
  );
}

Map<String, dynamic> _companyInput([Map<String, dynamic> over = const {}]) => {
      'name': 'Rocha Prime Consultorias LTDA',
      'tradingName': 'Rocha Prime',
      'cnpj': '12.345.678/0001-99',
      'city': 'Salvador',
      'state': 'BA',
      'email': 'contato@rochaprime.com',
      'phone': '7133330000',
      'contactName': 'Adriel Tavares',
      'contactPosition': 'Diretor',
      ...over,
    };

void main() {
  test('create grava com groupId do loader e list devolve', () async {
    final db = FakeFirebaseFirestore();
    final svc = _service(db);

    final created = await svc.create(_companyInput());
    expect(created.tradingName, 'Rocha Prime');
    expect(created.status, 'Ativo');

    final list = await svc.list();
    expect(list, hasLength(1));

    final raw = (await db.collection('companies').get()).docs.single.data();
    expect(raw['groupId'], 'grupo-1');
    expect(raw['deletedAt'], isNull);
  });

  test('list filtra por grupo', () async {
    final db = FakeFirebaseFirestore();
    await _service(db, group: 'grupo-1').create(_companyInput());
    await _service(db, group: 'grupo-2').create(_companyInput({'tradingName': 'Outra'}));

    final list = await _service(db, group: 'grupo-1').list();
    expect(list, hasLength(1));
    expect(list.single.tradingName, 'Rocha Prime');
  });

  test('list filtra por status e busca', () async {
    final db = FakeFirebaseFirestore();
    final svc = _service(db);
    await svc.create(_companyInput({'tradingName': 'Ativa', 'status': 'active'}));
    await svc.create(_companyInput({'tradingName': 'Inativa', 'status': 'inactive'}));

    expect(await svc.list(status: 'Ativo'), hasLength(1));
    expect((await svc.list(status: 'Ativo')).single.tradingName, 'Ativa');
    expect(await svc.list(search: 'inati'), hasLength(1));
  });

  test('sidebar só devolve ativas', () async {
    final db = FakeFirebaseFirestore();
    final svc = _service(db);
    await svc.create(_companyInput({'tradingName': 'Ativa', 'status': 'active'}));
    await svc.create(_companyInput({'tradingName': 'Inativa', 'status': 'inactive'}));

    final side = await svc.sidebar();
    expect(side, hasLength(1));
    expect(side.single.tradingName, 'Ativa');
  });

  test('updateModules persiste enabledModules', () async {
    final db = FakeFirebaseFirestore();
    final svc = _service(db);
    final created = await svc.create(_companyInput());

    final updated = await svc.updateModules(created.id, ['fundeb', 'consultoria']);
    expect(updated.enabledModules, ['fundeb', 'consultoria']);

    final bundle = await svc.bundle(created.id);
    expect(bundle.company.enabledModules, ['fundeb', 'consultoria']);
  });

  test('bundle traz a empresa e seus funcionários (só do grupo, não deletados)', () async {
    final db = FakeFirebaseFirestore();
    final svc = _service(db);
    final c = await svc.create(_companyInput());

    await svc.createEmployee({
      'companyId': c.id,
      'name': 'Fulano',
      'email': 'f@e.com',
      'position': 'Analista',
      'role': 'analyst',
    });

    final bundle = await svc.bundle(c.id);
    expect(bundle.company.tradingName, 'Rocha Prime');
    expect(bundle.employees, hasLength(1));
    expect(bundle.employees.single.name, 'Fulano');
  });

  test('sem groupId nas claims, lança StateError', () async {
    final db = FakeFirebaseFirestore();
    final svc = _service(db, group: null);
    expect(() => svc.create(_companyInput()), throwsA(isA<StateError>()));
  });
}
