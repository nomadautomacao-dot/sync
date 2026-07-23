import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

enum AppSection { dashboard, inbox, companies, people, pipeline, modules, settings }

extension AppSectionX on AppSection {
  String get label => switch (this) {
    AppSection.dashboard => 'Dashboard',
    AppSection.inbox => 'Inbox',
    AppSection.companies => 'Minha Empresa',
    AppSection.people => 'Colaboradores',
    AppSection.pipeline => 'Plano de Ação',
    AppSection.modules => 'Modulos',
    AppSection.settings => 'Configuracoes',
  };

  IconData get icon => switch (this) {
    AppSection.dashboard => LucideIcons.layoutDashboard,
    AppSection.inbox => LucideIcons.inbox,
    AppSection.companies => LucideIcons.building2,
    AppSection.people => LucideIcons.usersRound,
    AppSection.pipeline => LucideIcons.clipboardList,
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
    this.logo,
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
  final String? logo;
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
    this.stage = 'mapping',
    this.collaboratorId,
    this.collaboratorName,
    this.estimatedAnnualRevenue = 0.0,
    this.probability = 10,
    this.nextStepDescription,
    this.nextStepDueDate,
    this.lastActivityAt,
  });

  final String id;
  final String name;
  final String uf;
  final String codigoIbge;
  final String status;
  final String stage;
  final String? collaboratorId;
  final String? collaboratorName;
  final double estimatedAnnualRevenue;
  final int probability;
  final String? nextStepDescription;
  final String? nextStepDueDate;
  final String? lastActivityAt;

  factory CityAccount.fromJson(Map<String, dynamic> json) => CityAccount(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? json['nome']?.toString() ?? json['municipalityName']?.toString() ?? '',
    uf: json['uf']?.toString() ?? json['state']?.toString() ?? '',
    codigoIbge: json['codigoIbge']?.toString() ?? json['codigo_ibge']?.toString() ?? json['ibgeCode']?.toString() ?? '',
    status: json['status']?.toString() ?? json['accountStatus']?.toString() ?? 'ativo',
    stage: json['stage']?.toString() ?? json['currentStage']?.toString() ?? 'mapping',
    collaboratorId: json['collaboratorId']?.toString() ?? json['collaborator']?['id']?.toString(),
    collaboratorName: json['collaboratorName']?.toString() ?? json['collaborator']?['fullName']?.toString() ?? json['collaborator']?['nome']?.toString(),
    estimatedAnnualRevenue: (json['estimatedAnnualRevenue'] as num?)?.toDouble() ?? 0.0,
    probability: (json['probability'] as num?)?.toInt() ?? (json['forecastProbability'] as num?)?.toInt() ?? 10,
    nextStepDescription: json['nextStepDescription']?.toString() ?? json['proximoPasso']?.toString(),
    nextStepDueDate: json['nextStepDueDate']?.toString() ?? json['dataProximoPasso']?.toString(),
    lastActivityAt: json['lastActivityAt']?.toString() ?? json['updatedAt']?.toString(),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'uf': uf,
    'codigoIbge': codigoIbge,
    'status': status,
    'stage': stage,
    'collaboratorId': collaboratorId,
    'collaboratorName': collaboratorName,
    'estimatedAnnualRevenue': estimatedAnnualRevenue,
    'probability': probability,
    'nextStepDescription': nextStepDescription,
    'nextStepDueDate': nextStepDueDate,
    'lastActivityAt': lastActivityAt,
  };
}

