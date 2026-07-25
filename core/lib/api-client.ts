/**
 * Cliente HTTP das rotas do BFF. Sem consumidor por ora: a Fase 1 lê o Firestore
 * direto. As Fases 4-5 (FUNDEB e geradores de PDF), que são BFF-only, são as
 * consumidoras previstas — não é código morto.
 */

import { getFirebaseAuth } from "./firebase-client";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export function withAuthHeader(init: RequestInit, token: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new ApiError(401, "NO_SESSION", "Sessão ausente.");
  const token = await user.getIdToken();
  const res = await fetch(path, withAuthHeader(init, token));
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.code ?? "HTTP_ERROR", body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}
