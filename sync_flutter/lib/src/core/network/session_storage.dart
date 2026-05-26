import 'package:shared_preferences/shared_preferences.dart';

import '../models/sync_models.dart';

class SessionStorage {
  static const _cookieKey = 'sync.session.cookie';
  static const _userNameKey = 'sync.user.name';
  static const _userEmailKey = 'sync.user.email';
  static const _userInitialsKey = 'sync.user.initials';
  static const _apiBaseUrlKey = 'sync.api.base_url';

  String? _cachedApiBaseUrl;

  String get apiBaseUrl => _normalizeBaseUrl(_cachedApiBaseUrl);

  Future<void> prime() async {
    final prefs = await SharedPreferences.getInstance();
    _cachedApiBaseUrl = prefs.getString(_apiBaseUrlKey);
  }

  Future<void> saveSession({
    required String cookie,
    required SyncUser user,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_cookieKey, cookie);
    await prefs.setString(_userNameKey, user.name);
    await prefs.setString(_userEmailKey, user.email);
    await prefs.setString(_userInitialsKey, user.initials);
  }

  Future<String?> readCookie() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_cookieKey);
  }

  Future<String> readApiBaseUrl() async {
    if (_cachedApiBaseUrl != null) {
      return _normalizeBaseUrl(_cachedApiBaseUrl);
    }
    final prefs = await SharedPreferences.getInstance();
    _cachedApiBaseUrl = prefs.getString(_apiBaseUrlKey);
    return _normalizeBaseUrl(_cachedApiBaseUrl);
  }

  Future<void> saveApiBaseUrl(String value) async {
    final prefs = await SharedPreferences.getInstance();
    final normalized = _normalizeBaseUrl(value);
    _cachedApiBaseUrl = normalized;
    if (normalized.isEmpty) {
      await prefs.remove(_apiBaseUrlKey);
      return;
    }
    await prefs.setString(_apiBaseUrlKey, normalized);
  }

  Future<SyncUser?> readUser() async {
    final prefs = await SharedPreferences.getInstance();
    final cookie = prefs.getString(_cookieKey);
    final name = prefs.getString(_userNameKey);
    final email = prefs.getString(_userEmailKey);
    final initials = prefs.getString(_userInitialsKey);
    if (cookie == null || cookie.isEmpty || name == null || email == null || initials == null) {
      return null;
    }

    return SyncUser(name: name, email: email, initials: initials);
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cookieKey);
    await prefs.remove(_userNameKey);
    await prefs.remove(_userEmailKey);
    await prefs.remove(_userInitialsKey);
  }

  String _normalizeBaseUrl(String? value) {
    final trimmed = (value ?? '').trim();
    if (trimmed.isEmpty) return '';
    return trimmed.endsWith('/') ? trimmed.substring(0, trimmed.length - 1) : trimmed;
  }
}
