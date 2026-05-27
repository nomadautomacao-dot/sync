import 'package:flutter/material.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/theme/app_theme.dart';
import '../../shared/presentation/shared_widgets.dart';
import 'case_sucesso_screen.dart';
import 'contrato_capa_capa_screen.dart';
import 'kit_documental_screen.dart';
import 'levantamento_fundeb_lite_screen.dart';
import 'levantamento_fundeb_screen.dart';

class ModulesScreen extends StatefulWidget {
  const ModulesScreen({
    super.key,
    required this.repository,
    required this.selectedKey,
    required this.onSelectModule,
  });

  final SyncRepository repository;
  final String? selectedKey;
  final ValueChanged<String> onSelectModule;

  @override
  State<ModulesScreen> createState() => _ModulesScreenState();
}

class _ModulesScreenState extends State<ModulesScreen> {
  late Future<List<ModuleDefinition>> future;

  @override
  void initState() {
    super.initState();
    future = widget.repository.getModules();
  }

  // ── Module routing (unchanged logic) ──
  Widget? _routeToSubscreen(List<ModuleDefinition> modules) {
    if (widget.selectedKey == null || widget.selectedKey!.isEmpty) return null;

    final selected = modules.firstWhere(
      (m) => m.key == widget.selectedKey,
      orElse: () => modules.first,
    );

    return switch (selected.key) {
      'levantamento-fundeb' => LevantamentoFundebScreen(
          repository: widget.repository,
          module: selected,
          onBack: () => widget.onSelectModule(''),
        ),
      'levantamento-lite-fundeb' => LevantamentoFundebLiteScreen(
          repository: widget.repository,
          module: selected,
          onBack: () => widget.onSelectModule(''),
        ),
      'contrato-fundeb' => ContratoCapaCapaScreen(
          repository: widget.repository,
          module: selected,
          onBack: () => widget.onSelectModule(''),
        ),
      'case-de-sucesso' => CaseSucessoScreen(
          repository: widget.repository,
          module: selected,
          onBack: () => widget.onSelectModule(''),
        ),
      'kit-documental' => KitDocumentalScreen(
          repository: widget.repository,
          module: selected,
          onBack: () => widget.onSelectModule(''),
        ),
      _ => null,
    };
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<ModuleDefinition>>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const _ModulesLoadingSkeleton();
        }

        if (snapshot.hasError) {
          return _ModulesErrorState(
            onRetry: () => setState(() {
              future = widget.repository.getModules();
            }),
          );
        }

        final modules = snapshot.data!;
        final subscreen = _routeToSubscreen(modules);
        if (subscreen != null) return subscreen;

