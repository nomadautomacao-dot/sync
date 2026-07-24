import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/theme/app_theme.dart';
import '../../shared/presentation/shared_widgets.dart';

// ─────────────────────────────────────────────────────────────
// Inbox — direcao "Console Tecnico".
//
// Deixa de ser um log corrido e vira triagem: lista agrupada por dia a
// esquerda, painel de decisao a direita (empilhado abaixo de 940px).
//
// O modelo `AuditEntry` hoje carrega apenas `action` e `createdAt`. Tudo o
// que o desenho pede alem disso (nao lido, responsavel, lote, prazo, diff de
// versao, acoes de aprovacao) esta marcado com TODO(redesign) no ponto em que
// seria renderizado — nada e fabricado aqui.
// ─────────────────────────────────────────────────────────────

/// Categoria do evento. Nao existe campo `type` em `AuditEntry`, entao ela e
/// derivada do proprio texto de `action` — e o unico sinal disponivel.
///
// TODO(redesign): categoria/tipo do evento ainda nao existe no repositorio;
// enquanto isso ela e inferida por palavra-chave do texto de auditoria.
enum _EventKind { pendencia, aprovacao, sistema, geral }

enum _InboxFilter { tudo, pendencias, aprovacoes, sistema }

extension on _InboxFilter {
  String get label => switch (this) {
    _InboxFilter.tudo => 'tudo',
    _InboxFilter.pendencias => 'pendências',
    _InboxFilter.aprovacoes => 'aprovações',
    _InboxFilter.sistema => 'sistema',
  };

  bool accepts(_EventKind kind) => switch (this) {
    _InboxFilter.tudo => true,
    _InboxFilter.pendencias => kind == _EventKind.pendencia,
    _InboxFilter.aprovacoes => kind == _EventKind.aprovacao,
    _InboxFilter.sistema => kind == _EventKind.sistema,
  };
}

extension on _EventKind {
  String get label => switch (this) {
    _EventKind.pendencia => 'pendência',
    _EventKind.aprovacao => 'aprovação',
    _EventKind.sistema => 'sistema',
    _EventKind.geral => 'registro',
  };

  IconData get icon => switch (this) {
    _EventKind.pendencia => LucideIcons.clockAlert,
    _EventKind.aprovacao => LucideIcons.fileCheck,
    _EventKind.sistema => LucideIcons.refreshCw,
    _EventKind.geral => LucideIcons.info,
  };

  Color get accent => switch (this) {
    _EventKind.pendencia => SaaSTokens.warning,
    _EventKind.aprovacao => SaaSTokens.primary,
    _EventKind.sistema => SaaSTokens.success,
    _EventKind.geral => SaaSTokens.textDim,
  };

  Color get chipBackground => switch (this) {
    _EventKind.pendencia => SaaSTokens.warningLight,
    _EventKind.aprovacao => SaaSTokens.successLight,
    _EventKind.sistema => SaaSTokens.surfaceSubtle,
    _EventKind.geral => SaaSTokens.surfaceSubtle,
  };

  Color get chipForeground => switch (this) {
    _EventKind.pendencia => SaaSTokens.warningDarker,
    _EventKind.aprovacao => SaaSTokens.successDark,
    _EventKind.sistema => SaaSTokens.textMuted,
    _EventKind.geral => SaaSTokens.textMuted,
  };

  /// Evento de sistema e so registro: peso normal. O resto pede acao e vem
  /// em peso forte, como o desenho pede para o item nao lido.
  bool get demandsAttention =>
      this == _EventKind.pendencia || this == _EventKind.aprovacao;
}

/// Evento de auditoria ja normalizado para a triagem.
class _InboxEvent {
  _InboxEvent(this.entry)
    : moment = _parseMoment(entry.createdAt),
      kind = _classify(entry.action);

  final AuditEntry entry;
  final DateTime? moment;
  final _EventKind kind;

  String get action => entry.action;

  String get timeLabel {
    final at = moment;
    if (at == null) return entry.createdAt;
    return '${_two(at.hour)}:${_two(at.minute)}';
  }

  String get dateLabel {
    final at = moment;
    if (at == null) return entry.createdAt;
    return '${_two(at.day)}/${_two(at.month)}/${at.year}';
  }

  /// Rotulo do agrupamento diario: HOJE, ONTEM ou a data em mono.
  String dayHeader(DateTime today) {
    final at = moment;
    if (at == null) return 'SEM DATA';
    final diff = today.difference(DateTime(at.year, at.month, at.day)).inDays;
    if (diff == 0) return 'HOJE';
    if (diff == 1) return 'ONTEM';
    return dateLabel;
  }

