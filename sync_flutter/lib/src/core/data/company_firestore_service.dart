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
