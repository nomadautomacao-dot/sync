import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/company_firestore_mapper.dart';
import 'package:sync_flutter/src/core/theme/app_theme.dart';

void main() {
  group('rótulos', () {
    test('status de empresa em português', () {
      expect(companyStatusLabel('active'), 'Ativo');
      expect(companyStatusLabel('inactive'), 'Inativo');
      expect(companyStatusLabel('desconhecido'), 'desconhecido');
    });

    test('status de funcionário em português', () {
      expect(employeeStatusLabel('active'), 'Ativo');
      expect(employeeStatusLabel('on_leave'), 'Afastado');
      expect(employeeStatusLabel('inactive'), 'Inativo');
    });

    test('cor de status vem de SaaSTokens (tema claro)', () {
      expect(companyStatusColor('Ativo'), SaaSTokens.success);
      expect(companyStatusColor('Inativo'), SaaSTokens.textDim);
      expect(companyStatusColor('Prospecto'), SaaSTokens.primary);
    });
  });

  group('companyDocFromInput', () {
    test('injeta groupId, default de status e deletedAt null', () {
      final doc = companyDocFromInput({
        'name': 'Rocha Prime Consultorias LTDA',
        'tradingName': 'Rocha Prime',
        'cnpj': '12.345.678/0001-99',
        'city': 'Salvador',
        'state': 'BA',
        'email': 'contato@rochaprime.com',
        'phone': '7133330000',
        'contactName': 'Adriel Tavares',
        'contactPosition': 'Diretor',
      }, 'grupo-1');

      expect(doc['groupId'], 'grupo-1');
      expect(doc['tradingName'], 'Rocha Prime');
      expect(doc['status'], 'active'); // default
      expect(doc['enabledModules'], <String>[]); // default
      expect(doc['logo'], isNull);
      expect(doc['deletedAt'], isNull);
      expect(doc.containsKey('groupId'), isTrue);
    });

    test('preserva status, enabledModules e logo quando fornecidos', () {
      final doc = companyDocFromInput({
        'name': 'X',
        'tradingName': 'X',
        'cnpj': '1',
        'city': 'C',
        'state': 'BA',
        'email': 'e@e.com',
        'phone': '1',
        'contactName': 'N',
        'contactPosition': 'P',
        'status': 'inactive',
        'enabledModules': ['fundeb', 'consultoria'],
        'logo': 'https://x/logo.png',
      }, 'grupo-1');

      expect(doc['status'], 'inactive');
      expect(doc['enabledModules'], ['fundeb', 'consultoria']);
      expect(doc['logo'], 'https://x/logo.png');
    });
  });

  group('companySummaryFromDoc', () {
    test('rotula status e deriva cor', () {
      final s = companySummaryFromDoc('c1', {
        'groupId': 'grupo-1',
        'tradingName': 'Rocha Prime',
        'segment': 'consultoria',
        'cnpj': '12.345.678/0001-99',
        'status': 'active',
        'city': 'Salvador',
        'state': 'BA',
        'enabledModules': ['fundeb'],
      });

      expect(s.id, 'c1');
      expect(s.tradingName, 'Rocha Prime');
      expect(s.status, 'Ativo');
      expect(s.color, SaaSTokens.success);
      expect(s.enabledModules, ['fundeb']);
    });

    test('tolera campos ausentes', () {
      final s = companySummaryFromDoc('c1', {'groupId': 'grupo-1'});
      expect(s.tradingName, '');
      expect(s.segment, 'outro');
      expect(s.enabledModules, isEmpty);
    });
  });

  group('companyDetailsFromDoc', () {
    test('mapeia todos os campos da UI', () {
      final d = companyDetailsFromDoc('c1', {
        'name': 'Rocha Prime Consultorias LTDA',
        'tradingName': 'Rocha Prime',
        'cnpj': '12.345.678/0001-99',
        'status': 'inactive',
        'segment': 'consultoria',
        'city': 'Salvador',
        'state': 'BA',
        'email': 'contato@rochaprime.com',
        'phone': '7133330000',
        'contactName': 'Adriel Tavares',
        'contactPosition': 'Diretor',
        'enabledModules': ['fundeb', 'consultoria'],
      });

      expect(d.name, 'Rocha Prime Consultorias LTDA');
      expect(d.status, 'Inativo');
      expect(d.contactName, 'Adriel Tavares');
      expect(d.enabledModules, ['fundeb', 'consultoria']);
    });
  });

  group('employee', () {
    test('employeeDocFromInput injeta groupId, companyId e deletedAt null', () {
      final doc = employeeDocFromInput({
        'companyId': 'c1',
        'name': 'Fulano',
        'email': 'f@e.com',
        'position': 'Analista',
        'role': 'analyst',
      }, 'grupo-1');

      expect(doc['groupId'], 'grupo-1');
      expect(doc['companyId'], 'c1');
      expect(doc['status'], 'active');
      expect(doc['deletedAt'], isNull);
    });

    test('employeeFromDoc rotula status', () {
      final e = employeeFromDoc('e1', {
        'name': 'Fulano',
        'email': 'f@e.com',
        'position': 'Analista',
        'role': 'analyst',
        'status': 'on_leave',
      });
      expect(e.id, 'e1');
      expect(e.name, 'Fulano');
      expect(e.status, 'Afastado');
    });
  });
}
