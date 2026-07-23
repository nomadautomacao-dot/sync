# Fase 2.3 — Frente A: matar as telas de erro (Firestore) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Nenhuma tela do app fica quebrada por causa do Postgres morto — Cidades/Pipeline, Settings, Audit/Inbox e Dashboard passam a ler/escrever no Firestore (ou degradar vazios), repetindo o padrão strangler-fig já provado nas fases 2.1 e 2.2.

**Architecture:** Mesmo desenho das fases anteriores. Um _mapper_ puro (doc↔modelo), um _service_ com CRUD escopado por `groupId` das claims + soft delete, e o `HybridSyncRepository` delegando ao service quando `remoteEnabled`. Dashboard não tem CRUD — é um _service_ de leitura que agrega contagens do Firestore. Audit/Inbox leem uma coleção `audit` (vazia por ora; escrita de auditoria segue adiada para a fase de Cloud Functions).

**Tech Stack:** Flutter/Dart, `cloud_firestore`, `fake_cloud_firestore` (testes), Firebase Security Rules + `@firebase/rules-unit-testing` no emulador.

## Global Constraints

- **`groupId` nunca vem do cliente** — sempre injetado pelo service via `groupIdLoader` (claims do ID token), como em `CompanyFirestoreService`.
- **Dinheiro é inteiro em centavos, nunca double.** `estimatedAnnualRevenue` (reais, double na UI) é gravado como `estimatedAnnualRevenueCents` (int) no Firestore. Conversão num único lugar: `reaisToCents(r) = (r*100).round()`, `centsToReais(c) = c/100.0`.
- **Soft delete, nunca delete real.** Exclusão = `deletedAt` (serverTimestamp). Rules negam `delete`. Listagens filtram `where('deletedAt', isNull: true)`. Use `isNull: true`, nunca `isEqualTo: null`.
- **Rótulos/enums crus preservados** com os mesmos textos que o Postgres produzia; a tolerância de aliases (`stage`↔`currentStage`, `codigoIbge`↔`ibgeCode`, `probability`↔`forecastProbability`) fica só na conversão, não vaza pra UI.
- **Cores de `SaaSTokens`** (tema claro), nunca `SyncPalette`.
- **Sem escrita de auditoria** nesta fatia (adiada). `getAudit` só lê; coleção começa vazia → Inbox mostra estado vazio, sem erro.
- **KPIs de dinheiro do Dashboard ficam zerados** (Frente B fará via Cloud Functions). Só KPIs de contagem são reais.
- **Test gate:** rodar suites Firestore por PATH EXPLÍCITO (bare `flutter test` descarta silenciosamente os arquivos Firestore no Flutter 3.38.7). SDK pinado: `~/sync_tooling/flutter/bin/flutter` (3.38.7).

---

## File Structure

**Criar:**
- `sync_flutter/lib/src/core/data/city_firestore_mapper.dart` — CityAccount↔doc + cents helpers.
- `sync_flutter/lib/src/core/data/city_firestore_service.dart` — CRUD de cidades no Firestore.
- `sync_flutter/lib/src/core/data/workspace_settings_firestore_service.dart` — get/set do doc singleton de settings.
- `sync_flutter/lib/src/core/data/audit_firestore_service.dart` — leitura da coleção `audit`.
- `sync_flutter/lib/src/core/data/dashboard_firestore_service.dart` — agrega contagens do Firestore.
- Testes correspondentes em `sync_flutter/test/`.
- `firestore-rules-test/cities.rules.test.mjs`, `settings.rules.test.mjs`, `audit.rules.test.mjs`.

**Modificar:**
- `sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart` — delegar cities/settings/audit/dashboard aos services.
- `sync_flutter/lib/src/app/app.dart` — construir os novos services (mesma closure de claims).
- `sync_flutter/lib/src/features/pipeline/presentation/pipeline_screen.dart` — guardas `mounted` (fix do setState pós-dispose).
- `firestore.rules`, `firestore.indexes.json` — coleções `cities`, `workspace_settings`, `audit`.

**Modelo de documento Firestore:**

`cities/{autoId}`: `groupId, name, uf, codigoIbge, status, stage, collaboratorId, collaboratorName, estimatedAnnualRevenueCents (int), probability (int), nextStepDescription, nextStepDueDate, lastActivityAt, createdAt, updatedAt, deletedAt:null`

`workspace_settings/{groupId}`: `groupId, groupName, slug, rawSettings (map), updatedAt`

`audit/{autoId}`: `groupId, action, createdAt` (só leitura nesta fatia)

---

## Task 1: Mapper de Cidade (com centavos)

**Files:**
- Create: `sync_flutter/lib/src/core/data/city_firestore_mapper.dart`
- Test: `sync_flutter/test/city_firestore_mapper_test.dart`

**Interfaces:**
- Consumes: `CityAccount` de `core/models/sync_models.dart` (campos: id, name, uf, codigoIbge, status, stage, collaboratorId?, collaboratorName?, estimatedAnnualRevenue:double, probability:int, nextStepDescription?, nextStepDueDate?, lastActivityAt?).
- Produces:
  - `int reaisToCents(num reais)` → `(reais*100).round()`
  - `double centsToReais(int cents)` → `cents/100.0`
  - `Map<String,dynamic> cityDocFromInput(Map<String,dynamic> input, String groupId)` — aceita tanto `estimatedAnnualRevenue` (reais) quanto `stage`/`currentStage`; grava `estimatedAnnualRevenueCents`.
  - `CityAccount cityFromDoc(String id, Map<String,dynamic> data)`

