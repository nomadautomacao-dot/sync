import { headers } from "next/headers";
import { bearerToken, sessionUserFromClaims, type SessionUser } from "@/core/lib/auth-token";
import { firebaseAuth } from "@/core/lib/firebase-admin";

export type { SessionUser };

/**
 * Usuario da requisicao, a partir do ID token do Firebase.
 *
 * Nao consulta banco: groupId e groupRole vem das custom claims. Devolve null
 * em qualquer falha — token ausente, invalido, expirado ou sem as claims
 * necessarias. As rotas tratam null como 401.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = bearerToken((await headers()).get("authorization"));
  if (!token) return null;

  try {
    const decoded = await firebaseAuth().verifyIdToken(token);
    return sessionUserFromClaims(decoded);
  } catch {
    return null;
  }
}
