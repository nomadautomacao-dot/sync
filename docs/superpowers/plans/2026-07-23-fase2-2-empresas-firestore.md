# Fase 2.2 — Empresas + Funcionários no Firestore (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tela "Minha Empresa" passa a ler e escrever Empresas e Funcionários direto no Firestore (strangler fig), com upload de logo no Firebase Storage — repetindo o padrão já provado na fase 2.1 de Colaboradores.

**Architecture:** Mesmo desenho da 2.1. Um _mapper_ puro converte doc↔modelo; um _service_ faz o CRUD escopado por `groupId` (das custom claims) com soft delete; o `HybridSyncRepository` delega os métodos de empresa ao service quando `remoteEnabled`. O logo sai do Supabase Storage (morto) e passa a subir no Firebase Storage, gravando a URL de download no doc da empresa. Auditoria fica adiada (volta na fase de Cloud Functions).

**Tech Stack:** Flutter/Dart, `cloud_firestore`, `firebase_storage` (novo), `fake_cloud_firestore` (testes), Firebase Security Rules + `@firebase/rules-unit-testing` no emulador.

## Global Constraints

- **`groupId` nunca vem do cliente.** É sempre injetado pelo service a partir das claims do ID token (`groupIdLoader`), exatamente como em `CollaboratorFirestoreService`.
- **Soft delete, nunca delete real.** Exclusão = gravar `deletedAt` (serverTimestamp). Rules negam `delete`. Listagens filtram `where('deletedAt', isNull: true)`.
- **`isNull: true`**, nunca `isEqualTo: null` — o SDK e o `fake_cloud_firestore` não tratam `isEqualTo: null` como igualdade válida.
- **Rótulos em português no summary/details**, com os mesmos textos que o `RemoteSyncRepository` produzia (`active`→`Ativo`, `inactive`→`Inativo`, `on_leave`→`Afastado`). A UI conta/exibe o rótulo, não o enum cru.
- **Cores dos cards vêm de `SaaSTokens`** (tema claro), nunca de `SyncPalette` (paleta dark legada) — ver o fix da fase 2.1 no card de colaborador.
- **Rules antes ou junto dos dados.** Toda coleção nova recebe regra de isolamento por grupo antes de ser considerada pronta.
- **Sem `getAll()` sem filtro de grupo.** Toda query começa por `where('groupId', isEqualTo: groupId)`.
- **Sem auditoria nesta fatia.** Escritas não gravam log (decisão registrada; volta na fase de Cloud Functions).
- Flutter SDK pinado: `~/sync_tooling/flutter/bin/flutter` (3.38.7). Rodar testes/analyze sempre com esse binário.

---

## File Structure

**Criar:**
- `sync_flutter/lib/src/core/data/company_firestore_mapper.dart` — funções puras doc↔modelo (Company, Employee) + rótulos + cor.
- `sync_flutter/lib/src/core/data/company_firestore_service.dart` — CRUD Firestore de empresas e funcionários, escopado por grupo, soft delete.
- `sync_flutter/lib/src/core/data/company_logo_storage.dart` — upload de logo no Firebase Storage + builder de path (puro, testável).
- `sync_flutter/test/company_firestore_mapper_test.dart` — testes do mapper.
- `sync_flutter/test/company_firestore_service_test.dart` — testes do service com `fake_cloud_firestore`.
- `sync_flutter/test/company_logo_storage_test.dart` — teste do path builder.
- `sync_flutter/lib/src/features/companies/presentation/new_company_dialog.dart` — form real de "Nova Empresa" (substitui o stub de snackbar).
- `firestore-rules-test/companies.rules.test.mjs` — testes das rules de companies + employees.

**Modificar:**
- `sync_flutter/pubspec.yaml` — adicionar `firebase_storage`.
- `sync_flutter/lib/src/core/repositories/sync_repository.dart` — adicionar `createCompany`.
- `sync_flutter/lib/src/core/repositories/remote_sync_repository.dart` — stub de `createCompany` (lança `UnsupportedError`, o caminho remoto sai de cena).
- `sync_flutter/lib/src/core/repositories/local_sync_repository.dart` — `createCompany` local (mock).
- `sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart` — delegar company/employee ao `CompanyFirestoreService`.
- `sync_flutter/lib/src/app/app.dart` — construir e injetar `CompanyFirestoreService` + `CompanyLogoStorage`.
- `sync_flutter/lib/src/features/companies/presentation/companies_screen.dart` — botão "Nova Empresa" abre o dialog real.
- `sync_flutter/lib/src/features/companies/presentation/company_detail_screen.dart` — "Adicionar funcionário" grava no Firestore; upload de logo via Storage.
- `firestore.rules` — regras de `companies` e `employees`.
- `firestore.indexes.json` — índices compostos (groupId + deletedAt; companyId + deletedAt).
- `storage.rules` (criar se não existir) — regras do Firebase Storage para `company-logos/`.
- `firebase.json` — registrar `storage.rules` se ainda não estiver.

**Modelo de documento Firestore:**

`companies/{autoId}`:
```
groupId, name, tradingName, cnpj, segment, status,
city, state, email, phone, contactName, contactPosition,
enabledModules: [], logo: <url|null>,
createdAt, updatedAt, deletedAt: null
```

`employees/{autoId}`:
```
groupId, companyId, name, email, position, role, status,
createdAt, updatedAt, deletedAt: null
```

---

## Task 1: Dependência do Firebase Storage

**Files:**
- Modify: `sync_flutter/pubspec.yaml:11-14`

**Interfaces:**
- Produces: pacote `firebase_storage` disponível para import em Tasks 4+.

- [ ] **Step 1: Adicionar a dependência**

Em `sync_flutter/pubspec.yaml`, na seção `dependencies`, logo abaixo de `cloud_firestore: ^6.7.1`, adicionar:

```yaml
  firebase_storage: ^13.0.0
```

- [ ] **Step 2: Resolver as dependências**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter pub get`
Expected: `Got dependencies!` sem erro de resolução. Se a versão `^13.0.0` não resolver com o `firebase_core: ^4.12.1` pinado, rodar `~/sync_tooling/flutter/bin/flutter pub add firebase_storage` e aceitar a versão compatível que o resolver escolher; anotar a versão final resolvida.

- [ ] **Step 3: Confirmar que o projeto ainda compila**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter analyze lib/src/app/app.dart`
Expected: `No issues found!`

- [ ] **Step 4: Commit**

```bash
git add sync_flutter/pubspec.yaml sync_flutter/pubspec.lock
git commit -m "build: adicionar firebase_storage para upload de logo"
```

---

## Task 2: Mapper puro de Empresa e Funcionário