- [ ] **Step 1: Escrever o teste que falha**

Criar `sync_flutter/test/city_firestore_mapper_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/city_firestore_mapper.dart';

void main() {
  test('reais<->cents sem perda de precisao', () {
    expect(reaisToCents(150000), 15000000);
    expect(reaisToCents(1234.56), 123456);
    expect(centsToReais(123456), 1234.56);
  });

  test('cityDocFromInput injeta groupId, cents e deletedAt null', () {
    final doc = cityDocFromInput({
      'name': 'Arapiraca',
      'uf': 'AL',
      'codigoIbge': '2700300',
      'stage': 'mapping',
      'estimatedAnnualRevenue': 150000.0,
      'probability': 20,
      'collaboratorId': 'c1',
      'collaboratorName': 'Rafael',
    }, 'grupo-1');

    expect(doc['groupId'], 'grupo-1');
    expect(doc['name'], 'Arapiraca');
    expect(doc['stage'], 'mapping');
    expect(doc['estimatedAnnualRevenueCents'], 15000000);
    expect(doc.containsKey('estimatedAnnualRevenue'), isFalse); // so cents no doc
    expect(doc['probability'], 20);
    expect(doc['status'], 'ativo'); // default
    expect(doc['deletedAt'], isNull);
  });

  test('cityDocFromInput aceita currentStage como alias de stage', () {
    final doc = cityDocFromInput({
      'name': 'X', 'uf': 'BA', 'currentStage': 'contractual',
    }, 'grupo-1');
    expect(doc['stage'], 'contractual');
  });

  test('cityFromDoc converte cents de volta para reais', () {
    final c = cityFromDoc('city1', {
      'groupId': 'grupo-1',
      'name': 'Arapiraca',
      'uf': 'AL',
      'codigoIbge': '2700300',
      'status': 'ativo',
      'stage': 'mapping',
      'estimatedAnnualRevenueCents': 15000000,
      'probability': 20,
      'collaboratorId': 'c1',
      'collaboratorName': 'Rafael',
    });

    expect(c.id, 'city1');
    expect(c.name, 'Arapiraca');
    expect(c.stage, 'mapping');
    expect(c.estimatedAnnualRevenue, 150000.0);
    expect(c.probability, 20);
    expect(c.collaboratorName, 'Rafael');
  });

  test('cityFromDoc tolera campos ausentes', () {
    final c = cityFromDoc('city1', {'groupId': 'g', 'name': 'Y', 'uf': 'GO'});
    expect(c.status, 'ativo');
    expect(c.stage, 'mapping');
    expect(c.estimatedAnnualRevenue, 0.0);
    expect(c.probability, 10);
  });
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/city_firestore_mapper_test.dart`
Expected: FAIL — arquivo não existe.

- [ ] **Step 3: Implementar o mapper**

Criar `sync_flutter/lib/src/core/data/city_firestore_mapper.dart`:

```dart
import '../models/sync_models.dart';

/// Dinheiro nunca é double no Firestore — reais viram centavos inteiros.
int reaisToCents(num reais) => (reais * 100).round();
double centsToReais(int cents) => cents / 100.0;

String? _str(dynamic v) => v is String && v.isNotEmpty ? v : null;
int _int(dynamic v) => v is int ? v : (v is num ? v.round() : (int.tryParse('$v') ?? 0));

/// Monta o doc a gravar. Aceita `estimatedAnnualRevenue` (reais) e converte
/// para cents; aceita `stage` ou o alias `currentStage`. groupId é injetado.
Map<String, dynamic> cityDocFromInput(
  Map<String, dynamic> input,
  String groupId,
) {
  final revenue = input['estimatedAnnualRevenue'];
  return {
    'groupId': groupId,
    'name': input['name'],
    'uf': input['uf'],
    'codigoIbge': _str(input['codigoIbge']) ?? _str(input['ibgeCode']) ?? '',
    'status': _str(input['status']) ?? 'ativo',
    'stage': _str(input['stage']) ?? _str(input['currentStage']) ?? 'mapping',
    'collaboratorId': _str(input['collaboratorId']),
    'collaboratorName': _str(input['collaboratorName']),
    'estimatedAnnualRevenueCents': revenue is num ? reaisToCents(revenue) : 0,
    'probability': input['probability'] is num ? _int(input['probability']) : 10,
    'nextStepDescription': _str(input['nextStepDescription']),
    'nextStepDueDate': _str(input['nextStepDueDate']),
    'lastActivityAt': _str(input['lastActivityAt']),
    'deletedAt': null,
  };
}

CityAccount cityFromDoc(String id, Map<String, dynamic> data) {
  return CityAccount(
    id: id,
    name: (data['name'] as String?) ?? '',
    uf: (data['uf'] as String?) ?? '',
    codigoIbge: (data['codigoIbge'] as String?) ?? '',
    status: (data['status'] as String?) ?? 'ativo',
    stage: (data['stage'] as String?) ?? 'mapping',
    collaboratorId: _str(data['collaboratorId']),
    collaboratorName: _str(data['collaboratorName']),
    estimatedAnnualRevenue: centsToReais(_int(data['estimatedAnnualRevenueCents'])),
    probability: data['probability'] is num ? _int(data['probability']) : 10,
    nextStepDescription: _str(data['nextStepDescription']),
    nextStepDueDate: _str(data['nextStepDueDate']),
    lastActivityAt: _str(data['lastActivityAt']),
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/city_firestore_mapper_test.dart`
Expected: PASS (5 grupos verdes).

