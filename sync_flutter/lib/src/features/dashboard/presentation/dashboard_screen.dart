import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../shared/presentation/shared_widgets.dart';

double _finiteOrZero(double value) => value.isFinite ? value : 0.0;

double _safeProgress(double value) {
  final n = _finiteOrZero(value);
  return n <= 0 ? 0.0 : (n >= 1 ? 1.0 : n);
}

/// Formato compacto usado no tooltip do grafico.
String _compactMoney(double value) {
  final v = _finiteOrZero(value);
  if (v >= 1000000) return 'R\$ ${(v / 1000000).toStringAsFixed(1)}M';
  if (v >= 1000) return 'R\$ ${(v / 1000).toStringAsFixed(1)}k';
  return 'R\$ ${v.toStringAsFixed(0)}';
}

// Rotulo de mes em mono caixa alta. O repositorio entrega os pontos rotulados
// como '01'..'12'; qualquer outro formato so vira caixa alta.
const _monthAbbr = <String>[
  'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
  'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ',
];

int? _monthNumber(String raw) {
  final n = int.tryParse(raw.trim());
  return (n != null && n >= 1 && n <= 12) ? n : null;
}

String _monthLabel(String raw) {
  final n = _monthNumber(raw);
  return n == null ? raw.toUpperCase() : _monthAbbr[n - 1];
}

