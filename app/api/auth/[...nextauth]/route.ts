import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { normalizeGroupRole, upsertSessionUser } from "@/core/lib/user-provisioning";

/**
 * Handler legado do login Google via NextAuth.
 *
 * `authOptions` morava em `core/lib/auth.ts`, mas essa migrou para verificar o
 * ID token do Firebase (Task 2 da migracao) e nao pode mais importar
 * next-auth. A sessao que este handler gera ja nao e mais lida por
 * `getSessionUser()` — este arquivo e removido por completo na Task 5, junto
 * com o resto do login artesanal.
 */
const authOptions: NextAuthOptions = {
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

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
