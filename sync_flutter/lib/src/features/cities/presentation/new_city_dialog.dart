import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/models/levantamento_fundeb_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/theme/app_theme.dart';
import '../../shared/presentation/shared_widgets.dart';

/// Dado de um município retornado pela API IBGE
class _IbgeMunicipio {
  final String id;
  final String nome;
  final String uf;
  final String ufSigla;
  final String mesorregiao;
  final String microrregiao;

  const _IbgeMunicipio({
    required this.id,
    required this.nome,
    required this.uf,
    required this.ufSigla,
    required this.mesorregiao,
    required this.microrregiao,
  });

  factory _IbgeMunicipio.fromJson(Map<String, dynamic> json) {
    final micro = json['microrregiao'] as Map<String, dynamic>? ?? {};
    final meso = micro['mesorregiao'] as Map<String, dynamic>? ?? {};
    final ufData = meso['UF'] as Map<String, dynamic>? ?? {};
    return _IbgeMunicipio(
      id: json['id'].toString(),
      nome: json['nome']?.toString() ?? '',
      uf: ufData['nome']?.toString() ?? '',
      ufSigla: ufData['sigla']?.toString() ?? '',
      mesorregiao: meso['nome']?.toString() ?? '',
      microrregiao: micro['nome']?.toString() ?? '',
    );
  }

  String get display => '$nome / $ufSigla';
}

/// Dialog para cadastro de nova cidade no pipeline — com autocomplete IBGE
class NewCityDialog extends StatefulWidget {
  const NewCityDialog({super.key, required this.repository});
  final SyncRepository repository;

  @override
  State<NewCityDialog> createState() => _NewCityDialogState();
}

class _NewCityDialogState extends State<NewCityDialog> {
  final _formKey = GlobalKey<FormState>();
  bool _saving = false;
  List<CollaboratorSummary> _collaborators = [];

  // IBGE autocomplete
  List<_IbgeMunicipio> _allMunicipios = [];
  List<_IbgeMunicipio> _suggestions = [];
  bool _loadingIbge = true;
  _IbgeMunicipio? _selected;
  bool _showSuggestions = false;
  final _searchController = TextEditingController();
  final _searchFocus = FocusNode();

  // Form fields
  final _mayor = TextEditingController();
  final _secretary = TextEditingController();
  final _procurement = TextEditingController();
  final _notes = TextEditingController();
  String _stage = 'mapping';
  String? _collaboratorId;
  bool _loadingMayor = false;

  // FUNDEB
  LevantamentoFundebBundle? _fundeb;
  bool _loadingFundeb = false;
  String? _fundebError;

  static const _stages = <String, String>{
    'mapping': 'Indicação / Mapeamento',
    'first_contact': '1º Contato',
    'institutional_validation': 'Validação Institucional',
    'technical_diagnosis': 'Diagnóstico Técnico',
    'proposal_presented': 'Proposta Apresentada',
    'negotiation': 'Negociação',
  };

  @override
  void initState() {
    super.initState();
    _loadIbge();
    _loadCollaborators();
    _searchFocus.addListener(() {
      if (!_searchFocus.hasFocus) {
        Future.delayed(const Duration(milliseconds: 200), () {
          if (mounted) setState(() => _showSuggestions = false);
        });
      }
    });
  }

