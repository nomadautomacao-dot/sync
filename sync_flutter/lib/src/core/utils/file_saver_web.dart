import 'dart:html' as html;
import 'dart:typed_data';

Future<void> saveFilePlatform(Uint8List bytes, String filename) async {
  final blob = html.Blob([bytes], 'application/zip');
  final url = html.Url.createObjectUrlFromBlob(blob);
  html.AnchorElement(href: url)
    ..setAttribute('download', filename)
    ..click();
  html.Url.revokeObjectUrl(url);
}
