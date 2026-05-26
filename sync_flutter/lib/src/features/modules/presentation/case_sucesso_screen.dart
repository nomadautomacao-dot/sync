import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';

import '../../../core/models/case_sucesso_models.dart';
import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../shared/presentation/shared_widgets.dart';
import '../application/case_sucesso_pdf_builder.dart';

class CaseSucessoScreen extends StatefulWidget {
  const CaseSucessoScreen({
    super.key,
    required this.repository,
    required this.module,
    required this.onBack,
  });

  final SyncRepository repository;
  final ModuleDefinition module;
  final VoidCallback onBack;

  @override
  State<CaseSucessoScreen> createState() => _CaseSucessoScreenState();
}

class _CaseSucessoScreenState extends State<CaseSucessoScreen> {
  final _tituloController = TextEditingController(text: 'Case de Sucesso Rocha Prime');
  int _anoBase = 2025;
  int _anoAtual = 2026;
  List<_CaseMunicipio> _municipios = [];
  bool _isExporting = false;

  @override
  void dispose() {
    _tituloController.dispose();
    super.dispose();
  }

  void _addMunicipio() {
    setState(() {
      _municipios = [
        ..._municipios,
        _CaseMunicipio(
          nomeController: TextEditingController(),
          ufController: TextEditingController(),
          codigoController: TextEditingController(),
          anos: {
            _anoBase: _CaseAnoData(),
            _anoAtual: _CaseAnoData(),
          },
        ),
      ];
    });
  }

  void _removeMunicipio(int index) {
    final removed = _municipios[index];
    removed.dispose();
    setState(() {
      _municipios = [..._municipios]..removeAt(index);
    });
  }

  void _addDemoData() {
    setState(() {
      _anoBase = 2025;
      _anoAtual = 2026;
      _tituloController.text = 'Case de Sucesso Rocha Prime';
      _municipios = [
        _demoMunicipio('Serra do Ramalho', 'BA', '2930154',
          vaaf25: 0, vaat25: 10155347.42, vaar25: 1331527.36, comp25: 17278067.50, total25: 52000000,
          vaaf26: 3500000, vaat26: 17584528.97, vaar26: 2360281.18, comp26: 27704466.50, total26: 87000000,
          servicos: [
            'Assessoria para regularização dos sistemas MEC/FNDE (SIMEC, SIGPC, SIGARP, HABILITA-FNDE).',
            'Reestruturação e correção do Censo Escolar para apuração e aumento da arrecadação do FUNDEB.',
            'Levantamento de créditos, destravamento de frentes FNDE/MEC e atendimento a diligências.',
          ],
        ),
        _demoMunicipio('Coribe', 'BA', '2909109',
          vaaf25: 0, vaat25: 3200000, vaar25: 800000, comp25: 4000000, total25: 22000000,
          vaaf26: 1200000, vaat26: 5100000, vaar26: 1100000, comp26: 7400000, total26: 28000000,
          servicos: ['Governança técnica do Censo e habilitação VAAT.'],
        ),
        _demoMunicipio('São Félix do Coribe', 'BA', '2929057',
          vaaf25: 5791192.72, vaat25: 10155347.42, vaar25: 1331527.36, comp25: 17278067.50, total25: 45000000,
          vaaf26: 7759656.35, vaat26: 17584528.97, vaar26: 2360281.18, comp26: 27704466.50, total26: 62000000,
          servicos: ['Assessoria completa Censo/FUNDEB com foco em complementação.'],
        ),
        _demoMunicipio('São Desidério', 'BA', '2928901',
          vaaf25: 0, vaat25: 4500000, vaar25: 900000, comp25: 5400000, total25: 35000000,
          vaaf26: 2100000, vaat26: 7200000, vaar26: 1500000, comp26: 10800000, total26: 48000000,
          servicos: ['Reestruturação documental e reorganização de base.'],
        ),
      ];
    });
  }