**Files:**
- Create: `sync_flutter/lib/src/core/data/company_firestore_mapper.dart`
- Test: `sync_flutter/test/company_firestore_mapper_test.dart`

**Interfaces:**
- Consumes: modelos `CompanySummary`, `CompanyDetails`, `EmployeeRecord` de `core/models/sync_models.dart` (campos já definidos ali).
- Produces:
  - `String companyStatusLabel(String status)` → `active`→`Ativo`, `inactive`→`Inativo`, senão o próprio valor.
  - `String employeeStatusLabel(String status)` → `active`→`Ativo`, `on_leave`→`Afastado`, `inactive`→`Inativo`.
  - `Color companyStatusColor(String label)` → `Ativo`→`SaaSTokens.success`, `Inativo`→`SaaSTokens.textDim`, senão `SaaSTokens.primary`.
  - `Map<String,dynamic> companyDocFromInput(Map<String,dynamic> input, String groupId)`
  - `CompanySummary companySummaryFromDoc(String id, Map<String,dynamic> data)`
  - `CompanyDetails companyDetailsFromDoc(String id, Map<String,dynamic> data)`
  - `Map<String,dynamic> employeeDocFromInput(Map<String,dynamic> input, String groupId)`
  - `EmployeeRecord employeeFromDoc(String id, Map<String,dynamic> data)`

- [ ] **Step 1: Escrever o teste que falha**

Criar `sync_flutter/test/company_firestore_mapper_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/company_firestore_mapper.dart';
import 'package:sync_flutter/src/core/theme/app_theme.dart';

void main() {
  group('rótulos', () {
    test('status de empresa em português', () {
      expect(companyStatusLabel('active'), 'Ativo');
      expect(companyStatusLabel('inactive'), 'Inativo');
      expect(companyStatusLabel('desconhecido'), 'desconhecido');
    });

    test('status de funcionário em português', () {
      expect(employeeStatusLabel('active'), 'Ativo');
      expect(employeeStatusLabel('on_leave'), 'Afastado');
      expect(employeeStatusLabel('inactive'), 'Inativo');
    });

    test('cor de status vem de SaaSTokens (tema claro)', () {
      expect(companyStatusColor('Ativo'), SaaSTokens.success);
      expect(companyStatusColor('Inativo'), SaaSTokens.textDim);
      expect(companyStatusColor('Prospecto'), SaaSTokens.primary);
    });
  });

  group('companyDocFromInput', () {
    test('injeta groupId, default de status e deletedAt null', () {
      final doc = companyDocFromInput({
        'name': 'Rocha Prime Consultorias LTDA',
        'tradingName': 'Rocha Prime',
        'cnpj': '12.345.678/0001-99',
        'city': 'Salvador',
        'state': 'BA',
        'email': 'contato@rochaprime.com',
        'phone': '7133330000',
        'contactName': 'Adriel Tavares',
        'contactPosition': 'Diretor',
      }, 'grupo-1');

      expect(doc['groupId'], 'grupo-1');
      expect(doc['tradingName'], 'Rocha Prime');
      expect(doc['status'], 'active'); // default
      expect(doc['enabledModules'], <String>[]); // default
      expect(doc['logo'], isNull);
      expect(doc['deletedAt'], isNull);
      expect(doc.containsKey('groupId'), isTrue);
    });

    test('preserva status, enabledModules e logo quando fornecidos', () {
      final doc = companyDocFromInput({
        'name': 'X',
        'tradingName': 'X',
        'cnpj': '1',
        'city': 'C',
        'state': 'BA',
        'email': 'e@e.com',
        'phone': '1',
        'contactName': 'N',
        'contactPosition': 'P',
        'status': 'inactive',
        'enabledModules': ['fundeb', 'consultoria'],
        'logo': 'https://x/logo.png',
      }, 'grupo-1');

      expect(doc['status'], 'inactive');
      expect(doc['enabledModules'], ['fundeb', 'consultoria']);
      expect(doc['logo'], 'https://x/logo.png');
    });
  });

  group('companySummaryFromDoc', () {
    test('rotula status e deriva cor', () {
      final s = companySummaryFromDoc('c1', {
        'groupId': 'grupo-1',
        'tradingName': 'Rocha Prime',
        'segment': 'consultoria',
        'cnpj': '12.345.678/0001-99',
        'status': 'active',
        'city': 'Salvador',
        'state': 'BA',
        'enabledModules': ['fundeb'],
      });

      expect(s.id, 'c1');
      expect(s.tradingName, 'Rocha Prime');
      expect(s.status, 'Ativo');
      expect(s.color, SaaSTokens.success);
      expect(s.enabledModules, ['fundeb']);
    });

    test('tolera campos ausentes', () {
      final s = companySummaryFromDoc('c1', {'groupId': 'grupo-1'});
      expect(s.tradingName, '');
      expect(s.segment, 'outro');
      expect(s.enabledModules, isEmpty);
    });
  });

  group('companyDetailsFromDoc', () {
    test('mapeia todos os campos da UI', () {
      final d = companyDetailsFromDoc('c1', {
        'name': 'Rocha Prime Consultorias LTDA',
        'tradingName': 'Rocha Prime',
        'cnpj': '12.345.678/0001-99',
        'status': 'inactive',
        'segment': 'consultoria',
        'city': 'Salvador',
        'state': 'BA',
        'email': 'contato@rochaprime.com',
        'phone': '7133330000',
        'contactName': 'Adriel Tavares',
        'contactPosition': 'Diretor',
        'enabledModules': ['fundeb', 'consultoria'],
      });

      expect(d.name, 'Rocha Prime Consultorias LTDA');
      expect(d.status, 'Inativo');
      expect(d.contactName, 'Adriel Tavares');
      expect(d.enabledModules, ['fundeb', 'consultoria']);
    });
  });

  group('employee', () {
    test('employeeDocFromInput injeta groupId, companyId e deletedAt null', () {
      final doc = employeeDocFromInput({
        'companyId': 'c1',
        'name': 'Fulano',
        'email': 'f@e.com',
        'position': 'Analista',
        'role': 'analyst',
      }, 'grupo-1');

      expect(doc['groupId'], 'grupo-1');
      expect(doc['companyId'], 'c1');
      expect(doc['status'], 'active');
      expect(doc['deletedAt'], isNull);
    });

    test('employeeFromDoc rotula status', () {
      final e = employeeFromDoc('e1', {
        'name': 'Fulano',
        'email': 'f@e.com',
        'position': 'Analista',
        'role': 'analyst',
        'status': 'on_leave',
      });
      expect(e.id, 'e1');
      expect(e.name, 'Fulano');
      expect(e.status, 'Afastado');
    });
  });
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/company_firestore_mapper_test.dart`
Expected: FAIL — `Error: Couldn't resolve the package 'sync_flutter' ... company_firestore_mapper.dart` / arquivo não existe.

