import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/app.dart';
import '../../../core/models/sync_models.dart';
import '../../../core/theme/app_theme.dart';
import '../../companies/presentation/company_detail_screen.dart';
import '../../dashboard/presentation/dashboard_screen.dart';
import '../../inbox/presentation/inbox_screen.dart';
import '../../modules/presentation/modules_screen.dart';
import '../../people/presentation/people_screen.dart';
import '../../pipeline/presentation/pipeline_screen.dart';
import '../../settings/presentation/settings_screen.dart';

class SyncShell extends StatefulWidget {
  const SyncShell({super.key, required this.controller});

  final AppController controller;

  @override
  State<SyncShell> createState() => _SyncShellState();
}

class _SyncShellState extends State<SyncShell> {
  bool _isContextPanelOpen = false;

  // O shell inteiro e reconstruido a cada notificacao do AppController, entao
  // os futuros do enquadramento (grupo e modulos) sao resolvidos uma unica vez
  // aqui — cria-los dentro do build dispararia uma busca por frame.
  late final Future<WorkspaceSettings> _workspaceFuture =
      widget.controller.repository.getWorkspaceSettings();
  late final Future<List<ModuleDefinition>> _modulesFuture =
      widget.controller.repository.getModules();

  void _toggleContextPanel() {
    setState(() {
      _isContextPanelOpen = !_isContextPanelOpen;
    });
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final isDesktop = width >= 1120;

    // Auto-close panel on small screens
    if (width < 900 && _isContextPanelOpen) {
      // Defer state change to avoid build-phase exceptions
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _isContextPanelOpen) {
          setState(() => _isContextPanelOpen = false);
        }
      });
    }

    return Scaffold(
      drawerScrimColor: Colors.black.withValues(alpha: 0.08),
      drawer: isDesktop
          ? null
          : Drawer(
              width: 304,
              backgroundColor: SaaSTokens.cardWhite,
              shape: const RoundedRectangleBorder(
                borderRadius: BorderRadius.zero,
              ),
              child: SafeArea(
                child: _ShellSidebar(
                  controller: widget.controller,
                  workspaceFuture: _workspaceFuture,
                  modulesFuture: _modulesFuture,
                  isDrawer: true,
                ),
              ),
            ),
      body: SafeArea(
        child: Row(
          children: [
            if (isDesktop)
              SizedBox(
                width: 292,
                child: _ShellSidebar(
                  controller: widget.controller,
                  workspaceFuture: _workspaceFuture,
                  modulesFuture: _modulesFuture,
                ),
              ),
            Expanded(
              child: Column(
                children: [
                  _ShellHeader(
                    controller: widget.controller,
                    showMenuButton: !isDesktop,
                    onToggleContextPanel: _toggleContextPanel,
                    isContextPanelOpen: _isContextPanelOpen,
                  ),
                  Expanded(
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 250),
                      switchInCurve: Curves.easeOutQuart,
                      switchOutCurve: Curves.easeInQuart,
                      transitionBuilder: (child, animation) {
                        return FadeTransition(
                          opacity: animation,
                          child: SlideTransition(
                            position: Tween<Offset>(
                              begin: const Offset(0, 0.015),
                              end: Offset.zero,
                            ).animate(animation),
                            child: child,
                          ),
                        );
                      },
                      child: KeyedSubtree(
                        key: ValueKey(widget.controller.currentSection),
                        child: _buildContent(),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_isContextPanelOpen)
              SizedBox(
                width: 320,
                child: _ShellContextPanel(
                  controller: widget.controller,
                  modulesFuture: _modulesFuture,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    final repository = widget.controller.repository;
    return switch (widget.controller.currentSection) {
      AppSection.dashboard => DashboardScreen(repository: repository),
      AppSection.inbox => InboxScreen(repository: repository),
      AppSection.companies => CompanyDetailScreen(
        repository: repository,
        companyId: '1',
        onBack: () {},
        currentUser: widget.controller.user,
      ),
      AppSection.people => PeopleScreen(repository: repository),
      AppSection.pipeline => PipelineScreen(repository: repository),
      AppSection.modules => ModulesScreen(
        repository: repository,
        selectedKey: widget.controller.selectedModuleKey,
        onSelectModule: widget.controller.selectModule,
      ),
      AppSection.settings => SettingsScreen(repository: repository),
    };
  }
}

class _ShellHeader extends StatelessWidget {
  const _ShellHeader({
    required this.controller,
    required this.showMenuButton,
    required this.onToggleContextPanel,
    required this.isContextPanelOpen,
  });

  final AppController controller;
  final bool showMenuButton;
  final VoidCallback onToggleContextPanel;
  final bool isContextPanelOpen;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final compact = width < 760;
    final showSearch = width >= 980;

    return Container(
      height: compact ? 58 : 62,
      padding: EdgeInsets.symmetric(horizontal: compact ? 12 : 18),
      decoration: const BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border(bottom: BorderSide(color: SaaSTokens.borderLight)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (showMenuButton) ...[
            Builder(
              builder: (ctx) => IconButton(
                onPressed: () => Scaffold.of(ctx).openDrawer(),
                icon: const Icon(LucideIcons.panelLeft, size: 18, color: SaaSTokens.textMuted),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
              ),
            ),
            const SizedBox(width: 8),
          ],
          // Migalha em mono caixa alta sobre o titulo da secao, seguida da
          // busca. Um unico Expanded segura o grupo da esquerda para que os
          // controles da direita fiquem sempre colados na borda.
          Expanded(
            child: Row(
              children: [
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'WORKSPACE',
                        style: GsText.label.copyWith(color: SaaSTokens.textDim),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        controller.currentSection.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GsText.cardTitle,
                      ),
                    ],
                  ),
                ),
                if (showSearch) ...[
                  const SizedBox(width: 20),
                  _HeaderSearchField(hint: controller.searchHint),
                ],
              ],
            ),
          ),
          if (!compact) ...[
            _SyncStatusPill(online: controller.repository.remoteEnabled),
            const SizedBox(width: 6),
          ],
          IconButton(
            onPressed: () {},
            icon: const Icon(LucideIcons.bellDot, size: 18, color: SaaSTokens.textMuted),
          ),
          const SizedBox(width: 4),
          IconButton(
            onPressed: onToggleContextPanel,
            icon: Icon(
              isContextPanelOpen ? LucideIcons.panelRightClose : LucideIcons.panelRightOpen,
              size: 18,
              color: isContextPanelOpen ? SaaSTokens.primary : SaaSTokens.textMuted,
            ),
          ),
          const SizedBox(width: 8),
          _Avatar(
            initials: controller.user?.initials ?? 'U',
            size: 34,
            radius: 10,
          ),
        ],
      ),
    );
  }
}

/// Campo de busca do cabecalho. Renderizado como afordancia estatica: o
/// `searchHint` do controller ja acompanha a secao ativa, mas ainda nao ha
/// handler de busca global.
// TODO(redesign): busca global (⌘K) ainda nao tem handler no AppController
class _HeaderSearchField extends StatefulWidget {
  const _HeaderSearchField({required this.hint});

  final String hint;

  @override
  State<_HeaderSearchField> createState() => _HeaderSearchFieldState();
}

class _HeaderSearchFieldState extends State<_HeaderSearchField> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.text,
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 258,
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          border: Border.all(
            color: _hovered ? SaaSTokens.primary : SaaSTokens.borderLight,
          ),
        ),
        child: Row(
          children: [
            const Icon(LucideIcons.search, size: 16, color: SaaSTokens.textDim),
            const SizedBox(width: 9),
            Expanded(
              child: Text(
                widget.hint,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GsText.body.copyWith(color: SaaSTokens.textDim),
              ),
            ),
            const SizedBox(width: 8),
            const _KbdChip('⌘K', filled: true),
          ],
        ),
      ),
    );
  }
}

