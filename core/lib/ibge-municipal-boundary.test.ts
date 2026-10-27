import { describe, expect, it, vi } from "vitest";

import {
  fetchMunicipalBoundary,
  municipalBoundaryFromGeoJson,
  loadBundledMunicipalBoundary,
} from "@/core/lib/ibge-municipal-boundary";

describe("malha municipal para a capa do Raio-X", () => {
  const polygon = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-40.2, -10.6],
          [-39.8, -10.6],
          [-39.8, -10.2],
          [-40.2, -10.2],
          [-40.2, -10.6],
        ]],
      },
    }],
  };

  it("normaliza um GeoJSON do IBGE em um SVG autocontido", () => {
    const boundary = municipalBoundaryFromGeoJson(polygon);

    expect(boundary?.viewBox).toBe("0 0 720 720");
    expect(boundary?.source).toContain("IBGE");
    expect(boundary?.path).toMatch(/^M \d+\.\d{2} \d+\.\d{2}/);
    expect(boundary?.path).toContain(" Z");
  });

  it("consulta a malha detalhada pelo código IBGE", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(polygon), { status: 200 }));

    const boundary = await fetchMunicipalBoundary("2930105", fetcher as typeof fetch);

    expect(boundary).not.toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
    const [url] = fetcher.mock.calls[0]!;
    expect(String(url)).toContain("/municipios/2930105");
    expect(String(url)).toContain("qualidade=maxima");
  });

  it("não tenta consultar código inválido", async () => {
    const fetcher = vi.fn();

    await expect(fetchMunicipalBoundary("não informado", fetcher as typeof fetch))
      .resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserva o contorno real de Fortaleza quando a consulta falha na nuvem", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => { throw new Error('rede indisponível'); });
    const boundary = await fetchMunicipalBoundary('2304400', fetcher);
    expect(boundary).not.toBeNull();
    expect(boundary?.path.length).toBeGreaterThan(2000);
    expect(boundary?.source).toContain('cópia oficial');
    expect(boundary).toEqual(loadBundledMunicipalBoundary('2304400'));
  });

  it("usa a malha embarcada também para resposta HTTP indisponível", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('', {status:503}));
    expect((await fetchMunicipalBoundary('2924009', fetcher))?.path).toMatch(/^M /);
    expect(loadBundledMunicipalBoundary('9999999')).toBeNull();
    expect(loadBundledMunicipalBoundary('../2304400')).toBeNull();
  });
});
