import 'package:flutter/material.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/theme/app_theme.dart';
import '../../shared/presentation/shared_widgets.dart';
import 'collaborator_detail_screen.dart';
import 'new_collaborator_dialog.dart';

/// Filtro de vinculo do segmentado (todos / parceiros / internos).
enum _LinkFilter { todos, parceiros, internos }

/// Par de cores de uma semantica de status: fundo claro + texto escuro.
class _Tone {
  const _Tone(this.background, this.foreground);

  final Color background;
  final Color foreground;
}

class PeopleScreen extends StatefulWidget {
  const PeopleScreen({
    super.key,
    required this.repository,
  });

  final SyncRepository repository;

  @override
  State<PeopleScreen> createState() => _PeopleScreenState();
}

class _PeopleScreenState extends State<PeopleScreen> {
  /// Largura minima da tabela antes de rolar na horizontal — abaixo disso as
  /// colunas de dinheiro deixariam de caber sem quebrar linha.
  static const double _tableMinWidth = 940;

  static const _colName = 240;
  static const _colLink = 95;
  static const _colState = 46;
  static const _colCities = 60;
  static const _colFidelized = 70;
  static const _colProfit = 105;
  static const _colCommission = 105;
  static const _colStatus = 78;
  static const double _colChevron = 40;

  String search = '';
  _LinkFilter linkFilter = _LinkFilter.todos;
  late Future<List<CollaboratorSummary>> future;

  @override
  void initState() {
    super.initState();
    future = widget.repository.getCollaborators();
  }

  void _reload() {
    setState(() {
      future = widget.repository.getCollaborators();
    });
  }

  /// "R$ 4,82M" / "R$ 726,4K" — mesma escala compacta do dashboard.
  String _formatCurrency(double value) {
    final abs = value.abs();
    if (abs >= 1000000) {
      return 'R\$ ${(value / 1000000).toStringAsFixed(2).replaceAll('.', ',')}M';
    }
    if (abs >= 1000) {
      return 'R\$ ${(value / 1000).toStringAsFixed(1).replaceAll('.', ',')}K';
    }
    return 'R\$ ${value.toStringAsFixed(0)}';
  }

  // TODO(redesign): o repositorio nao expoe um campo proprio de vinculo
  // (interno x parceiro); ele e derivado do rotulo de `type`.
  bool _isInternal(CollaboratorSummary item) {
    final type = item.type.toLowerCase();
    return type.contains('interno') ||
        type.contains('sponsor') ||
        type.contains('suporte');
  }

  String _linkLabel(CollaboratorSummary item) =>
      _isInternal(item) ? 'Interno' : 'Parceiro';

  _Tone _statusTone(String status) {
    final value = status.toLowerCase();
    if (value.contains('inativ') ||
        value.contains('encerrad') ||
        value.contains('desligad')) {
      return const _Tone(SaaSTokens.surfaceAlt, SaaSTokens.textMuted);
    }
    if (value.contains('ativo')) {
      return const _Tone(SaaSTokens.successLight, SaaSTokens.successDark);
    }
    if (value.contains('pend') ||
        value.contains('vencid') ||
        value.contains('pausad') ||
        value.contains('bloquead')) {
      return const _Tone(SaaSTokens.warningLight, SaaSTokens.warningDarker);
    }
    return const _Tone(SaaSTokens.primaryLight, SaaSTokens.primaryHover);
  }

  bool _isInactive(String status) {
    final value = status.toLowerCase();
    return value.contains('inativ') ||
        value.contains('encerrad') ||
        value.contains('desligad');
  }

  /// Aviso que a linha carrega no papel — pendencia documental, contrato
  /// pausado, cadastro bloqueado.
  ///
  // TODO(redesign): vencimento de documento ainda nao existe no repositorio
  // como campo do resumo; o aviso e derivado do proprio status da parceria.
  String? _rowAlert(String status) {
    final value = status.toLowerCase();
    if (value.contains('pend') ||
        value.contains('vencid') ||
        value.contains('pausad') ||
        value.contains('bloquead')) {
      return value;
    }
    return null;
  }

