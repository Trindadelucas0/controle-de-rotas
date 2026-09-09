'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SessionUser } from '@/lib/auth';

type NavItem = { href: string; label: string; roles?: string[] };
type NavGroup = { id: string; label: string; items: NavItem[] };

const groups: NavGroup[] = [
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
      { href: '/customers', label: 'Clientes' },
      { href: '/employees', label: 'Funcionários', roles: ['ADMIN', 'MANAGER'] },
      { href: '/vehicles', label: 'Veículos', roles: ['ADMIN', 'MANAGER'] },
    ],
  },
  {
    id: 'administracao',
    label: 'Administração',
    items: [
      { href: '/settings/company', label: 'Empresa', roles: ['ADMIN'] },
      { href: '/settings/users', label: 'Usuários', roles: ['ADMIN'] },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebarNav({
  user,
  onNavigate,
}: {
  user: SessionUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((l) => !l.roles || l.roles.includes(user.role)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <nav className="flex flex-col gap-5 p-3" aria-label="Principal">
      {visibleGroups.map((g) => (
        <div key={g.id}>
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {g.label}
          </p>
          <ul className="space-y-0.5">
            {g.items.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={onNavigate}
                    className={`block rounded-[6px] px-3 py-2 text-sm font-medium transition ${
                      active
                        ? 'bg-accent text-white'
                        : 'text-brand-800 hover:bg-white/[0.04] hover:text-brand-900'
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** @deprecated top-nav removida — mantido nome AppNav para imports legados */
export function AppNav({ user }: { user: SessionUser | null }) {
  if (!user) return null;
  return (
    <div className="border-b border-brand-100 bg-surface lg:hidden">
      <AppSidebarNav user={user} />
    </div>
  );
}
