import 'package:flutter/material.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../shared/presentation/shared_widgets.dart';
import 'case_sucesso_screen.dart';
import 'contrato_capa_capa_screen.dart';
import 'kit_documental_screen.dart';
import 'levantamento_fundeb_lite_screen.dart';
import 'levantamento_fundeb_screen.dart';

class ModulesScreen extends StatefulWidget {
  const ModulesScreen({
    super.key,
    required this.repository,
    required this.selectedKey,
    required this.onSelectModule,
  });

  final SyncRepository repository;
  final String? selectedKey;
  final ValueChanged<String> onSelectModule;

  @override
  State<ModulesScreen> createState() => _ModulesScreenState();
}

class _ModulesScreenState extends State<ModulesScreen> {
  late Future<List<ModuleDefinition>> future;

  @override
  void initState() {
    super.initState();
    future = widget.repository.getModules();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<ModuleDefinition>>(
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
                  Text(
                    'Falha ao carregar modulos',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Nao foi possivel atualizar o catalogo agora.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton(
                    onPressed: () {
                      setState(() {
                        future = widget.repository.getModules();
                      });
                    },
                    child: const Text('Tentar novamente'),
                  ),
                ],
              ),
            ),
          );
        }

        final modules = snapshot.data!;
        final selectedModule = widget.selectedKey == null
            ? null
            : modules.firstWhere(
                (module) => module.key == widget.selectedKey,
                orElse: () => modules.first,
              );

        if (selectedModule?.key == 'levantamento-fundeb') {
          return LevantamentoFundebScreen(
            repository: widget.repository,
            module: selectedModule!,
            onBack: () => widget.onSelectModule(''),
          );
        }

        if (selectedModule?.key == 'levantamento-lite-fundeb') {
          return LevantamentoFundebLiteScreen(
            repository: widget.repository,
            module: selectedModule!,
            onBack: () => widget.onSelectModule(''),
          );
        }

        if (selectedModule?.key == 'contrato-fundeb') {
          return ContratoCapaCapaScreen(
            repository: widget.repository,
            module: selectedModule!,
            onBack: () => widget.onSelectModule(''),
          );
        }

        if (selectedModule?.key == 'case-de-sucesso') {
          return CaseSucessoScreen(
            repository: widget.repository,
            module: selectedModule!,
            onBack: () => widget.onSelectModule(''),
          );
        }

        if (selectedModule?.key == 'kit-documental') {
          return KitDocumentalScreen(
            repository: widget.repository,
            module: selectedModule!,
            onBack: () => widget.onSelectModule(''),
          );
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SyncSectionHeader(
                title: selectedModule == null
                    ? 'Catalogo de modulos'
                    : selectedModule.label,
                description: selectedModule == null
                    ? 'Gerencie as extensoes ativas do seu workspace.'
                    : selectedModule.description,
                trailing: Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    OutlinedButton(
                      onPressed: () {
                        setState(() {
                          future = widget.repository.getModules();
                        });
                      },
                      child: const Text('Atualizar'),
                    ),
                    if (selectedModule != null)
                      OutlinedButton(
                        onPressed: () => widget.onSelectModule(''),
                        child: const Text('Voltar ao catalogo'),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              if (selectedModule == null)
                Wrap(
                  spacing: 16,
                  runSpacing: 16,
                  children: modules
                      .map(
                        (module) => SizedBox(
                          width: 280,
                          child: GestureDetector(
                            onTap: () => widget.onSelectModule(module.key),
                            child: SyncSurfaceCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 52,
                                    height: 52,
                                    decoration: BoxDecoration(
                                      color: module.color.withValues(
                                        alpha: 0.16,
                                      ),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Icon(
                                      module.icon,
                                      color: module.color,
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    module.label,
                                    style: Theme.of(
                                      context,
                                    ).textTheme.titleLarge,
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    module.description,
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodyMedium,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                )
              else
                SyncSurfaceCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              color: selectedModule.color.withValues(
                                alpha: 0.16,
                              ),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Icon(
                              selectedModule.icon,
                              color: selectedModule.color,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Text(
                              selectedModule.label,
                              style: Theme.of(context).textTheme.headlineSmall,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'Descricao oficial do modulo no catalogo atual:',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        selectedModule.description,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
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