- [ ] **Step 3: Implementar o mapper**

Criar `sync_flutter/lib/src/core/data/company_firestore_mapper.dart`:

```dart
import 'package:flutter/material.dart';

import '../models/sync_models.dart';
import '../theme/app_theme.dart';

String? _str(dynamic v) => v is String && v.isNotEmpty ? v : null;

List<String> _modules(dynamic v) => v is List
    ? v.map((e) => e.toString()).toList()
    : const <String>[];

/// Rotula o status cru da empresa em português — mesmos textos que o
/// RemoteSyncRepository (`_labelStatus`) produzia a partir do Postgres.
String companyStatusLabel(String status) {
  switch (status) {
    case 'active':
      return 'Ativo';
    case 'inactive':
      return 'Inativo';
    default:
      return status.isEmpty ? '--' : status;
  }
}

/// Rotula o status cru do funcionário em português.
String employeeStatusLabel(String status) {
  switch (status) {
    case 'active':
      return 'Ativo';
    case 'on_leave':
      return 'Afastado';
    case 'inactive':
      return 'Inativo';
    default:
      return status.isEmpty ? '--' : status;
  }
}

/// Cor do chip de status, a partir dos tokens do tema claro (nunca SyncPalette).
Color companyStatusColor(String label) {
  switch (label) {
    case 'Ativo':
      return SaaSTokens.success;
    case 'Inativo':
      return SaaSTokens.textDim;
    default:
      return SaaSTokens.primary;
  }
}

/// Monta o doc a gravar a partir do payload da tela + o groupId do token.
/// groupId nunca vem do cliente; é injetado pelo service.
Map<String, dynamic> companyDocFromInput(
  Map<String, dynamic> input,
  String groupId,
) {
  return {
    'groupId': groupId,
    'name': input['name'],
    'tradingName': input['tradingName'],
    'cnpj': input['cnpj'],
    'segment': _str(input['segment']) ?? 'outro',
    'status': _str(input['status']) ?? 'active',
    'city': input['city'],
    'state': input['state'],
    'email': input['email'],
    'phone': input['phone'],
    'contactName': input['contactName'],
    'contactPosition': input['contactPosition'],
    'enabledModules': _modules(input['enabledModules']),
    'logo': _str(input['logo']),
    'deletedAt': null,
  };
}

CompanySummary companySummaryFromDoc(String id, Map<String, dynamic> data) {
  final label = companyStatusLabel((data['status'] as String?) ?? 'active');
  return CompanySummary(
    id: id,
    tradingName: (data['tradingName'] as String?) ?? '',
    segment: (data['segment'] as String?) ?? 'outro',
    cnpj: (data['cnpj'] as String?) ?? '',
    status: label,
    city: (data['city'] as String?) ?? '',
    state: (data['state'] as String?) ?? '',
    enabledModules: _modules(data['enabledModules']),
    color: companyStatusColor(label),
  );
}

CompanyDetails companyDetailsFromDoc(String id, Map<String, dynamic> data) {
  return CompanyDetails(
    id: id,
    name: (data['name'] as String?) ?? '',
    tradingName: (data['tradingName'] as String?) ?? '',
    cnpj: (data['cnpj'] as String?) ?? '',
    status: companyStatusLabel((data['status'] as String?) ?? 'active'),
    segment: (data['segment'] as String?) ?? 'outro',
    city: (data['city'] as String?) ?? '',
    state: (data['state'] as String?) ?? '',
    email: (data['email'] as String?) ?? '',
    phone: (data['phone'] as String?) ?? '',
    contactName: (data['contactName'] as String?) ?? '',
    contactPosition: (data['contactPosition'] as String?) ?? '',
    enabledModules: _modules(data['enabledModules']),
  );
}

Map<String, dynamic> employeeDocFromInput(
  Map<String, dynamic> input,
  String groupId,
) {
  return {
    'groupId': groupId,
    'companyId': input['companyId'],
    'name': input['name'],
    'email': input['email'],
    'position': input['position'],
    'role': input['role'],
    'status': _str(input['status']) ?? 'active',
    'deletedAt': null,
  };
}

EmployeeRecord employeeFromDoc(String id, Map<String, dynamic> data) {
  return EmployeeRecord(
    id: id,
    name: (data['name'] as String?) ?? '',
    email: (data['email'] as String?) ?? '',
    position: (data['position'] as String?) ?? '',
    role: (data['role'] as String?) ?? '',
    status: employeeStatusLabel((data['status'] as String?) ?? 'active'),
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/company_firestore_mapper_test.dart`
Expected: PASS (todos os grupos verdes).

- [ ] **Step 5: Commit**

```bash
git add sync_flutter/lib/src/core/data/company_firestore_mapper.dart sync_flutter/test/company_firestore_mapper_test.dart
git commit -m "feat: mapper Firestore de empresa e funcionario (doc<->modelo)"
```

---

## Task 3: Service Firestore de Empresas e Funcionários

**Files:**
- Create: `sync_flutter/lib/src/core/data/company_firestore_service.dart`
- Test: `sync_flutter/test/company_firestore_service_test.dart`

**Interfaces:**
- Consumes: `company_firestore_mapper.dart` (Task 2); `CompanySummary`, `CompanyDetails`, `CompanyBundle`, `EmployeeRecord`.
- Produces — classe `CompanyFirestoreService`:
  - `CompanyFirestoreService({required FirebaseFirestore firestore, required Future<String?> Function() groupIdLoader})`
  - `Future<List<CompanySummary>> list({String search = '', String status = 'Todos'})`
  - `Future<List<CompanySummary>> sidebar()` — só ativas
  - `Future<CompanyBundle> bundle(String companyId)` — empresa + funcionários
  - `Future<CompanySummary> create(Map<String,dynamic> input)`
  - `Future<CompanyDetails> updateModules(String companyId, List<String> enabledModules)`
  - `Future<EmployeeRecord> createEmployee(Map<String,dynamic> input)`

- [ ] **Step 1: Escrever o teste que falha**

Criar `sync_flutter/test/company_firestore_service_test.dart`:

```dart
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/company_firestore_service_test.dart`
Expected: FAIL — arquivo `company_firestore_service.dart` não existe.

- [ ] **Step 3: Implementar o service**

Criar `sync_flutter/lib/src/core/data/company_firestore_service.dart`:

