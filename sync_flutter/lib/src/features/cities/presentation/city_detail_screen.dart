import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/models/levantamento_fundeb_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/theme/app_theme.dart';
import '../../shared/presentation/shared_widgets.dart';

/// Tela de detalhe de uma cidade — pipeline, mapa, contatos, financeiro
class CityDetailScreen extends StatefulWidget {
  const CityDetailScreen({super.key, required this.city, required this.repository});
  final CityAccount city;
  final SyncRepository repository;

  @override
  State<CityDetailScreen> createState() => _CityDetailScreenState();
}

class _CityDetailScreenState extends State<CityDetailScreen> {
  double? _lat;
  double? _lon;
  bool _loadingGeo = true;

  // FUNDEB
  LevantamentoFundebBundle? _fundeb;
  bool _loadingFundeb = false;
  String? _fundebError;

  CityAccount get city => widget.city;

  @override
  void initState() {
    super.initState();
    _geocode();
    _fetchFundeb();
  }

  Future<void> _fetchFundeb() async {
    final ibge = city.ibgeCode;
    if (ibge == null || ibge.isEmpty) return;
    setState(() { _loadingFundeb = true; _fundebError = null; });
    try {
      final bundle = await widget.repository.getLevantamentoFundeb(
        MunicipioLookupRequest(codigoIbge: ibge, exercicio: DateTime.now().year),
      );
      if (mounted) setState(() => _fundeb = bundle);
    } catch (e) {
      if (mounted) setState(() => _fundebError = e.toString());
    } finally {
      if (mounted) setState(() => _loadingFundeb = false);
    }
  }

