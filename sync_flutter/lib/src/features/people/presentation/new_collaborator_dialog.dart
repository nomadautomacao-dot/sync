import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/repositories/sync_repository.dart';
import '../../../core/theme/app_theme.dart';

/// Dialog para cadastro de novo colaborador via POST /api/collaborators
class NewCollaboratorDialog extends StatefulWidget {
  const NewCollaboratorDialog({super.key, required this.repository});
  final SyncRepository repository;

  @override
  State<NewCollaboratorDialog> createState() => _NewCollaboratorDialogState();
}

class _NewCollaboratorDialogState extends State<NewCollaboratorDialog> {
  final _formKey = GlobalKey<FormState>();
  bool _saving = false;

  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _city = TextEditingController();
  final _role = TextEditingController();
  final _notes = TextEditingController();
  String _state = '';
  String _type = 'external_partner';
  String _status = 'prospecting';

  static const _types = <String, String>{
    'external_partner': 'Parceiro Externo',
    'municipal_articulator': 'Articulador Municipal',
    'implementation_support': 'Implantação',
    'political_advisor': 'Assessor Político',
    'internal_team': 'Equipe Interna',
  };

  static const _statuses = <String, String>{
    'prospecting': 'Prospecção',
    'active': 'Ativo',
    'inactive': 'Inativo',
  };

  static const _ufs = [
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
    'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
    'SP','SE','TO',
  ];

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _city.dispose();
    _role.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    try {
      await widget.repository.createCollaborator({
        'fullName': _name.text.trim(),
        'email': _email.text.trim().isEmpty ? null : _email.text.trim(),
        'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        'whatsapp': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        'city': _city.text.trim().isEmpty ? null : _city.text.trim(),
        'state': _state.isEmpty ? null : _state,
        'primaryState': _state.isEmpty ? null : _state,
        'collaboratorType': _type,
        'primaryRole': _role.text.trim().isEmpty ? _types[_type] : _role.text.trim(),
        'partnershipStatus': _status,
        'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        'defaultCommissionPercent': 0,
        'defaultProfitBaseType': 'gross_revenue',
        'defaultTriggerType': 'contract_signed',
        'payoutCycle': 'monthly',
        'payoutMethod': 'bank_transfer',
      });
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
        constraints: const BoxConstraints(maxWidth: 520),
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
                      color: SaaSTokens.primaryLight,
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: const Icon(LucideIcons.userPlus, size: 20, color: SaaSTokens.primary),
                  ),
                  const SizedBox(width: 14),
                  Expanded(child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text('Novo Colaborador', style: TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w700,
                        color: SaaSTokens.textTitle, letterSpacing: -0.3,
                      )),
                      SizedBox(height: 2),
                      Text('Cadastrar parceiro ou articulador na rede.', style: TextStyle(
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

                // ── Identificação ──
                _sectionTitle('Identificação'),
                const SizedBox(height: 10),
                _label('Nome completo *'),
                TextFormField(
                  controller: _name,
                  validator: (v) => (v ?? '').trim().length < 3 ? 'Mínimo 3 caracteres' : null,
                  decoration: const InputDecoration(
                    hintText: 'Ex: Luciana Ferreira da Silva',
                    prefixIcon: Icon(LucideIcons.user, size: 16),
                  ),
                ),
                const SizedBox(height: 12),

                Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('Tipo *'),
                    DropdownButtonFormField<String>(
                      value: _type,
                      isExpanded: true,
                      items: _types.entries.map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value, style: const TextStyle(fontSize: 14))),
                      ).toList(),
                      onChanged: (v) => setState(() => _type = v ?? _type),
                      decoration: const InputDecoration(),
                    ),
                  ])),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('Status'),
                    DropdownButtonFormField<String>(
                      value: _status,
                      isExpanded: true,
                      items: _statuses.entries.map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value, style: const TextStyle(fontSize: 14))),
                      ).toList(),
                      onChanged: (v) => setState(() => _status = v ?? _status),
                      decoration: const InputDecoration(),
                    ),
                  ])),
                ]),
                const SizedBox(height: 12),

                _label('Papel / Função'),
                TextFormField(
                  controller: _role,
                  decoration: const InputDecoration(
                    hintText: 'Ex: Advogado, Articulador, Captação territorial',
                    prefixIcon: Icon(LucideIcons.briefcase, size: 16),
                  ),
                ),
                const SizedBox(height: 20),

                // ── Contato ──
                _sectionTitle('Contato'),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('Telefone / WhatsApp'),
                    TextFormField(
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        hintText: '(99) 99999-0000',
                        prefixIcon: Icon(LucideIcons.phone, size: 16),
                      ),
                    ),
                  ])),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('E-mail'),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        hintText: 'email@exemplo.com',
                        prefixIcon: Icon(LucideIcons.mail, size: 16),
                      ),
                    ),
                  ])),
                ]),
                const SizedBox(height: 20),

                // ── Localização ──
                _sectionTitle('Localização'),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(flex: 2, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('Cidade'),
                    TextFormField(
                      controller: _city,
                      decoration: const InputDecoration(
                        hintText: 'Ex: Belém',
                        prefixIcon: Icon(LucideIcons.mapPin, size: 16),
                      ),
                    ),
                  ])),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('UF'),
                    DropdownButtonFormField<String>(
                      value: _state.isEmpty ? null : _state,
                      items: _ufs.map((uf) => DropdownMenuItem(value: uf, child: Text(uf))).toList(),
                      onChanged: (v) => setState(() => _state = v ?? ''),
                      decoration: const InputDecoration(hintText: 'UF'),
                    ),
                  ])),
                ]),
                const SizedBox(height: 20),

                // ── Observações ──
                _label('Observações'),
                TextFormField(
                  controller: _notes,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    hintText: 'Anotações sobre este colaborador...',
                    prefixIcon: Padding(
                      padding: EdgeInsets.only(bottom: 40),
                      child: Icon(LucideIcons.stickyNote, size: 16),
                    ),
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
                    label: Text(_saving ? 'Salvando...' : 'Criar Colaborador'),
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