```dart
import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/sync_models.dart';
import 'company_firestore_mapper.dart';

/// CRUD de empresas e funcionários direto no Firestore. Escopo por grupo vem
/// das custom claims do ID token (via groupIdLoader); soft delete via deletedAt.
class CompanyFirestoreService {
  CompanyFirestoreService({
    required FirebaseFirestore firestore,
    required Future<String?> Function() groupIdLoader,
  })  : _firestore = firestore,
        _groupIdLoader = groupIdLoader;

  final FirebaseFirestore _firestore;
  final Future<String?> Function() _groupIdLoader;

  CollectionReference<Map<String, dynamic>> get _companies =>
      _firestore.collection('companies');
  CollectionReference<Map<String, dynamic>> get _employees =>
      _firestore.collection('employees');

  Future<String> _requireGroupId() async {
    final groupId = await _groupIdLoader();
    if (groupId == null || groupId.isEmpty) {
      throw StateError('Usuario sem groupId nas claims — acesso nao configurado.');
    }
    return groupId;
  }

  // Converte o rótulo do filtro da UI ('Todos'/'Ativo'/'Inativo') no enum cru.
  String? _statusFilter(String status) {
    switch (status) {
      case 'Ativo':
        return 'active';
      case 'Inativo':
        return 'inactive';
      default:
        return null; // 'Todos'
    }
  }

  Future<List<CompanySummary>> list({
    String search = '',
    String status = 'Todos',
  }) async {
    final groupId = await _requireGroupId();
    final snap = await _companies
        .where('groupId', isEqualTo: groupId)
        .where('deletedAt', isNull: true)
        .get();

    final wanted = _statusFilter(status);
    final term = search.trim().toLowerCase();

    return snap.docs
        .map((d) => companySummaryFromDoc(d.id, d.data()))
        .where((c) {
          if (wanted != null) {
            final raw = c.status == 'Ativo' ? 'active' : 'inactive';
            if (raw != wanted) return false;
          }
          if (term.isNotEmpty) {
            final hay = '${c.tradingName} ${c.cnpj} ${c.city} ${c.state}'
                .toLowerCase();
            if (!hay.contains(term)) return false;
          }
          return true;
        })
        .toList();
  }

  Future<List<CompanySummary>> sidebar() => list(status: 'Ativo');

  Future<CompanySummary> create(Map<String, dynamic> input) async {
    final groupId = await _requireGroupId();
    final doc = companyDocFromInput(input, groupId);
    doc['createdAt'] = FieldValue.serverTimestamp();
    doc['updatedAt'] = FieldValue.serverTimestamp();
    final ref = await _companies.add(doc);
    return companySummaryFromDoc(ref.id, doc);
  }

  Future<CompanyDetails> _details(String companyId) async {
    final doc = await _companies.doc(companyId).get();
    if (!doc.exists) {
      throw StateError('Empresa $companyId nao encontrada.');
    }
    return companyDetailsFromDoc(companyId, doc.data()!);
  }

  Future<CompanyBundle> bundle(String companyId) async {
    final groupId = await _requireGroupId();
    final company = await _details(companyId);
    final snap = await _employees
        .where('groupId', isEqualTo: groupId)
        .where('companyId', isEqualTo: companyId)
        .where('deletedAt', isNull: true)
        .get();
    final employees =
        snap.docs.map((d) => employeeFromDoc(d.id, d.data())).toList();
    return CompanyBundle(company: company, employees: employees);
  }

  Future<CompanyDetails> updateModules(
    String companyId,
    List<String> enabledModules,
  ) async {
    await _companies.doc(companyId).set({
      'enabledModules': enabledModules,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
    return _details(companyId);
  }

  Future<EmployeeRecord> createEmployee(Map<String, dynamic> input) async {
    final groupId = await _requireGroupId();
    final doc = employeeDocFromInput(input, groupId);
    doc['createdAt'] = FieldValue.serverTimestamp();
    doc['updatedAt'] = FieldValue.serverTimestamp();
    final ref = await _employees.add(doc);
    return employeeFromDoc(ref.id, doc);
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/company_firestore_service_test.dart`
Expected: PASS (7 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add sync_flutter/lib/src/core/data/company_firestore_service.dart sync_flutter/test/company_firestore_service_test.dart
git commit -m "feat: service Firestore de empresas e funcionarios (escopo por grupo, soft delete)"
```

---

## Task 4: Upload de logo no Firebase Storage

**Files:**
- Create: `sync_flutter/lib/src/core/data/company_logo_storage.dart`
- Test: `sync_flutter/test/company_logo_storage_test.dart`

**Interfaces:**
- Consumes: `firebase_storage` (Task 1).
- Produces — classe `CompanyLogoStorage`:
  - `CompanyLogoStorage({FirebaseStorage? storage})`
  - `static String logoPath(String groupId, String companyId)` → `company-logos/{groupId}/{companyId}` (puro, testável).
  - `Future<String> upload({required String groupId, required String companyId, required Uint8List bytes, String contentType = 'image/png'})` → URL de download.

> Firebase Storage não tem fake oficial simples; por isso a lógica testável (o path) é extraída em `logoPath`, e `upload` fica fino. O teste cobre só o path builder — o upload real é validado no E2E manual (Task 8).

- [ ] **Step 1: Escrever o teste que falha**

Criar `sync_flutter/test/company_logo_storage_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/company_logo_storage.dart';

void main() {
  test('logoPath isola por grupo e empresa', () {
    expect(
      CompanyLogoStorage.logoPath('grupo-1', 'c123'),
      'company-logos/grupo-1/c123',
    );
  });
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/company_logo_storage_test.dart`
Expected: FAIL — arquivo não existe.

- [ ] **Step 3: Implementar o storage**

Criar `sync_flutter/lib/src/core/data/company_logo_storage.dart`:

```dart
import 'dart:typed_data';

import 'package:firebase_storage/firebase_storage.dart';

/// Sobe o logo da empresa no Firebase Storage e devolve a URL de download.
/// O path isola por grupo — as Storage Rules casam com company-logos/{groupId}/.
class CompanyLogoStorage {
  CompanyLogoStorage({FirebaseStorage? storage})
      : _storage = storage ?? FirebaseStorage.instance;

  final FirebaseStorage _storage;

  static String logoPath(String groupId, String companyId) =>
      'company-logos/$groupId/$companyId';

  Future<String> upload({
    required String groupId,
    required String companyId,
    required Uint8List bytes,
    String contentType = 'image/png',
  }) async {
    final ref = _storage.ref(logoPath(groupId, companyId));
    await ref.putData(bytes, SettableMetadata(contentType: contentType));
    return ref.getDownloadURL();
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/company_logo_storage_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sync_flutter/lib/src/core/data/company_logo_storage.dart sync_flutter/test/company_logo_storage_test.dart
git commit -m "feat: upload de logo de empresa no Firebase Storage"
```

---

## Task 5: Repo interface + wiring do service no Hybrid e app

**Files:**
- Modify: `sync_flutter/lib/src/core/repositories/sync_repository.dart:60`
- Modify: `sync_flutter/lib/src/core/repositories/remote_sync_repository.dart`
- Modify: `sync_flutter/lib/src/core/repositories/local_sync_repository.dart`
- Modify: `sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart:11-22,157-200,202-212`
- Modify: `sync_flutter/lib/src/app/app.dart:34-50`

**Interfaces:**
- Consumes: `CompanyFirestoreService` (Task 3).
- Produces: `Future<CompanySummary> createCompany(Map<String,dynamic> data)` no `SyncRepository`; empresa/funcionário passam a resolver via Firestore quando `remoteEnabled`.

- [ ] **Step 1: Adicionar `createCompany` à interface**

Em `sync_flutter/lib/src/core/repositories/sync_repository.dart`, logo após a declaração de `createCity` (linha ~60), adicionar:

```dart
  Future<CompanySummary> createCompany(Map<String, dynamic> data);
```

- [ ] **Step 2: Stub no RemoteSyncRepository**

Em `remote_sync_repository.dart`, junto dos outros métodos `@override` de company, adicionar:

```dart
  @override
  Future<CompanySummary> createCompany(Map<String, dynamic> data) async {
    // Fase 2.2: empresas vivem no Firestore; o caminho remoto sai de cena.
    throw UnsupportedError('createCompany é servido pelo Firestore (Hybrid).');
  }
```

- [ ] **Step 3: Implementação local (mock)**

Em `local_sync_repository.dart`, adicionar um `createCompany` que devolve um `CompanySummary` a partir do input (para o modo offline/local; espelhar o estilo do `createCollaborator` local já existente ali). Localizar `createCollaborator` no arquivo e adicionar ao lado:

```dart
  @override
  Future<CompanySummary> createCompany(Map<String, dynamic> data) async {
    final id = DateTime.now().millisecondsSinceEpoch.toString();
    return CompanySummary(
      id: id,
      tradingName: (data['tradingName'] as String?) ?? '',
      segment: (data['segment'] as String?) ?? 'outro',
      cnpj: (data['cnpj'] as String?) ?? '',
      status: 'Ativo',
      city: (data['city'] as String?) ?? '',
      state: (data['state'] as String?) ?? '',
      enabledModules: const [],
      color: SaaSTokens.success,
    );
  }
```

Se `SaaSTokens` não estiver importado em `local_sync_repository.dart`, adicionar `import '../theme/app_theme.dart';` no topo. Se o arquivo usa outra paleta para status, seguir o padrão local existente (o importante é compilar e devolver um summary coerente).

- [ ] **Step 4: Wiring no HybridSyncRepository**

Em `hybrid_sync_repository.dart`:

(a) adicionar o campo e o parâmetro do construtor:

```dart
  HybridSyncRepository({
    required RemoteSyncRepository remote,
    required LocalSyncRepository local,
    required CollaboratorFirestoreService collaborators,
    required CompanyFirestoreService companies,
  }) : _remote = remote,
       _local = local,
       _collaborators = collaborators,
       _companies = companies;

  final RemoteSyncRepository _remote;
  final LocalSyncRepository _local;
  final CollaboratorFirestoreService _collaborators;
  final CompanyFirestoreService _companies;
```

e o import no topo:

```dart
import '../data/company_firestore_service.dart';
```

(b) trocar os corpos dos métodos de company para delegar ao `_companies` quando `_mustUseRemote`. Substituir `getSidebarCompanies`, `getCompanies`, `getCompanyBundle`, `updateCompanyModules` e adicionar `createCompany`:

```dart
  @override
  Future<List<CompanySummary>> getSidebarCompanies() async {
    if (_mustUseRemote) {
      final remote = await _companies.sidebar();
      await _local.cacheCompanies(remote);
      return remote;
    }
    return _local.getSidebarCompanies();
  }

  @override
  Future<List<CompanySummary>> getCompanies({
    String search = '',
    String status = 'Todos',
  }) async {
    if (_mustUseRemote) {
      final remote = await _companies.list(search: search, status: status);
      await _local.cacheCompanies(remote);
      return remote;
    }
    return _local.getCompanies(search: search, status: status);
  }

  @override
  Future<CompanyBundle> getCompanyBundle(String companyId) async {
    if (_mustUseRemote) {
      final remote = await _companies.bundle(companyId);
      await _local.cacheCompanyBundle(remote);
      return remote;
    }
    return _local.getCompanyBundle(companyId);
  }

  @override
  Future<CompanyDetails> updateCompanyModules(
    String companyId,
    List<String> enabledModules,
  ) async {
    if (_mustUseRemote) {
      return _companies.updateModules(companyId, enabledModules);
    }
    return _local.updateCompanyModules(companyId, enabledModules);
  }

  @override
  Future<CompanySummary> createCompany(Map<String, dynamic> data) async {
    if (_mustUseRemote) return _companies.create(data);
    return _local.createCompany(data);
  }
```

> Nota: o filtro de status do `getCompanies` usa o rótulo em PT ('Todos'/'Ativo'/'Inativo'), que é o que a tela já passa. O `_statusFilter` do service converte para o enum.

- [ ] **Step 5: Construção no app.dart**

Em `sync_flutter/lib/src/app/app.dart`, dentro do `HybridSyncRepository(...)`, logo após o bloco `collaborators: CollaboratorFirestoreService(...)`, adicionar:

```dart
        companies: CompanyFirestoreService(
          firestore: FirebaseFirestore.instance,
          groupIdLoader: () async {
            final result = await FirebaseAuth.instance.currentUser?.getIdTokenResult();
            return result?.claims?['groupId'] as String?;
          },
        ),
```

Adicionar o import no topo de `app.dart` se ainda não houver:

```dart
import '../core/data/company_firestore_service.dart';
```

- [ ] **Step 6: Verificar compilação**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter analyze lib/src/core/repositories/ lib/src/app/app.dart`
Expected: `No issues found!` (se acusar `cacheCompanies`/`cacheCompanyBundle`/`getSidebarCompanies` inexistentes no local, esses métodos já existem — foram usados no Hybrid original; não recriar).

- [ ] **Step 7: Rodar a suíte inteira (garantir que nada quebrou)**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test`
Expected: PASS — os testes de mapper/service de company + os já existentes de collaborator.

- [ ] **Step 8: Commit**

```bash
git add sync_flutter/lib/src/core/repositories/ sync_flutter/lib/src/app/app.dart
git commit -m "feat: Hybrid delega empresas/funcionarios ao Firestore + createCompany"
```

---

## Task 6: Dialog real de "Nova Empresa" + logo

**Files:**
- Create: `sync_flutter/lib/src/features/companies/presentation/new_company_dialog.dart`
- Modify: `sync_flutter/lib/src/features/companies/presentation/companies_screen.dart:60-70`

**Interfaces:**
- Consumes: `SyncRepository.createCompany` (Task 5); `CompanyLogoStorage` (Task 4).
- Produces: `NewCompanyDialog` — form que coleta os campos mínimos, opcionalmente sobe um logo, chama `createCompany`, e retorna `true` no `Navigator.pop` quando cria.

> Escopo do form (YAGNI): apenas os campos que `CompanyDetails`/`CompanySummary` exibem — razão social (`name`), nome fantasia (`tradingName`), CNPJ, segmento, cidade, UF, email, telefone, nome e cargo do responsável. Validação: apenas required não-vazio (validação estrita de CNPJ/CEP fica para uma fatia futura). Logo é opcional.

- [ ] **Step 1: Criar o dialog**

Criar `sync_flutter/lib/src/features/companies/presentation/new_company_dialog.dart`:

```dart
import 'package:flutter/material.dart';

import '../../../core/repositories/sync_repository.dart';
import '../../../core/theme/app_theme.dart';

class NewCompanyDialog extends StatefulWidget {
  const NewCompanyDialog({super.key, required this.repository});

  final SyncRepository repository;

  @override
  State<NewCompanyDialog> createState() => _NewCompanyDialogState();
}

class _NewCompanyDialogState extends State<NewCompanyDialog> {
  final _name = TextEditingController();
  final _trading = TextEditingController();
  final _cnpj = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _contactName = TextEditingController();
  final _contactPosition = TextEditingController();
  String _segment = 'consultoria';
  bool _saving = false;
  String? _error;

  static const _segments = {
    'consultoria': 'Consultoria',
    'terceirizacao': 'Terceirizacao',
    'formacao': 'Formacao',
    'tecnologia': 'Tecnologia',
    'assessoria': 'Assessoria',
    'outro': 'Outro',
  };

  @override
  void dispose() {
    for (final c in [
      _name, _trading, _cnpj, _city, _state, _email, _phone,
      _contactName, _contactPosition,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _valid =>
      _name.text.trim().isNotEmpty &&
      _trading.text.trim().isNotEmpty &&
      _cnpj.text.trim().isNotEmpty &&
      _city.text.trim().isNotEmpty &&
      _state.text.trim().isNotEmpty &&
      _email.text.trim().isNotEmpty &&
      _phone.text.trim().isNotEmpty &&
      _contactName.text.trim().isNotEmpty &&
      _contactPosition.text.trim().isNotEmpty;

  Future<void> _submit() async {
    if (!_valid) {
      setState(() => _error = 'Preencha todos os campos obrigatorios.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.repository.createCompany({
        'name': _name.text.trim(),
        'tradingName': _trading.text.trim(),
        'cnpj': _cnpj.text.trim(),
        'segment': _segment,
        'city': _city.text.trim(),
        'state': _state.text.trim().toUpperCase(),
        'email': _email.text.trim(),
        'phone': _phone.text.trim(),
        'contactName': _contactName.text.trim(),
        'contactPosition': _contactPosition.text.trim(),
        'enabledModules': <String>[],
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = 'Falha ao criar empresa: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Nova Empresa',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: SaaSTokens.textTitle)),
              const SizedBox(height: 20),
              _field('Razao social', _name),
              _field('Nome fantasia', _trading),
              _field('CNPJ', _cnpj),
              const SizedBox(height: 4),
              const Text('Segmento',
                  style: TextStyle(fontSize: 13, color: SaaSTokens.textMuted)),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                initialValue: _segment,
                items: _segments.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _segment = v ?? 'outro'),
              ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: _field('Cidade', _city)),
                const SizedBox(width: 12),
                SizedBox(width: 90, child: _field('UF', _state)),
              ]),
              _field('Email corporativo', _email),
              _field('Telefone', _phone),
              _field('Responsavel', _contactName),
              _field('Cargo do responsavel', _contactPosition),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!,
                    style: const TextStyle(color: SaaSTokens.error, fontSize: 13)),
              ],
              const SizedBox(height: 20),
              Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                OutlinedButton(
                    onPressed:
                        _saving ? null : () => Navigator.of(context).pop(false),
                    child: const Text('Cancelar')),
                const SizedBox(width: 12),
                FilledButton(
                  onPressed: _saving ? null : _submit,
                  style: FilledButton.styleFrom(
                      backgroundColor: SaaSTokens.primary,
                      foregroundColor: Colors.white),
                  child: _saving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Text('Criar'),
                ),
              ]),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(String label, TextEditingController c) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: c,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            labelText: label,
            border: const OutlineInputBorder(),
            isDense: true,
          ),
        ),
      );
}
```

> Logo no create fica opcional e adiado para o fluxo de edição (Task 7 cobre o upload via Storage no detalhe, onde já existe o contexto do `companyId`). Criar empresa sem logo é válido (`logo: null`).

- [ ] **Step 2: Ligar o botão "Nova Empresa" na tela de lista**

Em `companies_screen.dart`, localizar o `onPressed` que hoje faz `ScaffoldMessenger...showSnackBar` (linha ~63) no botão de criar empresa e trocar por:

```dart
              onPressed: () async {
                final created = await showDialog<bool>(
                  context: context,
                  builder: (context) =>
                      NewCompanyDialog(repository: widget.repository),
                );
                if (created == true) _refresh();
              },
