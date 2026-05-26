import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

enum AppSection { dashboard, inbox, companies, people, modules, settings }

extension AppSectionX on AppSection {
  String get label => switch (this) {
    AppSection.dashboard => 'Dashboard',
    AppSection.inbox => 'Inbox',
    AppSection.companies => 'Minha Empresa',
    AppSection.people => 'Colaboradores',
    AppSection.modules => 'Modulos',
    AppSection.settings => 'Configuracoes',
  };

  IconData get icon => switch (this) {
    AppSection.dashboard => LucideIcons.layoutDashboard,
    AppSection.inbox => LucideIcons.inbox,
    AppSection.companies => LucideIcons.building2,
    AppSection.people => LucideIcons.usersRound,
    AppSection.modules => LucideIcons.blocks,
    AppSection.settings => LucideIcons.settings2,
  };
}

class SyncUser {
  const SyncUser({
    required this.name,
    required this.email,
    required this.initials,
  });

  final String name;
  final String email;
  final String initials;
}

class KpiMetric {
  const KpiMetric({
    required this.label,
    required this.value,
    required this.helper,
    required this.icon,
    required this.color,
    this.sparkData,
  });

  final String label;
  final String value;
  final String helper;
  final IconData icon;
  final Color color;
  final List<double>? sparkData;
}

class MonthlyPoint {
  const MonthlyPoint({
    required this.label,
    required this.revenue,
    required this.profit,
    required this.commission,
  });

  final String label;
  final double revenue;
  final double profit;
  final double commission;
}

class AlertMessage {
  const AlertMessage({required this.text, required this.color});

  final String text;
  final Color color;
}

class PortfolioSlice {
  const PortfolioSlice({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final int value;
  final Color color;
}

class MunicipalityProjection {
  const MunicipalityProjection({
    required this.name,
    required this.state,
    required this.stage,
    required this.projectedRevenue,
    required this.projectedProfit,
    required this.probability,
    required this.collaboratorName,
  });

  final String name;
  final String state;
  final String stage;
  final double projectedRevenue;
  final double projectedProfit;
  final double probability;
  final String collaboratorName;
}

class DashboardOverview {
  const DashboardOverview({
    required this.year,
    required this.projectedGrossRevenue,
    required this.projectedProfit,
    required this.projectedMargin,
    required this.implementationCoverage,
    required this.kpis,
    required this.monthlyTrend,
    required this.alerts,
    required this.portfolioMix,
    required this.topMunicipalities,
  });

  final int year;
  final double projectedGrossRevenue;
  final double projectedProfit;
  final double projectedMargin;
  final double implementationCoverage;
  final List<KpiMetric> kpis;
  final List<MonthlyPoint> monthlyTrend;
  final List<AlertMessage> alerts;
  final List<PortfolioSlice> portfolioMix;
  final List<MunicipalityProjection> topMunicipalities;
}

class CompanySummary {
  const CompanySummary({
    required this.id,
    required this.tradingName,
    required this.segment,
    required this.cnpj,
    required this.status,
    required this.city,
    required this.state,
    required this.enabledModules,
    required this.color,
  });

  final String id;
  final String tradingName;
  final String segment;
  final String cnpj;
  final String status;
  final String city;
  final String state;
  final List<String> enabledModules;
  final Color color;
}

class CompanyDetails {
  const CompanyDetails({
    required this.id,
    required this.name,
    required this.tradingName,
    required this.cnpj,
    required this.status,
    required this.segment,
    required this.city,
    required this.state,
    required this.email,
    required this.phone,
    required this.contactName,
    required this.contactPosition,
    required this.enabledModules,
  });

  final String id;
  final String name;
  final String tradingName;
  final String cnpj;
  final String status;
  final String segment;
  final String city;
  final String state;
  final String email;
  final String phone;
  final String contactName;
  final String contactPosition;
  final List<String> enabledModules;
}

class EmployeeRecord {
  const EmployeeRecord({
    required this.id,
    required this.name,
    required this.email,
    required this.position,
    required this.role,
    required this.status,
  });

  final String id;
  final String name;
  final String email;
  final String position;
  final String role;
  final String status;
}

class CompanyBundle {
  const CompanyBundle({required this.company, required this.employees});

  final CompanyDetails company;
  final List<EmployeeRecord> employees;
}

class CollaboratorSummary {
  const CollaboratorSummary({
    required this.id,
    required this.fullName,
    required this.role,
    required this.type,
    required this.state,
    required this.status,
    required this.cities,
    required this.fidelized,
    required this.profitYtd,
    required this.commissionYtd,
  });

  final String id;
  final String fullName;
  final String role;
  final String type;
  final String state;
  final String status;
  final int cities;
  final int fidelized;
  final double profitYtd;
  final double commissionYtd;
}

class AuditEntry {
  const AuditEntry({required this.action, required this.createdAt});

  final String action;
  final String createdAt;
}

class ModuleDefinition {
  const ModuleDefinition({
    required this.key,
    required this.label,
    required this.description,
    required this.color,
    required this.icon,
    this.mappedFlows = const <String>[],
  });

  final String key;
  final String label;
  final String description;
  final Color color;
  final IconData icon;
  final List<String> mappedFlows;
}

class WorkspaceSettings {
  const WorkspaceSettings({
    required this.id,
    required this.groupName,
    required this.slug,
    this.rawSettings = const <String, dynamic>{},
  });

  final String id;
  final String groupName;
  final String slug;
  final Map<String, dynamic> rawSettings;
}

class CityAccount {
  const CityAccount({
    required this.id,
    required this.name,
    required this.uf,
    this.codigoIbge = '',
    this.status = 'ativo',
  });

  final String id;
  final String name;
  final String uf;
  final String codigoIbge;
  final String status;

  factory CityAccount.fromJson(Map<String, dynamic> json) => CityAccount(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? json['nome']?.toString() ?? '',
    uf: json['uf']?.toString() ?? '',
    codigoIbge: json['codigoIbge']?.toString() ?? json['codigo_ibge']?.toString() ?? '',
    status: json['status']?.toString() ?? 'ativo',
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'uf': uf,
    'codigoIbge': codigoIbge,
    'status': status,
  };
}
