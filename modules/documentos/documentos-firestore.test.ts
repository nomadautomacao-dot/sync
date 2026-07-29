import { describe, expect, it } from "vitest";

import {
  MAX_CITY_DOCUMENT_BYTES,
  formatFileSize,
  validateCityDocumentFile,
} from "./documentos-firestore";

function file(name: string, size: number): File {
  return { name, size } as File;
}

describe("validateCityDocumentFile", () => {
  it("aceita os formatos documentais suportados", () => {
    expect(validateCityDocumentFile(file("contrato.pdf", 1024))).toBeNull();
    expect(validateCityDocumentFile(file("minuta.docx", 2048))).toBeNull();
    expect(validateCityDocumentFile(file("kit.zip", 4096))).toBeNull();
  });

  it("bloqueia arquivo vazio, muito grande ou com formato desconhecido", () => {
    expect(validateCityDocumentFile(file("vazio.pdf", 0))).toContain("vazio");
    expect(
      validateCityDocumentFile(
        file("grande.pdf", MAX_CITY_DOCUMENT_BYTES + 1),
      ),
    ).toContain("20 MB");
    expect(validateCityDocumentFile(file("script.exe", 1024))).toContain(
      "Formato",
    );
  });
});

describe("formatFileSize", () => {
  it("formata bytes, kilobytes e megabytes", () => {
    expect(formatFileSize(900)).toBe("900 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