```

Adicionar o import no topo do arquivo:

```dart
import 'new_company_dialog.dart';
```

Confirmar que a tela tem acesso a `widget.repository` (a `CompaniesScreen` recebe `repository`) e ao método `_refresh()` (já usado em vários `onPressed` do arquivo). Se o botão de criar não existir de forma clara, adicioná-lo ao lado do "Atualizar" no cabeçalho, como `FilledButton.icon(icon: Icon(Icons.add_rounded, size: 16), label: Text('Nova Empresa'), ...)`.

- [ ] **Step 3: Verificar compilação**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter analyze lib/src/features/companies/`
Expected: `No issues found!`

- [ ] **Step 4: Commit**

```bash
git add sync_flutter/lib/src/features/companies/presentation/new_company_dialog.dart sync_flutter/lib/src/features/companies/presentation/companies_screen.dart
git commit -m "feat: dialog real de Nova Empresa gravando no Firestore"
```

---

## Task 7: Adicionar funcionário + upload de logo no detalhe

**Files:**
- Modify: `sync_flutter/lib/src/features/companies/presentation/company_detail_screen.dart`

**Interfaces:**
- Consumes: `SyncRepository` (para recarregar o bundle); `CompanyFirestoreService.createEmployee` via um caminho de repo, e `CompanyLogoStorage`.

