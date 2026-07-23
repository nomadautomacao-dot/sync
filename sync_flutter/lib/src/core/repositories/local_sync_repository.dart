import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../models/levantamento_fundeb_models.dart';
import '../models/slide_models.dart';
import '../models/sync_models.dart';
import '../network/api_exception.dart';
import '../network/session_storage.dart';
import '../storage/local_workspace_store.dart';
import '../theme/app_theme.dart';
import '../../features/modules/application/fundeb_levantamento_pdf_builder.dart';
import 'local_seed_catalog.dart';
import 'mock_sync_repository.dart';
import 'sync_repository.dart';

class LocalSyncRepository implements SyncRepository {
  LocalSyncRepository({
    required SessionStorage sessionStorage,
    required LocalWorkspaceStore store,
  }) : _sessionStorage = sessionStorage,
       _store = store;

  final SessionStorage _sessionStorage;
  final LocalWorkspaceStore _store;
  static List<Map<String, dynamic>>? _ibgeMunicipiosCache;

  @override
  bool get remoteEnabled => false;

  @override
  String get apiBaseUrl => '';

  @override
  bool get usesEnvironmentApi => false;

  @override
  Future<void> setApiBaseUrl(String value) async {}

  @override
  Future<SyncUser?> restoreSession() {
    return _sessionStorage.readUser();
  }

  @override
  Future<SyncUser> signIn(String email, String password) async {
    final cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.isEmpty || password.trim().isEmpty) {
      throw const ApiException(
        'Informe email e senha para entrar no modo local.',
      );
    }

