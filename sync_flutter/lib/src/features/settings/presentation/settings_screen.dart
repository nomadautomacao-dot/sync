import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/theme/app_theme.dart';
import '../../shared/presentation/shared_widgets.dart';

/// Prefixo de dominio exibido dentro do campo de slug (chrome de marca,
/// definido pelo design — nao vem do repositorio).
const _slugDomainPrefix = 'app.globalsync.com.br/';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.repository,
  });

  final SyncRepository repository;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController groupNameController;
  late final TextEditingController slugController;
  late Future<WorkspaceSettings> future;
  late Future<List<CollaboratorSummary>> rolesFuture;
  late Future<List<AuditEntry>> auditFuture;

  WorkspaceSettings? currentSettings;
  bool isSaving = false;

  /// Rascunho das flags booleanas guardadas em `rawSettings`.
  final Map<String, bool> draftFlags = <String, bool>{};

  /// Evita que o `setState` do listener rode enquanto o build sincroniza
  /// os controllers com o valor persistido.
  bool _adopting = false;

  final ScrollController _contentScroll = ScrollController();
  final Map<String, GlobalKey> _sectionKeys = <String, GlobalKey>{};
  String _activeSectionId = 'grupo';

  @override
  void initState() {
    super.initState();
    groupNameController = TextEditingController();
    slugController = TextEditingController();
    groupNameController.addListener(_onDraftChanged);
    slugController.addListener(_onDraftChanged);
    future = widget.repository.getWorkspaceSettings();
    rolesFuture = widget.repository.getCollaborators();
    auditFuture = widget.repository.getAudit(limit: 8);
  }

  @override
  void dispose() {
    groupNameController.dispose();
    slugController.dispose();
    _contentScroll.dispose();
    super.dispose();
  }

  void _onDraftChanged() {
    if (_adopting || !mounted) return;
    setState(() {});
  }

  void _adopt(WorkspaceSettings settings) {
    _adopting = true;
    currentSettings = settings;
    groupNameController.text = settings.groupName;
    slugController.text = settings.slug;
    draftFlags
      ..clear()
      ..addEntries(
        settings.rawSettings.entries
            .where((entry) => entry.value is bool)
            .map((entry) => MapEntry(entry.key, entry.value as bool)),
      );
    _adopting = false;
  }

  int get _pendingChanges {
    final current = currentSettings;
    if (current == null) return 0;
    var count = 0;
    if (groupNameController.text.trim() != current.groupName) count++;
    if (slugController.text.trim() != current.slug) count++;
    draftFlags.forEach((key, value) {
      if (current.rawSettings[key] != value) count++;
    });
    return count;
  }

  void _discard() {
    final current = currentSettings;
    if (current == null) return;
    setState(() => _adopt(current));
  }

  void _reload() {
    setState(() {
      future = widget.repository.getWorkspaceSettings();
      rolesFuture = widget.repository.getCollaborators();
      auditFuture = widget.repository.getAudit(limit: 8);
    });
  }

  Future<void> _save() async {
    final current = currentSettings;
    if (current == null) return;

    setState(() => isSaving = true);
    try {
      final rawSettings = Map<String, dynamic>.from(current.rawSettings)
        ..addAll(draftFlags);
      final updated = await widget.repository.updateWorkspaceSettings(
        WorkspaceSettings(
          id: current.id,
          groupName: groupNameController.text.trim(),
          slug: slugController.text.trim(),
          rawSettings: rawSettings,
        ),
      );
      if (!mounted) return;
      _adopt(updated);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Configurações salvas com sucesso.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    } finally {
      if (mounted) {
        setState(() => isSaving = false);
      }
    }
  }

  Future<void> _copyWorkspaceId(String id) async {
    await Clipboard.setData(ClipboardData(text: id));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('ID do workspace copiado.')),
    );
  }

  void _goToSection(String id) {
    setState(() => _activeSectionId = id);
    final key = _sectionKeys[id];
    final target = key?.currentContext;
    if (target == null) return;
    Scrollable.ensureVisible(
      target,
      duration: const Duration(milliseconds: 240),
      curve: Curves.easeOutCubic,
      alignment: 0.02,
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<WorkspaceSettings>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: SyncSurfaceCard(
              radius: SaaSTokens.rCard,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Falha ao carregar configurações',
                    style: GsText.panelTitle,
                  ),
                  const SizedBox(height: 8),
                  Text(snapshot.error.toString(), style: GsText.body),
                  const SizedBox(height: 16),
                  OutlinedButton(
                    onPressed: _reload,
                    child: const Text('Tentar novamente'),
                  ),
                ],
              ),
            ),
          );
        }

        final settings = snapshot.data!;
        if (currentSettings?.id != settings.id) {
          _adopt(settings);
        }

        final sections = _buildSections(settings);
        for (final section in sections) {
          _sectionKeys.putIfAbsent(section.id, GlobalKey.new);
        }
        if (!sections.any((section) => section.id == _activeSectionId)) {
          _activeSectionId = sections.first.id;
        }

        return LayoutBuilder(
          builder: (context, constraints) {
            final stacked = constraints.maxWidth < 900;
            final index = _SettingsIndex(
              sections: sections,
              activeId: _activeSectionId,
              horizontal: stacked,
              onSelect: _goToSection,
            );
            final content = _content(sections);

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _actionBar(stacked),
                Expanded(
                  child: stacked
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [index, Expanded(child: content)],
                        )
                      : Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            SizedBox(width: 212, child: index),
                            Expanded(child: content),
                          ],
                        ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // ── Barra de acao ───────────────────────────────────────────

  Widget _actionBar(bool stacked) {
    final pending = _pendingChanges;

    final title = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text('WORKSPACE', style: GsText.label),
        const SizedBox(height: 2),
        Text(
          'Configurações',
          style: GsText.cardTitleSm,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );

    final refresh = IconButton(
      onPressed: isSaving ? null : _reload,
      tooltip: 'Atualizar',
      icon: const Icon(
        Icons.refresh_rounded,
        size: 19,
        color: SaaSTokens.textDim,
      ),
    );

    final actions = <Widget>[
      if (pending > 0) ...[
        if (stacked)
          Flexible(child: _PendingBadge(count: pending))
        else
          _PendingBadge(count: pending),
        const SizedBox(width: 10),
      ],
      OutlinedButton(
        onPressed: pending == 0 || isSaving ? null : _discard,
        child: const Text('Descartar'),
      ),
      const SizedBox(width: 8),
      ElevatedButton.icon(
        onPressed: pending == 0 || isSaving ? null : _save,
        icon: Icon(
          isSaving ? Icons.hourglass_top_rounded : Icons.check_rounded,
          size: 17,
        ),
        label: Text(isSaving ? 'Salvando...' : 'Salvar'),
      ),
    ];

    return Container(
      decoration: const BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border(bottom: BorderSide(color: SaaSTokens.borderLight)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
      child: stacked
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(child: title),
                    refresh,
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: actions,
                ),
              ],
            )
          : Row(
              children: [
                Expanded(child: title),
                refresh,
                const SizedBox(width: 4),
                ...actions,
              ],
            ),
    );
  }

  // ── Conteudo ────────────────────────────────────────────────

  Widget _content(List<_SectionSpec> sections) {
    return SingleChildScrollView(
      controller: _contentScroll,
      padding: const EdgeInsets.fromLTRB(24, 22, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < sections.length; i++) ...[
            if (i > 0) const SizedBox(height: 26),
            KeyedSubtree(
              key: _sectionKeys[sections[i].id],
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(sections[i].title, style: GsText.pageTitle),
                  const SizedBox(height: 4),
                  Text(
                    sections[i].description,
                    style: GsText.bodyMedium.copyWith(
                      color: SaaSTokens.textMuted,
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                  const SizedBox(height: 14),
                  for (var c = 0; c < sections[i].cards.length; c++) ...[
                    if (c > 0) const SizedBox(height: 14),
                    sections[i].cards[c],
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  List<_SectionSpec> _buildSections(WorkspaceSettings settings) {
    final flagKeys = settings.rawSettings.entries
        .where((entry) => entry.value is bool)
        .map((entry) => entry.key)
        .toList(growable: false);
    final otherEntries = settings.rawSettings.entries
        .where((entry) => entry.value is! bool)
        .toList(growable: false);

    // Nao existe no repositorio um status de saude das fontes publicas
    // (FNDE, INEP, IBGE, SICONFI, QEdu) no nivel do workspace — o
    // `FonteColetaStatus` do modulo FUNDEB e por municipio, nao por grupo.
    // TODO(redesign): secao "Fontes de dados" ainda nao existe no repositorio.
    // Pelo mesmo motivo "Documentos" e "Seguranca" ficam fora do indice.

    return <_SectionSpec>[
      _SectionSpec(
        id: 'grupo',
        label: 'Grupo e marca',
        icon: Icons.badge_outlined,
        title: 'Grupo e marca',
        description:
            'Identificação usada nos relatórios, propostas e no cabeçalho do app',
        cards: [_groupCard(settings)],
      ),
      if (flagKeys.isNotEmpty)
        _SectionSpec(
          id: 'automacao',
          label: 'Automação',
          icon: Icons.bolt_outlined,
          title: 'Automação',
          description: 'Rotinas ligadas neste workspace',
          cards: [_automationCard(flagKeys)],
        ),
      if (otherEntries.isNotEmpty)
        _SectionSpec(
          id: 'persistida',
          label: 'Config. persistida',
          icon: Icons.data_object_rounded,
          title: 'Configuração persistida',
          description: 'Campos extras preservados no backend do workspace',
          cards: [_rawSettingsCard(otherEntries)],
        ),
      _SectionSpec(
        id: 'papeis',
        label: 'Papéis e acessos',
        icon: Icons.admin_panel_settings_outlined,
        title: 'Papéis e acessos',
        description: 'Papéis em uso pelas pessoas cadastradas no grupo',
        cards: [_rolesCard()],
      ),
      _SectionSpec(
        id: 'auditoria',
        label: 'Auditoria',
        icon: Icons.history_rounded,
        title: 'Auditoria',
        description: 'Últimas ações registradas no workspace',
        cards: [_auditCard()],
      ),
    ];
  }

  // ── Grupo e marca ───────────────────────────────────────────

  Widget _groupCard(WorkspaceSettings settings) {
    return SyncSurfaceCard(
      radius: SaaSTokens.rCard,
      padding: const EdgeInsets.all(20),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final twoUp = constraints.maxWidth >= 620;
          final fields = <Widget>[
            _Field(
              label: 'NOME DO GRUPO',
              child: TextField(
                controller: groupNameController,
                style: GsText.bodyMedium.copyWith(
                  color: SaaSTokens.textTitle,
                  fontWeight: FontWeight.w400,
                ),
                decoration: const InputDecoration(
                  hintText: 'Nome do grupo',
                ),
              ),
            ),
            _Field(
              label: 'SLUG',
              child: TextField(
                controller: slugController,
                style: GsText.data.copyWith(
                  fontSize: 14,
                  color: SaaSTokens.textTitle,
                ),
                decoration: InputDecoration(
                  hintText: 'slug-do-grupo',
                  prefixIcon: Padding(
                    padding: const EdgeInsets.only(left: 13, right: 2),
                    child: Text(
                      _slugDomainPrefix,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GsText.dataXs.copyWith(
                        color: SaaSTokens.textDim,
                      ),
                    ),
                  ),
                  prefixIconConstraints: const BoxConstraints(
                    minWidth: 0,
                    maxWidth: 160,
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 14,
                  ),
                ),
              ),
            ),
            _Field(
              label: 'ID DO WORKSPACE',
              child: Container(
                height: 48,
                decoration: BoxDecoration(
                  color: SaaSTokens.surfaceSubtle,
                  border: Border.all(color: SaaSTokens.borderLight),
                  borderRadius: BorderRadius.circular(SaaSTokens.rControl),
                ),
                padding: const EdgeInsets.only(left: 13, right: 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        settings.id,
                        style: GsText.data,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      onPressed: () => _copyWorkspaceId(settings.id),
                      tooltip: 'Copiar ID',
                      constraints: const BoxConstraints(
                        minWidth: 40,
                        minHeight: 40,
                      ),
                      icon: const Icon(
                        Icons.content_copy_rounded,
                        size: 17,
                        color: SaaSTokens.textDim,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            _Field(
              label: 'MARCA NOS DOCUMENTOS',
              // TODO(redesign): upload de logo do workspace ainda nao existe
              // no repositorio (`setCompanyLogo` e por empresa, nao por grupo).
              // Exibimos a marca que o app realmente embarca no bundle.
              child: SizedBox(
                height: 48,
                child: Row(
                  children: [
                    Image.asset(
                      'assets/branding/global-sync-icon.png',
                      width: 32,
                      height: 32,
                      errorBuilder: (context, error, stack) => const Icon(
                        Icons.image_not_supported_outlined,
                        size: 24,
                        color: SaaSTokens.textDim,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'global-sync-icon · png',
                      style: GsText.dataXs.copyWith(
                        color: SaaSTokens.textDim,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ];

          if (!twoUp) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < fields.length; i++) ...[
                  if (i > 0) const SizedBox(height: 18),
                  fields[i],
                ],
              ],
            );
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: fields[0]),
                  const SizedBox(width: 18),
                  Expanded(child: fields[1]),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: fields[2]),
                  const SizedBox(width: 18),
                  Expanded(child: fields[3]),
                ],
              ),
            ],
          );
        },
      ),
    );
  }

  // ── Automacao ───────────────────────────────────────────────

  Widget _automationCard(List<String> flagKeys) {
    return SyncSurfaceCard(
      radius: SaaSTokens.rCard,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Automação', style: GsText.cardTitle),
          const SizedBox(height: 14),
          for (var i = 0; i < flagKeys.length; i++) ...[
            if (i > 0)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 14),
                child: Divider(height: 1, color: SaaSTokens.surfaceAlt),
              ),
            _ToggleRow(
              // TODO(redesign): o repositorio guarda so a flag booleana em
              // `rawSettings`; titulo e descricao editorial de cada automacao
              // ainda nao existem, entao mostramos a chave tecnica.
              title: _humanizeKey(flagKeys[i]),
              technicalKey: flagKeys[i],
              value: draftFlags[flagKeys[i]] ?? false,
              onChanged: (value) => setState(() {
                draftFlags[flagKeys[i]] = value;
              }),
            ),
          ],
        ],
      ),
    );
  }

  Widget _rawSettingsCard(List<MapEntry<String, dynamic>> entries) {
    return SyncSurfaceCard(
      radius: SaaSTokens.rCard,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < entries.length; i++) ...[
            if (i > 0)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Divider(height: 1, color: SaaSTokens.surfaceAlt),
              ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 180,
                  child: Text(
                    entries[i].key.toUpperCase(),
                    style: GsText.label,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    '${entries[i].value}',
                    style: GsText.data,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  // ── Papeis e acessos ────────────────────────────────────────

  Widget _rolesCard() {
    return FutureBuilder<List<CollaboratorSummary>>(
      future: rolesFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const _CardMessage(text: 'Carregando papéis...');
        }
        if (snapshot.hasError) {
          return _CardMessage(text: snapshot.error.toString());
        }

        final buckets = _aggregateRoles(snapshot.data ?? const []);
        if (buckets.isEmpty) {
          return const _CardMessage(
            text: 'Nenhuma pessoa cadastrada no grupo ainda.',
          );
        }

        return SyncSurfaceCard(
          radius: SaaSTokens.rCard,
          padding: EdgeInsets.zero,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(SaaSTokens.rCard),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      const Expanded(
                        child: Text('Papéis e acessos', style: GsText.cardTitle),
                      ),
                      Text(
                        '${buckets.length} papéis',
                        style: GsText.dataXs,
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: SaaSTokens.borderLight),
                Container(
                  color: SaaSTokens.surfaceSubtle,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 10,
                  ),
                  child: const Row(
                    children: [
                      Expanded(flex: 15, child: Text('PAPEL', style: GsText.label)),
                      Expanded(
                        flex: 26,
                        child: Text('ALCANCE', style: GsText.label),
                      ),
                      Expanded(
                        flex: 8,
                        child: Text(
                          'PESSOAS',
                          style: GsText.label,
                          textAlign: TextAlign.right,
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: SaaSTokens.borderLight),
                for (var i = 0; i < buckets.length; i++) ...[
                  if (i > 0)
                    const Divider(height: 1, color: SaaSTokens.surfaceAlt),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 11,
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          flex: 15,
                          child: Text(buckets[i].role, style: GsText.bodyStrong),
                        ),
                        Expanded(
                          flex: 26,
                          child: Text(
                            buckets[i].scope,
                            style: GsText.body.copyWith(
                              color: SaaSTokens.textMuted,
                            ),
                          ),
                        ),
                        Expanded(
                          flex: 8,
                          child: Text(
                            '${buckets[i].people}',
                            style: GsText.data,
                            textAlign: TextAlign.right,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  /// Agrega os papeis reais das pessoas cadastradas.
  ///
  /// O repositorio nao tem uma tabela de RBAC com descricao de alcance por
  /// papel; o alcance abaixo e derivado da cobertura real de cada grupo de
  /// pessoas (cidades atendidas e UFs).
  // TODO(redesign): descricao editorial de alcance por papel ainda nao existe
  // no repositorio.
  List<_RoleRow> _aggregateRoles(List<CollaboratorSummary> people) {
    final buckets = <String, _RoleAccumulator>{};
    for (final person in people) {
      final role = person.role.trim().isEmpty
          ? 'Sem papel definido'
          : person.role.trim();
      final bucket = buckets.putIfAbsent(role, _RoleAccumulator.new);
      bucket.people++;
      bucket.cities += person.cities;
      final uf = person.state.trim().toUpperCase();
      if (uf.isNotEmpty) bucket.ufs.add(uf);
    }

    final rows = buckets.entries.map((entry) {
      final ufs = entry.value.ufs.toList()..sort();
      final scope = StringBuffer('${entry.value.cities} cidades');
      if (ufs.isNotEmpty) {
        final shown = ufs.take(6).join(', ');
        scope.write(' · $shown');
        if (ufs.length > 6) scope.write(' +${ufs.length - 6}');
      }
      return _RoleRow(
        role: entry.key,
        scope: scope.toString(),
        people: entry.value.people,
      );
    }).toList();

    rows.sort((a, b) => b.people.compareTo(a.people));
    return rows;
  }

  // ── Auditoria ───────────────────────────────────────────────

  Widget _auditCard() {
    return FutureBuilder<List<AuditEntry>>(
      future: auditFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const _CardMessage(text: 'Carregando auditoria...');
        }
        if (snapshot.hasError) {
          return _CardMessage(text: snapshot.error.toString());
        }

        final entries = snapshot.data ?? const <AuditEntry>[];
        if (entries.isEmpty) {
          return const _CardMessage(text: 'Nenhuma acao registrada ainda.');
        }

        return SyncSurfaceCard(
          radius: SaaSTokens.rCard,
          padding: EdgeInsets.zero,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(SaaSTokens.rCard),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  color: SaaSTokens.surfaceSubtle,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 10,
                  ),
                  child: const Row(
                    children: [
                      Expanded(child: Text('AÇÃO', style: GsText.label)),
                      SizedBox(width: 12),
                      Text('QUANDO', style: GsText.label),
                    ],
                  ),
                ),
                const Divider(height: 1, color: SaaSTokens.borderLight),
                for (var i = 0; i < entries.length; i++) ...[
                  if (i > 0)
                    const Divider(height: 1, color: SaaSTokens.surfaceAlt),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 11,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(entries[i].action, style: GsText.body),
                        ),
                        const SizedBox(width: 12),
                        Text(entries[i].createdAt, style: GsText.dataXs),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

/// `reportEngine` → `Report engine`, `weekly_digest` → `Weekly digest`.
String _humanizeKey(String key) {
  final buffer = StringBuffer();
  for (var i = 0; i < key.length; i++) {
    final char = key[i];
    if (char == '_' || char == '-' || char == '.') {
      buffer.write(' ');
      continue;
    }
    final isUpper = char.toUpperCase() == char && char.toLowerCase() != char;
    if (isUpper && i > 0 && buffer.isNotEmpty && !buffer.toString().endsWith(' ')) {
      buffer.write(' ');
    }
    buffer.write(char.toLowerCase());
  }
  final text = buffer.toString().trim();
  if (text.isEmpty) return key;
  return text[0].toUpperCase() + text.substring(1);
}

// ─────────────────────────────────────────────────────────────
// Indice de ajustes
// ─────────────────────────────────────────────────────────────
class _SettingsIndex extends StatelessWidget {
  const _SettingsIndex({
    required this.sections,
    required this.activeId,
    required this.horizontal,
    required this.onSelect,
  });

  final List<_SectionSpec> sections;
  final String activeId;
  final bool horizontal;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    if (horizontal) {
      return Container(
        decoration: const BoxDecoration(
          color: SaaSTokens.cardWhite,
          border: Border(bottom: BorderSide(color: SaaSTokens.borderLight)),
        ),
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(left: 4, bottom: 8),
              child: Text('AJUSTES', style: GsText.label),
            ),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final section in sections)
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: _IndexItem(
                        section: section,
                        active: section.id == activeId,
                        shrinkWrap: true,
                        onTap: () => onSelect(section.id),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      decoration: const BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border(right: BorderSide(color: SaaSTokens.borderLight)),
      ),
      padding: const EdgeInsets.fromLTRB(12, 18, 12, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Padding(
            padding: EdgeInsets.only(left: 10, bottom: 8),
            child: Text('AJUSTES', style: GsText.label),
          ),
          for (final section in sections)
            Padding(
              padding: const EdgeInsets.only(bottom: 3),
              child: _IndexItem(
                section: section,
                active: section.id == activeId,
                shrinkWrap: false,
                onTap: () => onSelect(section.id),
              ),
            ),
        ],
      ),
    );
  }
}

class _IndexItem extends StatelessWidget {
  const _IndexItem({
    required this.section,
    required this.active,
    required this.shrinkWrap,
    required this.onTap,
  });

  final _SectionSpec section;
  final bool active;
  final bool shrinkWrap;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final foreground = active ? SaaSTokens.primaryHover : SaaSTokens.textBody;
    final label = Text(
      section.label,
      style: GsText.body.copyWith(
        color: foreground,
        fontWeight: active ? FontWeight.w600 : FontWeight.w400,
      ),
      overflow: TextOverflow.ellipsis,
    );

    return Material(
      color: active ? SaaSTokens.primaryLight : Colors.transparent,
      borderRadius: BorderRadius.circular(SaaSTokens.rControl),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(SaaSTokens.rControl),
        child: Container(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Row(
            mainAxisSize: shrinkWrap ? MainAxisSize.min : MainAxisSize.max,
            children: [
              Icon(
                section.icon,
                size: 17,
                color: active ? SaaSTokens.primary : SaaSTokens.textDim,
              ),
              const SizedBox(width: 9),
              if (shrinkWrap) label else Expanded(child: label),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Pecas de apoio
// ─────────────────────────────────────────────────────────────
class _PendingBadge extends StatelessWidget {
  const _PendingBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: SaaSTokens.warningLight,
        border: Border.all(color: SaaSTokens.warningBorder),
        borderRadius: BorderRadius.circular(SaaSTokens.rPill),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.edit_outlined,
            size: 15,
            color: SaaSTokens.warningDark,
          ),
          const SizedBox(width: 7),
          Flexible(
            child: Text(
              count == 1
                  ? '1 alteração não salva'
                  : '$count alterações não salvas',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GsText.dataXs.copyWith(color: SaaSTokens.warningDark),
            ),
          ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: GsText.fieldLabel),
        const SizedBox(height: 7),
        child,
      ],
    );
  }
}

class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.title,
    required this.technicalKey,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final String technicalKey;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(SaaSTokens.rChip),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 140),
                width: 40,
                height: 22,
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  color: value ? SaaSTokens.primary : SaaSTokens.borderLight,
                  borderRadius: BorderRadius.circular(SaaSTokens.rPill),
                ),
                alignment:
                    value ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  width: 16,
                  height: 16,
                  decoration: const BoxDecoration(
                    color: SaaSTokens.cardWhite,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GsText.bodyStrong.copyWith(
                      color: value
                          ? SaaSTokens.textTitle
                          : SaaSTokens.textMuted,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    technicalKey,
                    style: GsText.dataXs.copyWith(
                      color: value ? SaaSTokens.textMuted : SaaSTokens.textDim,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CardMessage extends StatelessWidget {
  const _CardMessage({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return SyncSurfaceCard(
      radius: SaaSTokens.rCard,
      padding: const EdgeInsets.all(20),
      child: Text(text, style: GsText.body),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Modelos internos de apresentacao
// ─────────────────────────────────────────────────────────────
class _SectionSpec {
  const _SectionSpec({
    required this.id,
    required this.label,
    required this.icon,
    required this.title,
    required this.description,
    required this.cards,
  });

  final String id;
  final String label;
  final IconData icon;
  final String title;
  final String description;
  final List<Widget> cards;
}

class _RoleAccumulator {
  int people = 0;
  int cities = 0;
  final Set<String> ufs = <String>{};
}

class _RoleRow {
  const _RoleRow({
    required this.role,
    required this.scope,
    required this.people,
  });

  final String role;
  final String scope;
  final int people;
}