> O detalhe hoje faz o "Adicionar funcionário" e o upload de documento só em estado local. Nesta fatia, o **funcionário** passa a gravar de verdade no Firestore, e o **logo** sobe no Firebase Storage. Documentos da empresa (o `_documents` local, que apontava pro Supabase morto) ficam fora de escopo desta fatia — permanecem locais/ocultos, para não inchar a fatia.

Como o repo já expõe `getCompanyBundle` (recarrega funcionários) mas não expõe `createEmployee`, adicionar `createEmployee` seguindo o mesmo caminho de `createCompany`:

- [ ] **Step 1: Expor `createEmployee` no repo**

Em `sync_repository.dart`, após `createCompany`:

```dart
  Future<EmployeeRecord> createEmployee(Map<String, dynamic> data);
```

Em `remote_sync_repository.dart`:

```dart
  @override
  Future<EmployeeRecord> createEmployee(Map<String, dynamic> data) async {
    throw UnsupportedError('createEmployee é servido pelo Firestore (Hybrid).');
  }
```

Em `local_sync_repository.dart` (mock simples):

```dart
  @override
  Future<EmployeeRecord> createEmployee(Map<String, dynamic> data) async {
    return EmployeeRecord(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      name: (data['name'] as String?) ?? '',
      email: (data['email'] as String?) ?? '',
      position: (data['position'] as String?) ?? '',
      role: (data['role'] as String?) ?? '',
      status: 'Ativo',
    );
  }
```

