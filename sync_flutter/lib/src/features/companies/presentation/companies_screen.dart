import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/theme/app_theme.dart';
import 'new_company_dialog.dart';

/// Tom semantico da linha — e a UNICA cor da linha na tabela de cadastro.
enum _StatusTone { active, pending, inactive }

_StatusTone _toneFor(String status) {
  final value = status.toLowerCase();
  // "inativo" contem "ativo": a ordem dos testes importa.
  if (value.contains('inativ')) return _StatusTone.inactive;
  if (value.contains('pend')) return _StatusTone.pending;
  return _StatusTone.active;
}

/// Iniciais para o avatar quadrado (ate duas letras).
String _initialsOf(String name) {
  final parts = name
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) return '--';
  if (parts.length == 1) {
    final single = parts.first;
    return (single.length == 1 ? single : single.substring(0, 2)).toUpperCase();
  }
  return '${parts.first[0]}${parts[1][0]}'.toUpperCase();
}

class CompaniesScreen extends StatefulWidget {
  const CompaniesScreen({
    super.key,
    required this.repository,
    required this.onOpenCompany,
  });

  final SyncRepository repository;
  final ValueChanged<String> onOpenCompany;

  @override
  State<CompaniesScreen> createState() => _CompaniesScreenState();
}

class _CompaniesScreenState extends State<CompaniesScreen> {
  static const _statusFilters = ['Todos', 'Ativo', 'Inativo'];

  final searchController = TextEditingController();
  String status = 'Todos';
  late Future<List<CompanySummary>> companiesFuture;

