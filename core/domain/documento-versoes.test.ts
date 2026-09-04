import { describe, expect, it } from "vitest";

import {
  caminhoColide,
  historicoDoDocumento,
  promoverNovaVersao,
  temHistorico,
  versaoAtual,
  type ComVersoes,
} from "./documento-versoes";

const AGORA = new Date("2026-09-04T15:00:00.000Z");
const AUTOR = { uid: "u2", nome: "Eli" };

function documento(campos: Partial<ComVersoes> = {}): ComVersoes {
  return {
    fileName: "certificado.docx",
    fileSize: 1_774_107,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storagePath: "city-documents/g1/c1/v1-certificado.docx",
    downloadUrl: "https://exemplo/v1",
    createdAt: "2026-09-01T10:00:00.000Z",
    createdBy: "u1",
    createdByName: "Tais Nunes",
    ...campos,
  };
}

const ARQUIVO = {
  fileName: "certificado-corrigido.docx",
  fileSize: 1_800_000,
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  storagePath: "city-documents/g1/c1/v2-certificado.docx",
  downloadUrl: "https://exemplo/v2",
};

describe("versão vigente", () => {
  /* Documento gravado antes deste campo existir é a v1, não `undefined` nem 0
     — e no dia do deploy essa é a maioria dos arquivos da base. */
  it("documento antigo, sem o campo, é a versão 1", () => {
    expect(versaoAtual(documento())).toBe(1);
    expect(temHistorico(documento())).toBe(false);
  });

  it("documento com histórico responde a versão gravada", () => {
    const doc = documento({ versao: 3, versoesAnteriores: [] });
    expect(versaoAtual(doc)).toBe(3);
  });
});

describe("promover nova versão", () => {
  it("o arquivo novo vira o do topo e a versão sobe", () => {
    const patch = promoverNovaVersao(documento(), ARQUIVO, AUTOR, AGORA);
    expect(patch.fileName).toBe("certificado-corrigido.docx");
    expect(patch.downloadUrl).toBe("https://exemplo/v2");
    expect(patch.versao).toBe(2);
  });

  /* O ponto do módulo inteiro: substituir não apaga. A URL antiga continua
     apontando para o objeto antigo, que ninguém removeu do Storage. */
  it("a versão que sai desce inteira para o histórico", () => {
    const patch = promoverNovaVersao(documento(), ARQUIVO, AUTOR, AGORA);
    expect(patch.versoesAnteriores).toHaveLength(1);
    const antiga = patch.versoesAnteriores[0];
    expect(antiga.versao).toBe(1);
    expect(antiga.storagePath).toBe("city-documents/g1/c1/v1-certificado.docx");
    expect(antiga.downloadUrl).toBe("https://exemplo/v1");
  });

  /*
   * Quem subiu a v1 continua sendo quem subiu a v1. Carimbar o autor da
   * substituição na versão antiga reescreveria a história — e é a história que
   * alguém vai ler para saber quem entregou o quê à prefeitura.
   */
  it("a autoria da versão antiga não é transferida a quem substituiu", () => {
    const patch = promoverNovaVersao(documento(), ARQUIVO, AUTOR, AGORA);
    expect(patch.versoesAnteriores[0].autorUid).toBe("u1");
    expect(patch.versoesAnteriores[0].autorNome).toBe("Tais Nunes");
    expect(patch.versoesAnteriores[0].criadoEm).toBe("2026-09-01T10:00:00.000Z");
  });

  it("empilha sem perder nenhuma das anteriores", () => {
    const p1 = promoverNovaVersao(documento(), ARQUIVO, AUTOR, AGORA);
    const doc2 = documento({ ...p1, createdBy: "u2", createdByName: "Eli" });
    const p2 = promoverNovaVersao(
      doc2,
      { ...ARQUIVO, storagePath: "…/v3", downloadUrl: "https://exemplo/v3" },
      AUTOR,
      AGORA,
    );
    expect(p2.versao).toBe(3);
    expect(p2.versoesAnteriores.map((v) => v.versao)).toEqual([1, 2]);
  });

  it("a nota fica na versão substituída, que é onde alguém vai lê-la", () => {
    const patch = promoverNovaVersao(
      documento(),
      { ...ARQUIVO, nota: "  nome do formador errado  " },
      AUTOR,
      AGORA,
    );
    expect(patch.versoesAnteriores[0].nota).toBe("nome do formador errado");
  });

  it("nota em branco não vira chave undefined — o Firestore recusa", () => {
    const patch = promoverNovaVersao(documento(), { ...ARQUIVO, nota: "   " }, AUTOR, AGORA);
    expect(patch.versoesAnteriores[0]).not.toHaveProperty("nota");
  });
});

describe("histórico para a tela", () => {
  it("a atual vem primeiro, e as anteriores em ordem decrescente", () => {
    const doc = documento({
      versao: 3,
      versoesAnteriores: [
        { versao: 1, ...ARQUIVO, criadoEm: "2026-01-01", autorUid: "u1", autorNome: "A" },
        { versao: 2, ...ARQUIVO, criadoEm: "2026-02-01", autorUid: "u1", autorNome: "A" },
      ],
    });
    expect(historicoDoDocumento(doc).map((v) => v.versao)).toEqual([3, 2, 1]);
  });

  /* A atual é montada dos campos do topo, não duplicada no array: dois lugares
     para atualizar significa um deles ficando para trás — e o que ficaria para
     trás é justamente o arquivo que a pessoa baixa. */
  it("a atual sai dos campos do topo, não do array", () => {
    const doc = documento({ versao: 2, versoesAnteriores: [] });
    const [atual] = historicoDoDocumento(doc);
    expect(atual.downloadUrl).toBe(doc.downloadUrl);
    expect(atual.autorNome).toBe("Tais Nunes");
  });

  it("documento sem histórico devolve só ele mesmo", () => {
    expect(historicoDoDocumento(documento())).toHaveLength(1);
  });
});

describe("colisão de caminho no Storage", () => {
  /*
   * `uploadBytes` sobrescreve em silêncio quando o caminho colide — e
   * sobrescrever é exatamente o que este módulo existe para impedir. O
   * histórico apontaria para um objeto que já é a versão nova, com a tela
   * jurando que a v1 está lá.
   */
  it("acusa colisão com a versão vigente", () => {
    expect(caminhoColide(documento(), "city-documents/g1/c1/v1-certificado.docx")).toBe(true);
  });

  it("acusa colisão com uma versão já arquivada", () => {
    const doc = documento({
      versoesAnteriores: [
        { versao: 1, ...ARQUIVO, storagePath: "antigo", criadoEm: "", autorUid: "", autorNome: "" },
      ],
    });
    expect(caminhoColide(doc, "antigo")).toBe(true);
  });

  it("caminho novo passa", () => {
    expect(caminhoColide(documento(), "city-documents/g1/c1/v9-outro.docx")).toBe(false);
  });
});