  _CaseMunicipio _demoMunicipio(String nome, String uf, String ibge, {
    required double vaaf25, required double vaat25, required double vaar25, required double comp25, required double total25,
    required double vaaf26, required double vaat26, required double vaar26, required double comp26, required double total26,
    List<String> servicos = const [],
  }) {
    return _CaseMunicipio(
      nomeController: TextEditingController(text: nome),
      ufController: TextEditingController(text: uf),
      codigoController: TextEditingController(text: ibge),
      servicos: servicos,
      anos: {
        _anoBase: _CaseAnoData(
          vaafC: TextEditingController(text: vaaf25.toStringAsFixed(2)),
          vaatC: TextEditingController(text: vaat25.toStringAsFixed(2)),
          vaarC: TextEditingController(text: vaar25.toStringAsFixed(2)),
          compC: TextEditingController(text: comp25.toStringAsFixed(2)),
          totalC: TextEditingController(text: total25.toStringAsFixed(2)),
        ),
        _anoAtual: _CaseAnoData(
          vaafC: TextEditingController(text: vaaf26.toStringAsFixed(2)),
          vaatC: TextEditingController(text: vaat26.toStringAsFixed(2)),
          vaarC: TextEditingController(text: vaar26.toStringAsFixed(2)),
          compC: TextEditingController(text: comp26.toStringAsFixed(2)),
          totalC: TextEditingController(text: total26.toStringAsFixed(2)),
        ),
      },
    );
  }

  CaseSucessoBundle _buildBundle() {
    return CaseSucessoBundle(
      municipios: _municipios.map((m) {
        final anos = m.anos.entries.map((e) {
          final d = e.value;
          return CaseSucessoAno(
            ano: e.key,
            vaaf: double.tryParse(d.vaafC.text) ?? 0,
            vaat: double.tryParse(d.vaatC.text) ?? 0,
            vaar: double.tryParse(d.vaarC.text) ?? 0,
            totalComplementacao: double.tryParse(d.compC.text) ?? 0,
            totalReceitas: double.tryParse(d.totalC.text) ?? 0,
          );
        }).toList();
        return CaseSucessoMunicipio(
          nome: m.nomeController.text.trim(),
          uf: m.ufController.text.trim(),
          codigoIbge: m.codigoController.text.trim(),
          anos: anos,
          servicos: m.servicos,
        );
      }).toList(),
      anoBase: _anoBase,
      anoAtual: _anoAtual,
      titulo: _tituloController.text.trim().isEmpty ? null : _tituloController.text.trim(),
    );
  }

