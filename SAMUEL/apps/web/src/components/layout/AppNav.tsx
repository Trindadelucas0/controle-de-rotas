import type { SessionUser } from '@/lib/auth';
import { roleAllowed } from '@/lib/roles';

export type NavItem = { href: string; label: string; roles?: string[] };
export type NavGroup = { id: string; label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'operacao',
    label: 'Operação',
    items: [
      { href: '/', label: 'Início' },
      { href: '/map', label: 'Mapa', roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'] },
      { href: '/agenda', label: 'Agenda', roles: ['ADMIN', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE'] },
      { href: '/services', label: 'Serviços', roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'] },
      { href: '/routes', label: 'Rotas', roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'] },
      { href: '/field/my-route', label: 'Campo', roles: ['EMPLOYEE'] },
    ],
  },
  {
    id: 'recursos',
    label: 'Recursos',
    items: [
      { href: '/customers', label: 'Clientes', roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'] },
      { href: '/employees', label: 'Funcionários', roles: ['ADMIN', 'MANAGER'] },
      { href: '/vehicles', label: 'Veículos', roles: ['ADMIN', 'MANAGER'] },
      { href: '/fuel', label: 'Abastecimentos', roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'] },
      { href: '/costs', label: 'Custos', roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'] },
    ],
  },
  {
    id: 'administracao',
    label: 'Administração',
    items: [
      { href: '/settings/companies', label: 'Empresas', roles: ['PLATFORM_ADMIN'] },
      { href: '/settings/company', label: 'Empresa', roles: ['ADMIN'] },
      { href: '/settings/users', label: 'Usuários', roles: ['ADMIN'] },
    ],
  },
];

export function isNavActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function visibleNavGroups(user: SessionUser) {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((l) => roleAllowed(user.role, l.roles)),
  })).filter((g) => g.items.length > 0);
}
