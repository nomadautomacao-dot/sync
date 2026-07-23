import 'dart:typed_data';

import 'package:firebase_storage/firebase_storage.dart';

/// Sobe o logo da empresa no Firebase Storage e devolve a URL de download.
/// O path isola por grupo — as Storage Rules casam com company-logos/{groupId}/.
class CompanyLogoStorage {
  CompanyLogoStorage({FirebaseStorage? storage})
      : _storage = storage ?? FirebaseStorage.instance;

  final FirebaseStorage _storage;

  static String logoPath(String groupId, String companyId) =>
      'company-logos/$groupId/$companyId';

  Future<String> upload({
    required String groupId,
    required String companyId,
    required Uint8List bytes,
    String contentType = 'image/png',
  }) async {
    final ref = _storage.ref(logoPath(groupId, companyId));
    await ref.putData(bytes, SettableMetadata(contentType: contentType));
    return ref.getDownloadURL();
  }
}
