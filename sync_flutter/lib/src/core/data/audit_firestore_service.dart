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
