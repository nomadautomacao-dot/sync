# Documentos de Colaborador → Firestore + Firebase Storage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O Flutter passa a subir, listar e excluir documentos de colaborador direto no Firestore + Firebase Storage, sem passar pelas rotas `/api/collaborators/[id]/documents*` do Next (que hoje apontam para o Supabase Storage morto — todo upload falha em produção). Repete o padrão strangler-fig já usado em `CompanyLogoStorage`.

**Architecture:** Um mapper puro (validação de tipo/tamanho de arquivo + montagem do doc), um service que combina Storage (blob) + Firestore (metadado) com as duas dependências de I/O injetáveis (testáveis com fakes, sem precisar de emulador de Storage), e o `HybridSyncRepository` passando a delegar a esse service em vez de `_remote` quando `_mustUseRemote`.

**Tech Stack:** Flutter/Dart, `cloud_firestore`, `firebase_storage`, `fake_cloud_firestore` (testes).

## Global Constraints

- **`groupId` nunca vem do cliente** — injetado pelo service via `groupIdLoader`, mesmo padrão de `CollaboratorFirestoreService`.
- **Path do Storage = `collaborator-documents/{groupId}/{collaboratorId}/{docId}.{extensao}`** — `docId` é o id do doc Firestore (gerado antes do upload), então blob e metadado sempre casam 1:1; delete usa o mesmo path, sem precisar parsear URL (diferente do código antigo, que extraía o path da URL pública).
- **Validação de arquivo espelha a rota antiga exatamente:** limite **10MB**; tipos aceitos `pdf, png, jpeg/jpg, doc, docx, xls, xlsx` (por extensão OU mime type, igual à rota Next atual em `app/api/collaborators/[id]/documents/route.ts`).
- **Delete é real (hard delete), não soft delete** — diferente das outras coleções desta migração. É o comportamento que a rota Next já tinha (`prisma.collaboratorDocument.delete`), documento não é dado financeiro que precise de trilha de auditoria por retenção.
- **Dependências de I/O (upload/delete de bytes) são injetáveis no service** — permite testar toda a lógica de Firestore com `fake_cloud_firestore` sem precisar de um fake de Firebase Storage (que o projeto não usa em nenhum outro teste).
- **Cores de `SaaSTokens`**, nunca `SyncPalette`, em qualquer ajuste de tela que este plano tocar.
- **Test gate:** rodar suítes Firestore por PATH EXPLÍCITO (`flutter test test/arquivo.dart`, nunca `flutter test` bare). SDK pinado: `~/sync_tooling/flutter/bin/flutter` (3.38.7).

---

## File Structure

**Criar:**
- `sync_flutter/lib/src/core/data/collaborator_document_firestore_mapper.dart` — validação de arquivo + doc↔modelo.
- `sync_flutter/lib/src/core/data/collaborator_document_firestore_service.dart` — upload/list/delete combinando Storage + Firestore.
- `sync_flutter/test/collaborator_document_firestore_mapper_test.dart`
- `sync_flutter/test/collaborator_document_firestore_service_test.dart`
- `firestore-rules-test/collaborator_documents.rules.test.mjs`

**Modificar:**
- `sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart` — trocar `_remote` por um novo `_collaboratorDocuments` service nos 3 métodos de documento.
- `sync_flutter/lib/src/app/app.dart` — construir o novo service.
- `firestore.rules`, `firestore.indexes.json`, `storage.rules` — coleção `collaboratorDocuments` + path `collaborator-documents/`.

**Modelo de documento Firestore:**

```
collaboratorDocuments/{docId}
  groupId, collaboratorId, category, documentType, name,
  fileName, storagePath, fileUrl, fileSize, mimeType,
  issuedAt, expiresAt, notes, createdAt, updatedAt
```

---

## Task 1: Mapper — validação de arquivo + doc↔modelo

**Files:**
- Create: `sync_flutter/lib/src/core/data/collaborator_document_firestore_mapper.dart`
- Test: `sync_flutter/test/collaborator_document_firestore_mapper_test.dart`