/// Grade de cards de largura igual, sem sombra e com calha fixa.
Widget _cardGrid(List<Widget> cards, int cols, {double gap = 12}) {
  final rows = <Widget>[];
  for (var i = 0; i < cards.length; i += cols) {
    final cells = <Widget>[];
    for (var j = 0; j < cols; j++) {
      if (j > 0) cells.add(SizedBox(width: gap));
      final index = i + j;
      cells.add(Expanded(
        child: index < cards.length ? cards[index] : const SizedBox.shrink(),
      ));
    }
    if (rows.isNotEmpty) rows.add(SizedBox(height: gap));
    rows.add(IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: cells),
    ));
  }
  return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.repository});
  final SyncRepository repository;
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<DashboardOverview> future;
  late DateTime _lastUpdatedAt;
  int _selectedPeriod = 2; // default "Mes"

  @override
  void initState() {
    super.initState();
    _lastUpdatedAt = DateTime.now();
    future = _fetchDashboard();
  }

  String _fmt(double v) {
    if (v >= 1000000) return 'R\$ ${(v / 1000000).toStringAsFixed(1)} mi';
    if (v >= 1000) return 'R\$ ${(v / 1000).toStringAsFixed(0)} mil';
    return 'R\$ ${v.toStringAsFixed(0)}';
  }

  String _time(DateTime v) =>
      '${v.hour.toString().padLeft(2, '0')}:${v.minute.toString().padLeft(2, '0')}';

  Future<DashboardOverview> _fetchDashboard() async {
    final r = await widget.repository.getDashboard();
    _lastUpdatedAt = DateTime.now();
    return r;
  }

  void _reload() {
    final f = _fetchDashboard();
    setState(() { future = f; });
  }

  Widget _buildSkeletonDashboard() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header skeleton
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SyncShimmer(width: 200, height: 24, borderRadius: 6),
                    const SizedBox(height: 8),
                    const SyncShimmer(width: 160, height: 14, borderRadius: 4),
                  ],
                ),
              ),
              const SyncShimmer(width: 120, height: 40, borderRadius: 10),
            ],
          ),
          const SizedBox(height: 24),
          // Faixa de KPI skeleton
          LayoutBuilder(builder: (context, constraints) {
            final cols = constraints.maxWidth >= 1080 ? 4 : (constraints.maxWidth >= 680 ? 2 : 1);
            return Wrap(
              spacing: 12,
              runSpacing: 12,
              children: List.generate(4, (_) {
                final cardWidth = (constraints.maxWidth - (cols - 1) * 12) / cols;
                return SizedBox(
                  width: cardWidth,
                  child: const SyncSkeletonCard(lines: 2),
                );
              }),
            );
          }),
          const SizedBox(height: 16),
          // Chart area skeleton
          SyncSurfaceCard(
            radius: SaaSTokens.rCard,
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SyncShimmer(width: 180, height: 18, borderRadius: 4),
                const SizedBox(height: 24),
                const SyncShimmer(height: 200, borderRadius: 8),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<DashboardOverview>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return _buildSkeletonDashboard();
        }
        if (snap.hasError) {
          return Center(
            child: SyncSurfaceCard(
              radius: SaaSTokens.rCard,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const EmptyStateWidget(
                    icon: LucideIcons.wifiOff,
                    title: 'Falha ao carregar',
                    subtitle: 'Não foi possível atualizar os indicadores agora.',
                  ),
                  OutlinedButton.icon(
                    onPressed: _reload,
                    icon: const Icon(LucideIcons.refreshCw, size: 16),
                    label: const Text('Tentar novamente'),
                  ),
                ],
              ),
            ),
          );
        }

        final d = snap.data!;
        final w = MediaQuery.sizeOf(context).width;
        final compact = w < 920;
        final avgCity = d.portfolioMix.isEmpty
            ? 0.0
            : d.projectedProfit /
                  math.max(d.portfolioMix.fold<int>(0, (s, i) => s + i.value), 1);

        return SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Cabecalho: titulo, periodo e acao primaria ──
              _DashHeader(
                year: d.year,
                time: _time(_lastUpdatedAt),
                selectedPeriod: _selectedPeriod,
                // TODO(redesign): o repositorio ainda nao aceita filtro de
                // periodo em getDashboard(); o segmentado so guarda a selecao.
                onPeriodChanged: (i) => setState(() => _selectedPeriod = i),
                onReload: _reload,
              ),
              const SizedBox(height: 24),

              // ── Faixa de 4 KPIs ──
              _KpiBand(data: d, fmt: _fmt),
              const SizedBox(height: 16),

              // ── Receita no ano + Radar executivo ──
              if (compact) ...[
                _TrendPanel(points: d.monthlyTrend, year: d.year, fmt: _fmt),
                const SizedBox(height: 16),
                _RadarPanel(alerts: d.alerts, avg: avgCity, fmt: _fmt),
              ] else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 8,
                      child: _TrendPanel(points: d.monthlyTrend, year: d.year, fmt: _fmt),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      flex: 4,
                      child: _RadarPanel(alerts: d.alerts, avg: avgCity, fmt: _fmt),
                    ),
                  ],
                ),
              const SizedBox(height: 16),

              // ── Cidades com maior projecao ──
              _TopCitiesPanel(cities: d.topMunicipalities, fmt: _fmt),
              const SizedBox(height: 16),

              // ── Composicao da carteira + indicadores do ciclo ──
              if (compact) ...[
                _PortfolioPanel(slices: d.portfolioMix),
                const SizedBox(height: 16),
                _MetricStrip(kpis: d.kpis),
              ] else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 4, child: _PortfolioPanel(slices: d.portfolioMix)),
                    const SizedBox(width: 16),
                    Expanded(flex: 6, child: _MetricStrip(kpis: d.kpis)),
                  ],
                ),
            ],
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Cabecalho — titulo de pagina, pilula de sincronizacao,
// segmentado de periodo e botao primario.
// ─────────────────────────────────────────────────────────────
class _DashHeader extends StatelessWidget {
  const _DashHeader({
    required this.year,
    required this.time,
    required this.selectedPeriod,
    required this.onPeriodChanged,
    required this.onReload,
  });

  final int year;
  final String time;
  final int selectedPeriod;
  final ValueChanged<int> onPeriodChanged;
  final VoidCallback onReload;

  @override
  Widget build(BuildContext context) {
    final title = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text('Visão executiva', style: GsText.pageTitle),
        const SizedBox(height: 4),
        Text.rich(
          TextSpan(
            style: GsText.body.copyWith(color: SaaSTokens.textMuted),
            children: [
              const TextSpan(text: 'Carteira consolidada · exercicio '),
              TextSpan(text: '$year', style: GsText.dataSm),
            ],
          ),
        ),
      ],
    );

    final actions = Wrap(
      spacing: 10,
      runSpacing: 10,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        _SyncPill(time: time),
        _PeriodFilter(selected: selectedPeriod, onChanged: onPeriodChanged),
        ElevatedButton.icon(
          onPressed: onReload,
          icon: const Icon(LucideIcons.refreshCw, size: 16),
          label: const Text('Atualizar'),
        ),
      ],
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 880) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [title, const SizedBox(height: 14), actions],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(child: title),
            const SizedBox(width: 20),
            actions,
          ],
        );
      },
    );
  }
}

