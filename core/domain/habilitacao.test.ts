import { describe, expect, it } from "vitest";

import {
  CATEGORIAS_HABILITACAO,
  caminhoNoKit,
  categoriaPorKey,
  diasParaVencer,
  resumoDaHabilitacao,
  situacaoDoDocumento,
  type CategoriaHabilitacao,
  type DocumentoDaHabilitacao,
} from "./habilitacao";

const AGORA = new Date("2026-08-14T15:00:00.000Z");

function doc(
  categoria: CategoriaHabilitacao,
  validade?: string,
  extras: Partial<DocumentoDaHabilitacao> = {},
): DocumentoDaHabilitacao {
  return {
    id: `${categoria}-${validade ?? "sem"}`,
    categoria,
    titulo: "Documento",
    validade,
    fileName: "arquivo.pdf",
    fileSize: 1000,
    mimeType: "application/pdf",
    storagePath: "p",
    downloadUrl: "u",
    ...extras,
  };
}

/** As essenciais de verdade — se esta lista mudar, o resumo muda junto. */
const ESSENCIAIS = CATEGORIAS_HABILITACAO.filter((c) => c.essencial).map((c) => c.key);

describe("catálogo de categorias", () => {
  it("tem nove categorias, com ordem única e sequencial", () => {
    expect(CATEGORIAS_HABILITACAO).toHaveLength(9);
    const ordens = CATEGORIAS_HABILITACAO.map((c) => c.ordem);
    expect(new Set(ordens).size).toBe(9);
    expect(ordens).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09"]);
  });

  it("só certidões e idoneidade exigem validade — são as que vencem", () => {
    const comValidade = CATEGORIAS_HABILITACAO.filter((c) => c.exigeValidade).map((c) => c.key);
    expect(comValidade).toEqual(["certidoes", "idoneidade"]);
  });

  it("categoria desconhecida falha alto em vez de sumir do kit", () => {
    expect(() => categoriaPorKey("inventada" as CategoriaHabilitacao)).toThrow();
  });
});

describe("diasParaVencer / situacaoDoDocumento", () => {
  it("conta os dias e classifica", () => {
    expect(diasParaVencer(doc("certidoes", "2026-12-31"), AGORA)).toBe(139);
    expect(situacaoDoDocumento(doc("certidoes", "2026-12-31"), AGORA)).toBe("valido");
    expect(situacaoDoDocumento(doc("certidoes", "2026-09-01"), AGORA)).toBe("vence_em_breve");
    expect(situacaoDoDocumento(doc("certidoes", "2026-08-01"), AGORA)).toBe("vencido");
  });

  it("vence hoje ainda vale o dia inteiro", () => {
    expect(diasParaVencer(doc("certidoes", "2026-08-14"), AGORA)).toBe(0);
    expect(situacaoDoDocumento(doc("certidoes", "2026-08-14"), AGORA)).toBe("vence_em_breve");
  });

  it("documento sem validade não é vencido — é sem validade", () => {
    expect(diasParaVencer(doc("societario"), AGORA)).toBeNull();
    expect(situacaoDoDocumento(doc("societario"), AGORA)).toBe("sem_validade");
  });

  it("data ilegível não vira vencimento fantasma", () => {
    expect(diasParaVencer(doc("certidoes", "14/08/2026"), AGORA)).toBeNull();
  });
});

describe("resumoDaHabilitacao", () => {
  it("habilitação vazia lista todas as essenciais e não está pronta", () => {
    const resumo = resumoDaHabilitacao([], AGORA);
    expect(resumo.total).toBe(0);
    expect(resumo.pronta).toBe(false);
    expect(resumo.categoriasFaltando.map((c) => c.key)).toEqual(ESSENCIAIS);
  });

  it("com todas as essenciais válidas, está pronta", () => {
    const documentos = ESSENCIAIS.map((key) =>
      doc(key, categoriaPorKey(key).exigeValidade ? "2026-12-31" : undefined),
    );
    const resumo = resumoDaHabilitacao(documentos, AGORA);
    expect(resumo.categoriasFaltando).toHaveLength(0);
    expect(resumo.pronta).toBe(true);
  });

  it("um vencido derruba a prontidão", () => {
    const documentos = ESSENCIAIS.map((key) =>
      doc(key, key === "certidoes" ? "2026-08-01" : undefined),
    );
    const resumo = resumoDaHabilitacao(documentos, AGORA);
    expect(resumo.vencidos).toBe(1);
    expect(resumo.pronta).toBe(false);
  });

  it("documento vencendo avisa mas não trava — ainda vale hoje", () => {
    const documentos = ESSENCIAIS.map((key) =>
      doc(key, key === "certidoes" ? "2026-09-01" : undefined),
    );
    const resumo = resumoDaHabilitacao(documentos, AGORA);
    expect(resumo.vencendo).toBe(1);
    expect(resumo.pronta).toBe(true);
  });
});

describe("caminhoNoKit", () => {
  it("usa a numeração da categoria, para o ZIP seguir a ordem do processo", () => {
    expect(caminhoNoKit(doc("certidoes", "2026-12-31"))).toBe(
      "Habilitacao/02 Certidões/arquivo.pdf",
    );
    expect(caminhoNoKit(doc("declaracoes"))).toBe("Habilitacao/09 Declarações/arquivo.pdf");
  });
});
