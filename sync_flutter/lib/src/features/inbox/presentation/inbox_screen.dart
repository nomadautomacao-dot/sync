import 'package:flutter/material.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/repositories/mock_sync_repository.dart';
import '../../shared/presentation/shared_widgets.dart';

class InboxScreen extends StatefulWidget {
  const InboxScreen({
    super.key,
    required this.repository,
  });

  final SyncRepository repository;

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  late Future<List<AuditEntry>> future;

  @override
  void initState() {
    super.initState();
    future = widget.repository.getAudit(limit: 30);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<AuditEntry>>(
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
                  Text('Falha ao carregar inbox', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text(snapshot.error.toString()),
                  const SizedBox(height: 16),
                  OutlinedButton(
                    onPressed: () {
                      setState(() {
                        future = widget.repository.getAudit(limit: 30);
                      });
                    },
                    child: const Text('Tentar novamente'),
                  ),
                ],
              ),
            ),
          );
        }

        final entries = snapshot.data!;
        return SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SyncSectionHeader(
                title: 'Inbox',
                description: 'Eventos reais vindos de /api/audit.',
                trailing: OutlinedButton(
                  onPressed: () {
                    setState(() {
                      future = widget.repository.getAudit(limit: 30);
                    });
                  },
                  child: const Text('Atualizar'),
                ),
              ),
              const SizedBox(height: 20),
              SyncSurfaceCard(
                child: Column(
                  children: [
                    for (final entry in entries) ...[
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          color: const Color(0xFF191C24),
                          border: Border.all(color: const Color(0xFF242833)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(entry.action, style: Theme.of(context).textTheme.bodyLarge),
                            const SizedBox(height: 6),
                            Text(entry.createdAt, style: Theme.of(context).textTheme.bodySmall),
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
