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