/// Diagnóstico FUNDEB completo para enriquecer o Plano de Ação.
/// Espelha todos os blocos do relatório técnico gerado pelo PrimeOS.
class FundebDiagnostico {
  const FundebDiagnostico({
    required this.cityId,
    this.exercicio = 2026,
    this.gestor,
    this.partido,
    this.populacao = 0,
    this.areaKm2 = 0.0,
    this.pibPerCapita = 0.0,
    this.escolarizacao614 = 0.0,
    this.receitaFundeb2026 = 0.0,
    this.estimativa2027 = 0.0,
    this.ganhoPotencial = 0.0,
    this.ganhoPotencialPct = 0.0,
    this.camadaRecuperavel = 0.0,
    this.vaafAtual = 0.0,
    this.vaafProjetado = 0.0,
    this.vaatAtual = 0.0,
    this.vaatProjetado = 0.0,
    this.vaarAtual = 0.0,
    this.vaarProjetado = 0.0,
    this.habilitacaoVaat = false,
    this.indiceEficienciaArrecadatoria = 0.0,
    this.fundebPerCapita = 0.0,
    this.fatorAjusteRegional = 0.0,
    this.matriculasTotaisMunicipal = 0,
    this.matriculasCreche = 0,
    this.matriculasPreEscola = 0,
    this.matriculasAnosIniciais = 0,
    this.matriculasAnosFinais = 0,
    this.matriculasEja = 0,
    this.matriculasEspecial = 0,
    this.matriculasIntegral = 0,
    this.coberturaIntegralPct = 0.0,
    this.recursoRealPorAluno = 0.0,
    this.idebAnosIniciais,
    this.idebAnosFinais,
    this.metaIdebAnosIniciais,
    this.metaIdebAnosFinais,
    this.simecObras = 0,
    this.pddeEscolas = 0,
    this.sigarpwebStatus,
    this.despesaEducacao = 0.0,
    this.vinculacaoMde = 0.0,
    this.alertasTecnicos = const [],
    this.proximosPassos = const [],
  });

  final String cityId;
  final int exercicio;
  // Identificação do ente
  final String? gestor;
  final String? partido;
  final int populacao;
  final double areaKm2;
  final double pibPerCapita;
  final double escolarizacao614;
  // Receita e projeção
  final double receitaFundeb2026;
  final double estimativa2027;
  final double ganhoPotencial;
  final double ganhoPotencialPct;
  final double camadaRecuperavel;
  // VAAF / VAAT / VAAR
  final double vaafAtual;
  final double vaafProjetado;
  final double vaatAtual;
  final double vaatProjetado;
  final double vaarAtual;
  final double vaarProjetado;
  // Eficiência
  final bool habilitacaoVaat;
  final double indiceEficienciaArrecadatoria;
  final double fundebPerCapita;
  final double fatorAjusteRegional;
  // Matrículas
  final int matriculasTotaisMunicipal;
  final int matriculasCreche;
  final int matriculasPreEscola;
  final int matriculasAnosIniciais;
  final int matriculasAnosFinais;
  final int matriculasEja;
  final int matriculasEspecial;
  final int matriculasIntegral;
  final double coberturaIntegralPct;
  final double recursoRealPorAluno;
  // IDEB
  final double? idebAnosIniciais;
  final double? idebAnosFinais;
  final double? metaIdebAnosIniciais;
  final double? metaIdebAnosFinais;
  // Sistemas MEC/FNDE
  final int simecObras;
  final int pddeEscolas;
  final String? sigarpwebStatus;
  // SICONFI
  final double despesaEducacao;
  final double vinculacaoMde;
  // Alertas e roteiro
  final List<String> alertasTecnicos;
  final List<String> proximosPassos;