**Interfaces:**
- Consumes: `CollaboratorDocument` de `core/models/sync_models.dart` (campos: id, collaboratorId, category, documentType, name, fileName, fileUrl, fileSize?, mimeType?, issuedAt?, expiresAt?, notes?).
- Produces:
  - `class UnsupportedDocumentFileException implements Exception { final String message; }`
  - `String extensionFromFileName(String fileName, String mimeType)` — replica `extensionFromFile` da rota Next: extensão do nome se for alfanumérica, senão deduz do mime type, senão `'bin'`.
  - `void validateDocumentFile({required String fileName, required String mimeType, required int fileSize})` — lança `UnsupportedDocumentFileException` se `fileSize > 10 * 1024 * 1024` ou se nem a extensão nem o mime type baterem com a lista permitida (`pdf, png, jpg, jpeg, doc, docx, xls, xlsx`).
  - `String documentStoragePath(String groupId, String collaboratorId, String docId, String extension)` → `'collaborator-documents/$groupId/$collaboratorId/$docId.$extension'`.
  - `Map<String,dynamic> collaboratorDocumentDocFromInput(Map<String,dynamic> input, {required String groupId, required String collaboratorId, required String storagePath, required String fileUrl})`.
  - `CollaboratorDocument collaboratorDocumentFromDoc(String id, Map<String,dynamic> data)`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `sync_flutter/test/collaborator_document_firestore_mapper_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/collaborator_document_firestore_mapper.dart';

void main() {
  group('extensionFromFileName', () {
    test('usa a extensao do nome quando alfanumerica', () {
      expect(extensionFromFileName('contrato.PDF', 'application/pdf'), 'pdf');
      expect(extensionFromFileName('planilha.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'xlsx');
    });

    test('cai pro mime type quando o nome nao tem extensao alfanumerica', () {
      expect(extensionFromFileName('sem-extensao', 'application/pdf'), 'pdf');
      expect(extensionFromFileName('sem-extensao', 'image/png'), 'png');
    });

    test('bin quando nao reconhece nada', () {
      expect(extensionFromFileName('arquivo', 'application/octet-stream'), 'bin');
    });
  });

  group('validateDocumentFile', () {
    test('aceita pdf dentro do limite', () {
      expect(
        () => validateDocumentFile(fileName: 'x.pdf', mimeType: 'application/pdf', fileSize: 1024),
        returnsNormally,
      );
    });

    test('rejeita arquivo maior que 10MB', () {
      expect(
        () => validateDocumentFile(fileName: 'x.pdf', mimeType: 'application/pdf', fileSize: 11 * 1024 * 1024),
        throwsA(isA<UnsupportedDocumentFileException>()),
      );
    });

    test('rejeita tipo nao suportado', () {
      expect(
        () => validateDocumentFile(fileName: 'x.exe', mimeType: 'application/x-msdownload', fileSize: 100),
        throwsA(isA<UnsupportedDocumentFileException>()),
      );
    });

    test('aceita docx mesmo com mime type generico, pela extensao', () {
      expect(
        () => validateDocumentFile(fileName: 'contrato.docx', mimeType: 'application/octet-stream', fileSize: 100),
        returnsNormally,
      );
    });
  });

  test('documentStoragePath monta o path isolado por grupo/colaborador/doc', () {
    expect(
      documentStoragePath('grupo-1', 'colab1', 'doc1', 'pdf'),
      'collaborator-documents/grupo-1/colab1/doc1.pdf',
    );
  });

  test('collaboratorDocumentDocFromInput injeta groupId/collaboratorId/storagePath/fileUrl', () {
    final doc = collaboratorDocumentDocFromInput({
      'category': 'juridico',
      'documentType': 'contrato_social',
      'name': 'Contrato Social',
      'fileName': 'contrato.pdf',
      'fileSize': 2048,
      'mimeType': 'application/pdf',
      'issuedAt': '2026-01-01',
    }, groupId: 'grupo-1', collaboratorId: 'colab1', storagePath: 'collaborator-documents/grupo-1/colab1/doc1.pdf', fileUrl: 'https://x/doc1.pdf');

    expect(doc['groupId'], 'grupo-1');
    expect(doc['collaboratorId'], 'colab1');
    expect(doc['storagePath'], 'collaborator-documents/grupo-1/colab1/doc1.pdf');
    expect(doc['fileUrl'], 'https://x/doc1.pdf');
    expect(doc['category'], 'juridico');
    expect(doc['fileSize'], 2048);
  });

  test('collaboratorDocumentFromDoc converte de volta', () {
    final d = collaboratorDocumentFromDoc('doc1', {
      'collaboratorId': 'colab1',
      'category': 'juridico',
      'documentType': 'contrato_social',
      'name': 'Contrato Social',
      'fileName': 'contrato.pdf',
      'fileUrl': 'https://x/doc1.pdf',
      'fileSize': 2048,
      'mimeType': 'application/pdf',
      'issuedAt': '2026-01-01',
    });
    expect(d.id, 'doc1');
    expect(d.collaboratorId, 'colab1');
    expect(d.name, 'Contrato Social');
    expect(d.fileSize, 2048);
  });
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/collaborator_document_firestore_mapper_test.dart`
Expected: FAIL — arquivo não existe.

