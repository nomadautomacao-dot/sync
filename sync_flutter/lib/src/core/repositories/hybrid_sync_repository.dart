import '../data/audit_firestore_service.dart';
import '../data/city_firestore_service.dart';
import '../data/collaborator_document_firestore_service.dart';
import '../data/collaborator_firestore_service.dart';
import '../data/company_firestore_service.dart';
import '../data/company_logo_storage.dart';
import '../data/dashboard_firestore_service.dart';
import '../data/workspace_settings_firestore_service.dart';
import '../models/levantamento_fundeb_models.dart';
import '../models/slide_models.dart';
import '../models/sync_models.dart';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'local_sync_repository.dart';
import 'remote_sync_repository.dart';
import 'sync_repository.dart';

class HybridSyncRepository implements SyncRepository {
  HybridSyncRepository({
    required RemoteSyncRepository remote,
    required LocalSyncRepository local,
    required CollaboratorFirestoreService collaborators,
    required CollaboratorDocumentFirestoreService collaboratorDocuments,
    required CompanyFirestoreService companies,
    required CompanyLogoStorage logoStorage,
    required CityFirestoreService cities,
    required WorkspaceSettingsFirestoreService settings,
    required AuditFirestoreService audit,
    required DashboardFirestoreService dashboard,
    required Future<String?> Function() groupIdLoader,
  }) : _remote = remote,
       _local = local,
       _collaborators = collaborators,
       _collaboratorDocuments = collaboratorDocuments,
       _companies = companies,
       _logoStorage = logoStorage,
       _cities = cities,
       _settings = settings,
       _audit = audit,
       _dashboard = dashboard,
       _groupIdLoader = groupIdLoader;

  final RemoteSyncRepository _remote;
  final LocalSyncRepository _local;
  final CollaboratorFirestoreService _collaborators;
  final CollaboratorDocumentFirestoreService _collaboratorDocuments;
  final CompanyFirestoreService _companies;
  final CompanyLogoStorage _logoStorage;
  final CityFirestoreService _cities;
  final WorkspaceSettingsFirestoreService _settings;
  final AuditFirestoreService _audit;
  final DashboardFirestoreService _dashboard;
  final Future<String?> Function() _groupIdLoader;

  bool get _mustUseRemote => _remote.remoteEnabled;

  @override
  bool get remoteEnabled => _remote.remoteEnabled;

  @override
  String get apiBaseUrl => _remote.apiBaseUrl;

  @override
  bool get usesEnvironmentApi => _remote.usesEnvironmentApi;

  @override
  Future<void> setApiBaseUrl(String value) => _remote.setApiBaseUrl(value);

  @override
  Future<SyncUser?> restoreSession() async {
    if (_mustUseRemote) {
      return _remote.restoreSession();
    }
    return _local.restoreSession();
  }

  @override
  Future<SyncUser> signIn(String email, String password) async {
    if (_mustUseRemote) {
      return _remote.signIn(email, password);
    }
    return _local.signIn(email, password);
  }

  @override
  Future<void> signOut() async {
    await _safeCall(() => _remote.signOut());
    await _local.signOut();
  }

  @override
  Future<DashboardOverview> getDashboard({int? year}) async {
    if (_mustUseRemote) {
      final remote = await _dashboard.overview(year: year);
      return remote;
    }
    return _local.getDashboard(year: year);
  }

  @override
  Future<List<CompanySummary>> getSidebarCompanies() async {
    if (_mustUseRemote) {
      final remote = await _companies.sidebar();
      await _local.cacheCompanies(remote);
      return remote;
    }
    return _local.getSidebarCompanies();
  }

  @override
  Future<List<CollaboratorSummary>> getCollaborators({
    String search = '',
    String status = 'all',
    int? year,
  }) async {
    if (_mustUseRemote) {
      return _collaborators.list();
    }
    return _local.getCollaborators(search: search, status: status, year: year);
  }

  @override
  Future<List<AuditEntry>> getAudit({int limit = 20}) async {
    if (_mustUseRemote) {
      final remote = await _audit.list(limit: limit);
      await _local.cacheAudit(remote);
      return remote;
    }
    return _local.getAudit(limit: limit);
  }

  @override
  Future<List<ModuleDefinition>> getModules() async {
    if (_mustUseRemote) {
      final remoteModules = await _remote.getModules();
      // Merge any local-only modules that the backend doesn't know about yet
      final localModules = _local.loadModules();
      return [
        ...remoteModules,
        ...localModules.where(
          (local) => !remoteModules.any((remote) => remote.key == local.key),
        ),
      ];
    }
    return _local.getModules();
  }

