import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../models/sync_models.dart';
import '../theme/app_theme.dart';

/// Dashboard como agregacao de contagens do Firestore. KPIs de contagem sao
/// reais; KPIs de dinheiro ficam zerados ate a Frente B (Cloud Functions).
class DashboardFirestoreService {
  DashboardFirestoreService({
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

  Future<int> _count(String col, String groupId) async {
    final snap = await _firestore
        .collection(col)
        .where('groupId', isEqualTo: groupId)
        .where('deletedAt', isNull: true)
        .get();
    return snap.size;
  }

  Future<DashboardOverview> overview({int? year}) async {
    final groupId = await _requireGroupId();
    final cities = await _count('cities', groupId);
    final collaborators = await _count('collaborators', groupId);
    final companies = await _count('companies', groupId);

    KpiMetric count(String label, int value, String helper, IconData icon, Color color) =>
        KpiMetric(label: label, value: '$value', helper: helper, icon: icon, color: color);
    KpiMetric money(String label, String helper, IconData icon, Color color) =>
        KpiMetric(label: label, value: 'R\$ 0', helper: helper, icon: icon, color: color);

    return DashboardOverview(
      year: year ?? 2026,
      projectedGrossRevenue: 0,
      projectedProfit: 0,
      projectedMargin: 0,
      implementationCoverage: 0,
      kpis: [
        count('Cidades trabalhadas', cities, 'municipios no pipeline',
            Icons.location_city, SaaSTokens.primary),
        count('Colaboradores', collaborators, 'parceiros e articuladores',
            Icons.groups, SaaSTokens.success),
        count('Empresas', companies, 'empresas do grupo',
            Icons.apartment, SaaSTokens.warning),
        money('Lucro base YTD', 'via motor financeiro (em breve)',
            Icons.attach_money, SaaSTokens.primary),
        money('Comissao prevista', 'via motor financeiro (em breve)',
            Icons.attach_money, SaaSTokens.primaryDim),
      ],
      monthlyTrend: const [],
      alerts: const [],
      portfolioMix: const [],
      topMunicipalities: const [],
    );
  }
}