/// Pilula de status de sincronizacao.
// TODO(redesign): horario do ultimo sync ainda nao existe no repositorio
class _SyncStatusPill extends StatelessWidget {
  const _SyncStatusPill({required this.online});

  final bool online;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(SaaSTokens.rPill),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: online ? SaaSTokens.success : SaaSTokens.textDim,
            ),
          ),
          const SizedBox(width: 8),
          Text(online ? 'sincronizado' : 'offline', style: GsText.dataXs),
        ],
      ),
    );
  }
}

/// Atalho de teclado. `filled` desenha o fundo cinza do cabecalho; sem ele,
/// so a borda de 1px do rodape da barra lateral.
class _KbdChip extends StatelessWidget {
  const _KbdChip(this.keys, {this.filled = false});

  final String keys;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: filled ? SaaSTokens.scaffold : null,
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Text(
        keys,
        style: filled
            ? GsText.kbd.copyWith(color: SaaSTokens.textMuted)
            : GsText.kbd,
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({
    required this.initials,
    required this.size,
    required this.radius,
  });

  final String initials;
  final double size;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: SaaSTokens.primary,
        borderRadius: BorderRadius.circular(radius),
      ),
      child: Text(
        initials,
        style: GsText.bodyStrong.copyWith(color: Colors.white),
      ),
    );
  }
}