- [ ] **Step 5: Commit**

```bash
git add sync_flutter/lib/src/core/data/city_firestore_mapper.dart sync_flutter/test/city_firestore_mapper_test.dart
git commit -m "feat: mapper Firestore de cidade (revenue em centavos inteiros)"
```

---

## Task 2: Service Firestore de Cidades

**Files:**
- Create: `sync_flutter/lib/src/core/data/city_firestore_service.dart`
- Test: `sync_flutter/test/city_firestore_service_test.dart`

**Interfaces:**
- Consumes: `city_firestore_mapper.dart` (Task 1); `CityAccount`.
- Produces — classe `CityFirestoreService`:
  - `CityFirestoreService({required FirebaseFirestore firestore, required Future<String?> Function() groupIdLoader})`
  - `Future<List<CityAccount>> list({String search = '', String stage = ''})`
  - `Future<CityAccount> create(Map<String,dynamic> input)`
  - `Future<void> updateStage(String cityId, String stage)`
  - `Future<void> updatePipeline(String cityId, Map<String,dynamic> data)`

- [ ] **Step 1: Escrever o teste que falha**

Criar `sync_flutter/test/city_firestore_service_test.dart`:

```dart
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/city_firestore_service_test.dart`
Expected: FAIL — arquivo não existe.

- [ ] **Step 3: Implementar o service**

Criar `sync_flutter/lib/src/core/data/city_firestore_service.dart`:

