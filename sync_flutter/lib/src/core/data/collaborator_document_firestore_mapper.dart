import '../models/sync_models.dart';

class UnsupportedDocumentFileException implements Exception {
  UnsupportedDocumentFileException(this.message);
  final String message;
  @override
  String toString() => message;
}

const int kMaxDocumentFileSize = 10 * 1024 * 1024;

const Set<String> _allowedExtensions = {
  'pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'xls', 'xlsx',
};

const Map<String, String> _extensionByMimeType = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

String _nameExtension(String fileName) {
  final parts = fileName.split('.');
  if (parts.length < 2) return '';
  final ext = parts.last.toLowerCase();
  return RegExp(r'^[a-z0-9]+$').hasMatch(ext) ? ext : '';
}

/// Espelha `extensionFromFile` da rota Next legada: extensao do nome do
/// arquivo se for alfanumerica, senao deduz do mime type, senao 'bin'.
String extensionFromFileName(String fileName, String mimeType) {
  final byName = _nameExtension(fileName);
  if (byName.isNotEmpty) return byName;
  return _extensionByMimeType[mimeType] ?? 'bin';
}

/// Mesma validacao da rota Next legada: 10MB e a mesma lista de tipos.
/// Aceita pela extensao OU pelo mime type — docx com mime generico passa.
void validateDocumentFile({
  required String fileName,
  required String mimeType,
  required int fileSize,
}) {
  if (fileSize > kMaxDocumentFileSize) {
    throw UnsupportedDocumentFileException('Arquivo excede o limite de 10MB');
  }
  final ext = _nameExtension(fileName);
  final mimeKnown = _extensionByMimeType.containsKey(mimeType);
  final extKnown = _allowedExtensions.contains(ext);
  if (!mimeKnown && !extKnown) {
    throw UnsupportedDocumentFileException('Tipo de arquivo nao suportado');
  }
}

String documentStoragePath(
  String groupId,
  String collaboratorId,
  String docId,
  String extension,
) =>
    'collaborator-documents/$groupId/$collaboratorId/$docId.$extension';

String? _str(dynamic v) => v is String && v.isNotEmpty ? v : null;

Map<String, dynamic> collaboratorDocumentDocFromInput(
  Map<String, dynamic> input, {
  required String groupId,
  required String collaboratorId,
  required String storagePath,
  required String fileUrl,
}) {
  return {
    'groupId': groupId,
    'collaboratorId': collaboratorId,
    'category': input['category'] ?? '',
    'documentType': input['documentType'] ?? '',
    'name': input['name'] ?? '',
    'fileName': input['fileName'] ?? '',
    'storagePath': storagePath,
    'fileUrl': fileUrl,
    'fileSize': input['fileSize'],
    'mimeType': _str(input['mimeType']),
    'issuedAt': _str(input['issuedAt']),
    'expiresAt': _str(input['expiresAt']),
    'notes': _str(input['notes']),
  };
}

CollaboratorDocument collaboratorDocumentFromDoc(String id, Map<String, dynamic> data) {
  return CollaboratorDocument(
    id: id,
    collaboratorId: (data['collaboratorId'] as String?) ?? '',
    category: (data['category'] as String?) ?? '',
    documentType: (data['documentType'] as String?) ?? '',
    name: (data['name'] as String?) ?? '',
    fileName: (data['fileName'] as String?) ?? '',
    fileUrl: (data['fileUrl'] as String?) ?? '',
    fileSize: data['fileSize'] as int?,
    mimeType: _str(data['mimeType']),
    issuedAt: _str(data['issuedAt']),
    expiresAt: _str(data['expiresAt']),
    notes: _str(data['notes']),
  );
}
