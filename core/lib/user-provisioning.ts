import type { GroupRole } from "@/core/domain/rbac";
import { prisma } from "@/core/lib/prisma";

/**
 * Provisionamento de usuário e grupo padrão.
 *
 * Vive separado de `auth.ts` e `session-auth.ts` porque as duas estratégias de
 * login precisam dele: NextAuth (Google) chama no callback de signIn, e o login
 * por email/senha do Flutter chama ao criar a sessão. Antes os dois arquivos se
 * importavam mutuamente para chegar aqui.
 */

const DEFAULT_GROUP_SLUG = process.env.SYNC_GROUP_SLUG?.trim() || "sync-default";
const DEFAULT_GROUP_NAME = process.env.SYNC_GROUP_NAME?.trim() || "Sync Holdings";

const groupRoles: GroupRole[] = ["owner", "admin", "member", "viewer"];

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  groupId: string;
  groupRole: GroupRole;
}

export function normalizeGroupRole(role: string): GroupRole {
  if (groupRoles.includes(role as GroupRole)) {
    return role as GroupRole;
  }
  return "member";
}

async function ensureDefaultGroup() {
  return prisma.group.upsert({
    where: { slug: DEFAULT_GROUP_SLUG },
    update: { name: DEFAULT_GROUP_NAME },
    create: {
      slug: DEFAULT_GROUP_SLUG,
      name: DEFAULT_GROUP_NAME,
    },
  });
}

export async function upsertSessionUser(email: string, name?: string | null): Promise<SessionUser> {
  const cleanEmail = email.trim().toLowerCase();
  const fallbackName = name?.trim() || cleanEmail.split("@")[0] || "Usuario";
  const group = await ensureDefaultGroup();

  const user = await prisma.user.upsert({
    where: { email: cleanEmail },
    update: {
      name: fallbackName,
      groupId: group.id,
    },
    create: {
      email: cleanEmail,
      name: fallbackName,
      groupId: group.id,
      groupRole: "member",
    },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    groupId: user.groupId,
    groupRole: normalizeGroupRole(user.groupRole),
  };
}
