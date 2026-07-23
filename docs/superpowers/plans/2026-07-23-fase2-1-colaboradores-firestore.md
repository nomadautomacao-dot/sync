# Fase 2.1 — Colaboradores no Firestore (esqueleto andante) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a entidade Colaboradores ler e escrever direto no Firestore, provando o padrão Flutter↔Firestore↔Security Rules ponta a ponta, sem tocar nas outras entidades.

**Architecture:** Strangler fig. Um `CollaboratorFirestoreService` no Flutter faz o CRUD em `collaborators/{id}`; o `HybridSyncRepository` passa a delegar os 4 métodos de colaborador a ele, enquanto todo o resto continua indo para o `RemoteSyncRepository` (Next/Postgres). O `groupId` sai das custom claims do ID token, e as Security Rules garantem isolamento por grupo. Nenhuma rota do Next é removida ainda (isso é o plano 2.4).

**Tech Stack:** Flutter + `cloud_firestore`, `fake_cloud_firestore` (teste), Firebase Security Rules, `@firebase/rules-unit-testing` + emulador (teste de regras).

## Global Constraints

- Projeto Firebase: `globalconsultorias`. SDK Flutter pinado: `~/sync_tooling/flutter/bin/flutter` (3.38.7) — o `flutter` do PATH (3.44+) não compila `lucide_icons_flutter`.
- **Dinheiro e percentual nunca são `double` no Firestore.** `defaultCommissionPercent` (Prisma `Decimal(8,4)`) é gravado como inteiro em basis points no campo `defaultCommissionPercentBps`, onde `bps = round(percent × 10000)` e `percent = bps / 10000.0`. Ver a spec, seção "Blindagem do cálculo de comissão".
- **Exclusão é soft delete:** grava `deletedAt` (timestamp), nunca `delete()`. Toda query filtra `where('deletedAt', isEqualTo: null)`.
- O `groupId` do usuário vem das custom claims do ID token (`getIdTokenResult().claims['groupId']`), nunca de input do cliente. Documento novo grava esse `groupId`; queries filtram por ele.
- Escopo desta fatia: **só Colaboradores**. Campos derivados de outras entidades — `cities`, `fidelized` (de participações, fase 2.2) e `profitYtd`, `commissionYtd` (do financeiro, fase 2.3) — ficam em `0` por ora. Não invente cálculo para eles.
- Código em inglês, labels/mensagens em português, commits em inglês (Conventional Commits).
- Dados iniciais: **vazio**. Sem seed. O app mostra lista vazia até o usuário cadastrar pela interface.

---

### Task 1: Habilitar o Firestore e adicionar as dependências

**Files:**
- Modify: `sync_flutter/pubspec.yaml`

**Interfaces:**
- Produces: pacote `cloud_firestore` disponível no app; `fake_cloud_firestore` disponível nos testes.

> **Passo manual do usuário (pré-requisito):** no Firebase Console do projeto
> `globalconsultorias` → Build → Firestore Database → **Criar banco de dados** →
> modo **produção** → região `southamerica-east1` (ou `nam5`). Sem isso, as
> escritas falham com `PERMISSION_DENIED`/`NOT_FOUND`. O implementador deve
> confirmar com o usuário que isso foi feito antes de rodar o Step 4.

- [ ] **Step 1: Adicionar o cloud_firestore ao app**

Run (na raiz do repo):

```bash
cd sync_flutter && /home/AdrielT87/sync_tooling/flutter/bin/flutter pub add cloud_firestore
```

Expected: `pubspec.yaml` ganha `cloud_firestore:` em `dependencies`.

- [ ] **Step 2: Adicionar o fake_cloud_firestore aos dev deps**

Run:

```bash
cd sync_flutter && /home/AdrielT87/sync_tooling/flutter/bin/flutter pub add --dev fake_cloud_firestore
```

Expected: `pubspec.yaml` ganha `fake_cloud_firestore:` em `dev_dependencies`.

- [ ] **Step 3: Confirmar que o app ainda compila para web**

Run:

