import { sessionUserFromClaims, type SessionUser } from "@/core/lib/auth-token";

/** Sessão no cliente. Mesma forma do SessionUser do BFF — de propósito. */
export type ClientUser = SessionUser;

/**
 * Mapeia as claims do ID token para ClientUser reusando a regra do BFF.
 *
 * `uid`/`email` nem sempre aparecem nas custom claims; o objeto `User` do
 * Firebase é a fonte deles no cliente. Claims têm precedência.
 */
export function clientUserFromClaims(
  claims: Record<string, unknown>,
  fallback: { uid: string; email: string | null },
): ClientUser | null {
  return sessionUserFromClaims({ uid: fallback.uid, email: fallback.email ?? undefined, ...claims });
}
