import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import type { CityAccount } from "./city-types";
import { centsToReais, reaisToCents } from "./city-types";

const COLLECTION = "cities";

// --- Mappers (exported for testing) ---

export function cityFromDoc(
  id: string,
  data: Record<string, unknown>,
): CityAccount {
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const num = (v: unknown) => (typeof v === "number" ? v : 0);

  return {
    id,
    name: str(data.name) ?? "",
    uf: str(data.uf) ?? "",
    codigoIbge: str(data.codigoIbge) ?? "",
    region: str(data.region),
    status: str(data.status) ?? "ativo",
    stage: (str(data.stage) ?? "mapping") as CityAccount["stage"],
    collaboratorId: str(data.collaboratorId),
    collaboratorName: str(data.collaboratorName),
    parceiroId: str(data.parceiroId),
    parceiroName: str(data.parceiroName),
    estimatedAnnualRevenue: centsToReais(num(data.estimatedAnnualRevenueCents)),
    probability: typeof data.probability === "number" ? data.probability : 10,
    nextStepDescription: str(data.nextStepDescription),
    nextStepDueDate: str(data.nextStepDueDate),
    lastActivityAt: str(data.lastActivityAt),
    implantacaoInicio: str(data.implantacaoInicio),
  };
}

export function cityDocFromInput(
  input: Partial<CityAccount> & { name: string; uf: string },
  groupId: string,
): Record<string, unknown> {
  return {
    groupId,
    name: input.name,
    uf: input.uf,
    codigoIbge: input.codigoIbge ?? "",
    region: input.region ?? null,
    status: input.status ?? "ativo",
    stage: input.stage ?? "mapping",
    collaboratorId: input.collaboratorId ?? null,
    collaboratorName: input.collaboratorName ?? null,
    parceiroId: input.parceiroId ?? null,
    parceiroName: input.parceiroName ?? null,
    estimatedAnnualRevenueCents: input.estimatedAnnualRevenue
      ? reaisToCents(input.estimatedAnnualRevenue)
      : 0,
    probability: input.probability ?? 10,
    nextStepDescription: input.nextStepDescription ?? null,
    nextStepDueDate: input.nextStepDueDate ?? null,
    lastActivityAt: input.lastActivityAt ?? null,
    implantacaoInicio: input.implantacaoInicio ?? null,
    deletedAt: null,
  };
}

// --- CRUD ---

export async function listCities(
  db: Firestore,
  groupId: string,
  opts?: { search?: string; stage?: string },
): Promise<CityAccount[]> {
  const col = collection(db, COLLECTION);
  const q = query(
    col,
    where("groupId", "==", groupId),
    where("deletedAt", "==", null),
  );
  const snap = await getDocs(q);

  const term = (opts?.search ?? "").trim().toLowerCase();
  const wantStage = (opts?.stage ?? "").trim();

  return snap.docs
    .map((d) => cityFromDoc(d.id, d.data()))
    .filter((c) => {
      if (wantStage && c.stage !== wantStage) return false;
      if (term) {
        const hay = `${c.name} ${c.uf} ${c.codigoIbge}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
}

export async function createCity(
  db: Firestore,
  groupId: string,
  input: Partial<CityAccount> & { name: string; uf: string },
): Promise<CityAccount> {
  const col = collection(db, COLLECTION);
  const docData = cityDocFromInput(input, groupId);
  docData.createdAt = serverTimestamp();
  docData.updatedAt = serverTimestamp();
  const codigoIbge = input.codigoIbge?.trim();
  if (codigoIbge) {
    const deterministicId = `${encodeURIComponent(groupId)}--${codigoIbge}`;
    const ref = doc(db, COLLECTION, deterministicId);
    await setDoc(ref, docData, { merge: true });
    return cityFromDoc(ref.id, docData);
  }
  const ref = await addDoc(col, docData);
  return cityFromDoc(ref.id, docData);
}

export async function getCity(
  db: Firestore,
  cityId: string,
): Promise<CityAccount | null> {
  const snapshot = await getDoc(doc(db, COLLECTION, cityId));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return data.deletedAt == null ? cityFromDoc(snapshot.id, data) : null;
}

/**
 * Remove a cidade das consultas operacionais sem apagar seu histórico.
 * Relatórios e documentos ficam preservados nas coleções relacionadas.
 */
export async function deleteCity(db: Firestore, cityId: string): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, cityId),
    {
      status: "excluido",
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Resolve a cidade pelo código IBGE antes de criar. Relatórios e o wizard
 * passam por esta função para que pipeline, documentos e FUNDEB nunca abram
 * cadastros paralelos para o mesmo município.
 */
export async function ensureCity(
  db: Firestore,
  groupId: string,
  input: Partial<CityAccount> & { name: string; uf: string },
): Promise<CityAccount> {
  const cities = await listCities(db, groupId);
  const codigoIbge = input.codigoIbge?.trim();
  const existing = cities.find((city) =>
    codigoIbge
      ? city.codigoIbge === codigoIbge
      : city.name.trim().toLocaleLowerCase("pt-BR") ===
          input.name.trim().toLocaleLowerCase("pt-BR") &&
        city.uf.toUpperCase() === input.uf.toUpperCase(),
  );
  if (!existing) return createCity(db, groupId, input);

  const canonicalPatch: Record<string, unknown> = {};
  if (!existing.codigoIbge && codigoIbge) {
    canonicalPatch.codigoIbge = codigoIbge;
  }
  if (!existing.region && input.region) {
    canonicalPatch.region = input.region;
  }
  if (Object.keys(canonicalPatch).length) {
    canonicalPatch.updatedAt = serverTimestamp();
    await setDoc(doc(db, COLLECTION, existing.id), canonicalPatch, {
      merge: true,
    });
    return {
      ...existing,
      codigoIbge:
        (canonicalPatch.codigoIbge as string | undefined) ??
        existing.codigoIbge,
      region: (canonicalPatch.region as string | undefined) ?? existing.region,
    };
  }

  return existing;
}

/**
 * Grava os dois papéis da cidade — parceiro que agenciou e responsável
 * técnico. Campo limpo vira `null`, e não ausência: com `merge`, ausência
 * deixaria o valor antigo de pé e "remover o responsável" não removeria nada.
 */
export async function updateCityResponsaveis(
  db: Firestore,
  cityId: string,
  responsaveis: {
    collaboratorId?: string;
    collaboratorName?: string;
    parceiroId?: string;
    parceiroName?: string;
  },
): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, cityId),
    {
      collaboratorId: responsaveis.collaboratorId ?? null,
      collaboratorName: responsaveis.collaboratorName ?? null,
      parceiroId: responsaveis.parceiroId ?? null,
      parceiroName: responsaveis.parceiroName ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function updateCityStage(
  db: Firestore,
  cityId: string,
  stage: string,
): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, cityId),
    { stage, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function updateCityPipeline(
  db: Firestore,
  cityId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [key, value] of Object.entries(data)) {
    if (key === "groupId" || key === "deletedAt") continue;
    if (key === "estimatedAnnualRevenue" && typeof value === "number") {
      patch.estimatedAnnualRevenueCents = reaisToCents(value);
    } else if (key === "currentStage") {
      patch.stage = value;
    } else {
      patch[key] = value;
    }
  }
  await setDoc(doc(db, COLLECTION, cityId), patch, { merge: true });
}
