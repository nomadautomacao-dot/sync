import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../shared/presentation/shared_widgets.dart';
import 'package:fl_chart/fl_chart.dart';

double _finiteOrZero(double value) => value.isFinite ? value : 0.0;

double _safeProgress(double value) {
  final n = _finiteOrZero(value);
  return n <= 0 ? 0.0 : (n >= 1 ? 1.0 : n);
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

  void _reload() => setState(() => future = _fetchDashboard());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<DashboardOverview>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) {
          return Center(
            child: SyncSurfaceCard(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const EmptyStateWidget(
                    icon: LucideIcons.wifiOff,
                    title: 'Falha ao carregar',
                    subtitle: 'Nao foi possivel atualizar os indicadores agora.',
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
        final cols = w >= 1320 ? 4 : (w >= 920 ? 3 : 2);
        final avgCity = d.portfolioMix.isEmpty
            ? 0.0
            : d.projectedProfit /
                  math.max(d.portfolioMix.fold<int>(0, (s, i) => s + i.value), 1);

        return SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Header ──
              _DashHeader(
                time: _time(_lastUpdatedAt),
                onReload: _reload,
              ),
              const SizedBox(height: 20),

              // ── Period filter (segmented) ──
              Center(
                child: _PeriodFilter(
                  selected: _selectedPeriod,
                  onChanged: (i) => setState(() => _selectedPeriod = i),
                ),
              ),
              const SizedBox(height: 20),

              // ── Hero Card ──
              _HeroCard(data: d, fmt: _fmt),
              const SizedBox(height: 16),

              // ── KPI Grid ──
              _KpiSection(kpis: d.kpis, cols: cols, compact: compact),
              const SizedBox(height: 16),

              // ── Trend + Radar ──
              if (compact) ...[
                _TrendPanel(points: d.monthlyTrend),
                const SizedBox(height: 16),
                _RadarPanel(alerts: d.alerts, avg: avgCity, fmt: _fmt),
              ] else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 8, child: _TrendPanel(points: d.monthlyTrend)),
                    const SizedBox(width: 16),
                    Expanded(flex: 4, child: _RadarPanel(alerts: d.alerts, avg: avgCity, fmt: _fmt)),
                  ],
                ),
              const SizedBox(height: 16),

              // ── Portfolio + Cities ──
              if (compact) ...[
                _PortfolioPanel(slices: d.portfolioMix),
                const SizedBox(height: 16),
                _TopCitiesPanel(cities: d.topMunicipalities, fmt: _fmt),
              ] else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 4, child: _PortfolioPanel(slices: d.portfolioMix)),
                    const SizedBox(width: 16),
                    Expanded(flex: 6, child: _TopCitiesPanel(cities: d.topMunicipalities, fmt: _fmt)),
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
// KPI Section — Rows of 2, last odd item spans full width
// ─────────────────────────────────────────────────────────────
class _KpiSection extends StatelessWidget {
  const _KpiSection({
    required this.kpis,
    required this.cols,
    required this.compact,
  });

  final List<KpiMetric> kpis;
  final int cols;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final cardHeight = compact ? 160.0 : 140.0;
    final pairs = <Widget>[];