  String _initials(String fullName) {
    final parts = fullName
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '--';
    if (parts.length == 1) {
      final single = parts.first;
      return (single.length > 1 ? single.substring(0, 2) : single).toUpperCase();
    }
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<CollaboratorSummary>>(
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
                  Text('Falha ao carregar colaboradores', style: GsText.panelTitle),
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

        final collaborators = snapshot.data!;
        final filtered = collaborators.where((item) {
          final matchesSearch = search.isEmpty ||
              item.fullName.toLowerCase().contains(search.toLowerCase()) ||
              item.role.toLowerCase().contains(search.toLowerCase()) ||
              item.state.toLowerCase().contains(search.toLowerCase());
          final matchesLink = switch (linkFilter) {
            _LinkFilter.todos => true,
            _LinkFilter.internos => _isInternal(item),
            _LinkFilter.parceiros => !_isInternal(item),
          };
          return matchesSearch && matchesLink;
        }).toList()
          ..sort((a, b) => b.profitYtd.compareTo(a.profitYtd));

        final activeCount =
            collaborators.where((item) => item.status == 'Ativo').length;
        final cityCount =
            collaborators.fold<int>(0, (sum, item) => sum + item.cities);
        final profit =
            collaborators.fold<double>(0, (sum, item) => sum + item.profitYtd);
        final commission = collaborators.fold<double>(
            0, (sum, item) => sum + item.commissionYtd);

        // TODO(redesign): o painel "Documentos a regularizar" do mockup depende
        // de vencimentos de documento que o repositorio ainda nao entrega no
        // resumo de colaborador — por isso nao e renderizado aqui.

        return SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _header(context),
              const SizedBox(height: 16),
              _kpiBand(
                activeCount: activeCount,
                totalCount: collaborators.length,
                cityCount: cityCount,
                profit: profit,
                commission: commission,
              ),
              const SizedBox(height: 16),
              _networkPanel(filtered),
              const SizedBox(height: 16),
              _coveragePanel(filtered),
            ],
          ),
        );
      },
    );
  }

  // ── Cabecalho da pagina ──────────────────────────────────────
  Widget _header(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.end,
      spacing: 20,
      runSpacing: 16,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Colaboradores', style: GsText.pageTitle),
            const SizedBox(height: 4),
            Text(
              'Rede de articuladores e consultores por município',
              style: GsText.body.copyWith(color: SaaSTokens.textMuted),
            ),
          ],
        ),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            _segmentedFilter(),
            FilledButton.icon(
              onPressed: () async {
                final created = await showDialog<bool>(
                  context: context,
                  builder: (context) =>
                      NewCollaboratorDialog(repository: widget.repository),
                );
                if (created == true) {
                  _reload();
                }
              },
              icon: const Icon(Icons.person_add_alt_1_rounded, size: 17),
              label: const Text('Novo colaborador'),
              style: FilledButton.styleFrom(
                backgroundColor: SaaSTokens.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                minimumSize: const Size(0, 38),
                padding: const EdgeInsets.symmetric(horizontal: 15),
                textStyle: GsText.button,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(SaaSTokens.rControl),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _segmentedFilter() {
    const options = <_LinkFilter, String>{
      _LinkFilter.todos: 'todos',
      _LinkFilter.parceiros: 'parceiros',
      _LinkFilter.internos: 'internos',
    };

    return Container(
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border.all(color: SaaSTokens.borderLight),
        borderRadius: BorderRadius.circular(SaaSTokens.rControl),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final entry in options.entries)
            InkWell(
              onTap: () => setState(() => linkFilter = entry.key),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
                decoration: BoxDecoration(
                  color: linkFilter == entry.key
                      ? SaaSTokens.primary
                      : Colors.transparent,
                  border: entry.key == _LinkFilter.todos
                      ? null
                      : const Border(
                          left: BorderSide(color: SaaSTokens.borderLight),
                        ),
                ),
                child: Text(
                  entry.value,
                  style: linkFilter == entry.key
                      ? GsText.dataSm.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        )
                      : GsText.dataSm,
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ── Faixa de KPIs ────────────────────────────────────────────
  Widget _kpiBand({
    required int activeCount,
    required int totalCount,
    required int cityCount,
    required double profit,
    required double commission,
  }) {
    final tiles = <Widget>[
      _kpiTile(
        label: 'Colaboradores ativos',
        value: '$activeCount',
        support: 'de $totalCount',
      ),
      _kpiTile(label: 'Cidades associadas', value: '$cityCount'),
      _kpiTile(label: 'Lucro YTD', value: _formatCurrency(profit)),
      _kpiTile(label: 'Comissão prevista', value: _formatCurrency(commission)),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 12.0;
        final columns = constraints.maxWidth >= 880
            ? 4
            : constraints.maxWidth >= 460
                ? 2
                : 1;
        final itemWidth =
            (constraints.maxWidth - gap * (columns - 1)) / columns;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final tile in tiles) SizedBox(width: itemWidth, child: tile),
          ],
        );
      },
    );
  }

  Widget _kpiTile({
    required String label,
    required String value,
    String? support,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border.all(color: SaaSTokens.borderLight),
        borderRadius: BorderRadius.circular(SaaSTokens.rCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: GsText.label),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Flexible(
                child: Text(
                  value,
                  style: GsText.kpiLg,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (support != null) ...[
                const SizedBox(width: 6),
                Text(support, style: GsText.dataLg),
              ],
            ],
          ),
        ],
      ),
    );
  }

  // ── Painel "Rede" ────────────────────────────────────────────
  Widget _networkPanel(List<CollaboratorSummary> rows) {
    return Container(
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border.all(color: SaaSTokens.borderLight),
        borderRadius: BorderRadius.circular(SaaSTokens.rCard),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 12, 14, 12),
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: SaaSTokens.borderLight),
              ),
            ),
            child: Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 16,
              runSpacing: 12,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    const Text('Rede', style: GsText.cardTitle),
                    const SizedBox(width: 10),
                    Text(
                      '${rows.length} pessoas · ordenado por lucro YTD',
                      style: GsText.dataXs.copyWith(color: SaaSTokens.textDim),
                    ),
                  ],
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(width: 240, child: _searchField()),
                    const SizedBox(width: 8),
                    _ghostAction(label: 'atualizar', onTap: _reload),
                  ],
                ),
              ],
            ),
          ),
          LayoutBuilder(
            builder: (context, constraints) {
              final width = constraints.maxWidth < _tableMinWidth
                  ? _tableMinWidth
                  : constraints.maxWidth;
              final table = SizedBox(
                width: width,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _tableHeader(),
                    if (rows.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 32),
                        child: Center(
                          child: Text(
                            'Nenhum colaborador para este filtro.',
                            style: GsText.body
                                .copyWith(color: SaaSTokens.textMuted),
                          ),
                        ),
                      )
                    else
                      for (var i = 0; i < rows.length; i++)
                        _collaboratorRow(rows[i], last: i == rows.length - 1),
                  ],
                ),
              );

              if (constraints.maxWidth < _tableMinWidth) {
                return SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: table,
                );
              }
              return table;
            },
          ),
        ],
      ),
    );
  }

  Widget _searchField() {
    return TextField(
      onChanged: (value) => setState(() => search = value),
      style: GsText.body,
      decoration: InputDecoration(
        isDense: true,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        prefixIcon: const Icon(Icons.search_rounded, size: 17),
        prefixIconConstraints:
            const BoxConstraints(minWidth: 34, minHeight: 34),
        hintText: 'Nome, UF ou papel...',
        hintStyle: GsText.body.copyWith(color: SaaSTokens.textDim),
        filled: true,
        fillColor: SaaSTokens.cardWhite,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          borderSide: const BorderSide(color: SaaSTokens.borderLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          borderSide: const BorderSide(color: SaaSTokens.borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          borderSide: const BorderSide(color: SaaSTokens.primary, width: 1.5),
        ),
      ),
    );
  }

  Widget _ghostAction({required String label, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          border: Border.all(color: SaaSTokens.borderLight),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(label, style: GsText.dataXs),
      ),
    );
  }

  Widget _tableHeader() {
    return Container(
      decoration: const BoxDecoration(
        color: SaaSTokens.surfaceSubtle,
        border: Border(bottom: BorderSide(color: SaaSTokens.borderLight)),
      ),
      child: Row(
        children: [
          _headerCell('Colaborador',
              flex: _colName, padding: const EdgeInsets.fromLTRB(16, 10, 10, 10)),
          _headerCell('Vinculo', flex: _colLink),
          _headerCell('UF', flex: _colState),
          _headerCell('Cidades', flex: _colCities, alignEnd: true),
          _headerCell('Fidel.', flex: _colFidelized, alignEnd: true),
          _headerCell('Lucro YTD', flex: _colProfit, alignEnd: true),
          _headerCell('Comissão', flex: _colCommission, alignEnd: true),
          _headerCell('Status', flex: _colStatus),
          const SizedBox(width: _colChevron),
        ],
      ),
    );
  }

  Widget _headerCell(
    String label, {
    required int flex,
    bool alignEnd = false,
    EdgeInsets padding = const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
  }) {
    return Expanded(
      flex: flex,
      child: Padding(
        padding: padding,
        child: Text(
          label.toUpperCase(),
          style: GsText.label,
          textAlign: alignEnd ? TextAlign.right : TextAlign.left,
          maxLines: 1,
          overflow: TextOverflow.clip,
        ),
      ),
    );
  }

  Widget _collaboratorRow(CollaboratorSummary item, {required bool last}) {
    final tone = _statusTone(item.status);
    final inactive = _isInactive(item.status);
    final alert = _rowAlert(item.status);

    final nameColor = inactive ? SaaSTokens.textMuted : SaaSTokens.textTitle;
    final cellColor = inactive ? SaaSTokens.textDim : SaaSTokens.textBody;
    final softColor = inactive ? SaaSTokens.textDim : SaaSTokens.textMuted;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        hoverColor: SaaSTokens.surfaceSubtle,
        onTap: () async {
          final refresh = await Navigator.of(context).push<bool>(
            MaterialPageRoute(
              builder: (context) => CollaboratorDetailScreen(
                collaboratorId: item.id,
                repository: widget.repository,
              ),
            ),
          );
          if (refresh == true) {
            _reload();
          }
        },
        child: Container(
          decoration: BoxDecoration(
            border: last
                ? null
                : const Border(
                    bottom: BorderSide(color: SaaSTokens.scaffold),
                  ),
          ),
          child: Row(
            children: [
              Expanded(
                flex: _colName,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 10, 12),
                  child: Row(
                    children: [
                      _avatar(item, tone: tone, inactive: inactive),
                      const SizedBox(width: 11),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              item.fullName,
                              style: GsText.bodyStrong.copyWith(color: nameColor),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              alert == null ? item.role : '${item.role} · $alert',
                              style: GsText.bodySm.copyWith(
                                color: alert == null
                                    ? SaaSTokens.textDim
                                    : SaaSTokens.warningDark,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              _cell(
                flex: _colLink,
                child: Text(
                  _linkLabel(item),
                  style: GsText.body.copyWith(color: cellColor),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              _cell(
                flex: _colState,
                child: Text(
                  item.state.toUpperCase(),
                  style: GsText.data.copyWith(color: softColor),
                  maxLines: 1,
                ),
              ),
              _cell(
                flex: _colCities,
                alignEnd: true,
                child: Text(
                  '${item.cities}',
                  style: GsText.data.copyWith(color: cellColor),
                  textAlign: TextAlign.right,
                ),
              ),
              _cell(
                flex: _colFidelized,
                alignEnd: true,
                child: Text(
                  '${item.fidelized}',
                  style: GsText.data.copyWith(color: cellColor),
                  textAlign: TextAlign.right,
                ),
              ),
              _cell(
                flex: _colProfit,
                alignEnd: true,
                child: Text(
                  _formatCurrency(item.profitYtd),
                  style: GsText.dataStrong.copyWith(color: nameColor),
                  textAlign: TextAlign.right,
                  maxLines: 1,
                ),
              ),
              _cell(
                flex: _colCommission,
                alignEnd: true,
                child: Text(
                  _formatCurrency(item.commissionYtd),
                  style: GsText.data.copyWith(color: cellColor),
                  textAlign: TextAlign.right,
                  maxLines: 1,
                ),
              ),
              _cell(
                flex: _colStatus,
                child: _statusChip(item.status, tone),
              ),
              const SizedBox(
                width: _colChevron,
                child: Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: SaaSTokens.textDim,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _cell({
    required int flex,
    required Widget child,
    bool alignEnd = false,
  }) {
    return Expanded(
      flex: flex,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        child: Align(
          alignment: alignEnd ? Alignment.centerRight : Alignment.centerLeft,
          child: child,
        ),
      ),
    );
  }

  Widget _avatar(
    CollaboratorSummary item, {
    required _Tone tone,
    required bool inactive,
  }) {
    return Container(
      width: 34,
      height: 34,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: inactive ? SaaSTokens.surfaceAlt : tone.background,
        shape: BoxShape.circle,
      ),
      child: Text(
        _initials(item.fullName),
        style: GsText.dataXsStrong.copyWith(
          fontSize: 12,
          color: inactive ? SaaSTokens.textDim : tone.foreground,
        ),
      ),
    );
  }

  Widget _statusChip(String status, _Tone tone) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: tone.background,
        borderRadius: BorderRadius.circular(SaaSTokens.rChip),
      ),
      child: Text(
        status.toLowerCase(),
        style: GsText.chip.copyWith(
          color: tone.foreground,
          fontWeight: FontWeight.w600,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }

  // ── Painel "Cobertura por UF" ────────────────────────────────
  Widget _coveragePanel(List<CollaboratorSummary> rows) {
    final byState = <String, int>{};
    for (final item in rows) {
      final uf = item.state.trim().toUpperCase();
      if (uf.isEmpty || uf == '--') continue;
      byState[uf] = (byState[uf] ?? 0) + item.cities;
    }
    if (byState.isEmpty) return const SizedBox.shrink();

    final entries = byState.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final top = entries.take(6).toList();
    final max = top.first.value;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border.all(color: SaaSTokens.borderLight),
        borderRadius: BorderRadius.circular(SaaSTokens.rCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Cobertura por UF', style: GsText.cardTitleSm),
          const SizedBox(height: 12),
          for (final entry in top)
            Padding(
              padding: const EdgeInsets.only(bottom: 9),
              child: Row(
                children: [
                  SizedBox(
                    width: 26,
                    child: Text(entry.key, style: GsText.dataSm),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: max == 0 ? 0 : entry.value / max,
                        minHeight: 6,
                        backgroundColor: SaaSTokens.scaffold,
                        valueColor: const AlwaysStoppedAnimation<Color>(
                          SaaSTokens.primary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(
                    width: 52,
                    child: Text(
                      '${entry.value} cid.',
                      style: GsText.dataSm.copyWith(color: SaaSTokens.textBody),
                      textAlign: TextAlign.right,
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