Em `hybrid_sync_repository.dart`:

```dart
  @override
  Future<EmployeeRecord> createEmployee(Map<String, dynamic> data) async {
    if (_mustUseRemote) return _companies.createEmployee(data);
    return _local.createEmployee(data);
  }
```

- [ ] **Step 2: Ligar o diálogo de "Adicionar funcionário" ao repo**

Em `company_detail_screen.dart`, localizar o diálogo de adicionar funcionário (o `showDialog` cujo botão "Adicionar" hoje muta estado local). No `onPressed` do "Adicionar", trocar a mutação local por:

```dart
                    onPressed: () async {
                      final name = nameCtrl.text.trim();
                      final email = emailCtrl.text.trim();
                      final position = positionCtrl.text.trim();
                      if (name.isEmpty || email.isEmpty || position.isEmpty) return;
                      Navigator.pop(ctx);
                      await widget.repository.createEmployee({
                        'companyId': widget.companyId,
                        'name': name,
                        'email': email,
                        'position': position,
                        'role': position,
                      });
                      _refresh();
                    },
```

Ajustar os nomes dos controllers (`nameCtrl`/`emailCtrl`/`positionCtrl`) aos que já existem no diálogo. Confirmar que a tela tem `widget.companyId` e `widget.repository` (o `CompanyDetailScreen` os recebe) e o método `_refresh()`.

- [ ] **Step 3: Upload de logo via Storage no botão de logo**

No cabeçalho do detalhe (onde o logo/avatar da empresa é exibido), adicionar um gesto de troca de logo que usa `file_picker` (já é dependência do projeto) + `CompanyLogoStorage` + grava a URL via `updateCompanyModules`-style. Como não há método dedicado, reusar o caminho: subir no Storage e então persistir com um `set(merge)` — expor um método `setLogo` no service e repo seguindo o mesmo padrão dos demais:

Em `company_firestore_service.dart`, adicionar:

```dart
  Future<void> setLogo(String companyId, String logoUrl) async {
    await _companies.doc(companyId).set({
      'logo': logoUrl,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }
```

Em `sync_repository.dart`:

```dart
  Future<void> setCompanyLogo(String companyId, Uint8List bytes);
```

Em `hybrid_sync_repository.dart` (injetar `CompanyLogoStorage` no construtor, como o service; usar o `groupIdLoader`):

```dart
  @override
  Future<void> setCompanyLogo(String companyId, Uint8List bytes) async {
    if (_mustUseRemote) {
      final groupId = await _groupIdLoader();
      if (groupId == null || groupId.isEmpty) {
        throw StateError('Sem groupId nas claims.');
      }
      final url = await _logoStorage.upload(
        groupId: groupId, companyId: companyId, bytes: bytes,
      );
      await _companies.setLogo(companyId, url);
      return;
    }
    // local: no-op
  }
```

Para isso o Hybrid precisa de `_logoStorage` (`CompanyLogoStorage`) e de `_groupIdLoader` (`Future<String?> Function()`) — adicionar ambos ao construtor e ao `app.dart` (mesma closure de claims usada nos services). Stubs de `remote`/`local` para `setCompanyLogo` lançam/no-op conforme o padrão.

No `company_detail_screen.dart`, o gesto de logo:

```dart
  Future<void> _pickAndUploadLogo() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.image, withData: true,
    );
    final bytes = result?.files.single.bytes;
    if (bytes == null) return;
    await widget.repository.setCompanyLogo(widget.companyId, bytes);
    _refresh();
  }
```

e ligar `_pickAndUploadLogo` ao `onTap`/botão do avatar de logo.

- [ ] **Step 4: Verificar compilação e suíte**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter analyze lib/src/`
Expected: `No issues found!`

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test`
Expected: PASS (mapper + service + collaborator; nenhum teste novo obrigatório aqui, mas a suíte não pode regredir).

- [ ] **Step 5: Commit**

```bash
git add sync_flutter/lib/src/features/companies/ sync_flutter/lib/src/core/
git commit -m "feat: funcionario grava no Firestore + upload de logo no Storage"
```

---

## Task 8: Security Rules, índices e testes de regra

**Files:**
- Modify: `firestore.rules:18-26`
- Modify: `firestore.indexes.json`
- Create: `storage.rules`
- Modify: `firebase.json`
- Create: `firestore-rules-test/companies.rules.test.mjs`

**Interfaces:**
- Consumes: coleções `companies` e `employees` (Tasks 2-3), Storage path `company-logos/{groupId}/` (Task 4).
- Produces: isolamento por grupo em produção.

- [ ] **Step 1: Escrever os testes de regra que falham**

Criar `firestore-rules-test/companies.rules.test.mjs` (espelhar `collaborators.rules.test.mjs`):

