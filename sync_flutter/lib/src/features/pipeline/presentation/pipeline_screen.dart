import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:intl/intl.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/theme/app_theme.dart';
import 'fundeb_diagnostico_tab.dart';

/// Sinal semantico de uma coluna do kanban.
///
/// A direcao "Console Tecnico" proibe uma cor por estagio: cor volta a ser
/// semantica — teal marca estagio com negocio quente, ambar marca inatividade
/// ou prazo, e o resto fica neutro.
enum _StageSignal { neutral, hot, alert }

/// Sinal de urgencia de um card de municipio.
enum _CardAlert { none, idle, due }

class PipelineScreen extends StatefulWidget {
  const PipelineScreen({super.key, required this.repository});

  final SyncRepository repository;

  @override
  State<PipelineScreen> createState() => _PipelineScreenState();
}

class _PipelineScreenState extends State<PipelineScreen> {
  bool _isKanbanView = true;
  String _searchQuery = '';
  List<CityAccount> _cities = [];
  bool _isLoading = true;
  String? _errorMessage;

  // Selected city for detail view
  CityAccount? _selectedCity;

  /// Estagios cuja coluna esta expandida (mostrando todos os cards).
  final Set<String> _expandedStages = <String>{};

  /// Probabilidade a partir da qual o negocio conta como "quente".
  static const int _hotProbability = 60;

  /// Cards visiveis por coluna antes do rodape "+N".
  static const int _cardsPerColumn = 6;

  // Commercial stages definition
  static const List<String> _stages = [
    'mapping',
    'first_contact',
    'institutional_validation',
    'technical_diagnosis',
    'proposal_presented',
    'negotiation',
    'verbally_approved',
    'contractual',
    'implementation',
    'assisted_operation',
    'fidelized',
    'paused',
    'lost',
  ];

  /// Os cinco estagios de trabalho — as unicas colunas abertas no kanban.
  /// A ordem continua sendo a de [_stages]; o dominio nao e reordenado.
  static const Set<String> _openStages = {
    'mapping',
    'first_contact',
    'technical_diagnosis',
    'proposal_presented',
    'contractual',
  };

  static const Map<String, String> _stageLabels = {
    'mapping': 'Mapeamento',
    'first_contact': '1º Contato',
    'institutional_validation': 'Validação Inst.',
    'technical_diagnosis': 'Diag. Técnico',
    'proposal_presented': 'Proposta Apres.',
    'negotiation': 'Negociação',
    'verbally_approved': 'Aprov. Verbal',
    'contractual': 'Contratual',
    'implementation': 'Implantação',
    'assisted_operation': 'Op. Assistida',
    'fidelized': 'Fidelizada',
    'paused': 'Pausado',
    'lost': 'Perdido',
  };

  /// Colunas abertas, na ordem do funil.
  static final List<String> _boardStages =
      _stages.where(_openStages.contains).toList(growable: false);

  /// Estagios recolhidos na coluna de indice, na ordem do funil.
  static final List<String> _indexStages =
      _stages.where((s) => !_openStages.contains(s)).toList(growable: false);

  @override
  void initState() {
    super.initState();
    _fetchCities();
  }

  Future<void> _fetchCities() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final cities = await widget.repository.getCities(search: _searchQuery);
      if (!mounted) return;
      setState(() {
        _cities = cities;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Falha ao carregar pipeline: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _changeCityStage(String cityId, String newStage) async {
    try {
      await widget.repository.updateCityStage(cityId, newStage);
      if (!mounted) return;
      await _fetchCities();
      if (!mounted) return;

      // Update selected city if active
      if (_selectedCity?.id == cityId) {
        final updatedCity = _cities.firstWhere((c) => c.id == cityId);
        setState(() {
          _selectedCity = updatedCity;
        });
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Estágio atualizado para ${_stageLabels[newStage]} com sucesso.'),
          backgroundColor: SaaSTokens.success,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erro ao atualizar estágio: $e'),
          backgroundColor: SaaSTokens.error,
        ),
      );
    }
  }

  Future<void> _saveCityDetails(String cityId, Map<String, dynamic> data) async {
    try {
      await widget.repository.updateCityPipeline(cityId, data);
      if (!mounted) return;
      await _fetchCities();
      if (!mounted) return;

      // Update selected city if active
      if (_selectedCity?.id == cityId) {
        final updatedCity = _cities.firstWhere((c) => c.id == cityId);
        setState(() {
          _selectedCity = updatedCity;
        });
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Dados salvos com sucesso.'),
          backgroundColor: SaaSTokens.success,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erro ao salvar dados: $e'),
          backgroundColor: SaaSTokens.error,
        ),
      );
    }
  }

  // ── Leitura de sinal ────────────────────────────────────────
  // Nenhuma destas funcoes altera dado: elas so traduzem o que ja existe
  // no repositorio para a cor semantica da tela.

  /// Dias desde a ultima atividade comercial. `-1` quando nao ha registro.
  static int _daysIdle(CityAccount city) {
    final raw = city.lastActivityAt;
    if (raw == null) return -1;
    final last = DateTime.tryParse(raw);
    if (last == null) return -1;
    return DateTime.now().difference(last).inDays;
  }

