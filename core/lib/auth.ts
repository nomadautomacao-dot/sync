import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { cookies } from "next/headers";
import { prisma } from "@/core/lib/prisma";
import { getSession as getCustomSession } from "@/core/lib/session-auth";
import {
  normalizeGroupRole,
  upsertSessionUser,
  type SessionUser,
} from "@/core/lib/user-provisioning";

export type { SessionUser };
export { upsertSessionUser };

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") {
        return false;
      }
      if (!user.email) {
        return false;
      }
      await upsertSessionUser(user.email, user.name);
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (!token.email) {
        return token;
      }

      if (user?.image) {
        token.picture = user.image;
      }

      const needsRefresh =
        trigger === "signIn" ||
        trigger === "update" ||
        !token.appUserId ||
        !token.groupId ||
        !token.groupRole;

      if (needsRefresh) {
        const appUser = await upsertSessionUser(token.email, user?.name ?? token.name?.toString());
        token.appUserId = appUser.id;
        token.groupId = appUser.groupId;
        token.groupRole = appUser.groupRole;
        token.name = appUser.name;
      }

      return token;
    },
    async session({ session, token }) {
      if (!session.user || !token.email) {
        return session;
      }

      if (!token.appUserId || !token.groupId || !token.groupRole) {
        const appUser = await upsertSessionUser(token.email, token.name?.toString());
        session.user.id = appUser.id;
        session.user.name = appUser.name;
        session.user.email = appUser.email;
        session.user.groupId = appUser.groupId;
        session.user.groupRole = appUser.groupRole;
        session.user.image =
          typeof token.picture === "string" ? token.picture : session.user.image;
        return session;
      }

      session.user.id = String(token.appUserId);
      session.user.name = typeof token.name === "string" ? token.name : session.user.name ?? "";
      session.user.email = String(token.email);
      session.user.groupId = String(token.groupId);
      session.user.groupRole = normalizeGroupRole(String(token.groupRole));
      session.user.image =
        typeof token.picture === "string" ? token.picture : session.user.image;
      return session;
    },
  },
};

export async function getSessionUser(): Promise<SessionUser | null> {
  // 1. Try NextAuth JWT session (Google OAuth)
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    if (session.user.id && session.user.groupId && session.user.groupRole) {
      return {
        id: session.user.id,
        name: session.user.name ?? session.user.email,
        email: session.user.email,
        groupId: session.user.groupId,
        groupRole: session.user.groupRole,
      };
    }
    return upsertSessionUser(session.user.email, session.user.name);
  }

  // 2. Fallback: check custom session_token cookie (Flutter / direct login)
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("session_token");
    if (tokenCookie?.value) {
      const customSession = await getCustomSession(tokenCookie.value);
      if (customSession?.user?.email) {
        return upsertSessionUser(customSession.user.email, customSession.user.name);
      }
    }
  } catch {
    // cookies() may fail in some contexts — gracefully degrade
  }

  return null;
}