```dart
import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/sync_models.dart';
import 'city_firestore_mapper.dart';

/// CRUD de cidades (pipeline) no Firestore. Escopo por grupo via claims;
/// soft delete via deletedAt. Espelha CompanyFirestoreService.
class CityFirestoreService {
  CityFirestoreService({
    required FirebaseFirestore firestore,
    required Future<String?> Function() groupIdLoader,
  })  : _firestore = firestore,
        _groupIdLoader = groupIdLoader;

  final FirebaseFirestore _firestore;
  final Future<String?> Function() _groupIdLoader;

  CollectionReference<Map<String, dynamic>> get _col =>
      _firestore.collection('cities');

  Future<String> _requireGroupId() async {
    final groupId = await _groupIdLoader();
    if (groupId == null || groupId.isEmpty) {
      throw StateError('Usuario sem groupId nas claims — acesso nao configurado.');
    }
    return groupId;
  }

  Future<List<CityAccount>> list({String search = '', String stage = ''}) async {
    final groupId = await _requireGroupId();
    final snap = await _col
        .where('groupId', isEqualTo: groupId)
        .where('deletedAt', isNull: true)
        .get();
    final term = search.trim().toLowerCase();
    final wantStage = stage.trim();
    return snap.docs.map((d) => cityFromDoc(d.id, d.data())).where((c) {
      if (wantStage.isNotEmpty && c.stage != wantStage) return false;
      if (term.isNotEmpty) {
        final hay = '${c.name} ${c.uf} ${c.codigoIbge}'.toLowerCase();
        if (!hay.contains(term)) return false;
      }
      return true;
    }).toList();
  }

  Future<CityAccount> create(Map<String, dynamic> input) async {
    final groupId = await _requireGroupId();
    final doc = cityDocFromInput(input, groupId);
    doc['createdAt'] = FieldValue.serverTimestamp();
    doc['updatedAt'] = FieldValue.serverTimestamp();
    final ref = await _col.add(doc);
    return cityFromDoc(ref.id, doc);
  }

  Future<void> updateStage(String cityId, String stage) async {
    await _col.doc(cityId).set({
      'stage': stage,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  /// Atualiza campos do pipeline. Converte estimatedAnnualRevenue (reais) em
  /// cents; nunca grava groupId/deletedAt a partir do input.
  Future<void> updatePipeline(String cityId, Map<String, dynamic> data) async {
    final patch = <String, dynamic>{'updatedAt': FieldValue.serverTimestamp()};
    for (final entry in data.entries) {
      if (entry.key == 'groupId' || entry.key == 'deletedAt') continue;
      if (entry.key == 'estimatedAnnualRevenue' && entry.value is num) {
        patch['estimatedAnnualRevenueCents'] = reaisToCents(entry.value as num);
      } else if (entry.key == 'currentStage') {
        patch['stage'] = entry.value;
      } else {
        patch[entry.key] = entry.value;
      }
    }
    await _col.doc(cityId).set(patch, SetOptions(merge: true));
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/city_firestore_service_test.dart`
Expected: PASS (6 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add sync_flutter/lib/src/core/data/city_firestore_service.dart sync_flutter/test/city_firestore_service_test.dart
git commit -m "feat: service Firestore de cidades (escopo por grupo, cents, soft delete)"
```

---

## Task 3: Wire de Cidades no Hybrid + app

**Files:**
- Modify: `sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart`
- Modify: `sync_flutter/lib/src/app/app.dart`

**Interfaces:**
- Consumes: `CityFirestoreService` (Task 2).
- Produces: `getCities`/`createCity`/`updateCityStage`/`updateCityPipeline` resolvem via Firestore quando `_mustUseRemote`.

- [ ] **Step 1: Adicionar o service ao Hybrid**

Em `hybrid_sync_repository.dart`, adicionar o import `import '../data/city_firestore_service.dart';`, o campo `final CityFirestoreService _cities;` e o parâmetro `required CityFirestoreService cities` no construtor (inicializando `_cities = cities`), espelhando `_companies`.

- [ ] **Step 2: Delegar os 4 métodos de cidade**

Substituir os corpos de `getCities`, `createCity`, `updateCityStage`, `updateCityPipeline` para delegar ao `_cities` quando `_mustUseRemote`:

```dart
  @override
  Future<List<CityAccount>> getCities({String search = '', String stage = ''}) async {
    if (_mustUseRemote) return _cities.list(search: search, stage: stage);
    return _local.getCities(search: search, stage: stage);
  }

  @override
  Future<CityAccount> createCity(Map<String, dynamic> data) async {
    if (_mustUseRemote) return _cities.create(data);
    return _local.createCity(data);
  }

  @override
  Future<void> updateCityStage(String cityId, String stage) async {
    if (_mustUseRemote) return _cities.updateStage(cityId, stage);
    return _local.updateCityStage(cityId, stage);
  }

  @override
  Future<void> updateCityPipeline(String cityId, Map<String, dynamic> data) async {
    if (_mustUseRemote) return _cities.updatePipeline(cityId, data);
    return _local.updateCityPipeline(cityId, data);
  }
```

- [ ] **Step 3: Construir no app.dart**

Em `app.dart`, dentro do `HybridSyncRepository(...)`, adicionar (reusando o `_loadGroupIdFromClaims` já existente):

```dart
        cities: CityFirestoreService(
          firestore: FirebaseFirestore.instance,
          groupIdLoader: _loadGroupIdFromClaims,
        ),
```

Se `_loadGroupIdFromClaims` não existir como método (foi introduzido na 2.2), usar a mesma closure inline das outras services: `() async { final r = await FirebaseAuth.instance.currentUser?.getIdTokenResult(); return r?.claims?['groupId'] as String?; }`.

- [ ] **Step 4: Verificar compilação e suíte**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter analyze lib/src/core/repositories/ lib/src/app/app.dart`
Expected: `No issues found!`

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/city_firestore_service_test.dart test/city_firestore_mapper_test.dart test/widget_test.dart`
Expected: PASS. `widget_test.dart` é o gate de regressão do construtor do Hybrid — se falhar ao compilar, faltou passar `cities:` em app.dart.

- [ ] **Step 5: Commit**

```bash
git add sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart sync_flutter/lib/src/app/app.dart
git commit -m "feat: Hybrid delega cidades/pipeline ao Firestore"
```

---

## Task 4: Fix do setState pós-dispose no Pipeline

**Files:**
- Modify: `sync_flutter/lib/src/features/pipeline/presentation/pipeline_screen.dart`

**Interfaces:** nenhuma nova — apenas robustez.

O `pipeline_screen.dart` chama `setState` depois de `await` sem guarda de `mounted` em três métodos (`_fetchCities` ~86-104, `_changeCityStage` ~106-133, `_saveCityDetails` ~135+). Se a tela é descartada durante a chamada (ex.: usuário troca de aba enquanto `getCities` está em voo), dá `setState() called after dispose()`.

- [ ] **Step 1: Ler o arquivo e localizar os três métodos**

Ler `sync_flutter/lib/src/features/pipeline/presentation/pipeline_screen.dart` e localizar cada `setState` que vem DEPOIS de um `await`.

- [ ] **Step 2: Adicionar guarda `if (!mounted) return;` após cada await**

Em CADA um dos três métodos, imediatamente após o `await` (e antes do `setState` correspondente), inserir a guarda. Exemplo em `_fetchCities`:

```dart
  Future<void> _fetchCities() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final cities = await widget.repository.getCities(search: _searchQuery);
      if (!mounted) return;
      setState(() {
        _cities = cities;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Falha ao carregar pipeline: $e';
        _isLoading = false;
      });
    }
  }
```

Aplicar a mesma guarda (`if (!mounted) return;` logo após o `await`, antes do `setState`, em ambos os ramos try/catch quando houver) em `_changeCityStage` e `_saveCityDetails`. Não mudar nenhuma outra lógica.

- [ ] **Step 3: Verificar compilação**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter analyze lib/src/features/pipeline/`
Expected: `No issues found!`

- [ ] **Step 4: Commit**

```bash
git add sync_flutter/lib/src/features/pipeline/presentation/pipeline_screen.dart
git commit -m "fix: guardar mounted antes de setState pos-await no pipeline (setState pos-dispose)"
```

---

## Task 5: Workspace Settings no Firestore

**Files:**
- Create: `sync_flutter/lib/src/core/data/workspace_settings_firestore_service.dart`
- Test: `sync_flutter/test/workspace_settings_firestore_service_test.dart`
- Modify: `hybrid_sync_repository.dart`, `app.dart`