  /// Dias restantes ate o prazo do proximo passo. `null` quando nao ha prazo.
  static int? _daysToDue(CityAccount city) {
    final raw = city.nextStepDueDate;
    if (raw == null) return null;
    final due = DateTime.tryParse(raw);
    if (due == null) return null;
    return due.difference(DateTime.now()).inDays;
  }

  static _CardAlert _cardAlert(CityAccount city) {
    if (_daysIdle(city) > 7) return _CardAlert.idle;
    final due = _daysToDue(city);
    if (due != null && due <= 7) return _CardAlert.due;
    return _CardAlert.none;
  }

  static bool _isHot(CityAccount city) => city.probability >= _hotProbability;

  static _StageSignal _stageSignal(List<CityAccount> cities) {
    if (cities.any(_isHot)) return _StageSignal.hot;
    if (cities.any((c) => _cardAlert(c) != _CardAlert.none)) {
      return _StageSignal.alert;
    }
    return _StageSignal.neutral;
  }

  static Color _signalColor(_StageSignal signal) => switch (signal) {
        _StageSignal.hot => SaaSTokens.primary,
        _StageSignal.alert => SaaSTokens.warning,
        _StageSignal.neutral => SaaSTokens.textDim,
      };

  /// Par claro/escuro do chip de estagio. Semantico, nunca uma cor por estagio.
  static ({Color bg, Color fg}) _stageChipTone(String stage) {
    switch (stage) {
      case 'fidelized':
        return (bg: SaaSTokens.successLight, fg: SaaSTokens.successDark);
      case 'proposal_presented':
      case 'negotiation':
      case 'verbally_approved':
      case 'contractual':
        return (bg: SaaSTokens.primaryLight, fg: SaaSTokens.primaryHover);
      case 'paused':
        return (bg: SaaSTokens.warningLight, fg: SaaSTokens.warningDark);
      case 'lost':
        return (bg: SaaSTokens.surfaceAlt, fg: SaaSTokens.textMuted);
      default:
        return (bg: SaaSTokens.surfaceAlt, fg: SaaSTokens.textSoft);
    }
  }

