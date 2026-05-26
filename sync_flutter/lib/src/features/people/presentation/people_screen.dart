import 'package:flutter/material.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/repositories/mock_sync_repository.dart';
import '../../shared/presentation/shared_widgets.dart';

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
  String search = '';
  late Future<List<CollaboratorSummary>> future;

  @override
  void initState() {
    super.initState();
    future = widget.repository.getCollaborators();
  }

  String _formatCurrency(double value) {
    return 'R\$ ${(value / 1000).toStringAsFixed(0)} mil';
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Falha ao carregar colaboradores', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text(snapshot.error.toString()),
                  const SizedBox(height: 16),
                  OutlinedButton(
                    onPressed: () {
                      setState(() {
                        future = widget.repository.getCollaborators();
                      });
                    },
                    child: const Text('Tentar novamente'),
                  ),
                ],
              ),
            ),
          );
        }

        final collaborators = snapshot.data!;
        final filtered = collaborators.where((item) {
          return search.isEmpty ||
              item.fullName.toLowerCase().contains(search.toLowerCase()) ||
              item.role.toLowerCase().contains(search.toLowerCase()) ||
              item.state.toLowerCase().contains(search.toLowerCase());
        }).toList();

        final activeCount = collaborators.where((item) => item.status == 'Ativo').length;
        final cityCount = collaborators.fold<int>(0, (sum, item) => sum + item.cities);
        final profit = collaborators.fold<double>(0, (sum, item) => sum + item.profitYtd);
        final commission = collaborators.fold<double>(0, (sum, item) => sum + item.commissionYtd);

        return SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SyncSectionHeader(
                title: 'Colaboradores',
                description: 'Rede real de parceiros e articuladores via /api/collaborators.',
                trailing: OutlinedButton(
                  onPressed: () {
                    setState(() {
                      future = widget.repository.getCollaborators();
                    });
                  },
                  child: const Text('Atualizar'),
                ),
              ),
              const SizedBox(height: 20),
              Wrap(
                spacing: 16,
                runSpacing: 16,
                children: [
                  SizedBox(
                    width: 240,
                    child: SyncMetricCard(
                      label: 'Colaboradores ativos',
                      value: '$activeCount',
                      helper: 'parcerias em andamento',
                      icon: Icons.badge_outlined,
                      color: SyncPalette.statusInfo,
                    ),
                  ),
                  SizedBox(
                    width: 240,
                    child: SyncMetricCard(
                      label: 'Cidades associadas',
                      value: '$cityCount',
                      helper: 'municipios em acompanhamento',
                      icon: Icons.map_outlined,
                      color: SyncPalette.statusActive,
                    ),
                  ),
                  SizedBox(
                    width: 240,
                    child: SyncMetricCard(
                      label: 'Lucro YTD',
                      value: _formatCurrency(profit),
                      helper: 'resultado acumulado',
                      icon: Icons.bar_chart_rounded,
                      color: SyncPalette.statusWarning,
                    ),
                  ),
                  SizedBox(
                    width: 240,
                    child: SyncMetricCard(
                      label: 'Comissao prevista',
                      value: _formatCurrency(commission),
                      helper: 'base recorrente prevista',
                      icon: Icons.attach_money_rounded,
                      color: SyncPalette.statusPurple,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              SyncSurfaceCard(
                child: Column(
                  children: [
                    TextField(
                      onChanged: (value) => setState(() => search = value),
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.search_rounded),
                        hintText: 'Buscar colaborador, UF ou papel...',
                      ),
                    ),
                    const SizedBox(height: 18),
                    for (final collaborator in filtered) ...[
                      Container(
                        padding: const EdgeInsets.all(16),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          color: SyncPalette.bgSurface,
                          border: Border.all(color: SyncPalette.borderSubtle),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        collaborator.fullName,
                                        style: Theme.of(context).textTheme.titleMedium,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '${collaborator.role} - ${collaborator.type} - ${collaborator.state}',
                                      ),
                                    ],
                                  ),
                                ),
                                StatusPill(
                                  label: collaborator.status,
                                  color: collaborator.status == 'Ativo'
                                      ? SyncPalette.statusActive
                                      : SyncPalette.statusWarning,
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 18,
                              runSpacing: 8,
                              children: [
                                Text('Cidades: ${collaborator.cities}'),
                                Text('Fidelizadas: ${collaborator.fidelized}'),
                                Text('Lucro YTD: ${_formatCurrency(collaborator.profitYtd)}'),
                                Text('Comissao: ${_formatCurrency(collaborator.commissionYtd)}'),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
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