class _SyncPill extends StatelessWidget {
  const _SyncPill({required this.time});
  final String time;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
      decoration: BoxDecoration(
        border: Border.all(color: SaaSTokens.borderLight),
        borderRadius: BorderRadius.circular(SaaSTokens.rPill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
              color: SaaSTokens.success,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text('sincronizado $time', style: GsText.dataXs),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Segmentado de periodo — mono, sem sombra, teal no ativo.
// ─────────────────────────────────────────────────────────────
class _PeriodFilter extends StatelessWidget {
  const _PeriodFilter({required this.selected, required this.onChanged});
  final int selected;
  final ValueChanged<int> onChanged;

  static const _labels = ['Dia', 'Semana', 'Mes', 'Trimestre', 'Ano'];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Container(
        decoration: BoxDecoration(
          color: SaaSTokens.cardWhite,
          border: Border.all(color: SaaSTokens.borderLight),
          borderRadius: BorderRadius.circular(SaaSTokens.rControl),
        ),
        clipBehavior: Clip.antiAlias,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < _labels.length; i++)
              InkWell(
                onTap: () => onChanged(i),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: i == selected ? SaaSTokens.primary : Colors.transparent,
                    border: i == 0
                        ? null
                        : const Border(
                            left: BorderSide(color: SaaSTokens.borderLight),
                          ),
                  ),
                  child: Text(
                    _labels[i],
                    style: GsText.dataSm.copyWith(
                      color: i == selected ? Colors.white : SaaSTokens.textMuted,
                      fontWeight: i == selected ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Faixa de 4 KPIs — rotulo em caixa alta, numero em mono,
// e UMA linha de apoio por card.
// ─────────────────────────────────────────────────────────────
class _KpiBand extends StatelessWidget {
  const _KpiBand({required this.data, required this.fmt});
  final DashboardOverview data;
  final String Function(double) fmt;

  @override
  Widget build(BuildContext context) {
    final cards = <Widget>[
      _KpiCard(
        label: 'LUCRO PROJETADO',
        value: fmt(data.projectedProfit),
        // TODO(redesign): o delta contra o exercicio anterior ainda nao existe
        // no repositorio; a linha de apoio traz a receita bruta do ciclo.
        support: _KpiMeta(text: 'bruto ${fmt(data.projectedGrossRevenue)}'),
      ),
      _KpiCard(
        label: 'MARGEM',
        value: '${(_finiteOrZero(data.projectedMargin) * 100).toStringAsFixed(1)}%',
        support: _KpiBar(value: _safeProgress(data.projectedMargin)),
      ),
      _KpiCard(
        label: 'COBERTURA',
        value: '${(_finiteOrZero(data.implementationCoverage) * 100).toStringAsFixed(0)}%',
        support: _KpiBar(value: _safeProgress(data.implementationCoverage)),
      ),
      _KpiCard(
        label: 'PENDÊNCIAS',
        value: '${data.alerts.length}',
        support: const _KpiMeta(
          text: 'no radar executivo',
          icon: LucideIcons.triangleAlert,
          tint: SaaSTokens.warning,
        ),
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final cols = constraints.maxWidth >= 1080
            ? 4
            : (constraints.maxWidth >= 680 ? 2 : 1);
        return _cardGrid(cards, cols);
      },
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.label,
    required this.value,
    required this.support,
  });

  final String label;
  final String value;
  final Widget support;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border.all(color: SaaSTokens.borderLight),
        borderRadius: BorderRadius.circular(SaaSTokens.rCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: GsText.label.copyWith(color: SaaSTokens.textDim)),
          const SizedBox(height: 10),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(value, style: GsText.kpiXl, maxLines: 1),
          ),
          const SizedBox(height: 12),
          support,
        ],
      ),
    );
  }
}

/// Linha de apoio: barra de progresso fina.
class _KpiBar extends StatelessWidget {
  const _KpiBar({required this.value});
  final double value;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: LinearProgressIndicator(
        value: value,
        minHeight: 5,
        backgroundColor: SaaSTokens.scaffold,
        valueColor: const AlwaysStoppedAnimation<Color>(SaaSTokens.primary),
      ),
    );
  }
}

