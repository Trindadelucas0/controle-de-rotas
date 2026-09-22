import type { SessionUser } from '@/lib/auth';
import { isNavActive, visibleNavGroups, type NavItem } from '@/components/layout/AppNav';
import { roleAllowed } from '@/lib/roles';

/** Destinos da bottom nav por papel (ordem = ordem na barra). Sempre ≤4 + botão Mais. */
const PRIMARY_BY_ROLE: Record<string, string[]> = {
  EMPLOYEE: ['/', '/agenda', '/field/my-route'],
  SUPERVISOR: ['/', '/agenda', '/map', '/routes'],
  MANAGER: ['/', '/agenda', '/map', '/routes'],
  ADMIN: ['/', '/agenda', '/map', '/routes'],
  PLATFORM_ADMIN: ['/', '/agenda', '/map', '/routes'],
};

const DEFAULT_PRIMARY = ['/', '/agenda'];

function primaryHrefsForRole(role: string): string[] {
  return PRIMARY_BY_ROLE[role] ?? DEFAULT_PRIMARY;
}

/** Itens da bottom nav já filtrados pelo RBAC de NAV_GROUPS. */
export function primaryNavItems(user: SessionUser): NavItem[] {
  const hrefs = primaryHrefsForRole(user.role);
  const allowed = new Map<string, NavItem>();
  for (const g of visibleNavGroups(user)) {
    for (const item of g.items) {
      allowed.set(item.href, item);
    }
  }
  return hrefs.map((h) => allowed.get(h)).filter((x): x is NavItem => Boolean(x));
}

/** Grupos para o sheet “Mais”: remove itens que já estão na bottom nav. */
export function moreNavGroups(user: SessionUser) {
  const primary = new Set(primaryNavItems(user).map((i) => i.href));
  return visibleNavGroups(user)
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !primary.has(i.href) && roleAllowed(user.role, i.roles)),
    }))
    .filter((g) => g.items.length > 0);
}

export function isPrimaryNavActive(pathname: string, href: string) {
  return isNavActive(pathname, href);
}

/** Destino ativo está só no “Mais” (não na bar). */
export function isMoreSectionActive(pathname: string, user: SessionUser) {
  const primary = new Set(primaryNavItems(user).map((i) => i.href));
  for (const g of visibleNavGroups(user)) {
    for (const item of g.items) {
      if (primary.has(item.href)) continue;
      if (isNavActive(pathname, item.href)) return true;
    }
  }
  return false;
}