```bash
cd sync_flutter && /home/AdrielT87/sync_tooling/flutter/bin/flutter build web --release --base-href /flutter-web/ --dart-define=SYNC_API_BASE_URL=http://localhost:3000 2>&1 | tail -3
```

Expected: `✓ Built build/web`.

- [ ] **Step 4: Commit**

```bash
git add sync_flutter/pubspec.yaml sync_flutter/pubspec.lock
git commit -m "build: add cloud_firestore and fake_cloud_firestore to flutter"
```

---

### Task 2: Mapeamento documento Firestore ↔ modelos de colaborador

**Files:**
- Create: `sync_flutter/lib/src/core/data/collaborator_firestore_mapper.dart`
- Test: `sync_flutter/test/collaborator_firestore_mapper_test.dart`

**Interfaces:**
- Consumes: `CollaboratorSummary`, `CollaboratorDetails` de `sync_flutter/lib/src/core/models/sync_models.dart` (já existem).
- Produces:
  - `Map<String, dynamic> collaboratorDocFromInput(Map<String, dynamic> input, String groupId)` — monta o doc a gravar a partir do payload da tela + groupId.
  - `CollaboratorSummary collaboratorSummaryFromDoc(String id, Map<String, dynamic> data)`
  - `CollaboratorDetails collaboratorDetailsFromDoc(String id, Map<String, dynamic> data)`
  - `int percentToBps(num percent)` / `double bpsToPercent(int bps)`

> **Nota de design:** o mapeamento é função pura sobre `Map` — testa-se sem
> Firestore. É aqui que a regra "percentual em bps" e os defaults dos campos
> derivados (`0`) ficam isolados e verificados.

- [ ] **Step 1: Escrever o teste que falha**

Create `sync_flutter/test/collaborator_firestore_mapper_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/collaborator_firestore_mapper.dart';

void main() {
  group('percent <-> bps', () {
    test('converte percent para basis points (x10000)', () {
      expect(percentToBps(5), 50000);
      expect(percentToBps(2.5), 25000);
      expect(percentToBps(0), 0);
    });

    test('converte basis points de volta para percent', () {
      expect(bpsToPercent(50000), 5.0);
      expect(bpsToPercent(25000), 2.5);
      expect(bpsToPercent(0), 0.0);
    });
  });

  group('collaboratorDocFromInput', () {
    test('monta o doc com groupId, bps e deletedAt nulo', () {
      final doc = collaboratorDocFromInput({
        'fullName': 'Maria Silva',
        'collaboratorType': 'external_partner',
        'primaryRole': 'Articuladora',
        'partnershipStatus': 'active',
        'defaultCommissionPercent': 5,
        'email': 'maria@x.com',
      }, 'grupo-1');

      expect(doc['groupId'], 'grupo-1');
      expect(doc['fullName'], 'Maria Silva');
      expect(doc['defaultCommissionPercentBps'], 50000);
      expect(doc['deletedAt'], isNull);
      expect(doc.containsKey('defaultCommissionPercent'), isFalse,
          reason: 'nunca grava o percent como double');
    });

    test('usa defaults quando campos opcionais faltam', () {
      final doc = collaboratorDocFromInput({
        'fullName': 'Sem Comissao',
        'collaboratorType': 'introducer',
        'primaryRole': 'Indicador',
      }, 'grupo-1');

      expect(doc['partnershipStatus'], 'active');
      expect(doc['defaultCommissionPercentBps'], 0);
      expect(doc['email'], isNull);
    });
  });

  group('collaboratorSummaryFromDoc', () {
    test('mapeia doc para summary com derivados zerados', () {
      final s = collaboratorSummaryFromDoc('c1', {
        'fullName': 'Maria Silva',
        'primaryRole': 'Articuladora',
        'collaboratorType': 'external_partner',
        'state': 'BA',
        'partnershipStatus': 'active',
        'defaultCommissionPercentBps': 50000,
      });

      expect(s.id, 'c1');
      expect(s.fullName, 'Maria Silva');
      expect(s.role, 'Articuladora');
      expect(s.type, 'external_partner');
      expect(s.state, 'BA');
      expect(s.status, 'active');
      // derivados de outras entidades — zerados nesta fatia
      expect(s.cities, 0);
      expect(s.fidelized, 0);
      expect(s.profitYtd, 0.0);
      expect(s.commissionYtd, 0.0);
    });

    test('tolera campos ausentes sem quebrar', () {
      final s = collaboratorSummaryFromDoc('c2', {'fullName': 'So Nome'});
      expect(s.fullName, 'So Nome');
      expect(s.role, '');
      expect(s.state, '');
    });
  });

  group('collaboratorDetailsFromDoc', () {
    test('mapeia doc para details convertendo bps de volta', () {
      final d = collaboratorDetailsFromDoc('c1', {
        'fullName': 'Maria Silva',
        'collaboratorType': 'external_partner',
        'primaryRole': 'Articuladora',
        'partnershipStatus': 'active',
        'defaultCommissionPercentBps': 50000,
        'email': 'maria@x.com',
        'notes': 'nota',
      });

      expect(d.id, 'c1');
      expect(d.fullName, 'Maria Silva');
      expect(d.defaultCommissionPercent, 5.0);
      expect(d.email, 'maria@x.com');
      expect(d.notes, 'nota');
      expect(d.documents, isEmpty);
    });
  });
}
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd sync_flutter && /home/AdrielT87/sync_tooling/flutter/bin/flutter test test/collaborator_firestore_mapper_test.dart`
Expected: FAIL — `collaborator_firestore_mapper.dart` não existe.