    final user = SyncUser(
      name: _buildName(cleanEmail),
      email: cleanEmail,
      initials: _buildInitials(cleanEmail),
    );
    await _sessionStorage.saveSession(cookie: 'local-session', user: user);
    await _ensureWorkspaceSettings();
    return user;
  }

  @override
  Future<void> signOut() async {
    await _sessionStorage.clear();
  }

  @override
  Future<DashboardOverview> getDashboard({int? year}) async {
    final companies = await getCompanies();
    final collaborators = await getCollaborators();
    final activeCompanies = companies
        .where((item) => item.status == 'Ativo')
        .length;
    final activeCollaborators = collaborators
        .where((item) => item.status == 'Ativo')
        .length;
    final targetYear = year ?? DateTime.now().year;

    return DashboardOverview(
      year: targetYear,
      projectedGrossRevenue: 0,
      projectedProfit: 0,
      projectedMargin: 0,
      implementationCoverage: companies.isEmpty
          ? 0
          : activeCompanies / companies.length,
      kpis: [
        KpiMetric(
          label: 'Empresas locais',
          value: '${companies.length}',
          helper: 'cadastros no aparelho',
          icon: Icons.business_outlined,
          color: SyncPalette.statusInfo,
        ),
        KpiMetric(
          label: 'Empresas ativas',
          value: '$activeCompanies',
          helper: 'operacao local ativa',
          icon: Icons.check_circle_outline,
          color: SyncPalette.statusActive,
        ),
        KpiMetric(
          label: 'Colaboradores',
          value: '${collaborators.length}',
          helper: 'base local sincronizada',
          icon: Icons.groups_outlined,
          color: SyncPalette.statusWarning,
        ),
        KpiMetric(
          label: 'Colaboradores ativos',
          value: '$activeCollaborators',
          helper: 'prontos para operacao',
          icon: Icons.person_outline_rounded,
          color: SyncPalette.statusPurple,
        ),
      ],
      monthlyTrend: const <MonthlyPoint>[],
      alerts: const <AlertMessage>[
        AlertMessage(
          text: 'Modo local ativo. Dados online entram quando a API voltar.',
          color: SyncPalette.statusWarning,
        ),
      ],
      portfolioMix: <PortfolioSlice>[
        PortfolioSlice(
          label: 'Ativas',
          value: activeCompanies,
          color: SyncPalette.statusActive,
        ),
        PortfolioSlice(
          label: 'Demais',
          value: companies.length - activeCompanies,
          color: SyncPalette.accentHover,
        ),
      ],
      topMunicipalities: const <MunicipalityProjection>[],
    );
  }

  @override
  Future<List<CompanySummary>> getSidebarCompanies() async {
    final companies = await getCompanies(status: 'Ativo');
    if (companies.isNotEmpty) {
      return companies.take(8).toList();
    }
    return (await getCompanies()).take(8).toList();
  }

  @override
  Future<List<CollaboratorSummary>> getCollaborators({
    String search = '',
    String status = 'all',
    int? year,
  }) async {
    final items = (await _store.readCollaborators())
        .map(_collaboratorFromJson)
        .toList();
    return items.where((item) {
      final matchesSearch =
          search.trim().isEmpty ||
          item.fullName.toLowerCase().contains(search.trim().toLowerCase()) ||
          item.role.toLowerCase().contains(search.trim().toLowerCase()) ||
          item.state.toLowerCase().contains(search.trim().toLowerCase());
      final normalizedStatus = status.toLowerCase();
      final matchesStatus =
          normalizedStatus == 'all' ||
          item.status.toLowerCase() == normalizedStatus ||
          (normalizedStatus == 'ativo' && item.status == 'Ativo');
      return matchesSearch && matchesStatus;
    }).toList();
  }

  @override
  Future<List<AuditEntry>> getAudit({int limit = 20}) async {
    final items = (await _store.readAudit()).map(_auditFromJson).toList();
    return items.take(limit).toList();
  }

  @override
  Future<List<ModuleDefinition>> getModules() async => localSeedModules;

  @override
  Future<WorkspaceSettings> getWorkspaceSettings() async {
    return _ensureWorkspaceSettings();
  }

  @override
  Future<WorkspaceSettings> updateWorkspaceSettings(
    WorkspaceSettings settings,
  ) async {
    await _store.saveSettings(_settingsToJson(settings));
    return settings;
  }

  @override
  DashboardOverview loadDashboard() {
    return DashboardOverview(
      year: DateTime.now().year,
      projectedGrossRevenue: 0,
      projectedProfit: 0,
      projectedMargin: 0,
      implementationCoverage: 0,
      kpis: const <KpiMetric>[],
      monthlyTrend: const <MonthlyPoint>[],
      alerts: const <AlertMessage>[],
      portfolioMix: const <PortfolioSlice>[],
      topMunicipalities: const <MunicipalityProjection>[],
    );
  }

  @override
  List<CompanySummary> loadSidebarCompanies() => const <CompanySummary>[];

  @override
  List<CollaboratorSummary> loadCollaborators() =>
      const <CollaboratorSummary>[];

  @override
  List<AuditEntry> loadAudit() => const <AuditEntry>[];

  @override
  List<ModuleDefinition> loadModules() => localSeedModules;

  @override
  WorkspaceSettings loadSettings() => const WorkspaceSettings(
    id: 'local-workspace',
    groupName: 'Sync Mobile',
    slug: 'sync-mobile',
  );

  @override
  Future<List<CompanySummary>> getCompanies({
    String search = '',
    String status = 'Todos',
  }) async {
    final items = (await _store.readCompanies())
        .map(_companySummaryFromJson)
        .toList();
    return items.where((item) {
      final matchesSearch =
          search.trim().isEmpty ||
          item.tradingName.toLowerCase().contains(
            search.trim().toLowerCase(),
          ) ||
          item.cnpj.toLowerCase().contains(search.trim().toLowerCase()) ||
          item.city.toLowerCase().contains(search.trim().toLowerCase());
      final matchesStatus = status == 'Todos' || item.status == status;
      return matchesSearch && matchesStatus;
    }).toList();
  }

  @override
  Future<CompanyBundle> getCompanyBundle(String companyId) async {
    final bundles = await _store.readCompanyBundles();
    final payload = bundles[companyId];
    if (payload is! Map<String, dynamic>) {
      throw const ApiException('Empresa ainda nao disponivel na base local.');
    }
    return CompanyBundle(
      company: _companyDetailsFromJson(
        payload['company'] as Map<String, dynamic>? ??
            const <String, dynamic>{},
      ),
      employees: (payload['employees'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(_employeeFromJson)
          .toList(),
    );
  }

  @override
  Future<CompanyDetails> updateCompanyModules(
    String companyId,
    List<String> enabledModules,
  ) async {
    final bundles = await _store.readCompanyBundles();
    final payload = bundles[companyId];
    if (payload is! Map<String, dynamic>) {
      throw const ApiException('Empresa ainda nao disponivel na base local.');
    }

    final currentCompany = _companyDetailsFromJson(
      payload['company'] as Map<String, dynamic>? ?? const <String, dynamic>{},
    );
    final updated = CompanyDetails(
      id: currentCompany.id,
      name: currentCompany.name,
      tradingName: currentCompany.tradingName,
      cnpj: currentCompany.cnpj,
      status: currentCompany.status,
      segment: currentCompany.segment,
      city: currentCompany.city,
      state: currentCompany.state,
      email: currentCompany.email,
      phone: currentCompany.phone,
      contactName: currentCompany.contactName,
      contactPosition: currentCompany.contactPosition,
      enabledModules: enabledModules,
    );

    await _store.saveCompanyBundle(companyId, <String, dynamic>{
      'company': _companyDetailsToJson(updated),
      'employees': (payload['employees'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .toList(),
    });

    final companies = await _store.readCompanies();
    final updatedCompanies = companies.map((item) {
      if ((item['id'] ?? '').toString() != companyId) {
        return item;
      }
      return _companySummaryToJson(
        CompanySummary(
          id: item['id']?.toString() ?? companyId,
          tradingName: updated.tradingName,
          segment: updated.segment,
          cnpj: updated.cnpj,
          status: updated.status,
          city: updated.city,
          state: updated.state,
          enabledModules: enabledModules,
          color: _statusColor(updated.status),
        ),
      );
    }).toList();
    await _store.saveCompanies(updatedCompanies);

    return updated;
  }

  @override
  Future<CityAccount> createCity(Map<String, dynamic> data) async {
    throw const ApiException('Criação de cidade requer conexão com a API.');
  }

  @override
  Future<CompanySummary> createCompany(Map<String, dynamic> data) async {
    final id = DateTime.now().millisecondsSinceEpoch.toString();
    return CompanySummary(
      id: id,
      tradingName: (data['tradingName'] as String?) ?? '',
      segment: (data['segment'] as String?) ?? 'outro',
      cnpj: (data['cnpj'] as String?) ?? '',
      status: 'Ativo',
      city: (data['city'] as String?) ?? '',
      state: (data['state'] as String?) ?? '',
      enabledModules: const [],
      color: SaaSTokens.success,
    );
  }

  @override
  Future<EmployeeRecord> createEmployee(Map<String, dynamic> data) async {
    return EmployeeRecord(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      name: (data['name'] as String?) ?? '',
      email: (data['email'] as String?) ?? '',
      position: (data['position'] as String?) ?? '',
      role: (data['role'] as String?) ?? '',
      status: 'Ativo',
    );
  }

  @override
  Future<void> setCompanyLogo(
    String companyId,
    Uint8List bytes, {
    String? contentType,
  }) async {
    // Local: no-op — logo requer Storage remoto.
  }

  @override
  Future<CollaboratorSummary> createCollaborator(
    Map<String, dynamic> data,
  ) async {
    throw const ApiException(
      'Criacao de colaborador requer conexao com a API.',
    );
  }

  @override
  Future<CollaboratorDetails> getCollaboratorDetails(String id) async {
    return MockSyncRepository().getCollaboratorDetails(id);
  }

  @override
  Future<CollaboratorDetails> updateCollaboratorDetails(
    String id,
    Map<String, dynamic> data,
  ) async {
    return MockSyncRepository().updateCollaboratorDetails(id, data);
  }

  @override
  Future<List<CollaboratorDocument>> getCollaboratorDocuments(String id) async {
    return MockSyncRepository().getCollaboratorDocuments(id);
  }

  @override
  Future<CollaboratorDocument> uploadCollaboratorDocument({
    required String id,
    required String category,
    required String documentType,
    required String name,
    required String fileName,
    required Uint8List fileBytes,
    String? issuedAt,
    String? expiresAt,
    String? notes,
  }) async {
    return MockSyncRepository().uploadCollaboratorDocument(
      id: id,
      category: category,
      documentType: documentType,
      name: name,
      fileName: fileName,
      fileBytes: fileBytes,
      issuedAt: issuedAt,
      expiresAt: expiresAt,
      notes: notes,
    );
  }

  @override
  Future<void> deleteCollaboratorDocument(String id, String docId) async {
    return MockSyncRepository().deleteCollaboratorDocument(id, docId);
  }


  @override
  Future<List<CityAccount>> getCities({
    String search = '',
    String stage = '',
  }) async {
    // Cities are server-side data; local mode returns empty
    return const <CityAccount>[];
  }

  @override
  Future<void> updateCityStage(String cityId, String stage) async {
    // Local mode does not store stateful municipalities
  }

  @override
  Future<void> updateCityPipeline(String cityId, Map<String, dynamic> data) async {
    // Local mode does not store stateful municipalities
  }

  @override
  Future<List<MunicipioSearchItem>> searchMunicipios(
    String query, {
    String? uf,
  }) async {
    final normalizedQuery = _normalizeMunicipioSearch(query);
    if (normalizedQuery.length < 2) {
      return const <MunicipioSearchItem>[];
    }

    final municipios = await _fetchAllIbgeMunicipios();
    final normalizedUf = (uf ?? '').trim().toUpperCase();
    final aliasQuery = _normalizeMunicipioSearch(
      _resolveMunicipioAlias(query, normalizedUf),
    );
    final candidateQueries = <String>{normalizedQuery, aliasQuery};

    return municipios
        .where((municipio) {
          final municipioUf = _getMunicipioUf(municipio).toUpperCase();
          final municipioNome = _normalizeMunicipioSearch(
            (municipio['nome'] ?? '').toString(),
          );
          final matchesName = candidateQueries.any(municipioNome.contains);
          return matchesName &&
              (normalizedUf.isEmpty || municipioUf == normalizedUf);
        })
        .take(20)
        .map((municipio) {
          return MunicipioSearchItem(
            codigoIbge: (municipio['id'] ?? '').toString(),
            nome: (municipio['nome'] ?? '').toString(),
            uf: _getMunicipioUf(municipio),
            regiao: _getMunicipioRegiao(municipio),
          );
        })
        .toList();
  }

  @override
  Future<LevantamentoFundebBundle> getLevantamentoFundeb(
    MunicipioLookupRequest request,
  ) async {
    final municipio = await _resolveMunicipio(request);
    if (municipio == null) {
      throw const ApiException(
        'Municipio nao encontrado na base publica do IBGE.',
      );
    }

    final resolvedRequest = MunicipioLookupRequest(
      codigoIbge: (municipio['id'] ?? '').toString(),
      nome: (municipio['nome'] ?? '').toString(),
      uf: _getMunicipioUf(municipio),
      exercicio: request.exercicio,
      parametros: request.parametros,
    );

    return MockSyncRepository().getLevantamentoFundeb(resolvedRequest);
  }

  @override
  Future<RelatorioDirigidoBundle> refreshRelatorioDirigido(
    MunicipioLookupRequest request,
  ) async {
    final municipio = await _resolveMunicipio(request);
    if (municipio == null) {
      throw const ApiException(
        'Municipio nao encontrado na base publica do IBGE.',
      );
    }

    final resolvedRequest = MunicipioLookupRequest(
      codigoIbge: (municipio['id'] ?? '').toString(),
      nome: (municipio['nome'] ?? '').toString(),
      uf: _getMunicipioUf(municipio),
      exercicio: request.exercicio,
      parametros: request.parametros,
    );

    return MockSyncRepository().refreshRelatorioDirigido(resolvedRequest);
  }

  @override
  Future<Uint8List> generateLevantamentoFundebPdf(
    MunicipioLookupRequest request, {
    String tipo = 'levantamento',
  }) async {
    final bundle = await getLevantamentoFundeb(request);
    if (tipo == 'lite') {
      return FundebLevantamentoPdfBuilder.buildLiteFromBundle(
        bundle,
        directedReport: bundle.relatorioDirigidoBase,
      );
    }
    return FundebLevantamentoPdfBuilder.buildFromBundle(
      bundle,
      directedReport: bundle.relatorioDirigidoBase,
    );
  }

  @override
  Future<Map<String, dynamic>> obterDadosContratoFundeb(
    Map<String, dynamic> body,
  ) async {
    return MockSyncRepository().obterDadosContratoFundeb(body);
  }

  @override
  Future<Uint8List> gerarKitContratosFundeb(Map<String, dynamic> data) async {
    return MockSyncRepository().gerarKitContratosFundeb(data);
  }

  @override
  Future<Uint8List> gerarPropostaDocx(Map<String, dynamic> data) async {
    return MockSyncRepository().gerarPropostaDocx(data);
  }

  @override
  Future<Uint8List> gerarKitContratosFundebComAnexos(
    Map<String, dynamic> data,
    Map<String, List<({String nome, Uint8List bytes})>> anexos,
  ) async {
    return MockSyncRepository().gerarKitContratosFundebComAnexos(data, anexos);
  }

  // ── Slides module ──

  @override
  Future<List<SlideTemplate>> getSlideTemplates() async {
    return defaultSlideTemplates;
  }

  @override
  Future<Uint8List> generateSlidesPdf(
    String templateId, {
    String? codigoIbge,
  }) async {
    return Uint8List(0);
  }

  Future<void> cacheCompanies(List<CompanySummary> companies) {
    return _store.saveCompanies(companies.map(_companySummaryToJson).toList());
  }

  Future<void> cacheCompanyBundle(CompanyBundle bundle) {
    return _store.saveCompanyBundle(bundle.company.id, <String, dynamic>{
      'company': _companyDetailsToJson(bundle.company),
      'employees': bundle.employees.map(_employeeToJson).toList(),
    });
  }

  Future<void> cacheCollaborators(List<CollaboratorSummary> collaborators) {
    return _store.saveCollaborators(
      collaborators.map(_collaboratorToJson).toList(),
    );
  }

  Future<void> cacheAudit(List<AuditEntry> audit) {
    return _store.saveAudit(audit.map(_auditToJson).toList());
  }

  Future<void> cacheSettings(WorkspaceSettings settings) {
    return _store.saveSettings(_settingsToJson(settings));
  }

  Future<WorkspaceSettings> _ensureWorkspaceSettings() async {
    final existing = await _store.readSettings();
    if (existing != null) {
      return _settingsFromJson(existing);
    }

    const seeded = WorkspaceSettings(
      id: 'local-workspace',
      groupName: 'Sync Mobile',
      slug: 'sync-mobile',
      rawSettings: <String, dynamic>{
        'mode': 'local',
        'reportEngine': 'pending-mobile-port',
      },
    );
    await _store.saveSettings(_settingsToJson(seeded));
    return seeded;
  }

  String _buildName(String email) {
    final prefix = email.split('@').first.trim();
    if (prefix.isEmpty) return 'Usuario Local';
    return prefix
        .split(RegExp(r'[._-]+'))
        .where((item) => item.isNotEmpty)
        .map((item) => item[0].toUpperCase() + item.substring(1))
        .join(' ');
  }

  String _buildInitials(String value) {
    final parts = value
        .split('@')
        .first
        .split(RegExp(r'[._-]+'))
        .where((item) => item.isNotEmpty)
        .toList();
    if (parts.isEmpty) return 'SL';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  Map<String, dynamic> _companySummaryToJson(CompanySummary company) {
    return <String, dynamic>{
      'id': company.id,
      'tradingName': company.tradingName,
      'segment': company.segment,
      'cnpj': company.cnpj,
      'status': company.status,
      'city': company.city,
      'state': company.state,
      'enabledModules': company.enabledModules,
    };
  }

  CompanySummary _companySummaryFromJson(Map<String, dynamic> json) {
    final status = (json['status'] ?? 'Ativo').toString();
    return CompanySummary(
      id: (json['id'] ?? '').toString(),
      tradingName: (json['tradingName'] ?? '').toString(),
      segment: (json['segment'] ?? '').toString(),
      cnpj: (json['cnpj'] ?? '').toString(),
      status: status,
      city: (json['city'] ?? '').toString(),
      state: (json['state'] ?? '').toString(),
      enabledModules:
          (json['enabledModules'] as List<dynamic>? ?? const <dynamic>[])
              .map((item) => item.toString())
              .toList(),
      color: _statusColor(status),
    );
  }

  Map<String, dynamic> _companyDetailsToJson(CompanyDetails company) {
    return <String, dynamic>{
      'id': company.id,
      'name': company.name,
      'tradingName': company.tradingName,
      'cnpj': company.cnpj,
      'status': company.status,
      'segment': company.segment,
      'city': company.city,
      'state': company.state,
      'email': company.email,
      'phone': company.phone,
      'contactName': company.contactName,
      'contactPosition': company.contactPosition,
      'enabledModules': company.enabledModules,
    };
  }

  CompanyDetails _companyDetailsFromJson(Map<String, dynamic> json) {
    return CompanyDetails(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      tradingName: (json['tradingName'] ?? '').toString(),
      cnpj: (json['cnpj'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      segment: (json['segment'] ?? '').toString(),
      city: (json['city'] ?? '').toString(),
      state: (json['state'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      phone: (json['phone'] ?? '').toString(),
      contactName: (json['contactName'] ?? '').toString(),
      contactPosition: (json['contactPosition'] ?? '').toString(),
      enabledModules:
          (json['enabledModules'] as List<dynamic>? ?? const <dynamic>[])
              .map((item) => item.toString())
              .toList(),
    );
  }

  Map<String, dynamic> _employeeToJson(EmployeeRecord employee) {
    return <String, dynamic>{
      'id': employee.id,
      'name': employee.name,
      'email': employee.email,
      'position': employee.position,
      'role': employee.role,
      'status': employee.status,
    };
  }

  EmployeeRecord _employeeFromJson(Map<String, dynamic> json) {
    return EmployeeRecord(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      position: (json['position'] ?? '').toString(),
      role: (json['role'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
    );
  }

  Map<String, dynamic> _collaboratorToJson(CollaboratorSummary collaborator) {
    return <String, dynamic>{
      'id': collaborator.id,
      'fullName': collaborator.fullName,
      'role': collaborator.role,
      'type': collaborator.type,
      'state': collaborator.state,
      'status': collaborator.status,
      'cities': collaborator.cities,
      'fidelized': collaborator.fidelized,
      'profitYtd': collaborator.profitYtd,
      'commissionYtd': collaborator.commissionYtd,
    };
  }

  CollaboratorSummary _collaboratorFromJson(Map<String, dynamic> json) {
    return CollaboratorSummary(
      id: (json['id'] ?? '').toString(),
      fullName: (json['fullName'] ?? '').toString(),
      role: (json['role'] ?? '').toString(),
      type: (json['type'] ?? '').toString(),
      state: (json['state'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      cities: _readInt(json['cities']),
      fidelized: _readInt(json['fidelized']),
      profitYtd: _readDouble(json['profitYtd']),
      commissionYtd: _readDouble(json['commissionYtd']),
    );
  }

  Map<String, dynamic> _auditToJson(AuditEntry entry) {
    return <String, dynamic>{
      'action': entry.action,
      'createdAt': entry.createdAt,
    };
  }

  AuditEntry _auditFromJson(Map<String, dynamic> json) {
    return AuditEntry(
      action: (json['action'] ?? '').toString(),
      createdAt: (json['createdAt'] ?? '').toString(),
    );
  }

  Map<String, dynamic> _settingsToJson(WorkspaceSettings settings) {
    return <String, dynamic>{
      'id': settings.id,
      'groupName': settings.groupName,
      'slug': settings.slug,
      'rawSettings': settings.rawSettings,
    };
  }

  WorkspaceSettings _settingsFromJson(Map<String, dynamic> json) {
    final rawSettings = json['rawSettings'];
    return WorkspaceSettings(
      id: (json['id'] ?? 'local-workspace').toString(),
      groupName: (json['groupName'] ?? 'Sync Mobile').toString(),
      slug: (json['slug'] ?? 'sync-mobile').toString(),
      rawSettings: rawSettings is Map<String, dynamic>
          ? rawSettings
          : const <String, dynamic>{},
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Ativo':
        return SyncPalette.statusActive;
      case 'Inativo':
        return SyncPalette.textSecondary;
      default:
        return SyncPalette.statusInfo;
    }
  }

  int _readInt(dynamic value) {
    if (value is int) return value;
    if (value is double) return value.round();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  double _readDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  Future<List<Map<String, dynamic>>> _fetchAllIbgeMunicipios() async {
    if (_ibgeMunicipiosCache != null) {
      return _ibgeMunicipiosCache!;
    }

    final response = await http.get(
      Uri.parse(
        'https://servicodados.ibge.gov.br/api/v1/localidades/municipios',
      ),
      headers: const <String, String>{'Accept': 'application/json'},
    );

    if (response.statusCode >= 400) {
      throw const ApiException(
        'Nao foi possivel consultar a base publica do IBGE.',
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! List) {
      throw const ApiException('Resposta invalida da base publica do IBGE.');
    }

    _ibgeMunicipiosCache = decoded.whereType<Map<String, dynamic>>().toList();
    return _ibgeMunicipiosCache!;
  }

  Future<Map<String, dynamic>?> _resolveMunicipio(
    MunicipioLookupRequest request,
  ) async {
    if (request.hasCodigoIbge) {
      final digits = (request.codigoIbge ?? '').replaceAll(
        RegExp(r'[^0-9]'),
        '',
      );
      if (digits.length == 7) {
        final response = await http.get(
          Uri.parse(
            'https://servicodados.ibge.gov.br/api/v1/localidades/municipios/$digits',
          ),
          headers: const <String, String>{'Accept': 'application/json'},
        );

        if (response.statusCode < 400) {
          final decoded = jsonDecode(response.body);
          if (decoded is Map<String, dynamic>) {
            return decoded;
          }
        }
      }

      final municipios = await _fetchAllIbgeMunicipios();
      return municipios
              .firstWhere(
                (municipio) =>
                    (municipio['id'] ?? '').toString().startsWith(digits),
                orElse: () => <String, dynamic>{},
              )
              .isEmpty
          ? null
          : municipios.firstWhere(
              (municipio) =>
                  (municipio['id'] ?? '').toString().startsWith(digits),
            );
    }

    if (request.hasNameLookup) {
      final municipios = await _fetchAllIbgeMunicipios();
      final targetUf = (request.uf ?? '').trim().toUpperCase();
      final resolvedNome = _resolveMunicipioAlias(request.nome ?? '', targetUf);
      final nomeCandidates = <String>{
        _normalizeMunicipioSearch(request.nome ?? ''),
        _normalizeMunicipioSearch(resolvedNome),
      };

      for (final municipio in municipios) {
        final municipioUf = _getMunicipioUf(municipio).toUpperCase();
        final municipioNome = _normalizeMunicipioSearch(
          (municipio['nome'] ?? '').toString(),
        );
        if (municipioUf == targetUf && nomeCandidates.contains(municipioNome)) {
          return municipio;
        }
      }
    }

    return null;
  }

  String _normalizeMunicipioName(String value) {
    return value
        .toUpperCase()
        .replaceAll(RegExp(r'[ÁÀÂÃÄ]'), 'A')
        .replaceAll(RegExp(r'[ÉÈÊË]'), 'E')
        .replaceAll(RegExp(r'[ÍÌÎÏ]'), 'I')
        .replaceAll(RegExp(r'[ÓÒÔÕÖ]'), 'O')
        .replaceAll(RegExp(r'[ÚÙÛÜ]'), 'U')
        .replaceAll('Ç', 'C')
        .replaceAll(RegExp(r"['`´\\-.,/]"), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  String _normalizeMunicipioSearch(String value) {
    return value
        .toUpperCase()
        .replaceAll(
          RegExp(
            '[\\u00C0-\\u00C5\\u0100\\u0102\\u0104\\u00E0-\\u00E5\\u0101\\u0103\\u0105]',
          ),
          'A',
        )
        .replaceAll(
          RegExp(
            '[\\u00C8-\\u00CB\\u0112\\u0114\\u0116\\u0118\\u011A\\u00E8-\\u00EB\\u0113\\u0115\\u0117\\u0119\\u011B]',
          ),
          'E',
        )
        .replaceAll(
          RegExp(
            '[\\u00CC-\\u00CF\\u0128\\u012A\\u012C\\u012E\\u0130\\u00EC-\\u00EF\\u0129\\u012B\\u012D\\u012F\\u0131]',
          ),
          'I',
        )
        .replaceAll(
          RegExp(
            '[\\u00D2-\\u00D6\\u00D8\\u014C\\u014E\\u0150\\u00F2-\\u00F6\\u00F8\\u014D\\u014F\\u0151]',
          ),
          'O',
        )
        .replaceAll(
          RegExp(
            '[\\u00D9-\\u00DC\\u0168\\u016A\\u016C\\u016E\\u0170\\u0172\\u00F9-\\u00FC\\u0169\\u016B\\u016D\\u016F\\u0171\\u0173]',
          ),
          'U',
        )
        .replaceAll(
          RegExp(
            '[\\u00C7\\u0106\\u0108\\u010A\\u010C\\u00E7\\u0107\\u0109\\u010B\\u010D]',
          ),
          'C',
        )
        .replaceAll(
          RegExp('[\\u00D1\\u0143\\u0145\\u0147\\u00F1\\u0144\\u0146\\u0148]'),
          'N',
        )
        .replaceAll(RegExp(r"['`\-.,/]"), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  String _resolveMunicipioAlias(String nome, String uf) {
    if (uf.isEmpty) return nome;
    const aliases = <String, String>{
      'ALVORADA DO OESTE-RO': "Alvorada D'Oeste",
      'AMPARO DE SAO FRANCISCO-SE': 'Amparo do Sao Francisco',
      'AREZ-RN': 'Arez',
      'ASSU-RN': 'Acu',
      'BARAO DE MONTE ALTO-MG': 'Barao do Monte Alto',
      'BOA SAUDE-RN': 'Januario Cicco',
      'DONA EUSEBIA-MG': 'Dona Eusebia',
      'ELDORADO DOS CARAJAS-PA': 'Eldorado do Carajas',
      'ESPIGAO DO OESTE-RO': "Espigao D'Oeste",
      'SANTA ISABEL DO PARA-PA': 'Santa Izabel do Para',
      'SANTO ANTONIO DO LEVERGER-MT': 'Santo Antonio de Leverger',
      'SAO LUIS DO PARAITINGA-SP': 'Sao Luiz do Paraitinga',
      'SAO THOME DAS LETRAS-MG': 'Sao Tome das Letras',
    };
    final key = '${_normalizeMunicipioSearch(nome)}-${uf.trim().toUpperCase()}';
    return aliases[key] ?? nome;
  }

  String _getMunicipioUf(Map<String, dynamic> municipio) {
    final microrregiao = municipio['microrregiao'];
    if (microrregiao is Map<String, dynamic>) {
      final mesorregiao = microrregiao['mesorregiao'];
      if (mesorregiao is Map<String, dynamic>) {
        final uf = mesorregiao['UF'];
        if (uf is Map<String, dynamic>) {
          final sigla = uf['sigla'];
          if (sigla != null) return sigla.toString();
        }
      }
    }

    final regiaoImediata = municipio['regiao-imediata'];
    if (regiaoImediata is Map<String, dynamic>) {
      final intermediaria = regiaoImediata['regiao-intermediaria'];
      if (intermediaria is Map<String, dynamic>) {
        final uf = intermediaria['UF'];
        if (uf is Map<String, dynamic>) {
          final sigla = uf['sigla'];
          if (sigla != null) return sigla.toString();
        }
      }
    }

    return '';
  }

  String _getMunicipioRegiao(Map<String, dynamic> municipio) {
    final microrregiao = municipio['microrregiao'];
    if (microrregiao is Map<String, dynamic>) {
      final mesorregiao = microrregiao['mesorregiao'];
      if (mesorregiao is Map<String, dynamic>) {
        final uf = mesorregiao['UF'];
        if (uf is Map<String, dynamic>) {
          final regiao = uf['regiao'];
          if (regiao is Map<String, dynamic>) {
            final nome = regiao['nome'];
            if (nome != null) return nome.toString();
          }
        }
      }
    }

    final regiaoImediata = municipio['regiao-imediata'];
    if (regiaoImediata is Map<String, dynamic>) {
      final intermediaria = regiaoImediata['regiao-intermediaria'];
      if (intermediaria is Map<String, dynamic>) {
        final uf = intermediaria['UF'];
        if (uf is Map<String, dynamic>) {
          final regiao = uf['regiao'];
          if (regiao is Map<String, dynamic>) {
            final nome = regiao['nome'];
            if (nome != null) return nome.toString();
          }
        }
      }
    }

    return 'Nao informado';
  }
}
