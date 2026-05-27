import '../models/levantamento_fundeb_models.dart';
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
  }) : _remote = remote,
       _local = local;

  final RemoteSyncRepository _remote;
  final LocalSyncRepository _local;

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
      return _remote.getDashboard(year: year);
    }
    return _local.getDashboard(year: year);
  }

  @override
  Future<List<CompanySummary>> getSidebarCompanies() async {
    if (_mustUseRemote) {
      final remote = await _remote.getSidebarCompanies();
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
      final remote = await _remote.getCollaborators(
        search: search,
        status: status,
        year: year,
      );
      await _local.cacheCollaborators(remote);
      return remote;
    }
    return _local.getCollaborators(search: search, status: status, year: year);
  }

  @override
  Future<List<AuditEntry>> getAudit({int limit = 20}) async {
    if (_mustUseRemote) {
      final remote = await _remote.getAudit(limit: limit);
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
      final remote = await _remote.getWorkspaceSettings();
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
      final remote = await _remote.updateWorkspaceSettings(settings);
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
      final remote = await _remote.getCompanies(search: search, status: status);
      await _local.cacheCompanies(remote);
      return remote;
    }
    return _local.getCompanies(search: search, status: status);
  }

  @override
  Future<CompanyBundle> getCompanyBundle(String companyId) async {
    if (_mustUseRemote) {
      final remote = await _remote.getCompanyBundle(companyId);
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
      final remote = await _remote.updateCompanyModules(
        companyId,
        enabledModules,
      );
      final bundle = await _safeCall(() => _remote.getCompanyBundle(companyId));
      if (bundle != null) {
        await _local.cacheCompanyBundle(bundle);
      }
      final allCompanies = await _safeCall(() => _remote.getCompanies());
      if (allCompanies != null) {
        await _local.cacheCompanies(allCompanies);
      }
      return remote;
    }
    return _local.updateCompanyModules(companyId, enabledModules);
  }

  @override
  Future<CityAccount> createCity(Map<String, dynamic> data) async {
    if (_mustUseRemote) return _remote.createCity(data);
    return _local.createCity(data);
  }

  @override
  Future<CollaboratorSummary> createCollaborator(Map<String, dynamic> data) async {
    if (_mustUseRemote) return _remote.createCollaborator(data);
    return _local.createCollaborator(data);
  }

  @override
  Future<List<CityAccount>> getCities({
    String search = '',
    String stage = '',
  }) async {
    if (_mustUseRemote) {
      return _remote.getCities(search: search, stage: stage);
    }
    return _local.getCities(search: search, stage: stage);
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

  Future<T?> _safeCall<T>(Future<T> Function() action) async {
    try {
      return await action();
    } catch (_) {
      return null;
    }
  }
}
