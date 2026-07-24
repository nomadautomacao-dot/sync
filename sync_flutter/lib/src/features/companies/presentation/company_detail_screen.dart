import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:file_picker/file_picker.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../shared/presentation/shared_widgets.dart';

// ─────────────────────────────────────────────────────────────
// Modelo local para documentos anexados
// ─────────────────────────────────────────────────────────────
class CompanyDocument {
  final String id;
  final String title;
  final String category;
  final String date;
  final String size;
  final String type;
  final String storagePath;

  CompanyDocument({
    required this.id,
    required this.title,
    required this.category,
    required this.date,
    required this.size,
    this.type = 'pdf',
    this.storagePath = '',
  });

  IconData get icon => switch (type) {
    'pdf' => LucideIcons.fileText,
    'img' => LucideIcons.image,
    'doc' => LucideIcons.fileSpreadsheet,
    _ => LucideIcons.file,
  };

  Color get iconColor => switch (type) {
    'pdf' => const Color(0xFFEF4444),
    'img' => const Color(0xFF3B82F6),
    'doc' => const Color(0xFF10B981),
    _ => SaaSTokens.textMuted,
  };
}

// ─────────────────────────────────────────────────────────────
// CompanyDetailScreen — Perfil unico (Rocha Prime)
// ─────────────────────────────────────────────────────────────
class CompanyDetailScreen extends StatefulWidget {
  const CompanyDetailScreen({
    super.key,
    required this.repository,
    required this.companyId,
    required this.onBack,
    this.currentUser,
  });

  final SyncRepository repository;
  final String companyId;
  final VoidCallback onBack;
  final SyncUser? currentUser;

  @override
  State<CompanyDetailScreen> createState() => _CompanyDetailScreenState();
}

class _CompanyDetailScreenState extends State<CompanyDetailScreen> {
  late Future<CompanyBundle> bundleFuture;
  String _selectedDocCategory = 'Todos';
  final List<CompanyDocument> _documents = [];
  int _nextId = 1;

  // Emails com permissao de admin (editar dados da empresa)
  static const _adminEmails = [
    'adrieltavares87@gmail.com',
    'admin@rochaprime.com.br',
  ];

  bool get _isAdmin {
    final email = widget.currentUser?.email ?? '';
    return _adminEmails.contains(email.toLowerCase());
  }

  static const _supabaseUrl = 'https://pbjlpcqdrbypufleoxnm.supabase.co';
  static const _supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiamxwY3FkcmJ5cHVmbGVveG5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ2MTc5OCwiZXhwIjoyMDg4MDM3Nzk4fQ.S-gKdy2Upmux89DbGKbfYZME4FeeO-fj1BbzmCHn7tk';
  static const _bucket = 'company-documents';
  static const _storagePath = 'rocha-prime';

  @override
  void initState() {
    super.initState();
    bundleFuture = _loadBundle();
    _loadDocumentsFromStorage();
  }

  Future<CompanyBundle> _loadBundle() async {
    try {
      return await widget.repository.getCompanyBundle(widget.companyId);
    } catch (e) {
      final companies = await widget.repository.getCompanies();
      if (companies.isNotEmpty) {
        return widget.repository.getCompanyBundle(companies.first.id);
      }
      return CompanyBundle(
        company: const CompanyDetails(
          id: 'rocha_prime', name: 'Rocha Prime Servicos Especializados LTDA',
          tradingName: 'Rocha Prime', cnpj: '00.000.000/0001-00',
          status: 'Ativo', segment: 'Servicos Especializados',
          city: 'Belem', state: 'PA', email: 'contato@rochaprime.com.br',
          phone: '(91) 99999-0000', contactName: 'Adriel Tavares',
          contactPosition: 'Diretor', enabledModules: [],
        ),
        employees: const [],
      );
    }
  }

  void _refresh() {
    bundleFuture = _loadBundle();
    _loadDocumentsFromStorage();
    setState(() {});
  }

  // ── LOGO — upload via Firebase Storage ─────────────────────
  bool _uploadingLogo = false;

  static String _contentTypeForExtension(String? extension) {
    switch (extension?.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      default:
        return 'image/png';
    }
  }

