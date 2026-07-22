import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:typed_data';

import '../models/levantamento_fundeb_models.dart';
import '../models/slide_models.dart';
import '../models/sync_models.dart';
import '../network/api_exception.dart';
import '../network/session_storage.dart';
import '../network/sync_api_client.dart';
import 'mock_sync_repository.dart';
import 'sync_repository.dart';

class RemoteSyncRepository implements SyncRepository {
  RemoteSyncRepository({
    required SyncApiClient apiClient,
    required SessionStorage sessionStorage,
  }) : _apiClient = apiClient,
       _sessionStorage = sessionStorage;

  final SyncApiClient _apiClient;
  final SessionStorage _sessionStorage;

  @override
  bool get remoteEnabled => _apiClient.isConfigured;

  @override
  String get apiBaseUrl => _apiClient.apiBaseUrl;

  @override
  bool get usesEnvironmentApi => _apiClient.usesEnvironmentApi;

  @override
  Future<void> setApiBaseUrl(String value) => _apiClient.setApiBaseUrl(value);

  @override
  Future<SyncUser?> restoreSession() async {
    if (!remoteEnabled) return null;

    // A sessao persiste no proprio SDK do Firebase; nao ha mais cookie.
    // No cold start a restauracao e assincrona (Web/IndexedDB sobretudo), entao
    // currentUser pode vir null antes de o SDK assentar. Esperamos o primeiro
    // evento de authStateChanges, que reflete a sessao ja restaurada.
    final firebaseUser = FirebaseAuth.instance.currentUser ??
        await FirebaseAuth.instance
            .authStateChanges()
            .first
            .timeout(const Duration(seconds: 5), onTimeout: () => null);
    if (firebaseUser == null) {
      return null;
    }

    final user = _userFromFirebase(firebaseUser);

    try {
      // Confirma que o ID token e aceito pelo backend antes de dar por logado.
      await _apiClient.getList('/api/modules');
      return user;
    } on ApiException catch (error) {
      if (error.statusCode == 401) {
        await FirebaseAuth.instance.signOut();
        return null;
      }
      rethrow;
    }
  }

  @override
  Future<SyncUser> signIn(String email, String password) async {
    if (!remoteEnabled) {
      throw const ApiException(
        'Defina SYNC_API_BASE_URL para autenticar no backend real.',
      );
    }

    try {
      final credential = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      final firebaseUser = credential.user;
      if (firebaseUser == null) {
        throw const ApiException('Nao foi possivel entrar. Tente novamente.');
      }
      return _userFromFirebase(firebaseUser);
    } on FirebaseAuthException catch (error) {
      throw ApiException(_authErrorMessage(error.code));
    }
  }

  SyncUser _userFromFirebase(User firebaseUser) {
    final name = (firebaseUser.displayName?.trim().isNotEmpty ?? false)
        ? firebaseUser.displayName!.trim()
        : (firebaseUser.email ?? 'Usuario');
    return SyncUser(
      name: name,
      email: firebaseUser.email ?? '',
      initials: _buildInitials(name),
    );
  }

  String _authErrorMessage(String code) {
    switch (code) {
      case 'invalid-credential':
      case 'wrong-password':
      case 'user-not-found':
        return 'Email ou senha incorretos.';
      case 'invalid-email':
        return 'Email invalido.';
      case 'user-disabled':
        return 'Esta conta esta desativada.';
      case 'too-many-requests':
        return 'Muitas tentativas. Aguarde alguns minutos.';
      case 'network-request-failed':
        return 'Sem conexao com a internet.';
      default:
        return 'Nao foi possivel entrar. Tente novamente.';
    }
  }

  @override
  Future<void> signOut() async {
    try {
      await FirebaseAuth.instance.signOut();
    } finally {
      await _sessionStorage.clear();
    }
  }

  @override
  Future<DashboardOverview> getDashboard({int? year}) async {
    _assertConfigured();
    final targetYear = year ?? DateTime.now().year;
    final payload = await _apiClient.getObject(
      '/api/dashboard/executive?year=$targetYear',
    );
    return _mapDashboard(payload);
  }

  @override
  Future<List<CompanySummary>> getSidebarCompanies() async {
    final active = await getCompanies(status: 'Ativo');
    if (active.isNotEmpty) {
      return active.take(8).toList();
    }
    final all = await getCompanies();
    return all.take(8).toList();
  }

  @override
  Future<List<CollaboratorSummary>> getCollaborators({
    String search = '',
    String status = 'all',
    int? year,
  }) async {
    _assertConfigured();
    final params = <String>[];
    if (search.trim().isNotEmpty) {
      params.add('search=${Uri.encodeQueryComponent(search.trim())}');
    }
    if (status.trim().isNotEmpty && status != 'all') {
      params.add('status=${Uri.encodeQueryComponent(status)}');
    }
    if (year != null) {
      params.add('year=$year');
    }
    final path = params.isEmpty
        ? '/api/collaborators'
        : '/api/collaborators?${params.join('&')}';
    final list = await _apiClient.getList(path);
    return list
        .whereType<Map<String, dynamic>>()
        .map(_mapCollaboratorSummary)
        .toList();
  }

  @override
  Future<List<AuditEntry>> getAudit({int limit = 20}) async {
    _assertConfigured();
    final list = await _apiClient.getList('/api/audit?limit=$limit');
    return list.whereType<Map<String, dynamic>>().map(_mapAuditEntry).toList();
  }

  @override
  Future<List<ModuleDefinition>> getModules() async {
    _assertConfigured();
    final list = await _apiClient.getList('/api/modules');
    return list
        .whereType<Map<String, dynamic>>()
        .map(_mapModuleDefinition)
        .toList();
  }

  @override
  Future<WorkspaceSettings> getWorkspaceSettings() async {
    _assertConfigured();
    final payload = await _apiClient.getObject('/api/workspace/settings');
    return _mapWorkspaceSettings(payload);
  }

  @override
  Future<WorkspaceSettings> updateWorkspaceSettings(
    WorkspaceSettings settings,
  ) async {
    _assertConfigured();
    final payload = await _apiClient.put(
      '/api/workspace/settings',
      body: {
        'name': settings.groupName,
        'slug': settings.slug,
        'settings': settings.rawSettings,
      },
    );
    return _mapWorkspaceSettings(payload);
  }

  @override
  DashboardOverview loadDashboard() =>
      throw UnsupportedError('Use getDashboard().');

  @override
  List<CompanySummary> loadSidebarCompanies() =>
      throw UnsupportedError('Use getSidebarCompanies().');

  @override
  List<CollaboratorSummary> loadCollaborators() =>
      throw UnsupportedError('Use getCollaborators().');

  @override
  List<AuditEntry> loadAudit() => throw UnsupportedError('Use getAudit().');

  @override
  List<ModuleDefinition> loadModules() =>
      throw UnsupportedError('Use getModules().');

  @override
  WorkspaceSettings loadSettings() =>
      throw UnsupportedError('Use getWorkspaceSettings().');

