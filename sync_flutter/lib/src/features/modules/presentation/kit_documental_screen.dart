import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_theme.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../shared/presentation/shared_widgets.dart';

/// Kit Documental — Document synthesizer for municipal procurement meetings.
///
/// Pulls real company documents from Supabase Storage and organizes them
/// into actionable categories matching Brazilian public procurement law
/// (Lei 14.133/2021).
class KitDocumentalScreen extends StatefulWidget {
  const KitDocumentalScreen({
    super.key,
    required this.repository,
    required this.module,
    required this.onBack,
  });

  final SyncRepository repository;
  final ModuleDefinition module;
  final VoidCallback onBack;

  @override
  State<KitDocumentalScreen> createState() => _KitDocumentalScreenState();
}

class _KitDocumentalScreenState extends State<KitDocumentalScreen> {
  static const _supabaseUrl = 'https://pbjlpcqdrbypufleoxnm.supabase.co';
  static const _supabaseKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiamxwY3FkcmJ5cHVmbGVveG5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ2MTc5OCwiZXhwIjoyMDg4MDM3Nzk4fQ.S-gKdy2Upmux89DbGKbfYZME4FeeO-fj1BbzmCHn7tk';
  static const _bucket = 'company-documents';
  static const _storagePath = 'rocha-prime';

  bool _isLoading = true;
  String? _error;
  final Map<String, List<_DocItem>> _grouped = {};

  // Key documents for the procurement kit
  static const _kitCategories = <_KitCategory>[
    _KitCategory(
      id: 'objeto',
      title: 'Objeto do Contrato',
      subtitle: 'Termo de Referência com escopo, planilha e especificações',
      icon: Icons.description_outlined,
      color: Color(0xFF3B82F6),
      folders: ['licitacao-lene', 'licitacao-vinhedo', 'termos'],
      keywords: ['TR', 'TERMO_DE_REFERENCIA', 'REFERENCIA', '02.3'],
    ),
    _KitCategory(
      id: 'explanacao',
      title: 'Explanação do Serviço',
      subtitle: 'DFD, ETP e justificativa técnica da necessidade',
      icon: Icons.lightbulb_outline_rounded,
      color: Color(0xFF8B5CF6),
      folders: ['licitacao-lene', 'licitacao-vinhedo'],
      keywords: ['DFD', 'ETP', 'PROCESSO_ADMINISTRATIVO', '02.1', '02.2', '02.4'],
    ),
    _KitCategory(
      id: 'legalidade',
      title: 'Relatório de Legalidade',
      subtitle: 'Parecer jurídico e análise da Comissão de Licitação',
      icon: Icons.gavel_rounded,
      color: Color(0xFFF59E0B),
      folders: ['licitacao-lene', 'licitacao-vinhedo'],
      keywords: ['PARECER', '06_', '07_'],
    ),
    _KitCategory(
      id: 'inexigibilidade',
      title: 'Modelo de Inexigibilidade',
      subtitle: 'Ratificação e homologação (Art. 74, III — Lei 14.133/21)',
      icon: Icons.verified_outlined,
      color: Color(0xFF10B981),
      folders: ['licitacao-lene', 'licitacao-vinhedo'],
      keywords: ['Ratificao', 'Inexigibilidade', 'Homologao', '08_', '09_'],
    ),
    _KitCategory(
      id: 'habilitacao',
      title: 'Documentação Habilitatória',
      subtitle: 'Certidões, atestados, contrato social e regularidade fiscal',
      icon: Icons.folder_copy_outlined,
      color: Color(0xFFEF4444),
      folders: ['certidoes', 'atestados', 'societario', 'licencas', 'contabil'],
      keywords: [],
    ),
  ];

  @override
  void initState() {
    super.initState();
    _loadDocuments();
  }