  static String _two(int value) => value.toString().padLeft(2, '0');

  /// Os repositorios entregam `createdAt` ja formatado como `dd/MM/yyyy HH:mm`
  /// (remoto e Firestore) ou cru do cache local, que pode ser ISO-8601.
  static DateTime? _parseMoment(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return null;

    final iso = DateTime.tryParse(trimmed);
    if (iso != null) return iso.toLocal();

    final match = RegExp(
      r'^(\d{1,2})/(\d{1,2})/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?',
    ).firstMatch(trimmed);
    if (match == null) return null;

    return DateTime(
      int.parse(match.group(3)!),
      int.parse(match.group(2)!),
      int.parse(match.group(1)!),
      int.parse(match.group(4) ?? '0'),
      int.parse(match.group(5) ?? '0'),
    );
  }

  static const _pendencia = [
    'pend',
    'aguard',
    'venc',
    'expir',
    'atras',
    'prazo',
    'revis',
    'ajuste',
    'divergenc',
  ];
  static const _aprovacao = [
    'aprov',
    'assinat',
    'contrato',
    'proposta',
    'homolog',
    'autoriz',
  ];
  static const _sistema = [
    'atualiz',
    'sincron',
    'export',
    'import',
    'process',
    'gerad',
    'backup',
    'integra',
    'cadastr',
  ];

  static _EventKind _classify(String action) {
    final text = _fold(action);
    bool has(List<String> keys) => keys.any(text.contains);
    if (has(_pendencia)) return _EventKind.pendencia;
    if (has(_aprovacao)) return _EventKind.aprovacao;
    if (has(_sistema)) return _EventKind.sistema;
    return _EventKind.geral;
  }

  static const _accented = 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ';
  static const _plain = 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC';

  static String _fold(String value) {
    final buffer = StringBuffer();
    for (final rune in value.runes) {
      final char = String.fromCharCode(rune);
      final index = _accented.indexOf(char);
      buffer.write(index >= 0 ? _plain[index] : char);
    }
    return buffer.toString().toLowerCase();
  }
}

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

  _InboxFilter _filter = _InboxFilter.tudo;
  _InboxEvent? _selected;

  // Cache dos eventos derivados, chaveado pela identidade da lista que o
  // repositorio devolveu: evita reparsear datas a cada rebuild e mantem a
  // identidade de `_selected` estavel entre trocas de filtro.
  List<AuditEntry>? _source;
  List<_InboxEvent> _events = const [];

  @override
  void initState() {
    super.initState();
    future = widget.repository.getAudit(limit: 30);
  }

  void _reload() {
    setState(() {
      _selected = null;
      future = widget.repository.getAudit(limit: 30);
    });
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
          return _ErrorState(
            message: snapshot.error.toString(),
            onRetry: _reload,
          );
        }

        final source = snapshot.data!;
        if (!identical(source, _source)) {
          _source = source;
          _events = source.map(_InboxEvent.new).toList(growable: false);
        }
        final visible =
            _events.where((event) => _filter.accepts(event.kind)).toList();

        // Selecao segue a lista visivel; sem setState durante o build.
        final selected = visible.contains(_selected)
            ? _selected
            : (visible.isEmpty ? null : visible.first);

        return LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 940;

            final list = _EventList(
              events: visible,
              total: _events.length,
              filter: _filter,
              selected: selected,
              scrollable: wide,
              onFilter: (value) => setState(() => _filter = value),
              onSelect: (event) => setState(() => _selected = event),
              onReload: _reload,
            );

            final detail = _DecisionPanel(event: selected, scrollable: wide);

            if (wide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(width: 396, child: list),
                  Expanded(child: detail),
                ],
              );
            }

            return SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [list, detail],
              ),
            );
          },
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Coluna esquerda — triagem
// ─────────────────────────────────────────────────────────────
class _EventList extends StatelessWidget {
  const _EventList({
    required this.events,
    required this.total,
    required this.filter,
    required this.selected,
    required this.scrollable,
    required this.onFilter,
    required this.onSelect,
    required this.onReload,
  });

  final List<_InboxEvent> events;
  final int total;
  final _InboxFilter filter;
  final _InboxEvent? selected;
  final bool scrollable;
  final ValueChanged<_InboxFilter> onFilter;
  final ValueChanged<_InboxEvent> onSelect;
  final VoidCallback onReload;

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final rows = <Widget>[];
    String? currentDay;