class _ShellSidebar extends StatelessWidget {
  const _ShellSidebar({
    required this.controller,
    required this.workspaceFuture,
    required this.modulesFuture,
    this.isDrawer = false,
  });

  final AppController controller;
  final Future<WorkspaceSettings> workspaceFuture;
  final Future<List<ModuleDefinition>> modulesFuture;
  final bool isDrawer;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: isDrawer
            ? null
            : const Border(right: BorderSide(color: SaaSTokens.borderLight)),
      ),
      padding: EdgeInsets.fromLTRB(16, isDrawer ? 14 : 24, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Marca — icone + wordmark
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(
              children: [
                Image.asset(
                  'assets/branding/global-sync-icon.png',
                  height: 32,
                  width: 32,
                  fit: BoxFit.contain,
                ),
                const SizedBox(width: 10),
                Text(
                  'Global Sync',
                  style: GsText.panelTitle.copyWith(color: SaaSTokens.primary),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _GroupSelector(workspaceFuture: workspaceFuture),
          const SizedBox(height: 10),
          _PrimaryActionButton(
            icon: LucideIcons.plus,
            label: 'Novo levantamento',
            shortcut: '⌘N',
            onTap: () => controller.selectModule('levantamento-fundeb'),
          ),
          const SizedBox(height: 18),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.only(bottom: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SidebarSectionLabel('WORKSPACE'),
                  const SizedBox(height: 10),
                  for (final section in AppSection.values)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 3),
                      child: _SidebarButton(
                        icon: section.icon,
                        label: section.label,
                        selected: controller.currentSection == section,
                        // TODO(redesign): contagem de nao lidos (badge da Inbox)
                        // ainda nao existe no repositorio
                        badge: null,
                        onTap: () => controller.selectSection(section),
                      ),
                    ),
                  _ActiveModuleChip(
                    controller: controller,
                    modulesFuture: modulesFuture,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          const _HelpRow(),
          const SizedBox(height: 10),
          _UserCard(controller: controller),
        ],
      ),
    );
  }
}

/// Sobretitulo de secao da barra lateral — mono, caixa alta.
class _SidebarSectionLabel extends StatelessWidget {
  const _SidebarSectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: Text(
        text,
        style: GsText.label.copyWith(color: SaaSTokens.textDim),
      ),
    );
  }
}

/// Seletor de grupo — nome do grupo e linha de contexto tecnica.
// TODO(redesign): contagem de empresas do grupo ainda nao existe no
// repositorio (getSidebarCompanies() limita a 8 e nao e um total); a linha de
// contexto usa o slug do workspace, que e dado real. Trocar por "N empresas"
// quando o total existir.
// TODO(redesign): troca de grupo ainda nao tem handler — o icone de expandir
// e apenas a afordancia visual do design.
class _GroupSelector extends StatelessWidget {
  const _GroupSelector({required this.workspaceFuture});