- [ ] **Step 3: Implementar o mapper**

Create `sync_flutter/lib/src/core/data/collaborator_firestore_mapper.dart`:

```dart
import '../models/sync_models.dart';

/// Percentual (Decimal(8,4) no schema antigo) guardado como inteiro em basis
/// points: bps = percent x 10000. Ver a regra global "dinheiro nunca e double".
int percentToBps(num percent) => (percent * 10000).round();
double bpsToPercent(int bps) => bps / 10000.0;

String? _str(dynamic v) => v is String && v.isNotEmpty ? v : null;
int _int(dynamic v) => v is int ? v : (v is num ? v.toInt() : 0);

/// Monta o documento a gravar a partir do payload da tela + o groupId do token.
/// O groupId nunca vem do cliente; e injetado pelo service a partir das claims.
Map<String, dynamic> collaboratorDocFromInput(
  Map<String, dynamic> input,
  String groupId,
) {
  final percent = input['defaultCommissionPercent'];
  return {
    'groupId': groupId,
    'fullName': input['fullName'],
    'shortName': _str(input['shortName']),
    'email': _str(input['email']),
    'phone': _str(input['phone']),
    'whatsapp': _str(input['whatsapp']),
    'cpfOrDocument': _str(input['cpfOrDocument']),
    'city': _str(input['city']),
    'state': _str(input['state']),
    'companyOrOrganization': _str(input['companyOrOrganization']),
    'title': _str(input['title']),
    'collaboratorType': input['collaboratorType'],
    'primaryRole': input['primaryRole'],
    'partnershipStatus': _str(input['partnershipStatus']) ?? 'active',
    'trustLevel': input['trustLevel'],
    'averageInfluenceScore': input['averageInfluenceScore'],
    'defaultCommissionPercentBps':
        percent is num ? percentToBps(percent) : 0,
    'defaultProfitBaseType': _str(input['defaultProfitBaseType']),
    'defaultTriggerType': _str(input['defaultTriggerType']),
    'payoutCycle': _str(input['payoutCycle']),
    'payoutMethod': _str(input['payoutMethod']),
    'notes': _str(input['notes']),
    'confidentialNotes': _str(input['confidentialNotes']),
    'deletedAt': null,
  };
}

CollaboratorSummary collaboratorSummaryFromDoc(
  String id,
  Map<String, dynamic> data,
) {
  return CollaboratorSummary(
    id: id,
    fullName: (data['fullName'] as String?) ?? '',
    role: (data['primaryRole'] as String?) ?? '',
    type: (data['collaboratorType'] as String?) ?? '',
    state: (data['state'] as String?) ?? '',
    status: (data['partnershipStatus'] as String?) ?? 'active',
    // Derivados de outras entidades — zerados nesta fatia (fases 2.2 e 2.3).
    cities: 0,
    fidelized: 0,
    profitYtd: 0.0,
    commissionYtd: 0.0,
  );
}

CollaboratorDetails collaboratorDetailsFromDoc(
  String id,
  Map<String, dynamic> data,
) {
  return CollaboratorDetails(
    id: id,
    fullName: (data['fullName'] as String?) ?? '',
    shortName: _str(data['shortName']),
    email: _str(data['email']),
    phone: _str(data['phone']),
    whatsapp: _str(data['whatsapp']),
    cpfOrDocument: _str(data['cpfOrDocument']),
    city: _str(data['city']),
    state: _str(data['state']),
    companyOrOrganization: _str(data['companyOrOrganization']),
    title: _str(data['title']),
    collaboratorType: (data['collaboratorType'] as String?) ?? '',
    primaryRole: (data['primaryRole'] as String?) ?? '',
    partnershipStatus: (data['partnershipStatus'] as String?) ?? 'active',
    trustLevel: data['trustLevel'] as int?,
    averageInfluenceScore: data['averageInfluenceScore'] as int?,
    defaultCommissionPercent: bpsToPercent(_int(data['defaultCommissionPercentBps'])),
    defaultProfitBaseType: _str(data['defaultProfitBaseType']),
    defaultTriggerType: _str(data['defaultTriggerType']),
    payoutCycle: _str(data['payoutCycle']),
    payoutMethod: _str(data['payoutMethod']),
    notes: _str(data['notes']),
    confidentialNotes: _str(data['confidentialNotes']),
    documents: const [],
  );
}
```