  @override
  void initState() {
    super.initState();
    companiesFuture = _loadCompanies();
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  Future<List<CompanySummary>> _loadCompanies() {
    return widget.repository.getCompanies(
      search: searchController.text,
      status: status,
    );
  }

  void _refresh() {
    setState(() {
      companiesFuture = _loadCompanies();
    });
  }

  Future<void> _createCompany() async {
    final created = await showDialog<bool>(
      context: context,
      builder: (context) => NewCompanyDialog(repository: widget.repository),
    );
    if (created == true) _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _header(),
          const SizedBox(height: 18),
          FutureBuilder<List<CompanySummary>>(
            future: companiesFuture,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Padding(
                  padding: EdgeInsets.only(top: 28),
                  child: Center(child: CircularProgressIndicator()),
                );
              }

              if (snapshot.hasError) {
                return _errorPanel(snapshot.error.toString());
              }

              final companies = snapshot.data ?? const <CompanySummary>[];
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _kpiBand(companies),
                  const SizedBox(height: 16),
                  _registryTable(companies),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  // ── Cabecalho ────────────────────────────────────────────────
  Widget _header() {
    final titleBlock = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Empresas do grupo', style: GsText.pageTitle),
        const SizedBox(height: 4),
        Text(
          'Cadastro, módulos habilitados e responsáveis por CNPJ',
          style: GsText.body.copyWith(color: SaaSTokens.textMuted),
        ),
      ],
    );

    final controls = Wrap(
      spacing: 10,
      runSpacing: 10,
      alignment: WrapAlignment.end,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        _searchField(),
        _statusFilter(),
        _refreshButton(),
        ElevatedButton.icon(
          onPressed: _createCompany,
          icon: const Icon(Icons.add_rounded, size: 18),
          label: const Text('Nova empresa'),
        ),
      ],
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 1040) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              titleBlock,
              const SizedBox(height: 16),
              Align(alignment: Alignment.centerLeft, child: controls),
            ],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(child: titleBlock),
            const SizedBox(width: 20),
            controls,
          ],
        );
      },
    );
  }

  Widget _searchField() {
    // Sem altura fixa: o IconButton do sufixo ja garante os 48dp de alvo.
    return SizedBox(
      width: 268,
      child: TextField(
        controller: searchController,
        onSubmitted: (_) => _refresh(),
        style: GsText.body,
        decoration: InputDecoration(
          filled: true,
          fillColor: SaaSTokens.cardWhite,
          contentPadding: const EdgeInsets.symmetric(horizontal: 12),
          prefixIcon: const Icon(
            Icons.search_rounded,
            size: 18,
            color: SaaSTokens.textDim,
          ),
          prefixIconConstraints: const BoxConstraints(minWidth: 38),
          hintText: 'Nome, CNPJ ou segmento...',
          hintStyle: GsText.body.copyWith(color: SaaSTokens.textDim),
          suffixIcon: IconButton(
            onPressed: _refresh,
            tooltip: 'Buscar',
            icon: const Icon(
              Icons.arrow_forward_rounded,
              size: 18,
              color: SaaSTokens.textMuted,
            ),
          ),
          suffixIconConstraints: const BoxConstraints(minWidth: 40),
        ),
      ),
    );
  }

  Widget _statusFilter() {
    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        borderRadius: BorderRadius.circular(SaaSTokens.rControl),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('status:', style: GsText.dataSm),
          const SizedBox(width: 8),
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: status,
              isDense: true,
              dropdownColor: SaaSTokens.cardWhite,
              borderRadius: BorderRadius.circular(SaaSTokens.rControl),
              icon: const Icon(
                Icons.expand_more_rounded,
                size: 18,
                color: SaaSTokens.textDim,
              ),
              style: GsText.bodyStrong,
              items: _statusFilters
                  .map(
                    (item) => DropdownMenuItem(
                      value: item,
                      child: Text(item, style: GsText.bodyStrong),
                    ),
                  )
                  .toList(),
              onChanged: (value) {
                setState(() {
                  status = value ?? 'Todos';
                  companiesFuture = _loadCompanies();
                });
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _refreshButton() {
    return SizedBox(
      width: 48,
      height: 48,
      child: IconButton(
        onPressed: _refresh,
        tooltip: 'Atualizar',
        icon: const Icon(
          Icons.refresh_rounded,
          size: 18,
          color: SaaSTokens.textMuted,
        ),
        style: IconButton.styleFrom(
          backgroundColor: SaaSTokens.cardWhite,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(SaaSTokens.rControl),
            side: const BorderSide(color: SaaSTokens.borderLight),
          ),
        ),
      ),
    );
  }

  // ── Faixa de KPIs ────────────────────────────────────────────
  // Somente indicadores derivaveis da lista ja carregada entram aqui.
  // TODO(redesign): COLABORADORES ainda nao existe no repositorio
  //   (CompanySummary nao traz contagem de pessoas por empresa).
  // TODO(redesign): CONTRATOS VIGENTES ainda nao existe no repositorio.
  Widget _kpiBand(List<CompanySummary> companies) {
    final total = companies.length;
    final active = companies
        .where((item) => _toneFor(item.status) == _StatusTone.active)
        .length;
    final pending = companies
        .where((item) => _toneFor(item.status) == _StatusTone.pending)
        .length;

    final cards = <Widget>[
      _KpiCard(
        label: 'Empresas ativas',
        value: '$active',
        support: 'de $total',
      ),
      _KpiCard(
        label: 'Pendência cadastral',
        value: '$pending',
        valueColor: pending > 0 ? SaaSTokens.warningDark : null,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 560) {
          return Column(
            children: [
              for (var i = 0; i < cards.length; i++) ...[
                if (i > 0) const SizedBox(height: 12),
                cards[i],
              ],
            ],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < cards.length; i++) ...[
              if (i > 0) const SizedBox(width: 12),
              Expanded(child: cards[i]),
            ],
          ],
        );
      },
    );
  }

  // ── Tabela de cadastro ───────────────────────────────────────
  Widget _registryTable(List<CompanySummary> companies) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        borderRadius: BorderRadius.circular(SaaSTokens.rCard),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: SaaSTokens.borderLight),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Text('Cadastro', style: GsText.cardTitle),
                const SizedBox(width: 10),
                Flexible(
                  child: Text(
                    '${companies.length} empresa(s) encontrada(s)',
                    style: GsText.dataXs.copyWith(color: SaaSTokens.textDim),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          if (companies.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
              child: Text(
                'Nenhuma empresa encontrada para o filtro atual.',
                style: GsText.body.copyWith(color: SaaSTokens.textMuted),
              ),
            )
          else
            LayoutBuilder(
              builder: (context, constraints) {
                const minWidth = 920.0;
                final width = math.max(constraints.maxWidth, minWidth);
                return SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: SizedBox(
                    width: width,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _tableHead(),
                        for (var i = 0; i < companies.length; i++)
                          _tableRow(
                            companies[i],
                            last: i == companies.length - 1,
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _tableHead() {
    Widget cell(
      String text,
      int flex, {
      double leading = 10,
      bool alignRight = false,
    }) {
      return Expanded(
        flex: flex,
        child: Padding(
          padding: EdgeInsets.fromLTRB(leading, 10, 10, 10),
          child: Text(
            text,
            style: GsText.label,
            textAlign: alignRight ? TextAlign.right : TextAlign.left,
          ),
        ),
      );
    }

    return Container(
      decoration: const BoxDecoration(
        color: SaaSTokens.surfaceSubtle,
        border: Border(bottom: BorderSide(color: SaaSTokens.borderLight)),
      ),
      child: Row(
        children: [
          cell('EMPRESA', _colCompany, leading: 16),
          cell('CNPJ', _colCnpj),
          cell('SEDE', _colSede),
          cell('MÓDULOS', _colModules),
          cell('PESSOAS', _colPeople, alignRight: true),
          cell('STATUS', _colStatus),
          const SizedBox(width: 40),
        ],
      ),
    );
  }

  Widget _tableRow(CompanySummary company, {required bool last}) {
    final tone = _toneFor(company.status);
    final inactive = tone == _StatusTone.inactive;

    // Empresa inativa perde peso — sem badge extra, so cinza.
    final nameColor = inactive ? SaaSTokens.textMuted : SaaSTokens.textTitle;
    final dataColor = inactive ? SaaSTokens.textDim : SaaSTokens.textBody;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => widget.onOpenCompany(company.id),
        hoverColor: SaaSTokens.surfaceSubtle,
        child: Container(
          decoration: BoxDecoration(
            border: last
                ? null
                : const Border(
                    bottom: BorderSide(color: SaaSTokens.scaffold),
                  ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                flex: _colCompany,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: inactive
                              ? SaaSTokens.surfaceAlt
                              : SaaSTokens.primaryLight,
                          borderRadius: BorderRadius.circular(
                            SaaSTokens.rControl,
                          ),
                        ),
                        child: Text(
                          _initialsOf(company.tradingName),
                          style: GsText.bodyStrong.copyWith(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: inactive
                                ? SaaSTokens.textDim
                                : SaaSTokens.primaryHover,
                          ),
                        ),
                      ),
                      const SizedBox(width: 11),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              company.tradingName,
                              style: GsText.bodyStrong.copyWith(
                                color: nameColor,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              company.segment,
                              style: GsText.bodySm.copyWith(
                                color: SaaSTokens.textDim,
                              ),
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
                _colCnpj,
                // CNPJ em mono tabular — o item central do redesign.
                Text(
                  company.cnpj,
                  style: GsText.data.copyWith(color: dataColor),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              _cell(
                _colSede,
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: company.city,
                        style: GsText.body.copyWith(color: dataColor),
                      ),
                      TextSpan(
                        text: ' · ',
                        style: GsText.body.copyWith(color: SaaSTokens.textDim),
                      ),
                      // Sigla de UF e dado tecnico: vai em mono.
                      TextSpan(
                        text: company.state,
                        style: GsText.data.copyWith(color: dataColor),
                      ),
                    ],
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              _cell(
                _colModules,
                company.enabledModules.isEmpty
                    ? Text(
                        '—',
                        style: GsText.data.copyWith(color: SaaSTokens.textDim),
                      )
                    : Wrap(
                        spacing: 5,
                        runSpacing: 4,
                        children: [
                          for (final module in company.enabledModules)
                            _ModuleChip(label: module, muted: inactive),
                        ],
                      ),
              ),
              _cell(
                _colPeople,
                // TODO(redesign): PESSOAS ainda nao existe no repositorio
                //   (CompanySummary nao traz contagem de colaboradores).
                Text(
                  '—',
                  style: GsText.data.copyWith(color: SaaSTokens.textDim),
                  textAlign: TextAlign.right,
                ),
                alignRight: true,
              ),
              _cell(
                _colStatus,
                _StatusChip(label: company.status, tone: tone),
              ),
              const SizedBox(
                width: 40,
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

  Widget _cell(int flex, Widget child, {bool alignRight = false}) {
    return Expanded(
      flex: flex,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        child: Align(
          alignment: alignRight ? Alignment.centerRight : Alignment.centerLeft,
          child: child,
        ),
      ),
    );
  }

  Widget _errorPanel(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        borderRadius: BorderRadius.circular(SaaSTokens.rCard),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Falha ao carregar empresas', style: GsText.cardTitle),
          const SizedBox(height: 8),
          Text(
            message,
            style: GsText.body.copyWith(color: SaaSTokens.textMuted),
          ),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: _refresh,
            child: const Text('Tentar novamente'),
          ),
        ],
      ),
    );
  }
}

// Proporcoes de coluna do design (2.8 / 1.4 / 1.05 / 1.45 / .5 / .85).
const _colCompany = 28;
const _colCnpj = 14;
const _colSede = 11;
const _colModules = 15;
const _colPeople = 6;
const _colStatus = 9;

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.label,
    required this.value,
    this.support,
    this.valueColor,
  });

  final String label;
  final String value;
  final String? support;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        borderRadius: BorderRadius.circular(SaaSTokens.rCard),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label.toUpperCase(),
            style: GsText.label.copyWith(color: SaaSTokens.textDim),
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                value,
                style: valueColor == null
                    ? GsText.kpiLg
                    : GsText.kpiLg.copyWith(color: valueColor),
              ),
              if (support != null) ...[
                const SizedBox(width: 6),
                Text(support!, style: GsText.dataLg),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _ModuleChip extends StatelessWidget {
  const _ModuleChip({required this.label, required this.muted});

  final String label;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: muted ? SaaSTokens.surfaceSubtle : SaaSTokens.surfaceAlt,
        borderRadius: BorderRadius.circular(SaaSTokens.rChip),
        border: muted
            ? Border.all(color: SaaSTokens.borderLight)
            : null,
      ),
      child: Text(
        label,
        style: GsText.chip.copyWith(
          fontWeight: FontWeight.w600,
          color: muted ? SaaSTokens.textDim : SaaSTokens.textBody,
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.tone});

  final String label;
  final _StatusTone tone;

  @override
  Widget build(BuildContext context) {
    final (Color background, Color foreground) = switch (tone) {
      _StatusTone.active => (SaaSTokens.successLight, SaaSTokens.successDark),
      _StatusTone.pending => (
        SaaSTokens.warningLight,
        SaaSTokens.warningDarker,
      ),
      _StatusTone.inactive => (SaaSTokens.surfaceAlt, SaaSTokens.textMuted),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(SaaSTokens.rChip),
      ),
      child: Text(
        label.toLowerCase(),
        style: GsText.chip.copyWith(
          fontWeight: FontWeight.w600,
          color: foreground,
        ),
      ),
    );
  }
}
