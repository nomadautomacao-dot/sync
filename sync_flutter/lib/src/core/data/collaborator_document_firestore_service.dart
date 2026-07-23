import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/sync_models.dart';
import 'collaborator_document_firestore_mapper.dart';

typedef UploadBytesFn = Future<String> Function({
  required String path,
  required Uint8List bytes,
  required String contentType,
});
typedef DeleteBytesFn = Future<void> Function(String path);

/// Documentos de colaborador: blob no Firebase Storage + metadado no
/// Firestore. Path e id do doc sao sempre o mesmo valor, entao delete nao
/// precisa parsear URL (diferente da rota Next legada, que extraia o path
/// da URL publica do Supabase).
class CollaboratorDocumentFirestoreService {
  CollaboratorDocumentFirestoreService({
    required FirebaseFirestore firestore,
    required Future<String?> Function() groupIdLoader,
    required UploadBytesFn uploadBytes,
    required DeleteBytesFn deleteBytes,
  })  : _firestore = firestore,
        _groupIdLoader = groupIdLoader,
        _uploadBytes = uploadBytes,
        _deleteBytes = deleteBytes;

  final FirebaseFirestore _firestore;
  final Future<String?> Function() _groupIdLoader;
  final UploadBytesFn _uploadBytes;
  final DeleteBytesFn _deleteBytes;

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
