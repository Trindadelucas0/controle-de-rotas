'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { NAV_ICONS } from '@/components/layout/app-icons';
import { AppMoreSheet } from '@/components/layout/AppMoreSheet';
import {
  isMoreSectionActive,
  isPrimaryNavActive,
  moreNavGroups,
  primaryNavItems,
} from '@/components/layout/nav-primary';
import type { SessionUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function AppBottomNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = primaryNavItems(user);
  const moreGroups = moreNavGroups(user);
  const hasMore = moreGroups.length > 0;
  const moreActive = isMoreSectionActive(pathname, user);

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] md:hidden"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <ul
          className="mx-auto flex max-w-lg items-stretch justify-around px-1"
          style={{ minHeight: 'var(--app-bottom-nav-height)' }}
        >
          {items.map((item) => {
            const Icon = NAV_ICONS[item.href];
            const active = isPrimaryNavActive(pathname, item.href);
            return (
              <li key={item.href} className="flex min-w-0 flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    'flex min-h-11 w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold tracking-wide transition active:scale-[0.98]',
                    active ? 'text-[var(--accent)]' : 'text-[var(--muted)]',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {Icon ? <Icon className="size-5 shrink-0" aria-hidden /> : null}
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
          {hasMore ? (
            <li className="flex min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className={cn(
                  'flex min-h-11 w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold tracking-wide transition active:scale-[0.98]',
                  moreActive || moreOpen ? 'text-[var(--accent)]' : 'text-[var(--muted)]',
                )}
                aria-expanded={moreOpen}
                aria-haspopup="dialog"
              >
                <Menu className="size-5 shrink-0" aria-hidden />
                <span>Mais</span>
              </button>
            </li>
          ) : null}
        </ul>
      </nav>
      {hasMore ? (
        <AppMoreSheet user={user} open={moreOpen} onOpenChange={setMoreOpen} />
      ) : null}
    </>
  );
}
