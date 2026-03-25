import type { GroupRole } from "@/core/domain/rbac";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      groupId: string;
      groupRole: GroupRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appUserId?: string;
    groupId?: string;
    groupRole?: GroupRole;
  }
}
