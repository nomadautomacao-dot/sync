import { describe, expect, it } from "vitest";

import {
  extensaoDoArquivo,
  formatoDoArquivo,
  neutralizar,
  nomeArquivoDaUrl,
} from "./visualizador-de-arquivo";

describe("que formato é", () => {
  it("reconhece PDF pelo mime e pela extensão", () => {
    expect(formatoDoArquivo("x.pdf", "")).toBe("pdf");
    expect(formatoDoArquivo("sem-extensao", "application/pdf")).toBe("pdf");
  });

  it("reconhece DOCX pelo mime e pela extensão", () => {
    expect(formatoDoArquivo("certificado.docx", "")).toBe("docx");
    expect(
      formatoDoArquivo(
        "sem-extensao",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("docx");
  });

  it("reconhece imagem", () => {
    expect(formatoDoArquivo("cartaz.PNG", "")).toBe("imagem");
    expect(formatoDoArquivo("foto.jpeg", "")).toBe("imagem");
    expect(formatoDoArquivo("x", "image/webp")).toBe("imagem");
  });

  /*
   * `.doc` antigo não é DOCX: o mammoth lê OOXML, e um `.doc` binário de 2003
   * produziria erro no lugar do documento. Cair em "desconhecido" leva a pessoa
   * ao botão de baixar, que é o caminho que funciona.
   */
  it("`.doc` antigo não passa por DOCX", () => {
    expect(formatoDoArquivo("contrato.doc", "application/msword")).toBe("desconhecido");
  });

  it("planilha e ZIP caem em desconhecido", () => {
    expect(formatoDoArquivo("planilha.xlsx", "")).toBe("desconhecido");
    expect(formatoDoArquivo("kit.zip", "")).toBe("desconhecido");
  });

  it("sem nome e sem mime não estoura", () => {
    expect(formatoDoArquivo()).toBe("desconhecido");
  });

  /* O nome do arquivo vem do upload e pode ter caixa alta em qualquer letra. */
  it("a extensão é lida sem depender de caixa", () => {
    expect(formatoDoArquivo("RELATORIO.PDF", "")).toBe("pdf");
    expect(formatoDoArquivo("Oficio.DocX", "")).toBe("docx");
  });
});

describe("neutralizar a conversão", () => {
  it("mantém o conteúdo comum intacto", () => {
    const html = "<h1>Certificado</h1><p>Certificamos que <strong>Tais</strong> participou.</p>";
    expect(neutralizar(html)).toBe(html);
  });

  it("tira script, com e sem fechamento", () => {
    expect(neutralizar("<p>a</p><script>alert(1)</script><p>b</p>")).toBe("<p>a</p><p>b</p>");
    expect(neutralizar("<script src='x.js'/><p>a</p>")).toBe("<p>a</p>");
  });

  /*
   * É o vetor que sobrevive à conversão: o mammoth não repassa marcação escrita
   * pelo autor, mas monta `<a href>` a partir do hiperlink do documento — e um
   * hiperlink `javascript:` atravessa intacto. Qualquer pessoa da equipe envia
   * arquivo para a pasta.
   */
  it("tira href javascript: e mantém o texto do link", () => {
    const saida = neutralizar('<a href="javascript:alert(1)">clique</a>');
    expect(saida).not.toContain("javascript:");
    expect(saida).toContain("clique");
  });

  it("tira manipulador de evento embutido", () => {
    expect(neutralizar('<p onclick="roubar()">texto</p>')).toBe("<p>texto</p>");
    expect(neutralizar("<img src='x.png' onerror=roubar()>")).toBe("<img src='x.png'>");
  });

  it("não confunde link normal com javascript:", () => {
    const html = '<a href="https://exemplo.gov.br/edital">edital</a>';
    expect(neutralizar(html)).toBe(html);
  });

  /* Imagem embutida vira data: URI na conversão — é como o cartaz aparece. */
  it("preserva imagem embutida em data: URI", () => {
    const html = '<img src="data:image/png;base64,iVBORw0KGgo=">';
    expect(neutralizar(html)).toBe(html);
  });
});

const URL_STORAGE =
  "https://firebasestorage.googleapis.com/v0/b/projeto.firebasestorage.app/o/" +
  "city-documents%2Fg1%2Fc1%2F1787149913506-uuid-CERTIFICADO_JUVENILIA.docx" +
  "?alt=media&token=abc";

describe("nome do arquivo escondido na URL", () => {
  /*
   * O anexo da linha do tempo guarda só título e link — não tem `fileName`.
   * Sem esta extração, um PDF anexado numa reunião abria como "não dá para
   * mostrar aqui", porque o formato caía em "desconhecido".
   */
  it("tira o nome do caminho percent-encoded do Storage", () => {
    expect(nomeArquivoDaUrl(URL_STORAGE)).toBe("1787149913506-uuid-CERTIFICADO_JUVENILIA.docx");
  });

  it("ignora a query string", () => {
    expect(nomeArquivoDaUrl("https://x.com/a/b/arquivo.pdf?token=1&alt=media")).toBe(
      "arquivo.pdf",
    );
  });

  it("devolve indefinido quando não há nome com extensão", () => {
    expect(nomeArquivoDaUrl("https://x.com/pasta/")).toBeUndefined();
    expect(nomeArquivoDaUrl("https://x.com/semponto")).toBeUndefined();
  });

  it("URL inválida não estoura", () => {
    expect(nomeArquivoDaUrl("nao é url")).toBeUndefined();
    expect(nomeArquivoDaUrl("")).toBeUndefined();
  });
});

describe("extensão à vista", () => {
  /*
   * A razão de existir: o título é escrito por quem sobe o arquivo, e
   * "Certificado da capacitação" não diz se o que está lá dentro é um DOCX ou
   * um ZIP. Descobrir isso só depois de baixar é o atrito que a etiqueta tira.
   */
  it("vem do nome do arquivo, em maiúsculas", () => {
    expect(extensaoDoArquivo("certificado.docx")).toBe("DOCX");
    expect(extensaoDoArquivo("kit.ZIP")).toBe("ZIP");
    expect(extensaoDoArquivo("relatorio.pdf")).toBe("PDF");
  });

  it("cai para a URL quando não há nome", () => {
    expect(extensaoDoArquivo(undefined, URL_STORAGE)).toBe("DOCX");
  });

  it("o nome tem precedência sobre a URL", () => {
    expect(extensaoDoArquivo("planilha.xlsx", URL_STORAGE)).toBe("XLSX");
  });

  it("sem extensão não inventa etiqueta", () => {
    expect(extensaoDoArquivo("arquivo-sem-ponto")).toBeUndefined();
    expect(extensaoDoArquivo(undefined, undefined)).toBeUndefined();
  });

  /* Nome com ponto no meio é comum ("Ata 12.03.2026.pdf"): vale o último. */
  it("com vários pontos, vale o último trecho", () => {
    expect(extensaoDoArquivo("Ata 12.03.2026.pdf")).toBe("PDF");
  });

  /* "arquivo.versao final" não tem extensão — tem um ponto e uma frase. */
  it("trecho final que não parece extensão é descartado", () => {
    expect(extensaoDoArquivo("contrato.versao final")).toBeUndefined();
  });
});
