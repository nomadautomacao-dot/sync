import 'package:flutter/material.dart';

import '../core/network/session_storage.dart';
import '../core/network/sync_api_client.dart';
import '../core/models/sync_models.dart';
import '../core/repositories/hybrid_sync_repository.dart';
import '../core/repositories/local_sync_repository.dart';
import '../core/repositories/remote_sync_repository.dart';
import '../core/repositories/sync_repository.dart';
import '../core/storage/local_workspace_store.dart';
import '../core/theme/app_theme.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/shell/presentation/sync_shell.dart';

class SyncFlutterApp extends StatefulWidget {
  const SyncFlutterApp({super.key});

  @override
  State<SyncFlutterApp> createState() => _SyncFlutterAppState();
}

class _SyncFlutterAppState extends State<SyncFlutterApp> {
  late final AppController controller;
  late final SessionStorage sessionStorage;

  @override
  void initState() {
    super.initState();
    sessionStorage = SessionStorage();
    controller = AppController(
      repository: HybridSyncRepository(
        remote: RemoteSyncRepository(
          apiClient: SyncApiClient(sessionStorage: sessionStorage),
          sessionStorage: sessionStorage,
        ),
        local: LocalSyncRepository(
          sessionStorage: sessionStorage,
          store: LocalWorkspaceStore(),
        ),
      ),
    );
    _bootstrapController();
  }

  Future<void> _bootstrapController() async {
    await sessionStorage.prime();
    await controller.bootstrap();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        return MaterialApp(
          title: 'PrimeOS',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.themeData,
          home: controller.isBootstrapping
              ? const _BootstrapScreen()
              : controller.isAuthenticated
              ? SyncShell(controller: controller)
              : LoginScreen(controller: controller),
        );
      },
    );
  }
}

class AppController extends ChangeNotifier {
  AppController({required SyncRepository repository}) : _repository = repository;

  final SyncRepository _repository;

  bool _isBootstrapping = true;
  bool _isAuthenticated = false;
  AppSection _currentSection = AppSection.dashboard;
  String? _selectedModuleKey;
  String? _selectedCompanyId;
  String _searchHint = 'Buscar no workspace';
  SyncUser? _user;
  String? _errorMessage;

  bool get isBootstrapping => _isBootstrapping;
  bool get isAuthenticated => _isAuthenticated;
  AppSection get currentSection => _currentSection;
  String? get selectedModuleKey => _selectedModuleKey;
  String? get selectedCompanyId => _selectedCompanyId;
  String get searchHint => _searchHint;
  SyncUser? get user => _user;
  String? get errorMessage => _errorMessage;
  SyncRepository get repository => _repository;
  String get apiBaseUrl => _repository.apiBaseUrl;
  bool get usesEnvironmentApi => _repository.usesEnvironmentApi;

  Future<void> bootstrap() async {
    _isBootstrapping = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _user = await _repository.restoreSession();
      _isAuthenticated = _user != null;
    } catch (error) {
      _user = null;
      _isAuthenticated = false;
      _errorMessage = error.toString();
    }
    _isBootstrapping = false;
    notifyListeners();
  }

  Future<bool> signIn(String email, String password) async {
    if (email.trim().isEmpty || password.trim().isEmpty) {
      return false;
    }
    try {
      _errorMessage = null;
      _user = await _repository.signIn(email, password);
      _isAuthenticated = true;
      notifyListeners();
      return true;
    } catch (error) {
      _errorMessage = error.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> updateApiBaseUrl(String value) async {
    await _repository.setApiBaseUrl(value);
    notifyListeners();
  }

  Future<void> signOut() async {
    await _repository.signOut();
    _isAuthenticated = false;
    _user = null;
    _errorMessage = null;
    _currentSection = AppSection.dashboard;
    _selectedModuleKey = null;
    _selectedCompanyId = null;
    _searchHint = 'Buscar no workspace';
    notifyListeners();
  }

  void selectSection(AppSection section) {
    _currentSection = section;
    if (section != AppSection.modules) {
      _selectedModuleKey = null;
    }
    if (section != AppSection.companies) {
      _selectedCompanyId = null;
    }
    _searchHint = switch (section) {
      AppSection.dashboard => 'Buscar indicadores, cidades e lucro',
      AppSection.inbox => 'Buscar eventos recentes',
      AppSection.companies => 'Buscar empresa, CNPJ ou segmento',
      AppSection.people => 'Buscar colaborador, cidade ou papel',
      AppSection.pipeline => 'Buscar no plano de ação',
      AppSection.modules => 'Buscar modulo operacional',
      AppSection.settings => 'Buscar configuracao do workspace',
    };
    notifyListeners();
  }

  void selectModule(String key) {
    if (key.isEmpty) {
      _selectedModuleKey = null;
      notifyListeners();
      return;
    }
    _currentSection = AppSection.modules;
    _selectedModuleKey = key;
    notifyListeners();
  }

  void openCompany(String companyId) {
    _currentSection = AppSection.companies;
    _selectedCompanyId = companyId;
    notifyListeners();
  }

  void closeCompany() {
    _selectedCompanyId = null;
    notifyListeners();
  }
}

class _BootstrapScreen extends StatelessWidget {
  const _BootstrapScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}
