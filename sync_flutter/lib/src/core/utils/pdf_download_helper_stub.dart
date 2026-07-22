import 'dart:typed_data';

/// Stub implementation for non-web platforms.
/// These functions are never called on native (guarded by kIsWeb check).
void downloadPdfWeb({
  required Uint8List bytes,
  required String filename,
}) {
  throw UnsupportedError('downloadPdfWeb is only available on web.');
}

void downloadBytesWeb({
  required Uint8List bytes,
  required String filename,
  required String mimeType,
}) {
  throw UnsupportedError('downloadBytesWeb is only available on web.');
}