/// Linha de apoio: metadado em mono, com icone semantico opcional.
class _KpiMeta extends StatelessWidget {
  const _KpiMeta({required this.text, this.icon, this.tint});
  final String text;
  final IconData? icon;
  final Color? tint;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (icon != null) ...[
          Icon(icon, size: 14, color: tint ?? SaaSTokens.textDim),
          const SizedBox(width: 6),
        ],
        Flexible(
          child: Text(
            text,
            style: GsText.dataXs,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Receita no ano — barras em teal, meses futuros esvaecidos.
// ─────────────────────────────────────────────────────────────
class _TrendPanel extends StatelessWidget {
  const _TrendPanel({
    required this.points,
    required this.year,
    required this.fmt,
  });

  final List<MonthlyPoint> points;
  final int year;
  final String Function(double) fmt;

  @override
  Widget build(BuildContext context) {
    final total = points.fold<double>(0, (s, p) => s + _finiteOrZero(p.revenue));

    return SyncSurfaceCard(
      radius: SaaSTokens.rCard,
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Receita no ano', style: GsText.cardTitle),
                    const SizedBox(height: 3),
                    Text(
                      'Tendência mensal consolidada',
                      style: GsText.body.copyWith(color: SaaSTokens.textMuted),
                    ),
                  ],
                ),
              ),
              if (total > 0) ...[
                const SizedBox(width: 12),
                Text('${fmt(total)} acum.', style: GsText.dataSm),
              ],
            ],
          ),
          const SizedBox(height: 18),
          _RevenueBars(points: points, year: year),
        ],
      ),
    );
  }
}

class _RevenueBars extends StatelessWidget {
  const _RevenueBars({required this.points, required this.year});
  final List<MonthlyPoint> points;
  final int year;