  final Future<WorkspaceSettings> workspaceFuture;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<WorkspaceSettings>(
      future: workspaceFuture,
      builder: (context, snapshot) {
        final settings = snapshot.data;
        final contextLine =
            settings == null ? 'grupo' : 'grupo · ${settings.slug}';
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(11),
            border: Border.all(color: SaaSTokens.borderLight),
          ),
          child: Row(
            children: [
              Image.asset(
                'assets/branding/global-sync-icon.png',
                height: 26,
                width: 26,
                fit: BoxFit.contain,
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      settings?.groupName ?? 'Grupo',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GsText.bodyStrong,
                    ),
                    Text(
                      contextLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GsText.dataXs.copyWith(color: SaaSTokens.textDim),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              const Icon(
                LucideIcons.chevronsUpDown,
                size: 16,
                color: SaaSTokens.textDim,
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Botao primario da barra lateral, com o atalho alinhado a direita.
class _PrimaryActionButton extends StatefulWidget {
  const _PrimaryActionButton({
    required this.icon,
    required this.label,
    required this.shortcut,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String shortcut;
  final VoidCallback onTap;

  @override
  State<_PrimaryActionButton> createState() => _PrimaryActionButtonState();
}

class _PrimaryActionButtonState extends State<_PrimaryActionButton> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: _hovered ? SaaSTokens.primaryHover : SaaSTokens.primary,
            borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          ),
          child: Row(
            children: [
              Icon(widget.icon, size: 17, color: Colors.white),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  widget.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GsText.button.copyWith(color: Colors.white),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                widget.shortcut,
                style: GsText.kbd.copyWith(
                  color: Colors.white.withValues(alpha: 0.72),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Chip do modulo corrente, sob o rotulo MODULO ATIVO.
class _ActiveModuleChip extends StatelessWidget {
  const _ActiveModuleChip({
    required this.controller,
    required this.modulesFuture,
  });

  final AppController controller;
  final Future<List<ModuleDefinition>> modulesFuture;

  @override
  Widget build(BuildContext context) {
    final key = controller.selectedModuleKey;
    if (key == null || key.isEmpty) return const SizedBox.shrink();

    return FutureBuilder<List<ModuleDefinition>>(
      future: modulesFuture,
      builder: (context, snapshot) {
        final modules = snapshot.data ?? const <ModuleDefinition>[];
        final index = modules.indexWhere((module) => module.key == key);
        if (index < 0) return const SizedBox.shrink();
        final module = modules[index];

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 22),
            const _SidebarSectionLabel('MÓDULO ATIVO'),
            const SizedBox(height: 8),
            Container(
              height: 36,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              decoration: BoxDecoration(
                color: SaaSTokens.primaryLight,
                borderRadius: BorderRadius.circular(9),
              ),
              child: Row(
                children: [
                  Icon(module.icon, size: 17, color: SaaSTokens.primary),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(
                      module.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GsText.bodyStrong.copyWith(
                        color: SaaSTokens.primaryHover,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Linha "Ajuda e atalhos" do rodape.
// TODO(redesign): painel de ajuda/atalhos (⌘/) ainda nao existe no app
class _HelpRow extends StatelessWidget {
  const _HelpRow();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 34,
      child: Row(
        children: [
          const SizedBox(width: 8),
          const Icon(
            LucideIcons.circleQuestionMark,
            size: 16,
            color: SaaSTokens.textDim,
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              'Ajuda e atalhos',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GsText.body,
            ),
          ),
          const SizedBox(width: 8),
          const _KbdChip('⌘/'),
          const SizedBox(width: 8),
        ],
      ),
    );
  }
}

/// Cartao do usuario no rodape, com menu de acoes.
// TODO(redesign): papel/perfil do usuario (ex.: "Admin do grupo") ainda nao
// existe em SyncUser; a linha de contexto mostra o e-mail da sessao.
class _UserCard extends StatelessWidget {
  const _UserCard({required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final user = controller.user;

    return Container(
      padding: const EdgeInsets.fromLTRB(9, 9, 2, 9),
      decoration: BoxDecoration(
        color: SaaSTokens.surfaceSubtle,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Row(
        children: [
          _Avatar(initials: user?.initials ?? 'U', size: 36, radius: 11),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  user?.name ?? 'Conta',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GsText.bodyStrong,
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Container(
                      width: 5,
                      height: 5,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: SaaSTokens.success,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        user?.email ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GsText.dataXs,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          PopupMenuButton<String>(
            tooltip: 'Ações da conta',
            padding: EdgeInsets.zero,
            splashRadius: 18,
            position: PopupMenuPosition.under,
            icon: const Icon(
              LucideIcons.ellipsisVertical,
              size: 16,
              color: SaaSTokens.textDim,
            ),
            onSelected: (value) {
              switch (value) {
                case 'settings':
                  controller.selectSection(AppSection.settings);
                case 'signout':
                  controller.signOut();
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem<String>(
                value: 'settings',
                height: 40,
                child: Row(
                  children: [
                    const Icon(LucideIcons.settings2, size: 15, color: SaaSTokens.textMuted),
                    const SizedBox(width: 10),
                    Text('Configurações', style: GsText.body),
                  ],
                ),
              ),
              PopupMenuItem<String>(
                value: 'signout',
                height: 40,
                child: Row(
                  children: [
                    const Icon(LucideIcons.logOut, size: 15, color: SaaSTokens.textMuted),
                    const SizedBox(width: 10),
                    Text('Sair', style: GsText.body),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SidebarButton extends StatefulWidget {
  const _SidebarButton({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  /// Contagem numerica a direita do item (ex.: nao lidos da Inbox), em mono.
  final int? badge;

  @override
  State<_SidebarButton> createState() => _SidebarButtonState();
}

class _SidebarButtonState extends State<_SidebarButton> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final active = widget.selected;
    final hover = _hovered && !active;
    final fg = active
        ? SaaSTokens.primary
        : hover
            ? SaaSTokens.textTitle
            : SaaSTokens.textDim;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutQuart,
          height: 44,
          decoration: BoxDecoration(
            color: active
                ? SaaSTokens.primaryLight
                : hover
                    ? SaaSTokens.scaffold
                    : Colors.transparent,
            borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          ),
          child: Row(
            children: [
              const SizedBox(width: 8),
              // Barra indicadora lateral do item ativo
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOutQuart,
                width: 3,
                height: active ? 24 : 0,
                decoration: BoxDecoration(
                  color: active ? SaaSTokens.primary : Colors.transparent,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              // O icone comeca em 22px nos dois estados
              SizedBox(width: active ? 11 : 14),
              SizedBox(
                width: 22,
                height: 22,
                child: Icon(widget.icon, size: 19, color: fg),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Text(
                  widget.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GsText.navItem.copyWith(color: fg),
                ),
              ),
              if (widget.badge != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: SaaSTokens.primary,
                    borderRadius: BorderRadius.circular(SaaSTokens.rPill),
                  ),
                  child: Text(
                    '${widget.badge}',
                    style: GsText.dataXsStrong.copyWith(color: Colors.white),
                  ),
                )
              else if (active)
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: SaaSTokens.success,
                    boxShadow: [
                      BoxShadow(
                        color: SaaSTokens.success.withValues(alpha: 0.4),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                ),
              const SizedBox(width: 12),
            ],
          ),
        ),
      ),
    );
  }
}

class _ShellContextPanel extends StatelessWidget {
  const _ShellContextPanel({
    required this.controller,
    required this.modulesFuture,
  });

  final AppController controller;
  final Future<List<ModuleDefinition>> modulesFuture;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border(left: BorderSide(color: SaaSTokens.borderLight)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Acesso Rapido', style: GsText.panelTitle),
          const SizedBox(height: 18),
          _buildContextCard(
            icon: LucideIcons.bellRing,
            title: 'Avisos da Plataforma',
            body: 'Nenhuma nova atualização no sistema Global Sync.',
          ),
          const SizedBox(height: 16),
          _buildContextCard(
            icon: controller.repository.remoteEnabled ? LucideIcons.wifi : LucideIcons.wifiOff,
            title: 'Status da Conexao',
            body: controller.repository.remoteEnabled
                ? 'Conectado à nuvem oficial. Dados sincronizados com sucesso.'
                : 'Modo offline. Verifique sua conexao.',
          ),
          const SizedBox(height: 16),
          FutureBuilder<List<ModuleDefinition>>(
            future: modulesFuture,
            builder: (context, snapshot) {
              final modules = snapshot.data ?? const <ModuleDefinition>[];
              final selectedModule = controller.selectedModuleKey == null
                  ? null
                  : modules.firstWhere(
                      (module) => module.key == controller.selectedModuleKey,
                      orElse: () => modules.isEmpty
                          ? ModuleDefinition(
                              key: '',
                              label: 'Módulo ativo',
                              description: '',
                              color: SaaSTokens.primary,
                              icon: Icons.widgets_outlined,
                            )
                          : modules.first,
                    );
              return _buildContextCard(
                icon: controller.selectedCompanyId != null 
                    ? LucideIcons.building2 
                    : (selectedModule?.icon ?? LucideIcons.layoutGrid),
                title: controller.selectedCompanyId != null
                    ? 'Dados da Empresa'
                    : (selectedModule?.label.isNotEmpty == true
                          ? selectedModule!.label
                          : 'Módulo ativo'),
                body: controller.selectedCompanyId != null
                    ? 'Visualizando as configurações e informações corporativas exclusivas da Global Sync.'
                    : selectedModule?.description.isNotEmpty == true
                    ? selectedModule!.description
                    : 'O painel exibirá filtros e atalhos conforme você navega pelos módulos.',
              );
            },
          ),
          const SizedBox(height: 16),
          const SizedBox(height: 16),
          _buildContextCard(
            icon: LucideIcons.lifeBuoy,
            title: 'Suporte',
            body: 'Para assistencia, entre em contato com a equipe de TI da Global Sync.',
          ),
        ],
      ),
    );
  }

  Widget _buildContextCard({required IconData icon, required String title, required String body}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SaaSTokens.scaffold, // Inner background to contrast with white panel
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: _ContextDescription(icon: icon, title: title, body: body),
    );
  }
}

class _ContextDescription extends StatelessWidget {
  const _ContextDescription({required this.icon, required this.title, required this.body});

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 16, color: SaaSTokens.primary),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                title,
                style: GsText.cardTitleSm.copyWith(color: SaaSTokens.primary),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(body, style: GsText.body),
      ],
    );
  }
}