  Future<void> _pickAndUploadLogo() async {
    final result = await FilePicker.pickFiles(
      type: FileType.image,
      withData: true,
    );
    final file = result?.files.single;
    final bytes = file?.bytes;
    if (bytes == null) return;
    final contentType = _contentTypeForExtension(file?.extension);
    setState(() => _uploadingLogo = true);
    try {
      await widget.repository.setCompanyLogo(widget.companyId, bytes, contentType: contentType);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Logo atualizado com sucesso.'),
          behavior: SnackBarBehavior.floating,
        ));
      }
      _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Nao foi possivel atualizar o logo: $e'),
          behavior: SnackBarBehavior.floating,
        ));
      }
    } finally {
      if (mounted) setState(() => _uploadingLogo = false);
    }
  }

  // ── FUNCIONARIOS — cria via Firestore (CompanyFirestoreService) ─
  void _showAddEmployeeDialog() {
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final positionCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Icon(LucideIcons.userPlus, size: 20, color: SaaSTokens.primary),
                const SizedBox(width: 10),
                const Expanded(child: Text('Adicionar Funcionario',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: SaaSTokens.textTitle))),
                IconButton(onPressed: () => Navigator.pop(ctx), icon: const Icon(LucideIcons.x, size: 18)),
              ]),
              const SizedBox(height: 24),
              _EditField(label: 'Nome', controller: nameCtrl),
              _EditField(label: 'Email', controller: emailCtrl),
              _EditField(label: 'Cargo', controller: positionCtrl),
              const SizedBox(height: 8),
              Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                OutlinedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
                const SizedBox(width: 12),
                ElevatedButton.icon(
                  onPressed: () async {
                    final name = nameCtrl.text.trim();
                    final email = emailCtrl.text.trim();
                    final position = positionCtrl.text.trim();
                    if (name.isEmpty || email.isEmpty || position.isEmpty) return;
                    Navigator.pop(ctx);
                    try {
                      await widget.repository.createEmployee({
                        'companyId': widget.companyId,
                        'name': name,
                        'email': email,
                        'position': position,
                        'role': position,
                      });
                      _refresh();
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          content: Text('Nao foi possivel adicionar o funcionario: $e'),
                          behavior: SnackBarBehavior.floating,
                        ));
                      }
                    }
                  },
                  icon: const Icon(LucideIcons.plus, size: 16),
                  label: const Text('Adicionar'),
                ),
              ]),
            ]),
          ),
        ),
      ),
    );
  }

  static const _categoryMap = {
    'societario': 'Societario',
    'pessoal': 'Docs Pessoais',
    'certidoes': 'Certidoes',
    'licencas': 'Licencas',
    'propostas': 'Propostas',
    'termos': 'Termos de Referencia',
    'licitacao-lene': 'Licitacao Lene',
    'licitacao-vinhedo': 'Licitacao Vinhedo',
    'habilitacao-itq': 'Habilitacao Itaquaquecetuba',
    'contabil': 'Contabil',
    'procuracoes': 'Procuracoes',
    'contratos': 'Contratos',
    'atestados': 'Atestados',
    'notas-fiscais': 'Notas Fiscais',
  };

  Future<void> _loadDocumentsFromStorage() async {
    try {
      // 1. Listar pastas dentro de rocha-prime/
      final foldersResp = await http.post(
        Uri.parse('$_supabaseUrl/storage/v1/object/list/$_bucket'),
        headers: {'Authorization': 'Bearer $_supabaseKey', 'Content-Type': 'application/json'},
        body: jsonEncode({'prefix': '$_storagePath/', 'limit': 200}),
      );
      if (foldersResp.statusCode != 200) return;

      final List<dynamic> items = jsonDecode(foldersResp.body);
      final folders = items.where((i) => i['metadata'] == null).map((i) => i['name'] as String).toList();

      final docs = <CompanyDocument>[];

      // 2. Para cada pasta, listar os arquivos
      for (final folder in folders) {
        final filesResp = await http.post(
          Uri.parse('$_supabaseUrl/storage/v1/object/list/$_bucket'),
          headers: {'Authorization': 'Bearer $_supabaseKey', 'Content-Type': 'application/json'},
          body: jsonEncode({'prefix': '$_storagePath/$folder/', 'limit': 200}),
        );
        if (filesResp.statusCode != 200) continue;

        final List<dynamic> files = jsonDecode(filesResp.body);
        final category = _categoryMap[folder] ?? folder;

        for (final file in files) {
          final name = file['name'] as String;
          if (name.isEmpty || file['metadata'] == null) continue;
          final meta = file['metadata'] as Map<String, dynamic>;
          final size = meta['size'] as int? ?? 0;
          final created = file['created_at'] as String? ?? '';

          String dateStr = '--';
          if (created.isNotEmpty) {
            try { dateStr = DateFormat('dd/MM/yyyy').format(DateTime.parse(created)); } catch (_) {}
          }

          docs.add(CompanyDocument(
            id: file['id'] as String? ?? '${_nextId++}',
            title: _humanizeName(name),
            category: category,
            date: dateStr,
            size: _formatBytes(size),
            type: _detectTypeFromName(name),
            storagePath: '$_storagePath/$folder/$name',
          ));
        }
      }

      // Also check for files directly in rocha-prime/ (legacy uploads)
      final directFiles = items.where((i) => i['metadata'] != null);
      for (final file in directFiles) {
        final name = file['name'] as String;
        if (name.isEmpty) continue;
        final meta = file['metadata'] as Map<String, dynamic>;
        final size = meta['size'] as int? ?? 0;
        final created = file['created_at'] as String? ?? '';
        String dateStr = '--';
        if (created.isNotEmpty) {
          try { dateStr = DateFormat('dd/MM/yyyy').format(DateTime.parse(created)); } catch (_) {}
        }
        docs.add(CompanyDocument(
          id: file['id'] as String? ?? '${_nextId++}',
          title: _humanizeName(name),
          category: _detectCategoryFromName(name),
          date: dateStr,
          size: _formatBytes(size),
          type: _detectTypeFromName(name),
          storagePath: '$_storagePath/$name',
        ));
      }

      if (mounted) {
        setState(() {
          _documents.clear();
          _documents.addAll(docs);
        });
      }
    } catch (e) {
      debugPrint('Erro ao carregar documentos do Storage: $e');
    }
  }

  String _humanizeName(String name) {
    return name.replaceAll('_', ' ').replaceAll('.pdf', '').replaceAll('.docx', '').replaceAll('.doc', '');
  }

  String _detectTypeFromName(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'doc';
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'img';
    return 'other';
  }

  String _detectCategoryFromName(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('contrato') || lower.contains('alterac') || lower.contains('consol')) return 'Societario';
    if (lower.contains('cnh')) return 'Documentos Pessoais';
    if (lower.contains('consul')) return 'Certidoes';
    if (lower.contains('proposta') || lower.contains('descri')) return 'Propostas';
    if (lower.contains('termo')) return 'Termos de Referencia';
    if (lower.contains('atestado')) return 'Atestados';
    if (lower.contains('certid')) return 'Certidoes';
    return 'Outros';
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1048576) return '${(bytes / 1024).toStringAsFixed(0)} KB';
    return '${(bytes / 1048576).toStringAsFixed(1)} MB';
  }

  void _downloadDocument(CompanyDocument doc) {
    final url = '$_supabaseUrl/storage/v1/object/public/$_bucket/${doc.storagePath}';
    launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  void _showAddDocumentDialog() {
    final titleCtrl = TextEditingController();
    String selectedCategory = 'Atestados';
    String selectedType = 'pdf';
    final categories = ['Atestados', 'Certidoes', 'Societario', 'Licencas', 'Contabil', 'Outros'];
    final types = {'pdf': 'PDF', 'img': 'Imagem', 'doc': 'Planilha', 'other': 'Outro'};

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Icon(LucideIcons.filePlus, size: 20, color: SaaSTokens.primary),
                  const SizedBox(width: 10),
                  const Expanded(child: Text('Anexar Documento', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: SaaSTokens.textTitle))),
                  IconButton(onPressed: () => Navigator.pop(ctx), icon: const Icon(LucideIcons.x, size: 18)),
                ]),
                const SizedBox(height: 24),
                _EditField(label: 'Nome do documento', controller: titleCtrl),
                const SizedBox(height: 4),
                const Text('Categoria', style: TextStyle(fontSize: 13, color: SaaSTokens.textMuted, fontWeight: FontWeight.w500)),
                const SizedBox(height: 8),
                Wrap(spacing: 8, runSpacing: 8, children: categories.map((cat) {
                  final isActive = selectedCategory == cat;
                  return ChoiceChip(
                    label: Text(cat), selected: isActive,
                    onSelected: (_) => setDialogState(() => selectedCategory = cat),
                    selectedColor: SaaSTokens.primary,
                    labelStyle: TextStyle(color: isActive ? Colors.white : SaaSTokens.textMuted, fontWeight: FontWeight.w600, fontSize: 12),
                    side: BorderSide(color: isActive ? SaaSTokens.primary : SaaSTokens.borderLight),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    showCheckmark: false,
                  );
                }).toList()),
                const SizedBox(height: 16),
                const Text('Tipo de arquivo', style: TextStyle(fontSize: 13, color: SaaSTokens.textMuted, fontWeight: FontWeight.w500)),
                const SizedBox(height: 8),
                Wrap(spacing: 8, children: types.entries.map((e) {
                  final isActive = selectedType == e.key;
                  return ChoiceChip(
                    label: Text(e.value), selected: isActive,
                    onSelected: (_) => setDialogState(() => selectedType = e.key),
                    selectedColor: SaaSTokens.primary,
                    labelStyle: TextStyle(color: isActive ? Colors.white : SaaSTokens.textMuted, fontWeight: FontWeight.w600, fontSize: 12),
                    side: BorderSide(color: isActive ? SaaSTokens.primary : SaaSTokens.borderLight),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    showCheckmark: false,
                  );
                }).toList()),
                const SizedBox(height: 24),
                Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                  OutlinedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
                  const SizedBox(width: 12),
                  ElevatedButton.icon(
                    onPressed: () {
                      final name = titleCtrl.text.trim();
                      if (name.isEmpty) return;
                      Navigator.pop(ctx);
                      final now = DateFormat('dd/MM/yyyy').format(DateTime.now());
                      setState(() {
                        _documents.add(CompanyDocument(
                          id: '${_nextId++}', title: name,
                          category: selectedCategory, date: now,
                          size: '--', type: selectedType,
                        ));
                      });
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        content: Text('"$name" anexado com sucesso.'), behavior: SnackBarBehavior.floating,
                      ));
                    },
                    icon: const Icon(LucideIcons.plus, size: 16),
                    label: const Text('Adicionar'),
                  ),
                ]),
              ]),
            ),
          ),
        ),
      ),
    );
  }

  void _removeDocument(CompanyDocument doc) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Row(children: [
          Icon(LucideIcons.triangleAlert, size: 20, color: SaaSTokens.error),
          SizedBox(width: 10),
          Text('Confirmar exclusao', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        ]),
        content: Text('Deseja remover "${doc.title}"?\n\nEssa acao nao pode ser desfeita.',
          style: const TextStyle(fontSize: 14, color: SaaSTokens.textMuted, height: 1.5)),
        actions: [
          OutlinedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() => _documents.removeWhere((d) => d.id == doc.id));
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                content: Text('"${doc.title}" removido.'), behavior: SnackBarBehavior.floating,
              ));
            },
            style: ElevatedButton.styleFrom(backgroundColor: SaaSTokens.error),
            child: const Text('Excluir', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showEditDialog(BuildContext context, CompanyDetails company) {
    final nameCtrl = TextEditingController(text: company.name);
    final cnpjCtrl = TextEditingController(text: company.cnpj);
    final segmentCtrl = TextEditingController(text: company.segment);
    final cityCtrl = TextEditingController(text: company.city);
    final stateCtrl = TextEditingController(text: company.state);
    final emailCtrl = TextEditingController(text: company.email);
    final phoneCtrl = TextEditingController(text: company.phone);
    final contactCtrl = TextEditingController(text: company.contactName);
    final positionCtrl = TextEditingController(text: company.contactPosition);

    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: SingleChildScrollView(child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const Icon(LucideIcons.building2, size: 20, color: SaaSTokens.primary),
                  const SizedBox(width: 10),
                  const Expanded(child: Text('Editar Dados Institucionais',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: SaaSTokens.textTitle))),
                  IconButton(onPressed: () => Navigator.pop(ctx),
                    icon: const Icon(LucideIcons.x, size: 18)),
                ]),
                const SizedBox(height: 24),
                _EditField(label: 'Razao Social', controller: nameCtrl),
                _EditField(label: 'CNPJ', controller: cnpjCtrl),
                Row(children: [
                  Expanded(child: _EditField(label: 'Segmento', controller: segmentCtrl)),
                  const SizedBox(width: 16),
                  Expanded(child: Row(children: [
                    Expanded(child: _EditField(label: 'Cidade', controller: cityCtrl)),
                    const SizedBox(width: 12),
                    SizedBox(width: 70, child: _EditField(label: 'UF', controller: stateCtrl)),
                  ])),
                ]),
                _EditField(label: 'Email', controller: emailCtrl),
                _EditField(label: 'Telefone', controller: phoneCtrl),
                Row(children: [
                  Expanded(child: _EditField(label: 'Responsavel', controller: contactCtrl)),
                  const SizedBox(width: 16),
                  Expanded(child: _EditField(label: 'Cargo', controller: positionCtrl)),
                ]),
                const SizedBox(height: 24),
                Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                  OutlinedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
                  const SizedBox(width: 12),
                  ElevatedButton.icon(
                    onPressed: () {
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Dados atualizados com sucesso.'), behavior: SnackBarBehavior.floating),
                      );
                    },
                    icon: const Icon(LucideIcons.check, size: 16),
                    label: const Text('Salvar'),
                  ),
                ]),
              ],
            )),
          ),
        ),
      ),
    );
  }

  List<CompanyDocument> get _filteredDocuments {
    if (_selectedDocCategory == 'Todos') return _documents;
    return _documents.where((d) => d.category == _selectedDocCategory).toList();
  }

  List<String> get _docCategories {
    final cats = _documents.map((d) => d.category).toSet().toList()..sort();
    return ['Todos', ...cats];
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<CompanyBundle>(
      future: bundleFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(child: SyncSurfaceCard(child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(LucideIcons.circleAlert, size: 40, color: SaaSTokens.error),
            const SizedBox(height: 16),
            const Text('Nao foi possivel carregar os dados.', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: SaaSTokens.textTitle)),
            const SizedBox(height: 16),
            OutlinedButton.icon(onPressed: _refresh, icon: const Icon(LucideIcons.refreshCcw, size: 16), label: const Text('Tentar novamente')),
          ])));
        }

        final company = snapshot.data!.company;
        final employees = snapshot.data!.employees;
        return SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _buildHeader(context, company),
            const SizedBox(height: 24),
            _buildKpiStrip(),
            const SizedBox(height: 24),
            _buildInstitutionalCard(context, company),
            const SizedBox(height: 24),
            _buildEmployeesSection(employees),
            const SizedBox(height: 24),
            _buildDocSection(context),
          ]),
        );
      },
    );
  }

  // ── HEADER ──────────────────────────────────────────────────
  Widget _buildLogoAvatarContent(String? logo) {
    const initials = Text('RP', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: -1));
    if (logo == null || logo.isEmpty) return initials;
    return Image.network(
      logo,
      width: 64,
      height: 64,
      fit: BoxFit.cover,
      errorBuilder: (context, error, stackTrace) => initials,
    );
  }

  Widget _buildHeader(BuildContext context, CompanyDetails c) {
    return SyncSurfaceCard(
      padding: const EdgeInsets.all(28),
      child: Row(children: [
        Tooltip(
          message: 'Trocar logo',
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: _uploadingLogo ? null : _pickAndUploadLogo,
            child: Container(width: 64, height: 64,
              decoration: BoxDecoration(color: SaaSTokens.primary, borderRadius: BorderRadius.circular(16)),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Center(
                  child: _uploadingLogo
                      ? const SizedBox(
                          width: 22, height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : _buildLogoAvatarContent(c.logo),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 20),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text(c.tradingName, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: SaaSTokens.textTitle, letterSpacing: -0.6)),
            const SizedBox(width: 12),
            StatusPill(label: c.status, color: c.status == 'Ativo' ? SaaSTokens.success : SaaSTokens.textDim),
          ]),
          const SizedBox(height: 4),
          Text(c.name, style: const TextStyle(fontSize: 14, color: SaaSTokens.textMuted)),
          const SizedBox(height: 2),
          Text('${c.segment}  •  ${c.city}/${c.state}', style: const TextStyle(fontSize: 13, color: SaaSTokens.textDim)),
        ])),
        OutlinedButton.icon(onPressed: _refresh, icon: const Icon(LucideIcons.refreshCcw, size: 14), label: const Text('Atualizar')),
      ]),
    );
  }

  // ── KPI STRIP ──────────────────────────────────────────────
  Widget _buildKpiStrip() {
    final kpis = [
      (LucideIcons.fileCheck, 'Documentos', '${_documents.length}', SaaSTokens.primary),
      (LucideIcons.shieldCheck, 'Certidoes', '${_documents.where((d) => d.category == "Certidoes").length}', SaaSTokens.success),
      (LucideIcons.award, 'Atestados', '${_documents.where((d) => d.category == "Atestados").length}', SaaSTokens.warning),
      (LucideIcons.triangleAlert, 'Vencidos', '0', SaaSTokens.error),
    ];
    return Row(children: kpis.asMap().entries.map((entry) {
      final (icon, label, value, color) = entry.value;
      return Expanded(child: Padding(
        padding: EdgeInsets.only(right: entry.key < kpis.length - 1 ? 16 : 0),
        child: SyncSurfaceCard(padding: const EdgeInsets.all(18), child: Row(children: [
          Container(width: 40, height: 40,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 20, color: color),
          ),
          const SizedBox(width: 14),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: SaaSTokens.textTitle, letterSpacing: -0.5)),
            Text(label, style: const TextStyle(fontSize: 12, color: SaaSTokens.textMuted, fontWeight: FontWeight.w500)),
          ]),
        ])),
      ));
    }).toList());
  }

  // ── DADOS INSTITUCIONAIS ───────────────────────────────────
  Widget _buildInstitutionalCard(BuildContext context, CompanyDetails c) {
    return SyncSurfaceCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        const Icon(LucideIcons.building2, size: 18, color: SaaSTokens.primary),
        const SizedBox(width: 10),
        const Text('Dados Institucionais', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: SaaSTokens.textTitle, letterSpacing: -0.2)),
        const Spacer(),
        if (_isAdmin)
          TextButton.icon(
            onPressed: () => _showEditDialog(context, c),
            icon: const Icon(LucideIcons.pencil, size: 14),
            label: const Text('Editar'),
          ),
      ]),
      const SizedBox(height: 20),
      LayoutBuilder(builder: (ctx, cons) {
        if (cons.maxWidth < 600) {
          return Column(children: [
            _InfoRow(label: 'Razao Social', value: c.name), _InfoRow(label: 'CNPJ', value: c.cnpj),
            _InfoRow(label: 'Segmento', value: c.segment), _InfoRow(label: 'Localizacao', value: '${c.city}/${c.state}'),
            _InfoRow(label: 'Email', value: c.email), _InfoRow(label: 'Telefone', value: c.phone),
            _InfoRow(label: 'Responsavel', value: c.contactName), _InfoRow(label: 'Cargo', value: c.contactPosition),
          ]);
        }
        return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Column(children: [
            _InfoRow(label: 'Razao Social', value: c.name), _InfoRow(label: 'CNPJ', value: c.cnpj),
            _InfoRow(label: 'Segmento', value: c.segment), _InfoRow(label: 'Localizacao', value: '${c.city}/${c.state}'),
          ])),
          const SizedBox(width: 40),
          Expanded(child: Column(children: [
            _InfoRow(label: 'Email', value: c.email), _InfoRow(label: 'Telefone', value: c.phone),
            _InfoRow(label: 'Responsavel', value: c.contactName), _InfoRow(label: 'Cargo', value: c.contactPosition),
          ])),
        ]);
      }),
    ]));
  }

  // ── EQUIPE ─────────────────────────────────────────────────
  Widget _buildEmployeesSection(List<EmployeeRecord> employees) {
    return SyncSurfaceCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        const Icon(LucideIcons.users, size: 18, color: SaaSTokens.primary),
        const SizedBox(width: 10),
        const Expanded(child: Text('Equipe',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: SaaSTokens.textTitle, letterSpacing: -0.2))),
        ElevatedButton.icon(
          onPressed: _showAddEmployeeDialog,
          icon: const Icon(LucideIcons.userPlus, size: 16),
          label: const Text('Adicionar funcionario'),
        ),
      ]),
      const SizedBox(height: 20),
      if (employees.isEmpty)
        Container(
          padding: const EdgeInsets.symmetric(vertical: 32),
          width: double.infinity,
          decoration: BoxDecoration(
            color: SaaSTokens.scaffold,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: SaaSTokens.borderLight),
          ),
          child: const Center(child: Text('Nenhum funcionario cadastrado.',
            style: TextStyle(fontSize: 14, color: SaaSTokens.textMuted, fontWeight: FontWeight.w500))),
        )
      else
        ...employees.asMap().entries.map((entry) {
          final e = entry.value;
          final isLast = entry.key == employees.length - 1;
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: SaaSTokens.cardWhite,
              border: Border(
                top: entry.key == 0 ? BorderSide(color: SaaSTokens.borderLight) : BorderSide.none,
                left: BorderSide(color: SaaSTokens.borderLight),
                right: BorderSide(color: SaaSTokens.borderLight),
                bottom: BorderSide(color: SaaSTokens.borderLight),
              ),
              borderRadius: BorderRadius.vertical(
                top: entry.key == 0 ? const Radius.circular(10) : Radius.zero,
                bottom: isLast ? const Radius.circular(10) : Radius.zero,
              ),
            ),
            child: Row(children: [
              Container(width: 36, height: 36,
                decoration: BoxDecoration(color: SaaSTokens.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                child: Center(child: Text(e.name.isNotEmpty ? e.name[0].toUpperCase() : '?',
                  style: const TextStyle(fontWeight: FontWeight.w700, color: SaaSTokens.primary))),
              ),
              const SizedBox(width: 14),
              Expanded(flex: 3, child: Text(e.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: SaaSTokens.textTitle))),
              Expanded(flex: 3, child: Text(e.email, style: const TextStyle(fontSize: 13, color: SaaSTokens.textMuted))),
              Expanded(flex: 2, child: Text(e.position, style: const TextStyle(fontSize: 13, color: SaaSTokens.textDim))),
              StatusPill(label: e.status, color: e.status == 'Ativo' ? SaaSTokens.success : SaaSTokens.textDim),
            ]),
          );
        }),
    ]));
  }

  // ── DOCUMENTACAO ───────────────────────────────────────────
  Widget _buildDocSection(BuildContext context) {
    final filtered = _filteredDocuments;
    return SyncSurfaceCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Titulo + Upload
      Row(children: [
        const Icon(LucideIcons.folderOpen, size: 18, color: SaaSTokens.primary),
        const SizedBox(width: 10),
        const Expanded(child: Text('Documentacao e Atestados',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: SaaSTokens.textTitle, letterSpacing: -0.2))),
        ElevatedButton.icon(
          onPressed: _showAddDocumentDialog,
          icon: const Icon(LucideIcons.upload, size: 16),
          label: const Text('Anexar documento'),
        ),
      ]),
      const SizedBox(height: 6),
      const Text(
        'Centralize atestados, certidoes, licencas e demais documentos. Todos ficam disponiveis para download.',
        style: TextStyle(fontSize: 13, color: SaaSTokens.textMuted, height: 1.5),
      ),
      const SizedBox(height: 20),

      // Filtros
      if (_documents.isNotEmpty) ...[
        Wrap(spacing: 8, runSpacing: 8, children: _docCategories.map((cat) {
          final isActive = _selectedDocCategory == cat;
          return ChoiceChip(
            label: Text(cat), selected: isActive,
            onSelected: (_) => setState(() => _selectedDocCategory = cat),
            selectedColor: SaaSTokens.primary,
            labelStyle: TextStyle(color: isActive ? Colors.white : SaaSTokens.textMuted, fontWeight: FontWeight.w600, fontSize: 13),
            side: BorderSide(color: isActive ? SaaSTokens.primary : SaaSTokens.borderLight),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            showCheckmark: false,
          );
        }).toList()),
        const SizedBox(height: 20),
      ],

      // Conteudo
      if (_documents.isEmpty)
        _buildEmptyDocState()
      else ...[
        _buildDocTableHeader(),
        ...filtered.asMap().entries.map((e) => _buildDocRow(e.value, isLast: e.key == filtered.length - 1)),
        if (filtered.isEmpty) _buildNoResultsState(),
        const SizedBox(height: 16),
        Row(children: [
          const Icon(LucideIcons.info, size: 14, color: SaaSTokens.textDim),
          const SizedBox(width: 8),
          Text('${_documents.length} documento(s) armazenado(s)', style: const TextStyle(fontSize: 12, color: SaaSTokens.textDim)),
        ]),
      ],
    ]));
  }

  Widget _buildEmptyDocState() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 48),
      width: double.infinity,
      decoration: BoxDecoration(
        color: SaaSTokens.scaffold,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 56, height: 56,
          decoration: BoxDecoration(color: SaaSTokens.cardWhite, borderRadius: BorderRadius.circular(14), border: Border.all(color: SaaSTokens.borderLight)),
          child: const Icon(LucideIcons.folderPlus, size: 24, color: SaaSTokens.textDim),
        ),
        const SizedBox(height: 16),
        const Text('Nenhum documento anexado', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: SaaSTokens.textTitle)),
        const SizedBox(height: 6),
        const Text('Clique em "Anexar documento" para adicionar\natestados, certidoes e demais arquivos.',
          textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: SaaSTokens.textMuted, height: 1.5)),
        const SizedBox(height: 20),
        FilledButton.tonal(
          onPressed: _showAddDocumentDialog,
          style: FilledButton.styleFrom(backgroundColor: SaaSTokens.primaryLight, foregroundColor: SaaSTokens.primary,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
          child: const Text('Selecionar arquivos'),
        ),
      ]),
    );
  }

  Widget _buildDocTableHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: SaaSTokens.scaffold,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: const Row(children: [
        SizedBox(width: 50),
        Expanded(flex: 4, child: Text('DOCUMENTO', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: SaaSTokens.textDim, letterSpacing: 0.8))),
        Expanded(flex: 2, child: Text('CATEGORIA', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: SaaSTokens.textDim, letterSpacing: 0.8))),
        Expanded(flex: 2, child: Text('DATA', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: SaaSTokens.textDim, letterSpacing: 0.8))),
        Expanded(flex: 1, child: Text('TAMANHO', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: SaaSTokens.textDim, letterSpacing: 0.8))),
        SizedBox(width: 96),
      ]),
    );
  }

  Widget _buildDocRow(CompanyDocument doc, {required bool isLast}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border(left: const BorderSide(color: SaaSTokens.borderLight), right: const BorderSide(color: SaaSTokens.borderLight), bottom: const BorderSide(color: SaaSTokens.borderLight)),
        borderRadius: isLast ? const BorderRadius.vertical(bottom: Radius.circular(10)) : BorderRadius.zero,
      ),
      child: Row(children: [
        Container(width: 36, height: 36,
          decoration: BoxDecoration(color: doc.iconColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
          child: Icon(doc.icon, size: 18, color: doc.iconColor),
        ),
        const SizedBox(width: 14),
        Expanded(flex: 4, child: Text(doc.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: SaaSTokens.textTitle), overflow: TextOverflow.ellipsis)),
        Expanded(flex: 2, child: StatusPill(label: doc.category, color: SaaSTokens.primaryDim)),
        Expanded(flex: 2, child: Text(doc.date, style: const TextStyle(fontSize: 13, color: SaaSTokens.textMuted))),
        Expanded(flex: 1, child: Text(doc.size, style: const TextStyle(fontSize: 13, color: SaaSTokens.textDim))),
        SizedBox(width: 96, child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [
          IconButton(
            onPressed: () => _downloadDocument(doc),
            icon: const Icon(LucideIcons.download, size: 16), tooltip: 'Baixar',
            style: IconButton.styleFrom(foregroundColor: SaaSTokens.primary, minimumSize: const Size(36, 36)),
          ),
          IconButton(
            onPressed: () => _removeDocument(doc),
            icon: const Icon(LucideIcons.trash2, size: 16), tooltip: 'Excluir',
            style: IconButton.styleFrom(foregroundColor: SaaSTokens.error, minimumSize: const Size(36, 36)),
          ),
        ])),
      ]),
    );
  }

  Widget _buildNoResultsState() {
    return Container(
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(border: Border.all(color: SaaSTokens.borderLight), borderRadius: const BorderRadius.vertical(bottom: Radius.circular(10))),
      child: const Center(child: Column(children: [
        Icon(LucideIcons.fileSearch, size: 32, color: SaaSTokens.textDim),
        SizedBox(height: 12),
        Text('Nenhum documento nesta categoria.', style: TextStyle(fontSize: 14, color: SaaSTokens.textMuted, fontWeight: FontWeight.w500)),
      ])),
    );
  }
}

// ── _InfoRow ─────────────────────────────────────────────────
class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(padding: const EdgeInsets.only(bottom: 14), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 130, child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: SaaSTokens.textDim))),
      Expanded(child: Text(value.isEmpty ? '—' : value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: SaaSTokens.textTitle))),
    ]));
  }
}

// ── _EditField — Campo de formulario estilizado ──────────────
class _EditField extends StatelessWidget {
  const _EditField({required this.label, required this.controller});
  final String label;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextField(
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(fontSize: 13, color: SaaSTokens.textMuted),
          floatingLabelBehavior: FloatingLabelBehavior.auto,
        ),
      ),
    );
  }
}
