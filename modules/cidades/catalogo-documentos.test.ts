import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DOCUMENTOS } from "@/app/(sync)/modulos/levantamento-fundeb/_components/documentos";
import { CITY_REPORT_TYPES, CITY_REPORT_TYPE_LABELS } from "@/modules/cidades/reports-types";
import { PAGINAS_ESPERADAS_RAIO_X } from "@/core/lib/municipal-xray-pdf";
import { PAGINAS_ESPERADAS_HISTORICO_CENSO } from "@/core/lib/censo-historico-pdf";
import { PAGINAS_ESPERADAS_OFICIO } from "@/core/lib/oficio-documentos-pdf";

/**
 * O catálogo de emissão é ligado por strings — `endpoint` aponta para uma rota
 * e `reportType` para um tipo arquivável. Nenhum compilador confere as duas
 * pontas: um erro de digitação em qualquer uma delas só apareceria quando
 * alguém clicasse no card, em produção, e recebesse 404 ou um arquivo sem tipo.
 *
 * Estes testes fecham as duas pontas contra o disco.
 */

const RAIZ_API = join(process.cwd(), "app", "api");
const DIR_DOSSIES = join(RAIZ_API, "modulos", "dossies");

/** `/api/modulos/dossies/escolas` → o arquivo de rota correspondente. */
function arquivoDaRota(endpoint: string): string {
  const caminho = endpoint.replace(/^\/api\//, "").split("?")[0];
  return join(RAIZ_API, caminho, "route.ts");
}

describe("catálogo de documentos da tela de emissão", () => {
  it("tem um card para cada dossiê e para os quatro relatórios originais", () => {
    expect(DOCUMENTOS.length).toBeGreaterThanOrEqual(12);
  });

  it("não repete id nem endpoint", () => {
    const ids = DOCUMENTOS.map((d) => d.id);
    const endpoints = DOCUMENTOS.map((d) => d.endpoint);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(endpoints).size).toBe(endpoints.length);
  });

  /** A ponta que o TypeScript não vê: o endpoint existe no disco? */
  it("todo endpoint aponta para uma rota que existe", () => {
    for (const documento of DOCUMENTOS) {
      expect(
        existsSync(arquivoDaRota(documento.endpoint)),
        `${documento.nome}: rota ${documento.endpoint} não existe`,
      ).toBe(true);
    }
  });

  it("todo reportType está registrado e tem rótulo", () => {
    for (const documento of DOCUMENTOS) {
      expect(CITY_REPORT_TYPES).toContain(documento.reportType);
      expect(CITY_REPORT_TYPE_LABELS[documento.reportType]).toBeTruthy();
    }
  });

  /**
   * O inverso, que é o esquecimento mais provável: escrever a rota do dossiê,
   * testar por `curl`, e nunca criar o card. A rota fica órfã — funciona e
   * ninguém consegue chegar nela pela tela.
   */
  it("não existe rota de dossiê sem card na tela", () => {
    const emitidos = new Set(DOCUMENTOS.map((d) => d.endpoint));

    for (const pasta of readdirSync(DIR_DOSSIES, { withFileTypes: true })) {
      if (!pasta.isDirectory()) continue;
      const endpoint = `/api/modulos/dossies/${pasta.name}`;
      expect(emitidos.has(endpoint), `rota ${endpoint} não tem card na tela`).toBe(true);
    }
  });

  /**
   * `paginas: 0` é a convenção para "o tamanho é função do município" — a
   * medida real vem da prévia da rota. Um dossiê com número fixo mentiria.
   */
  it("os dossiês não anunciam contagem fixa de páginas", () => {
    for (const documento of DOCUMENTOS.filter((d) => d.id.startsWith("dossie-"))) {
      expect(documento.paginas, `${documento.nome} anuncia ${documento.paginas} páginas`).toBe(0);
    }
  });

  /**
   * O card anuncia o tamanho antes de gerar, e o gerador tem contrato de
   * folhas. Eram dois números soltos: o card do Raio-X dizia 41 enquanto o
   * relatório entregava 40, e nada quebrou — o usuário é que descobriria, ao
   * abrir o PDF. Agora a constante é a mesma nos dois lados.
   */
  it("o que o card anuncia é o contrato do gerador", () => {
    const esperado: Record<string, number> = {
      "raio-x": PAGINAS_ESPERADAS_RAIO_X,
      "historico-censo": PAGINAS_ESPERADAS_HISTORICO_CENSO,
      "oficio-documentos": PAGINAS_ESPERADAS_OFICIO,
    };

    for (const [id, paginas] of Object.entries(esperado)) {
      const documento = DOCUMENTOS.find((d) => d.id === id);
      expect(documento, `card ${id} sumiu do catálogo`).toBeDefined();
      expect(documento!.paginas, `${documento!.nome} anuncia página a mais ou a menos`).toBe(paginas);
    }
  });

  it("todo card tem descrição e lista de conteúdo", () => {
    for (const documento of DOCUMENTOS) {
      expect(documento.descricao.length).toBeGreaterThan(30);
      expect(documento.conteudo.length).toBeGreaterThanOrEqual(4);
    }
  });

  /**
   * A empresa não tem contrato executado. A tela é a superfície mais exposta
   * do produto e a mais fácil de esquecer numa revisão de texto.
   */
  it("nenhum card afirma histórico de contratos", () => {
    const texto = DOCUMENTOS.map((d) => `${d.nome} ${d.descricao} ${d.conteudo.join(" ")}`).join(" ");
    for (const proibido of [/j[áa] recuperamos/i, /nossos clientes/i, /case de sucesso/i]) {
      expect(texto).not.toMatch(proibido);
    }
  });
});
