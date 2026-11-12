import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/core/lib/relatorio-snapshot", () => ({ buildRelatorioSnapshot: vi.fn() }));
vi.mock("@/core/lib/plano-evolucao", () => ({ montarPlanoEvolucao: vi.fn() }));
vi.mock("@/core/lib/plano-evolucao-pdf", () => ({ generatePlanoEvolucaoPdf: vi.fn() }));
vi.mock("@/core/lib/structured-log", () => ({ registrarErro: vi.fn() }));

import { buildRelatorioSnapshot } from "@/core/lib/relatorio-snapshot";
import { montarPlanoEvolucao } from "@/core/lib/plano-evolucao";
import { generatePlanoEvolucaoPdf } from "@/core/lib/plano-evolucao-pdf";
import { POST } from "./route";

const request = (body: unknown) =>
  new NextRequest("http://localhost/api/modulos/levantamento-fundeb/plano-evolucao", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => vi.resetAllMocks());

describe("emissão do plano de evolução", () => {
  it.each([{}, { codigo_ibge: "123" }, { codigo_ibge: "5220454", exercicio: "2026" }, { codigo_ibge: "5220454", response_format: "html" }])(
    "rejeita pedido inválido antes da coleta: %j",
    async (body) => {
      expect((await POST(request(body))).status).toBe(400);
      expect(buildRelatorioSnapshot).not.toHaveBeenCalled();
    },
  );

  it("devolve a prévia sem abrir o Chromium", async () => {
    vi.mocked(buildRelatorioSnapshot).mockResolvedValue({ current: {}, qualidade: {} } as never);
    vi.mocked(montarPlanoEvolucao).mockReturnValue({ posicao: "perto", frentes: [] } as never);
    const r = await POST(request({ codigo_ibge: "5220454", exercicio: 2026, response_format: "preview" }));
    expect(await r.json()).toMatchObject({ posicao: "perto" });
    expect(generatePlanoEvolucaoPdf).not.toHaveBeenCalled();
  });

  it("arquiva como plano_evolucao, com o modelo usado", async () => {
    vi.mocked(buildRelatorioSnapshot).mockResolvedValue({ current: { payload: {} }, qualidade: { snapshotId: "base-1" } } as never);
    vi.mocked(montarPlanoEvolucao).mockReturnValue({
      municipio: "Senador Canedo", uf: "GO", codigoIbge: "5220454", exercicio: 2026, geradoEm: "2026-11-12T12:00:00Z", snapshotId: "base-1", frentes: [{}, {}],
    } as never);
    vi.mocked(generatePlanoEvolucaoPdf).mockResolvedValue({ pdfBuffer: Buffer.from("%PDF"), filename: "plano.pdf", paginas: 2, html: "" });
    const r = await POST(request({ codigo_ibge: "5220454", exercicio: 2026, response_format: "bundle" }));
    const b = await r.json();
    expect(b.archive.reportType).toBe("plano_evolucao");
    expect(b.archive.municipality.codigoIbge).toBe("5220454");
    expect(b.archive.data.context.plano.snapshotId).toBe("base-1");
    expect(b.diagnostics).toEqual({ paginas: 2, frentes: 2 });
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });

  it("falha do modelo vira 500 com a mensagem, e é registrada", async () => {
    vi.mocked(buildRelatorioSnapshot).mockResolvedValue({ current: {}, qualidade: {} } as never);
    vi.mocked(montarPlanoEvolucao).mockImplementation(() => {
      throw new Error("Sem ao menos dois Censos da rede municipal na base, não há ritmo para o plano.");
    });
    const r = await POST(request({ codigo_ibge: "5220454", exercicio: 2026, response_format: "bundle" }));
    expect(r.status).toBe(500);
    expect((await r.json()).error).toMatch(/dois Censos/);
  });
});
