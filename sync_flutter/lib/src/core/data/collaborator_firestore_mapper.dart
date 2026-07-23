import '../models/sync_models.dart';

/// Percentual (Decimal(8,4) no schema antigo) guardado como inteiro em basis
/// points: bps = percent x 10000. Ver a regra global "dinheiro nunca e double".
int percentToBps(num percent) => (percent * 10000).round();
double bpsToPercent(int bps) => bps / 10000.0;

String? _str(dynamic v) => v is String && v.isNotEmpty ? v : null;
int _int(dynamic v) => v is int ? v : (v is num ? v.toInt() : 0);

/// Monta o documento a gravar a partir do payload da tela + o groupId do token.
/// O groupId nunca vem do cliente; e injetado pelo service a partir das claims.
Map<String, dynamic> collaboratorDocFromInput(
  Map<String, dynamic> input,
  String groupId,
) {
  final percent = input['defaultCommissionPercent'];
  return {
    'groupId': groupId,
    'fullName': input['fullName'],
    'shortName': _str(input['shortName']),
    'email': _str(input['email']),
    'phone': _str(input['phone']),
    'whatsapp': _str(input['whatsapp']),
    'cpfOrDocument': _str(input['cpfOrDocument']),
    'city': _str(input['city']),
    'state': _str(input['state']),
    'companyOrOrganization': _str(input['companyOrOrganization']),
    'title': _str(input['title']),
    'collaboratorType': input['collaboratorType'],
    'primaryRole': input['primaryRole'],
    'partnershipStatus': _str(input['partnershipStatus']) ?? 'active',
    'trustLevel': input['trustLevel'],
    'averageInfluenceScore': input['averageInfluenceScore'],
    'defaultCommissionPercentBps':
        percent is num ? percentToBps(percent) : 0,
    'defaultProfitBaseType': _str(input['defaultProfitBaseType']),
    'defaultTriggerType': _str(input['defaultTriggerType']),
    'payoutCycle': _str(input['payoutCycle']),
    'payoutMethod': _str(input['payoutMethod']),
    'notes': _str(input['notes']),
    'confidentialNotes': _str(input['confidentialNotes']),
    'deletedAt': null,
  };
}

/// Rotula o status cru do Firestore em portugues, com os mesmos textos que o
/// RemoteSyncRepository (`_collaboratorStatusLabel`) produzia a partir do
/// Postgres — a lista/summary da UI espera o rotulo, nao o valor cru do enum.
String collaboratorStatusLabel(String status) {
  switch (status) {
    case 'active':
      return 'Ativo';
    case 'prospect':
      return 'Prospeccao';
    case 'paused':
      return 'Pausado';
    case 'blocked':
      return 'Bloqueado';
    case 'inactive':
      return 'Inativo';
    default:
      return status.isEmpty ? '--' : status;
  }
}

/// Rotula o tipo cru do Firestore em portugues, espelhando
/// `_collaboratorTypeLabel` do RemoteSyncRepository.
String collaboratorTypeLabel(String type) {
  switch (type) {
    case 'internal_consultant':
      return 'Consultor interno';
    case 'external_partner':
      return 'Parceiro externo';
    case 'municipal_articulator':
      return 'Articulador municipal';
    case 'introducer':
      return 'Introducer';
    case 'strategic_advisor':
      return 'Conselheiro estrategico';
    case 'implementation_support':
      return 'Suporte de implantacao';
    case 'executive_sponsor':
      return 'Sponsor executivo';
    case 'hybrid':
      return 'Hibrido';
    default:
      return type.isEmpty ? '--' : type;
  }
}

CollaboratorSummary collaboratorSummaryFromDoc(
  String id,
  Map<String, dynamic> data,
) {
  return CollaboratorSummary(
    id: id,
    fullName: (data['fullName'] as String?) ?? '',
    role: (data['primaryRole'] as String?) ?? '',
    type: collaboratorTypeLabel((data['collaboratorType'] as String?) ?? ''),
    state: (data['state'] as String?) ?? '',
    status: collaboratorStatusLabel(
      (data['partnershipStatus'] as String?) ?? 'active',
    ),
    // Derivados de outras entidades — zerados nesta fatia (fases 2.2 e 2.3).
    cities: 0,
    fidelized: 0,
    profitYtd: 0.0,
    commissionYtd: 0.0,
  );
}

CollaboratorDetails collaboratorDetailsFromDoc(
  String id,
  Map<String, dynamic> data,
) {
  return CollaboratorDetails(
    id: id,
    fullName: (data['fullName'] as String?) ?? '',
    shortName: _str(data['shortName']),
    email: _str(data['email']),
    phone: _str(data['phone']),
    whatsapp: _str(data['whatsapp']),
    cpfOrDocument: _str(data['cpfOrDocument']),
    city: _str(data['city']),
    state: _str(data['state']),
    companyOrOrganization: _str(data['companyOrOrganization']),
    title: _str(data['title']),
    collaboratorType: (data['collaboratorType'] as String?) ?? '',
    primaryRole: (data['primaryRole'] as String?) ?? '',
    partnershipStatus: (data['partnershipStatus'] as String?) ?? 'active',
    trustLevel: data['trustLevel'] as int?,
    averageInfluenceScore: data['averageInfluenceScore'] as int?,
    defaultCommissionPercent: bpsToPercent(_int(data['defaultCommissionPercentBps'])),
    defaultProfitBaseType: _str(data['defaultProfitBaseType']),
    defaultTriggerType: _str(data['defaultTriggerType']),
    payoutCycle: _str(data['payoutCycle']),
    payoutMethod: _str(data['payoutMethod']),
    notes: _str(data['notes']),
    confidentialNotes: _str(data['confidentialNotes']),
    documents: const [],
  );
}
