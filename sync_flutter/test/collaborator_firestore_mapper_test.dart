import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/collaborator_firestore_mapper.dart';

void main() {
  group('percent <-> bps', () {
    test('converte percent para basis points (x10000)', () {
      expect(percentToBps(5), 50000);
      expect(percentToBps(2.5), 25000);
      expect(percentToBps(0), 0);
    });

    test('converte basis points de volta para percent', () {
      expect(bpsToPercent(50000), 5.0);
      expect(bpsToPercent(25000), 2.5);
      expect(bpsToPercent(0), 0.0);
    });
  });

  group('collaboratorDocFromInput', () {
    test('monta o doc com groupId, bps e deletedAt nulo', () {
      final doc = collaboratorDocFromInput({
        'fullName': 'Maria Silva',
        'collaboratorType': 'external_partner',
        'primaryRole': 'Articuladora',
        'partnershipStatus': 'active',
        'defaultCommissionPercent': 5,
        'email': 'maria@x.com',
      }, 'grupo-1');

      expect(doc['groupId'], 'grupo-1');
      expect(doc['fullName'], 'Maria Silva');
      expect(doc['defaultCommissionPercentBps'], 50000);
      expect(doc['deletedAt'], isNull);
      expect(doc.containsKey('defaultCommissionPercent'), isFalse,
          reason: 'nunca grava o percent como double');
    });

    test('usa defaults quando campos opcionais faltam', () {
      final doc = collaboratorDocFromInput({
        'fullName': 'Sem Comissao',
        'collaboratorType': 'introducer',
        'primaryRole': 'Indicador',
      }, 'grupo-1');

      expect(doc['partnershipStatus'], 'active');
      expect(doc['defaultCommissionPercentBps'], 0);
      expect(doc['email'], isNull);
    });
  });

  group('collaboratorSummaryFromDoc', () {
    test('mapeia doc para summary com derivados zerados', () {
      final s = collaboratorSummaryFromDoc('c1', {
        'fullName': 'Maria Silva',
        'primaryRole': 'Articuladora',
        'collaboratorType': 'external_partner',
        'state': 'BA',
        'partnershipStatus': 'active',
        'defaultCommissionPercentBps': 50000,
      });

      expect(s.id, 'c1');
      expect(s.fullName, 'Maria Silva');
      expect(s.role, 'Articuladora');
      expect(s.type, 'Parceiro externo');
      expect(s.state, 'BA');
      expect(s.status, 'Ativo');
      // derivados de outras entidades — zerados nesta fatia
      expect(s.cities, 0);
      expect(s.fidelized, 0);
      expect(s.profitYtd, 0.0);
      expect(s.commissionYtd, 0.0);
    });

    test('tolera campos ausentes sem quebrar', () {
      final s = collaboratorSummaryFromDoc('c2', {'fullName': 'So Nome'});
      expect(s.fullName, 'So Nome');
      expect(s.role, '');
      expect(s.state, '');
      expect(s.status, 'Ativo');
    });

    test('devolve o valor cru como fallback quando desconhecido', () {
      final s = collaboratorSummaryFromDoc('c3', {
        'fullName': 'Tipo Desconhecido',
        'collaboratorType': 'valor_inexistente',
        'partnershipStatus': 'valor_tambem_inexistente',
      });
      expect(s.type, 'valor_inexistente');
      expect(s.status, 'valor_tambem_inexistente');
    });
  });

  group('collaboratorDetailsFromDoc', () {
    test('mapeia doc para details convertendo bps de volta', () {
      final d = collaboratorDetailsFromDoc('c1', {
        'fullName': 'Maria Silva',
        'collaboratorType': 'external_partner',
        'primaryRole': 'Articuladora',
        'partnershipStatus': 'active',
        'defaultCommissionPercentBps': 50000,
        'email': 'maria@x.com',
        'notes': 'nota',
      });

      expect(d.id, 'c1');
      expect(d.fullName, 'Maria Silva');
      expect(d.defaultCommissionPercent, 5.0);
      expect(d.email, 'maria@x.com');
      expect(d.notes, 'nota');
      expect(d.documents, isEmpty);
    });
  });
}
