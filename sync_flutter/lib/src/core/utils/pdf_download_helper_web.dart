// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'dart:typed_data';

/// Web-specific implementation: triggers a browser file download
/// by creating a Blob URL and clicking an anchor element.
void downloadPdfWeb({
  required Uint8List bytes,
  required String filename,
}) {
  downloadBytesWeb(
    bytes: bytes,
    filename: filename,
    mimeType: 'application/pdf',
  );
}

void downloadBytesWeb({
  required Uint8List bytes,
  required String filename,
  required String mimeType,
}) {
  final blob = html.Blob([bytes], mimeType);
  final url = html.Url.createObjectUrlFromBlob(blob);
  final anchor = html.AnchorElement(href: url)
    ..setAttribute('download', filename)
    ..style.display = 'none';
  html.document.body?.append(anchor);
  anchor.click();
  anchor.remove();
  html.Url.revokeObjectUrl(url);
}
