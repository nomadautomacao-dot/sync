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
    // `isNull: true` (em vez de `isEqualTo: null`) porque o SDK do Firestore
    // — e o fake usado nos testes — nao tratam `isEqualTo: null` como uma
    // igualdade valida; ha um parametro dedicado para checar nulidade.
    final snap = await _col
        .where('groupId', isEqualTo: groupId)
        .where('deletedAt', isNull: true)
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
