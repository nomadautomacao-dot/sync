import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:printing/printing.dart';

import '../application/slides_institucional_pdf_builder.dart';

import '../../../core/models/slide_models.dart';
import '../../../core/models/sync_models.dart';
import '../../../core/models/levantamento_fundeb_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/theme/app_theme.dart';
import '../../shared/presentation/shared_widgets.dart';

class SlidesScreen extends StatefulWidget {
  const SlidesScreen({
    super.key,
    required this.repository,
    required this.module,
    required this.onBack,
  });

  final SyncRepository repository;
  final ModuleDefinition module;
  final VoidCallback onBack;

  @override
  State<SlidesScreen> createState() => _SlidesScreenState();
}

enum _SlidesStep { gallery, configure, generating, done }

class _SlidesScreenState extends State<SlidesScreen> {
  late Future<List<SlideTemplate>> _templatesFuture;

  _SlidesStep _step = _SlidesStep.gallery;
  SlideTemplate? _selectedTemplate;

  // Municipality search
  final _searchController = TextEditingController();
  List<MunicipioSearchItem> _searchResults = [];
  MunicipioSearchItem? _selectedMunicipio;
  bool _searching = false;

  // Generation
  Uint8List? _generatedPdf;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _templatesFuture = widget.repository.getSlideTemplates();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _searchMunicipios(String query) async {
    if (query.trim().length < 3) {
      setState(() => _searchResults = []);
      return;
    }
    setState(() => _searching = true);
    try {
      final results = await widget.repository.searchMunicipios(query.trim());
      if (mounted) setState(() => _searchResults = results);
    } catch (_) {
      // Swallow — search is best-effort
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  void _selectTemplate(SlideTemplate template) {
    setState(() {
      _selectedTemplate = template;
      _step = template.requiresMunicipio
          ? _SlidesStep.configure
          : _SlidesStep.generating;
    });
    if (!template.requiresMunicipio) {
      _generatePdf();
    }
  }

  Future<void> _generatePdf() async {
    setState(() {
      _step = _SlidesStep.generating;
      _errorMessage = null;
    });

    try {
      Uint8List pdf;

      // For 'institucional', generate locally (no backend needed)
      if (_selectedTemplate!.id == 'institucional') {
        pdf = await SlidesInstitucionalPdfBuilder.build();
      } else {
        pdf = await widget.repository.generateSlidesPdf(
          _selectedTemplate!.id,
          codigoIbge: _selectedMunicipio?.codigoIbge,
        );
      }

      if (mounted) {
        setState(() {
          _generatedPdf = pdf;
          _step = _SlidesStep.done;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Falha ao gerar apresentacao: $e';
          _step = _selectedTemplate!.requiresMunicipio
              ? _SlidesStep.configure
              : _SlidesStep.gallery;
        });
      }
    }
  }

  void _reset() {
    setState(() {
      _step = _SlidesStep.gallery;
      _selectedTemplate = null;
      _selectedMunicipio = null;
      _searchResults = [];
      _searchController.clear();
      _generatedPdf = null;
      _errorMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return switch (_step) {
      _SlidesStep.gallery => _buildGallery(),
      _SlidesStep.configure => _buildConfigure(),
      _SlidesStep.generating => _buildGenerating(),
      _SlidesStep.done => _buildDone(),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Step 1: Template Gallery
  // ─────────────────────────────────────────────────────────────
  Widget _buildGallery() {
    return FutureBuilder<List<SlideTemplate>>(
      future: _templatesFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const _SlidesLoadingSkeleton();
        }

        final templates = snapshot.data ?? defaultSlideTemplates;

        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 48),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              _SlidesHeader(
                title: 'Slides',
                subtitle: 'Escolha um modelo para gerar sua apresentacao.',
                onBack: widget.onBack,
              ),

              const SizedBox(height: 32),

              // Templates grid
              LayoutBuilder(
                builder: (context, constraints) {
                  final crossCount = constraints.maxWidth > 800 ? 3 : constraints.maxWidth > 500 ? 2 : 1;
                  final tileWidth = (constraints.maxWidth - (crossCount - 1) * 16) / crossCount;

                  return Wrap(
                    spacing: 16,
                    runSpacing: 16,
                    children: templates.map((t) => SizedBox(
                      width: tileWidth,
                      child: _TemplateCard(
                        template: t,
                        onTap: () => _selectTemplate(t),
                      ),
                    )).toList(),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Step 2: Configure (municipality search)
  // ─────────────────────────────────────────────────────────────
  Widget _buildConfigure() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 48),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SlidesHeader(
            title: _selectedTemplate?.label ?? 'Configurar',
            subtitle: 'Informe o municipio para preencher os dados automaticamente.',
            onBack: () => setState(() => _step = _SlidesStep.gallery),
          ),

          const SizedBox(height: 24),

          // Selected template badge
          if (_selectedTemplate != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _selectedTemplate!.color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      _selectedTemplate!.icon,
                      size: 20,
                      color: _selectedTemplate!.color,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _selectedTemplate!.label,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: SaaSTokens.textTitle,
                          ),
                        ),
                        Text(
                          '${_selectedTemplate!.slideCount} slides',
                          style: const TextStyle(
                            fontSize: 12,
                            color: SaaSTokens.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

          // Error message
          if (_errorMessage != null)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: SaaSTokens.error.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: SaaSTokens.error.withValues(alpha: 0.15)),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline, size: 18, color: SaaSTokens.error),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(fontSize: 13, color: SaaSTokens.error),
                    ),
                  ),
                ],
              ),
            ),

          // Search field
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: SyncSurfaceCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Municipio',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: SaaSTokens.textTitle,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _searchController,
                    onChanged: _searchMunicipios,
                    decoration: InputDecoration(
                      hintText: 'Buscar por nome ou codigo IBGE...',
                      prefixIcon: _searching
                          ? const Padding(
                              padding: EdgeInsets.all(14),
                              child: SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            )
                          : const Icon(LucideIcons.search, size: 18),
                      suffixIcon: _selectedMunicipio != null
                          ? IconButton(
                              icon: const Icon(Icons.close, size: 18),
                              onPressed: () {
                                setState(() {
                                  _selectedMunicipio = null;
                                  _searchController.clear();
                                  _searchResults = [];
                                });
                              },
                            )
                          : null,
                    ),
                  ),

                  // Search results
                  if (_searchResults.isNotEmpty && _selectedMunicipio == null)
                    Container(
                      margin: const EdgeInsets.only(top: 8),
                      constraints: const BoxConstraints(maxHeight: 200),
                      decoration: BoxDecoration(
                        color: SaaSTokens.scaffold,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: SaaSTokens.borderLight),
                      ),
                      child: ListView.separated(
                        shrinkWrap: true,
                        padding: EdgeInsets.zero,
                        itemCount: _searchResults.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (_, i) {
                          final m = _searchResults[i];
                          return ListTile(
                            dense: true,
                            title: Text(
                              '${m.nome} / ${m.uf}',
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            subtitle: Text(
                              'IBGE: ${m.codigoIbge}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            trailing: const Icon(
                              Icons.chevron_right,
                              size: 18,
                              color: SaaSTokens.textDim,
                            ),
                            onTap: () {
                              setState(() {
                                _selectedMunicipio = m;
                                _searchController.text = '${m.nome} / ${m.uf}';
                                _searchResults = [];
                              });
                            },
                          );
                        },
                      ),
                    ),

                  // Selected municipality confirmation
                  if (_selectedMunicipio != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: SaaSTokens.success.withValues(alpha: 0.06),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: SaaSTokens.success.withValues(alpha: 0.2),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            LucideIcons.circleCheckBig,
                            size: 18,
                            color: SaaSTokens.success,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${_selectedMunicipio!.nome} / ${_selectedMunicipio!.uf}',
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: SaaSTokens.textTitle,
                                  ),
                                ),
                                Text(
                                  'Codigo IBGE: ${_selectedMunicipio!.codigoIbge}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: SaaSTokens.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _generatePdf,
                        icon: const Icon(LucideIcons.sparkles, size: 18),
                        label: const Text('Gerar Apresentacao'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Step 3: Generating (loading state)
  // ─────────────────────────────────────────────────────────────
  Widget _buildGenerating() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Animated icon
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.0, end: 1.0),
            duration: const Duration(milliseconds: 800),
            curve: Curves.easeOutQuart,
            builder: (context, value, child) {
              return Opacity(
                opacity: value,
                child: Transform.translate(
                  offset: Offset(0, 20 * (1 - value)),
                  child: child,
                ),
              );
            },
            child: Container(
              width: 80,
              height: 80,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: (_selectedTemplate?.color ?? SaaSTokens.primary)
                    .withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(20),
              ),
              child: SizedBox(
                width: 32,
                height: 32,
                child: CircularProgressIndicator(
                  strokeWidth: 3,
                  color: _selectedTemplate?.color ?? SaaSTokens.primary,
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'Gerando apresentacao...',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: SaaSTokens.textTitle,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _selectedMunicipio != null
                ? 'Coletando dados de ${_selectedMunicipio!.nome}/${_selectedMunicipio!.uf}'
                : 'Montando slides do template',
            style: const TextStyle(
              fontSize: 14,
              color: SaaSTokens.textMuted,
            ),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Step 4: Done (success with actions)
  // ─────────────────────────────────────────────────────────────
  Widget _buildDone() {
    final hasBytes = _generatedPdf != null && _generatedPdf!.isNotEmpty;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 48),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SlidesHeader(
            title: 'Apresentacao gerada',
            subtitle: hasBytes
                ? 'Seu PDF esta pronto para download.'
                : 'O backend ainda nao retornou conteudo (endpoint em construcao).',
            onBack: _reset,
            backLabel: 'Nova apresentacao',
          ),

          const SizedBox(height: 32),

          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: SyncSurfaceCard(
                child: Column(
                  children: [
                    // Success icon
                    Container(
                      width: 64,
                      height: 64,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: SaaSTokens.success.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(
                        hasBytes ? LucideIcons.circleCheckBig : LucideIcons.construction,
                        size: 28,
                        color: hasBytes ? SaaSTokens.success : SaaSTokens.warning,
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      _selectedTemplate?.label ?? 'Apresentacao',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: SaaSTokens.textTitle,
                        letterSpacing: -0.3,
                      ),
                    ),
                    if (_selectedMunicipio != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        '${_selectedMunicipio!.nome} / ${_selectedMunicipio!.uf}',
                        style: const TextStyle(
                          fontSize: 14,
                          color: SaaSTokens.textMuted,
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Text(
                      hasBytes
                          ? '${(_generatedPdf!.length / 1024).toStringAsFixed(0)} KB  •  ${_selectedTemplate?.slideCount ?? 0} slides'
                          : 'Aguardando implementacao do gerador no backend.',
                      style: const TextStyle(
                        fontSize: 13,
                        color: SaaSTokens.textDim,
                      ),
                    ),

                    const SizedBox(height: 28),

                    // Actions
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _reset,
                            icon: const Icon(LucideIcons.plus, size: 16),
                            label: const Text('Nova'),
                          ),
                        ),
                        if (hasBytes) ...[
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: () async {
                                final name = _selectedTemplate?.id ?? 'slides';
                                final filename = 'rocha-prime-$name.pdf';
                                await Printing.sharePdf(
                                  bytes: _generatedPdf!,
                                  filename: filename,
                                );
                              },
                              icon: const Icon(LucideIcons.download, size: 16),
                              label: const Text('Baixar PDF'),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Slides header with back button
// ─────────────────────────────────────────────────────────────
class _SlidesHeader extends StatelessWidget {
  const _SlidesHeader({
    required this.title,
    required this.subtitle,
    required this.onBack,
    this.backLabel = 'Voltar',
  });

  final String title;
  final String subtitle;
  final VoidCallback onBack;
  final String backLabel;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextButton.icon(
          onPressed: onBack,
          icon: const Icon(LucideIcons.arrowLeft, size: 16),
          label: Text(backLabel),
          style: TextButton.styleFrom(
            foregroundColor: SaaSTokens.textMuted,
            padding: EdgeInsets.zero,
            minimumSize: const Size(0, 36),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: SaaSTokens.textTitle,
            letterSpacing: -0.6,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          subtitle,
          style: const TextStyle(
            fontSize: 14,
            color: SaaSTokens.textMuted,
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Template card — featured tile for the gallery
// ─────────────────────────────────────────────────────────────
class _TemplateCard extends StatefulWidget {
  const _TemplateCard({
    required this.template,
    required this.onTap,
  });

  final SlideTemplate template;
  final VoidCallback onTap;

  @override
  State<_TemplateCard> createState() => _TemplateCardState();
}

class _TemplateCardState extends State<_TemplateCard> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final c = widget.template.color;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutQuart,
          decoration: BoxDecoration(
            color: SaaSTokens.cardWhite,
            border: Border.all(
              color: _hovered ? c.withValues(alpha: 0.4) : SaaSTokens.borderLight,
              width: _hovered ? 1.5 : 1,
            ),
            borderRadius: BorderRadius.circular(12),
            boxShadow: _hovered
                ? [BoxShadow(color: c.withValues(alpha: 0.08), blurRadius: 20, offset: const Offset(0, 6))]
                : [],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Preview area (simulated slide aspect ratio 16:9)
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Container(
                  decoration: BoxDecoration(
                    color: c.withValues(alpha: 0.04),
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
                  ),
                  child: Center(
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: _hovered ? 56 : 48,
                      height: _hovered ? 56 : 48,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: c.withValues(alpha: _hovered ? 0.15 : 0.1),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        widget.template.icon,
                        size: _hovered ? 28 : 24,
                        color: c,
                      ),
                    ),
                  ),
                ),
              ),

              // Content
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.template.label,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: SaaSTokens.textTitle,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      widget.template.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        color: SaaSTokens.textMuted,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Footer row
                    Row(
                      children: [
                        // Slide count
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: SaaSTokens.scaffold,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '${widget.template.slideCount} slides',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: SaaSTokens.textDim,
                            ),
                          ),
                        ),
                        if (widget.template.requiresMunicipio) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: c.withValues(alpha: 0.06),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(LucideIcons.mapPin, size: 11, color: c),
                                const SizedBox(width: 4),
                                Text(
                                  'Dados do municipio',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                    color: c,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        const Spacer(),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: _hovered ? c.withValues(alpha: 0.1) : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            Icons.arrow_forward_rounded,
                            size: 16,
                            color: _hovered ? c : SaaSTokens.textDim,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────
class _SlidesLoadingSkeleton extends StatelessWidget {
  const _SlidesLoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SyncShimmer(width: 60, height: 14),
          const SizedBox(height: 12),
          const SyncShimmer(width: 140, height: 24),
          const SizedBox(height: 8),
          const SyncShimmer(width: 280, height: 14),
          const SizedBox(height: 32),
          LayoutBuilder(
            builder: (context, constraints) {
              final crossCount = constraints.maxWidth > 800 ? 3 : constraints.maxWidth > 500 ? 2 : 1;
              final tileW = (constraints.maxWidth - (crossCount - 1) * 16) / crossCount;
              return Wrap(
                spacing: 16,
                runSpacing: 16,
                children: List.generate(3, (_) => SizedBox(
                  width: tileW,
                  child: const SyncSkeletonCard(lines: 3),
                )),
              );
            },
          ),
        ],
      ),
    );
  }
}
