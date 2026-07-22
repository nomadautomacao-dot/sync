export type GroupRole = "owner" | "admin" | "member" | "viewer";

type ModulePermission = "read" | "write" | "admin";

const roleRank: Record<GroupRole, number> = {
  owner: 5,
  admin: 4,
  member: 2,
  viewer: 1,
};

