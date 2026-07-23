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
