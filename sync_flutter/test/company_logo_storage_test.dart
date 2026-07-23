import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/company_logo_storage.dart';

void main() {
  test('logoPath isola por grupo e empresa', () {
    expect(
      CompanyLogoStorage.logoPath('grupo-1', 'c123'),
      'company-logos/grupo-1/c123',
    );
  });
}
