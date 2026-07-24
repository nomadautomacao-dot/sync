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
import 'slides_screen.dart';

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
      'slides' => SlidesScreen(
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
// Catalog — grade de geradores FUNDEB, agrupada por categoria
// ─────────────────────────────────────────────────────────────

/// Modules hidden from the catalog (not ready for production)
const _hiddenKeys = {
  'consultoria',
  'fundeb',
};

/// Which modules are considered "core FUNDEB tools"
const _fundebKeys = {
  'levantamento-fundeb',
  'levantamento-lite-fundeb',
  'contrato-fundeb',
  'case-de-sucesso',
  'kit-documental',
  'slides',
};

/// Gerador de referencia do fluxo FUNDEB — recebe a etiqueta "principal".
const _primaryGeneratorKey = 'levantamento-fundeb';

/// Modules that have actual working screens
const _implementedKeys = {
  'levantamento-fundeb',
  'levantamento-lite-fundeb',
  'contrato-fundeb',
  'case-de-sucesso',
  'kit-documental',
  'slides',
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
    final visible = modules.where((m) => !_hiddenKeys.contains(m.key)).toList();
    final fundeb = visible.where((m) => _fundebKeys.contains(m.key)).toList();
    final others = visible.where((m) => !_fundebKeys.contains(m.key)).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 48),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Cabecalho: titulo + municipio fixo + acoes ──
          _CatalogHeader(onRefresh: onRefresh),

          const SizedBox(height: 28),

          // ── Geradores FUNDEB ──
          _SectionLabel(
            label: 'Geradores',
            count: fundeb.length,
            accent: SaaSTokens.primary,
          ),
          const SizedBox(height: 14),
          LayoutBuilder(
            builder: (context, constraints) {
              final crossCount = constraints.maxWidth > 900
                  ? 3
                  : constraints.maxWidth > 560
                      ? 2
                      : 1;
              // floor evita que a soma das colunas ultrapasse a largura por
              // fracao de pixel e dispare overflow no Wrap.
              final tileWidth =
                  ((constraints.maxWidth - (crossCount - 1) * 12) / crossCount)
                      .floorToDouble();
              return Wrap(
                spacing: 12,
                runSpacing: 12,
                children: fundeb.map((m) {
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
            const SizedBox(height: 32),
            _SectionLabel(
              label: 'Outros módulos',
              count: others.length,
              accent: SaaSTokens.borderStronger,
            ),
            const SizedBox(height: 14),
            LayoutBuilder(
              builder: (context, constraints) {
                final crossCount = constraints.maxWidth > 900
                    ? 4
                    : constraints.maxWidth > 560
                        ? 3
                        : 2;
                final tileWidth =
                    ((constraints.maxWidth - (crossCount - 1) * 12) / crossCount)
                        .floorToDouble();
                return Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: others.map((m) {
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

          // TODO(redesign): a secao "Execucoes recentes" (municipio / modulo /
          // responsavel / duracao / status) do mockup nao foi construida porque
          // o SyncRepository nao expoe historico de execucoes de geradores —
          // nao ha endpoint nem modelo com duracao, responsavel ou motivo de
          // falha. Reintroduzir a tabela quando esse historico existir.
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Cabecalho do catalogo — titulo, municipio fixo, acoes
// ─────────────────────────────────────────────────────────────
class _CatalogHeader extends StatelessWidget {
  const _CatalogHeader({required this.onRefresh});

  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    const title = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Geradores FUNDEB', style: GsText.pageTitle),
        SizedBox(height: 5),
        Text(
          'Documentos produzidos a partir das bases oficiais do município.',
          style: GsText.body,
        ),
      ],
    );

    final actions = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const _ActiveCityChip(),
        const SizedBox(width: 10),
        // TODO(redesign): o botao primario "Gerar em lote" do mockup nao existe
        // — o repositorio nao expoe uma acao de geracao em lote para varios
        // geradores/municipios de uma vez. Adicionar quando a acao existir.
        _HeaderIconButton(
          icon: Icons.refresh_rounded,
          tooltip: 'Atualizar catalogo',
          onPressed: onRefresh,
        ),
      ],
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 720) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              title,
              const SizedBox(height: 16),
              actions,
            ],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            const Expanded(child: title),
            const SizedBox(width: 20),
            actions,
          ],
        );
      },
    );
  }
}

/// Municipio fixado no cabecalho, para nao reescolher em cada gerador.
class _ActiveCityChip extends StatelessWidget {
  const _ActiveCityChip();