  static String _initials(String? name) {
    final trimmed = name?.trim() ?? '';
    if (trimmed.isEmpty) return '--';
    final parts = trimmed.split(RegExp(r'\s+'));
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    // Calculo de KPIs do Pipeline
    double totalEstimatedRevenue = 0.0;
    double weightedRevenue = 0.0;
    int inactiveCitiesCount = 0;

    for (var city in _cities) {
      totalEstimatedRevenue += city.estimatedAnnualRevenue;
      weightedRevenue += city.estimatedAnnualRevenue * (city.probability / 100);

      // Check if inactive > 7 days
      if (city.lastActivityAt != null) {
        final lastActivity = DateTime.tryParse(city.lastActivityAt!);
        if (lastActivity != null && DateTime.now().difference(lastActivity).inDays > 7) {
          inactiveCitiesCount++;
        }
      }
    }

    return Scaffold(
      backgroundColor: SaaSTokens.scaffold,
      body: Row(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildHeader(),
                  const SizedBox(height: 18),
                  _buildKpiSummary(totalEstimatedRevenue, weightedRevenue, inactiveCitiesCount),
                  const SizedBox(height: 16),
                  _buildSearchAndFilters(),
                  const SizedBox(height: 16),
                  Expanded(
                    child: _isLoading
                        ? const Center(child: CircularProgressIndicator())
                        : _errorMessage != null
                            ? Center(
                                child: Text(
                                  _errorMessage!,
                                  style: GsText.body.copyWith(color: SaaSTokens.errorDark),
                                ),
                              )
                            : _isKanbanView
                                ? _buildKanbanBoard()
                                : _buildTableView(),
                  ),
                ],
              ),
            ),
          ),
          if (_selectedCity != null)
            _buildDetailPanel(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    final titulo = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Plano de ação comercial', style: GsText.pageTitle),
        const SizedBox(height: 4),
        Text(
          '${_cities.length} municípios em ${_stages.length} estágios · arraste o card para mover de estágio',
          style: GsText.body.copyWith(color: SaaSTokens.textMuted),
        ),
      ],
    );

    final acoes = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
            // View Switcher
            Container(
              decoration: BoxDecoration(
                color: SaaSTokens.cardWhite,
                borderRadius: BorderRadius.circular(SaaSTokens.rControl),
                border: Border.all(color: SaaSTokens.borderLight),
              ),
              clipBehavior: Clip.antiAlias,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _viewToggleButton(
                    icon: LucideIcons.layoutGrid,
                    label: 'kanban',
                    isSelected: _isKanbanView,
                    onTap: () => setState(() => _isKanbanView = true),
                  ),
                  Container(width: 1, height: 34, color: SaaSTokens.borderLight),
                  _viewToggleButton(
                    icon: LucideIcons.list,
                    label: 'lista',
                    isSelected: !_isKanbanView,
                    onTap: () => setState(() => _isKanbanView = false),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            SizedBox(
              height: 38,
              child: FilledButton.icon(
                onPressed: _showAddCityDialog,
                icon: const Icon(LucideIcons.plus, size: 17),
                label: const Text('Novo município'),
                style: FilledButton.styleFrom(
                  backgroundColor: SaaSTokens.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  textStyle: GsText.button,
                  padding: const EdgeInsets.symmetric(horizontal: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(SaaSTokens.rControl),
                  ),
                ),
              ),
            ),
      ],
    );

    // Abaixo de 900px o cabecalho empilha: em uma linha so, o titulo longo
    // empurra o alternador e o botao para fora da tela.
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 900) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [titulo, const SizedBox(height: 14), acoes],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(child: titulo),
            const SizedBox(width: 20),
            acoes,
          ],
        );
      },
    );
  }

  Widget _viewToggleButton({
    required IconData icon,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    final fg = isSelected ? Colors.white : SaaSTokens.textMuted;
    return InkWell(
      onTap: onTap,
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 13),
        color: isSelected ? SaaSTokens.primary : Colors.transparent,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: fg),
            const SizedBox(width: 6),
            Text(
              label,
              style: GsText.dataSm.copyWith(
                color: fg,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiSummary(double total, double weighted, int inactive) {
    final compact = NumberFormat.compactCurrency(locale: 'pt_BR', symbol: 'R\$');
    return Row(
      // `stretch` aqui pede altura infinita ao Row e derruba o layout do board
      // inteiro; os tres cards ja tem a mesma altura natural.
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: _kpiCard(
            label: 'PIPELINE BRUTO (YTD)',
            value: compact.format(total),
            helper: 'soma dos valores estimados anuais',
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _kpiCard(
            label: 'VALOR PONDERADO (FORECAST)',
            value: compact.format(weighted),
            helper: 'pela probabilidade de fechamento',
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _kpiCard(
            label: 'ALERTA DE INATIVIDADE',
            value: '$inactive',
            helper: 'municípios sem atividade há 7+ dias',
            valueColor: inactive > 0 ? SaaSTokens.warningDark : SaaSTokens.textTitle,
            inlineHelper: true,
          ),
        ),
      ],
    );
  }

  Widget _kpiCard({
    required String label,
    required String value,
    required String helper,
    Color? valueColor,
    bool inlineHelper = false,
  }) {
    final valueText = Text(
      value,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: valueColor == null ? GsText.kpiLg : GsText.kpiLg.copyWith(color: valueColor),
    );
    final helperText = Text(
      helper,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: GsText.dataXs,
    );

    return Container(
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        borderRadius: BorderRadius.circular(SaaSTokens.rCard),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: GsText.label),
          const SizedBox(height: 8),
          if (inlineHelper)
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                valueText,
                const SizedBox(width: 8),
                Expanded(child: helperText),
              ],
            )
          else ...[
            valueText,
            const SizedBox(height: 6),
            helperText,
          ],
        ],
      ),
    );
  }

  Widget _buildSearchAndFilters() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        borderRadius: BorderRadius.circular(SaaSTokens.rControl),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              style: GsText.body,
              onChanged: (val) {
                setState(() {
                  _searchQuery = val;
                });
                _fetchCities();
              },
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: EdgeInsets.zero,
                prefixIcon: const Icon(LucideIcons.search, size: 17, color: SaaSTokens.textDim),
                prefixIconConstraints: const BoxConstraints(minWidth: 27, minHeight: 20),
                hintText: 'Município ou UF…',
                hintStyle: GsText.body.copyWith(color: SaaSTokens.textDim),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Kanban ──────────────────────────────────────────────────

  /// Largura minima confortavel de uma coluna de estagio.
  static const double _minColumnWidth = 208;
  static const double _indexColumnWidth = 130;

  Widget _buildKanbanBoard() {
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 10.0;
        final minBoard = _boardStages.length * (_minColumnWidth + gap) + _indexColumnWidth;

        // Cabe: colunas dividem a largura por igual.
        if (constraints.maxWidth >= minBoard) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final stage in _boardStages) ...[
                Expanded(child: _buildStageColumn(stage)),
                const SizedBox(width: gap),
              ],
              _buildStageIndexColumn(),
            ],
          );
        }

        // Nao cabe: o board rola na horizontal com colunas de largura fixa, em
        // vez de espremer as colunas ate estourarem.
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SizedBox(
            width: minBoard,
            height: constraints.maxHeight,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final stage in _boardStages) ...[
                  SizedBox(width: _minColumnWidth, child: _buildStageColumn(stage)),
                  const SizedBox(width: gap),
                ],
                _buildStageIndexColumn(),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStageColumn(String stage) {
    final stageCities = _cities.where((c) => c.stage == stage).toList();
    final columnRevenue = stageCities.fold(0.0, (sum, c) => sum + c.estimatedAnnualRevenue);
    final currencyFormat = NumberFormat.compactCurrency(locale: 'pt_BR', symbol: 'R\$');
    final signal = _stageSignal(stageCities);

    final isExpanded = _expandedStages.contains(stage);
    final visible = isExpanded || stageCities.length <= _cardsPerColumn
        ? stageCities
        : stageCities.take(_cardsPerColumn).toList();
    final hidden = stageCities.length - visible.length;

    return DragTarget<CityAccount>(
      onWillAcceptWithDetails: (details) => details.data.stage != stage,
      onAcceptWithDetails: (details) => _changeCityStage(details.data.id, stage),
      builder: (context, candidate, rejected) {
        final isTargeted = candidate.isNotEmpty;
        return Container(
          decoration: BoxDecoration(
            color: SaaSTokens.cardWhite,
            borderRadius: BorderRadius.circular(SaaSTokens.rCard),
            border: Border.all(
              color: isTargeted ? SaaSTokens.primary : SaaSTokens.borderLight,
              width: isTargeted ? 1.5 : 1,
            ),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Cabecalho da coluna: ponto semantico + nome + contagem + soma
              Container(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: SaaSTokens.scaffold)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: _signalColor(signal),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 7),
                        Expanded(
                          child: Text(
                            _stageLabels[stage]!,
                            style: GsText.bodyStrong,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text('${stageCities.length}', style: GsText.dataXs),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      currencyFormat.format(columnRevenue),
                      style: GsText.dataXs.copyWith(color: SaaSTokens.textDim),
                    ),
                  ],
                ),
              ),

              // Corpo da coluna
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.all(10),
                  itemCount: visible.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, idx) => _buildCityKanbanCard(visible[idx]),
                ),
              ),

              // Rodape "+N" para os itens ocultos
              if (hidden > 0 || isExpanded)
                Padding(
                  padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
                  child: _dashedTile(
                    onTap: () => setState(() {
                      if (isExpanded) {
                        _expandedStages.remove(stage);
                      } else {
                        _expandedStages.add(stage);
                      }
                    }),
                    tooltip: isExpanded ? 'Mostrar menos' : 'Mostrar todos',
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          isExpanded ? LucideIcons.minus : LucideIcons.plus,
                          size: 15,
                          color: SaaSTokens.textDim,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          isExpanded
                              ? '${stageCities.length}'
                              : '+$hidden',
                          style: GsText.dataXs.copyWith(color: SaaSTokens.textDim),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  /// Coluna de indice a direita: os estagios que nao abrem como coluna.
  /// Continua sendo alvo de drop, entao os 13 estagios seguem alcancaveis.
  Widget _buildStageIndexColumn() {
    return Container(
      width: _indexColumnWidth,
      padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
      decoration: BoxDecoration(
        color: SaaSTokens.surfaceSubtle,
        borderRadius: BorderRadius.circular(SaaSTokens.rCard),
      ),
      foregroundDecoration: const _DashedRoundedBorder(
        color: SaaSTokens.borderStrong,
        radius: SaaSTokens.rCard,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('+${_indexStages.length} ESTÁGIOS', style: GsText.label),
          const SizedBox(height: 10),
          Expanded(
            child: ListView.separated(
              padding: EdgeInsets.zero,
              itemCount: _indexStages.length,
              separatorBuilder: (_, _) => const SizedBox(height: 7),
              itemBuilder: (context, idx) => _buildStageIndexRow(_indexStages[idx]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStageIndexRow(String stage) {
    final count = _cities.where((c) => c.stage == stage).length;
    final isClosed = stage == 'paused' || stage == 'lost';

    return DragTarget<CityAccount>(
      onWillAcceptWithDetails: (details) => details.data.stage != stage,
      onAcceptWithDetails: (details) => _changeCityStage(details.data.id, stage),
      builder: (context, candidate, rejected) {
        final isTargeted = candidate.isNotEmpty;
        return Tooltip(
          message: 'Solte um card aqui para mover para ${_stageLabels[stage]}',
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
            decoration: BoxDecoration(
              color: isTargeted ? SaaSTokens.primaryLight : Colors.transparent,
              borderRadius: BorderRadius.circular(SaaSTokens.rChip),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Expanded(
                  child: Text(
                    _stageLabels[stage]!,
                    style: GsText.bodySm.copyWith(
                      color: isTargeted
                          ? SaaSTokens.primaryHover
                          : isClosed
                              ? SaaSTokens.textDim
                              : SaaSTokens.textBody,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  '$count',
                  style: GsText.dataXs.copyWith(color: SaaSTokens.textDim),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildCityKanbanCard(CityAccount city) {
    final currencyFormat = NumberFormat.compactCurrency(locale: 'pt_BR', symbol: 'R\$');
    final alert = _cardAlert(city);
    final hot = _isHot(city);
    final isSelected = _selectedCity?.id == city.id;
    final daysIdle = _daysIdle(city);

    // Tinta do avatar: teal para negocio quente, ambar sob alerta, neutro no resto.
    final Color avatarBg = hot
        ? SaaSTokens.primaryLight
        : alert != _CardAlert.none
            ? SaaSTokens.warningLight
            : SaaSTokens.scaffold;
    final Color avatarFg = hot
        ? SaaSTokens.primaryHover
        : alert != _CardAlert.none
            ? SaaSTokens.warningDark
            : SaaSTokens.textBody;

    final nextStep = _nextStepLine(city);

    final card = Container(
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isSelected ? SaaSTokens.primary : SaaSTokens.borderLight,
          width: isSelected ? 1.5 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          setState(() {
            _selectedCity = city;
          });
        },
        child: Padding(
          padding: const EdgeInsets.all(11),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Expanded(
                    child: Text(
                      city.name,
                      style: GsText.bodyStrong,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    city.uf,
                    style: GsText.dataXs.copyWith(color: SaaSTokens.textDim),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                currencyFormat.format(city.estimatedAnnualRevenue),
                style: GsText.dataStrong,
              ),
              if (nextStep != null) ...[
                const SizedBox(height: 7),
                Text(
                  nextStep,
                  style: GsText.dataXs.copyWith(
                    color: alert != _CardAlert.none
                        ? SaaSTokens.warningDark
                        : hot
                            ? SaaSTokens.primaryHover
                            : SaaSTokens.textMuted,
                    fontWeight: alert != _CardAlert.none || hot
                        ? FontWeight.w600
                        : FontWeight.w400,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const SizedBox(height: 8),
              Row(
                children: [
                  Container(
                    width: 22,
                    height: 22,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: avatarBg,
                      borderRadius: BorderRadius.circular(7),
                    ),
                    child: Text(
                      _initials(city.collaboratorName),
                      style: GsText.caption.copyWith(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        color: avatarFg,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${city.probability}%',
                      style: GsText.dataXs.copyWith(
                        color: hot ? SaaSTokens.textMuted : SaaSTokens.textDim,
                      ),
                    ),
                  ),
                  if (alert == _CardAlert.idle)
                    Tooltip(
                      message: 'Inativo há $daysIdle dias',
                      child: const Icon(LucideIcons.clock, size: 14, color: SaaSTokens.warning),
                    )
                  else if (alert == _CardAlert.due)
                    Tooltip(
                      message: 'Prazo do próximo passo se aproxima',
                      child: const Icon(LucideIcons.calendarX, size: 14, color: SaaSTokens.warning),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    return Draggable<CityAccount>(
      data: city,
      // Horizontal: o card viaja entre colunas; o arrasto vertical continua
      // rolando a coluna, entao a lista longa segue navegavel.
      affinity: Axis.horizontal,
      dragAnchorStrategy: pointerDragAnchorStrategy,
      feedback: Material(
        color: Colors.transparent,
        child: Opacity(
          opacity: 0.92,
          child: SizedBox(width: 240, child: card),
        ),
      ),
      childWhenDragging: Opacity(opacity: 0.35, child: card),
      child: card,
    );
  }

  /// Linha "proximo passo · data" do card. `null` quando nao ha passo cadastrado.
  static String? _nextStepLine(CityAccount city) {
    final description = city.nextStepDescription;
    final raw = city.nextStepDueDate;
    final due = raw == null ? null : DateTime.tryParse(raw);
    if (description == null || description.isEmpty) {
      if (due == null) return null;
      return 'prazo · ${DateFormat('dd/MM').format(due)}';
    }
    if (due == null) return description;
    return '$description · ${DateFormat('dd/MM').format(due)}';
  }

  // ── Lista ───────────────────────────────────────────────────

  Widget _buildTableView() {
    final currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    return Container(
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        borderRadius: BorderRadius.circular(SaaSTokens.rCard),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Container(
            color: SaaSTokens.surfaceSubtle,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
            child: const Row(
              children: [
                Expanded(flex: 25, child: Text('MUNICÍPIO', style: GsText.label)),
                Expanded(flex: 20, child: Text('RESPONSÁVEL', style: GsText.label)),
                Expanded(flex: 20, child: Text('ESTÁGIO', style: GsText.label)),
                Expanded(flex: 18, child: Text('RECEITA EST.', style: GsText.label)),
                Expanded(flex: 30, child: Text('PRÓXIMO PASSO', style: GsText.label)),
                SizedBox(width: 24),
              ],
            ),
          ),
          const Divider(height: 1, thickness: 1, color: SaaSTokens.borderLight),
          Expanded(
            child: ListView.separated(
              padding: EdgeInsets.zero,
              itemCount: _cities.length,
              separatorBuilder: (_, _) =>
                  const Divider(height: 1, thickness: 1, color: SaaSTokens.borderLight),
              itemBuilder: (context, idx) => _buildTableRow(_cities[idx], currencyFormat),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTableRow(CityAccount city, NumberFormat currencyFormat) {
    final isSelected = _selectedCity?.id == city.id;
    final isClosed = city.stage == 'paused' || city.stage == 'lost';
    final tone = _stageChipTone(city.stage);
    final due = _daysToDue(city);
    final rawDue = city.nextStepDueDate;
    final dueDate = rawDue == null ? null : DateTime.tryParse(rawDue);

    return InkWell(
      onTap: () {
        setState(() {
          _selectedCity = city;
        });
      },
      child: Container(
        color: isSelected ? SaaSTokens.primaryLight : Colors.transparent,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Expanded(
              flex: 25,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Flexible(
                    child: Text(
                      city.name,
                      style: isClosed
                          ? GsText.bodyStrong.copyWith(color: SaaSTokens.textMuted)
                          : GsText.bodyStrong,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(city.uf, style: GsText.dataXs.copyWith(color: SaaSTokens.textDim)),
                ],
              ),
            ),
            Expanded(
              flex: 20,
              child: Text(
                city.collaboratorName ?? '—',
                style: GsText.body,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Expanded(
              flex: 20,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: tone.bg,
                    borderRadius: BorderRadius.circular(SaaSTokens.rChip),
                  ),
                  child: Text(
                    _stageLabels[city.stage] ?? city.stage,
                    style: GsText.chip.copyWith(color: tone.fg),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ),
            Expanded(
              flex: 18,
              child: Text(
                currencyFormat.format(city.estimatedAnnualRevenue),
                style: GsText.dataStrong,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Expanded(
              flex: 30,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    city.nextStepDescription ?? 'Nenhum próximo passo registrado',
                    style: GsText.body.copyWith(color: SaaSTokens.textMuted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (dueDate != null)
                    Text(
                      DateFormat('dd/MM/yyyy').format(dueDate),
                      style: GsText.dataXs.copyWith(
                        color: due != null && due <= 7
                            ? SaaSTokens.warningDark
                            : SaaSTokens.textDim,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(
              width: 24,
              child: Icon(LucideIcons.chevronRight, size: 16, color: SaaSTokens.textDim),
            ),
          ],
        ),
      ),
    );
  }

  // ── Painel de detalhe ───────────────────────────────────────

  Widget _buildDetailPanel() {
    final city = _selectedCity!;
    final currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    final tone = _stageChipTone(city.stage);

    return Container(
      width: 450,
      decoration: const BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border(left: BorderSide(color: SaaSTokens.borderLight)),
      ),
      child: DefaultTabController(
        length: 4,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Details Header
            Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: SaaSTokens.surfaceSubtle,
                border: Border(bottom: BorderSide(color: SaaSTokens.borderLight)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Flexible(
                              child: Text(
                                city.name,
                                style: GsText.panelTitle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              city.uf,
                              style: GsText.dataSm.copyWith(color: SaaSTokens.textDim),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => setState(() => _selectedCity = null),
                        icon: const Icon(LucideIcons.x, size: 18, color: SaaSTokens.textMuted),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: tone.bg,
                          borderRadius: BorderRadius.circular(SaaSTokens.rChip),
                        ),
                        child: Text(
                          _stageLabels[city.stage] ?? city.stage,
                          style: GsText.chip.copyWith(color: tone.fg),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text('CÓD. IBGE', style: GsText.label),
                      const SizedBox(width: 6),
                      Text(city.codigoIbge, style: GsText.dataSm),
                    ],
                  ),
                ],
              ),
            ),

            // Tabs
            TabBar(
              labelColor: SaaSTokens.primary,
              unselectedLabelColor: SaaSTokens.textDim,
              indicatorColor: SaaSTokens.primary,
              indicatorSize: TabBarIndicatorSize.tab,
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              dividerColor: SaaSTokens.borderLight,
              labelStyle: GsText.bodyStrong.copyWith(color: SaaSTokens.primary),
              unselectedLabelStyle: GsText.bodyMedium.copyWith(color: SaaSTokens.textDim),
              tabs: const [
                Tab(text: 'Resumo'),
                Tab(text: 'Checklist'),
                Tab(text: 'Financeiro'),
                Tab(text: 'Diag. FUNDEB'),
              ],
            ),

            // Tab Views
            Expanded(
              child: TabBarView(
                children: [
                  _buildDetailResumoTab(city),
                  _buildDetailChecklistTab(city),
                  _buildDetailFinanceiroTab(city, currencyFormat),
                  FundebDiagnosticoTab(
                    city: city,
                    diagnostico: mockFundebForCity(city.id, city.name),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailResumoTab(CityAccount city) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _buildInfoField('Colaborador Responsável', city.collaboratorName ?? 'Não assinalado'),
        _buildInfoField('Estágio Comercial Atual', _stageLabels[city.stage]!),
        _buildInfoField('CNPJ/Status de Conta', city.status.toUpperCase(), mono: true),
        _buildInfoField('Próximo Passo Planejado', city.nextStepDescription ?? 'Não cadastrado'),
        if (city.nextStepDueDate != null)
          _buildInfoField(
            'Prazo para Próximo Passo',
            DateFormat('dd/MM/yyyy').format(DateTime.parse(city.nextStepDueDate!)),
            mono: true,
          ),
        const SizedBox(height: 16),
        const Divider(height: 1, thickness: 1, color: SaaSTokens.borderLight),
        const SizedBox(height: 16),
        const Text('AÇÕES DE TRANSIÇÃO DE ESTÁGIO', style: GsText.label),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _stages.map((stg) {
            final isCurrent = city.stage == stg;
            return ChoiceChip(
              label: Text(
                _stageLabels[stg]!,
                style: GsText.chip.copyWith(
                  color: isCurrent ? Colors.white : SaaSTokens.textBody,
                ),
              ),
              selected: isCurrent,
              showCheckmark: false,
              selectedColor: SaaSTokens.primary,
              backgroundColor: SaaSTokens.surfaceAlt,
              side: BorderSide(
                color: isCurrent ? SaaSTokens.primary : SaaSTokens.borderLight,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(SaaSTokens.rChip),
              ),
              onSelected: (selected) {
                if (selected && !isCurrent) {
                  _changeCityStage(city.id, stg);
                }
              },
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildDetailChecklistTab(CityAccount city) {
    // Generate tasks depending on the current stage
    final List<({String title, bool done})> items = switch (city.stage) {
      'mapping' => [
          (title: 'Coletar dados populacionais do IBGE', done: true),
          (title: 'Mapear receita FUNDEB histórica', done: false),
          (title: 'Verificar prefeito e secretário eleito', done: false),
        ],
      'first_contact' => [
          (title: 'Agendar primeira reunião comercial', done: true),
          (title: 'Preparar apresentação de slides customizados', done: true),
          (title: 'Registrar ata de reunião de apresentação', done: false),
        ],
      'institutional_validation' => [
          (title: 'Reunião formal com Secretário de Educação', done: true),
          (title: 'Disponibilizar PDF de levantamento preliminar', done: false),
          (title: 'Obter validação de interesse comercial', done: false),
        ],
      'technical_diagnosis' => [
          (title: 'Gerar diagnóstico de VAAT/VAAR do FUNDEB', done: true),
          (title: 'Processar relatório dirigido do IDEB/SAEB', done: false),
          (title: 'Apresentar dados técnicos e econômicos', done: false),
        ],
      'proposal_presented' => [
          (title: 'Definir valores e formato do contrato', done: true),
          (title: 'Gerar e submeter proposta oficial em DOCX', done: false),
          (title: 'Negociar margens com a diretoria do grupo', done: false),
        ],
      _ => [
          (title: 'Confirmar regularidade fiscal', done: true),
          (title: 'Emitir minuta de contrato administrativo', done: false),
          (title: 'Obter assinatura digital das partes', done: false),
        ],
    };

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'REQUISITOS · ${(_stageLabels[city.stage] ?? city.stage).toUpperCase()}',
          style: GsText.label,
        ),
        const SizedBox(height: 12),
        ...items.map((item) {
          return CheckboxListTile(
            title: Text(item.title, style: GsText.body),
            value: item.done,
            activeColor: SaaSTokens.primary,
            onChanged: (val) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Status de item do checklist atualizado com sucesso.'),
                  duration: Duration(seconds: 1),
                ),
              );
            },
            controlAffinity: ListTileControlAffinity.leading,
            contentPadding: EdgeInsets.zero,
            dense: true,
          );
        }),
      ],
    );
  }

  Widget _buildDetailFinanceiroTab(CityAccount city, NumberFormat format) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _buildInfoField(
          'Receita Anual Estimada (Contrato)',
          format.format(city.estimatedAnnualRevenue),
          mono: true,
        ),
        _buildInfoField('Margem de Probabilidade', '${city.probability}%', mono: true),
        _buildInfoField(
          'Projeção Ponderada (Forecast)',
          format.format(city.estimatedAnnualRevenue * (city.probability / 100)),
          mono: true,
        ),
        const SizedBox(height: 16),
        const Divider(height: 1, thickness: 1, color: SaaSTokens.borderLight),
        const SizedBox(height: 16),
        const Text('COMISSÕES PROJETADAS DO COLABORADOR', style: GsText.label),
        const SizedBox(height: 8),
        Text(
          'Com base na taxa de comissão territorial de 20%, o ganho estimado anual para ${city.collaboratorName ?? 'o colaborador'} é de ${format.format(city.estimatedAnnualRevenue * 0.20)} (R\$ ${format.format((city.estimatedAnnualRevenue * 0.20) / 12)} / mês).',
          style: GsText.body.copyWith(color: SaaSTokens.textMuted),
        ),
        const SizedBox(height: 24),
        OutlinedButton.icon(
          onPressed: () {
            _showEditCityDetailsDialog(city);
          },
          icon: const Icon(LucideIcons.pencil, size: 14),
          label: const Text('Editar Dados do Pipeline'),
          style: OutlinedButton.styleFrom(
            foregroundColor: SaaSTokens.primary,
            textStyle: GsText.button,
            side: const BorderSide(color: SaaSTokens.borderStronger),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(SaaSTokens.rControl),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInfoField(String label, String value, {bool mono = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: GsText.label),
          const SizedBox(height: 4),
          Text(
            value,
            style: mono
                ? GsText.dataStrong
                : GsText.bodyMedium.copyWith(color: SaaSTokens.textTitle),
          ),
        ],
      ),
    );
  }

  /// Tile de borda tracejada — rodape "+N" da coluna.
  Widget _dashedTile({
    required Widget child,
    required VoidCallback onTap,
    required String tooltip,
  }) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 38,
          alignment: Alignment.center,
          foregroundDecoration: const _DashedRoundedBorder(
            color: SaaSTokens.borderStrong,
            radius: 12,
          ),
          child: child,
        ),
      ),
    );
  }

  void _showAddCityDialog() {
    final nameController = TextEditingController();
    final ufController = TextEditingController();
    final ibgeController = TextEditingController();
    final revenueController = TextEditingController();
    String selectedStage = 'mapping';

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Novo Município no Pipeline', style: GsText.panelTitle),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'Nome do Município'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: ufController,
                  decoration: const InputDecoration(labelText: 'UF (Sigla)'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: ibgeController,
                  decoration: const InputDecoration(labelText: 'Código IBGE (opcional)'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: revenueController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Receita Estimada Anual (R\$)'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: selectedStage,
                  decoration: const InputDecoration(labelText: 'Estágio Inicial'),
                  items: _stages.map((stg) {
                    return DropdownMenuItem(
                      value: stg,
                      child: Text(_stageLabels[stg]!),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) {
                      selectedStage = val;
                    }
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () async {
                final name = nameController.text.trim();
                final uf = ufController.text.trim().toUpperCase();
                final revenue = double.tryParse(revenueController.text.trim()) ?? 0.0;

                if (name.isEmpty || uf.isEmpty) {
                  return;
                }

                try {
                  await widget.repository.createCity({
                    'name': name,
                    'uf': uf,
                    'codigoIbge': ibgeController.text.trim(),
                    'currentStage': selectedStage,
                    'estimatedAnnualRevenue': revenue,
                    'status': 'ativo',
                  });
                  Navigator.pop(context);
                  _fetchCities();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Município cadastrado com sucesso.'),
                      backgroundColor: SaaSTokens.success,
                    ),
                  );
                } catch (e) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Erro ao cadastrar município: $e'),
                      backgroundColor: SaaSTokens.error,
                    ),
                  );
                }
              },
              child: const Text('Cadastrar'),
            ),
          ],
        );
      },
    );
  }

  void _showEditCityDetailsDialog(CityAccount city) {
    final nameController = TextEditingController(text: city.name);
    final ufController = TextEditingController(text: city.uf);
    final ibgeController = TextEditingController(text: city.codigoIbge);
    final revenueController = TextEditingController(text: city.estimatedAnnualRevenue.toString());
    final probabilityController = TextEditingController(text: city.probability.toString());
    final nextStepController = TextEditingController(text: city.nextStepDescription);

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Editar Detalhes do Pipeline', style: GsText.panelTitle),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'Nome'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: ufController,
                  decoration: const InputDecoration(labelText: 'UF'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: ibgeController,
                  decoration: const InputDecoration(labelText: 'Código IBGE'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: revenueController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Receita Estimada Anual (R\$)'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: probabilityController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Probabilidade (%)'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: nextStepController,
                  decoration: const InputDecoration(labelText: 'Próximo Passo Comercial'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () {
                final name = nameController.text.trim();
                final uf = ufController.text.trim().toUpperCase();
                final revenue = double.tryParse(revenueController.text.trim()) ?? city.estimatedAnnualRevenue;
                final prob = int.tryParse(probabilityController.text.trim()) ?? city.probability;

                _saveCityDetails(city.id, {
                  'name': name,
                  'uf': uf,
                  'codigoIbge': ibgeController.text.trim(),
                  'estimatedAnnualRevenue': revenue,
                  'probability': prob,
                  'nextStepDescription': nextStepController.text.trim(),
                  'nextStepDueDate': city.nextStepDueDate ?? DateTime.now().add(const Duration(days: 7)).toIso8601String(),
                });

                Navigator.pop(context);
              },
              child: const Text('Salvar'),
            ),
          ],
        );
      },
    );
  }
}

/// Borda tracejada de 1px em retangulo arredondado.
///
/// O tema nao tem elevacao: a separacao vem de borda. O tracejado marca as
/// zonas "abertas" do quadro (indice de estagios recolhidos e rodape "+N")
/// sem gastar uma segunda cor.
class _DashedRoundedBorder extends Decoration {
  const _DashedRoundedBorder({required this.color, required this.radius});

  /// Comprimento do traco e do vao, em pixels logicos.
  static const double _dash = 4;
  static const double _gap = 3;

  final Color color;
  final double radius;

  @override
  BoxPainter createBoxPainter([VoidCallback? onChanged]) => _DashedBoxPainter(this);
}

class _DashedBoxPainter extends BoxPainter {
  _DashedBoxPainter(this.decoration);

  final _DashedRoundedBorder decoration;

  @override
  void paint(Canvas canvas, Offset offset, ImageConfiguration configuration) {
    final size = configuration.size;
    if (size == null || size.isEmpty) return;

    final paint = Paint()
      ..color = decoration.color
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;

    final outline = Path()
      ..addRRect(
        RRect.fromRectAndRadius(
          offset & size,
          Radius.circular(decoration.radius),
        ),
      );

    const step = _DashedRoundedBorder._dash + _DashedRoundedBorder._gap;
    for (final metric in outline.computeMetrics()) {
      for (double start = 0; start < metric.length; start += step) {
        final end = start + _DashedRoundedBorder._dash;
        canvas.drawPath(
          metric.extractPath(start, end < metric.length ? end : metric.length),
          paint,
        );
      }
    }
  }
}
