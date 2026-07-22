import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/repositories/mock_sync_repository.dart';
import '../../../core/theme/app_theme.dart';
import '../../shared/presentation/shared_widgets.dart';

class CollaboratorDetailScreen extends StatefulWidget {
  const CollaboratorDetailScreen({
    super.key,
    required this.collaboratorId,
    required this.repository,
  });

  final String collaboratorId;
  final SyncRepository repository;

  @override
  State<CollaboratorDetailScreen> createState() => _CollaboratorDetailScreenState();
}

class _CollaboratorDetailScreenState extends State<CollaboratorDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late Future<CollaboratorDetails> _detailsFuture;
  bool _isEditing = false;
  bool _saving = false;

  // Form Controllers
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _shortName = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _whatsapp = TextEditingController();
  final _cpfOrDocument = TextEditingController();
  final _city = TextEditingController();
  final _companyOrOrganization = TextEditingController();
  final _title = TextEditingController();
  final _primaryRole = TextEditingController();
  final _defaultCommissionPercent = TextEditingController();
  final _payoutCycle = TextEditingController();
  final _payoutMethod = TextEditingController();
  final _notes = TextEditingController();
  final _confidentialNotes = TextEditingController();

  String _state = '';
  String _collaboratorType = 'external_partner';
  String _partnershipStatus = 'active';
  int _trustLevel = 4;
  int _averageInfluenceScore = 7;
  String _defaultProfitBaseType = 'profit_base';
  String _defaultTriggerType = 'after_fidelization';

  static const _ufs = [
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
    'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
    'SP','SE','TO',
  ];

  static const _types = <String, String>{
    'internal_consultant': 'Consultor interno',
    'external_partner': 'Parceiro externo',
    'municipal_articulator': 'Articulador municipal',
    'introducer': 'Introducer',
    'strategic_advisor': 'Conselheiro estratégico',
    'implementation_support': 'Suporte de implantação',
    'executive_sponsor': 'Sponsor executivo',
    'hybrid': 'Híbrido',
  };

  static const _statuses = <String, String>{
    'active': 'Ativo',
    'prospect': 'Prospecção',
    'paused': 'Pausado',
    'blocked': 'Bloqueado',
    'inactive': 'Inativo',
  };

  static const _profitBases = <String, String>{
    'gross_revenue': 'Receita Bruta',
    'profit_base': 'Resultado Líquido',
    'base_margin': 'Margem Padrão',
  };

  static const _triggers = <String, String>{
    'on_receipt': 'No Recebimento',
    'contract_signed': 'Na Assinatura',
    'after_fidelization': 'Após Fidelização',
  };

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _loadDetails();
  }

  void _loadDetails() {
    setState(() {
      _detailsFuture = widget.repository.getCollaboratorDetails(widget.collaboratorId);
    });
    _detailsFuture.then((details) {
      _fullName.text = details.fullName;
      _shortName.text = details.shortName ?? '';
      _email.text = details.email ?? '';
      _phone.text = details.phone ?? '';
      _whatsapp.text = details.whatsapp ?? '';
      _cpfOrDocument.text = details.cpfOrDocument ?? '';
      _city.text = details.city ?? '';
      _companyOrOrganization.text = details.companyOrOrganization ?? '';
      _title.text = details.title ?? '';
      _primaryRole.text = details.primaryRole;
      _defaultCommissionPercent.text = details.defaultCommissionPercent.toString();
      _payoutCycle.text = details.payoutCycle ?? '';
      _payoutMethod.text = details.payoutMethod ?? '';
      _notes.text = details.notes ?? '';
      _confidentialNotes.text = details.confidentialNotes ?? '';

      _state = details.state ?? '';
      _collaboratorType = details.collaboratorType;
      _partnershipStatus = details.partnershipStatus;
      _trustLevel = details.trustLevel ?? 4;
      _averageInfluenceScore = details.averageInfluenceScore ?? 7;
      _defaultProfitBaseType = details.defaultProfitBaseType ?? 'profit_base';
      _defaultTriggerType = details.defaultTriggerType ?? 'after_fidelization';
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _tabController.dispose();
    _fullName.dispose();
    _shortName.dispose();
    _email.dispose();
    _phone.dispose();
    _whatsapp.dispose();
    _cpfOrDocument.dispose();
    _city.dispose();
    _companyOrOrganization.dispose();
    _title.dispose();
    _primaryRole.dispose();
    _defaultCommissionPercent.dispose();
    _payoutCycle.dispose();
    _payoutMethod.dispose();
    _notes.dispose();
    _confidentialNotes.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    try {
      final updatedData = <String, dynamic>{
        'fullName': _fullName.text.trim(),
        'shortName': _shortName.text.trim().isEmpty ? null : _shortName.text.trim(),
        'email': _email.text.trim().isEmpty ? null : _email.text.trim(),
        'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        'whatsapp': _whatsapp.text.trim().isEmpty ? null : _whatsapp.text.trim(),
        'cpfOrDocument': _cpfOrDocument.text.trim().isEmpty ? null : _cpfOrDocument.text.trim(),
        'city': _city.text.trim().isEmpty ? null : _city.text.trim(),
        'state': _state.isEmpty ? null : _state,
        'companyOrOrganization': _companyOrOrganization.text.trim().isEmpty ? null : _companyOrOrganization.text.trim(),
        'title': _title.text.trim().isEmpty ? null : _title.text.trim(),
        'collaboratorType': _collaboratorType,
        'primaryRole': _primaryRole.text.trim().isEmpty ? null : _primaryRole.text.trim(),
        'partnershipStatus': _partnershipStatus,
        'trustLevel': _trustLevel,
        'averageInfluenceScore': _averageInfluenceScore,
        'defaultCommissionPercent': double.tryParse(_defaultCommissionPercent.text) ?? 0.0,
        'defaultProfitBaseType': _defaultProfitBaseType,
        'defaultTriggerType': _defaultTriggerType,
        'payoutCycle': _payoutCycle.text.trim().isEmpty ? null : _payoutCycle.text.trim(),
        'payoutMethod': _payoutMethod.text.trim().isEmpty ? null : _payoutMethod.text.trim(),
        'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        'confidentialNotes': _confidentialNotes.text.trim().isEmpty ? null : _confidentialNotes.text.trim(),
      };

      await widget.repository.updateCollaboratorDetails(widget.collaboratorId, updatedData);
      setState(() {
        _isEditing = false;
        _loadDetails();
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Perfil atualizado com sucesso!'), backgroundColor: SaaSTokens.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao salvar: $e'), backgroundColor: SaaSTokens.error),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'active':
      case 'Ativo':
        return SyncPalette.statusActive;
      case 'prospect':
      case 'Prospecção':
        return SyncPalette.statusInfo;
      case 'paused':
      case 'Pausado':
        return SyncPalette.statusWarning;
      case 'blocked':
      case 'Bloqueado':
      case 'inactive':
      case 'Inativo':
        return SyncPalette.statusError;
      default:
        return SyncPalette.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SaaSTokens.scaffold,
      body: FutureBuilder<CollaboratorDetails>(
        future: _detailsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('Erro ao carregar detalhes: ${snapshot.error}', style: const TextStyle(color: SaaSTokens.textBody)),
                  const SizedBox(height: 12),
                  ElevatedButton(onPressed: _loadDetails, child: const Text('Recarregar')),
                ],
              ),
            );
          }

          final details = snapshot.data!;

          return Column(
            children: [
              // Header Area
              Container(
                color: SaaSTokens.cardWhite,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                child: Column(
                  children: [
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.arrow_back_rounded, color: SaaSTokens.textMuted),
                          onPressed: () => Navigator.of(context).pop(true),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            GestureDetector(
                              onTap: () => Navigator.of(context).pop(),
                              child: const Text('COLABORADORES', style: TextStyle(
                                fontSize: 11, fontWeight: FontWeight.w600,
                                color: SaaSTokens.textDim, letterSpacing: 1.0,
                              )),
                            ),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Text(details.fullName, style: const TextStyle(
                                  fontSize: 22, fontWeight: FontWeight.w700,
                                  color: SaaSTokens.textTitle, letterSpacing: -0.6,
                                )),
                                const SizedBox(width: 12),
                                StatusPill(
                                  label: _statuses[details.partnershipStatus] ?? details.partnershipStatus,
                                  color: _statusColor(details.partnershipStatus),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    // Tabs Header
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TabBar(
                        controller: _tabController,
                        isScrollable: true,
                        tabAlignment: TabAlignment.start,
                        indicatorColor: SaaSTokens.primary,
                        labelColor: SaaSTokens.primary,
                        unselectedLabelColor: SaaSTokens.textMuted,
                        labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                        unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
                        tabs: const [
                          Tab(text: 'Dados Pessoais'),
                          Tab(text: 'Documentos'),
                          Tab(text: 'Cidades Vinculadas'),
                          Tab(text: 'Comissões'),
                          Tab(text: 'Histórico'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: SaaSTokens.borderLight),
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildDadosTab(details),
                    _buildDocumentosTab(details),
                    _buildCidadesTab(details),
                    _buildComissoesTab(details),
                    _buildHistoricoTab(details),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildDadosTab(CollaboratorDetails details) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _sectionHeader('DADOS CADASTRAIS'),
                if (!_isEditing)
                  OutlinedButton.icon(
                    onPressed: () => setState(() => _isEditing = true),
                    icon: const Icon(Icons.edit_outlined, size: 14),
                    label: const Text('Editar Perfil'),
                  )
                else
                  Row(
                    children: [
                      OutlinedButton(
                        onPressed: () => setState(() => _isEditing = false),
                        child: const Text('Cancelar'),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: _saving ? null : _saveProfile,
                        style: FilledButton.styleFrom(backgroundColor: SaaSTokens.primary),
                        child: _saving
                            ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('Salvar'),
                      ),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 20),
            SyncSurfaceCard(
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(child: _buildFormField('Nome Completo', _fullName, required: true)),
                      const SizedBox(width: 16),
                      Expanded(child: _buildFormField('Nome Curto', _shortName)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(child: _buildFormField('E-mail', _email, keyboardType: TextInputType.emailAddress)),
                      const SizedBox(width: 16),
                      Expanded(child: _buildFormField('CPF ou CNPJ', _cpfOrDocument)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(child: _buildFormField('Telefone', _phone, keyboardType: TextInputType.phone)),
                      const SizedBox(width: 16),
                      Expanded(child: _buildFormField('WhatsApp', _whatsapp, keyboardType: TextInputType.phone)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(child: _buildFormField('Cidade', _city)),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _buildDropdownField<String>(
                          'Estado (UF)',
                          value: _state.isEmpty ? null : _state,
                          items: _ufs.map((uf) => DropdownMenuItem(value: uf, child: Text(uf))).toList(),
                          onChanged: _isEditing ? (v) => setState(() => _state = v ?? '') : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(child: _buildFormField('Empresa / Organização', _companyOrOrganization)),
                      const SizedBox(width: 16),
                      Expanded(child: _buildFormField('Cargo / Título', _title)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            _sectionHeader('DADOS PROFISSIONAIS'),
            const SizedBox(height: 20),
            SyncSurfaceCard(
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _buildDropdownField<String>(
                          'Tipo de Colaborador',
                          value: _collaboratorType,
                          items: _types.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
                          onChanged: _isEditing ? (v) => setState(() => _collaboratorType = v ?? _collaboratorType) : null,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(child: _buildFormField('Papel Principal', _primaryRole)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildDropdownField<String>(
                          'Status de Parceria',
                          value: _partnershipStatus,
                          items: _statuses.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
                          onChanged: _isEditing ? (v) => setState(() => _partnershipStatus = v ?? _partnershipStatus) : null,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _buildDropdownField<int>(
                          'Nível de Confiança',
                          value: _trustLevel,
                          items: List.generate(5, (i) => DropdownMenuItem(value: i + 1, child: Text('⭐' * (i + 1)))).toList(),
                          onChanged: _isEditing ? (v) => setState(() => _trustLevel = v ?? _trustLevel) : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildDropdownField<int>(
                          'Score de Influência (1-10)',
                          value: _averageInfluenceScore,
                          items: List.generate(10, (i) => DropdownMenuItem(value: i + 1, child: Text('${i + 1} / 10'))).toList(),
                          onChanged: _isEditing ? (v) => setState(() => _averageInfluenceScore = v ?? _averageInfluenceScore) : null,
                        ),
                      ),
                      const SizedBox(width: 16),
                      const Spacer(),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            _sectionHeader('REGRAS FINANCEIRAS PADRÃO'),
            const SizedBox(height: 20),
            SyncSurfaceCard(
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(child: _buildFormField('Comissão Padrão (%)', _defaultCommissionPercent, keyboardType: const TextInputType.numberWithOptions(decimal: true))),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _buildDropdownField<String>(
                          'Base de Cálculo',
                          value: _defaultProfitBaseType,
                          items: _profitBases.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
                          onChanged: _isEditing ? (v) => setState(() => _defaultProfitBaseType = v ?? _defaultProfitBaseType) : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildDropdownField<String>(
                          'Gatilho de Comissão',
                          value: _defaultTriggerType,
                          items: _triggers.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
                          onChanged: _isEditing ? (v) => setState(() => _defaultTriggerType = v ?? _defaultTriggerType) : null,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(child: _buildFormField('Ciclo de Pagamento', _payoutCycle)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(child: _buildFormField('Método de Pagamento', _payoutMethod)),
                      const SizedBox(width: 16),
                      const Spacer(),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            _sectionHeader('OBSERVAÇÕES'),
            const SizedBox(height: 20),
            SyncSurfaceCard(
              child: Column(
                children: [
                  _buildFormField('Notas Gerais', _notes, maxLines: 3),
                  const SizedBox(height: 16),
                  _buildFormField('Notas Confidenciais (Apenas ADM)', _confidentialNotes, maxLines: 3),
                ],
              ),
            ),
            if (_isEditing) ...[
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  OutlinedButton(
                    onPressed: () => setState(() => _isEditing = false),
                    child: const Text('Cancelar'),
                  ),
                  const SizedBox(width: 12),
                  FilledButton(
                    onPressed: _saving ? null : _saveProfile,
                    style: FilledButton.styleFrom(backgroundColor: SaaSTokens.primary),
                    child: _saving
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Salvar'),
                  ),
                ],
              ),
            ]
          ],
        ),
      ),
    );
  }

  Widget _buildFormField(String label, TextEditingController controller, {bool required = false, int maxLines = 1, TextInputType? keyboardType}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: SaaSTokens.textMuted)),
        ),
        TextFormField(
          controller: controller,
          enabled: _isEditing,
          maxLines: maxLines,
          keyboardType: keyboardType,
          validator: required ? (v) => (v ?? '').isEmpty ? 'Campo obrigatório' : null : null,
          decoration: InputDecoration(
            filled: !_isEditing,
            fillColor: _isEditing ? Colors.transparent : SaaSTokens.scaffold,
            hintText: 'Não informado',
          ),
        ),
      ],
    );
  }

  Widget _buildDropdownField<T>(String label, {required T? value, required List<DropdownMenuItem<T>> items, required void Function(T?)? onChanged}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: SaaSTokens.textMuted)),
        ),
        DropdownButtonFormField<T>(
          value: value,
          items: items,
          onChanged: onChanged,
          isExpanded: true,
          decoration: InputDecoration(
            filled: onChanged == null,
            fillColor: onChanged != null ? Colors.transparent : SaaSTokens.scaffold,
          ),
        ),
      ],
    );
  }

  Widget _sectionHeader(String title) {
    return Row(
      children: [
        Text(title, style: const TextStyle(
          fontSize: 12, fontWeight: FontWeight.w700,
          color: SaaSTokens.textDim, letterSpacing: 0.8,
        )),
        const SizedBox(width: 10),
        const Expanded(child: Divider(color: SaaSTokens.borderLight)),
      ],
    );
  }

  // ── Tab 2: Documentos ──

  Widget _buildDocumentosTab(CollaboratorDetails details) {
    final docs = details.documents;
    final habilitatorios = docs.where((d) => [
      'habilitacao_fiscal',
      'habilitacao_juridica',
      'habilitacao_tecnica'
    ].contains(d.category)).toList();
    final gerais = docs.where((d) => ![
      'habilitacao_fiscal',
      'habilitacao_juridica',
      'habilitacao_tecnica'
    ].contains(d.category)).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Documentação Legal e Pessoal', style: TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w600, color: SaaSTokens.textTitle,
                  )),
                  const SizedBox(height: 4),
                  Text(
                    '${habilitatorios.length} documentos habilitatórios de kit FUNDEB vinculados.',
                    style: const TextStyle(fontSize: 13, color: SaaSTokens.textMuted),
                  ),
                ],
              ),
              FilledButton.icon(
                onPressed: () => _showUploadDialog(details),
                icon: const Icon(LucideIcons.upload, size: 14),
                label: const Text('Anexar Documento'),
                style: FilledButton.styleFrom(backgroundColor: SaaSTokens.primary),
              ),
            ],
          ),
          const SizedBox(height: 24),
          _sectionHeader('DOCUMENTOS HABILITATÓRIOS (VINCULADOS AO KIT FUNDEB)'),
          const SizedBox(height: 12),
          if (habilitatorios.isEmpty)
            _emptyDocumentsCard('Nenhum documento habilitatório anexado.')
          else
            _buildDocsList(habilitatorios),
          const SizedBox(height: 24),
          _sectionHeader('DOCUMENTOS GERAIS'),
          const SizedBox(height: 12),
          if (gerais.isEmpty)
            _emptyDocumentsCard('Nenhum documento geral anexado.')
          else
            _buildDocsList(gerais),
        ],
      ),
    );
  }

  Widget _emptyDocumentsCard(String message) {
    return SyncSurfaceCard(
      padding: const EdgeInsets.all(32),
      child: Center(
        child: Column(
          children: [
            const Icon(LucideIcons.files, size: 32, color: SaaSTokens.textDim),
            const SizedBox(height: 8),
            Text(message, style: const TextStyle(fontSize: 13, color: SaaSTokens.textMuted)),
          ],
        ),
      ),
    );
  }

  Widget _buildDocsList(List<CollaboratorDocument> list) {
    return Column(
      children: list.map((doc) {
        final hasExpiry = doc.expiresAt != null && doc.expiresAt!.isNotEmpty;
        final isExpired = hasExpiry && DateTime.parse(doc.expiresAt!).isBefore(DateTime.now());
        final isExpiring = hasExpiry && !isExpired && DateTime.parse(doc.expiresAt!).difference(DateTime.now()).inDays < 30;

        Widget statusIndicator;
        if (isExpired) {
          statusIndicator = StatusPill(label: 'Vencido', color: SyncPalette.statusError);
        } else if (isExpiring) {
          statusIndicator = StatusPill(label: 'Vencendo', color: SyncPalette.statusWarning);
        } else if (hasExpiry) {
          statusIndicator = StatusPill(label: 'Válido', color: SyncPalette.statusActive);
        } else {
          statusIndicator = StatusPill(label: 'Sem validade', color: SyncPalette.textSecondary);
        }

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: SaaSTokens.cardWhite,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: SaaSTokens.borderLight),
          ),
          child: Row(
            children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: SaaSTokens.scaffold,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(LucideIcons.fileText, color: SaaSTokens.primary),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(doc.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: SaaSTokens.textTitle)),
                    const SizedBox(height: 3),
                    Text(
                      'Original: ${doc.fileName} • ${doc.fileSize != null ? (doc.fileSize! / 1024).toStringAsFixed(1) + ' KB' : 'Tamanho desconhecido'}',
                      style: const TextStyle(fontSize: 12, color: SaaSTokens.textMuted),
                    ),
                    if (doc.notes != null && doc.notes!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text('Observações: ${doc.notes}', style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: SaaSTokens.textDim)),
                    ]
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  statusIndicator,
                  if (hasExpiry) ...[
                    const SizedBox(height: 4),
                    Text('Vencimento: ${doc.expiresAt}', style: const TextStyle(fontSize: 11, color: SaaSTokens.textDim)),
                  ]
                ],
              ),
              const SizedBox(width: 16),
              Row(
                children: [
                  IconButton(
                    icon: const Icon(LucideIcons.download, size: 16),
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Iniciando download de ${doc.fileName}...')),
                      );
                    },
                    tooltip: 'Baixar Documento',
                  ),
                  IconButton(
                    icon: const Icon(LucideIcons.trash2, size: 16, color: SaaSTokens.error),
                    onPressed: () => _confirmDeleteDocument(doc),
                    tooltip: 'Excluir',
                  ),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  void _showUploadDialog(CollaboratorDetails details) {
    showDialog(
      context: context,
      builder: (context) {
        return _UploadDocDialog(
          collaboratorId: details.id,
          repository: widget.repository,
          onSuccess: () {
            Navigator.pop(context);
            _loadDetails();
          },
        );
      },
    );
  }

  void _confirmDeleteDocument(CollaboratorDocument doc) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Excluir Documento'),
          content: Text('Tem certeza que deseja excluir o documento "${doc.name}"? Esta ação não pode ser desfeita.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: SaaSTokens.error),
              onPressed: () async {
                Navigator.pop(context);
                try {
                  await widget.repository.deleteCollaboratorDocument(widget.collaboratorId, doc.id);
                  _loadDetails();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Documento excluído com sucesso!')),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Erro ao excluir: $e'), backgroundColor: SaaSTokens.error),
                    );
                  }
                }
              },
              child: const Text('Excluir'),
            ),
          ],
        );
      },
    );
  }

  // ── Tab 3: Cidades Vinculadas ──

  Widget _buildCidadesTab(CollaboratorDetails details) {
    // If it's Rafael Costa, mock 3 active cities, else 1
    final List<Map<String, dynamic>> mockCities = details.fullName.contains('Rafael')
        ? [
            {'name': 'Arapiraca', 'uf': 'AL', 'stage': 'technical_diagnosis', 'revenue': 180000.0, 'profit': 60000.0, 'prob': 0.70},
            {'name': 'Palmeira', 'uf': 'PR', 'stage': 'proposal_presented', 'revenue': 96000.0, 'profit': 32000.0, 'prob': 0.50},
            {'name': 'Mirandópolis', 'uf': 'SP', 'stage': 'contractual', 'revenue': 144000.0, 'profit': 48000.0, 'prob': 0.90},
          ]
        : [
            {'name': 'Serra do Ramalho', 'uf': 'BA', 'stage': 'implementation', 'revenue': 520000.0, 'profit': 196000.0, 'prob': 0.95},
          ];

    double totalRevenue = mockCities.fold(0, (sum, c) => sum + (c['revenue'] as double));
    double totalProfit = mockCities.fold(0, (sum, c) => sum + (c['profit'] as double));
    double totalCommission = totalProfit * (details.defaultCommissionPercent / 100);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: SyncMetricCard(
                  label: 'RECEITA ANUAL PROJETADA',
                  value: 'R\$ ${(totalRevenue / 1000).toStringAsFixed(0)} mil',
                  helper: 'Soma dos contratos ativos/propostas',
                  icon: LucideIcons.trendingUp,
                  color: SyncPalette.statusInfo,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: SyncMetricCard(
                  label: 'LUCRO ANUAL ESTIMADO',
                  value: 'R\$ ${(totalProfit / 1000).toStringAsFixed(0)} mil',
                  helper: 'Resultado líquido estimado',
                  icon: LucideIcons.dollarSign,
                  color: SyncPalette.statusActive,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: SyncMetricCard(
                  label: 'COMISSÃO ANUAL ESTIMADA',
                  value: 'R\$ ${(totalCommission / 1000).toStringAsFixed(1)} mil',
                  helper: 'Baseada na taxa de ${details.defaultCommissionPercent}%',
                  icon: LucideIcons.percent,
                  color: SyncPalette.statusPurple,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          _sectionHeader('CIDADES VINCULADAS AO PROJETO'),
          const SizedBox(height: 12),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: mockCities.length,
            itemBuilder: (context, idx) {
              final city = mockCities[idx];
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: SaaSTokens.cardWhite,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: SaaSTokens.borderLight),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40, height: 40,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: SaaSTokens.scaffold,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(LucideIcons.mapPin, color: SaaSTokens.primaryDim),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${city['name']} / ${city['uf']}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: SaaSTokens.textTitle)),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Text('Receita: R\$ ${(city['revenue'] / 1000).toStringAsFixed(0)}k/ano', style: const TextStyle(fontSize: 12, color: SaaSTokens.textMuted)),
                              const SizedBox(width: 12),
                              Text('Resultado: R\$ ${(city['profit'] / 1000).toStringAsFixed(0)}k/ano', style: const TextStyle(fontSize: 12, color: SaaSTokens.textMuted)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('Estágio: ${_stageLabel(city['stage'])}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: SaaSTokens.textTitle)),
                        const SizedBox(height: 4),
                        Text('Probabilidade: ${(city['prob'] * 100).toStringAsFixed(0)}%', style: const TextStyle(fontSize: 11, color: SaaSTokens.textDim)),
                      ],
                    ),
                    const SizedBox(width: 24),
                    OutlinedButton(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Navegando para o Plano de Ação de ${city['name']}...')),
                        );
                      },
                      child: const Text('Plano de Ação'),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  String _stageLabel(String stage) {
    switch (stage) {
      case 'technical_diagnosis':
        return 'Diagnóstico Técnico';
      case 'proposal_presented':
        return 'Proposta Apresentada';
      case 'contractual':
        return 'Contratual';
      case 'implementation':
        return 'Implantação';
      default:
        return stage;
    }
  }

  // ── Tab 4: Comissões ──

  Widget _buildComissoesTab(CollaboratorDetails details) {
    final isRafael = details.fullName.contains('Rafael');
    final mockRules = isRafael
        ? [
            'Arapiraca/AL: ${details.defaultCommissionPercent}% sobre o Resultado Líquido, pagos no recebimento.',
            'Palmeira/PR: 3.0% sobre a Receita Bruta, pagos após assinatura do contrato.',
            'Mirandópolis/SP: 5.0% fixos sobre lucro líquido, pagos mensalmente.',
          ]
        : [
            'Serra do Ramalho/BA: ${details.defaultCommissionPercent}% sobre o Resultado Líquido, pagos após fidelização.'
          ];

    final mockAccruals = [
      {'period': '06/2026', 'amount': 2400.0, 'status': 'Calculado'},
      {'period': '05/2026', 'amount': 2100.0, 'status': 'Aprovado'},
      {'period': '04/2026', 'amount': 1800.0, 'status': 'Pago'},
      {'period': '03/2026', 'amount': 1800.0, 'status': 'Pago'},
    ];

    double totalAccrued = mockAccruals.fold(0, (sum, a) => sum + (a['amount'] as double));
    double totalPaid = mockAccruals.where((a) => a['status'] == 'Pago').fold(0, (sum, a) => sum + (a['amount'] as double));
    double totalPending = totalAccrued - totalPaid;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: SyncMetricCard(
                  label: 'TOTAL ACUMULADO (YTD)',
                  value: 'R\$ ${totalAccrued.toStringAsFixed(2)}',
                  helper: 'Acumulado no ano de 2026',
                  icon: LucideIcons.badgeDollarSign,
                  color: SyncPalette.statusWarning,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: SyncMetricCard(
                  label: 'TOTAL PAGO (YTD)',
                  value: 'R\$ ${totalPaid.toStringAsFixed(2)}',
                  helper: 'Valores compensados e liquidados',
                  icon: Icons.check_box_outlined,
                  color: SyncPalette.statusActive,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: SyncMetricCard(
                  label: 'VALOR A PAGAR / PROJETADO',
                  value: 'R\$ ${totalPending.toStringAsFixed(2)}',
                  helper: 'Calculado + Aprovado pendente',
                  icon: LucideIcons.wallet,
                  color: SyncPalette.statusPurple,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          _sectionHeader('REGRAS ATIVAS DE COMISSÃO'),
          const SizedBox(height: 12),
          SyncSurfaceCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: mockRules.map((rule) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle_outline_rounded, color: SaaSTokens.success, size: 16),
                      const SizedBox(width: 10),
                      Expanded(child: Text(rule, style: const TextStyle(fontSize: 13, color: SaaSTokens.textTitle))),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('LANÇAMENTOS DE COMISSÃO', style: TextStyle(
                fontSize: 12, fontWeight: FontWeight.w700,
                color: SaaSTokens.textDim, letterSpacing: 0.8,
              )),
              FilledButton.tonal(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Geração de pagamento para aprovação financeira...')),
                  );
                },
                child: const Text('Solicitar Payout'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: mockAccruals.length,
            itemBuilder: (context, idx) {
              final acc = mockAccruals[idx];
              Color pillColor;
              switch (acc['status']) {
                case 'Pago':
                  pillColor = SyncPalette.statusActive;
                  break;
                case 'Aprovado':
                  pillColor = SyncPalette.statusInfo;
                  break;
                default:
                  pillColor = SyncPalette.statusWarning;
              }

              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: SaaSTokens.cardWhite,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: SaaSTokens.borderLight),
                ),
                child: Row(
                  children: [
                    const Icon(LucideIcons.banknote, color: SaaSTokens.textMuted),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        'Referência: ${acc['period']} — Lançamento operacional',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: SaaSTokens.textTitle),
                      ),
                    ),
                    Text(
                      'R\$ ${(acc['amount'] as double).toStringAsFixed(2)}',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: SaaSTokens.textTitle),
                    ),
                    const SizedBox(width: 24),
                    StatusPill(label: acc['status'] as String, color: pillColor),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  // ── Tab 5: Histórico (Timeline) ──

  Widget _buildHistoricoTab(CollaboratorDetails details) {
    final List<Map<String, dynamic>> mockHistory = [
      {'date': '2026-06-28 14:12', 'action': 'Atualização dos dados bancários (PIX cadastrado).', 'user': 'Adriel Tavares'},
      {'date': '2026-06-27 10:05', 'action': 'Upload do arquivo de RG e CPF realizado.', 'user': 'Adriel Tavares'},
      {'date': '2026-06-25 09:30', 'action': 'Adicionado como colaborador na cidade de Palmeira/PR.', 'user': 'Rafael Costa'},
      {'date': '2026-06-15 11:22', 'action': 'Cadastro inicial de perfil de colaborador criado.', 'user': 'Adriel Tavares'},
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Atividades Recentes', style: TextStyle(
            fontSize: 16, fontWeight: FontWeight.w600, color: SaaSTokens.textTitle,
          )),
          const SizedBox(height: 18),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: mockHistory.length,
            itemBuilder: (context, idx) {
              final hist = mockHistory[idx];
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Column(
                    children: [
                      Container(
                        width: 12, height: 12,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: SaaSTokens.primary,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                      ),
                      if (idx < mockHistory.length - 1)
                        Container(
                          width: 2, height: 60,
                          color: SaaSTokens.borderLight,
                        ),
                    ],
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(hist['action'] as String, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: SaaSTokens.textTitle)),
                        const SizedBox(height: 4),
                        Text(
                          'Executado em ${hist['date']} por ${hist['user']}',
                          style: const TextStyle(fontSize: 11, color: SaaSTokens.textMuted),
                        ),
                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

// ── Upload Document dialog ──

class _UploadDocDialog extends StatefulWidget {
  const _UploadDocDialog({
    required this.collaboratorId,
    required this.repository,
    required this.onSuccess,
  });

  final String collaboratorId;
  final SyncRepository repository;
  final VoidCallback onSuccess;

  @override
  State<_UploadDocDialog> createState() => _UploadDocDialogState();
}

class _UploadDocDialogState extends State<_UploadDocDialog> {
  final _formKey = GlobalKey<FormState>();
  bool _saving = false;

  final _name = TextEditingController();
  final _fileName = TextEditingController(text: 'cnd_federal_2026.pdf');
  final _notes = TextEditingController();
  final _issuedAt = TextEditingController(text: '2026-01-15');
  final _expiresAt = TextEditingController(text: '2026-07-15');

  String _category = 'habilitacao_fiscal';
  String _documentType = 'cnd_federal';

  static const _categories = <String, String>{
    'habilitacao_fiscal': 'Habilitação Fiscal',
    'habilitacao_juridica': 'Habilitação Jurídica',
    'habilitacao_tecnica': 'Habilitação Técnica',
    'pessoal': 'Pessoal',
    'contratual': 'Contratual',
    'financeiro': 'Financeiro',
  };

  static const _docTypes = <String, String>{
    'cnd_federal': 'CND Federal',
    'cnd_estadual': 'CND Estadual',
    'cnd_municipal': 'CND Municipal',
    'fgts': 'FGTS',
    'contrato_social': 'Contrato Social',
    'procuracao': 'Procuração',
    'alvara': 'Alvará de Funcionamento',
    'balanco': 'Balanço Patrimonial',
    'atestado': 'Atestado de Cap. Técnica',
    'rg_cpf': 'RG / CPF',
    'comprovante_endereco': 'Comprovante de Endereço',
    'contrato_parceria': 'Contrato de Parceria',
    'recibo': 'Recibo de Pagamento',
  };

  @override
  void dispose() {
    _name.dispose();
    _fileName.dispose();
    _notes.dispose();
    _issuedAt.dispose();
    _expiresAt.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    try {
      final bytes = Uint8List.fromList([1, 2, 3, 4, 5]); // Mock PDF bytes

      await widget.repository.uploadCollaboratorDocument(
        id: widget.collaboratorId,
        category: _category,
        documentType: _documentType,
        name: _name.text.trim().isEmpty ? _docTypes[_documentType]! : _name.text.trim(),
        fileName: _fileName.text.trim(),
        fileBytes: bytes,
        issuedAt: _issuedAt.text.trim().isEmpty ? null : _issuedAt.text.trim(),
        expiresAt: _expiresAt.text.trim().isEmpty ? null : _expiresAt.text.trim(),
        notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      );

      widget.onSuccess();
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
        constraints: const BoxConstraints(maxWidth: 520),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  children: [
                    Container(
                      width: 42, height: 42,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: SaaSTokens.primaryLight,
                        borderRadius: BorderRadius.circular(11),
                      ),
                      child: const Icon(LucideIcons.filePlus, size: 20, color: SaaSTokens.primary),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text('Anexar Documento', style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w700,
                            color: SaaSTokens.textTitle, letterSpacing: -0.3,
                          )),
                          SizedBox(height: 2),
                          Text('Adicione certidões, contratos ou comprovantes.', style: TextStyle(
                            fontSize: 13, color: SaaSTokens.textMuted,
                          )),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const Divider(height: 1, color: SaaSTokens.borderLight),
                const SizedBox(height: 20),

                // Form fields
                _label('Categoria do Documento'),
                DropdownButtonFormField<String>(
                  value: _category,
                  items: _categories.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
                  onChanged: (v) => setState(() => _category = v ?? _category),
                ),
                const SizedBox(height: 16),

                _label('Tipo de Documento'),
                DropdownButtonFormField<String>(
                  value: _documentType,
                  items: _docTypes.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
                  onChanged: (v) => setState(() => _documentType = v ?? _documentType),
                ),
                const SizedBox(height: 16),

                _label('Nome de Exibição (Opcional)'),
                TextFormField(
                  controller: _name,
                  decoration: const InputDecoration(hintText: 'Ex: Certidão Negativa Federal'),
                ),
                const SizedBox(height: 16),

                _label('Nome do Arquivo'),
                TextFormField(
                  controller: _fileName,
                  decoration: const InputDecoration(hintText: 'documento.pdf'),
                ),
                const SizedBox(height: 16),

                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _label('Data de Emissão (AAAA-MM-DD)'),
                          TextFormField(
                            controller: _issuedAt,
                            decoration: const InputDecoration(hintText: 'AAAA-MM-DD'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _label('Data de Validade (AAAA-MM-DD)'),
                          TextFormField(
                            controller: _expiresAt,
                            decoration: const InputDecoration(hintText: 'AAAA-MM-DD'),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                _label('Observações'),
                TextFormField(
                  controller: _notes,
                  maxLines: 2,
                  decoration: const InputDecoration(hintText: 'Notas ou observações adicionais...'),
                ),
                const SizedBox(height: 24),
                const Divider(height: 1, color: SaaSTokens.borderLight),
                const SizedBox(height: 20),

                // Actions
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    OutlinedButton(
                      onPressed: _saving ? null : () => Navigator.pop(context),
                      child: const Text('Cancelar'),
                    ),
                    const SizedBox(width: 12),
                    FilledButton.icon(
                      onPressed: _saving ? null : _submit,
                      icon: _saving
                          ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(LucideIcons.check, size: 16),
                      label: Text(_saving ? 'Salvando...' : 'Salvar Documento'),
                      style: FilledButton.styleFrom(backgroundColor: SaaSTokens.primary),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _label(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: SaaSTokens.textMuted)),
    );
  }
}
