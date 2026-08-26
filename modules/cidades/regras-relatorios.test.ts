import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CITY_REPORT_TYPES } from "./reports-types";

/**
 * A regra do Firestore precisa conhecer todo tipo de relatório que o código
 * emite — e já não conheceu **duas vezes**.
 *
 * O modo de falha é caro e chega tarde: `cityDocuments` não confere tipo, então
 * o PDF é gerado, sobe ao Storage e só a gravação do registro em `cityReports`
 * é negada. Quem emitiu espera a geração inteira — minutos, uma dúzia de fontes
 * públicas — para receber "Missing or insufficient permissions" no fim, com o
 * arquivo existindo e o relatório não.
 *
 * Um comentário na regra pedindo para manter a lista em dia já existia nas duas
 * vezes em que ela divergiu. Por isso este teste lê o arquivo publicado em vez
 * de confiar em quem escreve: acrescentar um tipo ao catálogo sem acrescentar à
 * regra passa a quebrar a suíte, que é o gate do deploy.
 */
describe("firestore.rules × CITY_REPORT_TYPES", () => {
  const regras = readFileSync(join(process.cwd(), "firestore.rules"), "utf8");

  /** Os literais da cláusula `request.resource.data.type in [...]`. */
  function tiposNaRegra(): string[] {
    const trecho = regras.match(/request\.resource\.data\.type in \[([^\]]*)\]/);
    if (!trecho) throw new Error("Cláusula de tipos não encontrada em firestore.rules.");
    return [...trecho[1].matchAll(/'([a-z_]+)'/g)].map((achado) => achado[1]);
  }

  it("aceita exatamente os tipos que o código emite", () => {
    expect([...tiposNaRegra()].sort()).toEqual([...CITY_REPORT_TYPES].sort());
  });

  it("inclui o Dever de Casa, que foi o que faltou da última vez", () => {
    expect(tiposNaRegra()).toContain("dever_de_casa");
  });

  it("não inventa tipo que o código não conhece", () => {
    // O outro sentido do desalinhamento: regra permitindo gravar um tipo que
    // nenhuma tela sabe abrir depois.
    const conhecidos = new Set<string>(CITY_REPORT_TYPES);
    expect(tiposNaRegra().filter((tipo) => !conhecidos.has(tipo))).toEqual([]);
  });
});