  @override
  Widget build(BuildContext context) {
    // TODO(redesign): o app ainda nao mantem um municipio ativo compartilhado
    // (o AppController guarda apenas secao, modulo e empresa selecionados, e
    // cada gerador faz sua propria busca de municipio). Enquanto nao existir,
    // o chip mostra o estado real em vez de um municipio inventado.
    return Container(
      height: 38,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border.all(color: SaaSTokens.borderLight),
        borderRadius: BorderRadius.circular(SaaSTokens.rControl),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.location_city_rounded,
            size: 17,
            color: SaaSTokens.textDim,
          ),
          SizedBox(width: 8),
          Text(
            'Município definido em cada gerador',
            style: GsText.body,
          ),
        ],
      ),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: SizedBox(
        height: 38,
        width: 38,
        child: IconButton(
          onPressed: onPressed,
          icon: Icon(icon, size: 18),
          padding: EdgeInsets.zero,
          style: IconButton.styleFrom(
            foregroundColor: SaaSTokens.textMuted,
            backgroundColor: SaaSTokens.cardWhite,
            side: const BorderSide(color: SaaSTokens.borderLight),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(SaaSTokens.rControl),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Sobretitulo de secao com contagem em mono
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
          height: 14,
          decoration: BoxDecoration(
            color: accent,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 10),
        Text(label.toUpperCase(), style: GsText.label),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
          decoration: BoxDecoration(
            color: SaaSTokens.surfaceAlt,
            borderRadius: BorderRadius.circular(SaaSTokens.rChip),
          ),
          child: Text(
            '$count',
            style: GsText.dataXs.copyWith(color: SaaSTokens.textMuted),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Etiqueta mono do canto superior direito do card
// ─────────────────────────────────────────────────────────────
class _MonoTag extends StatelessWidget {
  const _MonoTag({
    required this.text,
    required this.foreground,
    required this.background,
  });

  final String text;
  final Color foreground;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(SaaSTokens.rChip),
      ),
      child: Text(
        text,
        style: GsText.dataXsStrong.copyWith(color: foreground),
      ),
    );
  }
}

/// Etiqueta do gerador — so aparece quando ha dado real para mostrar.
///
// TODO(redesign): o mockup mostra contagem de saida ("5 pecas", "15 anexos").
// O ModuleDefinition nao traz quantas pecas/anexos o gerador produz, apenas
// `mappedFlows` (as etapas do fluxo), entao a etiqueta usa esse numero real.
Widget? _generatorTag(ModuleDefinition module) {
  if (module.key == _primaryGeneratorKey) {
    return const _MonoTag(
      text: 'principal',
      foreground: SaaSTokens.primaryHover,
      background: SaaSTokens.primaryLight,
    );
  }
  final flows = module.mappedFlows.length;
  if (flows == 0) return null;
  return _MonoTag(
    text: '$flows ${flows == 1 ? 'etapa' : 'etapas'}',
    foreground: SaaSTokens.textMuted,
    background: SaaSTokens.surfaceAlt,
  );
}

// ─────────────────────────────────────────────────────────────
// Card de gerador (grupo FUNDEB) — diz o que sai e em quantas etapas
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
    final module = widget.module;
    final dim = !widget.implemented;
    final isPrimary = module.key == _primaryGeneratorKey;
    final tag = dim
        ? const _MonoTag(
            text: 'em breve',
            foreground: SaaSTokens.textDim,
            background: SaaSTokens.surfaceAlt,
          )
        : _generatorTag(module);

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
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOutQuart,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: SaaSTokens.cardWhite,
              border: Border.all(
                color: _hovered
                    ? SaaSTokens.primary
                    : SaaSTokens.borderLight,
              ),
              borderRadius: BorderRadius.circular(SaaSTokens.rCard),
            ),
            child: Opacity(
              opacity: dim ? 0.55 : 1.0,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Icone em quadrado + etiqueta mono
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: isPrimary
                              ? SaaSTokens.primaryLight
                              : SaaSTokens.surfaceSubtle,
                          borderRadius: BorderRadius.circular(11),
                        ),
                        child: Icon(
                          module.icon,
                          size: 20,
                          color: isPrimary
                              ? SaaSTokens.primary
                              : SaaSTokens.textBody,
                        ),
                      ),
                      const Spacer(),
                      ?tag,
                    ],
                  ),

                  const SizedBox(height: 14),

                  // Nome do gerador
                  Text(
                    module.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GsText.cardTitle,
                  ),

                  const SizedBox(height: 6),

                  // O que o gerador produz
                  SizedBox(
                    height: 38,
                    child: Text(
                      module.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: GsText.body.copyWith(color: SaaSTokens.textMuted),
                    ),
                  ),

                  // TODO(redesign): o rodape do mockup ("18 gerados · hoje
                  // 09:14") depende de contagem de execucoes e data da ultima
                  // rodada por gerador. O repositorio nao registra essas
                  // metricas, entao o rodape fica de fora ate existirem.
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
// Card compacto (outros modulos) — menor e mais denso
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
    final module = widget.module;
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
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOutQuart,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: SaaSTokens.cardWhite,
            border: Border.all(
              color: _hovered ? SaaSTokens.primary : SaaSTokens.borderLight,
            ),
            borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          ),
          child: Opacity(
            opacity: dim ? 0.55 : 1.0,
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: SaaSTokens.surfaceSubtle,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Icon(
                    module.icon,
                    size: 18,
                    color: SaaSTokens.textBody,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        module.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GsText.cardTitleSm,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        module.description,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GsText.bodySm,
                      ),
                    ],
                  ),
                ),
                if (dim)
                  const Padding(
                    padding: EdgeInsets.only(left: 8),
                    child: _MonoTag(
                      text: 'em breve',
                      foreground: SaaSTokens.textDim,
                      background: SaaSTokens.surfaceAlt,
                    ),
                  )
                else
                  Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: _hovered ? SaaSTokens.primary : SaaSTokens.textDim,
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
          const SyncShimmer(width: 220, height: 26),
          const SizedBox(height: 8),
          const SyncShimmer(width: 320, height: 14),
          const SizedBox(height: 28),
          const SyncShimmer(width: 96, height: 12),
          const SizedBox(height: 14),
          LayoutBuilder(
            builder: (context, constraints) {
              final crossCount = constraints.maxWidth > 900
                  ? 3
                  : constraints.maxWidth > 560
                      ? 2
                      : 1;
              final tileW =
                  ((constraints.maxWidth - (crossCount - 1) * 12) / crossCount)
                      .floorToDouble();
              return Wrap(
                spacing: 12,
                runSpacing: 12,
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
        title: 'Falha ao carregar módulos',
        subtitle:
            'Não foi possível atualizar o catalogo agora. Verifique sua conexão.',
        actionLabel: 'Tentar novamente',
        onAction: onRetry,
      ),
    );
  }
}
