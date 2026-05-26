import 'dart:async';
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'package:flutter/material.dart';
import 'package:printing/printing.dart';

import '../../../core/models/levantamento_fundeb_models.dart';
import '../../../core/models/sync_models.dart';
import '../../../core/repositories/mock_sync_repository.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/theme/app_theme.dart';
import '../application/fundeb_levantamento_pdf_builder.dart';
import '../../shared/presentation/shared_widgets.dart';

class LevantamentoFundebScreen extends StatefulWidget {
  const LevantamentoFundebScreen({
    super.key,
    required this.repository,
    required this.module,
    required this.onBack,
  });

  final SyncRepository repository;
  final ModuleDefinition module;
  final VoidCallback onBack;

  @override
  State<LevantamentoFundebScreen> createState() =>
      _LevantamentoFundebScreenState();
}

class _LevantamentoFundebScreenState extends State<LevantamentoFundebScreen> {
  final codigoController = TextEditingController();
  final municipioController = TextEditingController();
  final ufController = TextEditingController();
  final batchMunicipioController = TextEditingController();
  final batchUfController = TextEditingController();
  late final TextEditingController exercicioController;

  Timer? searchDebounce;
  Timer? batchSearchDebounce;
  List<MunicipioSearchItem> suggestions = const <MunicipioSearchItem>[];
  List<MunicipioSearchItem> batchSuggestions = const <MunicipioSearchItem>[];
  List<_BatchMunicipioSelection> batchSelections =
      const <_BatchMunicipioSelection>[];
  LevantamentoFundebBundle? bundle;
  RelatorioDirigidoMunicipio? relatorioDirigido;
  bool isSearching = false;
  bool isBatchSearching = false;
  bool isLoading = false;
  bool isExportingPdf = false;
  bool isExportingLitePdf = false;
  bool isExportingBatchPdf = false;
  String? batchCurrentLabel;
  String? errorMessage;
  String? searchFeedbackMessage;
  List<_LoadingStep> loadingSteps = const <_LoadingStep>[];
  Stopwatch? _loadingStopwatch;
  String? batchSearchFeedbackMessage;
  int searchRequestToken = 0;
  int batchSearchRequestToken = 0;
  int batchProcessedCount = 0;
  int batchTotalCount = 0;

  @override
  void initState() {
    super.initState();
    exercicioController = TextEditingController(
      text: DateTime.now().year.toString(),
    );
  }

  @override
  void dispose() {
    searchDebounce?.cancel();
    batchSearchDebounce?.cancel();
    codigoController.dispose();
    municipioController.dispose();
    ufController.dispose();
    batchMunicipioController.dispose();
    batchUfController.dispose();
    exercicioController.dispose();
    super.dispose();
  }

  void _scheduleSearch() {
    searchDebounce?.cancel();
    final query = municipioController.text.trim();
    if (query.length < 2) {
      setState(() {
        suggestions = const <MunicipioSearchItem>[];
        searchFeedbackMessage = null;
        isSearching = false;
      });
      return;
    }

    searchDebounce = Timer(
      const Duration(milliseconds: 280),
      _searchMunicipios,
    );
  }

  Future<void> _searchMunicipios() async {
    final query = municipioController.text.trim();
    if (query.length < 2) return;
    final requestToken = ++searchRequestToken;

    setState(() {
      isSearching = true;
      searchFeedbackMessage = null;
    });
    try {
      final result = await widget.repository.searchMunicipios(
        query,
        uf: ufController.text.trim(),
      );
      if (!mounted || requestToken != searchRequestToken) return;
      setState(() {
        suggestions = result;
        searchFeedbackMessage = result.isEmpty
            ? 'Nenhum municipio encontrado para essa busca.'
            : null;
      });
    } catch (error) {
      if (!mounted || requestToken != searchRequestToken) return;
      setState(() {
        suggestions = const <MunicipioSearchItem>[];
        searchFeedbackMessage = _cleanErrorMessage(error);
      });
    } finally {
      if (mounted && requestToken == searchRequestToken) {
        setState(() => isSearching = false);
      }
    }
  }

  void _scheduleBatchSearch() {
    batchSearchDebounce?.cancel();
    final query = batchMunicipioController.text.trim();
    if (query.length < 2) {
      setState(() {
        batchSuggestions = const <MunicipioSearchItem>[];
        batchSearchFeedbackMessage = null;
        isBatchSearching = false;
      });
      return;
    }

    batchSearchDebounce = Timer(
      const Duration(milliseconds: 280),
      _searchBatchMunicipios,
    );
  }

  Future<void> _searchBatchMunicipios() async {
    final query = batchMunicipioController.text.trim();
    if (query.length < 2) return;
    final requestToken = ++batchSearchRequestToken;

    setState(() {
      isBatchSearching = true;
      batchSearchFeedbackMessage = null;
    });

    try {
      final result = await widget.repository.searchMunicipios(
        query,
        uf: batchUfController.text.trim(),
      );
      if (!mounted || requestToken != batchSearchRequestToken) return;
      setState(() {
        batchSuggestions = result;
        batchSearchFeedbackMessage = result.isEmpty
            ? 'Nenhum municipio encontrado para essa busca.'
            : null;
      });
    } catch (error) {
      if (!mounted || requestToken != batchSearchRequestToken) return;
      setState(() {
        batchSuggestions = const <MunicipioSearchItem>[];
        batchSearchFeedbackMessage = _cleanErrorMessage(error);
      });
    } finally {
      if (mounted && requestToken == batchSearchRequestToken) {
        setState(() => isBatchSearching = false);
      }
    }
  }

  MunicipioLookupRequest? _buildRequest() {
    final exercicio =
        int.tryParse(exercicioController.text.trim()) ?? DateTime.now().year;
    final request = MunicipioLookupRequest(
      codigoIbge: codigoController.text,
      nome: municipioController.text,
      uf: ufController.text,
      exercicio: exercicio,
    );
    if (!request.hasCodigoIbge && !request.hasNameLookup) {
      return null;
    }
    return request;
  }

  void _setLoadingStep(int index, _StepStatus status, {String? detail}) {
    if (!mounted || index >= loadingSteps.length) return;
    setState(() {
      loadingSteps = [
        for (int i = 0; i < loadingSteps.length; i++)
          i == index
              ? loadingSteps[i].copyWith(status: status, detail: detail)
              : loadingSteps[i],
      ];
    });
  }