  Future<void> _geocode() async {
    try {
      final q = '${city.municipalityName}, ${city.state}, Brazil';
      final uri = Uri.parse(
        'https://nominatim.openstreetmap.org/search?q=${Uri.encodeQueryComponent(q)}&format=json&limit=1',
      );
      final resp = await http.get(uri, headers: {'User-Agent': 'PrimeOS/1.0'});
      if (resp.statusCode < 400) {
        final list = jsonDecode(resp.body);
        if (list is List && list.isNotEmpty) {
          _lat = double.tryParse(list[0]['lat']?.toString() ?? '');
          _lon = double.tryParse(list[0]['lon']?.toString() ?? '');
        }
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingGeo = false);
  }

  String _money(double v) {
    if (v >= 1000000) return 'R\$ ${(v / 1000000).toStringAsFixed(1)} mi';
    if (v >= 1000) return 'R\$ ${(v / 1000).toStringAsFixed(0)} mil';
    return 'R\$ ${v.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SaaSTokens.scaffold,
      body: Column(
        children: [
          // ── Header ──
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 20, 12),
            decoration: const BoxDecoration(
              color: SaaSTokens.cardWhite,
              border: Border(bottom: BorderSide(color: SaaSTokens.borderLight)),
            ),
            child: Row(children: [
              IconButton(
                icon: const Icon(LucideIcons.arrowLeft, size: 20),
                onPressed: () => Navigator.of(context).pop(),
                tooltip: 'Voltar',
              ),
              const SizedBox(width: 8),
              Container(
                width: 38, height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: city.stageColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(LucideIcons.mapPin, size: 18, color: city.stageColor),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${city.municipalityName} / ${city.state}',
                    style: const TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w700,
                      color: SaaSTokens.textTitle, letterSpacing: -0.3,
                    ),
                  ),
                  if (city.ibgeCode != null && city.ibgeCode!.isNotEmpty)
                    Text('IBGE: ${city.ibgeCode}', style: const TextStyle(fontSize: 12, color: SaaSTokens.textDim)),
                ],
              )),
              StatusPill(label: city.stageLabel, color: city.stageColor),
            ]),
          ),

          // ── Body scrollável ──
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ─── Pipeline visual ───
                  _PipelineWidget(currentStage: city.currentStage),
                  const SizedBox(height: 20),

                  // ─── Mapa ───
                  _buildMapSection(),
                  const SizedBox(height: 20),

                  // ─── Duas colunas: Info + Financeiro ───
                  LayoutBuilder(builder: (ctx, box) {
                    final wide = box.maxWidth > 700;
                    final children = [
                      // Coluna 1: Responsável + Contatos
                      _buildInfoColumn(),
                      if (wide) const SizedBox(width: 20),
                      // Coluna 2: Financeiro
                      _buildFinanceColumn(),
                    ];

                    if (wide) {
                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: children[0]),
                          children[1],
                          Expanded(child: children[2]),
                        ],
                      );
                    }
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        children[0],
                        const SizedBox(height: 16),
                        children[2],
                      ],
                    );
                  }),
                  const SizedBox(height: 20),

                  // ─── FUNDEB ───
                  _buildFundebSection(),
                  const SizedBox(height: 20),

                  // ─── Reuniões (placeholder para Fase 2) ───
                  _buildMeetingsSection(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapSection() {
    if (_loadingGeo) {
      return SyncSurfaceCard(
        child: SizedBox(
          height: 180,
          child: Center(
            child: Row(mainAxisSize: MainAxisSize.min, children: const [
              SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
              SizedBox(width: 10),
              Text('Localizando município...', style: TextStyle(fontSize: 13, color: SaaSTokens.textMuted)),
            ]),
          ),
        ),
      );
    }

    if (_lat == null || _lon == null) {
      return const SizedBox.shrink();
    }

    // OpenStreetMap static tile
    final zoom = 10;
    final mapUrl = 'https://staticmap.openstreetmap.de/staticmap.php'
        '?center=$_lat,$_lon&zoom=$zoom&size=800x240&maptype=osmarenderer'
        '&markers=$_lat,$_lon,red-pushpin';

    return SyncSurfaceCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Map image
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Image.network(
              mapUrl,
              width: double.infinity,
              height: 200,
              fit: BoxFit.cover,
              loadingBuilder: (ctx, child, progress) {
                if (progress == null) return child;
                return Container(
                  height: 200,
                  color: const Color(0xFFF1F5F9),
                  child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                );
              },
              errorBuilder: (ctx, _, __) => Container(
                height: 200,
                color: const Color(0xFFF1F5F9),
                child: Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: const [
                    Icon(LucideIcons.mapPinOff, size: 32, color: SaaSTokens.textDim),
                    SizedBox(height: 8),
                    Text('Mapa indisponível', style: TextStyle(fontSize: 12, color: SaaSTokens.textDim)),
                  ]),
                ),
              ),
            ),
          ),
          // Footer bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(children: [
              Icon(LucideIcons.mapPin, size: 14, color: SaaSTokens.primary),
              const SizedBox(width: 6),
              Expanded(child: Text(
                '${city.municipalityName}, ${city.state} · ${_lat!.toStringAsFixed(4)}, ${_lon!.toStringAsFixed(4)}',
                style: const TextStyle(fontSize: 12, color: SaaSTokens.textMuted),
              )),
              TextButton.icon(
                onPressed: () {
                  final url = 'https://www.google.com/maps/search/${Uri.encodeQueryComponent('${city.municipalityName}, ${city.state}')}';
                  launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
                },
                icon: const Icon(LucideIcons.externalLink, size: 13),
                label: const Text('Google Maps', style: TextStyle(fontSize: 12)),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                ),
              ),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoColumn() {
    return SyncSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Responsável
          Row(children: [
            const Icon(LucideIcons.userCheck, size: 15, color: SaaSTokens.primary),
            const SizedBox(width: 8),
            Text('RESPONSÁVEL', style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700,
              color: SaaSTokens.textDim, letterSpacing: 0.8,
            )),
          ]),
          const SizedBox(height: 12),
          if (city.collaboratorName != null && city.collaboratorName!.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: SaaSTokens.primaryLight,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(children: [
                Container(
                  width: 36, height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: SaaSTokens.primary,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Text(
                    city.collaboratorName!.split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase(),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(city.collaboratorName!, style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w700, color: SaaSTokens.textTitle,
                    )),
                    const Text('Parceiro responsável', style: TextStyle(fontSize: 12, color: SaaSTokens.textMuted)),
                  ],
                )),
              ]),
            )
          else
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFED7AA)),
              ),
              child: const Row(children: [
                Icon(LucideIcons.triangleAlert, size: 16, color: Color(0xFFF59E0B)),
                SizedBox(width: 8),
                Text('Nenhum parceiro vinculado', style: TextStyle(fontSize: 13, color: Color(0xFFB45309))),
              ]),
            ),

          const SizedBox(height: 20),

          // Contatos da prefeitura
          Row(children: [
            const Icon(LucideIcons.landmark, size: 15, color: SaaSTokens.textDim),
            const SizedBox(width: 8),
            Text('CONTATOS DA PREFEITURA', style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700,
              color: SaaSTokens.textDim, letterSpacing: 0.8,
            )),
          ]),
          const SizedBox(height: 12),
          _contactRow(LucideIcons.landmark, 'Prefeito(a)', city.mayorName),
          const SizedBox(height: 8),
          _contactRow(LucideIcons.graduationCap, 'Sec. Educação', city.educationSecretaryName),
          const SizedBox(height: 8),
          _contactRow(LucideIcons.scale, 'Licitação', city.procurementLeadName),
        ],
      ),
    );
  }

  Widget _contactRow(IconData icon, String role, String? name) {
    return Row(children: [
      Icon(icon, size: 14, color: SaaSTokens.textDim),
      const SizedBox(width: 8),
      Text('$role: ', style: const TextStyle(fontSize: 13, color: SaaSTokens.textMuted)),
      Flexible(child: Text(
        name != null && name.isNotEmpty ? name : '—',
        style: TextStyle(
          fontSize: 13, fontWeight: FontWeight.w600,
          color: name != null && name.isNotEmpty ? SaaSTokens.textTitle : SaaSTokens.textDim,
        ),
        overflow: TextOverflow.ellipsis,
      )),
    ]);
  }

  Widget _buildFinanceColumn() {
    final revenue = city.estimatedAnnualRevenue;
    final cost = city.estimatedAnnualCost;
    final profit = city.estimatedAnnualProfit;
    final prob = city.effectiveProbability;
    final weighted = revenue * prob;

    return SyncSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(LucideIcons.trendingUp, size: 15, color: Color(0xFFF59E0B)),
            const SizedBox(width: 8),
            Text('PROJEÇÃO FINANCEIRA', style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700,
              color: SaaSTokens.textDim, letterSpacing: 0.8,
            )),
          ]),
          const SizedBox(height: 16),
          _financeRow('Receita estimada', _money(revenue), const Color(0xFF3B82F6)),
          const SizedBox(height: 10),
          _financeRow('Custo estimado', _money(cost), const Color(0xFFF59E0B)),
          const SizedBox(height: 10),
          _financeRow('Lucro estimado', _money(profit), const Color(0xFF10B981)),
          const Divider(height: 24, color: SaaSTokens.borderLight),
          _financeRow('Probabilidade', '${(prob * 100).toStringAsFixed(0)}%', SaaSTokens.primary),
          const SizedBox(height: 10),
          _financeRow('Receita ponderada', _money(weighted), const Color(0xFF8B5CF6)),
        ],
      ),
    );
  }

  Widget _financeRow(String label, String value, Color color) {
    return Row(children: [
      Container(
        width: 6, height: 6,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      ),
      const SizedBox(width: 10),
      Expanded(child: Text(label, style: const TextStyle(fontSize: 13, color: SaaSTokens.textMuted))),
      Text(value, style: TextStyle(
        fontSize: 14, fontWeight: FontWeight.w700,
        color: SaaSTokens.textTitle,
      )),
    ]);
  }

  Widget _buildFundebSection() {
    if (city.ibgeCode == null || city.ibgeCode!.isEmpty) {
      return const SizedBox.shrink();
    }

    if (_loadingFundeb) {
      return SyncSurfaceCard(
        child: SizedBox(
          height: 120,
          child: Center(child: Row(mainAxisSize: MainAxisSize.min, children: const [
            SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
            SizedBox(width: 10),
            Text('Carregando dados FUNDEB...', style: TextStyle(fontSize: 13, color: SaaSTokens.textMuted)),
          ])),
        ),
      );
    }

    if (_fundebError != null) {
      return SyncSurfaceCard(
        child: Row(children: [
          const Icon(LucideIcons.triangleAlert, size: 16, color: Color(0xFFF59E0B)),
          const SizedBox(width: 8),
          Expanded(child: Text('FUNDEB: $_fundebError', style: const TextStyle(fontSize: 12, color: SaaSTokens.textMuted))),
          TextButton(onPressed: _fetchFundeb, child: const Text('Tentar novamente', style: TextStyle(fontSize: 12))),
        ]),
      );
    }

    if (_fundeb == null) return const SizedBox.shrink();

    final r = _fundeb!.relatorio;
    final rec = r.receitas;
    final proj = r.projecao;
    final censo = r.censoEscolar;
    final ident = r.identificacao;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Header
      SyncSurfaceCard(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(LucideIcons.graduationCap, size: 15, color: Color(0xFF8B5CF6)),
            const SizedBox(width: 8),
            Text('DIAGNÓSTICO FUNDEB ${ident.exercicio}', style: const TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700, color: SaaSTokens.textDim, letterSpacing: 0.8,
            )),
            const Spacer(),
            if (ident.prefeito.isNotEmpty && !ident.prefeito.contains('Consultar'))
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(LucideIcons.landmark, size: 12, color: Color(0xFF16A34A)),
                  const SizedBox(width: 6),
                  Text(ident.prefeito, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF15803D))),
                ]),
              ),
          ]),
          const SizedBox(height: 16),

          // KPIs row
          LayoutBuilder(builder: (ctx, box) {
            final items = <_FundebKpiData>[
              _FundebKpiData('Receita FUNDEB', _money(rec.totalReceitas), const Color(0xFF3B82F6), LucideIcons.wallet),
              _FundebKpiData('Estimativa Projetada', _money(proj.totalProjetado), const Color(0xFF8B5CF6), LucideIcons.trendingUp),
              _FundebKpiData('Ganho Potencial', _money(proj.totalGanho), const Color(0xFF10B981), LucideIcons.arrowUpRight),
              _FundebKpiData('Variação', '${(proj.ganhoPercentual * 100).toStringAsFixed(1)}%', const Color(0xFFF59E0B), LucideIcons.percent),
            ];
            return Row(children: items.map((k) => Expanded(child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 4),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: k.color.withOpacity(0.06),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: k.color.withOpacity(0.15)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(k.icon, size: 14, color: k.color),
                const SizedBox(height: 8),
                Text(k.value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: k.color)),
                const SizedBox(height: 2),
                Text(k.label, style: const TextStyle(fontSize: 10, color: SaaSTokens.textDim)),
              ]),
            ))).toList());
          }),
        ]),
      ),
      const SizedBox(height: 12),

      // Receitas + Educacional side by side
      LayoutBuilder(builder: (ctx, box) {
        final wide = box.maxWidth > 700;
        final receitasCard = SyncSurfaceCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(LucideIcons.chartPie, size: 14, color: SaaSTokens.textDim),
            const SizedBox(width: 8),
            const Text('COMPOSIÇÃO DAS RECEITAS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: SaaSTokens.textDim, letterSpacing: 0.8)),
          ]),
          const SizedBox(height: 14),
          _fundebReceita('Contribuição Municipal', rec.receitaContribuicaoMunicipal, rec.totalReceitas, const Color(0xFF3B82F6)),
          const SizedBox(height: 8),
          _fundebReceita('Complementação VAAF', rec.complementacaoVAAF, rec.totalReceitas, const Color(0xFF10B981)),
          const SizedBox(height: 8),
          _fundebReceita('Complementação VAAT', rec.complementacaoVAAT, rec.totalReceitas, const Color(0xFF8B5CF6)),
          const SizedBox(height: 8),
          _fundebReceita('Complementação VAAR', rec.complementacaoVAAR, rec.totalReceitas, const Color(0xFFF59E0B)),
          const Divider(height: 20, color: SaaSTokens.borderLight),
          Row(children: [
            const Expanded(child: Text('TOTAL', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: SaaSTokens.textTitle))),
            Text(_money(rec.totalReceitas), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: SaaSTokens.textTitle)),
          ]),
        ]));

        final educCard = SyncSurfaceCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(LucideIcons.school, size: 14, color: SaaSTokens.textDim),
            const SizedBox(width: 8),
            const Text('DADOS EDUCACIONAIS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: SaaSTokens.textDim, letterSpacing: 0.8)),
          ]),
          const SizedBox(height: 14),
          if (censo != null) ...[
            _educRow(LucideIcons.school, 'Escolas', '${censo.totalEscolas}'),
            const SizedBox(height: 8),
            _educRow(LucideIcons.users, 'Matrículas', _formatInt(censo.totalMatriculas)),
            const SizedBox(height: 8),
            _educRow(LucideIcons.bookOpen, 'Docentes', _formatInt(censo.totalDocentes)),
            const SizedBox(height: 8),
            _educRow(LucideIcons.baby, 'Ed. Infantil', _formatInt(censo.matriculasEtapa.educacaoInfantil)),
            const SizedBox(height: 8),
            _educRow(LucideIcons.pencil, 'Fundamental', _formatInt(censo.matriculasEtapa.ensinoFundamental)),
            const SizedBox(height: 8),
            _educRow(LucideIcons.bookOpenCheck, 'EJA', _formatInt(censo.matriculasEtapa.eja)),
          ] else
            const Text('Censo escolar não disponível', style: TextStyle(fontSize: 12, color: SaaSTokens.textDim)),
        ]));

        if (wide) {
          return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: receitasCard),
            const SizedBox(width: 16),
            Expanded(child: educCard),
          ]);
        }
        return Column(children: [receitasCard, const SizedBox(height: 12), educCard]);
      }),
    ]);
  }

  Widget _fundebReceita(String label, double value, double total, Color color) {
    final pct = total > 0 ? value / total : 0.0;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: color)),
        const SizedBox(width: 8),
        Expanded(child: Text(label, style: const TextStyle(fontSize: 12, color: SaaSTokens.textMuted))),
        Text(_money(value), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: SaaSTokens.textTitle)),
        const SizedBox(width: 8),
        SizedBox(width: 42, child: Text('${(pct * 100).toStringAsFixed(1)}%', textAlign: TextAlign.right,
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: color))),
      ]),
      const SizedBox(height: 4),
      ClipRRect(
        borderRadius: BorderRadius.circular(2),
        child: LinearProgressIndicator(value: pct, minHeight: 3, backgroundColor: SaaSTokens.borderLight, valueColor: AlwaysStoppedAnimation(color)),
      ),
    ]);
  }

  Widget _educRow(IconData icon, String label, String value) {
    return Row(children: [
      Icon(icon, size: 14, color: SaaSTokens.textDim),
      const SizedBox(width: 8),
      Expanded(child: Text(label, style: const TextStyle(fontSize: 12, color: SaaSTokens.textMuted))),
      Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: SaaSTokens.textTitle)),
    ]);
  }

  String _formatInt(int v) {
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(1)}k';
    return v.toString();
  }

  Widget _buildMeetingsSection() {
    return SyncSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(LucideIcons.video, size: 15, color: Color(0xFF8B5CF6)),
            const SizedBox(width: 8),
            Text('REUNIÕES', style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700,
              color: SaaSTokens.textDim, letterSpacing: 0.8,
            )),
            const Spacer(),
            OutlinedButton.icon(
              onPressed: () {}, // Fase 2
              icon: const Icon(LucideIcons.plus, size: 14),
              label: const Text('Nova Reunião'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                textStyle: const TextStyle(fontSize: 12),
              ),
            ),
          ]),
          const SizedBox(height: 16),
          const EmptyStateWidget(
            icon: LucideIcons.calendarPlus,
            title: 'Nenhuma reunião registrada',
            subtitle: 'Adicione reuniões para acompanhar o progresso desta cidade.',
          ),
        ],
      ),
    );
  }
}