  @override
  Widget build(BuildContext context) {
    if (points.isEmpty) {
      return const EmptyStateWidget(
        icon: LucideIcons.chartLine,
        title: 'Nenhum dado registrado',
        subtitle: 'A tendencia aparece quando houver receita mensal.',
        actionLabel: 'Comecar a registrar',
      );
    }

    final revs = points
        .map((p) => _finiteOrZero(p.revenue))
        .toList(growable: false);
    final maxV = revs.reduce(math.max);
    if (maxV <= 0) {
      return const EmptyStateWidget(
        icon: LucideIcons.chartLine,
        title: 'Aguardando receita',
        subtitle: 'O grafico sera gerado automaticamente com os primeiros registros.',
        actionLabel: 'Registrar receita',
      );
    }

    // Mes futuro = ainda nao percorrido no exercicio exibido.
    final now = DateTime.now();
    bool isFuture(int index) {
      if (year > now.year) return true;
      if (year < now.year) return false;
      final month = _monthNumber(points[index].label) ?? (index + 1);
      return month > now.month;
    }

    return SizedBox(
      height: 186,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final slot = constraints.maxWidth / points.length;
          final barWidth = (slot * 0.56).clamp(6.0, 22.0);
          return BarChart(
            BarChartData(
              alignment: BarChartAlignment.spaceAround,
              minY: 0,
              maxY: maxV * 1.15,
              gridData: const FlGridData(show: false),
              borderData: FlBorderData(show: false),
              titlesData: FlTitlesData(
                show: true,
                leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 26,
                    interval: 1,
                    getTitlesWidget: (value, meta) {
                      final index = value.toInt();
                      if (index < 0 || index >= points.length) {
                        return const SizedBox.shrink();
                      }
                      return Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          _monthLabel(points[index].label),
                          style: GsText.label.copyWith(
                            color: isFuture(index)
                                ? SaaSTokens.textDim
                                : SaaSTokens.textMuted,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              barTouchData: BarTouchData(
                touchTooltipData: BarTouchTooltipData(
                  getTooltipColor: (group) => SaaSTokens.textTitle,
                  getTooltipItem: (group, groupIndex, rod, rodIndex) => BarTooltipItem(
                    _compactMoney(rod.toY),
                    GsText.dataXsStrong.copyWith(color: Colors.white),
                  ),
                ),
              ),
              barGroups: [
                for (var i = 0; i < points.length; i++)
                  BarChartGroupData(
                    x: i,
                    barRods: [
                      BarChartRodData(
                        toY: revs[i],
                        width: barWidth,
                        color: isFuture(i)
                            ? SaaSTokens.primaryLight
                            : SaaSTokens.primary,
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(5),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Radar executivo — alerta com icone semantico.
// ─────────────────────────────────────────────────────────────
class _RadarPanel extends StatelessWidget {
  const _RadarPanel({required this.alerts, required this.avg, required this.fmt});
  final List<AlertMessage> alerts;
  final double avg;
  final String Function(double) fmt;

  @override
  Widget build(BuildContext context) {
    return SyncSurfaceCard(
      radius: SaaSTokens.rCard,
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Radar executivo', style: GsText.cardTitle),
          const SizedBox(height: 14),
          if (alerts.isEmpty)
            const EmptyStateWidget(
              icon: LucideIcons.shieldCheck,
              title: 'Tudo em ordem',
              subtitle: 'Nenhum alerta ativo no momento.',
            )
          else
            for (var i = 0; i < alerts.length; i++) ...[
              if (i > 0) const SizedBox(height: 10),
              _AlertRow(alert: alerts[i]),
            ],
          if (avg > 0) ...[
            const SizedBox(height: 16),
            const Divider(height: 1),
            const SizedBox(height: 14),
            const Text('RESULTADO MEDIO POR CIDADE', style: GsText.label),
            const SizedBox(height: 6),
            Text(fmt(avg), style: GsText.kpiLg),
          ],
        ],
      ),
    );
  }
}

class _AlertRow extends StatelessWidget {
  const _AlertRow({required this.alert});
  final AlertMessage alert;

  /// Icone e superficie derivam da cor semantica que o repositorio ja envia:
  /// ambar = prazo, vermelho = risco, verde = ok, teal = revisao.
  static (IconData, Color, Color, Color) _look(Color source) {
    if (source == SaaSTokens.error) {
      return (
        LucideIcons.octagonAlert,
        SaaSTokens.error,
        SaaSTokens.errorLight,
        SaaSTokens.error.withValues(alpha: 0.22),
      );
    }
    if (source == SaaSTokens.warning) {
      return (
        LucideIcons.clock,
        SaaSTokens.warning,
        SaaSTokens.warningLight,
        SaaSTokens.warningBorder,
      );
    }
    if (source == SaaSTokens.success) {
      return (
        LucideIcons.badgeCheck,
        SaaSTokens.success,
        SaaSTokens.cardWhite,
        SaaSTokens.borderLight,
      );
    }
    return (
      LucideIcons.fileText,
      SaaSTokens.primary,
      SaaSTokens.cardWhite,
      SaaSTokens.borderLight,
    );
  }

  @override
  Widget build(BuildContext context) {
    final (icon, tint, background, border) = _look(alert.color);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(SaaSTokens.rControl),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 17, color: tint),
          const SizedBox(width: 10),
          // TODO(redesign): a linha de contexto do alerta (lote, prazo, fonte)
          // ainda nao existe no repositorio — AlertMessage so traz texto e cor.
          Expanded(child: Text(alert.text, style: GsText.bodyStrong)),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Cidades com maior projecao — tabela densa, numeros a direita.
// ─────────────────────────────────────────────────────────────
class _TopCitiesPanel extends StatelessWidget {
  const _TopCitiesPanel({required this.cities, required this.fmt});
  final List<MunicipalityProjection> cities;
  final String Function(double) fmt;

  static const _minTableWidth = 920.0;

  // Proporcao das colunas: municipio · uf · estagio · receita · lucro · margem · prob.
  static const _flexName = 200;
  static const _flexState = 50;
  static const _flexStage = 165;
  static const _flexRevenue = 120;
  static const _flexProfit = 120;
  static const _flexMargin = 80;
  static const _flexProb = 70;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border.all(color: SaaSTokens.borderLight),
        borderRadius: BorderRadius.circular(SaaSTokens.rCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 15, 20, 15),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Flexible(
                  child: Text(
                    'Cidades com maior projeção',
                    style: GsText.cardTitle,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 10),
                Text('${cities.length} municípios', style: GsText.dataXs),
              ],
            ),
          ),
          const Divider(height: 1),
          if (cities.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: EmptyStateWidget(
                icon: LucideIcons.mapPin,
                title: 'Sem projecoes',
                subtitle: 'Dados de municípios aparecem conforme o pipeline avança.',
                actionLabel: 'Explorar pipeline',
              ),
            )
          else
            LayoutBuilder(
              builder: (context, constraints) {
                final table = _table();
                if (constraints.maxWidth >= _minTableWidth) return table;
                return SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: SizedBox(width: _minTableWidth, child: table),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _table() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Cabecalho de coluna: mono, caixa alta, sobre surfaceSubtle.
        Container(
          decoration: const BoxDecoration(
            color: SaaSTokens.surfaceSubtle,
            border: Border(bottom: BorderSide(color: SaaSTokens.borderLight)),
          ),
          child: const Row(
            children: [
              _HeadCell('MUNICÍPIO', _flexName),
              _HeadCell('UF', _flexState),
              _HeadCell('ESTÁGIO', _flexStage),
              // TODO(redesign): o design pede "VAAT 2026"; o repositorio so
              // entrega a receita projetada do municipio.
              _HeadCell('RECEITA PROJ.', _flexRevenue, right: true),
              _HeadCell('LUCRO PROJ.', _flexProfit, right: true),
              _HeadCell('MARGEM', _flexMargin, right: true),
              _HeadCell('PROB.', _flexProb, right: true),
            ],
          ),
        ),
        for (var i = 0; i < cities.length; i++)
          _cityRow(cities[i], last: i == cities.length - 1),
      ],
    );
  }

  Widget _cityRow(MunicipalityProjection city, {required bool last}) {
    final revenue = _finiteOrZero(city.projectedRevenue);
    final profit = _finiteOrZero(city.projectedProfit);
    final margin = revenue > 0 ? profit / revenue : 0.0;
    final prob = _safeProgress(city.probability);

    // TODO(redesign): a linha inteira deveria abrir o municipio, mas nao ha
    // rota de detalhe disponivel para o dashboard — sem onTap e sem chevron
    // para nao prometer uma acao que nao existe.
    return Container(
      decoration: last
          ? null
          : const BoxDecoration(
              border: Border(bottom: BorderSide(color: SaaSTokens.scaffold)),
            ),
      child: Row(
        children: [
          _BodyCell(
            flex: _flexName,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  city.name,
                  style: GsText.bodyStrong,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (city.collaboratorName.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    city.collaboratorName,
                    style: GsText.caption,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          _BodyCell(
            flex: _flexState,
            child: Text(
              city.state.toUpperCase(),
              style: GsText.data.copyWith(color: SaaSTokens.textMuted),
            ),
          ),
          _BodyCell(flex: _flexStage, child: _StageChip(stage: city.stage)),
          _BodyCell(
            flex: _flexRevenue,
            right: true,
            child: Text(fmt(revenue), style: GsText.data),
          ),
          _BodyCell(
            flex: _flexProfit,
            right: true,
            child: Text(fmt(profit), style: GsText.dataStrong),
          ),
          _BodyCell(
            flex: _flexMargin,
            right: true,
            child: Text('${(margin * 100).toStringAsFixed(1)}%', style: GsText.data),
          ),
          _BodyCell(
            flex: _flexProb,
            right: true,
            child: Text(
              '${(prob * 100).toStringAsFixed(0)}%',
              style: GsText.data.copyWith(color: SaaSTokens.textMuted),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeadCell extends StatelessWidget {
  const _HeadCell(this.text, this.flex, {this.right = false});
  final String text;
  final int flex;
  final bool right;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      flex: flex,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        child: Text(
          text,
          style: GsText.label,
          textAlign: right ? TextAlign.right : TextAlign.left,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }
}

class _BodyCell extends StatelessWidget {
  const _BodyCell({required this.flex, required this.child, this.right = false});
  final int flex;
  final Widget child;
  final bool right;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      flex: flex,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 13),
        child: Align(
          alignment: right ? Alignment.centerRight : Alignment.centerLeft,
          child: child,
        ),
      ),
    );
  }
}

/// Chip de estagio — a unica cor semantica da linha.
class _StageChip extends StatelessWidget {
  const _StageChip({required this.stage});
  final String stage;

  @override
  Widget build(BuildContext context) {
    final normalized = stage.toLowerCase();
    Color background = SaaSTokens.surfaceAlt;
    Color foreground = SaaSTokens.textSoft;

    if (normalized.contains('fideliz')) {
      background = SaaSTokens.successLight;
      foreground = SaaSTokens.successDark;
    } else if (normalized.contains('contrato') ||
        normalized.contains('implanta') ||
        normalized.contains('operacao')) {
      background = SaaSTokens.primaryLight;
      foreground = SaaSTokens.primaryHover;
    } else if (normalized.contains('proposta') || normalized.contains('negocia')) {
      background = SaaSTokens.warningLight;
      foreground = SaaSTokens.warningDarker;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(SaaSTokens.rChip),
      ),
      child: Text(
        normalized,
        style: GsText.chip.copyWith(
          color: foreground,
          fontWeight: FontWeight.w600,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Composicao da carteira — barra por fatia, contagem em mono.
// ─────────────────────────────────────────────────────────────
class _PortfolioPanel extends StatelessWidget {
  const _PortfolioPanel({required this.slices});
  final List<PortfolioSlice> slices;

  @override
  Widget build(BuildContext context) {
    final total = slices.fold<int>(0, (s, i) => s + i.value);
    final mx = slices.isEmpty
        ? 1
        : math.max(slices.map((s) => s.value).reduce(math.max), 1);

    return SyncSurfaceCard(
      radius: SaaSTokens.rCard,
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Expanded(
                child: Text('Composicao da carteira', style: GsText.cardTitle),
              ),
              if (total > 0) Text('$total cidades', style: GsText.dataXs),
            ],
          ),
          const SizedBox(height: 16),
          if (slices.isEmpty || total == 0)
            const EmptyStateWidget(
              icon: LucideIcons.chartPie,
              title: 'Carteira vazia',
              subtitle: 'Adicione empresas para visualizar a composicao.',
              actionLabel: 'Adicionar empresa',
            )
          else
            // A cor de cada fatia vinda do repositorio nao e usada: o console
            // trabalha com um accent unico e a hierarquia vem do peso.
            for (var i = 0; i < slices.length; i++) ...[
              if (i > 0) const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(child: Text(slices[i].label, style: GsText.body)),
                  const SizedBox(width: 10),
                  Text('${slices[i].value}', style: GsText.dataStrong),
                ],
              ),
              const SizedBox(height: 7),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: _safeProgress(slices[i].value / mx),
                  minHeight: 5,
                  backgroundColor: SaaSTokens.surfaceAlt,
                  valueColor: const AlwaysStoppedAnimation<Color>(SaaSTokens.primary),
                ),
              ),
            ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Indicadores do ciclo — os KPIs que o repositorio ja publica.
// ─────────────────────────────────────────────────────────────
class _MetricStrip extends StatelessWidget {
  const _MetricStrip({required this.kpis});
  final List<KpiMetric> kpis;

  @override
  Widget build(BuildContext context) {
    if (kpis.isEmpty) return const SizedBox.shrink();

    final cards = [for (final m in kpis) _MetricCard(metric: m)];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.only(left: 2, bottom: 10),
          child: Text('INDICADORES DO CICLO', style: GsText.label),
        ),
        LayoutBuilder(
          builder: (context, constraints) {
            final cols = constraints.maxWidth >= 700
                ? 3
                : (constraints.maxWidth >= 420 ? 2 : 1);
            return _cardGrid(cards, cols);
          },
        ),
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.metric});
  final KpiMetric metric;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border.all(color: SaaSTokens.borderLight),
        borderRadius: BorderRadius.circular(SaaSTokens.rCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              // O icone segue o token neutro: a cor que vem do repositorio
              // introduziria um segundo accent, proibido nesta direcao.
              Icon(metric.icon, size: 15, color: SaaSTokens.textDim),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  metric.label.toUpperCase(),
                  style: GsText.label.copyWith(color: SaaSTokens.textDim),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(metric.value, style: GsText.kpiLg, maxLines: 1),
          ),
          const SizedBox(height: 8),
          Text(
            metric.helper,
            style: GsText.bodySm,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