  Future<void> _loadDocuments() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // List all folders
      final foldersResp = await http.post(
        Uri.parse('$_supabaseUrl/storage/v1/object/list/$_bucket'),
        headers: {
          'Authorization': 'Bearer $_supabaseKey',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'prefix': '$_storagePath/', 'limit': 200}),
      );

      if (foldersResp.statusCode != 200) {
        throw Exception('Erro ao listar pastas: ${foldersResp.statusCode}');
      }

      final List<dynamic> items = jsonDecode(foldersResp.body);
      final folders = items
          .where((i) => i['metadata'] == null)
          .map((i) => i['name'] as String)
          .toList();

      // Add root-level files
      final rootFiles = items.where((i) => i['metadata'] != null);
      final grouped = <String, List<_DocItem>>{};

      for (final file in rootFiles) {
        final name = file['name'] as String;
        if (name.isEmpty) continue;
        final meta = file['metadata'] as Map<String, dynamic>;
        final size = meta['size'] as int? ?? 0;
        grouped.putIfAbsent('raiz', () => []).add(_DocItem(
          name: _humanize(name),
          fileName: name,
          folder: 'raiz',
          storagePath: '$_storagePath/$name',
          size: size,
          mime: meta['mimetype'] as String? ?? '',
        ));
      }

      // List files in each folder
      for (final folder in folders) {
        final filesResp = await http.post(
          Uri.parse('$_supabaseUrl/storage/v1/object/list/$_bucket'),
          headers: {
            'Authorization': 'Bearer $_supabaseKey',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({'prefix': '$_storagePath/$folder/', 'limit': 200}),
        );
        if (filesResp.statusCode != 200) continue;

        final List<dynamic> files = jsonDecode(filesResp.body);
        for (final file in files) {
          final name = file['name'] as String;
          if (name.isEmpty || file['metadata'] == null) continue;
          final meta = file['metadata'] as Map<String, dynamic>;
          final size = meta['size'] as int? ?? 0;
          grouped.putIfAbsent(folder, () => []).add(_DocItem(
            name: _humanize(name),
            fileName: name,
            folder: folder,
            storagePath: '$_storagePath/$folder/$name',
            size: size,
            mime: meta['mimetype'] as String? ?? '',
          ));
        }
      }

      if (mounted) {
        setState(() {
          _grouped.clear();
          _grouped.addAll(grouped);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  List<_DocItem> _getKitDocs(_KitCategory cat) {
    final docs = <_DocItem>[];
    for (final folder in cat.folders) {
      final items = _grouped[folder] ?? [];
      if (cat.keywords.isEmpty) {
        docs.addAll(items);
      } else {
        for (final item in items) {
          final match = cat.keywords.any((kw) =>
              item.fileName.toUpperCase().contains(kw.toUpperCase()));
          if (match) docs.add(item);
        }
      }
    }
    return docs;
  }

  void _openDocument(_DocItem doc) {
    final url = '$_supabaseUrl/storage/v1/object/public/$_bucket/${doc.storagePath}';
    launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SyncSectionHeader(
              title: 'Kit Documental',
              description:
                  'Documentos reais da empresa organizados para contratação municipal.',
              trailing: Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  OutlinedButton(
                    onPressed: widget.onBack,
                    child: const Text('Voltar ao catalogo'),
                  ),
                  FilledButton.icon(
                    onPressed: _isLoading ? null : _loadDocuments,
                    icon: _isLoading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.refresh_rounded),
                    label: Text(_isLoading ? 'Carregando...' : 'Atualizar'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            if (_isLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_error != null)
              SyncSurfaceCard(
                child: Column(
                  children: [
                    const Icon(Icons.error_outline, size: 40, color: Colors.red),
                    const SizedBox(height: 12),
                    Text('Erro ao carregar documentos: $_error'),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: _loadDocuments,
                      child: const Text('Tentar novamente'),
                    ),
                  ],
                ),
              )
            else ...[
              // Kit summary header
              _buildKitHeader(),
              const SizedBox(height: 24),
              // Kit categories
              ..._kitCategories.map((cat) => _buildKitSection(cat)),
              const SizedBox(height: 32),
              // Full document library
              _buildLibraryHeader(),
              const SizedBox(height: 14),
              ..._grouped.entries
                  .where((e) => !['raiz'].contains(e.key))
                  .map((e) => _buildFolderSection(e.key, e.value)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildKitHeader() {
    final totalDocs = _grouped.values.fold<int>(0, (s, l) => s + l.length);
    final totalFolders = _grouped.length;
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1E3A5F)],
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      padding: const EdgeInsets.all(24),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.folder_special_rounded, size: 26, color: Colors.white),
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Acervo Documental — Rocha Prime',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white),
                ),
                const SizedBox(height: 4),
                Text(
                  '$totalDocs documentos em $totalFolders categorias • Pronto para reunião',
                  style: TextStyle(fontSize: 13, color: Colors.white.withValues(alpha: 0.65)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKitSection(_KitCategory cat) {
    final docs = _getKitDocs(cat);
    if (docs.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Container(
        decoration: BoxDecoration(
          color: SaaSTokens.cardWhite,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: SaaSTokens.borderLight),
        ),
        child: Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            tilePadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
            childrenPadding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            initiallyExpanded: true,
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: cat.color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(cat.icon, size: 20, color: cat.color),
            ),
            title: Text(
              cat.title,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 2),
                Text(
                  cat.subtitle,
                  style: TextStyle(fontSize: 12, color: SaaSTokens.textMuted),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: cat.color.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    '${docs.length} documento${docs.length > 1 ? 's' : ''}',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: cat.color),
                  ),
                ),
              ],
            ),
            children: [
              for (final doc in docs)
                _buildDocTile(doc, cat.color),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDocTile(_DocItem doc, Color accent) {
    final ext = doc.fileName.split('.').last.toUpperCase();
    final sizeStr = _formatBytes(doc.size);

    return InkWell(
      onTap: () => _openDocument(doc),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: _extColor(ext).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: Text(
                  ext.length > 4 ? ext.substring(0, 4) : ext,
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: _extColor(ext),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    doc.name,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '$sizeStr • ${doc.folder}',
                    style: TextStyle(fontSize: 11, color: SaaSTokens.textMuted),
                  ),
                ],
              ),
            ),
            Icon(Icons.open_in_new_rounded, size: 16, color: accent.withValues(alpha: 0.5)),
          ],
        ),
      ),
    );
  }

  Widget _buildLibraryHeader() {
    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: const Color(0xFF6366F1).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Icon(Icons.library_books_rounded, size: 17, color: Color(0xFF6366F1)),
        ),
        const SizedBox(width: 12),
        const Text(
          'Biblioteca Completa',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
        ),
      ],
    );
  }

  Widget _buildFolderSection(String folder, List<_DocItem> docs) {
    final label = _folderLabel(folder);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        decoration: BoxDecoration(
          color: SaaSTokens.cardWhite,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: SaaSTokens.borderLight),
        ),
        child: Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            tilePadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
            childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
            initiallyExpanded: false,
            leading: const Icon(Icons.folder_rounded, size: 20, color: Color(0xFF94A3B8)),
            title: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
            ),
            subtitle: Text(
              '${docs.length} arquivo${docs.length > 1 ? 's' : ''}',
              style: TextStyle(fontSize: 11, color: SaaSTokens.textMuted),
            ),
            children: [
              for (final doc in docs)
                _buildDocTile(doc, const Color(0xFF64748B)),
            ],
          ),
        ),
      ),
    );
  }

  // ── Helpers ──

  static String _humanize(String name) {
    return name
        .replaceAll(RegExp(r'\.[^.]+$'), '') // remove extension
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  static String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1048576) return '${(bytes / 1024).toStringAsFixed(0)} KB';
    return '${(bytes / 1048576).toStringAsFixed(1)} MB';
  }

  static Color _extColor(String ext) {
    return switch (ext) {
      'PDF' => const Color(0xFFEF4444),
      'DOC' || 'DOCX' => const Color(0xFF3B82F6),
      'XLS' || 'XLSX' => const Color(0xFF10B981),
      _ => const Color(0xFF94A3B8),
    };
  }

  static String _folderLabel(String folder) {
    const map = {
      'atestados': 'Atestados de Capacidade',
      'certidoes': 'Certidões e Regularidade',
      'contabil': 'Documentos Contábeis',
      'contratos': 'Contratos e Aditivos',
      'habilitacao-itq': 'Habilitação — Itaquaquecetuba',
      'licencas': 'Licenças e Alvarás',
      'licitacao-lene': 'Processo Licitatório — Leme/SP',
      'licitacao-vinhedo': 'Processo Licitatório — Vinhedo/SP',
      'notas-fiscais': 'Notas Fiscais',
      'pessoal': 'Documentos Pessoais',
      'procuracoes': 'Procurações',
      'propostas': 'Propostas Comerciais',
      'societario': 'Documentos Societários',
      'termos': 'Termos de Referência',
    };
    return map[folder] ?? folder;
  }
}

// ── Data Models ──

class _KitCategory {
  const _KitCategory({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.folders,
    required this.keywords,
  });

  final String id;
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final List<String> folders;
  final List<String> keywords;
}

class _DocItem {
  const _DocItem({
    required this.name,
    required this.fileName,
    required this.folder,
    required this.storagePath,
    required this.size,
    required this.mime,
  });

  final String name;
  final String fileName;
  final String folder;
  final String storagePath;
  final int size;
  final String mime;
}
