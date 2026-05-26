import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:printing/printing.dart';

import '../../../core/models/levantamento_fundeb_models.dart';
import '../../../core/models/sync_models.dart';
import '../../../core/repositories/mock_sync_repository.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../shared/presentation/shared_widgets.dart';
import '../application/fundeb_levantamento_pdf_builder.dart';

class LevantamentoFundebLiteScreen extends StatefulWidget {
  const LevantamentoFundebLiteScreen({
    super.key,
    required this.repository,
    required this.module,
    required this.onBack,
  });

  final SyncRepository repository;
  final ModuleDefinition module;
  final VoidCallback onBack;

  @override
  State<LevantamentoFundebLiteScreen> createState() =>
      _LevantamentoFundebLiteScreenState();
}

class _LevantamentoFundebLiteScreenState
    extends State<LevantamentoFundebLiteScreen> {
  final codigoController = TextEditingController();
  final municipioController = TextEditingController();
  final ufController = TextEditingController();
  late final TextEditingController exercicioController;

  Timer? searchDebounce;
  List<MunicipioSearchItem> suggestions = const <MunicipioSearchItem>[];
  LevantamentoFundebBundle? bundle;
  bool isSearching = false;
  bool isLoading = false;
  bool isExportingPdf = false;
  String? searchFeedbackMessage;
  String? errorMessage;
  int searchRequestToken = 0;

  static final NumberFormat _brlFormatter = NumberFormat.currency(
    locale: 'pt_BR',
    symbol: 'R\$',
  );

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
    codigoController.dispose();
    municipioController.dispose();
    ufController.dispose();
    exercicioController.dispose();
    super.dispose();
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
    if (!request.hasCodigoIbge && !request.hasNameLookup) return null;
    return request;
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

  Future<void> _loadMunicipio() async {
    final request = _buildRequest();
    if (request == null) {
      _showSnackBar(
        'Informe um codigo IBGE valido ou selecione um municipio pela busca.',
      );
      return;
    }

    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final result = await widget.repository.getLevantamentoFundeb(request);
      if (!mounted) return;
      final ident = result.relatorio.identificacao;
      setState(() {
        bundle = result;
        suggestions = const <MunicipioSearchItem>[];
        searchFeedbackMessage = null;
        codigoController.text = ident.codigoIBGE;
        municipioController.text = ident.municipioNome;
        ufController.text = ident.uf;
        exercicioController.text = ident.exercicio.toString();
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => errorMessage = _cleanErrorMessage(error));
    } finally {
      if (mounted) setState(() => isLoading = false);
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

  Future<void> _exportPdf() async {
    final currentBundle = bundle;
    if (currentBundle == null) {
      _showSnackBar('Carregue um municipio valido antes de gerar o PDF.');
      return;
    }

    setState(() => isExportingPdf = true);
    try {
      final pdfBytes = await FundebLevantamentoPdfBuilder.buildLiteFromBundle(
        currentBundle,
        directedReport: currentBundle.relatorioDirigidoBase,
      );
      await Printing.sharePdf(
        bytes: pdfBytes,
        filename: _litePdfFilename(currentBundle.relatorio),
      );
    } catch (error) {
      _showSnackBar('Falha ao gerar o PDF Lite: ${_cleanErrorMessage(error)}');
    } finally {
      if (mounted) setState(() => isExportingPdf = false);
    }
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final relatorio = bundle?.relatorio;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SyncSectionHeader(
            title: 'Levantamento Lite FUNDEB',
            description:
                'Versao infografica para reuniao: dados da cidade, rede escolar, gestao atual e potencial financeiro em ate duas paginas.',
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
                  label: Text(isLoading ? 'Carregando...' : 'Montar lite'),
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
                  label: Text(isExportingPdf ? 'Gerando...' : 'Exportar Lite'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _buildSearchPanel(),
          const SizedBox(height: 18),
          if (errorMessage != null) ...[
            SyncSurfaceCard(child: Text(errorMessage!)),
            const SizedBox(height: 18),
          ],
          if (relatorio == null)
            _buildEmptyState()
          else
            _buildInfographicPreview(
              relatorio,
              bundle!.relatorioDirigidoBase,
              bundle!.ibgePerfil,
            ),
        ],
      ),
    );
  }

  Widget _buildSearchPanel() {
    return SyncSurfaceCard(
      padding: const EdgeInsets.all(18),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 760;
          final width = constraints.maxWidth;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
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
                    width: compact ? width : 150,
                    child: TextField(
                      controller: exercicioController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Exercicio'),
                    ),
                  ),
                ],
              ),
              if (isSearching ||
                  suggestions.isNotEmpty ||
                  searchFeedbackMessage != null) ...[
                const SizedBox(height: 16),
                _buildSuggestions(),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _buildSuggestions() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: SyncPalette.bgSecondary,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: SyncPalette.borderSubtle),
      ),
      child: isSearching
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: Row(
                children: [
                  SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(width: 12),
                  Expanded(child: Text('Buscando municipios...')),
                ],
              ),
            )
          : suggestions.isEmpty
          ? Padding(
              padding: const EdgeInsets.all(16),
              child: Text(searchFeedbackMessage ?? 'Nenhum municipio.'),
            )
          : ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 280),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: suggestions.length,
                separatorBuilder: (context, index) =>
                    Divider(height: 1, color: SyncPalette.borderSubtle),
                itemBuilder: (context, index) {
                  final item = suggestions[index];
                  return ListTile(
                    dense: true,
                    title: Text('${item.nome} / ${item.uf}'),
                    subtitle: Text('IBGE ${item.codigoIbge}'),
                    trailing: const Icon(Icons.arrow_forward_rounded),
                    onTap: () => _selectSuggestion(item),
                  );
                },
              ),
            ),
    );
  }

  Widget _buildEmptyState() {
    return SyncSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Pronto para montar o resumo',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'Use a mesma base do levantamento FUNDEB para gerar uma leitura curta, visual e objetiva.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }

  Widget _buildInfographicPreview(
    RelatorioFundeb relatorio,
    RelatorioDirigidoMunicipio? report,
    IbgeMunicipioPerfil? ibge,
  ) {
    final ident = relatorio.identificacao;
    final censo = relatorio.censoEscolar;
    final projection = relatorio.activeProjection;
    final political = report?.contextoPolitico;
    final population = _officialPopulation(relatorio, report, ibge);
    final complementation =
        relatorio.receitas.complementacaoVAAF +
        relatorio.receitas.complementacaoVAAT +
        relatorio.receitas.complementacaoVAAR;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: SyncPalette.accent,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: SyncPalette.borderMedium),
          ),
          child: Wrap(
            spacing: 28,
            runSpacing: 18,
            alignment: WrapAlignment.spaceBetween,
            children: [
              SizedBox(
                width: 420,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${ident.municipioNome} / ${ident.uf}',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'IBGE ${ident.codigoIBGE} - ${ident.regiao} - ${ident.exercicio}',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              _HeroDatum(
                label: 'Valor agregado',
                value: _moneyCompact(projection.totalGanho),
                helper: '+${_percent(projection.ganhoPercentual)} estimado',
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, constraints) {
            final itemWidth = constraints.maxWidth < 760
                ? constraints.maxWidth
                : (constraints.maxWidth - 32) / 3;
            return Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [
                SizedBox(
                  width: itemWidth,
                  child: SyncMetricCard(
                    label: 'Habitantes',
                    value: population == null ? '-' : _integer(population),
                    helper: population == null ? 'Nao informado' : 'Base IBGE',
                    icon: Icons.location_city_rounded,
                    color: SyncPalette.statusInfo,
                  ),
                ),
                SizedBox(
                  width: itemWidth,
                  child: SyncMetricCard(
                    label: 'Receita FUNDEB',
                    value: _moneyCompact(relatorio.receitas.totalReceitas),
                    helper: 'Base oficial consolidada',
                    icon: Icons.account_balance_rounded,
                    color: SyncPalette.statusActive,
                  ),
                ),
                SizedBox(
                  width: itemWidth,
                  child: SyncMetricCard(
                    label: 'Ganho potencial',
                    value: _moneyCompact(projection.totalGanho),
                    helper:
                        '+${_percent(projection.ganhoPercentual * 100)} sobre a base',
                    icon: Icons.trending_up_rounded,
                    color: SyncPalette.statusWarning,
                  ),
                ),
              ],
            );
          },
        ),
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxWidth < 900;
            final width = compact
                ? constraints.maxWidth
                : (constraints.maxWidth - 16) / 2;
            return Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [
                SizedBox(
                  width: width,
                  child: _DataBlock(
                    title: 'Cidade e gestao',
                    rows: [
                      _DataRowLite(
                        'Prefeito',
                        _fallback(political?.prefeitoAtual, ident.prefeito),
                      ),
                      _DataRowLite(
                        'Partido',
                        _fallback(political?.partidoAtual, ident.partido),
                      ),
                      _DataRowLite(
                        'Mandato',
                        _fallback(political?.classificacaoMandato, '-'),
                      ),
                      _DataRowLite(
                        'Regiao',
                        _fallback(ident.regiaoIntermediaria, ident.regiao),
                      ),
                    ],
                  ),
                ),
                SizedBox(
                  width: width,
                  child: _DataBlock(
                    title: 'Rede escolar',
                    rows: [
                      _DataRowLite(
                        'Escolas',
                        _integerNullable(censo?.totalEscolas),
                      ),
                      _DataRowLite(
                        'Matriculas',
                        _integerNullable(censo?.totalMatriculas),
                      ),
                      _DataRowLite(
                        'Docentes',
                        _integerNullable(censo?.totalDocentes),
                      ),
                      _DataRowLite(
                        'Tempo integral',
                        _integerNullable(censo?.tempoIntegral.total),
                      ),
                    ],
                  ),
                ),
                SizedBox(
                  width: width,
                  child: _DataBlock(
                    title: 'IBGE oficial',
                    rows: _ibgeRows(ibge).take(10).toList(),
                  ),
                ),
                SizedBox(
                  width: width,
                  child: _DataBlock(
                    title: 'Etapas',
                    rows: [
                      _DataRowLite(
                        'Infantil',
                        _integerNullable(
                          censo?.matriculasEtapa.educacaoInfantil,
                        ),
                      ),
                      _DataRowLite(
                        'Fundamental',
                        _integerNullable(
                          censo?.matriculasEtapa.ensinoFundamental,
                        ),
                      ),
                      _DataRowLite(
                        'EJA',
                        _integerNullable(censo?.matriculasEtapa.eja),
                      ),
                      _DataRowLite(
                        'Especial',
                        _integerNullable(
                          censo?.matriculasEtapa.educacaoEspecial,
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(
                  width: width,
                  child: _DataBlock(
                    title: 'Financeiro',
                    rows: [
                      _DataRowLite(
                        'Complementacao',
                        _moneyCompact(complementation),
                      ),
                      _DataRowLite(
                        'Projetado',
                        _moneyCompact(projection.totalProjetado),
                      ),
                      _DataRowLite(
                        'FUNDEB per capita',
                        relatorio.perfilComercial?.fundebPerCapita == null
                            ? '-'
                            : _money(
                                relatorio.perfilComercial!.fundebPerCapita!,
                              ),
                      ),
                      _DataRowLite(
                        'VAAT',
                        _fallback(
                          relatorio.perfilComercial?.habilitacaoVaat,
                          '-',
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );
  }

  int? _officialPopulation(
    RelatorioFundeb relatorio,
    RelatorioDirigidoMunicipio? report,
    IbgeMunicipioPerfil? ibge,
  ) {
    final ibgeEstimated = ibge?.populacaoEstimada;
    if (ibgeEstimated != null && ibgeEstimated > 0) {
      return ibgeEstimated;
    }
    final directedPopulation = report?.perfilMunicipio?.populacao;
    if (directedPopulation != null && directedPopulation > 0) {
      return directedPopulation;
    }
    final profilePopulation = relatorio.perfilComercial?.populacaoEstimada;
    if (profilePopulation != null && profilePopulation > 0) {
      return profilePopulation;
    }
    return null;
  }

  List<_DataRowLite> _ibgeRows(IbgeMunicipioPerfil? ibge) {
    if (ibge == null || !ibge.hasAny) {
      return const [_DataRowLite('IBGE', 'Nao informado')];
    }
    return [
      _DataRowLite(
        'Area territorial',
        '${_numberNullable(ibge.areaTerritorial)} km2${_yearSuffix(ibge.areaAnoReferencia)}',
      ),
      _DataRowLite(
        'Ultimo censo',
        '${_integerNullable(ibge.populacaoUltimoCenso)} pessoas${_yearSuffix(ibge.populacaoUltimoCensoAnoReferencia)}',
      ),
      _DataRowLite(
        'Densidade',
        '${_numberNullable(ibge.densidadeDemografica)} hab/km2${_yearSuffix(ibge.densidadeAnoReferencia)}',
      ),
      _DataRowLite(
        'Pop. estimada',
        '${_integerNullable(ibge.populacaoEstimada)} pessoas${_yearSuffix(ibge.populacaoEstimadaAnoReferencia)}',
      ),
      _DataRowLite(
        'Escolarizacao 6-14',
        '${_numberNullable(ibge.escolarizacao614)}%${_yearSuffix(ibge.escolarizacaoAnoReferencia)}',
      ),
      _DataRowLite(
        'IDHM',
        '${_numberNullable(ibge.idhm, digits: 3)}${_yearSuffix(ibge.idhmAnoReferencia)}',
      ),
      _DataRowLite(
        'Mortalidade infantil',
        '${_numberNullable(ibge.mortalidadeInfantil)} por mil${_yearSuffix(ibge.mortalidadeAnoReferencia)}',
      ),
      _DataRowLite(
        'Receitas brutas',
        '${_moneyNullable(ibge.receitasBrutasRealizadas)}${_yearSuffix(ibge.receitasAnoReferencia)}',
      ),
      _DataRowLite(
        'Despesas empenhadas',
        '${_moneyNullable(ibge.despesasBrutasEmpenhadas)}${_yearSuffix(ibge.despesasAnoReferencia)}',
      ),
      _DataRowLite(
        'PIB per capita',
        '${_moneyNullable(ibge.pibPerCapita)}${_yearSuffix(ibge.pibAnoReferencia)}',
      ),
    ];
  }

  String _litePdfFilename(RelatorioFundeb relatorio) {
    final ident = relatorio.identificacao;
    final city = ident.municipioNome
        .replaceAll(RegExp(r'[^A-Za-z0-9]+'), '_')
        .replaceAll(RegExp(r'_+'), '_')
        .replaceAll(RegExp(r'^_|_$'), '')
        .toUpperCase();
    return 'LEVANTAMENTO_LITE_${city.isEmpty ? 'MUNICIPIO' : city}_${ident.uf}.pdf';
  }

  String _fallback(String? value, String fallback) {
    final normalized = (value ?? '').trim();
    return normalized.isEmpty ? fallback : normalized;
  }

  String _money(double value) =>
      _brlFormatter.format(value).replaceAll('\u00A0', ' ');

  String _moneyNullable(double? value) => value == null ? '-' : _money(value);

  String _moneyCompact(double value) {
    final abs = value.abs();
    if (abs >= 1000000) {
      return 'R\$ ${(value / 1000000).toStringAsFixed(2).replaceAll('.', ',')} mi';
    }
    if (abs >= 1000) {
      return 'R\$ ${(value / 1000).toStringAsFixed(0).replaceAll('.', ',')} mil';
    }
    return _money(value);
  }

  String _percent(double value) =>
      '${value.toStringAsFixed(1).replaceAll('.', ',')}%';

  String _integer(int value) => value.toString().replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (match) => '.',
  );

  String _integerNullable(int? value) => value == null ? '-' : _integer(value);

  String _numberNullable(double? value, {int digits = 2}) =>
      value == null ? '-' : value.toStringAsFixed(digits).replaceAll('.', ',');

  String _yearSuffix(String? year) {
    final normalized = (year ?? '').trim();
    return normalized.isEmpty || normalized == '-' ? '' : ' [$normalized]';
  }

  String _cleanErrorMessage(Object error) {
    final text = error.toString();
    return text.startsWith('Exception: ') ? text.substring(11) : text;
  }
}

class _HeroDatum extends StatelessWidget {
  const _HeroDatum({required this.label, required this.value, this.helper});

  final String label;
  final String value;
  final String? helper;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 4),
        Text(
          value,
          style: Theme.of(
            context,
          ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
        ),
        if (helper != null) ...[
          const SizedBox(height: 4),
          Text(helper!, style: Theme.of(context).textTheme.bodySmall),
        ],
      ],
    );
  }
}

class _DataRowLite {
  const _DataRowLite(this.label, this.value);

  final String label;
  final String value;
}

class _DataBlock extends StatelessWidget {
  const _DataBlock({required this.title, required this.rows});

  final String title;
  final List<_DataRowLite> rows;

  @override
  Widget build(BuildContext context) {
    return SyncSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 14),
          ...rows.map(
            (row) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 132,
                    child: Text(
                      row.label,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      row.value,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