  Future<void> _loadMunicipio() async {
    final request = _buildRequest();
    if (request == null) {
      _showSnackBar(
        'Informe um codigo IBGE valido ou selecione um municipio pela busca.',
      );
      return;
    }

    _loadingStopwatch = Stopwatch()..start();
    setState(() {
      isLoading = true;
      errorMessage = null;
      loadingSteps = [
        const _LoadingStep(
          label: 'Validando entrada',
          icon: Icons.fact_check_outlined,
          status: _StepStatus.running,
        ),
        const _LoadingStep(
          label: 'Consultando base do municipio',
          icon: Icons.cloud_download_outlined,
          status: _StepStatus.pending,
        ),
        const _LoadingStep(
          label: 'Enriquecendo historico (SICONFI / Censo)',
          icon: Icons.stacked_line_chart_outlined,
          status: _StepStatus.pending,
        ),
        const _LoadingStep(
          label: 'Montando previa editorial',
          icon: Icons.auto_awesome_outlined,
          status: _StepStatus.pending,
        ),
      ];
    });

    try {
      // Step 1 — Validate
      await Future<void>.delayed(const Duration(milliseconds: 200));
      _setLoadingStep(0, _StepStatus.done);

      // Step 2 — API call
      _setLoadingStep(1, _StepStatus.running, detail: 'Conectando ao servidor...');
      final result = await widget.repository.getLevantamentoFundeb(request);
      if (!mounted) return;
      _setLoadingStep(1, _StepStatus.done, detail: 'Dados recebidos');

      // Step 3 — Enrichment
      _setLoadingStep(2, _StepStatus.running, detail: 'Processando dados...');
      await Future<void>.delayed(const Duration(milliseconds: 150));
      _setLoadingStep(2, _StepStatus.done);

      // Step 4 — Mount preview
      _setLoadingStep(3, _StepStatus.running, detail: 'Renderizando...');
      await Future<void>.delayed(const Duration(milliseconds: 200));

      final identificacao = result.relatorio.identificacao;
      codigoController.text = identificacao.codigoIBGE;
      municipioController.text = identificacao.municipioNome;
      ufController.text = identificacao.uf;
      exercicioController.text = identificacao.exercicio.toString();

      // Single consolidated setState to avoid rendering pipeline conflicts
      _loadingStopwatch?.stop();
      if (!mounted) return;
      setState(() {
        bundle = result;
        relatorioDirigido = result.relatorioDirigidoBase;
        suggestions = const <MunicipioSearchItem>[];
        searchFeedbackMessage = null;
        isLoading = false;
        loadingSteps = const <_LoadingStep>[];
      });
      return;
    } catch (error) {
      if (!mounted) return;
      final activeIndex = loadingSteps.lastIndexWhere(
        (s) => s.status == _StepStatus.running,
      );
      if (activeIndex >= 0) {
        _setLoadingStep(activeIndex, _StepStatus.error, detail: _cleanErrorMessage(error));
      }
      setState(() => errorMessage = error.toString());
    } finally {
      _loadingStopwatch?.stop();
      if (mounted && isLoading) {
        setState(() {
          isLoading = false;
          loadingSteps = const <_LoadingStep>[];
        });
      }
    }
  }


  void _selectSuggestion(MunicipioSearchItem item) {
    setState(() {
      municipioController.text = item.nome;
      ufController.text = item.uf;
      codigoController.text = item.codigoIbge;
      suggestions = const <MunicipioSearchItem>[];
      searchFeedbackMessage = null;
    });
  }

  void _handleMunicipioChanged(String value) {
    if (codigoController.text.trim().isNotEmpty) {
      codigoController.clear();
    }
    _scheduleSearch();
  }

  void _handleUfChanged(String value) {
    if (codigoController.text.trim().isNotEmpty) {
      codigoController.clear();
    }
    _scheduleSearch();
  }

  void _handleBatchMunicipioChanged(String value) {
    _scheduleBatchSearch();
  }

  void _handleBatchUfChanged(String value) {
    _scheduleBatchSearch();
  }

  void _addBatchMunicipio(MunicipioSearchItem item) {
    final selection = _BatchMunicipioSelection(
      codigoIbge: item.codigoIbge,
      nome: item.nome,
      uf: item.uf,
      regiao: item.regiao,
    );

    if (batchSelections.any(
      (entry) => entry.codigoIbge == selection.codigoIbge,
    )) {
      _showSnackBar('${item.nome}/${item.uf} ja esta na fila do lote.');
      return;
    }

    setState(() {
      batchSelections = [...batchSelections, selection];
      batchMunicipioController.clear();
      batchSuggestions = const <MunicipioSearchItem>[];
      batchSearchFeedbackMessage = null;
    });
  }

  void _removeBatchMunicipio(String codigoIbge) {
    setState(() {
      batchSelections = batchSelections
          .where((entry) => entry.codigoIbge != codigoIbge)
          .toList();
    });
  }