    for (var i = 0; i < kpis.length; i += cols) {
      final remaining = kpis.length - i;
      final rowCount = remaining >= cols ? cols : remaining;
      final isLastOddRow = rowCount < cols;

      if (isLastOddRow && rowCount == 1) {
        // Single item: span full width with fixed height
        final m = kpis[i];
        pairs.add(Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: SizedBox(
            height: cardHeight,
            child: SyncMetricCard(
              label: m.label, value: m.value,
              helper: m.helper, icon: m.icon, color: m.color,
              sparkData: m.sparkData,
            ),
          ),
        ));
      } else {
        // Full row
        pairs.add(Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: SizedBox(
            height: cardHeight,
            child: Row(
              children: [
                for (var j = 0; j < rowCount; j++) ...[
                  if (j > 0) const SizedBox(width: 12),
                  Expanded(
                    child: SyncMetricCard(
                      label: kpis[i + j].label, value: kpis[i + j].value,
                      helper: kpis[i + j].helper, icon: kpis[i + j].icon,
                      color: kpis[i + j].color, sparkData: kpis[i + j].sparkData,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ));
      }
    }

    return Column(children: pairs);
  }
}

// ─────────────────────────────────────────────────────────────
// Dashboard Header (perfectly aligned)
// ─────────────────────────────────────────────────────────────
class _DashHeader extends StatelessWidget {
  const _DashHeader({required this.time, required this.onReload});
  final String time;
  final VoidCallback onReload;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Text('Dashboard', style: TextStyle(
          fontSize: 22, fontWeight: FontWeight.w700,
          color: SaaSTokens.textTitle, letterSpacing: -0.6,
        )),
        const SizedBox(height: 4),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'Receita, margem e cobertura do ciclo atual.',
              style: TextStyle(fontSize: 14, color: SaaSTokens.textMuted),
            ),
            const SizedBox(width: 8),
            Text(time, style: const TextStyle(
              fontSize: 13, fontWeight: FontWeight.w500, color: SaaSTokens.textDim,
            )),
            const SizedBox(width: 2),
            SizedBox(
              width: 32, height: 32,
              child: IconButton(
                onPressed: onReload,
                icon: const Icon(LucideIcons.refreshCw, size: 14),
                color: SaaSTokens.textDim,
                padding: EdgeInsets.zero,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Period Filter (Segmented Control)
// ─────────────────────────────────────────────────────────────
class _PeriodFilter extends StatelessWidget {
  const _PeriodFilter({required this.selected, required this.onChanged});
  final int selected;
  final ValueChanged<int> onChanged;

  static const _labels = ['Dia', 'Semana', 'Mes', 'Trimestre', 'Ano'];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: SaaSTokens.scaffold,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(_labels.length, (i) {
          final active = i == selected;
          return GestureDetector(
            onTap: () => onChanged(i),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: active ? SaaSTokens.cardWhite : Colors.transparent,
                borderRadius: BorderRadius.circular(7),
                boxShadow: active
                    ? [BoxShadow(
                        color: Colors.black.withOpacity(0.06),
                        blurRadius: 4, offset: const Offset(0, 1),
                      )]
                    : null,
              ),
              child: Text(
                _labels[i],
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                  color: active ? SaaSTokens.textTitle : SaaSTokens.textDim,
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Hero Card
// ─────────────────────────────────────────────────────────────
class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.data, required this.fmt});
  final DashboardOverview data;
  final String Function(double) fmt;

  @override
  Widget build(BuildContext context) {
    return SyncSurfaceCard(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Tag
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: SaaSTokens.primaryLight,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              '${data.year} · Receita Bruta Projetada',
              style: const TextStyle(
                fontSize: 12, fontWeight: FontWeight.w600,
                color: SaaSTokens.primary, letterSpacing: 0.2,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            fmt(data.projectedGrossRevenue),
            style: const TextStyle(
              fontSize: 36, fontWeight: FontWeight.w700,
              color: SaaSTokens.textTitle, letterSpacing: -1.4,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Leitura consolidada da carteira ativa e do pipeline atual.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: SaaSTokens.textMuted),
          ),
          const SizedBox(height: 20),
          // Sub-metrics row
          Row(
            children: [
              _HeroMetric(title: 'Lucro projetado', value: fmt(data.projectedProfit)),
              const SizedBox(width: 12),
              _HeroMetric(title: 'Margem', value: '${(data.projectedMargin * 100).toStringAsFixed(1)}%'),
              const SizedBox(width: 12),
              _HeroMetric(title: 'Cobertura', value: '${(data.implementationCoverage * 100).toStringAsFixed(0)}%'),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroMetric extends StatelessWidget {
  const _HeroMetric({required this.title, required this.value});
  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: SaaSTokens.scaffold,
          border: Border.all(color: SaaSTokens.borderLight),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(title, style: const TextStyle(
              fontSize: 12, color: SaaSTokens.textMuted,
            )),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(
              fontSize: 18, fontWeight: FontWeight.w700,
              color: SaaSTokens.textTitle, letterSpacing: -0.4,
            )),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Trend Panel with chart or empty state
// ─────────────────────────────────────────────────────────────
class _TrendPanel extends StatelessWidget {
  const _TrendPanel({required this.points});
  final List<MonthlyPoint> points;

  @override
  Widget build(BuildContext context) {
    return SyncSurfaceCard(
      child: Column(
        children: [
          const Text('Receita no ano', style: TextStyle(
            fontSize: 18, fontWeight: FontWeight.w600,
            color: SaaSTokens.textTitle, letterSpacing: -0.3,
          )),
          const SizedBox(height: 4),
          const Text('Tendencia mensal consolidada.', style: TextStyle(
            fontSize: 13, color: SaaSTokens.textMuted,
          )),
          const SizedBox(height: 24),
          _MiniRevenueChart(points: points),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Radar Panel
// ─────────────────────────────────────────────────────────────
class _RadarPanel extends StatelessWidget {
  const _RadarPanel({required this.alerts, required this.avg, required this.fmt});
  final List<AlertMessage> alerts;
  final double avg;
  final String Function(double) fmt;

  @override
  Widget build(BuildContext context) {
    return SyncSurfaceCard(
      child: Column(
        children: [
          const Text('Radar executivo', style: TextStyle(
            fontSize: 18, fontWeight: FontWeight.w600,
            color: SaaSTokens.textTitle, letterSpacing: -0.3,
          )),
          const SizedBox(height: 16),
          if (alerts.isEmpty)
            const EmptyStateWidget(
              icon: LucideIcons.shieldCheck,
              title: 'Tudo em ordem',
              subtitle: 'Nenhum alerta ativo no momento.',
            )
          else
            for (final a in alerts) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: a.color.withOpacity(0.08),
                  border: Border.all(color: a.color.withOpacity(0.15)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(LucideIcons.triangleAlert, color: a.color, size: 16),
                    const SizedBox(width: 10),
                    Expanded(child: Text(a.text, style: const TextStyle(
                      fontSize: 13, color: SaaSTokens.textBody, height: 1.4,
                    ))),
                  ],
                ),
              ),
            ],
          if (alerts.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Text('Resultado medio por cidade', style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w600,
              color: SaaSTokens.textDim, letterSpacing: 0.8,
            )),
            const SizedBox(height: 4),
            Text(fmt(avg), style: const TextStyle(
              fontSize: 22, fontWeight: FontWeight.w700,
              color: SaaSTokens.textTitle, letterSpacing: -0.6,
            )),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Mini Revenue Chart (Modern Curve with Gradient via fl_chart)
// ─────────────────────────────────────────────────────────────
class _MiniRevenueChart extends StatelessWidget {
  const _MiniRevenueChart({required this.points});
  final List<MonthlyPoint> points;

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

    final revs = points.map((p) => _finiteOrZero(p.revenue)).toList();
    final maxV = revs.reduce(math.max);
    if (maxV <= 0) {
      return const EmptyStateWidget(
        icon: LucideIcons.chartLine,
        title: 'Aguardando receita',
        subtitle: 'O grafico sera gerado automaticamente com os primeiros registros.',
        actionLabel: 'Registrar receita',
      );
    }

    // Prepare FlSpot list
    final spots = <FlSpot>[];
    for (int i = 0; i < points.length; i++) {
      spots.add(FlSpot(i.toDouble(), _finiteOrZero(points[i].revenue)));
    }

    return SizedBox(
      height: 220,
      child: Padding(
        padding: const EdgeInsets.only(top: 24, bottom: 8),
        child: LineChart(
          LineChartData(
            gridData: FlGridData(
              show: true,
              drawVerticalLine: false,
              horizontalInterval: maxV / 4 > 0 ? maxV / 4 : 1,
              getDrawingHorizontalLine: (value) => FlLine(
                color: SaaSTokens.borderLight,
                strokeWidth: 1,
                dashArray: [4, 4],
              ),
            ),
            titlesData: FlTitlesData(
              show: true,
              rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 22,
                  interval: 1,
                  getTitlesWidget: (value, meta) {
                    final index = value.toInt();
                    if (index < 0 || index >= points.length) return const SizedBox();
                    return Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        points[index].label,
                        style: const TextStyle(
                          color: SaaSTokens.textDim,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
            borderData: FlBorderData(show: false),
            minX: 0,
            maxX: (points.length - 1).toDouble(),
            minY: 0,
            maxY: maxV * 1.2,
            lineBarsData: [
              LineChartBarData(
                spots: spots,
                isCurved: true,
                curveSmoothness: 0.35,
                color: SaaSTokens.primary,
                barWidth: 3,
                isStrokeCapRound: true,
                dotData: const FlDotData(show: false),
                belowBarData: BarAreaData(
                  show: true,
                  gradient: LinearGradient(
                    colors: [
                      SaaSTokens.primary.withValues(alpha: 0.3),
                      SaaSTokens.primary.withValues(alpha: 0.0),
                    ],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
            ],
            lineTouchData: LineTouchData(
              touchTooltipData: LineTouchTooltipData(
                getTooltipColor: (spot) => SaaSTokens.textTitle,
                getTooltipItems: (touchedSpots) {
                  return touchedSpots.map((touchedSpot) {
                    final val = touchedSpot.y;
                    String formatted = 'R\$ ${val.toStringAsFixed(0)}';
                    if (val >= 1000000) {
                      formatted = 'R\$ ${(val / 1000000).toStringAsFixed(1)}M';
                    } else if (val >= 1000) {
                      formatted = 'R\$ ${(val / 1000).toStringAsFixed(1)}k';
                    }
                    return LineTooltipItem(
                      formatted,
                      const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    );
                  }).toList();
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Portfolio Panel
// ─────────────────────────────────────────────────────────────
class _PortfolioPanel extends StatelessWidget {
  const _PortfolioPanel({required this.slices});
  final List<PortfolioSlice> slices;

  @override
  Widget build(BuildContext context) {
    final vals = slices.map((s) => s.value).toList();
    final mx = vals.isEmpty ? 1 : math.max(vals.reduce(math.max), 1);

    return SyncSurfaceCard(
      child: Column(
        children: [
          const Text('Composicao da carteira', style: TextStyle(
            fontSize: 18, fontWeight: FontWeight.w600,
            color: SaaSTokens.textTitle, letterSpacing: -0.3,
          )),
          const SizedBox(height: 16),
          if (slices.isEmpty || vals.every((v) => v == 0))
            const EmptyStateWidget(
              icon: LucideIcons.chartPie,
              title: 'Carteira vazia',
              subtitle: 'Adicione empresas para visualizar a composicao.',
              actionLabel: 'Adicionar empresa',
            )
          else
            for (final s in slices) ...[
              Row(children: [
                Container(width: 10, height: 10, decoration: BoxDecoration(
                  color: s.color, borderRadius: BorderRadius.circular(3),
                )),
                const SizedBox(width: 10),
                Expanded(child: Text(s.label, style: const TextStyle(
                  fontSize: 14, color: SaaSTokens.textBody,
                ))),
                Text('${s.value}', style: const TextStyle(
                  fontSize: 15, fontWeight: FontWeight.w600,
                  color: SaaSTokens.textTitle,
                )),
              ]),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(100),
                child: LinearProgressIndicator(
                  value: _safeProgress(s.value / mx),
                  minHeight: 6,
                  backgroundColor: SaaSTokens.scaffold,
                  valueColor: AlwaysStoppedAnimation<Color>(s.color),
                ),
              ),
              const SizedBox(height: 16),
            ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Top Cities Panel
// ─────────────────────────────────────────────────────────────
class _TopCitiesPanel extends StatelessWidget {
  const _TopCitiesPanel({required this.cities, required this.fmt});
  final List<MunicipalityProjection> cities;
  final String Function(double) fmt;

  @override
  Widget build(BuildContext context) {
    return SyncSurfaceCard(
      child: Column(
        children: [
          const Text('Cidades com maior projecao', style: TextStyle(
            fontSize: 18, fontWeight: FontWeight.w600,
            color: SaaSTokens.textTitle, letterSpacing: -0.3,
          )),
          const SizedBox(height: 16),
          if (cities.isEmpty)
            const EmptyStateWidget(
              icon: LucideIcons.mapPin,
              title: 'Sem projecoes',
              subtitle: 'Dados de municipios aparecem conforme o pipeline avanca.',
              actionLabel: 'Explorar pipeline',
            )
          else
            for (final c in cities) ...[
              _CityTile(city: c, fmt: fmt),
              const SizedBox(height: 12),
            ],
        ],
      ),
    );
  }
}

class _CityTile extends StatelessWidget {
  const _CityTile({required this.city, required this.fmt});
  final MunicipalityProjection city;
  final String Function(double) fmt;

  @override
  Widget build(BuildContext context) {
    final prob = _safeProgress(city.probability);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: SaaSTokens.scaffold,
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Column(
        children: [
          Row(children: [
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${city.name}/${city.state}', style: const TextStyle(
                  fontSize: 15, fontWeight: FontWeight.w600,
                  color: SaaSTokens.textTitle,
                )),
                const SizedBox(height: 3),
                Text(
                  '${city.stage} · ${(prob * 100).toStringAsFixed(0)}%',
                  style: const TextStyle(fontSize: 12, color: SaaSTokens.textMuted),
                ),
              ],
            )),
            Text(fmt(city.projectedRevenue), style: const TextStyle(
              fontSize: 15, fontWeight: FontWeight.w600, color: SaaSTokens.textTitle,
            )),
          ]),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(100),
            child: LinearProgressIndicator(
              value: prob, minHeight: 5,
              backgroundColor: SaaSTokens.borderLight,
              valueColor: const AlwaysStoppedAnimation<Color>(SaaSTokens.primary),
            ),
          ),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: Text(
              'Lucro: ${fmt(city.projectedProfit)}',
              style: const TextStyle(fontSize: 12, color: SaaSTokens.textMuted),
            )),
            Expanded(child: Text(
              city.collaboratorName,
              textAlign: TextAlign.end,
              style: const TextStyle(fontSize: 12, color: SaaSTokens.textDim),
            )),
          ]),
        ],
      ),
    );
  }
}
