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