  void _addCurrentMunicipioToBatch() {
    final relatorio = bundle?.relatorio;
    if (relatorio == null) {
      _showSnackBar(
        'Carregue uma previa antes de adicionar o municipio atual.',
      );
      return;
    }

    final ident = relatorio.identificacao;
    _addBatchMunicipio(
      MunicipioSearchItem(
        codigoIbge: ident.codigoIBGE,
        nome: ident.municipioNome,
        uf: ident.uf,
        regiao: ident.regiao,
      ),
    );
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final relatorio = bundle?.relatorio;
    final activeDirected = relatorioDirigido ?? bundle?.relatorioDirigidoBase;

    return ExcludeSemantics(
      child: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SyncSectionHeader(
            title: 'Levantamento FUNDEB',
            description:
                'Busque o municipio, valide a leitura e acompanhe a previa do PDF final em tempo real.',
            trailing: Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                OutlinedButton(
                  onPressed: widget.onBack,
                  child: const Text('Voltar ao catalogo'),
                ),
                FilledButton.icon(
                  onPressed: isLoading ? null : _loadMunicipio,
                  icon: isLoading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.search_rounded),
                  label: Text(isLoading ? 'Carregando...' : 'Atualizar previa'),
                ),
                OutlinedButton.icon(
                  onPressed: relatorio == null || isExportingPdf
                      ? null
                      : _exportPdf,
                  icon: isExportingPdf
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.picture_as_pdf_outlined),
                  label: Text(
                    isExportingPdf ? 'Gerando PDF...' : 'Exportar PDF',
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: relatorio == null || isExportingLitePdf
                      ? null
                      : _exportLitePdf,
                  icon: isExportingLitePdf
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.summarize_outlined),
                  label: Text(
                    isExportingLitePdf ? 'Gerando...' : 'Resumo (2 pgs)',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          if (isLoading && loadingSteps.isNotEmpty) ...[
            _buildLoadingPanel(),
            const SizedBox(height: 18),
          ],
          _buildSearchCard(),
          const SizedBox(height: 18),
          if (errorMessage != null) ...[
            SyncSurfaceCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Falha ao carregar o levantamento',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(errorMessage!),
                ],
              ),
            ),
            const SizedBox(height: 18),
          ],
          if (relatorio == null && !isLoading)
            SyncSurfaceCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Pronto para montar a previa',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Informe um codigo IBGE ou pesquise um municipio para abrir a leitura que depois sera exportada em PDF.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            )
          else if (relatorio != null) ...[
            _buildPreviewLead(relatorio, activeDirected),
            const SizedBox(height: 18),
            _buildOverview(relatorio),
            const SizedBox(height: 18),
            _buildFontesAndContext(relatorio),
            const SizedBox(height: 18),
            if (activeDirected != null) _buildDirectedReport(activeDirected),
          ],
        ],
      ),
    ),
    );
  }

  Widget _buildSearchCard() {
    return SyncSurfaceCard(
      padding: const EdgeInsets.all(18),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          final compact = width < 760;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '1. Defina o municipio da analise',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 6),
              Text(
                'Voce pode informar o codigo IBGE direto ou buscar por nome para preparar a previa do relatorio.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  SizedBox(
                    width: compact ? width : 180,
                    child: TextField(
                      controller: codigoController,
                      decoration: const InputDecoration(
                        labelText: 'Codigo IBGE',
                        hintText: '2928903',
                      ),
                    ),
                  ),
                  SizedBox(
                    width: compact ? width : 320,
                    child: TextField(
                      controller: municipioController,
                      onChanged: _handleMunicipioChanged,
                      decoration: InputDecoration(
                        labelText: 'Municipio',
                        hintText: 'Digite ao menos 2 letras',
                        suffixIcon: isSearching
                            ? const Padding(
                                padding: EdgeInsets.all(12),
                                child: SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                ),
                              )
                            : null,
                      ),
                    ),
                  ),
                  SizedBox(
                    width: compact ? width : 100,
                    child: TextField(
                      controller: ufController,
                      onChanged: _handleUfChanged,
                      maxLength: 2,
                      decoration: const InputDecoration(
                        labelText: 'UF',
                        counterText: '',
                      ),
                    ),
                  ),
                  SizedBox(
                    width: compact ? width : 140,
                    child: TextField(
                      controller: exercicioController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Exercicio de referencia',
                      ),
                    ),
                  ),
                  SizedBox(
                    width: compact ? width : null,
                    child: OutlinedButton.icon(
                      onPressed: isLoading ? null : _loadMunicipio,
                      icon: const Icon(Icons.play_arrow_rounded),
                      label: const Text('Montar previa'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              const Divider(height: 1),
              const SizedBox(height: 18),
              Text(
                'Emissao em lote',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 6),
              Text(
                'Busque municipios por nome, adicione na fila e gere um unico PDF consolidado com varias cidades.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  SizedBox(
                    width: compact ? width : 320,
                    child: TextField(
                      controller: batchMunicipioController,
                      onChanged: _handleBatchMunicipioChanged,
                      decoration: InputDecoration(
                        labelText: 'Municipio para adicionar',
                        hintText: 'Digite ao menos 2 letras',
                        suffixIcon: isBatchSearching
                            ? const Padding(
                                padding: EdgeInsets.all(12),
                                child: SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                ),
                              )
                            : null,
                      ),
                    ),
                  ),
                  SizedBox(
                    width: compact ? width : 100,
                    child: TextField(
                      controller: batchUfController,
                      onChanged: _handleBatchUfChanged,
                      maxLength: 2,
                      decoration: const InputDecoration(
                        labelText: 'UF',
                        counterText: '',
                      ),
                    ),
                  ),
                  SizedBox(
                    width: compact ? width : null,
                    child: OutlinedButton.icon(
                      onPressed: bundle == null
                          ? null
                          : _addCurrentMunicipioToBatch,
                      icon: const Icon(Icons.add_rounded),
                      label: const Text('Adicionar municipio atual'),
                    ),
                  ),
                ],
              ),
              if (isBatchSearching ||
                  batchSuggestions.isNotEmpty ||
                  batchSearchFeedbackMessage != null) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: SaaSTokens.cardWhite,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: SaaSTokens.borderLight),
                  ),
                  child: isBatchSearching
                      ? const Padding(
                          padding: EdgeInsets.all(16),
                          child: Row(
                            children: [
                              SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                              SizedBox(width: 12),
                              Expanded(child: Text('Buscando municipios...')),
                            ],
                          ),
                        )
                      : batchSuggestions.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text(
                            batchSearchFeedbackMessage ??
                                'Nenhum municipio encontrado.',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        )
                      : ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 260),
                          child: ListView.separated(
                            shrinkWrap: true,
                            itemCount: batchSuggestions.length,
                            separatorBuilder: (context, index) => Divider(
                              height: 1,
                              color: SaaSTokens.borderLight,
                            ),
                            itemBuilder: (context, index) {
                              final item = batchSuggestions[index];
                              final alreadySelected = batchSelections.any(
                                (entry) => entry.codigoIbge == item.codigoIbge,
                              );
                              return ListTile(
                                dense: true,
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 6,
                                ),
                                title: Text('${item.nome} / ${item.uf}'),
                                subtitle: Text(
                                  'IBGE ${item.codigoIbge} - ${item.regiao}',
                                ),
                                trailing: Icon(
                                  alreadySelected
                                      ? Icons.check_circle_rounded
                                      : Icons.add_circle_outline_rounded,
                                  size: 18,
                                  color: alreadySelected
                                      ? SaaSTokens.success
                                      : SaaSTokens.textMuted,
                                ),
                                onTap: () => _addBatchMunicipio(item),
                              );
                            },
                          ),
                        ),
                ),
              ],
              const SizedBox(height: 14),
              if (batchSelections.isEmpty)
                isExportingBatchPdf
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: LinearProgressIndicator(
                                    value: batchTotalCount > 0
                                        ? batchProcessedCount / batchTotalCount
                                        : null,
                                    minHeight: 6,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Text(
                                '$batchProcessedCount / $batchTotalCount',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                          if (batchCurrentLabel != null) ...[
                            const SizedBox(height: 6),
                            Text(
                              'Processando: $batchCurrentLabel',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ],
                      )
                    : Text(
                        'Nenhum municipio adicionado ao lote ainda.',
                        style: Theme.of(context).textTheme.bodySmall,
                      )
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: batchSelections
                      .map(
                        (item) => InputChip(
                          label: Text('${item.nome} / ${item.uf}'),
                          onDeleted: () =>
                              _removeBatchMunicipio(item.codigoIbge),
                        ),
                      )
                      .toList(),
                ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerLeft,
                child: FilledButton.icon(
                  onPressed: isExportingBatchPdf ? null : _exportBatchPdf,
                  icon: isExportingBatchPdf
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.picture_as_pdf_rounded),
                  label: Text(
                    isExportingBatchPdf
                        ? 'Emitindo lote...'
                        : 'Emitir multiplos municipios',
                  ),
                ),
              ),
              if (isSearching ||
                  suggestions.isNotEmpty ||
                  searchFeedbackMessage != null) ...[
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: SaaSTokens.cardWhite,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: SaaSTokens.borderLight),
                  ),
                  child: isSearching
                      ? const Padding(
                          padding: EdgeInsets.all(16),
                          child: Row(
                            children: [
                              SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                              SizedBox(width: 12),
                              Expanded(child: Text('Buscando municipios...')),
                            ],
                          ),
                        )
                      : suggestions.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text(
                            searchFeedbackMessage ??
                                'Nenhum municipio encontrado.',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        )
                      : ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 280),
                          child: ListView.separated(
                            shrinkWrap: true,
                            itemCount: suggestions.length,
                            separatorBuilder: (context, index) => Divider(
                              height: 1,
                              color: SaaSTokens.borderLight,
                            ),
                            itemBuilder: (context, index) {
                              final item = suggestions[index];
                              return ListTile(
                                dense: true,
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 6,
                                ),
                                title: Text('${item.nome} / ${item.uf}'),
                                subtitle: Text(
                                  'IBGE ${item.codigoIbge} - ${item.regiao}',
                                ),
                                trailing: const Icon(
                                  Icons.north_west_rounded,
                                  size: 18,
                                ),
                                onTap: () => _selectSuggestion(item),
                              );
                            },
                          ),
                        ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _buildPreviewLead(
    RelatorioFundeb relatorio,
    RelatorioDirigidoMunicipio? report,
  ) {
    final ident = relatorio.identificacao;
    final projection = relatorio.activeProjection;
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F2747), Color(0xFF1A3F6F)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(28),
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
                      '${ident.municipioNome} — ${ident.uf}'.toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'IBGE ${ident.codigoIBGE}  •  ${ident.regiao.isNotEmpty ? ident.regiao : ident.mesorregiao}  •  Exercício ${ident.exercicio}',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('Ganho potencial', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 11)),
                    const SizedBox(height: 4),
                    Text(
                      _currency(projection.totalGanho),
                      style: const TextStyle(color: Color(0xFF4ADE80), fontSize: 18, fontWeight: FontWeight.w700),
                    ),
                    Text('+${_percent(projection.ganhoPercentual)}', style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 11)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _HeroBadge(label: 'Exercício ${ident.exercicio}', icon: Icons.calendar_today_rounded),
              _HeroBadge(label: '${bundle?.fontes.length ?? 0} fontes oficiais', icon: Icons.verified_outlined),
              if (report != null)
                _HeroBadge(
                  label: 'Prontidão ${report.prontidao.score}/100',
                  icon: report.prontidao.score >= 70 ? Icons.check_circle_outline : Icons.warning_amber_rounded,
                  highlight: report.prontidao.score >= 70,
                ),
              if (ident.prefeito.isNotEmpty && ident.prefeito != '--')
                _HeroBadge(label: '${ident.prefeito} (${ident.partido})', icon: Icons.person_outline_rounded),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildOverview(RelatorioFundeb relatorio) {
    final projection = relatorio.activeProjection;
    final censo = relatorio.censoEscolar;
    final ident = relatorio.identificacao;
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final compact = width < 900;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // — KPI Grid —
            Wrap(
              spacing: 14,
              runSpacing: 14,
              children: [
                SizedBox(
                  width: compact ? width : (width - 42) / 4,
                  child: _PremiumKpi(
                    label: 'Receita FUNDEB',
                    value: _currency(relatorio.receitas.totalReceitas),
                    helper: 'Exercício ${ident.exercicio}',
                    icon: Icons.account_balance_outlined,
                    accent: const Color(0xFF3B82F6),
                  ),
                ),
                SizedBox(
                  width: compact ? width : (width - 42) / 4,
                  child: _PremiumKpi(
                    label: 'Projetado',
                    value: _currency(projection.totalProjetado),
                    helper: projection.metodologia ?? 'Cenário técnico',
                    icon: Icons.trending_up_rounded,
                    accent: const Color(0xFF10B981),
                  ),
                ),
                SizedBox(
                  width: compact ? width : (width - 42) / 4,
                  child: _PremiumKpi(
                    label: 'Ganho potencial',
                    value: _currency(projection.totalGanho),
                    helper: '+${_percent(projection.ganhoPercentual)}',
                    icon: Icons.stacked_line_chart_rounded,
                    accent: const Color(0xFFF59E0B),
                  ),
                ),
                SizedBox(
                  width: compact ? width : (width - 42) / 4,
                  child: _PremiumKpi(
                    label: 'Matrículas',
                    value: censo == null ? '--' : _integer(censo.totalMatriculas),
                    helper: censo == null ? 'Censo indisponível' : 'Censo ${censo.anoReferencia ?? '--'}',
                    icon: Icons.school_outlined,
                    accent: const Color(0xFF8B5CF6),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // — Municipality info strip —
            SyncSurfaceCard(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Row(
                children: [
                  Expanded(child: _CompactInfo(label: 'Município', value: ident.municipioNome)),
                  Expanded(child: _CompactInfo(label: 'UF', value: ident.uf)),
                  Expanded(child: _CompactInfo(label: 'IBGE', value: ident.codigoIBGE)),
                  Expanded(child: _CompactInfo(label: 'Prefeito', value: _fallbackValue(ident.prefeito))),
                  Expanded(child: _CompactInfo(label: 'Partido', value: _fallbackValue(ident.partido))),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildFontesAndContext(RelatorioFundeb relatorio) {
    final censo = relatorio.censoEscolar;
    final fontes = bundle?.fontes ?? const <FonteColetaStatus>[];
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final compact = width < 1100;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // — Revenue breakdown —
            SyncSurfaceCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 32, height: 32,
                        decoration: BoxDecoration(color: const Color(0xFF3B82F6).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                        child: const Icon(Icons.pie_chart_outline_rounded, size: 16, color: Color(0xFF3B82F6)),
                      ),
                      const SizedBox(width: 10),
                      const Text('Composição da receita FUNDEB', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 14,
                    runSpacing: 14,
                    children: [
                      SizedBox(
                        width: compact ? width : (width - 42) / 4,
                        child: _RevenueItem(
                          label: 'Contribuição municipal',
                          value: _currency(relatorio.receitas.receitaContribuicaoMunicipal),
                          color: const Color(0xFF3B82F6),
                        ),
                      ),
                      SizedBox(
                        width: compact ? width : (width - 42) / 4,
                        child: _RevenueItem(
                          label: 'VAAF',
                          value: _currency(relatorio.receitas.complementacaoVAAF),
                          color: const Color(0xFF10B981),
                        ),
                      ),
                      SizedBox(
                        width: compact ? width : (width - 42) / 4,
                        child: _RevenueItem(
                          label: 'VAAT',
                          value: _currency(relatorio.receitas.complementacaoVAAT),
                          color: const Color(0xFFF59E0B),
                        ),
                      ),
                      SizedBox(
                        width: compact ? width : (width - 42) / 4,
                        child: _RevenueItem(
                          label: 'VAAR',
                          value: _currency(relatorio.receitas.complementacaoVAAR),
                          color: const Color(0xFF8B5CF6),
                        ),
                      ),
                    ],
                  ),
                  if (censo != null) ...[
                    const Divider(height: 28),
                    Wrap(
                      spacing: 14,
                      runSpacing: 14,
                      children: [
                        SizedBox(
                          width: compact ? width : (width - 28) / 3,
                          child: _RevenueItem(label: 'Escolas', value: _integer(censo.totalEscolas), color: const Color(0xFF6366F1)),
                        ),
                        SizedBox(
                          width: compact ? width : (width - 28) / 3,
                          child: _RevenueItem(label: 'Docentes', value: _integer(censo.totalDocentes), color: const Color(0xFF0EA5E9)),
                        ),
                        SizedBox(
                          width: compact ? width : (width - 28) / 3,
                          child: _RevenueItem(label: 'Tempo integral', value: _nullableInteger(censo.tempoIntegral.total), color: const Color(0xFF14B8A6)),
                        ),
                      ],
                    ),
                  ],
                  if (relatorio.situacaoPAR.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: SaaSTokens.scaffold,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.info_outline_rounded, size: 16, color: Color(0xFF64748B)),
                          const SizedBox(width: 8),
                          Expanded(child: Text('PAR: ${_fallbackValue(relatorio.situacaoPAR)}', style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)))),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            // — Fontes —
            Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [
                SizedBox(
                  width: compact ? width : (width - 16) / 2,
                  child: SyncSurfaceCard(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 32, height: 32,
                              decoration: BoxDecoration(color: const Color(0xFF10B981).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                              child: const Icon(Icons.verified_outlined, size: 16, color: Color(0xFF10B981)),
                            ),
                            const SizedBox(width: 10),
                            const Expanded(child: Text('Fontes e rastreabilidade', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
                            StatusPill(label: '${fontes.length}', color: SyncPalette.statusActive),
                          ],
                        ),
                        const SizedBox(height: 14),
                        if (fontes.isEmpty)
                          Text(
                            'Nenhuma fonte consolidada nesta rodada.',
                            style: Theme.of(context).textTheme.bodyMedium,
                          )
                        else
                          for (final fonte in fontes) ...[
                            _StatusLine(
                              title: fonte.label,
                              subtitle: fonte.descricao,
                              label: _statusLabel(fonte.status),
                              color: _statusColor(fonte.status),
                            ),
                            const SizedBox(height: 10),
                          ],
                      ],
                    ),
                  ),
                ),
                if (relatorio.observacoesOperacionais.isNotEmpty)
                  SizedBox(
                    width: compact ? width : (width - 16) / 2,
                    child: SyncSurfaceCard(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 32, height: 32,
                                decoration: BoxDecoration(color: const Color(0xFFF59E0B).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                                child: const Icon(Icons.assignment_outlined, size: 16, color: Color(0xFFF59E0B)),
                              ),
                              const SizedBox(width: 10),
                              const Text('Observações operacionais', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                            ],
                          ),
                          const SizedBox(height: 14),
                          for (final item in relatorio.observacoesOperacionais)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Padding(
                                    padding: EdgeInsets.only(top: 6),
                                    child: Icon(Icons.circle, size: 5, color: Color(0xFF94A3B8)),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(child: Text(item, style: const TextStyle(fontSize: 13, color: Color(0xFF475569), height: 1.5))),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ],
        );
      },
    );
  }

  String _sanitize(String text) {
    return text.replaceAll(RegExp(r'[◆◇♦\uFFFD]'), '').replaceAll('  ', ' ').trim();
  }

  Widget _buildDirectedReport(RelatorioDirigidoMunicipio report) {
    // Only show autonomous data (SICONFI historical series)
    if (report.historico.anos.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildHistoricExpander(report),
      ],
    );
  }

  Widget _buildHistoricExpander(RelatorioDirigidoMunicipio report) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: Container(
        decoration: BoxDecoration(color: SaaSTokens.cardWhite, borderRadius: BorderRadius.circular(12), border: Border.all(color: SaaSTokens.borderLight)),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(20, 0, 20, 18),
          leading: Container(width: 28, height: 28, decoration: BoxDecoration(color: const Color(0xFF6366F1).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(7)), child: const Icon(Icons.timeline_rounded, size: 15, color: Color(0xFF6366F1))),
          title: const Text('Série histórica', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          subtitle: Text('${report.historico.anos.length} exercícios', style: TextStyle(fontSize: 12, color: SaaSTokens.textMuted)),
          children: [
            if (report.historico.resumo.isNotEmpty) ...[
              Text(_sanitize(report.historico.resumo), style: const TextStyle(fontSize: 13, height: 1.55, color: Color(0xFF475569))),
              const SizedBox(height: 14),
            ],
            _buildHistoricTab(report),
          ],
        ),
      ),
    );
  }


  Widget _buildHistoricTab(RelatorioDirigidoMunicipio report) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final compact = width < 900;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SyncSurfaceCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Container(width: 28, height: 28, decoration: BoxDecoration(color: const Color(0xFF6366F1).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(7)), child: const Icon(Icons.timeline_rounded, size: 15, color: Color(0xFF6366F1))),
                    const SizedBox(width: 10),
                    const Text('Síntese histórica', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  ]),
                  const SizedBox(height: 12),
                  Text(report.historico.resumo, style: const TextStyle(fontSize: 13.5, height: 1.6, color: Color(0xFF374151))),
                ],
              ),
            ),
            const SizedBox(height: 14),
            for (final year in report.historico.anos) ...[
              Container(
                decoration: BoxDecoration(
                  color: SaaSTokens.cardWhite,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: SaaSTokens.borderLight),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Year header
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                        border: Border(bottom: BorderSide(color: SaaSTokens.borderLight)),
                      ),
                      child: Row(children: [
                        Text('Exercício ${year.ano}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1E293B))),
                        const Spacer(),
                        StatusPill(label: 'Censo ${year.anoBaseCenso ?? '--'}', color: SyncPalette.statusInfo),
                      ]),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Revenue grid
                          Wrap(spacing: 12, runSpacing: 12, children: [
                            SizedBox(width: compact ? width : (width - 72) / 4, child: _RevenueItem(label: 'Receita FUNDEB', value: _nullableCurrency(year.totalReceitasFundeb), color: const Color(0xFF3B82F6))),
                            SizedBox(width: compact ? width : (width - 72) / 4, child: _RevenueItem(label: 'Contribuição', value: _nullableCurrency(year.contribuicaoMunicipal), color: const Color(0xFF10B981))),
                            SizedBox(width: compact ? width : (width - 72) / 4, child: _RevenueItem(label: 'Matrículas', value: _nullableInteger(year.totalMatriculas), color: const Color(0xFF8B5CF6))),
                            SizedBox(width: compact ? width : (width - 72) / 4, child: _RevenueItem(label: 'Tempo integral', value: _nullableInteger(year.tempoIntegral), color: const Color(0xFF14B8A6))),
                          ]),
                          const SizedBox(height: 14),
                          // Complementações
                          Wrap(spacing: 12, runSpacing: 12, children: [
                            SizedBox(width: compact ? width : (width - 60) / 3, child: _RevenueItem(label: 'VAAF', value: _nullableCurrency(year.complementacaoVAAF), color: const Color(0xFF0EA5E9))),
                            SizedBox(width: compact ? width : (width - 60) / 3, child: _RevenueItem(label: 'VAAT', value: _nullableCurrency(year.complementacaoVAAT), color: const Color(0xFFF59E0B))),
                            SizedBox(width: compact ? width : (width - 60) / 3, child: _RevenueItem(label: 'VAAR', value: _nullableCurrency(year.complementacaoVAAR), color: const Color(0xFFF97316))),
                          ]),
                          const SizedBox(height: 14),
                          // Education data
                          Wrap(spacing: 12, runSpacing: 12, children: [
                            SizedBox(width: compact ? width : (width - 60) / 3, child: _RevenueItem(label: 'Escolas', value: _nullableInteger(year.totalEscolas), color: const Color(0xFF6366F1))),
                            SizedBox(width: compact ? width : (width - 60) / 3, child: _RevenueItem(label: 'EJA', value: _nullableInteger(year.eja), color: const Color(0xFFEC4899))),
                            SizedBox(width: compact ? width : (width - 60) / 3, child: _RevenueItem(label: 'Ed. especial', value: _nullableInteger(year.educacaoEspecial), color: const Color(0xFF14B8A6))),
                          ]),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
          ],
        );
      },
    );
  }

  Widget _buildBenchmarkTab(RelatorioDirigidoMunicipio report) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SyncSurfaceCard(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(report.benchmarkRegional.resumo),
              const SizedBox(height: 8),
              Text(
                'Criterio: ${report.benchmarkRegional.criterio}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (report.benchmarkRegional.municipios.isEmpty)
          SyncSurfaceCard(
            child: Text(
              'Nenhum municipio comparavel com superioridade clara foi localizado nesta rodada.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          )
        else
          for (final item in report.benchmarkRegional.municipios) ...[
            SyncSurfaceCard(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${item.municipio}/${item.uf}',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      StatusPill(
                        label: item.mesmaFaixaPopulacional
                            ? 'Mesma faixa populacional'
                            : 'Faixa aproximada',
                        color: item.mesmaFaixaPopulacional
                            ? SyncPalette.statusActive
                            : SyncPalette.statusWarning,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(item.criterioRegional),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      SizedBox(
                        width: 200,
                        child: _MiniMetric(
                          label: 'Populacao',
                          value: _nullableInteger(item.populacao),
                          helper: 'Porte estimado',
                        ),
                      ),
                      SizedBox(
                        width: 200,
                        child: _MiniMetric(
                          label: 'Receita FUNDEB',
                          value: _nullableCurrency(item.totalReceitasFundeb),
                          helper: 'Exercicio atual',
                        ),
                      ),
                      SizedBox(
                        width: 200,
                        child: _MiniMetric(
                          label: 'Complementacao',
                          value: _nullableCurrency(
                            item.complementacaoUniaoTotal,
                          ),
                          helper: 'Uniao total',
                        ),
                      ),
                      SizedBox(
                        width: 200,
                        child: _MiniMetric(
                          label: 'Vantagem de receita',
                          value: _nullableCurrency(item.vantagemReceita),
                          helper: 'Sobre o municipio atual',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(item.insight),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
      ],
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'automatico':
      case 'confirmado':
      case 'ok':
        return SyncPalette.statusActive;
      case 'estimado':
      case 'sinalizado':
        return SyncPalette.statusWarning;
      case 'pendente_manual':
      case 'manual':
      case 'indisponivel':
        return SyncPalette.statusError;
      default:
        return SyncPalette.textSecondary;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'automatico':
        return 'Automatico';
      case 'estimado':
        return 'Estimado';
      case 'manual':
        return 'Manual';
      case 'ok':
        return 'OK';
      case 'indisponivel':
        return 'Indisponivel';
      case 'confirmado':
        return 'Confirmado';
      case 'sinalizado':
        return 'Sinalizado';
      case 'pendente_manual':
        return 'Pendente manual';
      default:
        return 'Desconhecido';
    }
  }

  Future<void> _exportPdf() async {
    if (bundle == null) {
      _showSnackBar('Carregue um municipio valido antes de gerar o PDF.');
      return;
    }

    setState(() => isExportingPdf = true);
    try {
      final relatorio = bundle!.relatorio;
      final report = relatorioDirigido ?? bundle!.relatorioDirigidoBase;
      final filename = _singlePdfFilename(relatorio);

      final pdfBytes = await FundebLevantamentoPdfBuilder.buildFromBundle(
        bundle!,
        directedReport: report,
      );

      await Printing.sharePdf(bytes: pdfBytes, filename: filename);
    } catch (error) {
      _showSnackBar('Falha ao gerar o PDF: ${_cleanErrorMessage(error)}');
    } finally {
      if (mounted) {
        setState(() => isExportingPdf = false);
      }
    }
  }

  Future<void> _exportLitePdf() async {
    if (bundle == null) {
      _showSnackBar('Carregue um municipio valido antes de gerar o resumo.');
      return;
    }

    setState(() => isExportingLitePdf = true);
    try {
      final relatorio = bundle!.relatorio;
      final report = relatorioDirigido ?? bundle!.relatorioDirigidoBase;
      final rawCity = relatorio.identificacao.municipioNome.isEmpty
          ? municipioController.text.trim()
          : relatorio.identificacao.municipioNome;
      final city = _sanitizeFilenameSegment(rawCity.isEmpty ? 'Municipio' : rawCity);
      final uf = _sanitizeFilenameSegment(
        relatorio.identificacao.uf.isEmpty ? ufController.text : relatorio.identificacao.uf,
      ).toUpperCase();
      final filename = 'RESUMO_$city - ${uf.isEmpty ? 'UF' : uf}.pdf';

      final pdfBytes = await FundebLevantamentoPdfBuilder.buildLiteFromBundle(
        bundle!,
        directedReport: report,
      );

      await Printing.sharePdf(bytes: pdfBytes, filename: filename);
    } catch (error) {
      _showSnackBar('Falha ao gerar o resumo: ${_cleanErrorMessage(error)}');
    } finally {
      if (mounted) {
        setState(() => isExportingLitePdf = false);
      }
    }
  }

  List<MunicipioLookupRequest> _buildBatchRequests() {
    final exercicio =
        int.tryParse(exercicioController.text.trim()) ?? DateTime.now().year;
    return batchSelections
        .map(
          (item) => MunicipioLookupRequest(
            codigoIbge: item.codigoIbge,
            nome: item.nome,
            uf: item.uf,
            exercicio: exercicio,
          ),
        )
        .toList();
  }

  Future<_BatchLevantamentoResult> _loadBatchMunicipio(
    MunicipioLookupRequest request,
  ) async {
    try {
      final result = await widget.repository.getLevantamentoFundeb(request);
      final identificacao = result.relatorio.identificacao;
      return _BatchLevantamentoResult.success(
        bundle: result,
        label: '${identificacao.municipioNome}/${identificacao.uf}',
      );
    } catch (error) {
      final code = (request.codigoIbge ?? '').trim();
      final name = (request.nome ?? '').trim();
      return _BatchLevantamentoResult.failure(
        label: name.isNotEmpty ? name : (code.isEmpty ? 'municipio' : code),
        errorMessage: _cleanErrorMessage(error),
      );
    }
  }

  Future<void> _exportBatchPdf() async {
    final requests = _buildBatchRequests();
    if (requests.isEmpty) {
      _showSnackBar(
        'Adicione ao menos um municipio na fila para emitir o PDF em lote.',
      );
      return;
    }

    setState(() {
      isExportingBatchPdf = true;
      batchProcessedCount = 0;
      batchTotalCount = requests.length;
    });

    final bundles = <LevantamentoFundebBundle>[];
    final directedReports = <RelatorioDirigidoMunicipio?>[];
    final failures = <String>[];

    try {
      // Pre-load font + logo once before the batch loop
      await FundebLevantamentoPdfBuilder.warmupAssets();

      const parallelism = 3;
      for (var start = 0; start < requests.length; start += parallelism) {
        final end = (start + parallelism < requests.length)
            ? start + parallelism
            : requests.length;
        final chunk = requests.sublist(start, end);

        if (mounted) {
          final labels = chunk.map((r) => r.nome ?? r.codigoIbge ?? '').join(', ');
          setState(() => batchCurrentLabel = labels);
        }

        final results = await Future.wait(chunk.map(_loadBatchMunicipio));

        for (final result in results) {
          if (result.bundle != null) {
            bundles.add(result.bundle!);
            directedReports.add(result.bundle!.relatorioDirigidoBase);
          } else {
            failures.add('${result.label}: ${result.errorMessage}');
          }
        }

        if (mounted) {
          setState(() => batchProcessedCount = end);
        }
      }

      if (bundles.isEmpty) {
        final detail = failures.isEmpty ? '' : ' ${failures.first}';
        _showSnackBar('Nao foi possivel montar o lote.$detail');
        return;
      }

      if (mounted) {
        setState(() => batchCurrentLabel = 'Gerando PDFs...');
      }

      final zipEncoder = ZipEncoder();
      final archive = Archive();

      for (int i = 0; i < bundles.length; i++) {
        final batchBundle = bundles[i];
        final report = directedReports[i];

        final pdfBytes = await FundebLevantamentoPdfBuilder.buildFromBundle(
          batchBundle,
          directedReport: report,
        );

        final filename = _singlePdfFilename(batchBundle.relatorio);
        final archiveFile = ArchiveFile(filename, pdfBytes.length, pdfBytes);
        archive.addFile(archiveFile);
      }

      final zipData = zipEncoder.encode(archive);
      if (zipData == null) {
        throw Exception('Falha ao gerar o arquivo ZIP do lote.');
      }

      final now = DateTime.now();
      final zipFilename =
          'LEVANTAMENTO_LOTE_${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}_${now.hour.toString().padLeft(2, '0')}${now.minute.toString().padLeft(2, '0')}.zip';

      final tempDir = await getTemporaryDirectory();
      final zipFile = File('${tempDir.path}/$zipFilename');
      await zipFile.writeAsBytes(zipData);

      await Share.shareXFiles([XFile(zipFile.path)], text: 'Levantamentos FUNDEB em Lote');

      if (!mounted) return;
      final summary = failures.isEmpty
          ? 'PDF em lote gerado com ${bundles.length} municipios.'
          : 'PDF em lote gerado com ${bundles.length} municipios. ${failures.length} falharam.';
      _showSnackBar(summary);
    } catch (error) {
      _showSnackBar('Falha ao emitir o lote: ${_cleanErrorMessage(error)}');
    } finally {
      if (mounted) {
        setState(() {
          isExportingBatchPdf = false;
          batchProcessedCount = 0;
          batchTotalCount = 0;
          batchCurrentLabel = null;
        });
      }
    }
  }

  String _cleanErrorMessage(Object error) {
    final message = error.toString().replaceFirst('Exception: ', '').trim();
    return message.isEmpty ? 'Falha inesperada.' : message;
  }

  String _singlePdfFilename(RelatorioFundeb relatorio) {
    final ident = relatorio.identificacao;
    final rawCity = ident.municipioNome.isEmpty
        ? municipioController.text.trim()
        : ident.municipioNome;
    final city = _sanitizeFilenameSegment(rawCity.isEmpty ? 'Municipio' : rawCity);
    final uf = _sanitizeFilenameSegment(ident.uf.isEmpty ? ufController.text : ident.uf)
        .toUpperCase();
    return 'LEVANTAMENTO_$city - ${uf.isEmpty ? 'UF' : uf}.pdf';
  }

  String _sanitizeFilenameSegment(String value) {
    return value
        .trim()
        .replaceAll(RegExp(r'[\\\\/:*?"<>|]'), '')
        .replaceAll(RegExp(r'\s+'), ' ');
  }

  String _currency(double value) {
    final fixed = value.toStringAsFixed(2).split('.');
    final integer = fixed.first.replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'),
      (match) => '.',
    );
    return 'R\$ $integer,${fixed.last}';
  }

  String _nullableCurrency(double? value) {
    return value == null ? '--' : _currency(value);
  }

  String _integer(int value) {
    return value.toString().replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'),
      (match) => '.',
    );
  }

  String _nullableInteger(int? value) {
    return value == null ? '--' : _integer(value);
  }

  String _percent(double value) {
    return '${(value * 100).toStringAsFixed(1).replaceAll('.', ',')}%';
  }

  String _fallbackValue(String? value) {
    final normalized = (value ?? '').trim();
    if (normalized.isEmpty || normalized.toLowerCase() == 'nao informado') {
      return '--';
    }
    return normalized;
  }

  Widget _buildLoadingPanel() {
    final elapsed = _loadingStopwatch?.elapsed ?? Duration.zero;
    final seconds = elapsed.inSeconds;

    return SyncSurfaceCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Processando levantamento...',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              if (seconds > 0)
                Text(
                  '${seconds}s',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          for (int i = 0; i < loadingSteps.length; i++) ...[
            _buildStepRow(loadingSteps[i], i),
            if (i < loadingSteps.length - 1) const SizedBox(height: 2),
          ],
        ],
      ),
    );
  }

  Widget _buildStepRow(_LoadingStep step, int index) {
    final theme = Theme.of(context);
    final isActive = step.status == _StepStatus.running;
    final isDone = step.status == _StepStatus.done;
    final isError = step.status == _StepStatus.error;
    final isPending = step.status == _StepStatus.pending;

    final Color iconColor;
    final Widget leadingIcon;

    if (isDone) {
      iconColor = const Color(0xFF15803D);
      leadingIcon = Icon(Icons.check_circle_rounded, size: 20, color: iconColor);
    } else if (isActive) {
      iconColor = theme.colorScheme.primary;
      leadingIcon = SizedBox(
        width: 20,
        height: 20,
        child: CircularProgressIndicator(strokeWidth: 2, color: iconColor),
      );
    } else if (isError) {
      iconColor = const Color(0xFFEF4444);
      leadingIcon = Icon(Icons.error_rounded, size: 20, color: iconColor);
    } else {
      iconColor = const Color(0xFFCBD5E1);
      leadingIcon = Icon(Icons.radio_button_unchecked, size: 20, color: iconColor);
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          leadingIcon,
          const SizedBox(width: 12),
          Icon(
            step.icon,
            size: 16,
            color: isPending ? const Color(0xFFCBD5E1) : iconColor,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  step.label,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                    color: isPending
                        ? const Color(0xFFCBD5E1)
                        : theme.textTheme.bodyMedium?.color,
                  ),
                ),
                if (step.detail != null)
                  Text(
                    step.detail!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: isError ? const Color(0xFFEF4444) : null,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}




class _StatusLine extends StatelessWidget {
  const _StatusLine({
    required this.title,
    required this.subtitle,
    required this.label,
    required this.color,
  });

  final String title;
  final String subtitle;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 6),
                Text(subtitle),
              ],
            ),
          ),
          const SizedBox(width: 12),
          StatusPill(label: label, color: color),
        ],
      ),
    );
  }
}