  @override
  Future<List<CompanySummary>> getCompanies({
    String search = '',
    String status = 'Todos',
  }) async {
    _assertConfigured();

    final query = <String>[];
    if (search.trim().isNotEmpty) {
      query.add('search=${Uri.encodeQueryComponent(search.trim())}');
    }
    final apiStatus = _toApiStatus(status);
    if (apiStatus != null) {
      query.add('status=$apiStatus');
    }
    final path = query.isEmpty
        ? '/api/companies'
        : '/api/companies?${query.join('&')}';
    final list = await _apiClient.getList(path);
    return list
        .map((item) => _mapCompanySummary(item as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<CompanyBundle> getCompanyBundle(String companyId) async {
    _assertConfigured();

    final company = await _apiClient.getObject('/api/companies/$companyId');
    final employees = await _apiClient.getList(
      '/api/employees?companyId=$companyId',
    );

    return CompanyBundle(
      company: _mapCompanyDetails(company),
      employees: employees
          .map((item) => _mapEmployee(item as Map<String, dynamic>))
          .toList(),
    );
  }

  @override
  Future<CompanyDetails> updateCompanyModules(
    String companyId,
    List<String> enabledModules,
  ) async {
    _assertConfigured();

    final updated = await _apiClient.put(
      '/api/companies/$companyId',
      body: {'enabledModules': enabledModules},
    );
    return _mapCompanyDetails(updated);
  }

  @override
  Future<CityAccount> createCity(Map<String, dynamic> data) async {
    _assertConfigured();
    final result = await _apiClient.post('/api/municipalities', body: data);
    return CityAccount.fromJson(result);
  }

  @override
  Future<CollaboratorSummary> createCollaborator(
    Map<String, dynamic> data,
  ) async {
    _assertConfigured();
    final result = await _apiClient.post('/api/collaborators', body: data);
    return _mapCollaboratorSummary(result);
  }

  @override
  Future<CollaboratorDetails> getCollaboratorDetails(String id) async {
    _assertConfigured();
    final result = await _apiClient.getObject('/api/collaborators/$id');
    return CollaboratorDetails.fromJson(result);
  }

  @override
  Future<CollaboratorDetails> updateCollaboratorDetails(
    String id,
    Map<String, dynamic> data,
  ) async {
    _assertConfigured();
    final result = await _apiClient.put('/api/collaborators/$id', body: data);
    return CollaboratorDetails.fromJson(result);
  }

  @override
  Future<List<CollaboratorDocument>> getCollaboratorDocuments(String id) async {
    _assertConfigured();
    final list = await _apiClient.getList('/api/collaborators/$id/documents');
    return list
        .whereType<Map<String, dynamic>>()
        .map(CollaboratorDocument.fromJson)
        .toList();
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
    _assertConfigured();
    final uri = Uri.parse(
      '${_apiClient.apiBaseUrl}/api/collaborators/$id/documents',
    );
    final request = http.MultipartRequest('POST', uri);

    final headers = await _apiClient.getAuthHeaders();
    request.headers.addAll(headers);

    request.fields['category'] = category;
    request.fields['documentType'] = documentType;
    request.fields['name'] = name;
    if (issuedAt != null && issuedAt.isNotEmpty)
      request.fields['issuedAt'] = issuedAt;
    if (expiresAt != null && expiresAt.isNotEmpty)
      request.fields['expiresAt'] = expiresAt;
    if (notes != null && notes.isNotEmpty) request.fields['notes'] = notes;

    request.files.add(
      http.MultipartFile.fromBytes('file', fileBytes, filename: fileName),
    );

    final streamedResponse = await request.send().timeout(
      const Duration(seconds: 120),
    );
    final responseBody = await streamedResponse.stream.bytesToString();

    if (streamedResponse.statusCode != 200) {
      throw ApiException(
        'Erro ao enviar documento: ${streamedResponse.statusCode} - $responseBody',
        statusCode: streamedResponse.statusCode,
      );
    }

    final decoded = jsonDecode(responseBody) as Map<String, dynamic>;
    return CollaboratorDocument.fromJson(decoded);
  }

  @override
  Future<void> deleteCollaboratorDocument(String id, String docId) async {
    _assertConfigured();
    await _apiClient.delete('/api/collaborators/$id/documents/$docId');
  }

  @override
  Future<List<CityAccount>> getCities({
    String search = '',
    String stage = '',
  }) async {
    _assertConfigured();
    final params = <String>[];
    if (search.trim().isNotEmpty) {
      params.add('search=${Uri.encodeQueryComponent(search.trim())}');
    }
    if (stage.trim().isNotEmpty) {
      params.add('stage=${Uri.encodeQueryComponent(stage.trim())}');
    }
    final path = params.isEmpty
        ? '/api/municipalities'
        : '/api/municipalities?${params.join('&')}';
    final list = await _apiClient.getList(path);
    return list
        .whereType<Map<String, dynamic>>()
        .map((json) => CityAccount.fromJson(json))
        .toList();
  }

  @override
  Future<void> updateCityStage(String cityId, String stage) async {
    _assertConfigured();
    await _apiClient.put(
      '/api/municipalities/$cityId',
      body: {'currentStage': stage},
    );
  }

  @override
  Future<void> updateCityPipeline(
    String cityId,
    Map<String, dynamic> data,
  ) async {
    _assertConfigured();
    await _apiClient.put('/api/municipalities/$cityId', body: data);
  }

  @override
  Future<List<MunicipioSearchItem>> searchMunicipios(
    String query, {
    String? uf,
  }) async {
    _assertConfigured();

    final params = <String>['q=${Uri.encodeQueryComponent(query.trim())}'];
    if ((uf ?? '').trim().isNotEmpty) {
      params.add('uf=${Uri.encodeQueryComponent(uf!.trim().toUpperCase())}');
    }

    final payload = await _apiClient.getObject(
      '/api/municipios/buscar?${params.join('&')}',
    );
    final list = payload['data'];
    if (list is! List) {
      throw const ApiException('Resposta invalida da busca de municipios.');
    }

    return list
        .whereType<Map<String, dynamic>>()
        .map(MunicipioSearchItem.fromJson)
        .toList();
  }

  @override
  Future<LevantamentoFundebBundle> getLevantamentoFundeb(
    MunicipioLookupRequest request,
  ) async {
    _assertConfigured();

    final payload = await _apiClient.post(
      '/api/modulos/levantamento-fundeb/autonomo?formato=json',
      body: request.toJson(),
      timeout: const Duration(seconds: 90),
    );

    final data = payload['data'];
    if (data is! Map<String, dynamic>) {
      throw const ApiException('Resposta invalida do municipio completo.');
    }

    final relatorioJson = data['relatorio_fundeb'];
    if (relatorioJson is! Map<String, dynamic>) {
      throw const ApiException('Relatorio FUNDEB nao encontrado na resposta.');
    }

    final relatorio = RelatorioFundeb.fromJson(relatorioJson);
    final payloadPerfil = _buildIbgePerfilFromPayload(data);
    final officialPerfil = await _fetchIbgePerfil(
      relatorio.identificacao.municipioNome,
      relatorio.identificacao.uf,
    );

    final directedReport = await _enrichDirectedFundebHistory(
      _mapDirectedOrNull(data['relatorio_dirigido_base']),
      relatorio,
    );

    return LevantamentoFundebBundle(
      relatorio: relatorio,
      fontes: _buildFontesFromMunicipioPayload(data),
      relatorioDirigidoBase: directedReport,
      ibgePerfil: officialPerfil?.merge(payloadPerfil) ?? payloadPerfil,
    );
  }

  /// Build a complete FUNDEB report from SICONFI + IBGE, skipping FNDE data.
  /// Fetches INEP/Censo data from the backend local dataset via the censo-inep endpoint.
  /// Returns null on failure so the caller can gracefully degrade.
  Future<Map<String, dynamic>?> _fetchCensoInepData(String codigoIbge) async {
    try {
      final resp = await _apiClient.getObject(
        '/api/modulos/levantamento-fundeb/censo-inep?codigoIbge=$codigoIbge',
      );
      if (resp['success'] == true && resp['data'] is Map<String, dynamic>) {
        return resp['data'] as Map<String, dynamic>;
      }
    } catch (_) {
      // Non-critical — proceed without censo data
    }
    return null;
  }

  Future<LevantamentoFundebBundle> buildDirectFromSiconfi({
    required String codigoIbge,
    required String nome,
    required String uf,
    required int exercicio,
  }) async {
    final geoUri = Uri.https(
      'servicodados.ibge.gov.br',
      '/api/v1/localidades/municipios/$codigoIbge',
    );

    // Fetch 5 years of SICONFI data + geo + IBGE profile + INEP censo in parallel
    final parallel = await Future.wait([
      _fetchSiconfiFundebYear(
        codigoIbge,
        exercicio,
      ).catchError((_) => null), // [0] current year
      _fetchSiconfiFundebYear(
        codigoIbge,
        exercicio - 1,
      ).catchError((_) => null), // [1] year-1
      _fetchSiconfiFundebYear(
        codigoIbge,
        exercicio - 2,
      ).catchError((_) => null), // [2] year-2
      _fetchSiconfiFundebYear(
        codigoIbge,
        exercicio - 3,
      ).catchError((_) => null), // [3] year-3
      _fetchSiconfiFundebYear(
        codigoIbge,
        exercicio - 4,
      ).catchError((_) => null), // [4] year-4
      http
          .get(geoUri)
          .timeout(const Duration(seconds: 15))
          .catchError((_) => http.Response('{}', 200)), // [5]
      _fetchIbgePerfil(nome, uf).catchError((_) => null), // [6]
      _fetchCensoInepData(codigoIbge).catchError((_) => null), // [7]
    ]);

    final siconfiYears = <RelatorioDirigidoSerieHistoricaAno?>[
      parallel[4] as RelatorioDirigidoSerieHistoricaAno?, // oldest first
      parallel[3] as RelatorioDirigidoSerieHistoricaAno?,
      parallel[2] as RelatorioDirigidoSerieHistoricaAno?,
      parallel[1] as RelatorioDirigidoSerieHistoricaAno?,
      parallel[0] as RelatorioDirigidoSerieHistoricaAno?, // most recent
    ];
    final geoResp = parallel[5] as http.Response;
    final ibgePerfil = parallel[6] as IbgeMunicipioPerfil?;
    final censoInepData = parallel[7] as Map<String, dynamic>?;

    // Use the most recent year with data for the main receitas
    final siconfi = siconfiYears.lastWhere(
      (y) => y != null,
      orElse: () => null,
    );
    // Use the second most recent for YoY comparison
    final filledYears = siconfiYears.where((y) => y != null).toList();
    final siconfiPrev = filledYears.length >= 2
        ? filledYears[filledYears.length - 2]
        : null;

    // Parse Censo historical data for enriching SICONFI years
    final censoHistoricoAnual = <int, Map<String, dynamic>>{};
    if (censoInepData != null) {
      final histList = censoInepData['censoHistoricoAnual'];
      if (histList is List) {
        for (final item in histList) {
          if (item is Map<String, dynamic> && item['ano'] is int) {
            censoHistoricoAnual[item['ano'] as int] = item;
          }
        }
      }
    }

    // Parse geo
    Map<String, dynamic> geo = {};
    try {
      geo = jsonDecode(geoResp.body) as Map<String, dynamic>;
    } catch (_) {}
    final micro = geo['microrregiao'];
    final meso = micro is Map ? micro['mesorregiao'] : null;
    final regIm = geo['regiao-imediata'];
    final regInt = regIm is Map ? regIm['regiao-intermediaria'] : null;
    final ufMap = meso is Map ? meso['UF'] : null;
    final regMap = ufMap is Map ? ufMap['regiao'] : null;

    // Receitas
    final total = siconfi?.totalReceitasFundeb ?? 0;
    final contrib = siconfi?.contribuicaoMunicipal ?? total;
    final vaaf = siconfi?.complementacaoVAAF ?? 0;
    final vaat = siconfi?.complementacaoVAAT ?? 0;
    final vaar = siconfi?.complementacaoVAAR ?? 0;
    final compl = vaaf > 0 || vaat > 0 || vaar > 0;

    // Projeção 1.04
    final vaafP = (vaaf * 1.04).round().toDouble();
    final vaatP = (vaat * 1.04).round().toDouble();
    final vaarP = (vaar * 1.04).round().toDouble();
    final totalP = contrib + vaafP + vaatP + vaarP;
    final ganho = totalP - total;
    final pct = total > 0 ? ganho / total : 0.0;

    // Projeção 1.06
    final vaafP6 = (vaaf * 1.06).round().toDouble();
    final vaatP6 = (vaat * 1.06).round().toDouble();
    final vaarP6 = (vaar * 1.06).round().toDouble();
    final totalP6 = contrib + vaafP6 + vaatP6 + vaarP6;
    final ganho6 = totalP6 - total;
    final pct6 = total > 0 ? ganho6 / total : 0.0;

    // Cronograma
    final mensal = totalP > 0 ? (totalP / 12).round().toDouble() : 0.0;
    final cron =
        [
              'Jan',
              'Fev',
              'Mar',
              'Abr',
              'Mai',
              'Jun',
              'Jul',
              'Ago',
              'Set',
              'Out',
              'Nov',
              'Dez',
            ]
            .map(
              (m) => CronogramaVAAF(
                mes: m,
                valorProjetado: mensal,
                percentual: 1.0 / 12,
              ),
            )
            .toList();

    // YoY
    final prev = siconfiPrev?.totalReceitasFundeb ?? 0;
    final yoy = prev > 0
        ? ((total - prev) / prev * 100).toStringAsFixed(1)
        : null;

    final pop = ibgePerfil?.populacaoEstimada ?? 0;

    final proj = ProjecaoRochaPrime(
      vaafAtual: vaaf,
      vaafProjetado: vaafP,
      vaafGanho: vaafP - vaaf,
      vaatAtual: vaat,
      vaatProjetado: vaatP,
      vaatGanho: vaatP - vaat,
      vaarAtual: vaar,
      vaarProjetado: vaarP,
      vaarGanho: vaarP - vaar,
      totalAtual: total,
      totalProjetado: totalP,
      totalGanho: ganho,
      ganhoPercentual: pct,
      possuiComplementacao: compl,
      metodologia: 'Projecao Rocha Prime (SICONFI direto)',
      multiplicadorAplicado: 1.04,
      natureza: 'recuperavel',
    );

    final relatorio = RelatorioFundeb(
      geradoEm: DateTime.now().toIso8601String(),
      identificacao: MunicipioIdentificacao(
        municipio: '$nome/$uf',
        municipioNome: nome,
        uf: uf,
        codigoIBGE: codigoIbge,
        prefeito: 'Consultar TSE/DivulgaCand',
        partido: '-',
        exercicio: exercicio,
        fonte: 'SICONFI + IBGE (direto)',
        mesorregiao: meso is Map ? (meso['nome'] ?? '').toString() : '',
        microrregiao: micro is Map ? (micro['nome'] ?? '').toString() : '',
        regiaoIntermediaria: regInt is Map
            ? (regInt['nome'] ?? '').toString()
            : '',
        regiao: regMap is Map ? (regMap['nome'] ?? '').toString() : '',
      ),
      receitas: ReceitasFundeb(
        receitaContribuicaoMunicipal: contrib,
        complementacaoVAAF: vaaf,
        complementacaoVAAT: vaat,
        complementacaoVAAR: vaar,
        totalReceitas: total,
      ),
      projecao: proj,
      projecaoRecuperavel: proj,
      projecaoComercial: ProjecaoRochaPrime(
        vaafAtual: vaaf,
        vaafProjetado: vaafP6,
        vaafGanho: vaafP6 - vaaf,
        vaatAtual: vaat,
        vaatProjetado: vaatP6,
        vaatGanho: vaatP6 - vaat,
        vaarAtual: vaar,
        vaarProjetado: vaarP6,
        vaarGanho: vaarP6 - vaar,
        totalAtual: total,
        totalProjetado: totalP6,
        totalGanho: ganho6,
        ganhoPercentual: pct6,
        possuiComplementacao: compl,
        metodologia: 'Benchmark comercial Rocha Prime',
        multiplicadorAplicado: 1.06,
        natureza: 'benchmark',
        ressalva: 'Requer fechamento documental para captura integral.',
      ),
      upsideCondicionado: UpsideCondicionadoFundeb(
        totalProjetado: totalP6,
        ganhoAdicional: ganho6 - ganho,
        ganhoPercentual: total > 0 ? (ganho6 - ganho) / total : 0,
        metodologia: 'Upside condicionado por benchmark regional',
        vetores: const [
          'Tempo integral',
          'Regularizacao VAAT',
          'Ajustes de base',
        ],
      ),
      censoEscolar: censoInepData != null
          ? CensoEscolar.fromJson(
              censoInepData['censoEscolar'] as Map<String, dynamic>,
            )
          : null,
      perfilComercial: PerfilComercialFundeb(
        score: compl ? 75 : 45,
        faixa: compl ? 'padrao' : 'basico',
        confianca: 0.75,
        habilitacaoVaat: 'Verificar portal Habilita/FNDE',
        populacaoEstimada: pop,
        fundebPerCapita: pop > 0 ? (total / pop).round().toDouble() : 0,
        matriculasMunicipaisPorHabitante: pop > 0
            ? ((censoInepData?['matriculasMunicipaisTotal'] as num?)
                          ?.toDouble() ??
                      0) /
                  pop
            : 0,
        educacaoInfantilMunicipalPorHabitante: pop > 0
            ? ((censoInepData?['educacaoInfantilMunicipal'] as num?)
                          ?.toDouble() ??
                      0) /
                  pop
            : 0,
        crecheMunicipalPorHabitante: pop > 0
            ? ((censoInepData?['crecheMunicipal'] as num?)?.toDouble() ?? 0) /
                  pop
            : 0,
      ),
      cronogramaVAAF: cron,
      sistemas: const [],
      obrasPAC2: const [],
      situacaoPAR: 'FNDE/SIGEF temporariamente indisponivel',
      caminhoEscola: const [],
      pdde: const [],
      observacoesOperacionais: [
        'Receitas FUNDEB reais via SICONFI/Tesouro Nacional (exercicio ${exercicio - 1}).',
        'Dados de PAR, PDDE, Caminho da Escola: FNDE fora do ar.',
        if (yoy != null)
          'Variacao FUNDEB ${exercicio - 2} → ${exercicio - 1}: $yoy%.',
      ],
      idebAnosIniciais:
          censoInepData != null &&
              (censoInepData['idebAnosIniciais'] as List?)?.isNotEmpty == true
          ? (censoInepData['idebAnosIniciais'] as List)
                .map((item) => IDEBDado.fromJson(item as Map<String, dynamic>))
                .toList()
          : const [],
      idebAnosFinais:
          censoInepData != null &&
              (censoInepData['idebAnosFinais'] as List?)?.isNotEmpty == true
          ? (censoInepData['idebAnosFinais'] as List)
                .map((item) => IDEBDado.fromJson(item as Map<String, dynamic>))
                .toList()
          : const [],
      idebEnsinoMedio:
          censoInepData != null &&
              (censoInepData['idebEnsinoMedio'] as List?)?.isNotEmpty == true
          ? (censoInepData['idebEnsinoMedio'] as List)
                .map((item) => IDEBDado.fromJson(item as Map<String, dynamic>))
                .toList()
          : const [],
    );

    // Build serie historica from all SICONFI years, enriched with Censo data
    final hist = <RelatorioDirigidoSerieHistoricaAno>[];
    for (final year in siconfiYears) {
      if (year == null) continue;
      final censo = censoHistoricoAnual[year.ano];
      hist.add(
        RelatorioDirigidoSerieHistoricaAno(
          ano: year.ano,
          anoBaseCenso: censo != null ? (censo['ano'] as int?) : null,
          totalReceitasFundeb: year.totalReceitasFundeb,
          contribuicaoMunicipal: year.contribuicaoMunicipal,
          complementacaoVAAF: year.complementacaoVAAF,
          complementacaoVAAT: year.complementacaoVAAT,
          complementacaoVAAR: year.complementacaoVAAR,
          totalMatriculasMunicipais: censo != null
              ? (censo['totalMatriculas'] as num?)?.toInt()
              : year.totalMatriculasMunicipais,
          totalEscolas: censo != null
              ? (censo['totalEscolas'] as num?)?.toInt()
              : year.totalEscolas,
          tempoIntegral: censo != null
              ? (censo['tempoIntegral'] as num?)?.toInt()
              : year.tempoIntegral,
          educacaoEspecial: censo != null
              ? (censo['educacaoEspecial'] as num?)?.toInt()
              : year.educacaoEspecial,
          eja: censo != null ? (censo['eja'] as num?)?.toInt() : year.eja,
        ),
      );
    }

    final dirigido = RelatorioDirigidoMunicipio(
      municipio: nome,
      uf: uf,
      codigoIbge: codigoIbge,
      geradoEm: DateTime.now().toIso8601String(),
      modo: 'siconfi_direto',
      modeloPrincipal: 'siconfi_local',
      resumoExecutivo:
          'Levantamento FUNDEB com receitas reais do SICONFI/Tesouro Nacional. '
          'Dados de PAR, PDDE e sistemas FNDE temporariamente indisponiveis.',
      searchQueries: const [],
      itens: const [],
      pendenciasHumanas: const [
        'Confirmar dados do prefeito e partido atual via TSE/DivulgaCand.',
        'Verificar habilitacao VAAT no portal Habilita/FNDE quando disponivel.',
      ],
      alertasJuridicos: const [
        'FNDE/SIGEF fora do ar — dados de convenios e PAR indisponiveis.',
      ],
      proximosPassos: const [
        'Aguardar retorno do FNDE para complementar dados de PAR e PDDE.',
        'Validar trilha documental de condicionalidades VAAT.',
      ],
      prontidao: const RelatorioDirigidoProntidao(
        status: 'parcial',
        score: 65,
        resumo:
            'Dados financeiros completos via SICONFI. Dados operacionais FNDE pendentes.',
        bloqueios: ['FNDE/SIGEF temporariamente fora do ar.'],
        avisos: ['Dados de PAR, PDDE e Caminho da Escola indisponiveis.'],
        criterios: [
          'Receitas FUNDEB validadas',
          'Projecao Rocha Prime aplicada',
          'Geografia IBGE confirmada',
        ],
      ),
      contextoPolitico: const RelatorioDirigidoContextoPolitico(
        prefeitoAtual: 'Consultar TSE/DivulgaCand',
        partidoAtual: '-',
        classificacaoMandato: 'Nao classificado',
        detalheMandato: 'Mandato 2025-2028. Dados indisponiveis via FNDE.',
        estrategiaComercial: 'Abordagem direta com secretaria de educacao.',
        resumoComparativoGestao:
            'Comparativo de gestao indisponivel (FNDE offline).',
      ),
      historico: RelatorioDirigidoHistorico(
        anos: hist,
        resumo: hist.length > 1
            ? 'Serie historica com ${hist.length} exercicios (${hist.first.ano}-${hist.last.ano}) via SICONFI/Tesouro.${censoHistoricoAnual.isNotEmpty ? ' Base escolar enriquecida com Censo INEP.' : ''}'
            : hist.isNotEmpty
            ? 'Exercicio ${hist.first.ano} disponivel no SICONFI.'
            : 'Nenhum exercicio disponivel no SICONFI.',
      ),
      benchmarkRegional: const RelatorioDirigidoBenchmarkRegional(
        criterio: 'Mesma mesorregiao e faixa populacional',
        resumo: 'Benchmark regional indisponivel (requer dados FNDE).',
        municipios: [],
      ),
    );

    return LevantamentoFundebBundle(
      relatorio: relatorio,
      fontes: [
        const FonteColetaStatus(
          id: 'ibge',
          label: 'IBGE',
          status: 'automatico',
          descricao:
              'Busca territorial e identificacao municipal resolvidas automaticamente.',
        ),
        const FonteColetaStatus(
          id: 'fnde-siconfi',
          label: 'FNDE / SICONFI',
          status: 'automatico',
          descricao:
              'Base fiscal consolidada automaticamente com suporte do SICONFI/Tesouro.',
        ),
        const FonteColetaStatus(
          id: 'simec',
          label: 'MEC / FNDE operacional',
          status: 'manual',
          descricao: 'Fluxo operacional ainda depende de fechamento assistido.',
        ),
        FonteColetaStatus(
          id: 'inep-qedu',
          label: 'INEP / QEdu',
          status: censoInepData != null ? 'automatico' : 'manual',
          descricao: censoInepData != null
              ? 'Censo escolar carregado automaticamente pela base interna.'
              : 'Indicadores educacionais ainda sem automacao suficiente.',
        ),
        const FonteColetaStatus(
          id: 'pdde-fnde',
          label: 'PDDE / FNDE',
          status: 'manual',
          descricao: 'PDDE ainda sem consolidacao automatica neste recorte.',
        ),
      ],
      relatorioDirigidoBase: dirigido,
      ibgePerfil: ibgePerfil,
    );
  }

  @override
  Future<RelatorioDirigidoBundle> refreshRelatorioDirigido(
    MunicipioLookupRequest request,
  ) async {
    _assertConfigured();

    final payload = await _apiClient.post(
      '/api/modulos/levantamento-fundeb/relatorio-dirigido?formato=json',
      body: request.toJson(),
      timeout: const Duration(seconds: 90),
    );

    final report = await _enrichDirectedFundebHistory(
      _mapDirectedOrNull(payload['data']),
    );
    if (report == null) {
      throw const ApiException('Resposta invalida do relatorio dirigido.');
    }

    final base = await _enrichDirectedFundebHistory(
      _mapDirectedOrNull(payload['base']) ?? report,
    );

    return RelatorioDirigidoBundle(
      report: report,
      base: base ?? report,
      warning: payload['warning']?.toString(),
    );
  }

  @override
  Future<Uint8List> generateLevantamentoFundebPdf(
    MunicipioLookupRequest request, {
    String tipo = 'levantamento',
  }) async {
    _assertConfigured();
    return _apiClient.postBytes(
      '/api/modulos/levantamento-fundeb/autonomo?tipo=${Uri.encodeQueryComponent(tipo)}&formato=pdf',
      body: request.toJson(),
      timeout: const Duration(seconds: 180),
    );
  }

  String _buildInitials(String value) {
    final parts = value
        .trim()
        .split(RegExp(r'\s+'))
        .where((item) => item.isNotEmpty)
        .toList();
    if (parts.isEmpty) return 'U';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  String? _toApiStatus(String status) {
    switch (status) {
      case 'Ativo':
        return 'active';
      case 'Inativo':
        return 'inactive';
      default:
        return null;
    }
  }

  CompanySummary _mapCompanySummary(Map<String, dynamic> json) {
    final status = _labelStatus(json['status'] as String?);
    return CompanySummary(
      id: json['id'] as String? ?? '',
      tradingName: json['tradingName'] as String? ?? '',
      segment: json['segment'] as String? ?? 'outro',
      cnpj: json['cnpj'] as String? ?? '',
      status: status,
      city: json['city'] as String? ?? '',
      state: json['state'] as String? ?? '',
      enabledModules: (json['enabledModules'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      color: _colorForStatus(status),
    );
  }

  CompanyDetails _mapCompanyDetails(Map<String, dynamic> json) {
    return CompanyDetails(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      tradingName: json['tradingName'] as String? ?? '',
      cnpj: json['cnpj'] as String? ?? '',
      status: _labelStatus(json['status'] as String?),
      segment: json['segment'] as String? ?? 'outro',
      city: json['city'] as String? ?? '',
      state: json['state'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      contactName: json['contactName'] as String? ?? '',
      contactPosition: json['contactPosition'] as String? ?? '',
      enabledModules: (json['enabledModules'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }

  EmployeeRecord _mapEmployee(Map<String, dynamic> json) {
    return EmployeeRecord(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      position: json['position'] as String? ?? '',
      role: json['role'] as String? ?? '',
      status: _labelStatus(json['status'] as String?),
    );
  }

  String _labelStatus(String? status) {
    switch (status) {
      case 'active':
        return 'Ativo';
      case 'inactive':
        return 'Inativo';
      case 'on_leave':
        return 'Afastado';
      default:
        return status ?? '--';
    }
  }

  Color _colorForStatus(String status) {
    switch (status) {
      case 'Ativo':
        return SyncPalette.statusActive;
      case 'Inativo':
        return SyncPalette.textSecondary;
      default:
        return SyncPalette.statusInfo;
    }
  }

  RelatorioDirigidoMunicipio? _mapDirectedOrNull(dynamic value) {
    if (value is! Map<String, dynamic>) return null;
    return RelatorioDirigidoMunicipio.fromJson(value);
  }

  Future<RelatorioDirigidoMunicipio?> _enrichDirectedFundebHistory(
    RelatorioDirigidoMunicipio? report, [
    RelatorioFundeb? relatorio,
  ]) async {
    if (report == null) return null;

    final ibge = _normalizeIbgeCode(
      report.codigoIbge.isNotEmpty
          ? report.codigoIbge
          : relatorio?.identificacao.codigoIBGE,
    );
    if (ibge.isEmpty) return report;

    final existingByYear = <int, RelatorioDirigidoSerieHistoricaAno>{
      for (final item in report.historico.anos) item.ano: item,
    };
    final exerciseYear =
        relatorio?.identificacao.exercicio ?? DateTime.now().year;
    final endYear = [
      exerciseYear - 1,
      DateTime.now().year - 1,
    ].reduce((left, right) => left < right ? left : right);
    if (endYear < 2022) return report;

    var changed = false;
    final enrichedByYear = Map<int, RelatorioDirigidoSerieHistoricaAno>.from(
      existingByYear,
    );

    for (var year = 2022; year <= endYear; year++) {
      final current = enrichedByYear[year];
      final needsFinancialData = current?.totalReceitasFundeb == null;
      final needsSchoolData = !_hasSchoolData(current);
      if (!needsFinancialData && !needsSchoolData) {
        continue;
      }

      RelatorioDirigidoSerieHistoricaAno? enrichedYear = current;
      if (needsFinancialData) {
        final siconfiYear = await _fetchSiconfiFundebYear(ibge, year);
        if (siconfiYear != null) {
          enrichedYear = _mergeHistoricalYear(enrichedYear, siconfiYear);
        }
      }
      if (needsSchoolData) {
        final schoolYear = await _fetchQeduSchoolYear(ibge, year);
        if (schoolYear != null) {
          enrichedYear = _mergeHistoricalYear(enrichedYear, schoolYear);
        }
      }

      if (enrichedYear == null || identical(enrichedYear, current)) {
        continue;
      }
      enrichedByYear[year] = enrichedYear;
      changed = true;
      await Future<void>.delayed(const Duration(milliseconds: 1100));
    }

    if (!changed) return report;

    final enrichedYears = enrichedByYear.values.toList()
      ..sort((left, right) => left.ano.compareTo(right.ano));
    final resumo = report.historico.resumo.trim().isEmpty
        ? 'Histórico anual enriquecido com dados oficiais do SICONFI/Tesouro e do Censo Escolar para os anos disponíveis.'
        : '${report.historico.resumo} Dados ausentes foram complementados com a base DCA/SICONFI e com o Censo Escolar quando disponíveis.';

    return RelatorioDirigidoMunicipio(
      municipio: report.municipio,
      uf: report.uf,
      codigoIbge: report.codigoIbge.isNotEmpty ? report.codigoIbge : ibge,
      geradoEm: report.geradoEm,
      modo: report.modo,
      modeloPrincipal: report.modeloPrincipal,
      modeloAuxiliar: report.modeloAuxiliar,
      resumoExecutivo: report.resumoExecutivo,
      searchQueries: report.searchQueries,
      itens: report.itens,
      pendenciasHumanas: report.pendenciasHumanas,
      alertasJuridicos: report.alertasJuridicos,
      proximosPassos: report.proximosPassos,
      prontidao: report.prontidao,
      perfilMunicipio: report.perfilMunicipio,
      indicadoresAprendizagem: report.indicadoresAprendizagem,
      infraestruturaEscolar: report.infraestruturaEscolar,
      narrativas: report.narrativas,
      saudeFiscal: report.saudeFiscal,
      perfilIBGE: report.perfilIBGE,
      obrasPAC2: report.obrasPAC2,
      caminhoEscola: report.caminhoEscola,
      cenarioEstruturacao: report.cenarioEstruturacao,
      recursosPorAluno: report.recursosPorAluno,
      valorAlunoOficial: report.valorAlunoOficial,
      contextoPolitico: report.contextoPolitico,
      historico: RelatorioDirigidoHistorico(
        anos: enrichedYears,
        resumo: resumo,
      ),
      benchmarkRegional: report.benchmarkRegional,
    );
  }

  RelatorioDirigidoSerieHistoricaAno _mergeHistoricalYear(
    RelatorioDirigidoSerieHistoricaAno? current,
    RelatorioDirigidoSerieHistoricaAno siconfi,
  ) {
    if (current == null) return siconfi;
    return RelatorioDirigidoSerieHistoricaAno(
      ano: current.ano,
      anoBaseCenso: current.anoBaseCenso ?? siconfi.anoBaseCenso,
      totalReceitasFundeb:
          current.totalReceitasFundeb ?? siconfi.totalReceitasFundeb,
      contribuicaoMunicipal:
          current.contribuicaoMunicipal ?? siconfi.contribuicaoMunicipal,
      complementacaoVAAF:
          current.complementacaoVAAF ?? siconfi.complementacaoVAAF,
      complementacaoVAAT:
          current.complementacaoVAAT ?? siconfi.complementacaoVAAT,
      complementacaoVAAR:
          current.complementacaoVAAR ?? siconfi.complementacaoVAAR,
      totalMatriculasMunicipais:
          current.totalMatriculasMunicipais ??
          siconfi.totalMatriculasMunicipais,
      totalEscolas: current.totalEscolas ?? siconfi.totalEscolas,
      eja: current.eja ?? siconfi.eja,
      tempoIntegral: current.tempoIntegral ?? siconfi.tempoIntegral,
      educacaoEspecial: current.educacaoEspecial ?? siconfi.educacaoEspecial,
    );
  }

  bool _hasSchoolData(RelatorioDirigidoSerieHistoricaAno? year) {
    return year?.totalMatriculasMunicipais != null ||
        year?.totalEscolas != null ||
        year?.tempoIntegral != null ||
        year?.educacaoEspecial != null ||
        year?.eja != null;
  }

  String _normalizeIbgeCode(String? value) {
    return (value ?? '').replaceAll(RegExp(r'[^0-9]'), '');
  }

  Future<RelatorioDirigidoSerieHistoricaAno?> _fetchSiconfiFundebYear(
    String codigoIbge,
    int year,
  ) async {
    final uri = Uri.https(
      'apidatalake.tesouro.gov.br',
      '/ords/siconfi/tt/dca',
      {'an_exercicio': '$year', 'id_ente': codigoIbge},
    );
    try {
      final response = await http.get(uri).timeout(const Duration(seconds: 30));
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return null;
      }
      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) return null;
      final items = decoded['items'];
      if (items is! List) return null;

      final total = _siconfiValue(
        items,
        anexo: 'DCA-Anexo I-C',
        codConta: 'RO1.7.5.1.00.0.0',
        coluna: 'Receitas Brutas Realizadas',
      );
      if (total == null) return null;

      // Try Anexo I-HI first (available from 2024+)
      var union = _siconfiValue(
        items,
        anexo: 'DCA-Anexo I-HI',
        codConta: 'P4.5.2.2.3.00.00',
      );
      var state = _siconfiValue(
        items,
        anexo: 'DCA-Anexo I-HI',
        codConta: 'P4.5.2.2.4.00.00',
      );

      // Fallback: Anexo I-C, conta RO1.7.1.5 (Complementação da União - receitas)
      // Available for all years including 2022/2023 where P4.5.2.2 doesn't exist
      union ??= _siconfiValue(
        items,
        anexo: 'DCA-Anexo I-C',
        codConta: 'RO1.7.1.5.00.0.0',
        coluna: 'Receitas Brutas Realizadas',
      );

      final complementacaoUniao = union ?? 0;
      final contribuicao = state ?? (total - complementacaoUniao);

      return RelatorioDirigidoSerieHistoricaAno(
        ano: year,
        totalReceitasFundeb: total,
        contribuicaoMunicipal: contribuicao > 0
            ? contribuicao
            : total - complementacaoUniao,
        complementacaoVAAF: complementacaoUniao > 0
            ? complementacaoUniao
            : null,
        complementacaoVAAT: 0,
        complementacaoVAAR: 0,
      );
    } catch (_) {
      return null;
    }
  }

  double? _siconfiValue(
    List<dynamic> items, {
    required String anexo,
    required String codConta,
    String? coluna,
  }) {
    for (final item in items.whereType<Map<String, dynamic>>()) {
      if (item['anexo'] != anexo || item['cod_conta'] != codConta) continue;
      if (coluna != null && item['coluna'] != coluna) continue;
      final value = item['valor'];
      if (value is num) return value.toDouble();
      if (value is String) return double.tryParse(value.replaceAll(',', '.'));
    }
    return null;
  }

  Future<RelatorioDirigidoSerieHistoricaAno?> _fetchQeduSchoolYear(
    String codigoIbge,
    int year,
  ) async {
    final uri =
        Uri.https('qedu.org.br', '/api/v1/censo/territorios/matriculas', {
          'ibge_id': codigoIbge,
          'ano': '$year',
          'dependencia_id': '5',
          'localizacao_id': '0',
          'oferta_id': '0',
        });
    try {
      final response = await http.get(uri).timeout(const Duration(seconds: 30));
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return null;
      }
      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) return null;
      final censo = decoded['censo'];
      if (censo is! Map<String, dynamic>) return null;

      final totalMatriculas = _sumNullableInts([
        _readNullablePayloadInt(censo['matriculas_creche']),
        _readNullablePayloadInt(censo['matriculas_pre_escolar']),
        _readNullablePayloadInt(censo['matriculas_anos_iniciais']),
        _readNullablePayloadInt(censo['matriculas_anos_finais']),
        _readNullablePayloadInt(censo['matriculas_ensino_medio']),
        _readNullablePayloadInt(censo['matriculas_eja']),
      ]);
      final totalEscolas = _readNullablePayloadInt(censo['qtd_escolas']);

      if (totalMatriculas == null && totalEscolas == null) {
        return null;
      }

      return RelatorioDirigidoSerieHistoricaAno(
        ano: year,
        anoBaseCenso: _readNullablePayloadInt(censo['ano']) ?? year,
        totalMatriculasMunicipais: totalMatriculas,
        totalEscolas: totalEscolas,
        eja: _readNullablePayloadInt(censo['matriculas_eja']),
        tempoIntegral: _readNullablePayloadInt(censo['matriculas_integral']),
        educacaoEspecial: _readNullablePayloadInt(
          censo['matriculas_educacao_especial'],
        ),
      );
    } catch (_) {
      return null;
    }
  }

  int? _sumNullableInts(List<int?> values) {
    var hasValue = false;
    var total = 0;
    for (final value in values) {
      if (value == null) continue;
      hasValue = true;
      total += value;
    }
    return hasValue ? total : null;
  }

  int? _readNullablePayloadInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.round();
    if (value is String) {
      final normalized = value.trim().replaceAll('.', '').replaceAll(',', '.');
      if (normalized.isEmpty) return null;
      return double.tryParse(normalized)?.round();
    }
    return null;
  }

  List<FonteColetaStatus> _buildFontesFromMunicipioPayload(
    Map<String, dynamic> payload,
  ) {
    final fontesColeta = payload['fontes_coleta'];
    if (fontesColeta is List) {
      final mapped = fontesColeta
          .whereType<Map<String, dynamic>>()
          .map(
            (item) => FonteColetaStatus(
              id: (item['id'] ?? '').toString(),
              label: (item['label'] ?? '').toString(),
              status: (item['status'] ?? 'manual').toString(),
              descricao: (item['descricao'] ?? '').toString(),
            ),
          )
          .where((item) => item.id.isNotEmpty && item.label.isNotEmpty)
          .toList();
      if (mapped.isNotEmpty) {
        return mapped;
      }
    }

    final fiscal = payload['fiscal'] as Map<String, dynamic>? ?? const {};
    final fundeb = fiscal['fundeb'] as Map<String, dynamic>? ?? const {};
    final siconfi = fiscal['siconfi'] as Map<String, dynamic>? ?? const {};
    final educacao = payload['educacao'] as Map<String, dynamic>? ?? const {};
    final indicadores =
        educacao['indicadores_aprendizagem'] as Map<String, dynamic>? ??
        const {};
    final relatorio =
        payload['relatorio_fundeb'] as Map<String, dynamic>? ?? const {};
    final censo =
        relatorio['censoEscolar'] as Map<String, dynamic>? ?? const {};
    final pdde = relatorio['pdde'] as List<dynamic>? ?? const [];
    final sistemas = relatorio['sistemas'] as List<dynamic>? ?? const [];
    final situacaoPar = (relatorio['situacaoPAR'] ?? '')
        .toString()
        .toLowerCase();

    final fundebDisponivel = fundeb['disponivel'] == true;
    final fundebFonte = (fundeb['fonte'] ?? '').toString().toLowerCase();
    final siconfiDisponivel = siconfi['disponivel'] == true;
    final qeduDisponivel = indicadores['disponivel'] == true;
    final inepDisponivel =
        ((censo['totalMatriculas'] as num?)?.toInt() ?? 0) > 0;
    final pddeDisponivel = pdde.any((item) {
      if (item is! Map<String, dynamic>) return false;
      final valor = item['valor'];
      if (valor is num) return valor > 0;
      final parsed = double.tryParse(valor.toString());
      return parsed != null && parsed > 0;
    });
    final sistemasPublicos =
        sistemas.any((item) {
          if (item is! Map<String, dynamic>) return false;
          final situacao = (item['situacao'] ?? '').toString().toLowerCase();
          return situacao.contains('consulta publica') ||
              situacao.contains('credencial') ||
              situacao.contains('pdde info');
        }) ||
        situacaoPar.isNotEmpty && situacaoPar != 'nao informado';
    final fundebEstimado = fundebFonte.contains('estimativa calibrada');

    return [
      const FonteColetaStatus(
        id: 'ibge',
        label: 'IBGE',
        status: 'automatico',
        descricao:
            'Busca territorial e identificacao municipal resolvidas automaticamente.',
      ),
      FonteColetaStatus(
        id: 'fnde-siconfi',
        label: 'FNDE / SICONFI',
        status: siconfiDisponivel || fundebDisponivel
            ? (fundebEstimado ? 'estimado' : 'automatico')
            : 'manual',
        descricao: siconfiDisponivel
            ? 'Base fiscal consolidada automaticamente com suporte do SICONFI/Tesouro.'
            : fundebEstimado
            ? 'Linha FUNDEB estimada por calibracao interna enquanto a base anual fecha.'
            : fundebDisponivel
            ? 'Receitas FUNDEB carregadas automaticamente pela base oficial.'
            : 'Receitas e fiscal ainda exigem complemento manual.',
      ),
      FonteColetaStatus(
        id: 'simec',
        label: 'MEC / FNDE operacional',
        status: sistemasPublicos ? 'estimado' : 'manual',
        descricao: sistemasPublicos
            ? 'Consultas publicas e evidencias operacionais localizadas automaticamente.'
            : 'Fluxo operacional ainda depende de fechamento assistido.',
      ),
      FonteColetaStatus(
        id: 'inep-qedu',
        label: 'INEP / QEdu',
        status: qeduDisponivel || inepDisponivel ? 'automatico' : 'manual',
        descricao: qeduDisponivel
            ? 'Aprendizagem e IDEB carregados automaticamente por base oficial.'
            : inepDisponivel
            ? 'Censo escolar carregado automaticamente pela base interna.'
            : 'Indicadores educacionais ainda sem automacao suficiente.',
      ),
      FonteColetaStatus(
        id: 'pdde-fnde',
        label: 'PDDE / FNDE',
        status: pddeDisponivel
            ? 'automatico'
            : sistemasPublicos
            ? 'estimado'
            : 'manual',
        descricao: pddeDisponivel
            ? 'PDDE consolidado automaticamente para o municipio.'
            : sistemasPublicos
            ? 'Ha evidencia publica, mas sem consolidacao monetaria completa.'
            : 'PDDE ainda sem consolidacao automatica neste recorte.',
      ),
    ];
  }

  IbgeMunicipioPerfil? _buildIbgePerfilFromPayload(
    Map<String, dynamic> payload,
  ) {
    final demografia =
        payload['demografia'] as Map<String, dynamic>? ?? const {};
    final fiscal = payload['fiscal'] as Map<String, dynamic>? ?? const {};
    final dirigidoBase =
        payload['relatorio_dirigido_base'] as Map<String, dynamic>? ?? const {};
    final ibgePerfil =
        dirigidoBase['perfilIBGE'] as Map<String, dynamic>? ?? const {};
    final perfil = IbgeMunicipioPerfil(
      populacaoEstimada:
          _readNullableInt(demografia['populacao']) ??
          _readNullableInt(ibgePerfil['populacaoEstimada']),
      populacaoEstimadaAnoReferencia: _readNullableString(
        demografia['populacao_ano_referencia'],
      ),
      idhm: _readNullableDouble(demografia['idh']),
      idhmAnoReferencia: _readNullableString(demografia['idh_ano_referencia']),
      receitasBrutasRealizadas: _readNullableDouble(fiscal['receita_total']),
      pibPerCapita: _readNullableDouble(fiscal['pib_per_capita']),
      areaTerritorial: _readNullableDouble(ibgePerfil['areaTerritorial']),
      mortalidadeInfantil: _readNullableDouble(
        ibgePerfil['mortalidadeInfantil'],
      ),
      escolarizacao614: _readNullableDouble(ibgePerfil['escolarizacao614']),
    );
    return perfil.hasAny ? perfil : null;
  }

  Future<IbgeMunicipioPerfil?> _fetchIbgePerfil(
    String municipio,
    String uf,
  ) async {
    final slug = _slugifyMunicipio(municipio);
    if (slug.isEmpty || uf.trim().length != 2) return null;
    final url = Uri.parse(
      'https://www.ibge.gov.br/cidades-e-estados/${uf.trim().toLowerCase()}/$slug.html',
    );

    try {
      final response = await http
          .get(url, headers: {'User-Agent': 'Mozilla/5.0'})
          .timeout(const Duration(seconds: 12));
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return null;
      }

      final indicators = _extractIbgeIndicators(response.body);

      final area = _findIbgeIndicator(indicators, ['area territorial']);
      final ultimoCenso = _findIbgeIndicator(indicators, [
        'populacao no ultimo censo',
      ]);
      final densidade = _findIbgeIndicator(indicators, [
        'densidade demografica',
      ]);
      final estimada = _findIbgeIndicator(indicators, ['populacao estimada']);
      final escolarizacao = _findIbgeIndicator(indicators, [
        'escolarizacao',
        '6 a 14 anos',
      ]);
      final idhm = _findIbgeIndicator(indicators, ['idhm']);
      final mortalidade = _findIbgeIndicator(indicators, [
        'mortalidade infantil',
      ]);
      final receitas = _findIbgeIndicator(indicators, [
        'total de receitas brutas realizadas',
      ]);
      final despesas = _findIbgeIndicator(indicators, [
        'total de despesas brutas empenhadas',
      ]);
      final pib = _findIbgeIndicator(indicators, ['pib per capita']);

      final perfil = IbgeMunicipioPerfil(
        areaTerritorial: _parseBrazilianDouble(area?.value),
        areaAnoReferencia: area?.year,
        populacaoUltimoCenso: _parseBrazilianInt(ultimoCenso?.value),
        populacaoUltimoCensoAnoReferencia: ultimoCenso?.year,
        densidadeDemografica: _parseBrazilianDouble(densidade?.value),
        densidadeAnoReferencia: densidade?.year,
        populacaoEstimada: _parseBrazilianInt(estimada?.value),
        populacaoEstimadaAnoReferencia: estimada?.year,
        escolarizacao614: _parseBrazilianDouble(escolarizacao?.value),
        escolarizacaoAnoReferencia: escolarizacao?.year,
        idhm: _parseBrazilianDouble(idhm?.value),
        idhmAnoReferencia: idhm?.year,
        mortalidadeInfantil: _parseBrazilianDouble(mortalidade?.value),
        mortalidadeAnoReferencia: mortalidade?.year,
        receitasBrutasRealizadas: _parseBrazilianDouble(receitas?.value),
        receitasAnoReferencia: receitas?.year,
        despesasBrutasEmpenhadas: _parseBrazilianDouble(despesas?.value),
        despesasAnoReferencia: despesas?.year,
        pibPerCapita: _parseBrazilianDouble(pib?.value),
        pibAnoReferencia: pib?.year,
      );
      return perfil.hasAny ? perfil : null;
    } catch (_) {
      return null;
    }
  }

  _IbgeIndicator? _findIbgeIndicator(
    Map<String, _IbgeIndicator> indicators,
    List<String> fragments,
  ) {
    for (final entry in indicators.entries) {
      final label = entry.key.toLowerCase();
      if (fragments.every((fragment) => label.contains(fragment))) {
        return entry.value;
      }
    }
    return null;
  }

  Map<String, _IbgeIndicator> _extractIbgeIndicators(String html) {
    final regex = RegExp(
      r"<div class='ind-label'>[\s\S]*?<p>(.*?)<\/p><\/div><p class='ind-value'>(.*?)(?:<span class='indicador-unidade'>(.*?)<\/span>)?<small>[\s\S]*?\[(.*?)\]<\/small>",
      caseSensitive: false,
    );
    final result = <String, _IbgeIndicator>{};
    for (final match in regex.allMatches(html)) {
      final label = _normalizeAscii(_decodeHtml(match.group(1)));
      if (label.isEmpty) continue;
      result[label] = _IbgeIndicator(
        value: _decodeHtml(match.group(2)),
        unit: _decodeHtml(match.group(3)),
        year: _decodeHtml(match.group(4)),
      );
    }
    return result;
  }

  void _assertConfigured() {
    if (!remoteEnabled) {
      throw const ApiException('SYNC_API_BASE_URL nao configurada.');
    }
  }

  DashboardOverview _mapDashboard(Map<String, dynamic> json) {
    final year = _readInt(json['year']);
    final kpis = json['kpis'] as Map<String, dynamic>? ?? const {};
    final grossRevenue = _readDouble(kpis['grossRevenueYtd']);
    final profit = _readDouble(kpis['profitBaseYtd']);
    final implementationCoverage = _safeRatio(
      _readDouble(kpis['citiesInImplementation']),
      _readDouble(kpis['citiesWorked']),
    );
    final municipalities =
        (json['municipalities'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .toList();
    municipalities.sort(
      (a, b) => _readDouble(
        b['estimatedAnnualRevenue'],
      ).compareTo(_readDouble(a['estimatedAnnualRevenue'])),
    );
    final stages = (json['pipelineByStage'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();

    return DashboardOverview(
      year: year,
      projectedGrossRevenue: grossRevenue,
      projectedProfit: profit,
      projectedMargin: _safeRatio(profit, grossRevenue),
      implementationCoverage: implementationCoverage,
      kpis: [
        KpiMetric(
          label: 'Cidades trabalhadas',
          value: '${_readInt(kpis['citiesWorked'])}',
          helper: 'municipios trabalhados no ano',
          icon: Icons.location_city_outlined,
          color: SyncPalette.statusInfo,
        ),
        KpiMetric(
          label: 'Cidades fidelizadas',
          value: '${_readInt(kpis['citiesFidelized'])}',
          helper: 'base recorrente ativa',
          icon: Icons.trending_up_rounded,
          color: SyncPalette.statusActive,
        ),
        KpiMetric(
          label: 'Lucro base YTD',
          value: _formatCompactCurrency(profit),
          helper: 'resultado acumulado',
          icon: Icons.payments_outlined,
          color: SyncPalette.statusWarning,
        ),
        KpiMetric(
          label: 'Comissao prevista',
          value: _formatCompactCurrency(
            _readDouble(kpis['commissionForecastYtd']),
          ),
          helper: 'previsao de comissao',
          icon: Icons.monetization_on_outlined,
          color: SyncPalette.statusPurple,
        ),
        KpiMetric(
          label: 'Proximo ciclo',
          value: _formatCompactCurrency(_readDouble(kpis['nextYearForecast'])),
          helper: 'pipeline projetado',
          icon: Icons.arrow_outward_rounded,
          color: SyncPalette.accentHover,
        ),
      ],
      monthlyTrend: (json['monthlyTrend'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(
            (item) => MonthlyPoint(
              label: _readInt(item['month']).toString().padLeft(2, '0'),
              revenue: _readDouble(item['revenue']),
              profit: _readDouble(item['profit']),
              commission: _readDouble(item['commission']),
            ),
          )
          .toList(),
      alerts: (json['alerts'] as List<dynamic>? ?? const [])
          .map(
            (item) => AlertMessage(
              text: item.toString(),
              color: SyncPalette.statusWarning,
            ),
          )
          .toList(),
      portfolioMix: stages.take(4).map((item) {
        final stage = (item['stage'] ?? '').toString();
        return PortfolioSlice(
          label: _stageLabel(stage),
          value: _readInt(item['count']),
          color: _stageColor(stage),
        );
      }).toList(),
      topMunicipalities: municipalities.take(4).map((item) {
        return MunicipalityProjection(
          name: (item['municipalityName'] ?? '').toString(),
          state: (item['state'] ?? '').toString(),
          stage: _stageLabel((item['stage'] ?? '').toString()),
          projectedRevenue: _readDouble(item['estimatedAnnualRevenue']),
          projectedProfit: _readDouble(item['estimatedAnnualProfit']),
          probability: _readDouble(item['probability']),
          collaboratorName: (item['collaboratorName'] ?? '--').toString(),
        );
      }).toList(),
    );
  }

  CollaboratorSummary _mapCollaboratorSummary(Map<String, dynamic> json) {
    final metrics = json['metrics'] as Map<String, dynamic>? ?? const {};
    return CollaboratorSummary(
      id: (json['id'] ?? '').toString(),
      fullName: (json['fullName'] ?? '').toString(),
      role: (json['primaryRole'] ?? '').toString(),
      type: _collaboratorTypeLabel((json['collaboratorType'] ?? '').toString()),
      state: (json['state'] ?? '--').toString(),
      status: _collaboratorStatusLabel(
        (json['partnershipStatus'] ?? '').toString(),
      ),
      cities: _readInt(metrics['municipalitiesCount']),
      fidelized: _readInt(metrics['fidelizedCount']),
      profitYtd: _readDouble(metrics['profitYtd']),
      commissionYtd: _readDouble(metrics['commissionForecastYtd']),
    );
  }

  AuditEntry _mapAuditEntry(Map<String, dynamic> json) {
    return AuditEntry(
      action: (json['action'] ?? '').toString(),
      createdAt: _formatDateTime((json['createdAt'] ?? '').toString()),
    );
  }

  ModuleDefinition _mapModuleDefinition(Map<String, dynamic> json) {
    final key = (json['key'] ?? '').toString();
    return ModuleDefinition(
      key: key,
      label: (json['label'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      color: _moduleColor((json['color'] ?? '').toString()),
      icon: _moduleIcon(key),
      mappedFlows: const [],
    );
  }

  WorkspaceSettings _mapWorkspaceSettings(Map<String, dynamic> json) {
    final rawSettings = json['settings'];
    return WorkspaceSettings(
      id: (json['id'] ?? '').toString(),
      groupName: (json['name'] ?? '').toString(),
      slug: (json['slug'] ?? '').toString(),
      rawSettings: rawSettings is Map<String, dynamic>
          ? rawSettings
          : const <String, dynamic>{},
    );
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

  double _safeRatio(double numerator, double denominator) {
    if (denominator <= 0) return 0;
    return numerator / denominator;
  }

  String _formatCompactCurrency(double value) {
    if (value.abs() >= 1000000) {
      return 'R\$ ${(value / 1000000).toStringAsFixed(1).replaceAll('.', ',')} mi';
    }
    if (value.abs() >= 1000) {
      return 'R\$ ${(value / 1000).toStringAsFixed(0)} mil';
    }
    return 'R\$ ${value.toStringAsFixed(0)}';
  }

  String _formatDateTime(String value) {
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    final local = parsed.toLocal();
    final date =
        '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year}';
    final time =
        '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
    return '$date $time';
  }

  String _stageLabel(String stage) {
    switch (stage) {
      case 'mapping':
        return 'Mapeamento';
      case 'first_contact':
        return 'Primeiro contato';
      case 'institutional_validation':
        return 'Validacao institucional';
      case 'technical_diagnosis':
        return 'Diagnostico tecnico';
      case 'proposal_presented':
        return 'Proposta apresentada';
      case 'negotiation':
        return 'Negociacao';
      case 'verbally_approved':
        return 'Aprovado verbalmente';
      case 'contractual':
        return 'Contratual';
      case 'implementation':
        return 'Implantacao';
      case 'assisted_operation':
        return 'Operacao assistida';
      case 'fidelized':
        return 'Fidelizado';
      case 'paused':
        return 'Pausado';
      case 'lost':
        return 'Perdido';
      default:
        return stage.isEmpty ? '--' : stage;
    }
  }

  Color _stageColor(String stage) {
    switch (stage) {
      case 'fidelized':
        return SyncPalette.statusActive;
      case 'implementation':
      case 'assisted_operation':
        return SyncPalette.statusInfo;
      case 'negotiation':
      case 'proposal_presented':
        return SyncPalette.statusWarning;
      default:
        return SyncPalette.accentHover;
    }
  }

  String _collaboratorStatusLabel(String status) {
    switch (status) {
      case 'active':
        return 'Ativo';
      case 'prospect':
        return 'Prospeccao';
      case 'paused':
        return 'Pausado';
      case 'blocked':
        return 'Bloqueado';
      case 'inactive':
        return 'Inativo';
      default:
        return status.isEmpty ? '--' : status;
    }
  }

  String _collaboratorTypeLabel(String type) {
    switch (type) {
      case 'internal_consultant':
        return 'Consultor interno';
      case 'external_partner':
        return 'Parceiro externo';
      case 'municipal_articulator':
        return 'Articulador municipal';
      case 'introducer':
        return 'Introducer';
      case 'strategic_advisor':
        return 'Conselheiro estrategico';
      case 'implementation_support':
        return 'Suporte de implantacao';
      case 'executive_sponsor':
        return 'Sponsor executivo';
      case 'hybrid':
        return 'Hibrido';
      default:
        return type.isEmpty ? '--' : type;
    }
  }

  Color _moduleColor(String token) {
    switch (token) {
      case 'var(--sync-status-info)':
        return SyncPalette.statusInfo;
      case 'var(--sync-status-active)':
        return SyncPalette.statusActive;
      case 'var(--sync-status-warning)':
        return SyncPalette.statusWarning;
      case 'var(--sync-status-purple)':
        return SyncPalette.statusPurple;
      case 'var(--sync-accent-hover)':
        return SyncPalette.accentHover;
      case 'var(--sync-text-secondary)':
        return SyncPalette.textSecondary;
      default:
        return SyncPalette.accent;
    }
  }

  IconData _moduleIcon(String key) {
    switch (key) {
      case 'consultoria':
        return Icons.work_outline_rounded;
      case 'fundeb':
        return Icons.school_outlined;
      case 'levantamento-fundeb':
        return Icons.description_outlined;
      case 'levantamento-lite-fundeb':
        return Icons.insert_chart_outlined_rounded;
      case 'contrato-fundeb':
        return Icons.assignment_outlined;
      case 'terceirizacao':
        return Icons.handshake_outlined;
      case 'formacao':
        return Icons.cast_for_education_outlined;
      case 'atas-registro-preco':
        return Icons.receipt_long_outlined;
      case 'tecnologia':
        return Icons.memory_outlined;
      case 'case-de-sucesso':
        return Icons.emoji_events_outlined;
      case 'kit-documental':
        return Icons.folder_special_rounded;
      case 'propostas':
        return Icons.request_quote_outlined;
      default:
        return Icons.widgets_outlined;
    }
  }

  String? _readNullableString(dynamic value) {
    if (value == null) return null;
    final normalized = value.toString().trim();
    return normalized.isEmpty ? null : normalized;
  }

  int? _readNullableInt(dynamic value) {
    final number = _readNullableDouble(value);
    return number?.round();
  }

  double? _readNullableDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return _parseBrazilianDouble(value.toString());
  }

  String _slugifyMunicipio(String value) {
    return _normalizeAscii(value)
        .replaceAll(RegExp(r"['`]"), '')
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
        .replaceAll(RegExp(r'^-+|-+$'), '');
  }

  String _normalizeAscii(String? value) {
    var normalized = _decodeHtml(value)
        .toLowerCase()
        .replaceAll(RegExp(r'<[^>]+>'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    const replacements = <String, String>{
      'á': 'a',
      'à': 'a',
      'ã': 'a',
      'â': 'a',
      'ä': 'a',
      'é': 'e',
      'ê': 'e',
      'è': 'e',
      'í': 'i',
      'ì': 'i',
      'î': 'i',
      'ó': 'o',
      'ô': 'o',
      'õ': 'o',
      'ò': 'o',
      'ú': 'u',
      'ù': 'u',
      'û': 'u',
      'ü': 'u',
      'ç': 'c',
    };
    for (final entry in replacements.entries) {
      normalized = normalized.replaceAll(entry.key, entry.value);
    }
    return normalized;
  }

  String _decodeHtml(String? value) {
    if (value == null) return '';
    return value
        .replaceAll(RegExp(r'<[^>]+>'), ' ')
        .replaceAll('&ccedil;', 'ç')
        .replaceAll('&atilde;', 'ã')
        .replaceAll('&aacute;', 'á')
        .replaceAll('&acirc;', 'â')
        .replaceAll('&eacute;', 'é')
        .replaceAll('&ecirc;', 'ê')
        .replaceAll('&iacute;', 'í')
        .replaceAll('&oacute;', 'ó')
        .replaceAll('&ocirc;', 'ô')
        .replaceAll('&otilde;', 'õ')
        .replaceAll('&uacute;', 'ú')
        .replaceAll('&uuml;', 'ü')
        .replaceAll('&sup2;', '²')
        .replaceAll('&nbsp;', ' ')
        .replaceAll(RegExp(r'&[^;]+;'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  double? _parseBrazilianDouble(String? value) {
    if (value == null) return null;
    final normalized = value
        .replaceAll('.', '')
        .replaceAll(',', '.')
        .replaceAll(RegExp(r'[^\d\.\-]'), '')
        .trim();
    if (normalized.isEmpty) return null;
    return double.tryParse(normalized);
  }

  int? _parseBrazilianInt(String? value) {
    final parsed = _parseBrazilianDouble(value);
    return parsed?.round();
  }

  @override
  Future<Map<String, dynamic>> obterDadosContratoFundeb(
    Map<String, dynamic> body,
  ) async {
    _assertConfigured();
    // Usa o agente completo: IBGE → TSE → IA (OpenRouter/Qwen) → CNPJ → Computed
    // Timeout longo (120s) pois o agente IA pode levar ~60s
    return _apiClient.post(
      '/api/contratos-fundeb/agent',
      body: body,
      timeout: const Duration(seconds: 120),
    );
  }

  @override
  Future<Uint8List> gerarKitContratosFundeb(Map<String, dynamic> data) async {
    _assertConfigured();
    return _apiClient.postBytes(
      '/api/modulos/contrato-fundeb/gerar-kit',
      body: data,
      timeout: const Duration(seconds: 120),
    );
  }

  @override
  Future<Uint8List> gerarPropostaDocx(Map<String, dynamic> data) async {
    _assertConfigured();
    return _apiClient.postBytes(
      '/api/modulos/contrato-fundeb/gerar-proposta',
      body: data,
      timeout: const Duration(seconds: 60),
    );
  }

  @override
  Future<Uint8List> gerarKitContratosFundebComAnexos(
    Map<String, dynamic> data,
    Map<String, List<({String nome, Uint8List bytes})>> anexos,
  ) async {
    _assertConfigured();

    // Se não há anexos, usar a rota JSON simples
    final totalAnexos = anexos.values.fold<int>(0, (s, l) => s + l.length);
    if (totalAnexos == 0) {
      return gerarKitContratosFundeb(data);
    }

    // Montar multipart request
    final uri = Uri.parse(
      '${_apiClient.apiBaseUrl}/api/modulos/contrato-fundeb/gerar-kit-completo',
    );
    final request = http.MultipartRequest('POST', uri);

    // Adicionar headers de autenticação
    final headers = await _apiClient.getAuthHeaders();
    request.headers.addAll(headers);

    // Campo JSON com os dados do contrato
    request.fields['contrato'] = jsonEncode(data);

    // Anexar cada arquivo sob sua categoria
    for (final entry in anexos.entries) {
      final categoria = entry.key;
      for (final arquivo in entry.value) {
        request.files.add(
          http.MultipartFile.fromBytes(
            categoria,
            arquivo.bytes,
            filename: arquivo.nome,
          ),
        );
      }
    }

    // Enviar com timeout generoso
    final streamedResponse = await request.send().timeout(
      const Duration(seconds: 180),
    );

    if (streamedResponse.statusCode != 200) {
      final body = await streamedResponse.stream.bytesToString();
      throw Exception(
        'Erro ao gerar kit completo: ${streamedResponse.statusCode} - $body',
      );
    }

    final bytes = await streamedResponse.stream.toBytes();
    return Uint8List.fromList(bytes);
  }

  // ── Slides module ──

  @override
  Future<List<SlideTemplate>> getSlideTemplates() async {
    _assertConfigured();
    try {
      final list = await _apiClient.getList('/api/modulos/slides');
      return list
          .whereType<Map<String, dynamic>>()
          .map(SlideTemplate.fromJson)
          .toList();
    } catch (_) {
      // Fallback to built-in templates when API is unavailable
      return defaultSlideTemplates;
    }
  }

  @override
  Future<Uint8List> generateSlidesPdf(
    String templateId, {
    String? codigoIbge,
  }) async {
    _assertConfigured();
    return _apiClient.postBytes(
      '/api/modulos/slides/gerar',
      body: {
        'templateId': templateId,
        if (codigoIbge != null) 'codigoIbge': codigoIbge,
      },
      timeout: const Duration(seconds: 180),
    );
  }
}

class _IbgeIndicator {
  const _IbgeIndicator({
    required this.value,
    required this.unit,
    required this.year,
  });

  final String value;
  final String unit;
  final String year;
}