  @override
  Future<WorkspaceSettings> getWorkspaceSettings() async {
    if (_mustUseRemote) {
      final remote = await _settings.get();
      await _local.cacheSettings(remote);
      return remote;
    }
    return _local.getWorkspaceSettings();
  }

  @override
  Future<WorkspaceSettings> updateWorkspaceSettings(
    WorkspaceSettings settings,
  ) async {
    if (_mustUseRemote) {
      final remote = await _settings.update(settings);
      await _local.cacheSettings(remote);
      return remote;
    }
    return _local.updateWorkspaceSettings(settings);
  }

  @override
  DashboardOverview loadDashboard() => _local.loadDashboard();

  @override
  List<CompanySummary> loadSidebarCompanies() => _local.loadSidebarCompanies();

  @override
  List<CollaboratorSummary> loadCollaborators() => _local.loadCollaborators();

  @override
  List<AuditEntry> loadAudit() => _local.loadAudit();

  @override
  List<ModuleDefinition> loadModules() => _local.loadModules();

  @override
  WorkspaceSettings loadSettings() => _local.loadSettings();

  @override
  Future<List<CompanySummary>> getCompanies({
    String search = '',
    String status = 'Todos',
  }) async {
    if (_mustUseRemote) {
      final remote = await _companies.list(search: search, status: status);
      await _local.cacheCompanies(remote);
      return remote;
    }
    return _local.getCompanies(search: search, status: status);
  }

  @override
  Future<CompanyBundle> getCompanyBundle(String companyId) async {
    if (_mustUseRemote) {
      final remote = await _companies.bundle(companyId);
      await _local.cacheCompanyBundle(remote);
      return remote;
    }
    return _local.getCompanyBundle(companyId);
  }

  @override
  Future<CompanyDetails> updateCompanyModules(
    String companyId,
    List<String> enabledModules,
  ) async {
    if (_mustUseRemote) {
      return _companies.updateModules(companyId, enabledModules);
    }
    return _local.updateCompanyModules(companyId, enabledModules);
  }

  @override
  Future<CityAccount> createCity(Map<String, dynamic> data) async {
    if (_mustUseRemote) return _cities.create(data);
    return _local.createCity(data);
  }

  @override
  Future<CompanySummary> createCompany(Map<String, dynamic> data) async {
    if (_mustUseRemote) return _companies.create(data);
    return _local.createCompany(data);
  }

  @override
  Future<EmployeeRecord> createEmployee(Map<String, dynamic> data) async {
    if (_mustUseRemote) return _companies.createEmployee(data);
    return _local.createEmployee(data);
  }

  @override
  Future<void> setCompanyLogo(
    String companyId,
    Uint8List bytes, {
    String? contentType,
  }) async {
    if (_mustUseRemote) {
      final groupId = await _groupIdLoader();
      if (groupId == null || groupId.isEmpty) {
        throw StateError('Sem groupId nas claims.');
      }
      final url = await _logoStorage.upload(
        groupId: groupId,
        companyId: companyId,
        bytes: bytes,
        contentType: contentType ?? 'image/png',
      );
      await _companies.setLogo(companyId, url);
      return;
    }
    // local: no-op
    return _local.setCompanyLogo(companyId, bytes, contentType: contentType);
  }

  @override
  Future<CollaboratorSummary> createCollaborator(Map<String, dynamic> data) async {
    if (_mustUseRemote) return _collaborators.create(data);
    return _local.createCollaborator(data);
  }

  @override
  Future<CollaboratorDetails> getCollaboratorDetails(String id) async {
    if (_mustUseRemote) {
      return _collaborators.details(id);
    }
    return _local.getCollaboratorDetails(id);
  }

  @override
  Future<CollaboratorDetails> updateCollaboratorDetails(
    String id,
    Map<String, dynamic> data,
  ) async {
    if (_mustUseRemote) {
      return _collaborators.update(id, data);
    }
    return _local.updateCollaboratorDetails(id, data);
  }

