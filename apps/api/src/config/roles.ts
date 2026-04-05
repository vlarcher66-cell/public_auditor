/** Roles que têm acesso total (equivalentes a SUPER_ADMIN) */
export const SUPER_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export function isSuperAdmin(role?: string): boolean {
  return SUPER_ADMIN_ROLES.includes(role ?? '');
}
