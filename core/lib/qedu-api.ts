const CACHE_TTL_MS = 1000 * 60 * 30;
const IDEB_YEARS = [2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019, 2021, 2023] as const;
const PREFERRED_DEPENDENCIA_IDS = [3, 5, 0] as const;

interface CacheEntry<T> {
  loadedAt: number;
  data: T;
}

interface QeduIdebApiItem {
  ano?: number | string | null;
  ciclo_id?: string | null;
  dependencia_id?: number | string | null;
  ideb?: number | string | null;
  ideb_projetado?: number | string | null;
}

interface QeduIdebProjectionApiItem {
  ano?: number | string | null;
  ciclo_id?: string | null;
  dependencia_id?: number | string | null;
  ideb?: number | string | null;
}

interface QeduIdebApprovalApiItem {
  ano?: number | string | null;
  ciclo_id?: string | null;
  dependencia_id?: number | string | null;
  taxa_aprovacao?: number | string | null;
  serie?: number | string | null;
}

export interface QeduIdebHistoryPoint {
  ano: number;
  metaProjetada: number | null;
  idebVerificado: number | null;
}

export interface QeduMunicipalIdebHistory {
  anosIniciais: QeduIdebHistoryPoint[];
  anosFinais: QeduIdebHistoryPoint[];
  fonte: string;
  dependenciaIdPreferida: number | null;
}

export interface QeduMunicipalIdebProjection {
  ano: number | null;
  dependenciaId: number | null;
  ciclos: Record<string, number | null>;
  fonte: string;
}

export interface QeduMunicipalIdebApproval {
  ano: number | null;
  dependenciaId: number | null;
  ciclos: Record<string, number | null>;
  fonte: string;
}

export interface QeduMunicipalApiSnapshot {
  historicoIdeb: QeduMunicipalIdebHistory | null;
  idebProjecoes: QeduMunicipalIdebProjection | null;
  idebAprovacoes: QeduMunicipalIdebApproval | null;
}

const remoteCache = new Map<string, CacheEntry<QeduMunicipalApiSnapshot | null>>();

function withinCache<T>(cache: CacheEntry<T> | null | undefined) {
  return Boolean(cache && Date.now() - cache.loadedAt < CACHE_TTL_MS);
}

function getQeduToken() {
  return process.env.QEDU_TOKEN?.trim() ?? "";
}

function getQeduApiBaseUrl() {
  return (process.env.QEDU_API_BASE_URL?.trim() || "https://api.qedu.org.br/v1").replace(/\/+$/, "");
}

function isQeduApiEnabled() {
  return Boolean(getQeduToken());
}

function toNumberOrNull(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeCycleId(value: unknown) {
  const cycle = String(value ?? "")
    .trim()
    .toUpperCase();

  if (cycle === "AI" || cycle === "AF" || cycle === "EM") {
    return cycle;
  }

  return "";
}

function extractArrayPayload<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown[] }).data)) {
    return (payload as { data: T[] }).data;
  }

  return [];
}