class _MiniMetric extends StatelessWidget {
  const _MiniMetric({
    required this.label,
    required this.value,
    required this.helper,
  });

  final String label;
  final String value;
  final String helper;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: SaaSTokens.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          Text(value, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(helper, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}



class _BatchLevantamentoResult {
  const _BatchLevantamentoResult.success({
    required this.bundle,
    required this.label,
  }) : errorMessage = null;

  const _BatchLevantamentoResult.failure({
    required this.label,
    required this.errorMessage,
  }) : bundle = null;

  final LevantamentoFundebBundle? bundle;
  final String label;
  final String? errorMessage;
}

class _BatchMunicipioSelection {
  const _BatchMunicipioSelection({
    required this.codigoIbge,
    required this.nome,
    required this.uf,
    required this.regiao,
  });

  final String codigoIbge;
  final String nome;
  final String uf;
  final String regiao;
}

enum _StepStatus { pending, running, done, error }

class _LoadingStep {
  const _LoadingStep({
    required this.label,
    required this.icon,
    required this.status,
    this.detail,
  });

  final String label;
  final IconData icon;
  final _StepStatus status;
  final String? detail;

  _LoadingStep copyWith({_StepStatus? status, String? detail}) {
    return _LoadingStep(
      label: label,
      icon: icon,
      status: status ?? this.status,
      detail: detail ?? this.detail,
    );
  }
}

class _HeroBadge extends StatelessWidget {
  const _HeroBadge({required this.label, required this.icon, this.highlight = false});
  final String label;
  final IconData icon;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: highlight ? const Color(0xFF10B981).withValues(alpha: 0.2) : Colors.white.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: highlight ? const Color(0xFF10B981).withValues(alpha: 0.4) : Colors.white.withValues(alpha: 0.15)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: highlight ? const Color(0xFF4ADE80) : Colors.white.withValues(alpha: 0.8)),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(color: highlight ? const Color(0xFF4ADE80) : Colors.white.withValues(alpha: 0.9), fontSize: 12, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

class _PremiumKpi extends StatelessWidget {
  const _PremiumKpi({required this.label, required this.value, required this.helper, required this.icon, required this.accent});
  final String label;
  final String value;
  final String helper;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: SaaSTokens.cardWhite,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: SaaSTokens.borderLight),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 18, color: accent),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(label, style: TextStyle(color: SaaSTokens.textMuted, fontSize: 12, fontWeight: FontWeight.w500)),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(value, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: SaaSTokens.textTitle)),
          const SizedBox(height: 4),
          Text(helper, style: TextStyle(fontSize: 11.5, color: SaaSTokens.textMuted), maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

class _CompactInfo extends StatelessWidget {
  const _CompactInfo({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 11, color: SaaSTokens.textMuted, fontWeight: FontWeight.w500)),
        const SizedBox(height: 3),
        Text(
          value.isEmpty || value == '--' ? '—' : value,
          style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: SaaSTokens.textTitle),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

class _RevenueItem extends StatelessWidget {
  const _RevenueItem({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Text(label, style: TextStyle(fontSize: 12, color: SaaSTokens.textMuted, fontWeight: FontWeight.w500)),
            ],
          ),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: SaaSTokens.textTitle)),
        ],
      ),
    );
  }
}
