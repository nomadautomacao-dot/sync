export interface MunicipalBoundaryMap {
  path: string;
  viewBox: string;
  source: string;
  /**
   * Parâmetros da projeção equiretangular usada para gerar o path — permitem
   * plotar pontos (escolas, sedes) no MESMO plano do contorno.
   */
  projection: {
    minX: number;
    maxY: number;
    scale: number;
    offsetX: number;
    offsetY: number;
  };
}

/** Projeta um par lng/lat no plano do contorno. */
export function projectToBoundary(
  boundary: MunicipalBoundaryMap,
  longitude: number,
  latitude: number,
): { x: number; y: number } {
  const { minX, maxY, scale, offsetX, offsetY } = boundary.projection;
  return {
    x: offsetX + (longitude - minX) * scale,
    y: offsetY + (maxY - latitude) * scale,
  };
}

type Position = [number, number];
type LinearRing = Position[];
type PolygonCoordinates = LinearRing[];
type MultiPolygonCoordinates = PolygonCoordinates[];

interface GeoJsonGeometry {
  type?: unknown;
  coordinates?: unknown;
}

interface GeoJsonFeature {
  geometry?: GeoJsonGeometry | null;
}

interface GeoJsonFeatureCollection {
  type?: unknown;
  features?: GeoJsonFeature[];
}

const MAP_SIZE = 720;
const MAP_PADDING = 42;
const SOURCE = "IBGE — Malhas Territoriais";
const cache = new Map<string, MunicipalBoundaryMap>();

function finitePosition(value: unknown): value is Position {
  return Array.isArray(value)
    && value.length >= 2
    && typeof value[0] === "number"
    && Number.isFinite(value[0])
    && typeof value[1] === "number"
    && Number.isFinite(value[1]);
}

function ringsFromGeometry(geometry: GeoJsonGeometry | null | undefined): LinearRing[] {
  if (!geometry) return [];

  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
    return (geometry.coordinates as PolygonCoordinates)
      .filter((ring) => Array.isArray(ring) && ring.every(finitePosition));
  }

  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    return (geometry.coordinates as MultiPolygonCoordinates)
      .flatMap((polygon) => Array.isArray(polygon) ? polygon : [])
      .filter((ring) => Array.isArray(ring) && ring.every(finitePosition));
  }

  return [];
}

function geometryFromPayload(payload: unknown): GeoJsonGeometry | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as GeoJsonFeatureCollection & GeoJsonFeature & GeoJsonGeometry;

  if (record.type === "FeatureCollection") {
    return record.features?.find((feature) => feature?.geometry)?.geometry ?? null;
  }

  if (record.type === "Feature") return record.geometry ?? null;
  if (record.type === "Polygon" || record.type === "MultiPolygon") return record;
  return null;
}

/**
 * Converte a malha oficial em um path SVG autocontido. Assim o PDF não depende
 * de carregar imagem ou tile remoto dentro do Chromium.
 */
export function municipalBoundaryFromGeoJson(payload: unknown): MunicipalBoundaryMap | null {
  const rings = ringsFromGeometry(geometryFromPayload(payload));
  const points = rings.flat();
  if (!points.length) return null;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0 || height <= 0) return null;

  const drawable = MAP_SIZE - MAP_PADDING * 2;
  const scale = Math.min(drawable / width, drawable / height);
  const renderedWidth = width * scale;
  const renderedHeight = height * scale;
  const offsetX = (MAP_SIZE - renderedWidth) / 2;
  const offsetY = (MAP_SIZE - renderedHeight) / 2;

  const project = ([longitude, latitude]: Position) => {
    const x = offsetX + (longitude - minX) * scale;
    // SVG cresce para baixo; a latitude geográfica cresce para cima.
    const y = offsetY + (maxY - latitude) * scale;
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  };

  const path = rings
    .filter((ring) => ring.length >= 3)
    .map((ring) => `M ${ring.map(project).join(" L ")} Z`)
    .join(" ");

  return path
    ? {
        path,
        viewBox: `0 0 ${MAP_SIZE} ${MAP_SIZE}`,
        source: SOURCE,
        projection: { minX, maxY, scale, offsetX, offsetY },
      }
    : null;
}

export async function fetchMunicipalBoundary(
  ibgeCode: string,
  fetcher: typeof fetch = fetch,
): Promise<MunicipalBoundaryMap | null> {
  const normalizedCode = ibgeCode.trim();
  if (!/^\d{7}$/.test(normalizedCode)) return null;

  const cached = cache.get(normalizedCode);
  if (cached) return cached;

  try {
    const url = new URL(
      `https://servicodados.ibge.gov.br/api/v3/malhas/municipios/${normalizedCode}`,
    );
    url.searchParams.set("formato", "application/vnd.geo+json");
    url.searchParams.set("qualidade", "minima");

    const response = await fetcher(url, {
      headers: { Accept: "application/vnd.geo+json" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return null;

    const boundary = municipalBoundaryFromGeoJson(await response.json());
    if (boundary) cache.set(normalizedCode, boundary);
    return boundary;
  } catch {
    // A capa possui fallback cartográfico; falha da malha nunca impede o PDF.
    return null;
  }
}
