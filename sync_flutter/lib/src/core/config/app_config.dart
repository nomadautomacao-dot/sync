class AppConfig {
  static const rawBaseUrl = String.fromEnvironment(
    'SYNC_API_BASE_URL',
    defaultValue: 'https://sync-app-621901234263.us-central1.run.app',
  );

  static String get apiBaseUrl {
    final trimmed = rawBaseUrl.trim();
    return trimmed.endsWith('/') ? trimmed.substring(0, trimmed.length - 1) : trimmed;
  }

  static bool get hasRemoteApi => apiBaseUrl.isNotEmpty;
}