> Se o construtor de `CollaboratorDetails` exigir parâmetros nomeados diferentes
> dos acima, ajuste os nomes para bater com `sync_models.dart` — os campos são os
> listados na classe (id, fullName, shortName, email, phone, whatsapp,
> cpfOrDocument, city, state, companyOrOrganization, title, collaboratorType,
> primaryRole, partnershipStatus, trustLevel, averageInfluenceScore,
> defaultCommissionPercent, defaultProfitBaseType, defaultTriggerType,
> payoutCycle, payoutMethod, notes, confidentialNotes, documents).

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd sync_flutter && /home/AdrielT87/sync_tooling/flutter/bin/flutter test test/collaborator_firestore_mapper_test.dart`
Expected: PASS — todos os grupos verdes.

- [ ] **Step 5: Commit**

```bash
git add sync_flutter/lib/src/core/data/collaborator_firestore_mapper.dart sync_flutter/test/collaborator_firestore_mapper_test.dart
git commit -m "feat: firestore document mapping for collaborators"
```

---

### Task 3: CollaboratorFirestoreService (CRUD)

**Files:**
- Create: `sync_flutter/lib/src/core/data/collaborator_firestore_service.dart`
- Test: `sync_flutter/test/collaborator_firestore_service_test.dart`

**Interfaces:**
- Consumes: o mapper da Task 2; `FirebaseFirestore` de `cloud_firestore`.
- Produces uma classe `CollaboratorFirestoreService`:
  - `CollaboratorFirestoreService({required FirebaseFirestore firestore, required Future<String?> Function() groupIdLoader})`
  - `Future<List<CollaboratorSummary>> list()`
  - `Future<CollaboratorSummary> create(Map<String, dynamic> input)`
  - `Future<CollaboratorDetails> details(String id)`
  - `Future<CollaboratorDetails> update(String id, Map<String, dynamic> input)`
  - `Future<void> softDelete(String id)`

> `groupIdLoader` é injetado (não lê o Firebase direto) para o teste conseguir
> fornecer um groupId fixo sem mockar auth. Em produção será
> `() async => (await FirebaseAuth.instance.currentUser?.getIdTokenResult())?.claims?['groupId'] as String?`.

- [ ] **Step 1: Escrever o teste que falha**

Create `sync_flutter/test/collaborator_firestore_service_test.dart`:

```dart
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
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd sync_flutter && /home/AdrielT87/sync_tooling/flutter/bin/flutter test test/collaborator_firestore_service_test.dart`
Expected: FAIL — `collaborator_firestore_service.dart` não existe.

- [ ] **Step 3: Implementar o service**

Create `sync_flutter/lib/src/core/data/collaborator_firestore_service.dart`:

```dart
import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/sync_models.dart';
import 'collaborator_firestore_mapper.dart';

