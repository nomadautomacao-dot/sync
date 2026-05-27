import 'dart:io';
import 'dart:typed_data';
import 'package:path_provider/path_provider.dart';

Future<void> saveFilePlatform(Uint8List bytes, String filename) async {
  Directory? downloadsDir;
  try {
    downloadsDir = await getDownloadsDirectory();
  } catch (e) {
    // Fallback to application documents if downloads dir is not supported or fails
    downloadsDir = await getApplicationDocumentsDirectory();
  }

  downloadsDir ??= await getApplicationDocumentsDirectory();

  final filePath = '${downloadsDir.path}/$filename';
  final file = File(filePath);
  await file.writeAsBytes(bytes);
  
  // Print for verification logs
  print('Saved file successfully to: $filePath');
}
