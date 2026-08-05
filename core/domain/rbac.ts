export type GroupRole = "owner" | "admin" | "member" | "viewer";

type ModulePermission = "read" | "write" | "admin";

const roleRank: Record<GroupRole, number> = {
  owner: 5,
  admin: 4,
  member: 2,
  viewer: 1,
};

/**
 * Papel mínimo para operar o console de sistemas (`/sistemas`).
 *
 * O console cria conta, concede papel e escreve no banco de outro produto pelo
 * Admin SDK, que ignora as security rules dele. É o poder mais alto que existe
 * neste projeto — por isso a régua fica em `admin`, e quem estiver abaixo não
 * passa nem na tela nem na rota.
 */
const PAPEL_MINIMO_NO_CONSOLE: GroupRole = "admin";

export function podeAdministrarSistemas(papel: GroupRole | undefined | null): boolean {
  if (!papel) return false;
  return roleRank[papel] >= roleRank[PAPEL_MINIMO_NO_CONSOLE];
}

