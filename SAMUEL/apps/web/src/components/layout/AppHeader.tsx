'use client';

import { UserMenu } from './UserMenu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { SessionUser } from '@/lib/auth';

export function AppHeader({
  user,
  loading,
  showMenu,
}: {
  user: SessionUser | null;
  loading?: boolean;
  showMenu?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          {showMenu ? (
            <SidebarTrigger
              className="md:hidden text-brand-900"
              aria-label="Abrir menu"
            />
          ) : null}
        </div>
        {loading ? (
          <div className="h-8 w-40 animate-pulse rounded bg-surface" aria-hidden />
        ) : user ? (
          <UserMenu user={user} />
        ) : null}
      </div>
    </header>
  );
}