**Interfaces:**
- Consumes: `WorkspaceSettings` de `core/models/sync_models.dart` (campos: id, groupName, slug, rawSettings:Map).
- Produces — classe `WorkspaceSettingsFirestoreService`:
  - `WorkspaceSettingsFirestoreService({required FirebaseFirestore firestore, required Future<String?> Function() groupIdLoader})`
  - `Future<WorkspaceSettings> get()` — lê `workspace_settings/{groupId}`; se não existir, devolve default com id=groupId, nome/slug vazios, rawSettings {}.
  - `Future<WorkspaceSettings> update(WorkspaceSettings settings)` — grava merge no doc do grupo.

- [ ] **Step 1: Escrever o teste que falha**

Criar `sync_flutter/test/workspace_settings_firestore_service_test.dart`:

```dart
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/workspace_settings_firestore_service_test.dart`
Expected: FAIL — arquivo não existe.

- [ ] **Step 3: Implementar o service**

Criar `sync_flutter/lib/src/core/data/workspace_settings_firestore_service.dart`:

```dart
import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/sync_models.dart';

/// Settings do workspace = um doc singleton por grupo (id do doc = groupId).
class WorkspaceSettingsFirestoreService {
  WorkspaceSettingsFirestoreService({
    required FirebaseFirestore firestore,
    required Future<String?> Function() groupIdLoader,
  })  : _firestore = firestore,
        _groupIdLoader = groupIdLoader;

  final FirebaseFirestore _firestore;
  final Future<String?> Function() _groupIdLoader;

  Future<String> _requireGroupId() async {
    final groupId = await _groupIdLoader();
    if (groupId == null || groupId.isEmpty) {
      throw StateError('Usuario sem groupId nas claims — acesso nao configurado.');
    }
    return groupId;
  }

  DocumentReference<Map<String, dynamic>> _doc(String groupId) =>
      _firestore.collection('workspace_settings').doc(groupId);

  Future<WorkspaceSettings> get() async {
    final groupId = await _requireGroupId();
    final snap = await _doc(groupId).get();
    final data = snap.data();
    if (data == null) {
      return WorkspaceSettings(
        id: groupId, groupName: '', slug: '', rawSettings: const {});
    }
    final raw = data['rawSettings'];
    return WorkspaceSettings(
      id: groupId,
      groupName: (data['groupName'] as String?) ?? '',
      slug: (data['slug'] as String?) ?? '',
      rawSettings: raw is Map<String, dynamic> ? raw : const {},
    );
  }

  Future<WorkspaceSettings> update(WorkspaceSettings settings) async {
    final groupId = await _requireGroupId();
    await _doc(groupId).set({
      'groupId': groupId,
      'groupName': settings.groupName,
      'slug': settings.slug,
      'rawSettings': settings.rawSettings,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
    return get();
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/workspace_settings_firestore_service_test.dart`
Expected: PASS (4 testes).

- [ ] **Step 5: Wire no Hybrid + app**

Em `hybrid_sync_repository.dart`: import + campo `_settings` + param `settings` no construtor (mesmo padrão). Trocar `getWorkspaceSettings`/`updateWorkspaceSettings`:

```dart
  @override
  Future<WorkspaceSettings> getWorkspaceSettings() async {
    if (_mustUseRemote) {
      final remote = await _settings.get();
      await _local.cacheSettings(remote);
      return remote;
    }
    return _local.getWorkspaceSettings();
  }

  @override
  Future<WorkspaceSettings> updateWorkspaceSettings(WorkspaceSettings settings) async {
    if (_mustUseRemote) {
      final remote = await _settings.update(settings);
      await _local.cacheSettings(remote);
      return remote;
    }
    return _local.updateWorkspaceSettings(settings);
  }
```

Em `app.dart`: construir `settings: WorkspaceSettingsFirestoreService(firestore: FirebaseFirestore.instance, groupIdLoader: _loadGroupIdFromClaims)`.

- [ ] **Step 6: Verificar e commit**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter analyze lib/src/core/ lib/src/app/app.dart`
Expected: `No issues found!`
Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/workspace_settings_firestore_service_test.dart test/widget_test.dart`
Expected: PASS.

```bash
git add sync_flutter/lib/src/core/data/workspace_settings_firestore_service.dart sync_flutter/test/workspace_settings_firestore_service_test.dart sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart sync_flutter/lib/src/app/app.dart
git commit -m "feat: workspace settings no Firestore (doc singleton por grupo)"
```

---

## Task 6: Audit/Inbox lê do Firestore (degrada vazio)

**Files:**
- Create: `sync_flutter/lib/src/core/data/audit_firestore_service.dart`
- Test: `sync_flutter/test/audit_firestore_service_test.dart`
- Modify: `hybrid_sync_repository.dart`, `app.dart`

**Interfaces:**
- Consumes: `AuditEntry` de `core/models/sync_models.dart` (campos: action, createdAt:String).
- Produces — classe `AuditFirestoreService`:
  - `AuditFirestoreService({required FirebaseFirestore firestore, required Future<String?> Function() groupIdLoader})`
  - `Future<List<AuditEntry>> list({int limit = 20})` — lê `audit` do grupo, ordenado por `createdAt` desc, limitado; formata createdAt como `dd/MM/yyyy HH:mm`. Coleção começa vazia → devolve `[]` sem erro.

