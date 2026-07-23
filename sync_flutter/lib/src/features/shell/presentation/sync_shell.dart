import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/app.dart';
import '../../../core/models/sync_models.dart';
import '../../../core/theme/app_theme.dart';
import '../../companies/presentation/company_detail_screen.dart';
import '../../companies/presentation/companies_screen.dart';
import '../../dashboard/presentation/dashboard_screen.dart';
import '../../inbox/presentation/inbox_screen.dart';
import '../../modules/presentation/modules_screen.dart';
import '../../people/presentation/people_screen.dart';
import '../../pipeline/presentation/pipeline_screen.dart';
import '../../settings/presentation/settings_screen.dart';
import '../../shared/presentation/shared_widgets.dart';

class SyncShell extends StatefulWidget {
  const SyncShell({super.key, required this.controller});

  final AppController controller;

  @override
  State<SyncShell> createState() => _SyncShellState();
}

class _SyncShellState extends State<SyncShell> {
  bool _isContextPanelOpen = false;

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
                child: _ShellSidebar(controller: widget.controller, isDrawer: true),
              ),
            ),
      body: SafeArea(
        child: Row(
          children: [
            if (isDesktop)
              SizedBox(
                width: 292,
                child: _ShellSidebar(controller: widget.controller),
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
                child: _ShellContextPanel(controller: widget.controller),
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

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 14 : 20,
        vertical: compact ? 10 : 14,
      ),
      decoration: const BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border(bottom: BorderSide(color: SaaSTokens.borderLight)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (showMenuButton)
            Builder(
              builder: (ctx) => IconButton(
                onPressed: () => Scaffold.of(ctx).openDrawer(),
                icon: const Icon(LucideIcons.panelLeft, size: 18, color: SaaSTokens.textMuted),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
              ),
            ),
          if (showMenuButton) const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Workspace', style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.w600,
                color: SaaSTokens.textDim, letterSpacing: 0.8,
              )),
              const SizedBox(height: 1),
              Text(
                controller.currentSection.label,
                style: const TextStyle(
                  fontSize: 15, fontWeight: FontWeight.w600,
                  color: SaaSTokens.textTitle, letterSpacing: -0.2,
                ),
              ),
            ],
          ),
          const Spacer(),
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
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: SaaSTokens.primary,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              controller.user?.initials ?? 'U',
              style: const TextStyle(
                fontSize: 13, color: Colors.white, fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ShellSidebar extends StatelessWidget {
  const _ShellSidebar({required this.controller, this.isDrawer = false});

  final AppController controller;
  final bool isDrawer;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: SaaSTokens.cardWhite,
      padding: EdgeInsets.fromLTRB(20, isDrawer ? 16 : 30, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Logo area — ícone Global Sync + wordmark
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Image.asset(
                'assets/branding/global-sync-icon.png',
                height: 32,
                width: 32,
                fit: BoxFit.contain,
              ),
              const SizedBox(width: 10),
              const Text(
                'Global Sync',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: SaaSTokens.primary,
                  letterSpacing: -0.5,
                  height: 1.1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          const Text('WORKSPACE', style: TextStyle(
            fontSize: 11, fontWeight: FontWeight.w600,
            color: SaaSTokens.textDim, letterSpacing: 1.0,
          )),
          const SizedBox(height: 12),
          for (final section in AppSection.values)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: _SidebarButton(
                icon: section.icon,
                label: section.label,
                selected: controller.currentSection == section,
                onTap: () => controller.selectSection(section),
              ),
            ),
          const Spacer(),
          const Divider(height: 1, color: SaaSTokens.borderLight),
          const SizedBox(height: 12),
          // Profile — unboxed, transparent, clean
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: SaaSTokens.primary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    controller.user?.initials ?? 'U',
                    style: const TextStyle(
                      fontSize: 12, color: Colors.white, fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        controller.user?.name ?? 'Conta',
                        style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600,
                          color: SaaSTokens.textTitle,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        controller.user?.email ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12, color: SaaSTokens.textDim,
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(
                  width: 32, height: 32,
                  child: IconButton(
                    onPressed: () async => controller.signOut(),
                    icon: const Icon(LucideIcons.logOut, size: 15, color: SaaSTokens.textDim),
                    padding: EdgeInsets.zero,
                  ),
                ),
              ],
            ),
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
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

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
            : SaaSTokens.textMuted;

    return MouseRegion(
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
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              // Animated left accent bar
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
              SizedBox(width: active ? 11 : 14),
              SizedBox(
                width: 22,
                height: 22,
                child: Icon(widget.icon, size: 18, color: fg),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  widget.label,
                  style: TextStyle(
                    fontSize: 14,
                    color: fg,
                    fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
              // Subtle badge dot for active
              if (active)
                Container(
                  width: 6,
                  height: 6,
                  margin: const EdgeInsets.only(right: 14),
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
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Skeleton Shimmer Loading — replaces spinner for company list
// ─────────────────────────────────────────────────────────────
class _SkeletonCompanyList extends StatefulWidget {
  @override
  State<_SkeletonCompanyList> createState() => _SkeletonCompanyListState();
}

class _SkeletonCompanyListState extends State<_SkeletonCompanyList>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, _) {
        final opacity = 0.04 + (_ctrl.value * 0.08);
        return ListView(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: List.generate(3, (i) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Container(
                height: 52,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: SaaSTokens.textDim.withOpacity(opacity),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 12, height: 12,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: SaaSTokens.textDim.withOpacity(opacity + 0.04),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 100 + (i * 20.0),
                          height: 12,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(4),
                            color: SaaSTokens.textDim.withOpacity(opacity + 0.03),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Container(
                          width: 60 + (i * 10.0),
                          height: 8,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(3),
                            color: SaaSTokens.textDim.withOpacity(opacity),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          }),
        );
      },
    );
  }
}

class _ShellContextPanel extends StatelessWidget {
  const _ShellContextPanel({required this.controller});

  final AppController controller;

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
          Text(
            'Acesso Rapido',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 18),
          _buildContextCard(
            icon: LucideIcons.bellRing,
            title: 'Avisos da Plataforma',
            body: 'Nenhuma nova atualizacao no sistema Global Sync.',
          ),
          const SizedBox(height: 16),
          _buildContextCard(
            icon: controller.repository.remoteEnabled ? LucideIcons.wifi : LucideIcons.wifiOff,
            title: 'Status da Conexao',
            body: controller.repository.remoteEnabled
                ? 'Conectado a nuvem oficial. Dados sincronizados com sucesso.'
                : 'Modo offline. Verifique sua conexao.',
          ),
          const SizedBox(height: 16),
          FutureBuilder<List<ModuleDefinition>>(
            future: controller.repository.getModules(),
            builder: (context, snapshot) {
              final modules = snapshot.data ?? const <ModuleDefinition>[];
              final selectedModule = controller.selectedModuleKey == null
                  ? null
                  : modules.firstWhere(
                      (module) => module.key == controller.selectedModuleKey,
                      orElse: () => modules.isEmpty
                          ? ModuleDefinition(
                              key: '',
                              label: 'Modulo ativo',
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
                          : 'Modulo ativo'),
                body: controller.selectedCompanyId != null
                    ? 'Visualizando as configuracoes e informacoes corporativas exclusivas da Global Sync.'
                    : selectedModule?.description.isNotEmpty == true
                    ? selectedModule!.description
                    : 'O painel exibira filtros e atalhos conforme voce navega pelos modulos.',
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
            Text(
              title, 
              style: const TextStyle(
                fontSize: 13, 
                fontWeight: FontWeight.w700, 
                color: SaaSTokens.primary,
                letterSpacing: -0.2,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          body, 
          style: const TextStyle(
            fontSize: 13, 
            color: SaaSTokens.textBody,
            height: 1.4,
          ),
        ),
      ],
    );
  }
}