  factory FundebDiagnostico.fromJson(Map<String, dynamic> json) => FundebDiagnostico(
    cityId: json['cityId']?.toString() ?? '',
    exercicio: (json['exercicio'] as num?)?.toInt() ?? 2026,
    gestor: json['gestor']?.toString(),
    partido: json['partido']?.toString(),
    populacao: (json['populacao'] as num?)?.toInt() ?? 0,
    areaKm2: (json['areaKm2'] as num?)?.toDouble() ?? 0.0,
    pibPerCapita: (json['pibPerCapita'] as num?)?.toDouble() ?? 0.0,
    escolarizacao614: (json['escolarizacao614'] as num?)?.toDouble() ?? 0.0,
    receitaFundeb2026: (json['receitaFundeb2026'] as num?)?.toDouble() ?? 0.0,
    estimativa2027: (json['estimativa2027'] as num?)?.toDouble() ?? 0.0,
    ganhoPotencial: (json['ganhoPotencial'] as num?)?.toDouble() ?? 0.0,
    ganhoPotencialPct: (json['ganhoPotencialPct'] as num?)?.toDouble() ?? 0.0,
    camadaRecuperavel: (json['camadaRecuperavel'] as num?)?.toDouble() ?? 0.0,
    vaafAtual: (json['vaafAtual'] as num?)?.toDouble() ?? 0.0,
    vaafProjetado: (json['vaafProjetado'] as num?)?.toDouble() ?? 0.0,
    vaatAtual: (json['vaatAtual'] as num?)?.toDouble() ?? 0.0,
    vaatProjetado: (json['vaatProjetado'] as num?)?.toDouble() ?? 0.0,
    vaarAtual: (json['vaarAtual'] as num?)?.toDouble() ?? 0.0,
    vaarProjetado: (json['vaarProjetado'] as num?)?.toDouble() ?? 0.0,
    habilitacaoVaat: json['habilitacaoVaat'] as bool? ?? false,
    indiceEficienciaArrecadatoria: (json['indiceEficienciaArrecadatoria'] as num?)?.toDouble() ?? 0.0,
    fundebPerCapita: (json['fundebPerCapita'] as num?)?.toDouble() ?? 0.0,
    fatorAjusteRegional: (json['fatorAjusteRegional'] as num?)?.toDouble() ?? 0.0,
    matriculasTotaisMunicipal: (json['matriculasTotaisMunicipal'] as num?)?.toInt() ?? 0,
    matriculasCreche: (json['matriculasCreche'] as num?)?.toInt() ?? 0,
    matriculasPreEscola: (json['matriculasPreEscola'] as num?)?.toInt() ?? 0,
    matriculasAnosIniciais: (json['matriculasAnosIniciais'] as num?)?.toInt() ?? 0,
    matriculasAnosFinais: (json['matriculasAnosFinais'] as num?)?.toInt() ?? 0,
    matriculasEja: (json['matriculasEja'] as num?)?.toInt() ?? 0,
    matriculasEspecial: (json['matriculasEspecial'] as num?)?.toInt() ?? 0,
    matriculasIntegral: (json['matriculasIntegral'] as num?)?.toInt() ?? 0,
    coberturaIntegralPct: (json['coberturaIntegralPct'] as num?)?.toDouble() ?? 0.0,
    recursoRealPorAluno: (json['recursoRealPorAluno'] as num?)?.toDouble() ?? 0.0,
    idebAnosIniciais: (json['idebAnosIniciais'] as num?)?.toDouble(),
    idebAnosFinais: (json['idebAnosFinais'] as num?)?.toDouble(),
    metaIdebAnosIniciais: (json['metaIdebAnosIniciais'] as num?)?.toDouble(),
    metaIdebAnosFinais: (json['metaIdebAnosFinais'] as num?)?.toDouble(),
    simecObras: (json['simecObras'] as num?)?.toInt() ?? 0,
    pddeEscolas: (json['pddeEscolas'] as num?)?.toInt() ?? 0,
    sigarpwebStatus: json['sigarpwebStatus']?.toString(),
    despesaEducacao: (json['despesaEducacao'] as num?)?.toDouble() ?? 0.0,
    vinculacaoMde: (json['vinculacaoMde'] as num?)?.toDouble() ?? 0.0,
    alertasTecnicos: (json['alertasTecnicos'] as List?)?.map((e) => e.toString()).toList() ?? [],
    proximosPassos: (json['proximosPassos'] as List?)?.map((e) => e.toString()).toList() ?? [],
  );
}


class CollaboratorDocument {
  const CollaboratorDocument({
    required this.id,
    required this.collaboratorId,
    required this.category,
    required this.documentType,
    required this.name,
    required this.fileName,
    required this.fileUrl,
    this.fileSize,
    this.mimeType,
    this.issuedAt,
    this.expiresAt,
    this.notes,
  });

  final String id;
  final String collaboratorId;
  final String category;
  final String documentType;
  final String name;
  final String fileName;
  final String fileUrl;
  final int? fileSize;
  final String? mimeType;
  final String? issuedAt;
  final String? expiresAt;
  final String? notes;

