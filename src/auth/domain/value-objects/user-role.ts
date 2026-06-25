export const ROLE_HIERARCHY = ['admin', 'user'] as const;

export type UserRole = (typeof ROLE_HIERARCHY)[number];

export function hasRequiredRole(
  userRoles: UserRole[],
  required: UserRole,
): boolean {
  const requiredIdx = ROLE_HIERARCHY.indexOf(required);
  return userRoles.some((ur) => ROLE_HIERARCHY.indexOf(ur) <= requiredIdx);
}

export function hasAllRoles(
  userRoles: UserRole[],
  required: UserRole[],
): boolean {
  return required.every((r) => hasRequiredRole(userRoles, r));
}