  @override
  Future<List<CollaboratorDocument>> getCollaboratorDocuments(String id) async {
    if (_mustUseRemote) {
      return _collaboratorDocuments.list(id);
    }
    return _local.getCollaboratorDocuments(id);
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
    if (_mustUseRemote) {
      return _collaboratorDocuments.upload(
        collaboratorId: id,
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
    return _local.uploadCollaboratorDocument(
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
    if (_mustUseRemote) {
      return _collaboratorDocuments.delete(id, docId);
    }
    return _local.deleteCollaboratorDocument(id, docId);
  }


  @override
  Future<List<CityAccount>> getCities({
    String search = '',
    String stage = '',
  }) async {
    if (_mustUseRemote) return _cities.list(search: search, stage: stage);
    return _local.getCities(search: search, stage: stage);
  }

  @override
  Future<void> updateCityStage(String cityId, String stage) async {
    if (_mustUseRemote) return _cities.updateStage(cityId, stage);
    return _local.updateCityStage(cityId, stage);
  }

  @override
  Future<void> updateCityPipeline(String cityId, Map<String, dynamic> data) async {
    if (_mustUseRemote) return _cities.updatePipeline(cityId, data);
    return _local.updateCityPipeline(cityId, data);
  }

  @override
  Future<List<MunicipioSearchItem>> searchMunicipios(
    String query, {
    String? uf,
  }) async {
    if (_mustUseRemote) {
      return _remote.searchMunicipios(query, uf: uf);
    }
    return _local.searchMunicipios(query, uf: uf);
  }

  @override
  Future<LevantamentoFundebBundle> getLevantamentoFundeb(
    MunicipioLookupRequest request,
  ) async {
    if (_mustUseRemote) {
      try {
        return await _remote.getLevantamentoFundeb(request);
      } catch (e) {
        debugPrint('[HybridRepo] Remote FUNDEB failed: $e — trying SICONFI fallback');
        // Backend down — build from SICONFI + IBGE (real data, no FNDE)
        final code = (request.codigoIbge ?? '').trim();
        final name = (request.nome ?? '').trim();
        final reqUf = (request.uf ?? '').trim().toUpperCase();

        String ibge = code;
        String nome = name;
        if (ibge.isEmpty && name.isNotEmpty) {
          final found = await _local.searchMunicipios(name, uf: reqUf);
          if (found.isNotEmpty) {
            ibge = found.first.codigoIbge;
            nome = found.first.nome;
          }
        }
        if (ibge.isEmpty) rethrow;

        return _remote.buildDirectFromSiconfi(
          codigoIbge: ibge, nome: nome, uf: reqUf, exercicio: request.exercicio,
        );
      }
    }
    return _local.getLevantamentoFundeb(request);
  }

  @override
  Future<RelatorioDirigidoBundle> refreshRelatorioDirigido(
    MunicipioLookupRequest request,
  ) async {
    if (_mustUseRemote) {
      try {
        return await _remote.refreshRelatorioDirigido(request);
      } catch (_) {
        return _local.refreshRelatorioDirigido(request);
      }
    }
    return _local.refreshRelatorioDirigido(request);
  }

  @override
  Future<Uint8List> generateLevantamentoFundebPdf(
    MunicipioLookupRequest request, {
    String tipo = 'levantamento',
  }) async {
    if (_mustUseRemote) {
      try {
        return await _remote.generateLevantamentoFundebPdf(request, tipo: tipo);
      } catch (_) {
        return _local.generateLevantamentoFundebPdf(request, tipo: tipo);
      }
    }
    return _local.generateLevantamentoFundebPdf(request, tipo: tipo);
  }

  @override
  Future<Map<String, dynamic>> obterDadosContratoFundeb(Map<String, dynamic> body) async {
    if (_mustUseRemote) {
      return _remote.obterDadosContratoFundeb(body);
    }
    return _local.obterDadosContratoFundeb(body);
  }

  @override
  Future<Uint8List> gerarKitContratosFundeb(Map<String, dynamic> data) async {
    if (_mustUseRemote) {
      return _remote.gerarKitContratosFundeb(data);
    }
    return _local.gerarKitContratosFundeb(data);
  }

  @override
  Future<Uint8List> gerarPropostaDocx(Map<String, dynamic> data) async {
    if (_mustUseRemote) {
      return _remote.gerarPropostaDocx(data);
    }
    return _local.gerarPropostaDocx(data);
  }

  @override
  Future<Uint8List> gerarKitContratosFundebComAnexos(
    Map<String, dynamic> data,
    Map<String, List<({String nome, Uint8List bytes})>> anexos,
  ) async {
    if (_mustUseRemote) {
      return _remote.gerarKitContratosFundebComAnexos(data, anexos);
    }
    return _local.gerarKitContratosFundebComAnexos(data, anexos);
  }

  // ── Slides module ──

  @override
  Future<List<SlideTemplate>> getSlideTemplates() async {
    if (_mustUseRemote) {
      return _remote.getSlideTemplates();
    }
    return _local.getSlideTemplates();
  }

  @override
  Future<Uint8List> generateSlidesPdf(
    String templateId, {
    String? codigoIbge,
  }) async {
    if (_mustUseRemote) {
      return _remote.generateSlidesPdf(templateId, codigoIbge: codigoIbge);
    }
    return _local.generateSlidesPdf(templateId, codigoIbge: codigoIbge);
  }

  Future<T?> _safeCall<T>(Future<T> Function() action) async {
    try {
      return await action();
    } catch (_) {
      return null;
    }
  }
}