  factory CollaboratorDocument.fromJson(Map<String, dynamic> json) {
    return CollaboratorDocument(
      id: json['id'] as String? ?? '',
      collaboratorId: json['collaboratorId'] as String? ?? '',
      category: json['category'] as String? ?? '',
      documentType: json['documentType'] as String? ?? '',
      name: json['name'] as String? ?? '',
      fileName: json['fileName'] as String? ?? '',
      fileUrl: json['fileUrl'] as String? ?? '',
      fileSize: json['fileSize'] as int?,
      mimeType: json['mimeType'] as String?,
      issuedAt: json['issuedAt'] as String?,
      expiresAt: json['expiresAt'] as String?,
      notes: json['notes'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'collaboratorId': collaboratorId,
      'category': category,
      'documentType': documentType,
      'name': name,
      'fileName': fileName,
      'fileUrl': fileUrl,
      'fileSize': fileSize,
      'mimeType': mimeType,
      'issuedAt': issuedAt,
      'expiresAt': expiresAt,
      'notes': notes,
    };
  }
}

class CollaboratorDetails {
  const CollaboratorDetails({
    required this.id,
    required this.fullName,
    this.shortName,
    this.email,
    this.phone,
    this.whatsapp,
    this.cpfOrDocument,
    this.city,
    this.state,
    this.companyOrOrganization,
    this.title,
    required this.collaboratorType,
    required this.primaryRole,
    required this.partnershipStatus,
    this.trustLevel,
    this.averageInfluenceScore,
    required this.defaultCommissionPercent,
    this.defaultProfitBaseType,
    this.defaultTriggerType,
    this.payoutCycle,
    this.payoutMethod,
    this.notes,
    this.confidentialNotes,
    this.documents = const [],
  });

  final String id;
  final String fullName;
  final String? shortName;
  final String? email;
  final String? phone;
  final String? whatsapp;
  final String? cpfOrDocument;
  final String? city;
  final String? state;
  final String? companyOrOrganization;
  final String? title;
  final String collaboratorType;
  final String primaryRole;
  final String partnershipStatus;
  final int? trustLevel;
  final int? averageInfluenceScore;
  final double defaultCommissionPercent;
  final String? defaultProfitBaseType;
  final String? defaultTriggerType;
  final String? payoutCycle;
  final String? payoutMethod;
  final String? notes;
  final String? confidentialNotes;
  final List<CollaboratorDocument> documents;

  factory CollaboratorDetails.fromJson(Map<String, dynamic> json) {
    var docsList = json['documents'] as List?;
    var docs = docsList != null
        ? docsList.map((e) => CollaboratorDocument.fromJson(e as Map<String, dynamic>)).toList()
        : <CollaboratorDocument>[];

    return CollaboratorDetails(
      id: json['id'] as String? ?? '',
      fullName: json['fullName'] as String? ?? '',
      shortName: json['shortName'] as String?,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      whatsapp: json['whatsapp'] as String?,
      cpfOrDocument: json['cpfOrDocument'] as String?,
      city: json['city'] as String?,
      state: json['state'] as String?,
      companyOrOrganization: json['companyOrOrganization'] as String?,
      title: json['title'] as String?,
      collaboratorType: json['collaboratorType'] as String? ?? 'external_partner',
      primaryRole: json['primaryRole'] as String? ?? '',
      partnershipStatus: json['partnershipStatus'] as String? ?? 'active',
      trustLevel: json['trustLevel'] as int?,
      averageInfluenceScore: json['averageInfluenceScore'] as int?,
      defaultCommissionPercent: (json['defaultCommissionPercent'] as num?)?.toDouble() ?? 0.0,
      defaultProfitBaseType: json['defaultProfitBaseType'] as String?,
      defaultTriggerType: json['defaultTriggerType'] as String?,
      payoutCycle: json['payoutCycle'] as String?,
      payoutMethod: json['payoutMethod'] as String?,
      notes: json['notes'] as String?,
      confidentialNotes: json['confidentialNotes'] as String?,
      documents: docs,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'fullName': fullName,
      'shortName': shortName,
      'email': email,
      'phone': phone,
      'whatsapp': whatsapp,
      'cpfOrDocument': cpfOrDocument,
      'city': city,
      'state': state,
      'companyOrOrganization': companyOrOrganization,
      'title': title,
      'collaboratorType': collaboratorType,
      'primaryRole': primaryRole,
      'partnershipStatus': partnershipStatus,
      'trustLevel': trustLevel,
      'averageInfluenceScore': averageInfluenceScore,
      'defaultCommissionPercent': defaultCommissionPercent,
      'defaultProfitBaseType': defaultProfitBaseType,
      'defaultTriggerType': defaultTriggerType,
      'payoutCycle': payoutCycle,
      'payoutMethod': payoutMethod,
      'notes': notes,
      'confidentialNotes': confidentialNotes,
      'documents': documents.map((e) => e.toJson()).toList(),
    };
  }
}