async function fetchQeduArray<T>(path: string, params: Record<string, string | number | undefined>) {
  const token = getQeduToken();
  if (!token) {
    return [] as T[];
  }

  const url = new URL(`${getQeduApiBaseUrl()}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "Sync/1.0",
    },
    next: { revalidate: 60 * 30 },
  });

  if (!response.ok) {
    return [] as T[];
  }

  const payload = (await response.json()) as unknown;
  return extractArrayPayload<T>(payload);
}

function pickPreferredByDependencia<T extends { dependencia_id?: number | string | null }>(items: T[]) {
  for (const dependenciaId of PREFERRED_DEPENDENCIA_IDS) {
    const match = items.find((item) => toNumberOrNull(item.dependencia_id) === dependenciaId);
    if (match) {
      return match;
    }
  }

  return items[0] ?? null;
}

function buildHistoryFromIdebApi(itemsByYear: Array<{ ano: number; items: QeduIdebApiItem[] }>): QeduMunicipalIdebHistory | null {
  const anosIniciais: QeduIdebHistoryPoint[] = [];
  const anosFinais: QeduIdebHistoryPoint[] = [];
  const dependenciaIds = new Set<number>();

  for (const { ano, items } of itemsByYear) {
    const ai = pickPreferredByDependencia(
      items.filter((item) => normalizeCycleId(item.ciclo_id) === "AI"),
    );
    const af = pickPreferredByDependencia(
      items.filter((item) => normalizeCycleId(item.ciclo_id) === "AF"),
    );

    if (ai) {
      const dependenciaId = toNumberOrNull(ai.dependencia_id);
      if (dependenciaId !== null) {
        dependenciaIds.add(dependenciaId);
      }
    }

    if (af) {
      const dependenciaId = toNumberOrNull(af.dependencia_id);
      if (dependenciaId !== null) {
        dependenciaIds.add(dependenciaId);
      }
    }

    anosIniciais.push({
      ano,
      metaProjetada: toNumberOrNull(ai?.ideb_projetado),
      idebVerificado: toNumberOrNull(ai?.ideb),
    });
    anosFinais.push({
      ano,
      metaProjetada: toNumberOrNull(af?.ideb_projetado),
      idebVerificado: toNumberOrNull(af?.ideb),
    });
  }

  const possuiDados = [...anosIniciais, ...anosFinais].some(
    (item) => item.metaProjetada !== null || item.idebVerificado !== null,
  );

  if (!possuiDados) {
    return null;
  }

  return {
    anosIniciais,
    anosFinais,
    fonte: "QEdu API / IDEB historico municipal",
    dependenciaIdPreferida: dependenciaIds.size === 1 ? [...dependenciaIds][0] : null,
  };
}

function buildProjectionFromApi(items: QeduIdebProjectionApiItem[]): QeduMunicipalIdebProjection | null {
  if (items.length === 0) {
    return null;
  }

  const preferredItems = PREFERRED_DEPENDENCIA_IDS.flatMap((dependenciaId) =>
    items.filter((item) => toNumberOrNull(item.dependencia_id) === dependenciaId),
  );
  const sourceItems = preferredItems.length > 0 ? preferredItems : items;
  const latestYear = Math.max(
    ...sourceItems.map((item) => toNumberOrNull(item.ano) ?? Number.NEGATIVE_INFINITY),
  );

  if (!Number.isFinite(latestYear)) {
    return null;
  }

  const latestItems = sourceItems.filter((item) => (toNumberOrNull(item.ano) ?? -1) === latestYear);
  const ai = pickPreferredByDependencia(latestItems.filter((item) => normalizeCycleId(item.ciclo_id) === "AI"));
  const af = pickPreferredByDependencia(latestItems.filter((item) => normalizeCycleId(item.ciclo_id) === "AF"));
  const em = pickPreferredByDependencia(latestItems.filter((item) => normalizeCycleId(item.ciclo_id) === "EM"));

  const dependenciaId =
    toNumberOrNull(ai?.dependencia_id) ??
    toNumberOrNull(af?.dependencia_id) ??
    toNumberOrNull(em?.dependencia_id);

  return {
    ano: latestYear,
    dependenciaId,
    ciclos: {
      AI: toNumberOrNull(ai?.ideb),
      AF: toNumberOrNull(af?.ideb),
      EM: toNumberOrNull(em?.ideb),
    },
    fonte: "QEdu API / IDEB projecoes",
  };
}

function buildApprovalFromApi(items: QeduIdebApprovalApiItem[]): QeduMunicipalIdebApproval | null {
  if (items.length === 0) {
    return null;
  }

  const filtered = items.filter((item) => (toNumberOrNull(item.serie) ?? 0) === 0);
  const sourceItems = filtered.length > 0 ? filtered : items;
  const latestYear = Math.max(
    ...sourceItems.map((item) => toNumberOrNull(item.ano) ?? Number.NEGATIVE_INFINITY),
  );

  if (!Number.isFinite(latestYear)) {
    return null;
  }

  const latestItems = sourceItems.filter((item) => (toNumberOrNull(item.ano) ?? -1) === latestYear);
  const ai = pickPreferredByDependencia(latestItems.filter((item) => normalizeCycleId(item.ciclo_id) === "AI"));
  const af = pickPreferredByDependencia(latestItems.filter((item) => normalizeCycleId(item.ciclo_id) === "AF"));
  const em = pickPreferredByDependencia(latestItems.filter((item) => normalizeCycleId(item.ciclo_id) === "EM"));

  const dependenciaId =
    toNumberOrNull(ai?.dependencia_id) ??
    toNumberOrNull(af?.dependencia_id) ??
    toNumberOrNull(em?.dependencia_id);

  return {
    ano: latestYear,
    dependenciaId,
    ciclos: {
      AI: toNumberOrNull(ai?.taxa_aprovacao),
      AF: toNumberOrNull(af?.taxa_aprovacao),
      EM: toNumberOrNull(em?.taxa_aprovacao),
    },
    fonte: "QEdu API / IDEB aprovacoes",
  };
}

export async function getQeduMunicipalApiSnapshot(codigoIBGE: string): Promise<QeduMunicipalApiSnapshot | null> {
  const digits = codigoIBGE.replace(/\D/g, "");
  if (digits.length !== 7 || !isQeduApiEnabled()) {
    return null;
  }

  const cached = remoteCache.get(digits);
  if (withinCache(cached)) {
    return cached?.data ?? null;
  }

  const [idebByYear, projectionResponses, approvalByYear] = await Promise.all([
    Promise.all(
      IDEB_YEARS.map(async (ano) => ({
        ano,
        items: await fetchQeduArray<QeduIdebApiItem>("/ideb", { id: digits, ano }),
      })),
    ),
    Promise.all(
      PREFERRED_DEPENDENCIA_IDS.map((dependenciaId) =>
        fetchQeduArray<QeduIdebProjectionApiItem>("/ideb/projecoes", {
          id: digits,
          dependencia_id: dependenciaId,
        }),
      ),
    ),
    Promise.all(
      IDEB_YEARS.map(async (ano) => ({
        ano,
        items: await fetchQeduArray<QeduIdebApprovalApiItem>("/ideb/aprovacoes", {
          id: digits,
          ano,
          serie_id: 0,
        }),
      })),
    ),
  ]);

  const historicoIdeb = buildHistoryFromIdebApi(idebByYear);
  const idebProjecoes = buildProjectionFromApi(projectionResponses.flat());
  const idebAprovacoes = buildApprovalFromApi(approvalByYear.flatMap((entry) => entry.items));

  const snapshot =
    historicoIdeb || idebProjecoes || idebAprovacoes
      ? {
          historicoIdeb,
          idebProjecoes,
          idebAprovacoes,
        }
      : null;

  remoteCache.set(digits, {
    loadedAt: Date.now(),
    data: snapshot,
  });

  return snapshot;
}