- [ ] **Step 3: Implementar o mapper**

Criar `sync_flutter/lib/src/core/data/collaborator_document_firestore_mapper.dart`:

```dart
import '../models/sync_models.dart';

class UnsupportedDocumentFileException implements Exception {
  UnsupportedDocumentFileException(this.message);
  final String message;
  @override
  String toString() => message;
}

const int kMaxDocumentFileSize = 10 * 1024 * 1024;

const Set<String> _allowedExtensions = {
  'pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'xls', 'xlsx',
};

const Map<String, String> _extensionByMimeType = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

String _nameExtension(String fileName) {
  final parts = fileName.split('.');
  if (parts.length < 2) return '';
  final ext = parts.last.toLowerCase();
  return RegExp(r'^[a-z0-9]+$').hasMatch(ext) ? ext : '';
}

/// Espelha `extensionFromFile` da rota Next legada: extensao do nome do
/// arquivo se for alfanumerica, senao deduz do mime type, senao 'bin'.
String extensionFromFileName(String fileName, String mimeType) {
  final byName = _nameExtension(fileName);
  if (byName.isNotEmpty) return byName;
  return _extensionByMimeType[mimeType] ?? 'bin';
}

/// Mesma validacao da rota Next legada: 10MB e a mesma lista de tipos.
/// Aceita pela extensao OU pelo mime type — docx com mime generico passa.
void validateDocumentFile({
  required String fileName,
  required String mimeType,
  required int fileSize,
}) {
  if (fileSize > kMaxDocumentFileSize) {
    throw UnsupportedDocumentFileException('Arquivo excede o limite de 10MB');
  }
  final ext = _nameExtension(fileName);
  final mimeKnown = _extensionByMimeType.containsKey(mimeType);
  final extKnown = _allowedExtensions.contains(ext);
  if (!mimeKnown && !extKnown) {
    throw UnsupportedDocumentFileException('Tipo de arquivo nao suportado');
  }
}

String documentStoragePath(
  String groupId,
  String collaboratorId,
  String docId,
  String extension,
) =>
    'collaborator-documents/$groupId/$collaboratorId/$docId.$extension';

String? _str(dynamic v) => v is String && v.isNotEmpty ? v : null;

Map<String, dynamic> collaboratorDocumentDocFromInput(
  Map<String, dynamic> input, {
  required String groupId,
  required String collaboratorId,
  required String storagePath,
  required String fileUrl,
}) {
  return {
    'groupId': groupId,
    'collaboratorId': collaboratorId,
    'category': input['category'] ?? '',
    'documentType': input['documentType'] ?? '',
    'name': input['name'] ?? '',
    'fileName': input['fileName'] ?? '',
    'storagePath': storagePath,
    'fileUrl': fileUrl,
    'fileSize': input['fileSize'],
    'mimeType': _str(input['mimeType']),
    'issuedAt': _str(input['issuedAt']),
    'expiresAt': _str(input['expiresAt']),
    'notes': _str(input['notes']),
  };
}

CollaboratorDocument collaboratorDocumentFromDoc(String id, Map<String, dynamic> data) {
  return CollaboratorDocument(
    id: id,
    collaboratorId: (data['collaboratorId'] as String?) ?? '',
    category: (data['category'] as String?) ?? '',
    documentType: (data['documentType'] as String?) ?? '',
    name: (data['name'] as String?) ?? '',
    fileName: (data['fileName'] as String?) ?? '',
    fileUrl: (data['fileUrl'] as String?) ?? '',
    fileSize: data['fileSize'] as int?,
    mimeType: _str(data['mimeType']),
    issuedAt: _str(data['issuedAt']),
    expiresAt: _str(data['expiresAt']),
    notes: _str(data['notes']),
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/collaborator_document_firestore_mapper_test.dart`
Expected: PASS (10 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add sync_flutter/lib/src/core/data/collaborator_document_firestore_mapper.dart sync_flutter/test/collaborator_document_firestore_mapper_test.dart
git commit -m "feat: mapper de documento de colaborador (validacao de arquivo + doc<->modelo)"
```

---

## Task 2: Service — Storage + Firestore combinados

**Files:**
- Create: `sync_flutter/lib/src/core/data/collaborator_document_firestore_service.dart`
- Test: `sync_flutter/test/collaborator_document_firestore_service_test.dart`

**Interfaces:**
- Consumes: mapper (Task 1).
- Produces — classe `CollaboratorDocumentFirestoreService`:
  - Construtor: `{required FirebaseFirestore firestore, required Future<String?> Function() groupIdLoader, required Future<String> Function({required String path, required Uint8List bytes, required String contentType}) uploadBytes, required Future<void> Function(String path) deleteBytes}` — `uploadBytes`/`deleteBytes` são injetáveis (produção usa `firebase_storage`, testes usam fakes que não tocam rede).
  - `Future<List<CollaboratorDocument>> list(String collaboratorId)`
  - `Future<CollaboratorDocument> upload({required String collaboratorId, required String category, required String documentType, required String name, required String fileName, required Uint8List fileBytes, String? mimeType, String? issuedAt, String? expiresAt, String? notes})` — valida (Task 1), gera `docId` via `_col.doc().id`, monta o path, chama `uploadBytes`, grava o doc.
  - `Future<void> delete(String collaboratorId, String docId)` — lê o doc pra pegar `storagePath`, chama `deleteBytes`, apaga o doc Firestore (hard delete).

- [ ] **Step 1: Escrever o teste que falha**

Criar `sync_flutter/test/collaborator_document_firestore_service_test.dart`:

```dart
import 'dart:typed_data';

import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/collaborator_document_firestore_mapper.dart';
import 'package:sync_flutter/src/core/data/collaborator_document_firestore_service.dart';

class _FakeBlobs {
  final Map<String, Uint8List> stored = {};
  Future<String> upload({required String path, required Uint8List bytes, required String contentType}) async {
    stored[path] = bytes;
    return 'https://fake.storage/$path';
  }
  Future<void> delete(String path) async {
    stored.remove(path);
  }
}

CollaboratorDocumentFirestoreService _svc(FakeFirebaseFirestore db, _FakeBlobs blobs, {String? group = 'grupo-1'}) {
  return CollaboratorDocumentFirestoreService(
    firestore: db,
    groupIdLoader: () async => group,
    uploadBytes: blobs.upload,
    deleteBytes: blobs.delete,
  );
}

void main() {
  test('upload valida, sobe o blob e grava o metadado', () async {
    final db = FakeFirebaseFirestore();
    final blobs = _FakeBlobs();
    final svc = _svc(db, blobs);

    final doc = await svc.upload(
      collaboratorId: 'colab1',
      category: 'juridico',
      documentType: 'contrato_social',
      name: 'Contrato Social',
      fileName: 'contrato.pdf',
      fileBytes: Uint8List.fromList([1, 2, 3]),
      mimeType: 'application/pdf',
    );

    expect(doc.name, 'Contrato Social');
    expect(doc.fileUrl, startsWith('https://fake.storage/collaborator-documents/grupo-1/colab1/'));
    expect(blobs.stored.length, 1);

    final raw = (await db.collection('collaboratorDocuments').doc(doc.id).get()).data()!;
    expect(raw['groupId'], 'grupo-1');
    expect(raw['collaboratorId'], 'colab1');
    expect(raw['storagePath'], contains('collaborator-documents/grupo-1/colab1/'));
  });

  test('upload rejeita arquivo grande demais sem tocar Storage nem Firestore', () async {
    final db = FakeFirebaseFirestore();
    final blobs = _FakeBlobs();
    final svc = _svc(db, blobs);

    await expectLater(
      svc.upload(
        collaboratorId: 'colab1', category: 'x', documentType: 'y', name: 'z',
        fileName: 'grande.pdf', mimeType: 'application/pdf',
        fileBytes: Uint8List(11 * 1024 * 1024),
      ),
      throwsA(isA<UnsupportedDocumentFileException>()),
    );
    expect(blobs.stored, isEmpty);
    expect((await db.collection('collaboratorDocuments').get()).docs, isEmpty);
  });

  test('list devolve so os documentos do colaborador', () async {
    final db = FakeFirebaseFirestore();
    final blobs = _FakeBlobs();
    final svc = _svc(db, blobs);
    await svc.upload(collaboratorId: 'colab1', category: 'a', documentType: 'a', name: 'A', fileName: 'a.pdf', mimeType: 'application/pdf', fileBytes: Uint8List.fromList([1]));
    await svc.upload(collaboratorId: 'colab2', category: 'b', documentType: 'b', name: 'B', fileName: 'b.pdf', mimeType: 'application/pdf', fileBytes: Uint8List.fromList([1]));

    final list = await svc.list('colab1');
    expect(list, hasLength(1));
    expect(list.single.name, 'A');
  });

  test('delete remove o blob e o metadado', () async {
    final db = FakeFirebaseFirestore();
    final blobs = _FakeBlobs();
    final svc = _svc(db, blobs);
    final doc = await svc.upload(collaboratorId: 'colab1', category: 'a', documentType: 'a', name: 'A', fileName: 'a.pdf', mimeType: 'application/pdf', fileBytes: Uint8List.fromList([1]));

    await svc.delete('colab1', doc.id);

    expect(blobs.stored, isEmpty);
    expect((await db.collection('collaboratorDocuments').doc(doc.id).get()).exists, isFalse);
  });

  test('sem groupId lanca StateError', () async {
    final db = FakeFirebaseFirestore();
    final blobs = _FakeBlobs();
    expect(
      () => _svc(db, blobs, group: null).upload(
        collaboratorId: 'colab1', category: 'a', documentType: 'a', name: 'A',
        fileName: 'a.pdf', mimeType: 'application/pdf', fileBytes: Uint8List.fromList([1]),
      ),
      throwsA(isA<StateError>()),
    );
  });
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/collaborator_document_firestore_service_test.dart`
Expected: FAIL — arquivo não existe.

- [ ] **Step 3: Implementar o service**

Criar `sync_flutter/lib/src/core/data/collaborator_document_firestore_service.dart`:

```dart
import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/sync_models.dart';
import 'collaborator_document_firestore_mapper.dart';

typedef _UploadBytes = Future<String> Function({
  required String path,
  required Uint8List bytes,
  required String contentType,
});
typedef _DeleteBytes = Future<void> Function(String path);

/// Documentos de colaborador: blob no Firebase Storage + metadado no
/// Firestore. Path e id do doc sao sempre o mesmo valor, entao delete nao
/// precisa parsear URL (diferente da rota Next legada, que extraia o path
/// da URL publica do Supabase).
class CollaboratorDocumentFirestoreService {
  CollaboratorDocumentFirestoreService({
    required FirebaseFirestore firestore,
    required Future<String?> Function() groupIdLoader,
    required _UploadBytes uploadBytes,
    required _DeleteBytes deleteBytes,
  })  : _firestore = firestore,
        _groupIdLoader = groupIdLoader,
        _uploadBytes = uploadBytes,
        _deleteBytes = deleteBytes;

  final FirebaseFirestore _firestore;
  final Future<String?> Function() _groupIdLoader;
  final _UploadBytes _uploadBytes;
  final _DeleteBytes _deleteBytes;

  CollectionReference<Map<String, dynamic>> get _col =>
      _firestore.collection('collaboratorDocuments');

  Future<String> _requireGroupId() async {
    final groupId = await _groupIdLoader();
    if (groupId == null || groupId.isEmpty) {
      throw StateError('Usuario sem groupId nas claims — acesso nao configurado.');
    }
    return groupId;
  }

  Future<List<CollaboratorDocument>> list(String collaboratorId) async {
    final groupId = await _requireGroupId();
    final snap = await _col
        .where('groupId', isEqualTo: groupId)
        .where('collaboratorId', isEqualTo: collaboratorId)
        .get();
    return snap.docs.map((d) => collaboratorDocumentFromDoc(d.id, d.data())).toList();
  }

  Future<CollaboratorDocument> upload({
    required String collaboratorId,
    required String category,
    required String documentType,
    required String name,
    required String fileName,
    required Uint8List fileBytes,
    String? mimeType,
    String? issuedAt,
    String? expiresAt,
    String? notes,
  }) async {
    final groupId = await _requireGroupId();
    final resolvedMimeType = mimeType ?? 'application/octet-stream';
    validateDocumentFile(fileName: fileName, mimeType: resolvedMimeType, fileSize: fileBytes.length);

    final docRef = _col.doc();
    final extension = extensionFromFileName(fileName, resolvedMimeType);
    final storagePath = documentStoragePath(groupId, collaboratorId, docRef.id, extension);

    final fileUrl = await _uploadBytes(path: storagePath, bytes: fileBytes, contentType: resolvedMimeType);

    final doc = collaboratorDocumentDocFromInput({
      'category': category,
      'documentType': documentType,
      'name': name,
      'fileName': fileName,
      'fileSize': fileBytes.length,
      'mimeType': resolvedMimeType,
      'issuedAt': issuedAt,
      'expiresAt': expiresAt,
      'notes': notes,
    }, groupId: groupId, collaboratorId: collaboratorId, storagePath: storagePath, fileUrl: fileUrl);
    doc['createdAt'] = FieldValue.serverTimestamp();
    doc['updatedAt'] = FieldValue.serverTimestamp();

    await docRef.set(doc);
    return collaboratorDocumentFromDoc(docRef.id, doc);
  }

  Future<void> delete(String collaboratorId, String docId) async {
    await _requireGroupId();
    final snap = await _col.doc(docId).get();
    final storagePath = snap.data()?['storagePath'] as String?;
    if (storagePath != null) {
      await _deleteBytes(storagePath);
    }
    await _col.doc(docId).delete();
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/collaborator_document_firestore_service_test.dart`
Expected: PASS (5 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add sync_flutter/lib/src/core/data/collaborator_document_firestore_service.dart sync_flutter/test/collaborator_document_firestore_service_test.dart
git commit -m "feat: service de documento de colaborador (Storage + Firestore, I/O injetavel)"
```

---

## Task 3: Wire no Hybrid + app (com uploader real do `firebase_storage`)

**Files:**
- Modify: `sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart`
- Modify: `sync_flutter/lib/src/app/app.dart`

**Interfaces:**
- Consumes: `CollaboratorDocumentFirestoreService` (Task 2).
- Produces: `getCollaboratorDocuments`/`uploadCollaboratorDocument`/`deleteCollaboratorDocument` resolvem via Firestore+Storage quando `_mustUseRemote`, no lugar de `_remote` (API Next).

- [ ] **Step 1: Adicionar o service ao Hybrid**

Em `hybrid_sync_repository.dart`, import `import '../data/collaborator_document_firestore_service.dart';`, campo `final CollaboratorDocumentFirestoreService _collaboratorDocuments;`, parâmetro `required CollaboratorDocumentFirestoreService collaboratorDocuments` no construtor (`_collaboratorDocuments = collaboratorDocuments`).

- [ ] **Step 2: Trocar os 3 métodos, de `_remote` para `_collaboratorDocuments`**

```dart
  @override
  Future<List<CollaboratorDocument>> getCollaboratorDocuments(String id) async {
    if (_mustUseRemote) return _collaboratorDocuments.list(id);
    return _local.getCollaboratorDocuments(id);
  }

  @override
  Future<CollaboratorDocument> uploadCollaboratorDocument({
    required String id,
    required String category,
    required String documentType,
    required String name,
    required String fileName,
    required Uint8List fileBytes,
    String? issuedAt,
    String? expiresAt,
    String? notes,
  }) async {
    if (_mustUseRemote) {
      return _collaboratorDocuments.upload(
        collaboratorId: id,
        category: category,
        documentType: documentType,
        name: name,
        fileName: fileName,
        fileBytes: fileBytes,
        issuedAt: issuedAt,
        expiresAt: expiresAt,
        notes: notes,
      );
    }
    return _local.uploadCollaboratorDocument(
      id: id, category: category, documentType: documentType, name: name,
      fileName: fileName, fileBytes: fileBytes,
      issuedAt: issuedAt, expiresAt: expiresAt, notes: notes,
    );
  }

  @override
  Future<void> deleteCollaboratorDocument(String id, String docId) async {
    if (_mustUseRemote) return _collaboratorDocuments.delete(id, docId);
    return _local.deleteCollaboratorDocument(id, docId);
  }
```

- [ ] **Step 3: Construir no `app.dart`**

Em `app.dart`, dentro do `HybridSyncRepository(...)`:

```dart
        collaboratorDocuments: CollaboratorDocumentFirestoreService(
          firestore: FirebaseFirestore.instance,
          groupIdLoader: _loadGroupIdFromClaims,
          uploadBytes: ({required path, required bytes, required contentType}) async {
            final ref = FirebaseStorage.instance.ref(path);
            await ref.putData(bytes, SettableMetadata(contentType: contentType));
            return ref.getDownloadURL();
          },
          deleteBytes: (path) => FirebaseStorage.instance.ref(path).delete(),
        ),
```

Adicionar os imports necessários (`collaborator_document_firestore_service.dart`, `firebase_storage` — já presente no projeto via `CompanyLogoStorage`).

- [ ] **Step 4: Verificar compilação e suíte**

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter analyze lib/src/core/repositories/ lib/src/app/app.dart`
Expected: `No issues found!`

Run: `cd sync_flutter && ~/sync_tooling/flutter/bin/flutter test test/collaborator_document_firestore_service_test.dart test/collaborator_document_firestore_mapper_test.dart test/widget_test.dart`
Expected: PASS. `widget_test.dart` é o gate de regressão do construtor do Hybrid.

- [ ] **Step 5: Commit**

```bash
git add sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart sync_flutter/lib/src/app/app.dart
git commit -m "feat: Hybrid delega documentos de colaborador ao Firestore+Storage"
```

---

## Task 4: Security Rules, Storage Rules e índices

**Files:**
- Modify: `firestore.rules`, `firestore.indexes.json`, `storage.rules`
- Create: `firestore-rules-test/collaborator_documents.rules.test.mjs`

**Interfaces:** coleção `collaboratorDocuments`; path de Storage `collaborator-documents/{groupId}/{collaboratorId}/{fileName}`.

> DEPLOY: NÃO rodar `firebase deploy` — o usuário roda o deploy separadamente.

- [ ] **Step 1: Escrever o teste de regra que falha**

Criar `firestore-rules-test/collaborator_documents.rules.test.mjs`, espelhando `collaborators.rules.test.mjs` (read own-group ok / other-group falha, create do próprio grupo ok / hijack falha, delete do próprio grupo ok / hijack falha — **sem** restrição de `isAdmin()`, já que qualquer usuário autenticado do grupo pode subir/excluir documento hoje, igual à rota Next atual que só exige `getSessionUser()`).

- [ ] **Step 2: Rodar e ver falhar (emulador)**

Run: `cd "$(git rev-parse --show-toplevel)" && firebase emulators:exec --only firestore "node --test firestore-rules-test/collaborator_documents.rules.test.mjs"`
Expected: FAIL — sem regra para a coleção.

- [ ] **Step 3: Adicionar a regra**

Em `firestore.rules`, dentro do `match /databases/{database}/documents`, após o bloco `audit`:

```
    match /collaboratorDocuments/{id} {
      allow read:   if isSignedIn() && resource.data.groupId == myGroupId();
      allow create: if isSignedIn() && request.resource.data.groupId == myGroupId();
      allow delete: if isSignedIn() && resource.data.groupId == myGroupId();
      allow update: if false; // metadado e imutavel apos criado; para trocar, apaga e sobe de novo
    }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd "$(git rev-parse --show-toplevel)" && firebase emulators:exec --only firestore "node --test firestore-rules-test/collaborator_documents.rules.test.mjs"`
Expected: PASS.

Rodar as suítes existentes para garantir não-regressão:
Run: `cd "$(git rev-parse --show-toplevel)" && firebase emulators:exec --only firestore "node --test firestore-rules-test/companies.rules.test.mjs firestore-rules-test/collaborators.rules.test.mjs firestore-rules-test/cities.rules.test.mjs"`
Expected: sem regressão.

- [ ] **Step 5: Índice**

Em `firestore.indexes.json`, adicionar:

```json
    {
      "collectionGroup": "collaboratorDocuments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "groupId", "order": "ASCENDING" },
        { "fieldPath": "collaboratorId", "order": "ASCENDING" }
      ]
    }
```

- [ ] **Step 6: Storage Rules**

Em `storage.rules`, adicionar dentro de `match /b/{bucket}/o`, depois do bloco `company-logos`:

```
    match /collaborator-documents/{groupId}/{collaboratorId}/{fileName} {
      allow read:  if isSignedIn() && groupId == myGroupId();
      allow write: if isSignedIn() && groupId == myGroupId()
                   && request.resource.size < 10 * 1024 * 1024;
      allow delete: if isSignedIn() && groupId == myGroupId();
    }
```

- [ ] **Step 7: Commit**

```bash
git add firestore.rules firestore.indexes.json storage.rules firestore-rules-test/collaborator_documents.rules.test.mjs
git commit -m "feat: rules e indice de collaboratorDocuments + storage rules"
```

---

## Task 5: Remover o placeholder morto da rota Next (Supabase Storage)

**Files:**
- Modify: `app/api/collaborators/[id]/documents/route.ts`, `app/api/collaborators/[id]/documents/[docId]/route.ts`

**Interfaces:** nenhuma — a rota fica sem uso depois da Task 3, mas o arquivo continua existindo até a Fase 5 (aposentar Prisma). Este task só documenta o estado, não apaga nada ainda.

- [ ] **Step 1: Adicionar um comentário de topo nos dois arquivos**

Em ambos os arquivos, logo abaixo do último `import`:

```ts
// DEPRECATED: o Flutter fala direto com Firestore+Storage
// (collaborator_document_firestore_service.dart) desde a migracao Firebase.
// Esta rota so sera removida na Fase 5 (aposentar Prisma/Postgres), junto
// com collaboration-data-access.ts.
```

- [ ] **Step 2: Commit**

```bash
git add app/api/collaborators/[id]/documents/route.ts app/api/collaborators/[id]/documents/[docId]/route.ts
git commit -m "docs: marca rota de documentos como deprecated (Flutter ja fala direto com Firestore)"
```

---

## Verificação E2E (manual, pelo usuário — fora do subagent-driven)

Com `npm run dev` na 3100 (após o controller deployar rules/storage rules), aba anônima:
1. Abrir um colaborador → aba de documentos → subir um PDF pequeno → aparece na lista sem erro.
2. Confirmar no console do Firebase: `collaboratorDocuments/{id}` com `storagePath`/`fileUrl`; Storage tem o blob em `collaborator-documents/{groupId}/{collaboratorId}/{id}.pdf`.
3. Excluir o documento → some da lista; blob some do Storage.
4. Tentar subir um arquivo de 15MB → erro de validação amigável (client-side, antes de qualquer upload).

## Self-Review (do autor do plano)

- **Cobertura:** validação de arquivo (Task 1), upload/list/delete combinando Storage+Firestore (Task 2), wire no Hybrid (Task 3), rules/storage rules/índices (Task 4), rota antiga marcada como morta sem quebrar nada (Task 5). ✅
- **Isolamento:** toda operação exige `groupId` das claims; rules confirmam `groupId` tanto no Firestore quanto no Storage; path do Storage inclui `groupId` e `collaboratorId`. ✅
- **Testabilidade sem infra pesada:** `uploadBytes`/`deleteBytes` injetáveis evitam depender de um fake de Firebase Storage inexistente no projeto — toda a lógica de negócio (validação, path, metadado) é testada com `fake_cloud_firestore` puro. ✅
- **Sem placeholders:** código completo em cada step; a Task 5 é deliberadamente um no-op de marcação, não uma remoção — a remoção real é fora de escopo (Fase 5, plano separado). ✅
- **Consistência de tipos:** assinatura de `upload`/`list`/`delete` na Task 2 é a mesma usada no wire da Task 3, que por sua vez respeita a interface já existente em `sync_repository.dart` (`getCollaboratorDocuments`, `uploadCollaboratorDocument`, `deleteCollaboratorDocument`) — nenhuma mudança de assinatura pública, só troca de implementação. ✅
