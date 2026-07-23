import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import 'api_exception.dart';
import 'session_storage.dart';

class SyncApiClient {
  SyncApiClient({required SessionStorage sessionStorage, http.Client? client})
    : _sessionStorage = sessionStorage,
      _client = client ?? http.Client();

  final SessionStorage _sessionStorage;
  final http.Client _client;

  String get apiBaseUrl {
    if (AppConfig.hasRemoteApi) {
      return AppConfig.apiBaseUrl;
    }
    return _sessionStorage.apiBaseUrl;
  }

  bool get isConfigured => apiBaseUrl.isNotEmpty;

  bool get usesEnvironmentApi => AppConfig.hasRemoteApi;

  Future<void> setApiBaseUrl(String value) async {
    if (usesEnvironmentApi) {
      return;
    }
    await _sessionStorage.saveApiBaseUrl(value);
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    bool includeSession = true,
    Duration timeout = const Duration(seconds: 20),
  }) async {
    final response = await _send(
      'POST',
      path,
      body: body,
      includeSession: includeSession,
      timeout: timeout,
    );
    return _decodeObject(response.body);
  }

  Future<Uint8List> postBytes(
    String path, {
    Map<String, dynamic>? body,
    bool includeSession = true,
    Duration timeout = const Duration(seconds: 20),
  }) async {
    final response = await _send(
      'POST',
      path,
      body: body,
      includeSession: includeSession,
      timeout: timeout,
    );
    return Uint8List.fromList(response.bodyBytes);
  }

  Future<Map<String, dynamic>> put(
    String path, {
    Map<String, dynamic>? body,
    Duration timeout = const Duration(seconds: 20),
  }) async {
    final response = await _send('PUT', path, body: body, timeout: timeout);
    return _decodeObject(response.body);
  }

  Future<Map<String, dynamic>> delete(
    String path, {
    Duration timeout = const Duration(seconds: 20),
  }) async {
    final response = await _send('DELETE', path, timeout: timeout);
    if (response.body.trim().isEmpty) {
      return <String, dynamic>{};
    }
    return _decodeObject(response.body);
  }

  Future<List<dynamic>> getList(
    String path, {
    Duration timeout = const Duration(seconds: 20),
  }) async {
    final response = await _send('GET', path, timeout: timeout);
    final decoded = jsonDecode(response.body);
    if (decoded is! List<dynamic>) {
      throw const ApiException('Resposta invalida da API.');
    }
    return decoded;
  }

  Future<Map<String, dynamic>> getObject(
    String path, {
    Duration timeout = const Duration(seconds: 20),
  }) async {
    final response = await _send('GET', path, timeout: timeout);
    return _decodeObject(response.body);
  }

  Future<http.Response> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool includeSession = true,
    Duration timeout = const Duration(seconds: 20),
  }) async {
    final baseUrl = await _resolveBaseUrl();

    final headers = <String, String>{'Content-Type': 'application/json'};

    if (includeSession) {
      final idToken = await FirebaseAuth.instance.currentUser?.getIdToken();
      if (idToken != null) {
        headers['Authorization'] = 'Bearer $idToken';
      }
    }

    final uri = Uri.parse(baseUrl).resolve(path);
    late final http.Response response;

    try {
      switch (method) {
        case 'GET':
          response = await _client.get(uri, headers: headers).timeout(timeout);
          break;
        case 'POST':
          response = await _client
              .post(
                uri,
                headers: headers,
                body: jsonEncode(body ?? <String, dynamic>{}),
              )
              .timeout(timeout);
          break;
        case 'PUT':
          response = await _client
              .put(
                uri,
                headers: headers,
                body: jsonEncode(body ?? <String, dynamic>{}),
              )
              .timeout(timeout);
          break;
        case 'DELETE':
          response = await _client.delete(uri, headers: headers).timeout(timeout);
          break;
        default:
          throw ApiException('Metodo HTTP nao suportado: $method');
      }
    } on SocketException {
      throw const ApiException(
        'Nao foi possivel conectar ao servidor SYNC. Verifique sua internet e tente novamente.',
      );
    } on http.ClientException {
      throw const ApiException('Falha de comunicacao com a API do SYNC.');
    } on TimeoutException {
      throw const ApiException(
        'A API do SYNC demorou para responder. Tente novamente em instantes.',
      );
    }

    if (response.statusCode >= 400) {
      if (includeSession && response.statusCode == 401) {
        await _sessionStorage.clear();
      }
      final message = _extractErrorMessage(response.body);
      throw ApiException(message, statusCode: response.statusCode);
    }

    return response;
  }

  Map<String, dynamic> _decodeObject(String body) {
    final decoded = jsonDecode(body);
    if (decoded is! Map<String, dynamic>) {
      throw const ApiException('Resposta invalida da API.');
    }
    return decoded;
  }

  String _extractErrorMessage(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        final error = decoded['error'];
        final details = decoded['details'];
        if (error is String && details is String && details.isNotEmpty) {
          return '$error ($details)';
        }
        if (error is String) return error;
      }
    } catch (_) {}

    return 'Falha ao comunicar com a API.';
  }

  /// Returns authentication headers (Bearer) for use in external requests (e.g. multipart).
  Future<Map<String, String>> getAuthHeaders() async {
    final headers = <String, String>{};
    final idToken = await FirebaseAuth.instance.currentUser?.getIdToken();
    if (idToken != null) {
      headers['Authorization'] = 'Bearer $idToken';
    }
    return headers;
  }

  Future<String> _resolveBaseUrl() async {
    if (AppConfig.hasRemoteApi) {
      return AppConfig.apiBaseUrl;
    }
    final saved = await _sessionStorage.readApiBaseUrl();
    if (saved.isNotEmpty) {
      return saved;
    }
    throw const ApiException(
      'Defina a URL publica do backend para usar a API real.',
    );
  }
}
