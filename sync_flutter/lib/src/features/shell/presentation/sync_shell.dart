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

/// Altura da faixa de cabecalho. A barra lateral abre com um bloco de marca
/// desta mesma altura e com a mesma borda inferior: sem isso o divisor do
/// cabecalho morre na borda do painel e as duas metades do app nao alinham.
const double _kHeaderHeight = 62;

/// Barra lateral aberta e recolhida. O recuo do trilho nao muda entre os dois
/// estados (16 de respiro + 12 de recuo), entao o icone nao se desloca um
/// pixel ao recolher — so o rotulo sai. Em 80 sobram 2px depois do icone: em
/// 78 a conta fechava exata e o Flex estourava por 1px de arredondamento.
const double _kSidebarWidth = 292;
const double _kSidebarRailWidth = 80;

class SyncShell extends StatefulWidget {
  const SyncShell({super.key, required this.controller});

  final AppController controller;

  @override
  State<SyncShell> createState() => _SyncShellState();
}

class _SyncShellState extends State<SyncShell> {
  bool _isContextPanelOpen = false;

  // O shell inteiro e reconstruido a cada notificacao do AppController, entao
  // o futuro dos modulos e resolvido uma unica vez aqui — cria-lo dentro do
  // build dispararia uma busca por frame.
  late final Future<List<ModuleDefinition>> _modulesFuture = widget
      .controller
      .repository
      .getModules();

  /// Recolhimento da barra lateral. Mora no shell, entao atravessa troca de
  /// secao; volta ao padrao so num recarregamento da aplicacao.
  bool _sidebarCollapsed = false;

  void _toggleContextPanel() {
    setState(() {
      _isContextPanelOpen = !_isContextPanelOpen;
    });
  }

  void _toggleSidebar() {
    setState(() {
      _sidebarCollapsed = !_sidebarCollapsed;
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
                  modulesFuture: _modulesFuture,
                  isDrawer: true,
                ),
              ),
            ),
      body: SafeArea(
        child: Row(
          children: [
            if (isDesktop)
              AnimatedContainer(
                duration: const Duration(milliseconds: 260),
                curve: Curves.easeOutQuart,
                width: _sidebarCollapsed ? _kSidebarRailWidth : _kSidebarWidth,
                child: _ShellSidebar(
                  controller: widget.controller,
                  modulesFuture: _modulesFuture,
                  collapsed: _sidebarCollapsed,
                  onToggleCollapsed: _toggleSidebar,
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
      height: compact ? 58 : _kHeaderHeight,
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
                icon: const Icon(
                  LucideIcons.panelLeft,
                  size: 18,
                  color: SaaSTokens.textMuted,
                ),
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
            icon: const Icon(
              LucideIcons.bellDot,
              size: 18,
              color: SaaSTokens.textMuted,
            ),
          ),
          const SizedBox(width: 4),
          IconButton(
            onPressed: onToggleContextPanel,
            icon: Icon(
              isContextPanelOpen
                  ? LucideIcons.panelRightClose
                  : LucideIcons.panelRightOpen,
              size: 18,
              color: isContextPanelOpen
                  ? SaaSTokens.primary
                  : SaaSTokens.textMuted,
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
    required this.modulesFuture,
    this.isDrawer = false,
    this.collapsed = false,
    this.onToggleCollapsed,
  });

  final AppController controller;
  final Future<List<ModuleDefinition>> modulesFuture;
  final bool isDrawer;
  final bool collapsed;
  final VoidCallback? onToggleCollapsed;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: isDrawer
            ? null
            : const Border(right: BorderSide(color: SaaSTokens.borderLight)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Bloco de marca com a altura e a borda do cabecalho: e o que faz o
          // divisor atravessar o app inteiro em vez de parar na barra.
          Container(
            height: isDrawer ? 58 : _kHeaderHeight,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: SaaSTokens.borderLight)),
            ),
            child: Row(
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: _kRailInset),
                  child: Image.asset(
                    'assets/branding/global-sync-icon.png',
                    height: 28,
                    width: 28,
                    fit: BoxFit.contain,
                  ),
                ),
                if (!collapsed) ...[
                  const SizedBox(width: 10),
                  // Flexivel de proposito: a 20px o wordmark estourava os
                  // 236px uteis da barra de 292.
                  Expanded(
                    child: Text(
                      'Global Sync',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GsText.panelTitle.copyWith(fontSize: 18),
                    ),
                  ),
                ],
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _PrimaryActionButton(
                    icon: LucideIcons.plus,
                    label: 'Novo levantamento',
                    shortcut: '⌘N',
                    collapsed: collapsed,
                    onTap: () => controller.selectModule('levantamento-fundeb'),
                  ),
                  const SizedBox(height: 18),
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Recolhida, a barra nao tem largura para o rotulo —
                          // e a lista curta dispensa o sobretitulo.
                          if (!collapsed) ...[
                            const _SidebarSectionLabel('WORKSPACE'),
                            const SizedBox(height: 10),
                          ],
                          for (final section in AppSection.values)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 3),
                              child: _SidebarButton(
                                icon: section.icon,
                                label: section.label,
                                selected: controller.currentSection == section,
                                collapsed: collapsed,
                                // TODO(redesign): contagem de nao lidos
                                // (badge da Inbox) ainda nao existe no
                                // repositorio
                                badge: null,
                                onTap: () => controller.selectSection(section),
                              ),
                            ),
                          if (!collapsed)
                            _ActiveModuleChip(
                              controller: controller,
                              modulesFuture: modulesFuture,
                            ),
                        ],
                      ),
                    ),
                  ),
                  if (onToggleCollapsed != null) ...[
                    _SidebarToggleRow(
                      collapsed: collapsed,
                      onTap: onToggleCollapsed!,
                    ),
                    const SizedBox(height: 2),
                  ],
                  _HelpRow(collapsed: collapsed),
                  const SizedBox(height: 10),
                  _UserCard(controller: controller, collapsed: collapsed),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Alterna o recolhimento. Fica no rodape, no mesmo trilho dos itens de nav:
/// no bloco de marca ele nao caberia recolhido, e mudar de lugar conforme o
/// estado esconderia justamente o controle que devolve a barra.
class _SidebarToggleRow extends StatefulWidget {
  const _SidebarToggleRow({required this.collapsed, required this.onTap});

  final bool collapsed;
  final VoidCallback onTap;

  @override
  State<_SidebarToggleRow> createState() => _SidebarToggleRowState();
}

class _SidebarToggleRowState extends State<_SidebarToggleRow> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final label = widget.collapsed ? 'Expandir barra' : 'Recolher barra';

    return Tooltip(
      message: label,
      waitDuration: const Duration(milliseconds: 400),
      child: Semantics(
        button: true,
        label: label,
        child: MouseRegion(
          cursor: SystemMouseCursors.click,
          onEnter: (_) => setState(() => _hovered = true),
          onExit: (_) => setState(() => _hovered = false),
          child: GestureDetector(
            onTap: widget.onTap,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              height: 40,
              decoration: BoxDecoration(
                color: _hovered ? SaaSTokens.scaffold : Colors.transparent,
                borderRadius: BorderRadius.circular(SaaSTokens.rControl),
              ),
              padding: const EdgeInsets.only(left: _kRailInset, right: 12),
              child: Row(
                children: [
                  SizedBox(
                    width: 22,
                    height: 22,
                    child: Icon(
                      widget.collapsed
                          ? LucideIcons.panelLeftOpen
                          : LucideIcons.panelLeftClose,
                      size: 18,
                      color: SaaSTokens.textDim,
                    ),
                  ),
                  if (!widget.collapsed) ...[
                    const SizedBox(width: 11),
                    Expanded(
                      child: Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GsText.body.copyWith(color: SaaSTokens.textSoft),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Recuo do trilho de icones da barra lateral. Todo icone — marca, item de
/// nav, ajuda e avatar — comeca nesta distancia da borda do painel; sem uma
/// constante unica cada peca escolhia o proprio recuo e nada alinhava.
const double _kRailInset = 12;

/// Sobretitulo de secao da barra lateral — mono, caixa alta.
class _SidebarSectionLabel extends StatelessWidget {
  const _SidebarSectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: _kRailInset),
      child: Text(
        text,
        style: GsText.label.copyWith(color: SaaSTokens.textDim),
      ),
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
    this.collapsed = false,
  });

  final IconData icon;
  final String label;
  final String shortcut;
  final VoidCallback onTap;
  final bool collapsed;

  @override
  State<_PrimaryActionButton> createState() => _PrimaryActionButtonState();
}

class _PrimaryActionButtonState extends State<_PrimaryActionButton> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: widget.collapsed ? '${widget.label}  ${widget.shortcut}' : '',
      waitDuration: const Duration(milliseconds: 400),
      child: Semantics(
        button: true,
        label: widget.label,
        child: MouseRegion(
          cursor: SystemMouseCursors.click,
          onEnter: (_) => setState(() => _hovered = true),
          onExit: (_) => setState(() => _hovered = false),
          child: GestureDetector(
            onTap: widget.onTap,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              height: 44,
              padding: const EdgeInsets.only(left: _kRailInset, right: 12),
              decoration: BoxDecoration(
                // Branco sobre `primary` rende 3.65:1 e reprova o AA na acao
                // mais importante da barra. `primaryStrong` da 6.34:1.
                color: _hovered
                    ? SaaSTokens.primaryPressed
                    : SaaSTokens.primaryStrong,
                borderRadius: BorderRadius.circular(SaaSTokens.rControl),
              ),
              child: Row(
                children: [
                  // Mesma caixa de 22px do item de nav: o icone cai no trilho
                  // e nao se move quando a barra recolhe.
                  SizedBox(
                    width: 22,
                    height: 22,
                    child: Icon(widget.icon, size: 18, color: Colors.white),
                  ),
                  if (!widget.collapsed) ...[
                    const SizedBox(width: 11),
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
                        color: Colors.white.withValues(alpha: 0.78),
                      ),
                    ),
                  ],
                ],
              ),
            ),
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
  const _HelpRow({this.collapsed = false});

  final bool collapsed;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: collapsed ? 'Ajuda e atalhos  ⌘/' : '',
      waitDuration: const Duration(milliseconds: 400),
      child: SizedBox(
        height: 40,
        child: Padding(
          padding: const EdgeInsets.only(left: _kRailInset, right: 12),
          child: Row(
            children: [
              // Mesma caixa de 22px do item de nav, para o icone cair no
              // trilho.
              const SizedBox(
                width: 22,
                height: 22,
                child: Icon(
                  LucideIcons.circleQuestionMark,
                  size: 18,
                  color: SaaSTokens.textDim,
                ),
              ),
              if (!collapsed) ...[
                const SizedBox(width: 11),
                Expanded(
                  child: Text(
                    'Ajuda e atalhos',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GsText.body.copyWith(color: SaaSTokens.textSoft),
                  ),
                ),
                const SizedBox(width: 8),
                const _KbdChip('⌘/'),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Cartao do usuario no rodape, com menu de acoes.
// TODO(redesign): papel/perfil do usuario (ex.: "Admin do grupo") ainda nao
// existe em SyncUser.
class _UserCard extends StatelessWidget {
  const _UserCard({required this.controller, this.collapsed = false});

  final AppController controller;
  final bool collapsed;

  void _onSelected(String value) {
    switch (value) {
      case 'settings':
        controller.selectSection(AppSection.settings);
      case 'signout':
        controller.signOut();
    }
  }

  List<PopupMenuEntry<String>> _items(BuildContext context) => [
    PopupMenuItem<String>(
      value: 'settings',
      height: 40,
      child: Row(
        children: [
          const Icon(
            LucideIcons.settings2,
            size: 15,
            color: SaaSTokens.textMuted,
          ),
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
  ];

  @override
  Widget build(BuildContext context) {
    final user = controller.user;
    final email = user?.email ?? '';
    // Sem `displayName` no Firebase, `name` cai para o proprio e-mail. Repetir
    // a mesma string em duas linhas — ambas truncadas — nao informa nada.
    final name = user?.name ?? 'Conta';
    final hasRealName = name.isNotEmpty && name != email;

    // Recolhida, o cartao vira so o avatar — que centrado em 78px cai no mesmo
    // eixo dos icones de nav — e o cartao inteiro abre o menu.
    if (collapsed) {
      return Tooltip(
        message: hasRealName ? '$name\n$email' : email,
        waitDuration: const Duration(milliseconds: 400),
        child: PopupMenuButton<String>(
          tooltip: '',
          padding: EdgeInsets.zero,
          position: PopupMenuPosition.under,
          onSelected: _onSelected,
          itemBuilder: _items,
          child: Center(
            child: _Avatar(
              initials: user?.initials ?? 'U',
              size: 34,
              radius: 11,
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(_kRailInset, 9, 2, 9),
      decoration: BoxDecoration(
        color: SaaSTokens.surfaceSubtle,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Row(
        children: [
          _Avatar(initials: user?.initials ?? 'U', size: 34, radius: 11),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  hasRealName ? name : email,
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
                        // `success` puro rende 2.20:1 sobre a superficie
                        // clara.
                        color: SaaSTokens.successDot,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        // A segunda linha diz o que o ponto significa quando o
                        // e-mail ja ocupa a primeira.
                        hasRealName ? email : 'Sessão ativa',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GsText.dataXs.copyWith(
                          color: SaaSTokens.textMuted,
                        ),
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
            onSelected: _onSelected,
            itemBuilder: _items,
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
    this.collapsed = false,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool collapsed;

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

    return Tooltip(
      // Recolhida, o icone e tudo o que sobra: sem o rotulo em algum lugar a
      // barra vira adivinhacao.
      message: widget.collapsed ? widget.label : '',
      waitDuration: const Duration(milliseconds: 400),
      child: Semantics(
        button: true,
        selected: active,
        label: widget.label,
        child: MouseRegion(
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
              child: Stack(
                children: [
                  // A barra indicadora fica FORA do fluxo: dentro dele ela
                  // empurrava o icone para 22px e o item de nav era a unica
                  // peca da barra que nao assentava no trilho.
                  Positioned(
                    left: 4,
                    top: 0,
                    bottom: 0,
                    child: Center(
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        curve: Curves.easeOutQuart,
                        width: 3,
                        height: active ? 22 : 0,
                        decoration: BoxDecoration(
                          color: SaaSTokens.primary,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(
                      left: _kRailInset,
                      right: 12,
                    ),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 22,
                          height: 22,
                          child: Icon(widget.icon, size: 19, color: fg),
                        ),
                        if (!widget.collapsed) ...[
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
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: SaaSTokens.primary,
                                borderRadius: BorderRadius.circular(
                                  SaaSTokens.rPill,
                                ),
                              ),
                              child: Text(
                                '${widget.badge}',
                                style: GsText.dataXsStrong.copyWith(
                                  color: Colors.white,
                                ),
                              ),
                            ),
                        ],
                      ],
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
            icon: controller.repository.remoteEnabled
                ? LucideIcons.wifi
                : LucideIcons.wifiOff,
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
            body:
                'Para assistencia, entre em contato com a equipe de TI da Global Sync.',
          ),
        ],
      ),
    );
  }

  Widget _buildContextCard({
    required IconData icon,
    required String title,
    required String body,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SaaSTokens
            .scaffold, // Inner background to contrast with white panel
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: _ContextDescription(icon: icon, title: title, body: body),
    );
  }
}

class _ContextDescription extends StatelessWidget {
  const _ContextDescription({
    required this.icon,
    required this.title,
    required this.body,
  });

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
