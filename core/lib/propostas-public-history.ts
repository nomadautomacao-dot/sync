import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PropostaPublicValidationData } from "@/modules/propostas/types";

interface StoredValidationHistory {
  version: number;
  updatedAt: string;
  items: Record<string, PropostaPublicValidationData>;
}

const HISTORY_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(HISTORY_DIR, "propostas-public-validation-history.json");

let writeQueue = Promise.resolve();

function buildEmptyHistory(): StoredValidationHistory {
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    items: {},
  };
}

async function ensureHistoryFile() {
  await mkdir(HISTORY_DIR, { recursive: true });

  try {
    await readFile(HISTORY_FILE, "utf8");
  } catch {
    await writeFile(HISTORY_FILE, `${JSON.stringify(buildEmptyHistory(), null, 2)}\n`, "utf8");
  }
}

async function readHistory(): Promise<StoredValidationHistory> {
  await ensureHistoryFile();

  try {
    const raw = await readFile(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredValidationHistory>;

    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      updatedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      items: parsed.items && typeof parsed.items === "object" ? parsed.items : {},
    };
  } catch {
    return buildEmptyHistory();
  }
}

async function writeHistory(history: StoredValidationHistory) {
  await writeFile(HISTORY_FILE, `${JSON.stringify(history, null, 2)}\n`, "utf8");
}

export async function getStoredMunicipalityPublicValidation(codigoIbge: string) {
  const digits = codigoIbge.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  const history = await readHistory();
  return history.items[digits] ?? null;
}

export async function saveStoredMunicipalityPublicValidation(
  validation: PropostaPublicValidationData,
) {
  const digits = validation.codigoIbge.replace(/\D/g, "");
  if (!digits) {
    return;
  }

  writeQueue = writeQueue.then(async () => {
    const history = await readHistory();
    history.items[digits] = validation;
    history.updatedAt = new Date().toISOString();
    await writeHistory(history);
  });

  await writeQueue;
}