    for (final event in events) {
      final day = event.dayHeader(today);
      if (day != currentDay) {
        currentDay = day;
        rows.add(_DayHeader(label: day, first: rows.isEmpty));
      }
      rows.add(
        _EventTile(
          event: event,
          selected: identical(event, selected),
          onTap: () => onSelect(event),
        ),
      );
    }

    final body = rows.isEmpty
        ? const _EmptyList()
        : ListView.builder(
            padding: EdgeInsets.zero,
            shrinkWrap: !scrollable,
            physics:
                scrollable ? null : const NeverScrollableScrollPhysics(),
            itemCount: rows.length,
            itemBuilder: (context, index) => rows[index],
          );

    return Container(
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        // Empilhado, o divisor entre lista e painel passa a ser horizontal.
        border: Border(
          right: scrollable
              ? const BorderSide(color: SaaSTokens.borderLight)
              : BorderSide.none,
          bottom: scrollable
              ? BorderSide.none
              : const BorderSide(color: SaaSTokens.borderLight),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: scrollable ? MainAxisSize.max : MainAxisSize.min,
        children: [
          _ListHeader(
            shown: events.length,
            total: total,
            filter: filter,
            onFilter: onFilter,
            onReload: onReload,
          ),
          if (scrollable) Expanded(child: body) else body,
        ],
      ),
    );
  }
}

class _ListHeader extends StatelessWidget {
  const _ListHeader({
    required this.shown,
    required this.total,
    required this.filter,
    required this.onFilter,
    required this.onReload,
  });

  final int shown;
  final int total;
  final _InboxFilter filter;
  final ValueChanged<_InboxFilter> onFilter;
  final VoidCallback onReload;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 12, 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: SaaSTokens.borderLight)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Expanded(
                child: Text('Caixa de entrada', style: GsText.panelTitle),
              ),
              // TODO(redesign): contagem de nao lidos ainda nao existe no
              // repositorio — so da para mostrar exibidos sobre o total.
              Text('$shown de $total', style: GsText.dataXs),
              const SizedBox(width: 4),
              IconButton(
                onPressed: onReload,
                tooltip: 'Atualizar',
                icon: const Icon(
                  LucideIcons.rotateCw,
                  size: 16,
                  color: SaaSTokens.textMuted,
                ),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(
                  minWidth: 32,
                  minHeight: 32,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final option in _InboxFilter.values)
                _FilterChip(
                  label: option.label,
                  active: option == filter,
                  onTap: () => onFilter(option),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: active ? SaaSTokens.primary : SaaSTokens.cardWhite,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: active ? SaaSTokens.primary : SaaSTokens.borderLight,
          ),
        ),
        child: Text(
          label,
          style: GsText.chip.copyWith(
            fontWeight: active ? FontWeight.w600 : FontWeight.w400,
            color: active ? SaaSTokens.cardWhite : SaaSTokens.textMuted,
          ),
        ),
      ),
    );
  }
}

class _DayHeader extends StatelessWidget {
  const _DayHeader({required this.label, required this.first});

  final String label;
  final bool first;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 7),
      decoration: BoxDecoration(
        color: SaaSTokens.surfaceSubtle,
        border: Border(
          top: first
              ? BorderSide.none
              : const BorderSide(color: SaaSTokens.scaffold),
          bottom: const BorderSide(color: SaaSTokens.scaffold),
        ),
      ),
      child: Text(label, style: GsText.label),
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({
    required this.event,
    required this.selected,
    required this.onTap,
  });

  final _InboxEvent event;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final attention = event.kind.demandsAttention;

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(15, 14, 18, 14),
        decoration: BoxDecoration(
          color: selected ? SaaSTokens.primaryLight : SaaSTokens.cardWhite,
          border: Border(
            left: BorderSide(
              color: selected ? SaaSTokens.primary : Colors.transparent,
              width: 3,
            ),
            bottom: const BorderSide(color: SaaSTokens.scaffold),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Icon(event.kind.icon, size: 18, color: event.kind.accent),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // TODO(redesign): o evento so tem `action`; nao ha
                      // titulo curto e descricao separados no repositorio.
                      Expanded(
                        child: Text(
                          event.action,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: attention
                              ? GsText.bodyStrong
                              : GsText.bodyMedium,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(event.timeLabel, style: GsText.dataXs),
                    ],
                  ),
                  if (event.kind != _EventKind.geral) ...[
                    const SizedBox(height: 8),
                    _KindChip(kind: event.kind),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _KindChip extends StatelessWidget {
  const _KindChip({required this.kind});

  final _EventKind kind;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: kind.chipBackground,
        borderRadius: BorderRadius.circular(SaaSTokens.rChip),
      ),
      child: Text(
        kind.label,
        style: GsText.chip.copyWith(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: kind.chipForeground,
        ),
      ),
    );
  }
}

