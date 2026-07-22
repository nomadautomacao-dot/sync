import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface GoviaRegistryMunicipio {
  codigo_ibge: string;
  nome: string;
  uf: string;
  regiao?: string;
  created_at?: string;
  updated_at?: string;
  ultimo_acesso?: string;
  acessos?: number;
  in_carteira?: boolean;
}

interface GoviaRegistryStore {
  municipios: GoviaRegistryMunicipio[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "govia-municipios-store.json");

async function ensureStoreFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(STORE_FILE, "utf-8");
  } catch {
    const initialStore: GoviaRegistryStore = { municipios: [] };
    await writeFile(STORE_FILE, JSON.stringify(initialStore, null, 2), "utf-8");
  }
}

async function readStore(): Promise<GoviaRegistryStore> {
  await ensureStoreFile();

  try {
    const raw = await readFile(STORE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as GoviaRegistryStore;
    return {
      municipios: Array.isArray(parsed.municipios) ? parsed.municipios : [],
    };
  } catch {
    return { municipios: [] };
  }
}

async function writeStore(store: GoviaRegistryStore) {
  await ensureStoreFile();
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function normalizeItem(item: GoviaRegistryMunicipio): GoviaRegistryMunicipio {
  return {
    codigo_ibge: item.codigo_ibge,
    nome: item.nome,
    uf: item.uf.toUpperCase(),
    regiao: item.regiao ?? "",
    created_at: item.created_at,
    updated_at: item.updated_at,
    ultimo_acesso: item.ultimo_acesso,
    acessos: item.acessos ?? 0,
    in_carteira: item.in_carteira ?? false,
  };
}

export async function listGoviaCarteira(limit = 200) {
  const store = await readStore();
  return store.municipios
    .filter((item) => item.in_carteira)
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
    .slice(0, limit)
    .map(normalizeItem);
}

export async function upsertGoviaCarteira(item: GoviaRegistryMunicipio) {
  const store = await readStore();
  const now = new Date().toISOString();
  const existingIndex = store.municipios.findIndex((entry) => entry.codigo_ibge === item.codigo_ibge);

  const nextItem: GoviaRegistryMunicipio = normalizeItem({
    ...store.municipios[existingIndex],
    ...item,
    created_at: store.municipios[existingIndex]?.created_at ?? now,
    updated_at: now,
    ultimo_acesso: item.ultimo_acesso ?? store.municipios[existingIndex]?.ultimo_acesso ?? now,
    acessos: item.acessos ?? store.municipios[existingIndex]?.acessos ?? 0,
    in_carteira: true,
  });

  if (existingIndex >= 0) {
    store.municipios[existingIndex] = nextItem;
  } else {
    store.municipios.push(nextItem);
  }

  await writeStore(store);
  return nextItem;
}

export async function listGoviaRecentes(limit = 20) {
  const store = await readStore();
  return store.municipios
    .filter((item) => item.ultimo_acesso)
    .sort((a, b) => (b.ultimo_acesso ?? "").localeCompare(a.ultimo_acesso ?? ""))
    .slice(0, limit)
    .map(normalizeItem);
}

export async function markGoviaMunicipioAccess(item: GoviaRegistryMunicipio) {
  const store = await readStore();
  const now = new Date().toISOString();
  const existingIndex = store.municipios.findIndex((entry) => entry.codigo_ibge === item.codigo_ibge);

  const nextItem: GoviaRegistryMunicipio = normalizeItem({
    ...store.municipios[existingIndex],
    ...item,
    created_at: store.municipios[existingIndex]?.created_at ?? now,
    updated_at: now,
    ultimo_acesso: now,
    acessos: (store.municipios[existingIndex]?.acessos ?? 0) + 1,
    in_carteira: store.municipios[existingIndex]?.in_carteira ?? false,
  });

  if (existingIndex >= 0) {
    store.municipios[existingIndex] = nextItem;
  } else {
    store.municipios.push(nextItem);
  }

  await writeStore(store);
  return nextItem;
}