- [ ] **Step 1: Escrever o teste que falha**

Criar `sync_flutter/test/audit_firestore_service_test.dart`:

```dart
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/audit_firestore_service_test.dart`
Expected: FAIL — arquivo não existe.

- [ ] **Step 3: Implementar o service**

Criar `sync_flutter/lib/src/core/data/audit_firestore_service.dart`:

```dart
import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/sync_models.dart';

/// Leitura do log de auditoria (feed do Inbox). Escrita fica adiada para a
/// fase de Cloud Functions — por ora a colecao pode estar vazia (Inbox vazio).
class AuditFirestoreService {
  AuditFirestoreService({
    required FirebaseFirestore firestore,
    required Future<String?> Function() groupIdLoader,
  })  : _firestore = firestore,
        _groupIdLoader = groupIdLoader;

  final FirebaseFirestore _firestore;
  final Future<String?> Function() _groupIdLoader;

  Future<String> _requireGroupId() async {
    final groupId = await _groupIdLoader();
    if (groupId == null || groupId.isEmpty) {
      throw StateError('Usuario sem groupId nas claims — acesso nao configurado.');
    }
    return groupId;
  }

  String _fmt(dynamic ts) {
    DateTime? dt;
    if (ts is Timestamp) dt = ts.toDate().toLocal();
    if (ts is String) dt = DateTime.tryParse(ts)?.toLocal();
    if (dt == null) return '';
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(dt.day)}/${two(dt.month)}/${dt.year} ${two(dt.hour)}:${two(dt.minute)}';
  }

  Future<List<AuditEntry>> list({int limit = 20}) async {
    final groupId = await _requireGroupId();
    final snap = await _firestore
        .collection('audit')
        .where('groupId', isEqualTo: groupId)
        .orderBy('createdAt', descending: true)
        .limit(limit)
        .get();
    return snap.docs
        .map((d) => AuditEntry(
              action: (d.data()['action'] as String?) ?? '',
              createdAt: _fmt(d.data()['createdAt']),
            ))
        .toList();
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/audit_firestore_service_test.dart`
Expected: PASS (3 testes).

- [ ] **Step 5: Wire no Hybrid + app**

Em `hybrid_sync_repository.dart`: import + campo `_audit` + param `audit`. Trocar `getAudit`:

```dart
  @override
  Future<List<AuditEntry>> getAudit({int limit = 20}) async {
    if (_mustUseRemote) {
      final remote = await _audit.list(limit: limit);
      await _local.cacheAudit(remote);
      return remote;
    }
    return _local.getAudit(limit: limit);
  }
```

Em `app.dart`: `audit: AuditFirestoreService(firestore: FirebaseFirestore.instance, groupIdLoader: _loadGroupIdFromClaims)`.

- [ ] **Step 6: Verificar e commit**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter analyze lib/src/core/ lib/src/app/app.dart`
Expected: `No issues found!`
Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/audit_firestore_service_test.dart test/widget_test.dart`
Expected: PASS.

```bash
git add sync_flutter/lib/src/core/data/audit_firestore_service.dart sync_flutter/test/audit_firestore_service_test.dart sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart sync_flutter/lib/src/app/app.dart
git commit -m "feat: audit/inbox le do Firestore (degrada vazio, sem Postgres)"
```

---

## Task 7: Dashboard agrega contagens do Firestore

**Files:**
- Create: `sync_flutter/lib/src/core/data/dashboard_firestore_service.dart`
- Test: `sync_flutter/test/dashboard_firestore_service_test.dart`
- Modify: `hybrid_sync_repository.dart`, `app.dart`

**Interfaces:**
- Consumes: `DashboardOverview`, `KpiMetric`, `MonthlyPoint` de `core/models/sync_models.dart`. Ver o mapeamento existente em `remote_sync_repository.dart` `_mapDashboard` para os rótulos dos KPIs.
- Produces — classe `DashboardFirestoreService`:
  - `DashboardFirestoreService({required FirebaseFirestore firestore, required Future<String?> Function() groupIdLoader})`
  - `Future<DashboardOverview> overview({int? year})` — conta docs não-deletados do grupo em `cities`, `collaborators`, `companies`; monta KPIs de contagem reais e KPIs de dinheiro zerados; `monthlyTrend`/`alerts`/`portfolioMix`/`topMunicipalities` vazios.

> Sem `lucide_icons_flutter`/cores hard-coded além do necessário: reutilizar `SaaSTokens` para as cores dos KPIs. Ícones: usar os mesmos `Icons.*`/`LucideIcons.*` que a tela já espera — ver `KpiMetric` no `dashboard_screen.dart` (o campo `icon` é `IconData`). Para manter simples e sem dependência de lucide no service, usar `Icons.location_city`, `Icons.groups`, `Icons.apartment`, `Icons.attach_money` do Material.

- [ ] **Step 1: Escrever o teste que falha**

Criar `sync_flutter/test/dashboard_firestore_service_test.dart`:

```dart
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/dashboard_firestore_service_test.dart`
Expected: FAIL — arquivo não existe.

- [ ] **Step 3: Implementar o service**

Criar `sync_flutter/lib/src/core/data/dashboard_firestore_service.dart`:

```dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../models/sync_models.dart';
import '../theme/app_theme.dart';

/// Dashboard como agregacao de contagens do Firestore. KPIs de contagem sao
/// reais; KPIs de dinheiro ficam zerados ate a Frente B (Cloud Functions).
class DashboardFirestoreService {
  DashboardFirestoreService({
    required FirebaseFirestore firestore,
    required Future<String?> Function() groupIdLoader,
  })  : _firestore = firestore,
        _groupIdLoader = groupIdLoader;

  final FirebaseFirestore _firestore;
  final Future<String?> Function() _groupIdLoader;

  Future<String> _requireGroupId() async {
    final groupId = await _groupIdLoader();
    if (groupId == null || groupId.isEmpty) {
      throw StateError('Usuario sem groupId nas claims — acesso nao configurado.');
    }
    return groupId;
  }

  Future<int> _count(String col, String groupId) async {
    final snap = await _firestore
        .collection(col)
        .where('groupId', isEqualTo: groupId)
        .where('deletedAt', isNull: true)
        .get();
    return snap.size;
  }

  Future<DashboardOverview> overview({int? year}) async {
    final groupId = await _requireGroupId();
    final cities = await _count('cities', groupId);
    final collaborators = await _count('collaborators', groupId);
    final companies = await _count('companies', groupId);

    KpiMetric count(String label, int value, String helper, IconData icon, Color color) =>
        KpiMetric(label: label, value: '$value', helper: helper, icon: icon, color: color);
    KpiMetric money(String label, String helper, IconData icon, Color color) =>
        KpiMetric(label: label, value: 'R\$ 0', helper: helper, icon: icon, color: color);

    return DashboardOverview(
      year: year ?? 2026,
      projectedGrossRevenue: 0,
      projectedProfit: 0,
      projectedMargin: 0,
      implementationCoverage: 0,
      kpis: [
        count('Cidades trabalhadas', cities, 'municipios no pipeline',
            Icons.location_city, SaaSTokens.primary),
        count('Colaboradores', collaborators, 'parceiros e articuladores',
            Icons.groups, SaaSTokens.success),
        count('Empresas', companies, 'empresas do grupo',
            Icons.apartment, SaaSTokens.warning),
        money('Lucro base YTD', 'via motor financeiro (em breve)',
            Icons.attach_money, SaaSTokens.gold),
        money('Comissao prevista', 'via motor financeiro (em breve)',
            Icons.attach_money, SaaSTokens.goldDim),
      ],
      monthlyTrend: const [],
      alerts: const [],
      portfolioMix: const [],
      topMunicipalities: const [],
    );
  }
}
```

> Se algum campo de `DashboardOverview`/`KpiMetric` diferir (ordem/obrigatoriedade), ajustar ao construtor real lido em `sync_models.dart` — os nomes `alerts`/`portfolioMix`/`topMunicipalities` vêm do mapa da Explore; confirmar no arquivo e usar listas vazias `const []` para todos.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/dashboard_firestore_service_test.dart`
Expected: PASS (4 testes).

- [ ] **Step 5: Wire no Hybrid + app**

Em `hybrid_sync_repository.dart`: import + campo `_dashboard` + param `dashboard`. Trocar `getDashboard`:

```dart
  @override
  Future<DashboardOverview> getDashboard({int? year}) async {
    if (_mustUseRemote) {
      final remote = await _dashboard.overview(year: year);
      await _local.cacheDashboard(remote);
      return remote;
    }
    return _local.getDashboard(year: year);
  }