  Future<void> _loadIbge() async {
    try {
      final response = await http.get(
        Uri.parse('https://servicodados.ibge.gov.br/api/v1/localidades/municipios'),
        headers: const {'Accept': 'application/json'},
      );
      if (response.statusCode < 400) {
        final list = jsonDecode(response.body) as List;
        _allMunicipios = list
            .whereType<Map<String, dynamic>>()
            .map((j) => _IbgeMunicipio.fromJson(j))
            .toList();
        _allMunicipios.sort((a, b) => a.nome.compareTo(b.nome));
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingIbge = false);
  }

  Future<void> _loadCollaborators() async {
    try {
      final collabs = await widget.repository.getCollaborators();
      if (mounted) setState(() => _collaborators = collabs);
    } catch (_) {}
  }

  void _onSearchChanged(String query) {
    if (query.length < 2) {
      setState(() { _suggestions = []; _showSuggestions = false; });
      return;
    }
    final q = _normalize(query);
    final matches = _allMunicipios.where((m) {
      final n = _normalize(m.nome);
      return n.contains(q) || _normalize(m.ufSigla).contains(q) || _normalize('${m.nome} ${m.ufSigla}').contains(q);
    }).take(12).toList();
    setState(() { _suggestions = matches; _showSuggestions = true; });
  }

  void _selectMunicipio(_IbgeMunicipio m) {
    setState(() {
      _selected = m;
      _searchController.text = m.display;
      _showSuggestions = false;
      _fundeb = null;
      _fundebError = null;
    });
    _searchFocus.unfocus();
    _fetchFundeb(m.id);
  }

  /// Busca levantamento FUNDEB completo ao selecionar município
  Future<void> _fetchFundeb(String ibgeCode) async {
    setState(() { _loadingFundeb = true; _loadingMayor = true; _fundebError = null; });
    try {
      final bundle = await widget.repository.getLevantamentoFundeb(
        MunicipioLookupRequest(codigoIbge: ibgeCode, exercicio: DateTime.now().year),
      );
      if (mounted) {
        final ident = bundle.relatorio.identificacao;
        // Auto-fill prefeito from FUNDEB report
        if (ident.prefeito.isNotEmpty && !ident.prefeito.contains('Consultar')) {
          _mayor.text = '${ident.prefeito} (${ident.partido})';
        }
        setState(() => _fundeb = bundle);
      }
    } catch (e) {
      if (mounted) setState(() => _fundebError = e.toString());
    } finally {
      if (mounted) setState(() { _loadingFundeb = false; _loadingMayor = false; });
    }
  }

  String _normalize(String s) => s
      .toLowerCase()
      .replaceAll(RegExp(r'[áàâãä]'), 'a')
      .replaceAll(RegExp(r'[éèêë]'), 'e')
      .replaceAll(RegExp(r'[íìîï]'), 'i')
      .replaceAll(RegExp(r'[óòôõö]'), 'o')
      .replaceAll(RegExp(r'[úùûü]'), 'u')
      .replaceAll('ç', 'c')
      .replaceAll(RegExp(r'[^a-z0-9]'), '')
      .trim();

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocus.dispose();
    _mayor.dispose();
    _secretary.dispose();
    _procurement.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selected == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecione um município da lista IBGE.')),
      );
      return;
    }
    setState(() => _saving = true);

    try {
      final payload = <String, dynamic>{
        'municipalityName': _selected!.nome,
        'state': _selected!.ufSigla,
        'ibgeCode': _selected!.id,
        'currentStage': _stage,
      };
      // Só adiciona campos opcionais se preenchidos
      final mayor = _mayor.text.trim();
      final secretary = _secretary.text.trim();
      final procurement = _procurement.text.trim();
      if (mayor.isNotEmpty) payload['mayorName'] = mayor;
      if (secretary.isNotEmpty) payload['educationSecretaryName'] = secretary;
      if (procurement.isNotEmpty) payload['procurementLeadName'] = procurement;
      if (_collaboratorId != null) {
        payload['sourceType'] = 'partner_referral';
        final collab = _collaborators.where((c) => c.id == _collaboratorId).firstOrNull;
        if (collab != null) payload['sourceDescription'] = collab.fullName;
      }
      // Auto-fill financeiro from FUNDEB
      if (_fundeb != null) {
        final rec = _fundeb!.relatorio.receitas;
        final proj = _fundeb!.relatorio.projecao;
        payload['estimatedAnnualRevenue'] = rec.totalReceitas;
        payload['estimatedAnnualCost'] = proj.totalGanho;
      }

      await widget.repository.createCity(payload);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e'), backgroundColor: SaaSTokens.error),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Cabeçalho ──
                Row(children: [
                  Container(
                    width: 42, height: 42,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEF2FF),
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: const Icon(LucideIcons.mapPinPlus, size: 20, color: Color(0xFF6366F1)),
                  ),
                  const SizedBox(width: 14),
                  Expanded(child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text('Nova Cidade', style: TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w700,
                        color: SaaSTokens.textTitle, letterSpacing: -0.3,
                      )),
                      SizedBox(height: 2),
                      Text('Busque pelo nome — dados preenchidos via IBGE.', style: TextStyle(
                        fontSize: 13, color: SaaSTokens.textMuted,
                      )),
                    ],
                  )),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                ]),
                const SizedBox(height: 24),
                const Divider(height: 1, color: SaaSTokens.borderLight),
                const SizedBox(height: 20),

                // ── Busca IBGE ──
                _sectionTitle('Município (base IBGE)'),
                const SizedBox(height: 10),
                _label('Buscar município *'),
                TextFormField(
                  controller: _searchController,
                  focusNode: _searchFocus,
                  onChanged: _onSearchChanged,
                  validator: (v) => _selected == null ? 'Selecione um município' : null,
                  decoration: InputDecoration(
                    hintText: _loadingIbge ? 'Carregando base IBGE...' : 'Digite o nome da cidade...',
                    prefixIcon: _loadingIbge
                        ? const Padding(
                            padding: EdgeInsets.all(14),
                            child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                          )
                        : const Icon(LucideIcons.search, size: 16),
                    suffixIcon: _selected != null
                        ? IconButton(
                            icon: const Icon(Icons.close_rounded, size: 16),
                            onPressed: () => setState(() {
                              _selected = null;
                              _searchController.clear();
                              _suggestions = [];
                            }),
                          )
                        : null,
                  ),
                  enabled: !_loadingIbge,
                ),

                // Autocomplete dropdown
                if (_showSuggestions && _suggestions.isNotEmpty)
                  Container(
                    constraints: const BoxConstraints(maxHeight: 220),
                    margin: const EdgeInsets.only(top: 4),
                    decoration: BoxDecoration(
                      color: SaaSTokens.cardWhite,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: SaaSTokens.borderLight),
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 12, offset: const Offset(0, 4))],
                    ),
                    child: ListView.separated(
                      shrinkWrap: true,
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      itemCount: _suggestions.length,
                      separatorBuilder: (_, __) => const Divider(height: 1, indent: 12, endIndent: 12),
                      itemBuilder: (ctx, i) {
                        final m = _suggestions[i];
                        return ListTile(
                          dense: true,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 0),
                          leading: Container(
                            width: 32, height: 32,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: SaaSTokens.primaryLight,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(m.ufSigla, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: SaaSTokens.primary)),
                          ),
                          title: Text(m.nome, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                          subtitle: Text('${m.microrregiao} · ${m.mesorregiao}', style: const TextStyle(fontSize: 11, color: SaaSTokens.textDim)),
                          trailing: Text(m.id, style: const TextStyle(fontSize: 10, color: SaaSTokens.textDim)),
                          onTap: () => _selectMunicipio(m),
                        );
                      },
                    ),
                  ),

                // Selected info card
                if (_selected != null)
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: Row(children: [
                      const Icon(LucideIcons.circleCheck, size: 18, color: Color(0xFF16A34A)),
                      const SizedBox(width: 10),
                      Expanded(child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${_selected!.nome} / ${_selected!.ufSigla}', style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF15803D),
                          )),
                          const SizedBox(height: 2),
                          Text('IBGE: ${_selected!.id} · ${_selected!.microrregiao} · ${_selected!.uf}', style: const TextStyle(
                            fontSize: 11, color: Color(0xFF16A34A),
                          )),
                        ],
                      )),
                    ]),
                  ),
                const SizedBox(height: 12),

                // ── FUNDEB preview ──
                if (_loadingFundeb)
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: SaaSTokens.borderLight),
                    ),
                    child: Row(children: const [
                      SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                      SizedBox(width: 10),
                      Text('Carregando diagnóstico FUNDEB...', style: TextStyle(fontSize: 12, color: SaaSTokens.textMuted)),
                    ]),
                  ),
                if (_fundebError != null && !_loadingFundeb)
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7ED),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFED7AA)),
                    ),
                    child: Row(children: [
                      const Icon(LucideIcons.triangleAlert, size: 14, color: Color(0xFFF59E0B)),
                      const SizedBox(width: 8),
                      const Expanded(child: Text('Dados FUNDEB indisponíveis', style: TextStyle(fontSize: 12, color: Color(0xFFB45309)))),
                    ]),
                  ),
                if (_fundeb != null) _buildFundebPreview(),
                const SizedBox(height: 16),

                // ── Pipeline ──
                Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('Estágio inicial'),
                    DropdownButtonFormField<String>(
                      value: _stage,
                      isExpanded: true,
                      items: _stages.entries.map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value, style: const TextStyle(fontSize: 14))),
                      ).toList(),
                      onChanged: (v) => setState(() => _stage = v ?? _stage),
                      decoration: const InputDecoration(),
                    ),
                  ])),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('Parceiro responsável'),
                    DropdownButtonFormField<String>(
                      value: _collaboratorId,
                      isExpanded: true,
                      items: [
                        const DropdownMenuItem(value: null, child: Text('Nenhum', style: TextStyle(fontSize: 14, color: SaaSTokens.textMuted))),
                        ..._collaborators.map((c) =>
                          DropdownMenuItem(value: c.id, child: Text(c.fullName, style: const TextStyle(fontSize: 14), overflow: TextOverflow.ellipsis)),
                        ),
                      ],
                      onChanged: (v) => setState(() => _collaboratorId = v),
                      decoration: const InputDecoration(),
                    ),
                  ])),
                ]),
                const SizedBox(height: 20),

                // ── Contatos da Prefeitura ──
                _sectionTitle('Contatos da prefeitura'),
                const SizedBox(height: 10),
                _label('Prefeito(a)'),
                TextFormField(
                  controller: _mayor,
                  decoration: InputDecoration(
                    hintText: _loadingMayor ? 'Buscando prefeito...' : 'Ex: João Silva (PSD)',
                    prefixIcon: const Icon(LucideIcons.landmark, size: 16),
                    suffixIcon: _loadingMayor
                        ? const Padding(
                            padding: EdgeInsets.all(14),
                            child: SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                          )
                        : _mayor.text.isNotEmpty
                            ? const Icon(LucideIcons.circleCheck, size: 14, color: Color(0xFF16A34A))
                            : null,
                  ),
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('Secretário(a) de Educação'),
                    TextFormField(
                      controller: _secretary,
                      decoration: const InputDecoration(
                        hintText: 'Ex: Maria Santos',
                        prefixIcon: Icon(LucideIcons.graduationCap, size: 16),
                      ),
                    ),
                  ])),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('Responsável Licitação'),
                    TextFormField(
                      controller: _procurement,
                      decoration: const InputDecoration(
                        hintText: 'Ex: Dr. Pedro Lima',
                        prefixIcon: Icon(LucideIcons.scale, size: 16),
                      ),
                    ),
                  ])),
                ]),
                const SizedBox(height: 20),

                // ── Observações ──
                _label('Observações'),
                TextFormField(
                  controller: _notes,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    hintText: 'Como surgiu a indicação, contexto político...',
                  ),
                ),

                const SizedBox(height: 24),
                const Divider(height: 1, color: SaaSTokens.borderLight),
                const SizedBox(height: 18),

                // ── Ações ──
                Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                  OutlinedButton(
                    onPressed: _saving ? null : () => Navigator.pop(context),
                    child: const Text('Cancelar'),
                  ),
                  const SizedBox(width: 10),
                  FilledButton.icon(
                    onPressed: _saving ? null : _submit,
                    icon: _saving
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(LucideIcons.check, size: 16),
                    label: Text(_saving ? 'Salvando...' : 'Adicionar Cidade'),
                    style: FilledButton.styleFrom(
                      backgroundColor: SaaSTokens.primary,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ]),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _money(double v) {
    if (v >= 1000000) return 'R\$ ${(v / 1000000).toStringAsFixed(1)} mi';
    if (v >= 1000) return 'R\$ ${(v / 1000).toStringAsFixed(0)} mil';
    return 'R\$ ${v.toStringAsFixed(0)}';
  }

  Widget _buildFundebPreview() {
    final r = _fundeb!.relatorio;
    final rec = r.receitas;
    final proj = r.projecao;
    final censo = r.censoEscolar;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFF5F3FF), Color(0xFFEEF2FF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFDDD6FE)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(LucideIcons.graduationCap, size: 14, color: Color(0xFF7C3AED)),
          const SizedBox(width: 6),
          Text('DIAGNÓSTICO FUNDEB ${r.identificacao.exercicio}', style: const TextStyle(
            fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF7C3AED), letterSpacing: 0.8,
          )),
        ]),
        const SizedBox(height: 12),

        // KPI row
        Row(children: [
          _fundebMiniKpi('Receita', _money(rec.totalReceitas), const Color(0xFF3B82F6)),
          const SizedBox(width: 8),
          _fundebMiniKpi('Projeção', _money(proj.totalProjetado), const Color(0xFF8B5CF6)),
          const SizedBox(width: 8),
          _fundebMiniKpi('Ganho', _money(proj.totalGanho), const Color(0xFF10B981)),
          const SizedBox(width: 8),
          _fundebMiniKpi('Variação', '${(proj.ganhoPercentual * 100).toStringAsFixed(1)}%', const Color(0xFFF59E0B)),
        ]),

        if (censo != null) ...[
          const SizedBox(height: 10),
          const Divider(height: 1, color: Color(0xFFDDD6FE)),
          const SizedBox(height: 10),
          Row(children: [
            _censoChip(LucideIcons.school, '${censo.totalEscolas} escolas'),
            const SizedBox(width: 10),
            _censoChip(LucideIcons.users, '${_fmtInt(censo.totalMatriculas)} matrículas'),
            const SizedBox(width: 10),
            _censoChip(LucideIcons.bookOpen, '${_fmtInt(censo.totalDocentes)} docentes'),
          ]),
        ],

        // Complementações
        if (rec.complementacaoVAAF > 0 || rec.complementacaoVAAT > 0 || rec.complementacaoVAAR > 0) ...[
          const SizedBox(height: 10),
          Wrap(spacing: 8, runSpacing: 4, children: [
            if (rec.complementacaoVAAF > 0) _compChip('VAAF', _money(rec.complementacaoVAAF)),
            if (rec.complementacaoVAAT > 0) _compChip('VAAT', _money(rec.complementacaoVAAT)),
            if (rec.complementacaoVAAR > 0) _compChip('VAAR', _money(rec.complementacaoVAAR)),
          ]),
        ],
      ]),
    );
  }

  Widget _fundebMiniKpi(String label, String value, Color color) {
    return Expanded(child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.7),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 9, color: SaaSTokens.textDim)),
      ]),
    ));
  }

  Widget _censoChip(IconData icon, String label) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 11, color: const Color(0xFF7C3AED)),
      const SizedBox(width: 4),
      Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF6D28D9))),
    ]);
  }

  Widget _compChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.6),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text('$label: $value', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF7C3AED))),
    );
  }

  String _fmtInt(int v) {
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(1)}k';
    return v.toString();
  }

  Widget _sectionTitle(String text) => Row(children: [
    Text(text.toUpperCase(), style: const TextStyle(
      fontSize: 11, fontWeight: FontWeight.w700,
      color: SaaSTokens.textDim, letterSpacing: 0.8,
    )),
    const SizedBox(width: 10),
    const Expanded(child: Divider(height: 1, color: SaaSTokens.borderLight)),
  ]);

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(text, style: const TextStyle(
      fontSize: 12, fontWeight: FontWeight.w600,
      color: SaaSTokens.textMuted,
    )),
  );
}