  Future<void> _exportPdf() async {
    if (_municipios.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Adicione ao menos um município.')));
      return;
    }
    setState(() => _isExporting = true);
    try {
      final bundle = _buildBundle();
      final bytes = await CaseSucessoPdfBuilder.build(bundle);
      final dir = await getApplicationDocumentsDirectory();
      final file = File('${dir.path}/case_sucesso_fundeb_${_anoBase}_${_anoAtual}.pdf');
      await file.writeAsBytes(bytes);
      if (!mounted) return;
      await Printing.sharePdf(bytes: bytes, filename: file.uri.pathSegments.last);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erro ao gerar PDF: $e')));
    } finally {
      if (mounted) setState(() => _isExporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SyncSectionHeader(
            title: 'Case de Sucesso',
            description: 'Monte o relatório institucional comparando a evolução do FUNDEB nos municípios atendidos.',
            trailing: Wrap(spacing: 10, runSpacing: 10, children: [
              OutlinedButton(onPressed: widget.onBack, child: const Text('Voltar ao catálogo')),
              OutlinedButton.icon(
                onPressed: _addDemoData,
                icon: const Icon(Icons.auto_awesome_outlined, size: 18),
                label: const Text('Dados demo'),
              ),
              FilledButton.icon(
                onPressed: _isExporting ? null : _exportPdf,
                icon: _isExporting
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.picture_as_pdf_outlined),
                label: Text(_isExporting ? 'Gerando...' : 'Exportar PDF'),
              ),
            ]),
          ),
          const SizedBox(height: 20),

          // Config card
          SyncSurfaceCard(
            padding: const EdgeInsets.all(18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Configuração do case', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 14),
              Wrap(spacing: 12, runSpacing: 12, children: [
                SizedBox(width: 300, child: TextField(controller: _tituloController, decoration: const InputDecoration(labelText: 'Título do case'))),
                SizedBox(width: 120, child: TextField(
                  decoration: const InputDecoration(labelText: 'Ano base'),
                  keyboardType: TextInputType.number,
                  controller: TextEditingController(text: '$_anoBase'),
                  onChanged: (v) => _anoBase = int.tryParse(v) ?? _anoBase,
                )),
                SizedBox(width: 120, child: TextField(
                  decoration: const InputDecoration(labelText: 'Ano atual'),
                  keyboardType: TextInputType.number,
                  controller: TextEditingController(text: '$_anoAtual'),
                  onChanged: (v) => _anoAtual = int.tryParse(v) ?? _anoAtual,
                )),
              ]),
            ]),
          ),
          const SizedBox(height: 18),

          // Municipalities
          Row(children: [
            Text('Municípios (${_municipios.length})', style: Theme.of(context).textTheme.titleLarge),
            const Spacer(),
            OutlinedButton.icon(
              onPressed: _addMunicipio,
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Adicionar município'),
            ),
          ]),
          const SizedBox(height: 12),

          if (_municipios.isEmpty)
            SyncSurfaceCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Nenhum município adicionado', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Text('Clique em "Adicionar município" ou use "Dados demo" para começar.', style: Theme.of(context).textTheme.bodyMedium),
              ]),
            )
          else
            ...List.generate(_municipios.length, (i) => Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: _buildMunicipioCard(i),
            )),
        ]),
      ),
    );
  }

  Widget _buildMunicipioCard(int index) {
    final m = _municipios[index];
    return SyncSurfaceCard(
      padding: const EdgeInsets.all(18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(
            m.nomeController.text.isEmpty ? 'Município ${index + 1}' : m.nomeController.text,
            style: Theme.of(context).textTheme.titleMedium,
          )),
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded, size: 20),
            onPressed: () => _removeMunicipio(index),
            tooltip: 'Remover',
          ),
        ]),
        const SizedBox(height: 12),
        Wrap(spacing: 12, runSpacing: 12, children: [
          SizedBox(width: 240, child: TextField(controller: m.nomeController, decoration: const InputDecoration(labelText: 'Nome'), onChanged: (_) => setState(() {}))),
          SizedBox(width: 80, child: TextField(controller: m.ufController, decoration: const InputDecoration(labelText: 'UF'), maxLength: 2)),
          SizedBox(width: 140, child: TextField(controller: m.codigoController, decoration: const InputDecoration(labelText: 'Código IBGE'))),
        ]),
        const SizedBox(height: 14),
        for (final year in [_anoBase, _anoAtual]) ...[
          Text('Dados $year', style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          _buildAnoFields(m, year),
          const SizedBox(height: 12),
        ],
      ]),
    );
  }

  Widget _buildAnoFields(_CaseMunicipio m, int year) {
    final d = m.anos.putIfAbsent(year, () => _CaseAnoData());
    return Wrap(spacing: 10, runSpacing: 10, children: [
      SizedBox(width: 160, child: TextField(controller: d.vaafC, decoration: const InputDecoration(labelText: 'VAAF'), keyboardType: TextInputType.number)),
      SizedBox(width: 160, child: TextField(controller: d.vaatC, decoration: const InputDecoration(labelText: 'VAAT'), keyboardType: TextInputType.number)),
      SizedBox(width: 160, child: TextField(controller: d.vaarC, decoration: const InputDecoration(labelText: 'VAAR'), keyboardType: TextInputType.number)),
      SizedBox(width: 180, child: TextField(controller: d.compC, decoration: const InputDecoration(labelText: 'Total Complementação'), keyboardType: TextInputType.number)),
      SizedBox(width: 180, child: TextField(controller: d.totalC, decoration: const InputDecoration(labelText: 'Total Receitas'), keyboardType: TextInputType.number)),
    ]);
  }
}

class _CaseMunicipio {
  _CaseMunicipio({
    required this.nomeController,
    required this.ufController,
    required this.codigoController,
    required this.anos,
    this.servicos = const [],
  });

  final TextEditingController nomeController;
  final TextEditingController ufController;
  final TextEditingController codigoController;
  final Map<int, _CaseAnoData> anos;
  final List<String> servicos;

  void dispose() {
    nomeController.dispose();
    ufController.dispose();
    codigoController.dispose();
    for (final a in anos.values) {
      a.dispose();
    }
  }
}

class _CaseAnoData {
  _CaseAnoData({
    TextEditingController? vaafC,
    TextEditingController? vaatC,
    TextEditingController? vaarC,
    TextEditingController? compC,
    TextEditingController? totalC,
  }) : vaafC = vaafC ?? TextEditingController(),
       vaatC = vaatC ?? TextEditingController(),
       vaarC = vaarC ?? TextEditingController(),
       compC = compC ?? TextEditingController(),
       totalC = totalC ?? TextEditingController();

  final TextEditingController vaafC;
  final TextEditingController vaatC;
  final TextEditingController vaarC;
  final TextEditingController compC;
  final TextEditingController totalC;

  void dispose() {
    vaafC.dispose();
    vaatC.dispose();
    vaarC.dispose();
    compC.dispose();
    totalC.dispose();
  }
}
