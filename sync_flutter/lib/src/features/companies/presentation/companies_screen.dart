import 'package:flutter/material.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/repositories/mock_sync_repository.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../shared/presentation/shared_widgets.dart';
import 'new_company_dialog.dart';

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

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SyncSectionHeader(
            title: 'Empresas',
            description: 'Fluxo real conectado a backend para lista e detalhe de empresas.',
            trailing: ElevatedButton.icon(
              onPressed: () async {
                final created = await showDialog<bool>(
                  context: context,
                  builder: (context) =>
                      NewCompanyDialog(repository: widget.repository),
                );
                if (created == true) _refresh();
              },
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nova empresa'),
            ),
          ),
          const SizedBox(height: 20),
          SyncSurfaceCard(
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(
                  width: 320,
                  child: TextField(
                    controller: searchController,
                    onSubmitted: (_) => _refresh(),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search_rounded),
                      hintText: 'Buscar empresa por nome, CNPJ ou segmento...',
                      suffixIcon: IconButton(
                        onPressed: _refresh,
                        icon: const Icon(Icons.arrow_forward_rounded),
                      ),
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: SyncPalette.bgSurface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: SyncPalette.borderSubtle),
                  ),
                  child: DropdownButton<String>(
                    value: status,
                    underline: const SizedBox.shrink(),
                    dropdownColor: SyncPalette.bgSurface,
                    items: const ['Todos', 'Ativo', 'Inativo']
                        .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                        .toList(),
                    onChanged: (value) {
                      setState(() {
                        status = value ?? 'Todos';
                        companiesFuture = _loadCompanies();
                      });
                    },
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: _refresh,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Atualizar'),
                ),
              ],
            ),
          ),
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
                return SyncSurfaceCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Falha ao carregar empresas',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        snapshot.error.toString(),
                        style: Theme.of(context).textTheme.bodyMedium,
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

              final companies = snapshot.data ?? const <CompanySummary>[];
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${companies.length} empresa(s) encontrada(s)',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 12),
                  ...companies.map((company) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: SyncSurfaceCard(
                        child: Row(
                          children: [
                            Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                color: company.color.withOpacity(0.16),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Icon(Icons.apartment_rounded, color: company.color),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    company.tradingName,
                                    style: Theme.of(context).textTheme.titleLarge,
                                  ),
                                  const SizedBox(height: 4),
                                  Text('${company.segment} - ${company.city}/${company.state}'),
                                  const SizedBox(height: 8),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: [
                                      StatusPill(
                                        label: company.status,
                                        color: company.status == 'Ativo'
                                            ? SyncPalette.statusActive
                                            : SyncPalette.textSecondary,
                                      ),
                                      ...company.enabledModules.map(
                                        (module) => StatusPill(
                                          label: module,
                                          color: SyncPalette.statusInfo,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 16),
                            OutlinedButton(
                              onPressed: () => widget.onOpenCompany(company.id),
                              child: const Text('Abrir'),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