/// CRUD de colaboradores direto no Firestore. Escopo por grupo vem das custom
/// claims do ID token (via groupIdLoader); soft delete via deletedAt.
class CollaboratorFirestoreService {
  CollaboratorFirestoreService({
    required FirebaseFirestore firestore,
    required Future<String?> Function() groupIdLoader,
  })  : _firestore = firestore,
        _groupIdLoader = groupIdLoader;

  final FirebaseFirestore _firestore;
  final Future<String?> Function() _groupIdLoader;

  CollectionReference<Map<String, dynamic>> get _col =>
      _firestore.collection('collaborators');

  Future<String> _requireGroupId() async {
    final groupId = await _groupIdLoader();
    if (groupId == null || groupId.isEmpty) {
      throw StateError('Usuario sem groupId nas claims — acesso nao configurado.');
    }
    return groupId;
  }

  Future<List<CollaboratorSummary>> list() async {
    final groupId = await _requireGroupId();
    final snap = await _col
        .where('groupId', isEqualTo: groupId)
        .where('deletedAt', isEqualTo: null)
        .get();
    return snap.docs
        .map((d) => collaboratorSummaryFromDoc(d.id, d.data()))
        .toList();
  }

  Future<CollaboratorSummary> create(Map<String, dynamic> input) async {
    final groupId = await _requireGroupId();
    final doc = collaboratorDocFromInput(input, groupId);
    doc['createdAt'] = FieldValue.serverTimestamp();
    doc['updatedAt'] = FieldValue.serverTimestamp();
    final ref = await _col.add(doc);
    return collaboratorSummaryFromDoc(ref.id, doc);
  }

  Future<CollaboratorDetails> details(String id) async {
    final doc = await _col.doc(id).get();
    if (!doc.exists) {
      throw StateError('Colaborador $id nao encontrado.');
    }
    return collaboratorDetailsFromDoc(id, doc.data()!);
  }

  Future<CollaboratorDetails> update(String id, Map<String, dynamic> input) async {
    final groupId = await _requireGroupId();
    final doc = collaboratorDocFromInput(input, groupId);
    doc['updatedAt'] = FieldValue.serverTimestamp();
    await _col.doc(id).set(doc, SetOptions(merge: true));
    return details(id);
  }