```

> Se `_local` não tiver `cacheDashboard`, omitir a linha de cache (apenas `return remote;`). Confirmar no `local_sync_repository.dart`.

Em `app.dart`: `dashboard: DashboardFirestoreService(firestore: FirebaseFirestore.instance, groupIdLoader: _loadGroupIdFromClaims)`.

- [ ] **Step 6: Verificar e commit**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter analyze lib/src/core/ lib/src/app/app.dart`
Expected: `No issues found!`
Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/dashboard_firestore_service_test.dart test/widget_test.dart`
Expected: PASS.

```bash
git add sync_flutter/lib/src/core/data/dashboard_firestore_service.dart sync_flutter/test/dashboard_firestore_service_test.dart sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart sync_flutter/lib/src/app/app.dart
git commit -m "feat: dashboard agrega contagens do Firestore (KPIs de dinheiro zerados)"
```

---

## Task 8: Security Rules, índices e testes das novas coleções

**Files:**
- Modify: `firestore.rules`, `firestore.indexes.json`
- Create: `firestore-rules-test/cities.rules.test.mjs`, `firestore-rules-test/settings.rules.test.mjs`, `firestore-rules-test/audit.rules.test.mjs`

**Interfaces:** coleções `cities`, `workspace_settings`, `audit`.

> DEPLOY: NÃO rodar `firebase deploy` — o controller cuida do deploy de produção separadamente.

- [ ] **Step 1: Escrever os testes de regra que falham**

Criar três arquivos em `firestore-rules-test/`, espelhando `companies.rules.test.mjs` (que lê `firestore.rules` do cwd da raiz). Cada um cobre: read own-group ok, read other-group falha, create admin ok, create membro falha, create-hijack falha, delete negado, update admin ok, update-hijack negado.

- `cities.rules.test.mjs` — coleção `cities`, seed `{ groupId, name:'X', deletedAt:null }`.
- `settings.rules.test.mjs` — coleção `workspace_settings`, doc id = groupId, seed `{ groupId, groupName:'X' }`. (Sem hijack de id: id é o groupId; testar que membro do grupo lê/escreve o próprio doc e outro grupo não.)
- `audit.rules.test.mjs` — coleção `audit`, seed `{ groupId, action:'x', createdAt: <Timestamp> }`. Só `read` (own-group ok, other-group falha); `create`/`update`/`delete` negados a todos (escrita de auditoria será só via Cloud Functions/admin no futuro).

- [ ] **Step 2: Rodar e ver falhar (emulador)**

Run: `cd "$(git rev-parse --show-toplevel)" && firebase emulators:exec --only firestore "node --test firestore-rules-test/cities.rules.test.mjs firestore-rules-test/settings.rules.test.mjs firestore-rules-test/audit.rules.test.mjs"`
Expected: FAIL — sem regras para as coleções (default deny/allow indefinido).

- [ ] **Step 3: Adicionar as regras**

Em `firestore.rules`, dentro do bloco `match /databases/{database}/documents`, após as regras de `employees`:

```
    match /cities/{id} {
      allow read: if isSignedIn() && resource.data.groupId == myGroupId();
      allow create: if isAdmin() && request.resource.data.groupId == myGroupId();
      allow update: if isAdmin()
                    && resource.data.groupId == myGroupId()
                    && request.resource.data.groupId == myGroupId();
      allow delete: if false;
    }

    match /workspace_settings/{groupId} {
      allow read: if isSignedIn() && groupId == myGroupId();
      allow create, update: if isAdmin() && groupId == myGroupId()
                            && request.resource.data.groupId == myGroupId();
      allow delete: if false;
    }

    match /audit/{id} {
      allow read: if isSignedIn() && resource.data.groupId == myGroupId();
      // Escrita de auditoria só via backend confiavel (Cloud Functions), nunca cliente.
      allow write: if false;
    }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd "$(git rev-parse --show-toplevel)" && firebase emulators:exec --only firestore "node --test firestore-rules-test/cities.rules.test.mjs firestore-rules-test/settings.rules.test.mjs firestore-rules-test/audit.rules.test.mjs"`
Expected: PASS (todas verdes).

Rodar também as suites já existentes para garantir não-regressão:
Run: `cd "$(git rev-parse --show-toplevel)" && firebase emulators:exec --only firestore "node --test firestore-rules-test/companies.rules.test.mjs firestore-rules-test/employees.rules.test.mjs firestore-rules-test/collaborators.rules.test.mjs"`
Expected: 26/26 (sem regressão).

- [ ] **Step 5: Índices**

Em `firestore.indexes.json`, adicionar (mantendo os existentes):

```json
    {
      "collectionGroup": "cities",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "groupId", "order": "ASCENDING" },
        { "fieldPath": "deletedAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "audit",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "groupId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
```

- [ ] **Step 6: Commit**

```bash
git add firestore.rules firestore.indexes.json firestore-rules-test/cities.rules.test.mjs firestore-rules-test/settings.rules.test.mjs firestore-rules-test/audit.rules.test.mjs
git commit -m "feat: rules e indices de cities/workspace_settings/audit"
```

---

## Verificação E2E (manual, pelo usuário — fora do subagent-driven)

Com `npm run dev` na 3100 (após o controller deployar as rules), aba anônima:
1. **Cidades/Pipeline** carrega vazio sem erro; criar uma cidade (Nova Cidade) → aparece; no Firestore `cities/{id}` com `groupId`, `estimatedAnnualRevenueCents` inteiro, `deletedAt:null`; mover de estágio persiste (F5).
2. **Configurações** carrega e salva (doc `workspace_settings/grupo-1`).
3. **Inbox** carrega **vazio** sem erro (não mais "Falha ao comunicar com a API").
4. **Dashboard** carrega: "Cidades trabalhadas"/"Colaboradores"/"Empresas" com contagens reais; KPIs de dinheiro em R$ 0. **Sem tela de erro em lugar nenhum.**

## Self-Review (do autor do plano)

- **Cobertura**: Cities (Tasks 1-3), pipeline bug (Task 4), Settings (Task 5), Audit/Inbox (Task 6), Dashboard (Task 7), Rules (Task 8). Todas as telas que davam 500 cobertas. ✅
- **Dinheiro**: revenue de cidade em cents (Task 1/2); KPIs de dinheiro do Dashboard zerados (Frente B fará via Cloud Functions). ✅
- **Isolamento**: todo service exige groupId das claims; rules por grupo + hijack bloqueado; audit write negado no cliente. ✅
- **Placeholders**: código real em cada passo; onde há "confirmar no arquivo" (ex.: construtor de DashboardOverview, cacheDashboard/cacheSettings no local) é porque o implementador vê o arquivo — os nomes vêm do mapa da Explore. ✅
- **Consistência de tipos**: `list/create/updateStage/updatePipeline` batem entre service (Task 2), Hybrid (Task 3) e as telas; `get/update` de settings (Task 5); `list` de audit (Task 6); `overview` de dashboard (Task 7). ✅
