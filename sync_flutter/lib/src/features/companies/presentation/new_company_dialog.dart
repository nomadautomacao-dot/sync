import 'package:flutter/material.dart';

import '../../../core/repositories/sync_repository.dart';
import '../../../core/theme/app_theme.dart';

class NewCompanyDialog extends StatefulWidget {
  const NewCompanyDialog({super.key, required this.repository});

  final SyncRepository repository;

  @override
  State<NewCompanyDialog> createState() => _NewCompanyDialogState();
}

class _NewCompanyDialogState extends State<NewCompanyDialog> {
  final _name = TextEditingController();
  final _trading = TextEditingController();
  final _cnpj = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _contactName = TextEditingController();
  final _contactPosition = TextEditingController();
  String _segment = 'consultoria';
  bool _saving = false;
  String? _error;

  static const _segments = {
    'consultoria': 'Consultoria',
    'terceirizacao': 'Terceirizacao',
    'formacao': 'Formacao',
    'tecnologia': 'Tecnologia',
    'assessoria': 'Assessoria',
    'outro': 'Outro',
  };

  @override
  void dispose() {
    for (final c in [
      _name, _trading, _cnpj, _city, _state, _email, _phone,
      _contactName, _contactPosition,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _valid =>
      _name.text.trim().isNotEmpty &&
      _trading.text.trim().isNotEmpty &&
      _cnpj.text.trim().isNotEmpty &&
      _city.text.trim().isNotEmpty &&
      _state.text.trim().isNotEmpty &&
      _email.text.trim().isNotEmpty &&
      _phone.text.trim().isNotEmpty &&
      _contactName.text.trim().isNotEmpty &&
      _contactPosition.text.trim().isNotEmpty;

  Future<void> _submit() async {
    if (!_valid) {
      setState(() => _error = 'Preencha todos os campos obrigatorios.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.repository.createCompany({
        'name': _name.text.trim(),
        'tradingName': _trading.text.trim(),
        'cnpj': _cnpj.text.trim(),
        'segment': _segment,
        'city': _city.text.trim(),
        'state': _state.text.trim().toUpperCase(),
        'email': _email.text.trim(),
        'phone': _phone.text.trim(),
        'contactName': _contactName.text.trim(),
        'contactPosition': _contactPosition.text.trim(),
        'enabledModules': <String>[],
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = 'Falha ao criar empresa: $e';
        });
      }
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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Nova Empresa',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: SaaSTokens.textTitle)),
              const SizedBox(height: 20),
              _field('Razao social', _name),
              _field('Nome fantasia', _trading),
              _field('CNPJ', _cnpj),
              const SizedBox(height: 4),
              const Text('Segmento',
                  style: TextStyle(fontSize: 13, color: SaaSTokens.textMuted)),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                initialValue: _segment,
                items: _segments.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setState(() => _segment = v ?? 'outro'),
              ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: _field('Cidade', _city)),
                const SizedBox(width: 12),
                SizedBox(width: 90, child: _field('UF', _state)),
              ]),
              _field('Email corporativo', _email),
              _field('Telefone', _phone),
              _field('Responsavel', _contactName),
              _field('Cargo do responsavel', _contactPosition),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!,
                    style: const TextStyle(color: SaaSTokens.error, fontSize: 13)),
              ],
              const SizedBox(height: 20),
              Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                OutlinedButton(
                    onPressed:
                        _saving ? null : () => Navigator.of(context).pop(false),
                    child: const Text('Cancelar')),
                const SizedBox(width: 12),
                FilledButton(
                  onPressed: _saving ? null : _submit,
                  style: FilledButton.styleFrom(
                      backgroundColor: SaaSTokens.primary,
                      foregroundColor: Colors.white),
                  child: _saving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Text('Criar'),
                ),
              ]),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(String label, TextEditingController c) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: c,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            labelText: label,
            border: const OutlineInputBorder(),
            isDense: true,
          ),
        ),
      );
}