class _EmptyList extends StatelessWidget {
  const _EmptyList();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 48),
      child: Column(
        children: [
          const Icon(LucideIcons.inbox, size: 22, color: SaaSTokens.textDim),
          const SizedBox(height: 10),
          Text(
            'Nenhum evento neste filtro.',
            style: GsText.body,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Coluna direita — painel de decisao
// ─────────────────────────────────────────────────────────────
class _DecisionPanel extends StatelessWidget {
  const _DecisionPanel({required this.event, required this.scrollable});

  final _InboxEvent? event;
  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    final selected = event;
    if (selected == null) {
      return Container(
        color: SaaSTokens.scaffold,
        padding: const EdgeInsets.all(24),
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              LucideIcons.inbox,
              size: 26,
              color: SaaSTokens.textDim,
            ),
            const SizedBox(height: 12),
            Text(
              'Selecione um evento para ver o registro completo.',
              style: GsText.body,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    final body = Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          _MetadataCard(event: selected),
          const SizedBox(height: 14),
          _RecordCard(event: selected),
          // TODO(redesign): o diff "O que mudou nesta versao" (v2 -> v3) exige
          // versionamento de levantamento no repositorio, que nao existe.
          // TODO(redesign): a "trilha do evento" exige eventos correlacionados
          // por entidade; `AuditEntry` nao carrega chave de correlacao.
        ],
      ),
    );

    return Container(
      color: SaaSTokens.scaffold,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: scrollable ? MainAxisSize.max : MainAxisSize.min,
        children: [
          _DetailHeader(event: selected),
          if (scrollable)
            Expanded(child: SingleChildScrollView(child: body))
          else
            body,
        ],
      ),
    );
  }
}

class _DetailHeader extends StatelessWidget {
  const _DetailHeader({required this.event});

  final _InboxEvent event;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
      decoration: const BoxDecoration(
        color: SaaSTokens.cardWhite,
        border: Border(bottom: BorderSide(color: SaaSTokens.borderLight)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _KindChip(kind: event.kind),
              const SizedBox(width: 8),
              // TODO(redesign): identificador do evento (#EVT-…) nao existe
              // em `AuditEntry`; no lugar dele vai o carimbo de tempo.
              Flexible(
                child: Text(
                  '${event.dateLabel} ${event.timeLabel}',
                  style: GsText.dataXs,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(event.action, style: GsText.panelTitle),
          // TODO(redesign): as acoes "Aprovar e enviar" e "Solicitar ajuste"
          // exigem endpoint de decisao no repositorio; sem ele nao ha botao.
        ],
      ),
    );
  }
}

class _MetadataCard extends StatelessWidget {
  const _MetadataCard({required this.event});

  final _InboxEvent event;

  @override
  Widget build(BuildContext context) {
    return SyncSurfaceCard(
      radius: SaaSTokens.rCard,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      child: Wrap(
        spacing: 28,
        runSpacing: 16,
        children: [
          _MetadataField(label: 'DATA', value: event.dateLabel),
          _MetadataField(label: 'HORA', value: event.timeLabel),
          _MetadataField(label: 'CATEGORIA', value: event.kind.label),
          // TODO(redesign): RESPONSAVEL, LOTE e PRAZO exigem suporte no
          // repositorio — `AuditEntry` so tem `action` e `createdAt`.
        ],
      ),
    );
  }
}

class _MetadataField extends StatelessWidget {
  const _MetadataField({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GsText.label),
          const SizedBox(height: 6),
          Text(value, style: GsText.dataStrong),
        ],
      ),
    );
  }
}

class _RecordCard extends StatelessWidget {
  const _RecordCard({required this.event});

  final _InboxEvent event;

  @override
  Widget build(BuildContext context) {
    return SyncSurfaceCard(
      radius: SaaSTokens.rCard,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              const Expanded(
                child: Text('Registro de auditoria', style: GsText.cardTitle),
              ),
              Text(event.timeLabel, style: GsText.dataXs),
            ],
          ),
          const SizedBox(height: 12),
          Text(event.action, style: GsText.body),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Falha de carga
// ─────────────────────────────────────────────────────────────
class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: SyncSurfaceCard(
        radius: SaaSTokens.rCard,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Falha ao carregar inbox', style: GsText.cardTitle),
            const SizedBox(height: 8),
            Text(message, style: GsText.body),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: onRetry,
              child: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    );
  }
}
