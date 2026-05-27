import '../models/sync_models.dart';
import '../models/levantamento_fundeb_models.dart';
import '../models/slide_models.dart';
import 'dart:typed_data';

abstract class SyncRepository {
  bool get remoteEnabled;
  String get apiBaseUrl;
  bool get usesEnvironmentApi;

  Future<void> setApiBaseUrl(String value);

  Future<SyncUser?> restoreSession();
  Future<SyncUser> signIn(String email, String password);
  Future<void> signOut();

  Future<DashboardOverview> getDashboard({
    int? year,
  });

  Future<List<CompanySummary>> getSidebarCompanies();

  Future<List<CollaboratorSummary>> getCollaborators({
    String search = '',
    String status = 'all',
    int? year,
  });

  Future<List<AuditEntry>> getAudit({
    int limit = 20,
  });

  Future<List<ModuleDefinition>> getModules();

  Future<WorkspaceSettings> getWorkspaceSettings();

  Future<WorkspaceSettings> updateWorkspaceSettings(
    WorkspaceSettings settings,
  );

  DashboardOverview loadDashboard();
  List<CompanySummary> loadSidebarCompanies();
  List<CollaboratorSummary> loadCollaborators();
  List<AuditEntry> loadAudit();
  List<ModuleDefinition> loadModules();
  WorkspaceSettings loadSettings();

  Future<List<CompanySummary>> getCompanies({
    String search = '',
    String status = 'Todos',
  });

  Future<CompanyBundle> getCompanyBundle(String companyId);

  Future<CompanyDetails> updateCompanyModules(
    String companyId,
    List<String> enabledModules,
  );

  Future<CityAccount> createCity(Map<String, dynamic> data);

  Future<CollaboratorSummary> createCollaborator(Map<String, dynamic> data);

  Future<List<CityAccount>> getCities({
    String search = '',
    String stage = '',
  });

  Future<List<MunicipioSearchItem>> searchMunicipios(
    String query, {
    String? uf,
  });

  Future<LevantamentoFundebBundle> getLevantamentoFundeb(
    MunicipioLookupRequest request,
  );

  Future<RelatorioDirigidoBundle> refreshRelatorioDirigido(
    MunicipioLookupRequest request,
  );

  Future<Uint8List> generateLevantamentoFundebPdf(
    MunicipioLookupRequest request, {
    String tipo = 'levantamento',
  });

  Future<Map<String, dynamic>> obterDadosContratoFundeb(Map<String, dynamic> body);

  Future<Uint8List> gerarKitContratosFundeb(Map<String, dynamic> data);

  /// Gera a Proposta Técnica e Comercial como DOCX standalone para assinatura.
  Future<Uint8List> gerarPropostaDocx(Map<String, dynamic> data);

  /// Gera o Kit Documental completo com anexos habilitatórios via multipart.
  /// [data] - Dados do contrato (ContratosFundebData serializado)
  /// [anexos] - Map de categoria -> lista de (nomeArquivo, bytes)
  Future<Uint8List> gerarKitContratosFundebComAnexos(
    Map<String, dynamic> data,
    Map<String, List<({String nome, Uint8List bytes})>> anexos,
  );

  // ── Slides module ──

  /// Retorna os templates de apresentação disponíveis.
  Future<List<SlideTemplate>> getSlideTemplates();

  /// Gera uma apresentação em PDF a partir do template e dados do município.
  Future<Uint8List> generateSlidesPdf(
    String templateId, {
    String? codigoIbge,
  });
}
