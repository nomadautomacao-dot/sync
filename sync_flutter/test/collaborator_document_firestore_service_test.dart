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
