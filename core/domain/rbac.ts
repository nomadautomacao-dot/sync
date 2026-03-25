export type GroupRole = "owner" | "admin" | "member" | "viewer";
export type CompanyRole =
  | "director"
  | "manager"
  | "coordinator"
  | "analyst"
  | "operator";
export type ModulePermission = "read" | "write" | "admin";

const roleRank: Record<GroupRole, number> = {
  owner: 5,
  admin: 4,
  member: 2,
  viewer: 1,
};

export function canManageCompanies(role: GroupRole) {
  return roleRank[role] >= roleRank.admin;
}

export function canManageWorkspace(role: GroupRole) {
  return roleRank[role] >= roleRank.admin;
}

export function canOperateModule(permission: ModulePermission) {
  return permission === "write" || permission === "admin";
}