        return _ModulesCatalog(
          modules: modules,
          onSelect: widget.onSelectModule,
          onRefresh: () => setState(() {
            future = widget.repository.getModules();
          }),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Catalog — The main modules grid, grouped by category
// ─────────────────────────────────────────────────────────────

/// Which modules are considered "core FUNDEB tools"
const _fundebKeys = {
  'levantamento-fundeb',
  'levantamento-lite-fundeb',
  'contrato-fundeb',
  'case-de-sucesso',
  'kit-documental',
  'fundeb',
  'consultoria',
};

/// Modules that have actual working screens
const _implementedKeys = {
  'levantamento-fundeb',
  'levantamento-lite-fundeb',
  'contrato-fundeb',
  'case-de-sucesso',
  'kit-documental',
  'consultoria',
  'fundeb',
  'propostas',
};

class _ModulesCatalog extends StatelessWidget {
  const _ModulesCatalog({
    required this.modules,
    required this.onSelect,
    required this.onRefresh,
  });

  final List<ModuleDefinition> modules;
  final ValueChanged<String> onSelect;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final fundeb = modules.where((m) => _fundebKeys.contains(m.key)).toList();
    final others = modules.where((m) => !_fundebKeys.contains(m.key)).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 48),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ──
          SyncSectionHeader(
            title: 'Modulos',
            description:
                'Ferramentas e extensoes do seu workspace.',
            trailing: IconButton(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh_rounded, size: 20),
              tooltip: 'Atualizar catalogo',
              style: IconButton.styleFrom(
                side: const BorderSide(color: SaaSTokens.borderLight),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ),

          const SizedBox(height: 32),

          // ── FUNDEB section: featured tiles ──
          _SectionLabel(
            label: 'FUNDEB',
            count: fundeb.length,
            accent: const Color(0xFF2F6BFF),
          ),
          const SizedBox(height: 14),
          LayoutBuilder(
            builder: (context, constraints) {
              final crossCount = constraints.maxWidth > 900
                  ? 3
                  : constraints.maxWidth > 560
                      ? 2
                      : 1;
              return Wrap(
                spacing: 14,
                runSpacing: 14,
                children: fundeb.map((m) {
                  final tileWidth =
                      (constraints.maxWidth - (crossCount - 1) * 14) /
                          crossCount;
                  return SizedBox(
                    width: tileWidth,
                    child: _ModuleTile(
                      module: m,
                      implemented: _implementedKeys.contains(m.key),
                      onTap: () => onSelect(m.key),
                    ),
                  );
                }).toList(),
              );
            },
          ),

          if (others.isNotEmpty) ...[
            const SizedBox(height: 36),
            _SectionLabel(
              label: 'Outros modulos',
              count: others.length,
              accent: SaaSTokens.textDim,
            ),
            const SizedBox(height: 14),
            LayoutBuilder(
              builder: (context, constraints) {
                final crossCount = constraints.maxWidth > 900
                    ? 4
                    : constraints.maxWidth > 560
                        ? 3
                        : 2;
                return Wrap(
                  spacing: 14,
                  runSpacing: 14,
                  children: others.map((m) {
                    final tileWidth =
                        (constraints.maxWidth - (crossCount - 1) * 14) /
                            crossCount;
                    return SizedBox(
                      width: tileWidth,
                      child: _ModuleTileCompact(
                        module: m,
                        implemented: _implementedKeys.contains(m.key),
                        onTap: () => onSelect(m.key),
                      ),
                    );
                  }).toList(),
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Section label with count pill
// ─────────────────────────────────────────────────────────────
class _SectionLabel extends StatelessWidget {
  const _SectionLabel({
    required this.label,
    required this.count,
    required this.accent,
  });

  final String label;
  final int count;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 3,
          height: 16,
          decoration: BoxDecoration(
            color: accent,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: SaaSTokens.textDim,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
          decoration: BoxDecoration(
            color: accent.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            '$count',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: accent,
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Featured module tile (FUNDEB group) — larger, more detail
// ─────────────────────────────────────────────────────────────
class _ModuleTile extends StatefulWidget {
  const _ModuleTile({
    required this.module,
    required this.implemented,
    required this.onTap,
  });

  final ModuleDefinition module;
  final bool implemented;
  final VoidCallback onTap;

  @override
  State<_ModuleTile> createState() => _ModuleTileState();
}

class _ModuleTileState extends State<_ModuleTile>
    with SingleTickerProviderStateMixin {
  bool _hovered = false;
  late final AnimationController _controller;
  late final Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 180),
    );
    _scaleAnim = Tween<double>(begin: 1.0, end: 0.98).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutQuart),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.module.color;
    final dim = !widget.implemented;

    return MouseRegion(
      cursor: dim ? SystemMouseCursors.basic : SystemMouseCursors.click,
      onEnter: (_) {
        if (!dim) setState(() => _hovered = true);
      },
      onExit: (_) => setState(() => _hovered = false),
      child: GestureDetector(
        onTapDown: dim ? null : (_) => _controller.forward(),
        onTapUp: dim
            ? null
            : (_) {
                _controller.reverse();
                widget.onTap();
              },
        onTapCancel: dim ? null : () => _controller.reverse(),
        child: ScaleTransition(
          scale: _scaleAnim,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOutQuart,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: _hovered
                  ? SaaSTokens.cardWhite
                  : SaaSTokens.cardWhite,
              border: Border.all(
                color: _hovered
                    ? c.withValues(alpha: 0.35)
                    : SaaSTokens.borderLight,
                width: _hovered ? 1.5 : 1,
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: _hovered
                  ? [
                      BoxShadow(
                        color: c.withValues(alpha: 0.08),
                        blurRadius: 20,
                        offset: const Offset(0, 6),
                      ),
                    ]
                  : [],
            ),
            child: Opacity(
              opacity: dim ? 0.45 : 1.0,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Icon + status row
                  Row(
                    children: [
                      // Tonal icon container
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: 44,
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _hovered
                              ? c.withValues(alpha: 0.18)
                              : c.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          widget.module.icon,
                          size: 22,
                          color: c,
                        ),
                      ),
                      const Spacer(),
                      if (dim)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: SaaSTokens.scaffold,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: SaaSTokens.borderLight,
                            ),
                          ),
                          child: const Text(
                            'Em breve',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: SaaSTokens.textDim,
                            ),
                          ),
                        )
                      else
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: _hovered
                                ? c.withValues(alpha: 0.08)
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            Icons.arrow_forward_rounded,
                            size: 18,
                            color: _hovered
                                ? c
                                : SaaSTokens.textDim,
                          ),
                        ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Title
                  Text(
                    widget.module.label,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: SaaSTokens.textTitle,
                      letterSpacing: -0.2,
                    ),
                  ),

                  const SizedBox(height: 6),

                  // Description
                  Text(
                    widget.module.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      color: SaaSTokens.textMuted,
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Compact module tile (Others group) — smaller, denser
// ─────────────────────────────────────────────────────────────
class _ModuleTileCompact extends StatefulWidget {
  const _ModuleTileCompact({
    required this.module,
    required this.implemented,
    required this.onTap,
  });

  final ModuleDefinition module;
  final bool implemented;
  final VoidCallback onTap;

  @override
  State<_ModuleTileCompact> createState() => _ModuleTileCompactState();
}

class _ModuleTileCompactState extends State<_ModuleTileCompact> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final c = widget.module.color;
    final dim = !widget.implemented;

    return MouseRegion(
      cursor: dim ? SystemMouseCursors.basic : SystemMouseCursors.click,
      onEnter: (_) {
        if (!dim) setState(() => _hovered = true);
      },
      onExit: (_) => setState(() => _hovered = false),
      child: GestureDetector(
        onTap: dim ? null : widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutQuart,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: SaaSTokens.cardWhite,
            border: Border.all(
              color: _hovered
                  ? c.withValues(alpha: 0.3)
                  : SaaSTokens.borderLight,
            ),
            borderRadius: BorderRadius.circular(10),
            boxShadow: _hovered
                ? [
                    BoxShadow(
                      color: c.withValues(alpha: 0.06),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : [],
          ),
          child: Opacity(
            opacity: dim ? 0.4 : 1.0,
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: c.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(widget.module.icon, size: 18, color: c),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.module.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: SaaSTokens.textTitle,
                          letterSpacing: -0.1,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        widget.module.description,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: SaaSTokens.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                if (dim)
                  const Padding(
                    padding: EdgeInsets.only(left: 8),
                    child: Text(
                      'Em breve',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: SaaSTokens.textDim,
                      ),
                    ),
                  )
                else
                  Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: _hovered ? c : SaaSTokens.textDim,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────
class _ModulesLoadingSkeleton extends StatelessWidget {
  const _ModulesLoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SyncShimmer(width: 120, height: 24),
          const SizedBox(height: 8),
          const SyncShimmer(width: 260, height: 14),
          const SizedBox(height: 32),
          const SyncShimmer(width: 80, height: 12),
          const SizedBox(height: 14),
          LayoutBuilder(
            builder: (context, constraints) {
              final crossCount = constraints.maxWidth > 900
                  ? 3
                  : constraints.maxWidth > 560
                      ? 2
                      : 1;
              final tileW =
                  (constraints.maxWidth - (crossCount - 1) * 14) / crossCount;
              return Wrap(
                spacing: 14,
                runSpacing: 14,
                children: List.generate(
                  6,
                  (_) => SizedBox(
                    width: tileW,
                    child: const SyncSkeletonCard(lines: 2),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Error state
// ─────────────────────────────────────────────────────────────
class _ModulesErrorState extends StatelessWidget {
  const _ModulesErrorState({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: EmptyStateWidget(
        icon: Icons.wifi_off_rounded,
        title: 'Falha ao carregar modulos',
        subtitle:
            'Nao foi possivel atualizar o catalogo agora. Verifique sua conexao.',
        actionLabel: 'Tentar novamente',
        onAction: onRetry,
      ),
    );
  }
}
