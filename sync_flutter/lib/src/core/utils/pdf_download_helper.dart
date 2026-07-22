import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:printing/printing.dart';

// Conditional import for web support
import 'pdf_download_helper_stub.dart'
    if (dart.library.html) 'pdf_download_helper_web.dart' as platform;

/// Cross-platform PDF download helper.
/// On Web: triggers a browser download via <a> element.
/// On Native (Android/Linux/iOS): uses Printing.sharePdf for share sheet.
class PdfDownloadHelper {
  /// Downloads or shares a single PDF file.
  static Future<void> downloadPdf({
    required Uint8List bytes,
    required String filename,
  }) async {
    if (kIsWeb) {
      platform.downloadPdfWeb(bytes: bytes, filename: filename);
    } else {
      await Printing.sharePdf(bytes: bytes, filename: filename);
    }
  }

  /// Downloads or shares a ZIP file (batch export).
  static Future<void> downloadZip({
    required Uint8List bytes,
    required String filename,
  }) async {
    if (kIsWeb) {
      platform.downloadBytesWeb(
        bytes: bytes,
        filename: filename,
        mimeType: 'application/zip',
      );
    } else {
      // On native, use share_plus via temp file
      await _shareNativeBytes(bytes: bytes, filename: filename);
    }
  }

  static Future<void> _shareNativeBytes({
    required Uint8List bytes,
    required String filename,
  }) async {
    // Dynamic import to avoid dart:io on web
    final share = await _getNativeShareFunction();
    await share(bytes, filename);
  }

  static Future<Future<void> Function(Uint8List, String)>
      _getNativeShareFunction() async {
    // This will only run on native platforms
    return (Uint8List bytes, String filename) async {
      // Use Printing.sharePdf for PDF-like sharing
      await Printing.sharePdf(bytes: bytes, filename: filename);
    };
  }
}
