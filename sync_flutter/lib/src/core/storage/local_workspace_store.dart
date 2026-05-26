import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class LocalWorkspaceStore {
  static const _settingsKey = 'sync.local.settings';
  static const _companiesKey = 'sync.local.companies';
  static const _companyBundlesKey = 'sync.local.companyBundles';
  static const _collaboratorsKey = 'sync.local.collaborators';
  static const _auditKey = 'sync.local.audit';

  Future<Map<String, dynamic>?> readSettings() async {
    return _readObject(_settingsKey);
  }

  Future<void> saveSettings(Map<String, dynamic> value) async {
    await _writeObject(_settingsKey, value);
  }

  Future<List<Map<String, dynamic>>> readCompanies() async {
    return _readObjectList(_companiesKey);
  }

  Future<void> saveCompanies(List<Map<String, dynamic>> value) async {
    await _writeObjectList(_companiesKey, value);
  }

  Future<Map<String, dynamic>> readCompanyBundles() async {
    final value = await _readObject(_companyBundlesKey);
    return value ?? <String, dynamic>{};
  }

  Future<void> saveCompanyBundle(String companyId, Map<String, dynamic> value) async {
    final bundles = await readCompanyBundles();
    bundles[companyId] = value;
    await _writeObject(_companyBundlesKey, bundles);
  }

  Future<List<Map<String, dynamic>>> readCollaborators() async {
    return _readObjectList(_collaboratorsKey);
  }

  Future<void> saveCollaborators(List<Map<String, dynamic>> value) async {
    await _writeObjectList(_collaboratorsKey, value);
  }

  Future<List<Map<String, dynamic>>> readAudit() async {
    return _readObjectList(_auditKey);
  }

  Future<void> saveAudit(List<Map<String, dynamic>> value) async {
    await _writeObjectList(_auditKey, value);
  }

  Future<Map<String, dynamic>?> _readObject(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(key);
    if (raw == null || raw.isEmpty) return null;
    final decoded = jsonDecode(raw);
    if (decoded is! Map<String, dynamic>) return null;
    return decoded;
  }

  Future<List<Map<String, dynamic>>> _readObjectList(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(key);
    if (raw == null || raw.isEmpty) return const <Map<String, dynamic>>[];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return const <Map<String, dynamic>>[];
    return decoded.whereType<Map<String, dynamic>>().toList();
  }

  Future<void> _writeObject(String key, Map<String, dynamic> value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, jsonEncode(value));
  }

  Future<void> _writeObjectList(String key, List<Map<String, dynamic>> value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, jsonEncode(value));
  }
}
