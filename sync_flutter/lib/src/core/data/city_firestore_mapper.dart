import '../models/sync_models.dart';

/// Dinheiro nunca é double no Firestore — reais viram centavos inteiros.
int reaisToCents(num reais) => (reais * 100).round();
double centsToReais(int cents) => cents / 100.0;

String? _str(dynamic v) => v is String && v.isNotEmpty ? v : null;
int _int(dynamic v) => v is int ? v : (v is num ? v.round() : (int.tryParse('$v') ?? 0));

/// Monta o doc a gravar. Aceita `estimatedAnnualRevenue` (reais) e converte
/// para cents; aceita `stage` ou o alias `currentStage`. groupId é injetado.
Map<String, dynamic> cityDocFromInput(
  Map<String, dynamic> input,
  String groupId,
) {
  final revenue = input['estimatedAnnualRevenue'];
  return {
    'groupId': groupId,
    'name': input['name'],
    'uf': input['uf'],
    'codigoIbge': _str(input['codigoIbge']) ?? _str(input['ibgeCode']) ?? '',
    'status': _str(input['status']) ?? 'ativo',
    'stage': _str(input['stage']) ?? _str(input['currentStage']) ?? 'mapping',
    'collaboratorId': _str(input['collaboratorId']),
    'collaboratorName': _str(input['collaboratorName']),
    'estimatedAnnualRevenueCents': revenue is num ? reaisToCents(revenue) : 0,
    'probability': input['probability'] is num ? _int(input['probability']) : 10,
    'nextStepDescription': _str(input['nextStepDescription']),
    'nextStepDueDate': _str(input['nextStepDueDate']),
    'lastActivityAt': _str(input['lastActivityAt']),
    'deletedAt': null,
  };
}

CityAccount cityFromDoc(String id, Map<String, dynamic> data) {
  return CityAccount(
    id: id,
    name: (data['name'] as String?) ?? '',
    uf: (data['uf'] as String?) ?? '',
    codigoIbge: (data['codigoIbge'] as String?) ?? '',
    status: (data['status'] as String?) ?? 'ativo',
    stage: (data['stage'] as String?) ?? 'mapping',
    collaboratorId: _str(data['collaboratorId']),
    collaboratorName: _str(data['collaboratorName']),
    estimatedAnnualRevenue: centsToReais(_int(data['estimatedAnnualRevenueCents'])),
    probability: data['probability'] is num ? _int(data['probability']) : 10,
    nextStepDescription: _str(data['nextStepDescription']),
    nextStepDueDate: _str(data['nextStepDueDate']),
    lastActivityAt: _str(data['lastActivityAt']),
  );
}
