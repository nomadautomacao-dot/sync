import {
  CLAIM_PERMISSOES,
  ajustesDaClaim,
  permissoesEfetivas,
  type GroupRole,
  type Permissoes,
} from "@/core/domain/rbac";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  groupId: string;
  groupRole: GroupRole;
  /**
   * Já resolvidas: padrão do papel + ajustes da claim + as travas. Quem
   * consome não precisa saber que existe uma claim, e não há um segundo lugar
   * onde alguém possa esquecer de aplicar a trava.
   */
  permissoes: Permissoes;
}

const groupRoles: GroupRole[] = ["owner", "admin", "member", "viewer"];

/** Extrai o token de `Authorization: Bearer <token>`. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, ...rest] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer") return null;
  const token = rest.join("").trim();
  return token || null;
}

function normalizeGroupRole(value: unknown): GroupRole {
  return groupRoles.includes(value as GroupRole) ? (value as GroupRole) : "member";
}

/**
 * Monta o SessionUser a partir das claims de um ID token ja verificado.
 *
 * groupId e groupRole vivem em custom claims justamente para que a
 * autenticacao nao dependa de banco — ver a spec da migracao.
 */
export function sessionUserFromClaims(claims: Record<string, unknown>): SessionUser | null {
  const id = typeof claims.uid === "string" ? claims.uid : null;
  const email = typeof claims.email === "string" ? claims.email : null;
  const groupId = typeof claims.groupId === "string" ? claims.groupId : null;

  if (!id || !email || !groupId) return null;

  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name : email;
  const groupRole = normalizeGroupRole(claims.groupRole);

  return {
    id,
    name,
    email,
    groupId,
    groupRole,
    permissoes: permissoesEfetivas(
      groupRole,
      ajustesDaClaim(claims[CLAIM_PERMISSOES]),
    ),
  };
}
