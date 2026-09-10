/** PLATFORM_ADMIN herda poderes de ADMIN no tenant “casa”. */
export function isAdminLike(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'PLATFORM_ADMIN';
}

export function isPlatformAdmin(role?: string | null): boolean {
  return role === 'PLATFORM_ADMIN';
}

export function roleAllowed(userRole: string | undefined | null, allowed?: string[]): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (!userRole) return false;
  if (allowed.includes(userRole)) return true;
  if (userRole === 'PLATFORM_ADMIN' && allowed.includes('ADMIN')) return true;
  return false;
}