```js
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds }
  from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { after, before, beforeEach, test } from 'node:test';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'sync-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

function ctx(uid, claims) {
  return env.authenticatedContext(uid, claims).firestore();
}
const admin = { groupId: 'g1', groupRole: 'owner' };
const member = { groupId: 'g1', groupRole: 'member' };
const other = { groupId: 'g2', groupRole: 'owner' };

async function seedCompany(id, groupId) {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), `companies/${id}`),
      { groupId, tradingName: 'X', deletedAt: null });
  });
}

test('membro do grupo lê empresa do próprio grupo', async () => {
  await seedCompany('c1', 'g1');
  await assertSucceeds(getDoc(doc(ctx('u', member), 'companies/c1')));
});

test('não lê empresa de outro grupo', async () => {
  await seedCompany('c1', 'g1');
  await assertFails(getDoc(doc(ctx('u', other), 'companies/c1')));
});

test('admin cria empresa no próprio grupo', async () => {
  await assertSucceeds(setDoc(doc(ctx('u', admin), 'companies/c2'),
    { groupId: 'g1', tradingName: 'Nova', deletedAt: null }));
});

test('membro comum NÃO cria empresa', async () => {
  await assertFails(setDoc(doc(ctx('u', member), 'companies/c3'),
    { groupId: 'g1', tradingName: 'Nova', deletedAt: null }));
});

test('não cria empresa em outro grupo (hijack)', async () => {
  await assertFails(setDoc(doc(ctx('u', admin), 'companies/c4'),
    { groupId: 'g2', tradingName: 'Nova', deletedAt: null }));
});

test('delete real é sempre negado', async () => {
  await seedCompany('c1', 'g1');
  const { deleteDoc } = await import('firebase/firestore');
  await assertFails(deleteDoc(doc(ctx('u', admin), 'companies/c1')));
});
```

- [ ] **Step 2: Rodar e ver falhar (emulador)**

Run: `cd "$(git rev-parse --show-toplevel)" && firebase emulators:exec --only firestore "node --test firestore-rules-test/companies.rules.test.mjs"`
Expected: FAIL — sem regra para `companies`, leituras/escritas caem no default deny (ou passam onde não deviam). Requer Java (disponível) e `firebase-tools` (já usado na 2.1).

- [ ] **Step 3: Adicionar as regras**

Em `firestore.rules`, dentro do bloco `match /databases/{database}/documents {`, após o `match /collaborators/{id}`, adicionar:

```
    match /companies/{id} {
      allow read: if isSignedIn() && resource.data.groupId == myGroupId();
      allow create: if isAdmin() && request.resource.data.groupId == myGroupId();
      allow update: if isAdmin()
                    && resource.data.groupId == myGroupId()
                    && request.resource.data.groupId == myGroupId();
      allow delete: if false;
    }

    match /employees/{id} {
      allow read: if isSignedIn() && resource.data.groupId == myGroupId();
      allow create: if isAdmin() && request.resource.data.groupId == myGroupId();
      allow update: if isAdmin()
                    && resource.data.groupId == myGroupId()
                    && request.resource.data.groupId == myGroupId();
      allow delete: if false;
    }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd "$(git rev-parse --show-toplevel)" && firebase emulators:exec --only firestore "node --test firestore-rules-test/companies.rules.test.mjs"`
Expected: PASS (6 testes verdes).

- [ ] **Step 5: Índices compostos**

Em `firestore.indexes.json`, no array `indexes`, adicionar (mantendo os existentes):

```json
    {
      "collectionGroup": "companies",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "groupId", "order": "ASCENDING" },
        { "fieldPath": "deletedAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "employees",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "groupId", "order": "ASCENDING" },
        { "fieldPath": "companyId", "order": "ASCENDING" },
        { "fieldPath": "deletedAt", "order": "ASCENDING" }
      ]
    }
```

- [ ] **Step 6: Storage Rules**

Criar `storage.rules` (isolamento por grupo, leitura autenticada do próprio grupo, escrita só admin):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isSignedIn() { return request.auth != null; }
    function myGroupId() { return request.auth.token.groupId; }
    function isAdmin() {
      return isSignedIn() && request.auth.token.groupRole in ['owner', 'admin'];
    }
    match /company-logos/{groupId}/{fileName} {
      allow read: if isSignedIn() && groupId == myGroupId();
      allow write: if isAdmin() && groupId == myGroupId()
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

Em `firebase.json`, garantir o bloco `storage` (adicionar se não existir):

```json
  "storage": { "rules": "storage.rules" }
```

- [ ] **Step 7: Commit**

```bash
git add firestore.rules firestore.indexes.json storage.rules firebase.json firestore-rules-test/companies.rules.test.mjs
git commit -m "feat: rules e indices de companies/employees + storage de logo"
```

- [ ] **Step 8: Deploy das rules e índices (autorizado)**

Run: `cd "$(git rev-parse --show-toplevel)" && firebase deploy --only firestore:rules,firestore:indexes,storage --project globalconsultorias`
Expected: `Deploy complete!`. Banco vazio + regras aditivas (padrão de produção nega tudo; estas *adicionam* acesso controlado) — mesmo racional da 2.1.

---

## Verificação E2E (manual, pelo usuário — fora do subagent-driven)

Depois das 8 tasks, com `npm run dev` na porta 3100, aba anônima:

1. Login → **Minha Empresa**. A lista carrega **vazia** sem erro (Firestore começa sem dados), diferente do Dashboard (ainda Postgres).
2. Clicar **Nova Empresa**, preencher os campos, **Criar**. A empresa aparece na lista.
3. No Firebase Console → Firestore, conferir `companies/{id}` com `groupId: "grupo-1"`, `enabledModules: []`, `deletedAt: null`.
4. Abrir o detalhe → **adicionar um funcionário** → conferir `employees/{id}` com `companyId` e `groupId` certos.
5. Trocar o **logo** → conferir o arquivo em Storage `company-logos/grupo-1/{companyId}` e a `logo` (URL) gravada no doc.
6. Alternar um **módulo** no detalhe → recarregar (F5) → a mudança persiste.

---

## Self-Review (do autor do plano)

**Cobertura da spec (fase 2 da migração):**
- Coleções + índices + rules → Tasks 2, 3, 8. ✅
- Isolamento por grupo, soft delete, `isNull` → constraints globais + Tasks 3, 8. ✅
- Sem dinheiro nesta fatia (empresa/funcionário não têm campo monetário) → regra de cents não se aplica; nada a fazer. ✅
- Denormalização caso a caso → funcionários em coleção própria com `companyId` (sem embutir na empresa); logo como URL no doc. ✅
- Storage do logo → Tasks 1, 4, 7, 8. ✅
- Auditoria adiada → nenhuma task grava audit (decisão registrada). ✅

**Placeholders:** nenhum "TBD"/"etc." nas etapas de código; todo passo que muda código traz o código. Onde o plano diz "ajustar aos controllers existentes" (Task 7 Step 2), é porque o diálogo de funcionário já existe no arquivo e os nomes reais devem ser casados — o implementador vê o arquivo. ✅

**Consistência de tipos:** `createCompany(Map)→CompanySummary`, `createEmployee(Map)→EmployeeRecord`, `updateModules(String,List<String>)→CompanyDetails`, `bundle(String)→CompanyBundle` batem entre service (Task 3), repo/hybrid (Task 5, 7) e UI (Task 6, 7). Rótulos de status idênticos entre mapper (Task 2) e o que a UI espera. ✅
