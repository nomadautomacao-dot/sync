import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:intl/intl.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/repositories/mock_sync_repository.dart';
import '../../../core/theme/app_theme.dart';
import '../../shared/presentation/shared_widgets.dart';
import 'fundeb_diagnostico_tab.dart';

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

  static const Map<String, Color> _stageColors = {
    'mapping': Color(0xFF64748B),
    'first_contact': Color(0xFF3B82F6),
    'institutional_validation': Color(0xFF8B5CF6),
    'technical_diagnosis': Color(0xFFEC4899),
    'proposal_presented': Color(0xFFF59E0B),
    'negotiation': Color(0xFF10B981),
    'verbally_approved': Color(0xFF14B8A6),
    'contractual': Color(0xFF6366F1),
    'implementation': Color(0xFF06B6D4),
    'assisted_operation': Color(0xFF84CC16),
    'fidelized': Color(0xFF10B981),
    'paused': Color(0xFF6B7280),
    'lost': Color(0xFFEF4444),
  };

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
                  const SizedBox(height: 20),
                  _buildKpiSummary(totalEstimatedRevenue, weightedRevenue, inactiveCitiesCount),
                  const SizedBox(height: 24),
                  _buildSearchAndFilters(),
                  const SizedBox(height: 16),
                  Expanded(
                    child: _isLoading
                        ? const Center(child: CircularProgressIndicator())
                        : _errorMessage != null
                            ? Center(child: Text(_errorMessage!, style: const TextStyle(color: SaaSTokens.error)))
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
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Plano de Ação Comercial',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: SaaSTokens.textTitle,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Rastreabilidade total e acompanhamento comercial dos municípios do grupo',
              style: TextStyle(
                fontSize: 13,
                color: SaaSTokens.textDim,
              ),
            ),
          ],
        ),
        Row(
          children: [
            // View Switcher
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: SaaSTokens.cardWhite,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: SaaSTokens.borderLight),
              ),
              child: Row(
                children: [
                  _viewToggleButton(
                    icon: LucideIcons.layoutGrid,
                    label: 'Kanban',
                    isSelected: _isKanbanView,
                    onTap: () => setState(() => _isKanbanView = true),
                  ),
                  const SizedBox(width: 4),
                  _viewToggleButton(
                    icon: LucideIcons.list,
                    label: 'Lista',
                    isSelected: !_isKanbanView,
                    onTap: () => setState(() => _isKanbanView = false),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            FilledButton.icon(
              onPressed: _showAddCityDialog,
              icon: const Icon(LucideIcons.plus, size: 16),
              label: const Text('Novo Município'),
              style: FilledButton.styleFrom(
                backgroundColor: SaaSTokens.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _viewToggleButton({
    required IconData icon,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? SaaSTokens.primary.withValues(alpha: 0.08) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 14,
              color: isSelected ? SaaSTokens.primary : SaaSTokens.textMuted,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                color: isSelected ? SaaSTokens.primary : SaaSTokens.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiSummary(double total, double weighted, int inactive) {
    final currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    return Row(
      children: [
        Expanded(
          child: SyncMetricCard(
            label: 'PIPELINE BRUTO (YTD)',
            value: currencyFormat.format(total),
            helper: 'Soma dos valores estimados anuais',
            icon: LucideIcons.dollarSign,
            color: SyncPalette.statusInfo,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: SyncMetricCard(
            label: 'VALOR PONDERADO (FORECAST)',
            value: currencyFormat.format(weighted),
            helper: 'Baseado na probabilidade de fechamento',
            icon: LucideIcons.trendingUp,
            color: SyncPalette.statusPurple,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: SyncMetricCard(
            label: 'ALERTA DE INATIVIDADE',
            value: '$inactive munic.',
            helper: 'Sem atividade comercial há mais de 7 dias',
            icon: LucideIcons.triangleAlert,
            color: inactive > 0 ? SyncPalette.statusError : SyncPalette.statusActive,
          ),
        ),
      ],
    );
  }

  Widget _buildSearchAndFilters() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              onChanged: (val) {
                setState(() {
                  _searchQuery = val;
                });
                _fetchCities();
              },
              decoration: const InputDecoration(
                prefixIcon: Icon(LucideIcons.search),
                hintText: 'Buscar município por nome ou UF...',
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKanbanBoard() {
    return ListView(
      scrollDirection: Axis.horizontal,
      children: _stages.map((stage) {
        final stageCities = _cities.where((c) => c.stage == stage).toList();
        double columnRevenue = stageCities.fold(0.0, (sum, c) => sum + c.estimatedAnnualRevenue);
        final currencyFormat = NumberFormat.compactCurrency(locale: 'pt_BR', symbol: 'R\$');

        return Container(
          width: 300,
          margin: const EdgeInsets.only(right: 16),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: SaaSTokens.borderLight),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Column Header
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: _stageColors[stage],
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _stageLabels[stage]!,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: SaaSTokens.textTitle,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade200,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${stageCities.length}',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
              if (columnRevenue > 0)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'Valor: ${currencyFormat.format(columnRevenue)}',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: SaaSTokens.textDim,
                    ),
                  ),
                ),
              const SizedBox(height: 8),
              const Divider(height: 1, color: SaaSTokens.borderLight),
              
              // Column Content
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(8),
                  itemCount: stageCities.length,
                  itemBuilder: (context, idx) {
                    final city = stageCities[idx];
                    return _buildCityKanbanCard(city);
                  },
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildCityKanbanCard(CityAccount city) {
    final currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    
    // Check inactivity days
    int daysIdle = 0;
    if (city.lastActivityAt != null) {
      final lastAct = DateTime.tryParse(city.lastActivityAt!);
      if (lastAct != null) {
        daysIdle = DateTime.now().difference(lastAct).inDays;
      }
    }

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(
          color: _selectedCity?.id == city.id ? SaaSTokens.primary : SaaSTokens.borderLight,
          width: _selectedCity?.id == city.id ? 1.5 : 1,
        ),
      ),
      color: Colors.white,
      child: InkWell(
        onTap: () {
          setState(() {
            _selectedCity = city;
          });
        },
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      '${city.name} - ${city.uf}',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: SaaSTokens.textTitle,
                      ),
                    ),
                  ),
                  if (daysIdle > 7)
                    Tooltip(
                      message: 'Inativo há $daysIdle dias',
                      child: const Icon(LucideIcons.triangleAlert, size: 14, color: SaaSTokens.error),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(LucideIcons.user, size: 12, color: SaaSTokens.textMuted),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      city.collaboratorName ?? 'Sem responsável',
                      style: const TextStyle(fontSize: 11, color: SaaSTokens.textDim),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    currencyFormat.format(city.estimatedAnnualRevenue),
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: SaaSTokens.textTitle,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      color: SaaSTokens.primary.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      '${city.probability}%',
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: SaaSTokens.primary,
                      ),
                    ),
                  ),
                ],
              ),
              if (city.nextStepDescription != null) ...[
                const SizedBox(height: 8),
                const Divider(height: 1, color: SaaSTokens.borderLight),
                const SizedBox(height: 6),
                Text(
                  'Próx. Passo: ${city.nextStepDescription}',
                  style: const TextStyle(
                    fontSize: 10,
                    fontStyle: FontStyle.italic,
                    color: SaaSTokens.textMuted,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (city.nextStepDueDate != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Prazo: ${DateFormat('dd/MM/yyyy').format(DateTime.parse(city.nextStepDueDate!))}',
                    style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                      color: SaaSTokens.textDim,
                    ),
                  ),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTableView() {
    final currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    return SyncSurfaceCard(
      child: SingleChildScrollView(
        child: Table(
          columnWidths: const {
            0: FlexColumnWidth(2.5),
            1: FlexColumnWidth(2),
            2: FlexColumnWidth(2),
            3: FlexColumnWidth(1.8),
            4: FlexColumnWidth(3),
            5: FlexColumnWidth(1.5),
          },
          children: [
            TableRow(
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: SaaSTokens.borderLight)),
              ),
              children: [
                _tableHeaderCell('Município'),
                _tableHeaderCell('Responsável'),
                _tableHeaderCell('Estágio'),
                _tableHeaderCell('Receita Est.'),
                _tableHeaderCell('Próximo Passo'),
                _tableHeaderCell('Ações'),
              ],
            ),
            ..._cities.map((city) {
              return TableRow(
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: SaaSTokens.borderLight)),
                ),
                children: [
                  TableCell(
                    verticalAlignment: TableCellVerticalAlignment.middle,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Text(
                        '${city.name} - ${city.uf}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ),
                  ),
                  TableCell(
                    verticalAlignment: TableCellVerticalAlignment.middle,
                    child: Text(
                      city.collaboratorName ?? '-',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                  TableCell(
                    verticalAlignment: TableCellVerticalAlignment.middle,
                    child: UnconstrainedBox(
                      alignment: Alignment.centerLeft,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _stageColors[city.stage]?.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          _stageLabels[city.stage]!,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _stageColors[city.stage],
                          ),
                        ),
                      ),
                    ),
                  ),
                  TableCell(
                    verticalAlignment: TableCellVerticalAlignment.middle,
                    child: Text(
                      currencyFormat.format(city.estimatedAnnualRevenue),
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                  TableCell(
                    verticalAlignment: TableCellVerticalAlignment.middle,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          city.nextStepDescription ?? 'Nenhum próximo passo registrado',
                          style: const TextStyle(fontSize: 11, color: SaaSTokens.textDim),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (city.nextStepDueDate != null)
                          Text(
                            'Data: ${DateFormat('dd/MM/yyyy').format(DateTime.parse(city.nextStepDueDate!))}',
                            style: const TextStyle(fontSize: 9, color: SaaSTokens.textMuted),
                          ),
                      ],
                    ),
                  ),
                  TableCell(
                    verticalAlignment: TableCellVerticalAlignment.middle,
                    child: IconButton(
                      onPressed: () {
                        setState(() {
                          _selectedCity = city;
                        });
                      },
                      icon: const Icon(LucideIcons.eye, size: 16, color: SaaSTokens.primary),
                    ),
                  ),
                ],
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _tableHeaderCell(String label) {
    return TableCell(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(
          label,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 11,
            color: SaaSTokens.textDim,
          ),
        ),
      ),
    );
  }

  Widget _buildDetailPanel() {
    final city = _selectedCity!;
    final currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');

    return Container(
      width: 450,
      decoration: const BoxDecoration(
        color: Colors.white,
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
              color: Colors.grey.shade50,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          '${city.name} - ${city.uf}',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: SaaSTokens.textTitle,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: () => setState(() => _selectedCity = null),
                        icon: const Icon(LucideIcons.x, size: 18),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _stageColors[city.stage]?.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          _stageLabels[city.stage]!,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _stageColors[city.stage],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Cód. IBGE: ${city.codigoIbge}',
                        style: const TextStyle(fontSize: 12, color: SaaSTokens.textMuted),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            
            // Tabs
            const TabBar(
              labelColor: SaaSTokens.primary,
              unselectedLabelColor: SaaSTokens.textDim,
              indicatorColor: SaaSTokens.primary,
              indicatorSize: TabBarIndicatorSize.tab,
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              tabs: [
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
        _buildInfoField('CNPJ/Status de Conta', city.status.toUpperCase()),
        _buildInfoField('Próximo Passo Planejado', city.nextStepDescription ?? 'Não cadastrado'),
        if (city.nextStepDueDate != null)
          _buildInfoField(
            'Prazo para Próximo Passo',
            DateFormat('dd/MM/yyyy').format(DateTime.parse(city.nextStepDueDate!)),
          ),
        const SizedBox(height: 16),
        const Divider(color: SaaSTokens.borderLight),
        const SizedBox(height: 16),
        const Text(
          'Ações de Transição de Estágio',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: SaaSTokens.textTitle),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _stages.map((stg) {
            final isCurrent = city.stage == stg;
            return ChoiceChip(
              label: Text(_stageLabels[stg]!, style: TextStyle(fontSize: 11, color: isCurrent ? Colors.white : SaaSTokens.textTitle)),
              selected: isCurrent,
              selectedColor: SaaSTokens.primary,
              backgroundColor: Colors.grey.shade100,
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
          'Requisitos de Validação - Estágio ${_stageLabels[city.stage]}',
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: SaaSTokens.textTitle),
        ),
        const SizedBox(height: 12),
        ...items.map((item) {
          return CheckboxListTile(
            title: Text(item.title, style: const TextStyle(fontSize: 12)),
            value: item.done,
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
        _buildInfoField('Receita Anual Estimada (Contrato)', format.format(city.estimatedAnnualRevenue)),
        _buildInfoField('Margem de Probabilidade', '${city.probability}%'),
        _buildInfoField(
          'Projeção Ponderada (Forecast)',
          format.format(city.estimatedAnnualRevenue * (city.probability / 100)),
        ),
        const SizedBox(height: 16),
        const Divider(color: SaaSTokens.borderLight),
        const SizedBox(height: 16),
        const Text(
          'Comissões Projetadas do Colaborador',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: SaaSTokens.textTitle),
        ),
        const SizedBox(height: 8),
        Text(
          'Com base na taxa de comissão territorial de 20%, o ganho estimado anual para ${city.collaboratorName ?? 'o colaborador'} é de ${format.format(city.estimatedAnnualRevenue * 0.20)} (R\$ ${format.format((city.estimatedAnnualRevenue * 0.20) / 12)} / mês).',
          style: const TextStyle(fontSize: 12, color: SaaSTokens.textDim, height: 1.4),
        ),
        const SizedBox(height: 24),
        OutlinedButton.icon(
          onPressed: () {
            _showEditCityDetailsDialog(city);
          },
          icon: const Icon(LucideIcons.pencil, size: 14),
          label: const Text('Editar Dados do Pipeline'),
        ),
      ],
    );
  }

  Widget _buildInfoField(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: SaaSTokens.textDim,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              color: SaaSTokens.textTitle,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
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
          title: const Text('Novo Município no Pipeline'),
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
          title: const Text('Editar Detalhes do Pipeline'),
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
