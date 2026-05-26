import 'package:flutter/material.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../shared/presentation/shared_widgets.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.repository,
  });

  final SyncRepository repository;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController groupNameController;
  late final TextEditingController slugController;
  late Future<WorkspaceSettings> future;
  WorkspaceSettings? currentSettings;
  bool isSaving = false;

  @override
  void initState() {
    super.initState();
    groupNameController = TextEditingController();
    slugController = TextEditingController();
    future = widget.repository.getWorkspaceSettings();
  }

  @override
  void dispose() {
    groupNameController.dispose();
    slugController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final current = currentSettings;
    if (current == null) return;

    setState(() => isSaving = true);
    try {
      final updated = await widget.repository.updateWorkspaceSettings(
        WorkspaceSettings(
          id: current.id,
          groupName: groupNameController.text.trim(),
          slug: slugController.text.trim(),
          rawSettings: current.rawSettings,
        ),
      );
      if (!mounted) return;
      currentSettings = updated;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Configuracoes salvas com sucesso.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    } finally {
      if (mounted) {
        setState(() => isSaving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<WorkspaceSettings>(
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
                  Text('Falha ao carregar configuracoes', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text(snapshot.error.toString()),
                  const SizedBox(height: 16),
                  OutlinedButton(
                    onPressed: () {
                      setState(() {
                        future = widget.repository.getWorkspaceSettings();
                      });
                    },
                    child: const Text('Tentar novamente'),
                  ),
                ],
              ),
            ),
          );
        }

        final settings = snapshot.data!;
        if (currentSettings?.id != settings.id) {
          currentSettings = settings;
          groupNameController.text = settings.groupName;
          slugController.text = settings.slug;
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SyncSectionHeader(
                title: 'Configuracoes do workspace',
                description: 'Parametros reais do grupo via /api/workspace/settings.',
                trailing: OutlinedButton(
                  onPressed: () {
                    setState(() {
                      future = widget.repository.getWorkspaceSettings();
                    });
                  },
                  child: const Text('Atualizar'),
                ),
              ),
              const SizedBox(height: 20),
              SyncSurfaceCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Dados do grupo', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 16),
                    TextField(
                      controller: groupNameController,
                      decoration: const InputDecoration(labelText: 'Nome do grupo'),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: slugController,
                      decoration: const InputDecoration(labelText: 'Slug'),
                    ),
                    const SizedBox(height: 14),
                    Text('ID do workspace: ${settings.id}', style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SyncSurfaceCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Configuracao persistida', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 12),
                    Text('Campos extras preservados no backend: ${settings.rawSettings.keys.join(', ')}'),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Align(
                alignment: Alignment.centerRight,
                child: ElevatedButton(
                  onPressed: isSaving ? null : _save,
                  child: Text(isSaving ? 'Salvando...' : 'Salvar configuracoes'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