  Future<void> softDelete(String id) async {
    await _col.doc(id).set({
      'deletedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }
}
```

> `fake_cloud_firestore` resolve `FieldValue.serverTimestamp()` para um
> timestamp real nos testes, então `deletedAt` fica não-nulo após `softDelete` —
> o teste `list ignora os soft-deletados` cobre isso.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd sync_flutter && /home/AdrielT87/sync_tooling/flutter/bin/flutter test test/collaborator_firestore_service_test.dart`
Expected: PASS — 6 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add sync_flutter/lib/src/core/data/collaborator_firestore_service.dart sync_flutter/test/collaborator_firestore_service_test.dart
git commit -m "feat: collaborator firestore CRUD service with group scoping and soft delete"
```

---

### Task 4: Ligar o Hybrid ao service de Firestore

**Files:**
- Modify: `sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart`
- Modify: `sync_flutter/lib/src/app/app.dart:31-44` (injeção da dependência)

**Interfaces:**
- Consumes: `CollaboratorFirestoreService` (Task 3).
- Produces: os 4 métodos de colaborador do `HybridSyncRepository` (`getCollaborators`, `createCollaborator`, `getCollaboratorDetails`, `updateCollaboratorDetails`) passam a usar o Firestore em vez do `_remote`, quando `remoteEnabled`.

> Não altere a interface `SyncRepository`. Só a implementação Hybrid muda de
> destino para esses 4 métodos. Os demais continuam indo para `_remote`.

- [ ] **Step 1: Ver as assinaturas atuais no Hybrid**

Run:

```bash
grep -n "getCollaborators\|createCollaborator\|getCollaboratorDetails\|updateCollaboratorDetails" sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart
```

Anote as assinaturas exatas (tipos de retorno e parâmetros) para reproduzi-las.

- [ ] **Step 2: Injetar o service no Hybrid**

Em `sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart`, adicione o import e o campo. No topo:

```dart
import '../data/collaborator_firestore_service.dart';
```

No construtor e campos da classe, adicione o parâmetro `collaborators`:

```dart
  HybridSyncRepository({
    required RemoteSyncRepository remote,
    required LocalSyncRepository local,
    required CollaboratorFirestoreService collaborators,
  })  : _remote = remote,
        _local = local,
        _collaborators = collaborators;

  final RemoteSyncRepository _remote;
  final LocalSyncRepository _local;
  final CollaboratorFirestoreService _collaborators;
```

- [ ] **Step 3: Redirecionar os 4 métodos de colaborador**

Ainda no Hybrid, substitua os corpos dos 4 métodos para delegar ao service
quando remoto (mantendo o fallback local quando offline). Use as assinaturas que
você anotou no Step 1. Exemplo para os quatro (ajuste os tipos de retorno para
os reais da interface):

Assinaturas exatas (confirmadas na interface `sync_repository.dart`):

```dart
  @override
  Future<List<CollaboratorSummary>> getCollaborators({
    String search = '',
    String status = 'all',
    int? year,
  }) async {
    if (_mustUseRemote) {
      return _collaborators.list();
    }
    return _local.getCollaborators(search: search, status: status, year: year);
  }

  @override
  Future<CollaboratorSummary> createCollaborator(Map<String, dynamic> data) async {
    if (_mustUseRemote) {
      return _collaborators.create(data);
    }
    return _local.createCollaborator(data);
  }

  @override
  Future<CollaboratorDetails> getCollaboratorDetails(String id) async {
    if (_mustUseRemote) {
      return _collaborators.details(id);
    }
    return _local.getCollaboratorDetails(id);
  }

  @override
  Future<CollaboratorDetails> updateCollaboratorDetails(
    String id,
    Map<String, dynamic> data,
  ) async {
    if (_mustUseRemote) {
      return _collaborators.update(id, data);
    }
    return _local.updateCollaboratorDetails(id, data);
  }
```

> **Filtros `search`/`status`:** o `list()` do service devolve todos os
> colaboradores do grupo, sem aplicar `search`/`status`. Para o esqueleto isso
> basta (a lista é pequena e começa vazia); o filtro client-side ou por query
> Firestore entra numa fatia posterior, não aqui. Não invente índice para isso agora.
>
> A chamada de caching manual (`_local.cacheCollaborators`) que o método remoto
> fazia é dispensada no caminho Firestore — o próprio SDK do Firestore mantém
> cache offline.

- [ ] **Step 4: Construir o service no app.dart e passá-lo ao Hybrid**

Em `sync_flutter/lib/src/app/app.dart`, adicione os imports no topo:

```dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../core/data/collaborator_firestore_service.dart';
```

E no `initState`, passe o service ao construtor do Hybrid:

```dart
      repository: HybridSyncRepository(
        remote: RemoteSyncRepository(
          apiClient: SyncApiClient(sessionStorage: sessionStorage),
          sessionStorage: sessionStorage,
        ),
        local: LocalSyncRepository(
          sessionStorage: sessionStorage,
          store: LocalWorkspaceStore(),
        ),
        collaborators: CollaboratorFirestoreService(
          firestore: FirebaseFirestore.instance,
          groupIdLoader: () async {
            final result = await FirebaseAuth.instance.currentUser?.getIdTokenResult();
            return result?.claims?['groupId'] as String?;
          },
        ),
      ),
```

- [ ] **Step 5: Rodar toda a suíte de testes do Flutter**

Run: `cd sync_flutter && /home/AdrielT87/sync_tooling/flutter/bin/flutter test 2>&1 | tail -5`
Expected: todos os testes passam (os novos de mapper e service, mais os pré-existentes).

- [ ] **Step 6: Build web para confirmar a integração**

Run: `cd sync_flutter && /home/AdrielT87/sync_tooling/flutter/bin/flutter build web --release --base-href /flutter-web/ --dart-define=SYNC_API_BASE_URL=http://localhost:3000 2>&1 | tail -3`
Expected: `✓ Built build/web`.

- [ ] **Step 7: Commit**

```bash
git add sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart sync_flutter/lib/src/app/app.dart
git commit -m "feat: route collaborator reads/writes through firestore in hybrid repo"
```

---

### Task 5: Security Rules e índices

**Files:**
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `firebase.json` (na raiz do repo — config do CLI, distinto do `sync_flutter/firebase.json` do flutterfire)
- Create: `firestore-rules-test/collaborators.rules.test.mjs`
- Create: `firestore-rules-test/package.json`

**Interfaces:**
- Produces: as Security Rules que o service da Task 3 assume (grupo isola leitura/escrita; só admin escreve).

> **Passo manual/CLI:** o deploy das rules usa a Firebase CLI, que já está logada
> (`firebase projects:list` mostra `globalconsultorias`). O teste de rules usa o
> emulador do Firestore.

- [ ] **Step 1: Escrever as rules**

Create `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }
    function myGroupId() {
      return request.auth.token.groupId;
    }
    function myRole() {
      return request.auth.token.groupRole;
    }
    function isAdmin() {
      return isSignedIn() && myRole() in ['owner', 'admin'];
    }

    match /collaborators/{id} {
      allow read: if isSignedIn() && resource.data.groupId == myGroupId();
      allow create: if isAdmin() && request.resource.data.groupId == myGroupId();
      allow update: if isAdmin()
                    && resource.data.groupId == myGroupId()
                    && request.resource.data.groupId == myGroupId();
      // Sem delete real: exclusao e soft delete (update de deletedAt).
      allow delete: if false;
    }
  }
}
```

> `groupId`/`groupRole` são lidos de `request.auth.token` (as custom claims que a
> fase 1 grava), sem `get()` — custo zero por avaliação.

- [ ] **Step 2: Escrever os índices**

Create `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "collaborators",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "groupId", "order": "ASCENDING" },
        { "fieldPath": "deletedAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 3: Escrever o firebase.json do CLI**

Create `firebase.json` (raiz do repo):

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

- [ ] **Step 4: Escrever o teste de rules**

Create `firestore-rules-test/package.json`:

```json
{
  "name": "firestore-rules-test",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "firebase emulators:exec --only firestore --project globalconsultorias 'node --test'"
  },
  "devDependencies": {
    "@firebase/rules-unit-testing": "^4.0.1"
  }
}
```

Create `firestore-rules-test/collaborators.rules.test.mjs`:

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { setDoc, getDoc, doc } from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'globalconsultorias',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  });
});

after(async () => { await env.cleanup(); });

function ctx(uid, groupId, role) {
  return env.authenticatedContext(uid, { groupId, groupRole: role }).firestore();
}

test('admin do grupo cria colaborador do proprio grupo', async () => {
  const db = ctx('u1', 'grupo-1', 'admin');
  await assertSucceeds(setDoc(doc(db, 'collaborators/c1'), {
    groupId: 'grupo-1', fullName: 'X', deletedAt: null,
  }));
});

test('membro comum nao cria colaborador', async () => {
  const db = ctx('u2', 'grupo-1', 'member');
  await assertFails(setDoc(doc(db, 'collaborators/c2'), {
    groupId: 'grupo-1', fullName: 'X', deletedAt: null,
  }));
});

test('admin nao cria colaborador em outro grupo', async () => {
  const db = ctx('u1', 'grupo-1', 'admin');
  await assertFails(setDoc(doc(db, 'collaborators/c3'), {
    groupId: 'grupo-2', fullName: 'X', deletedAt: null,
  }));
});

test('usuario de outro grupo nao le colaborador alheio', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'collaborators/c4'), {
      groupId: 'grupo-1', fullName: 'Secreto', deletedAt: null,
    });
  });
  const outro = ctx('u3', 'grupo-2', 'admin');
  await assertFails(getDoc(doc(outro, 'collaborators/c4')));
});

test('delete real e sempre negado (soft delete only)', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'collaborators/c5'), {
      groupId: 'grupo-1', fullName: 'X', deletedAt: null,
    });
  });
  const db = ctx('u1', 'grupo-1', 'admin');
  const { deleteDoc } = await import('firebase/firestore');
  await assertFails(deleteDoc(doc(db, 'collaborators/c5')));
});
```

- [ ] **Step 5: Instalar deps do teste de rules e rodar**

Run:

```bash
cd firestore-rules-test && npm install && npm install firebase && npm test 2>&1 | tail -15
```

Expected: 5 testes passam (o `firebase emulators:exec` baixa o emulador na primeira vez; requer Java instalado). Se o emulador não estiver disponível no ambiente, registre isso e rode o deploy do Step 6 assim mesmo — o teste de rules é a rede de segurança, mas as rules podem ser deployadas e verificadas manualmente.

- [ ] **Step 6: Deployar as rules e os índices**

Run (na raiz do repo):

```bash
firebase deploy --only firestore:rules,firestore:indexes --project globalconsultorias 2>&1 | tail -10
```

Expected: `Deploy complete!`. As rules passam a valer em produção.

- [ ] **Step 7: Commit**

```bash
git add firestore.rules firestore.indexes.json firebase.json firestore-rules-test/
git commit -m "feat: firestore security rules and index for collaborators

Grupo isola leitura/escrita via custom claims; so admin escreve; delete real
negado (soft delete only). Teste de rules com o emulador cobre os 5 cenarios."
```

---

### Task 6: Verificação end-to-end no app

**Files:** nenhum (verificação manual + limpeza).

- [ ] **Step 1: Rodar o app**

Run em dois terminais:

```bash
npm run dev
```

(sobe backend + Flutter no Chrome). Faça login com `adrieltavares87@gmail.com`.

- [ ] **Step 2: Abrir a tela Colaboradores**

Navegue para "Colaboradores". Expected: a lista carrega **sem erro** e aparece
**vazia** (Firestore começa sem dados) — diferente do dashboard, que ainda dá
"Falha ao carregar" por depender do Postgres. Confirme no console do navegador
que **não** há chamada a `/api/collaborators`.

- [ ] **Step 3: Criar um colaborador pela interface**

Use o botão de novo colaborador, preencha nome/tipo/papel, salve. Expected: ele
aparece na lista. No Firebase Console → Firestore, confirme o documento em
`collaborators/` com `groupId: "grupo-1"`, `defaultCommissionPercentBps` inteiro
e `deletedAt: null`.

- [ ] **Step 4: Editar e confirmar persistência**

Abra o colaborador criado, edite um campo, salve, recarregue a página (F5).
Expected: a alteração persistiu (veio do Firestore, não de cache).

- [ ] **Step 5: Registrar o resultado**

Se algum passo falhar, é bug de integração — pare e investigue com
`superpowers:systematic-debugging`. Se tudo passar, o esqueleto andante está
provado: a próxima entidade é repetição do mesmo padrão.

---

## Verificação final da fatia

- [ ] `cd sync_flutter && flutter test` — todos verdes
- [ ] `flutter build web` — `✓ Built build/web`
- [ ] Colaboradores lê/cria/edita no Firestore, sem tocar `/api/collaborators`
- [ ] Security Rules deployadas; grupo isolado
- [ ] Dinheiro/percentual gravado como inteiro (`defaultCommissionPercentBps`)

> **Fora de escopo desta fatia (próximos planos):** `cities`/`fidelized`
> (participações, 2.2), `profitYtd`/`commissionYtd` e o cálculo de comissão
> (Cloud Functions, 2.3), remoção das rotas `/api/collaborators` e do Prisma
> (2.4). Os campos derivados ficam em `0` até lá — isso é intencional, não um bug.
>
> Também deferida: a validação de valores de enum (`collaboratorType`,
> `partnershipStatus`) dentro das Security Rules. A spec a prevê, mas para o
> esqueleto as rules cobrem o essencial (grupo + papel + soft-delete); a
> validação de enum entra quando o padrão de rules estiver consolidado.
