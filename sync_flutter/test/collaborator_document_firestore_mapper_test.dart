import 'package:flutter_test/flutter_test.dart';
import 'package:sync_flutter/src/core/data/collaborator_document_firestore_mapper.dart';

void main() {
  group('extensionFromFileName', () {
    test('usa a extensao do nome quando alfanumerica', () {
      expect(extensionFromFileName('contrato.PDF', 'application/pdf'), 'pdf');
      expect(extensionFromFileName('planilha.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'xlsx');
    });

    test('cai pro mime type quando o nome nao tem extensao alfanumerica', () {
      expect(extensionFromFileName('sem-extensao', 'application/pdf'), 'pdf');
      expect(extensionFromFileName('sem-extensao', 'image/png'), 'png');
    });

    test('bin quando nao reconhece nada', () {
      expect(extensionFromFileName('arquivo', 'application/octet-stream'), 'bin');
    });
  });

  group('validateDocumentFile', () {
    test('aceita pdf dentro do limite', () {
      expect(
        () => validateDocumentFile(fileName: 'x.pdf', mimeType: 'application/pdf', fileSize: 1024),
        returnsNormally,
      );
    });

    test('rejeita arquivo maior que 10MB', () {
      expect(
        () => validateDocumentFile(fileName: 'x.pdf', mimeType: 'application/pdf', fileSize: 11 * 1024 * 1024),
        throwsA(isA<UnsupportedDocumentFileException>()),
      );
    });

    test('rejeita tipo nao suportado', () {
      expect(
        () => validateDocumentFile(fileName: 'x.exe', mimeType: 'application/x-msdownload', fileSize: 100),
        throwsA(isA<UnsupportedDocumentFileException>()),
      );
    });

    test('aceita docx mesmo com mime type generico, pela extensao', () {
      expect(
        () => validateDocumentFile(fileName: 'contrato.docx', mimeType: 'application/octet-stream', fileSize: 100),
        returnsNormally,
      );
    });
  });

  test('documentStoragePath monta o path isolado por grupo/colaborador/doc', () {
    expect(
      documentStoragePath('grupo-1', 'colab1', 'doc1', 'pdf'),
      'collaborator-documents/grupo-1/colab1/doc1.pdf',
    );
  });

  test('collaboratorDocumentDocFromInput injeta groupId/collaboratorId/storagePath/fileUrl', () {
    final doc = collaboratorDocumentDocFromInput({
      'category': 'juridico',
      'documentType': 'contrato_social',
      'name': 'Contrato Social',
      'fileName': 'contrato.pdf',
      'fileSize': 2048,
      'mimeType': 'application/pdf',
      'issuedAt': '2026-01-01',
    }, groupId: 'grupo-1', collaboratorId: 'colab1', storagePath: 'collaborator-documents/grupo-1/colab1/doc1.pdf', fileUrl: 'https://x/doc1.pdf');

    expect(doc['groupId'], 'grupo-1');
    expect(doc['collaboratorId'], 'colab1');
    expect(doc['storagePath'], 'collaborator-documents/grupo-1/colab1/doc1.pdf');
    expect(doc['fileUrl'], 'https://x/doc1.pdf');
    expect(doc['category'], 'juridico');
    expect(doc['fileSize'], 2048);
  });

  test('collaboratorDocumentFromDoc converte de volta', () {
    final d = collaboratorDocumentFromDoc('doc1', {
      'collaboratorId': 'colab1',
      'category': 'juridico',
      'documentType': 'contrato_social',
      'name': 'Contrato Social',
      'fileName': 'contrato.pdf',
      'fileUrl': 'https://x/doc1.pdf',
      'fileSize': 2048,
      'mimeType': 'application/pdf',
      'issuedAt': '2026-01-01',
    });
    expect(d.id, 'doc1');
    expect(d.collaboratorId, 'colab1');
    expect(d.name, 'Contrato Social');
    expect(d.fileSize, 2048);
  });
}