// ───────────────────────────────────────────────────
// Pipeline visual — estágios com indicadores
// ───────────────────────────────────────────────────
class _PipelineWidget extends StatelessWidget {
  const _PipelineWidget({required this.currentStage});
  final String currentStage;

  static const _stages = [
    ('mapping', 'Indicação'),
    ('first_contact', '1º Contato'),
    ('institutional_validation', 'Validação'),
    ('technical_diagnosis', 'Diagnóstico'),
    ('proposal_presented', 'Proposta'),
    ('negotiation', 'Negociação'),
    ('verbally_approved', 'Aprovação'),
    ('contractual', 'Contrato'),
    ('implementation', 'Implantação'),
    ('assisted_operation', 'Operação'),
    ('fidelized', 'Fidelizado'),
  ];

  @override
  Widget build(BuildContext context) {
    final currentIdx = _stages.indexWhere((s) => s.$1 == currentStage).clamp(0, _stages.length - 1);

    return SyncSurfaceCard(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(LucideIcons.gitBranch, size: 15, color: SaaSTokens.primary),
            const SizedBox(width: 8),
            Text('PIPELINE', style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700,
              color: SaaSTokens.textDim, letterSpacing: 0.8,
            )),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: (cityStageColors[currentStage] ?? SaaSTokens.primary).withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${currentIdx + 1} de ${_stages.length}',
                style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600,
                  color: cityStageColors[currentStage] ?? SaaSTokens.primary,
                ),
              ),
            ),
          ]),
          const SizedBox(height: 16),

          // Barra de progresso
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (currentIdx + 1) / _stages.length,
              minHeight: 6,
              backgroundColor: SaaSTokens.borderLight,
              valueColor: AlwaysStoppedAnimation(cityStageColors[currentStage] ?? SaaSTokens.primary),
            ),
          ),
          const SizedBox(height: 14),

          // Estágios
          LayoutBuilder(builder: (ctx, box) {
            final stepW = box.maxWidth / _stages.length;
            final showLabel = stepW > 55;

            return Row(
              children: List.generate(_stages.length, (i) {
                final isPast = i < currentIdx;
                final isCurrent = i == currentIdx;
                final color = isCurrent
                    ? (cityStageColors[_stages[i].$1] ?? SaaSTokens.primary)
                    : isPast
                        ? const Color(0xFF10B981)
                        : SaaSTokens.borderLight;

                return Expanded(
                  child: Column(
                    children: [
                      // Dot
                      Container(
                        width: isCurrent ? 16 : 10,
                        height: isCurrent ? 16 : 10,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isCurrent ? color : (isPast ? color : Colors.transparent),
                          border: Border.all(color: color, width: isCurrent ? 3 : 2),
                        ),
                        child: isPast
                            ? const Icon(Icons.check_rounded, size: 6, color: Colors.white)
                            : null,
                      ),
                      if (showLabel) ...[
                        const SizedBox(height: 6),
                        Text(
                          _stages[i].$2,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500,
                            color: isCurrent ? color : (isPast ? SaaSTokens.textMuted : SaaSTokens.textDim),
                          ),
                        ),
                      ],
                    ],
                  ),
                );
              }),
            );
          }),
        ],
      ),
    );
  }
}

class _FundebKpiData {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  const _FundebKpiData(this.label, this.value, this.color, this.icon);
}
