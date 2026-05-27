import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/theme/app_theme.dart';
import '../../shared/presentation/shared_widgets.dart';
import 'new_city_dialog.dart';
import 'city_detail_screen.dart';

class CitiesScreen extends StatefulWidget {
  const CitiesScreen({super.key, required this.repository});
  final SyncRepository repository;

  @override
  State<CitiesScreen> createState() => _CitiesScreenState();
}

class _CitiesScreenState extends State<CitiesScreen> {
  String _search = '';
  String _stageFilter = '';
  late Future<List<CityAccount>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.repository.getCities();
  }

  void _reload() => setState(() {
    _future = widget.repository.getCities(search: _search, stage: _stageFilter);
  });

  String _money(double v) {
    if (v >= 1000000) return 'R\$ ${(v / 1000000).toStringAsFixed(1)} mi';
    if (v >= 1000) return 'R\$ ${(v / 1000).toStringAsFixed(0)} mil';
    return 'R\$ ${v.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<CityAccount>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: SyncSurfaceCard(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Falha ao carregar cidades', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Text(snap.error.toString()),
                const SizedBox(height: 16),
                OutlinedButton(onPressed: _reload, child: const Text('Tentar novamente')),
              ],
            )),
          );
        }

        final cities = snap.data ?? [];
        final filtered = cities.where((c) {
          final q = _search.toLowerCase();
          final matchSearch = q.isEmpty ||
              c.municipalityName.toLowerCase().contains(q) ||
              c.state.toLowerCase().contains(q) ||
              c.stageLabel.toLowerCase().contains(q) ||
              (c.collaboratorName ?? '').toLowerCase().contains(q);
          final matchStage = _stageFilter.isEmpty || c.currentStage == _stageFilter;
          return matchSearch && matchStage;
        }).toList();

        // KPIs
        final total = cities.length;
        final inMeeting = cities.where((c) =>
          c.currentStage == 'first_contact' ||
          c.currentStage == 'institutional_validation' ||
          c.currentStage == 'technical_diagnosis'
        ).length;
        final inNegotiation = cities.where((c) =>
          c.currentStage == 'proposal_presented' ||
          c.currentStage == 'negotiation' ||
          c.currentStage == 'verbally_approved'
        ).length;
        final contracted = cities.where((c) =>
          c.currentStage == 'contractual' ||
          c.currentStage == 'implementation' ||
          c.currentStage == 'assisted_operation' ||
          c.currentStage == 'fidelized'
        ).length;
        final fidelized = cities.where((c) => c.currentStage == 'fidelized').length;

        // Stage counts for chips
        final stageCounts = <String, int>{};
        for (final c in cities) {
          stageCounts[c.currentStage] = (stageCounts[c.currentStage] ?? 0) + 1;
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Cabeçalho ──
              SyncSectionHeader(
                title: 'Cidades',
                description: 'Pipeline de municípios FUNDEB — da indicação ao contrato.',
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    FilledButton.icon(
                      onPressed: () async {
                        final result = await showDialog<bool>(
                          context: context,
                          builder: (_) => NewCityDialog(repository: widget.repository),
                        );
                        if (result == true) _reload();
                      },
                      icon: const Icon(LucideIcons.mapPinPlus, size: 16),
                      label: const Text('Nova Cidade'),
                      style: FilledButton.styleFrom(
                        backgroundColor: SaaSTokens.primary,
                        foregroundColor: Colors.white,
                      ),
                    ),
                    const SizedBox(width: 10),
                    OutlinedButton.icon(
                      onPressed: _reload,
                      icon: const Icon(LucideIcons.refreshCw, size: 15),
                      label: const Text('Atualizar'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // ── KPIs uniformes ──
              LayoutBuilder(builder: (context, constraints) {
                const gap = 14.0;
                final cols = constraints.maxWidth > 800 ? 5 : (constraints.maxWidth > 500 ? 3 : 2);
                final cardW = (constraints.maxWidth - gap * (cols - 1)) / cols;
                return Wrap(spacing: gap, runSpacing: gap, children: [
                  SizedBox(width: cardW, child: SyncMetricCard(
                    label: 'Total', value: '$total',
                    helper: 'cidades no pipeline', icon: LucideIcons.mapPin,
                    color: const Color(0xFF3B82F6),
                  )),
                  SizedBox(width: cardW, child: SyncMetricCard(
                    label: 'Em reunião', value: '$inMeeting',
                    helper: 'contato / diagnóstico', icon: LucideIcons.video,
                    color: const Color(0xFF8B5CF6),
                  )),
                  SizedBox(width: cardW, child: SyncMetricCard(
                    label: 'Negociação', value: '$inNegotiation',
                    helper: 'proposta / aprovação', icon: LucideIcons.handshake,
                    color: const Color(0xFFF59E0B),
                  )),
                  SizedBox(width: cardW, child: SyncMetricCard(
                    label: 'Contratadas', value: '$contracted',
                    helper: 'contratos ativos', icon: LucideIcons.fileCheck,
                    color: const Color(0xFF10B981),
                  )),
                  SizedBox(width: cardW, child: SyncMetricCard(
                    label: 'Fidelizadas', value: '$fidelized',
                    helper: 'base recorrente', icon: LucideIcons.shieldCheck,
                    color: const Color(0xFF22C55E),
                  )),
                ]);
              }),
              const SizedBox(height: 20),

              // ── Filtros + Lista ──
              SyncSurfaceCard(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextField(
                      onChanged: (v) => setState(() => _search = v),
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.search_rounded),
                        hintText: 'Buscar cidade, UF, estágio ou colaborador...',
                      ),
                    ),
                    const SizedBox(height: 12),

                    if (stageCounts.isNotEmpty) Wrap(spacing: 8, runSpacing: 8, children: [
                      _StageChip(
                        label: 'Todas', count: total,
                        color: SaaSTokens.primary,
                        selected: _stageFilter.isEmpty,
                        onTap: () => setState(() => _stageFilter = ''),
                      ),
                      for (final e in stageCounts.entries)
                        _StageChip(
                          label: cityStageLabels[e.key] ?? e.key,
                          count: e.value,
                          color: cityStageColors[e.key] ?? SaaSTokens.textDim,
                          selected: _stageFilter == e.key,
                          onTap: () => setState(() => _stageFilter = _stageFilter == e.key ? '' : e.key),
                        ),
                    ]),
                    const SizedBox(height: 16),

                    if (filtered.isEmpty)
                      EmptyStateWidget(
                        icon: LucideIcons.mapPinOff,
                        title: 'Nenhuma cidade encontrada',
                        subtitle: cities.isEmpty
                            ? 'Clique em "Nova Cidade" para começar seu pipeline.'
                            : 'Ajuste a busca ou o filtro de estágio.',
                      )
                    else
                      ...filtered.map((city) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _CityRow(city: city, money: _money, repository: widget.repository),
                      )),

                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ──────────────────────────────────────────────
// City row card
// ──────────────────────────────────────────────
class _CityRow extends StatelessWidget {
  const _CityRow({required this.city, required this.money, required this.repository});
  final CityAccount city;
  final String Function(double) money;
  final SyncRepository repository;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
        Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => CityDetailScreen(city: city, repository: repository),
        ));
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: SaaSTokens.scaffold,
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Row(
        children: [
          // Ícone com cor do estágio
          Container(
            width: 42, height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: city.stageColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(LucideIcons.mapPin, size: 20, color: city.stageColor),
          ),
          const SizedBox(width: 14),

          // Info principal
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${city.municipalityName} / ${city.state}',
                style: const TextStyle(
                  fontSize: 15, fontWeight: FontWeight.w700,
                  color: SaaSTokens.textTitle, letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 3),
              Row(children: [
                if (city.collaboratorName != null && city.collaboratorName!.isNotEmpty) ...[
                  Icon(LucideIcons.userCheck, size: 12, color: SaaSTokens.primary),
                  const SizedBox(width: 4),
                  Text(
                    city.collaboratorName!,
                    style: const TextStyle(fontSize: 12, color: SaaSTokens.primary, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(width: 12),
                ],
                if (city.estimatedAnnualRevenue > 0) ...[
                  Icon(LucideIcons.trendingUp, size: 12, color: SaaSTokens.textDim),
                  const SizedBox(width: 4),
                  Text(
                    money(city.estimatedAnnualRevenue),
                    style: const TextStyle(fontSize: 12, color: SaaSTokens.textMuted, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(width: 12),
                ],
                Icon(LucideIcons.target, size: 12, color: SaaSTokens.textDim),
                const SizedBox(width: 4),
                Text(
                  '${(city.effectiveProbability * 100).toStringAsFixed(0)}%',
                  style: const TextStyle(fontSize: 12, color: SaaSTokens.textMuted, fontWeight: FontWeight.w500),
                ),
              ]),
            ],
          )),

          StatusPill(label: city.stageLabel, color: city.stageColor),
        ],
      ),
      ),
    );
  }
}

// ──────────────────────────────────────────────
// Stage filter chip
// ──────────────────────────────────────────────
class _StageChip extends StatelessWidget {
  const _StageChip({
    required this.label, required this.count, required this.color,
    required this.selected, required this.onTap,
  });
  final String label;
  final int count;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? color.withOpacity(0.12) : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? color.withOpacity(0.3) : SaaSTokens.borderLight),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: color)),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(
            fontSize: 12, fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? color : SaaSTokens.textMuted,
          )),
          const SizedBox(width: 4),
          Text('($count)', style: TextStyle(fontSize: 11, color: selected ? color.withOpacity(0.7) : SaaSTokens.textDim)),
        ]),
      ),
    );
  }
}
