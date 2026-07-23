import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/city_firestore_mapper.dart';

void main() {
  test('reais<->cents sem perda de precisao', () {
    expect(reaisToCents(150000), 15000000);
    expect(reaisToCents(1234.56), 123456);
    expect(centsToReais(123456), 1234.56);
  });

  test('cityDocFromInput injeta groupId, cents e deletedAt null', () {
    final doc = cityDocFromInput({
      'name': 'Arapiraca',
      'uf': 'AL',
      'codigoIbge': '2700300',
      'stage': 'mapping',
      'estimatedAnnualRevenue': 150000.0,
      'probability': 20,
      'collaboratorId': 'c1',
      'collaboratorName': 'Rafael',
    }, 'grupo-1');

    expect(doc['groupId'], 'grupo-1');
    expect(doc['name'], 'Arapiraca');
    expect(doc['stage'], 'mapping');
    expect(doc['estimatedAnnualRevenueCents'], 15000000);
    expect(doc.containsKey('estimatedAnnualRevenue'), isFalse); // so cents no doc
    expect(doc['probability'], 20);
    expect(doc['status'], 'ativo'); // default
    expect(doc['deletedAt'], isNull);
  });

  test('cityDocFromInput aceita currentStage como alias de stage', () {
    final doc = cityDocFromInput({
      'name': 'X', 'uf': 'BA', 'currentStage': 'contractual',
    }, 'grupo-1');
    expect(doc['stage'], 'contractual');
  });

  test('cityFromDoc converte cents de volta para reais', () {
    final c = cityFromDoc('city1', {
      'groupId': 'grupo-1',
      'name': 'Arapiraca',
      'uf': 'AL',
      'codigoIbge': '2700300',
      'status': 'ativo',
      'stage': 'mapping',
      'estimatedAnnualRevenueCents': 15000000,
      'probability': 20,
      'collaboratorId': 'c1',
      'collaboratorName': 'Rafael',
    });

    expect(c.id, 'city1');
    expect(c.name, 'Arapiraca');
    expect(c.stage, 'mapping');
    expect(c.estimatedAnnualRevenue, 150000.0);
    expect(c.probability, 20);
    expect(c.collaboratorName, 'Rafael');
  });

  test('cityFromDoc tolera campos ausentes', () {
    final c = cityFromDoc('city1', {'groupId': 'g', 'name': 'Y', 'uf': 'GO'});
    expect(c.status, 'ativo');
    expect(c.stage, 'mapping');
    expect(c.estimatedAnnualRevenue, 0.0);
    expect(c.probability, 10);
  });
}
