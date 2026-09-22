'use client';

import { UserMenu } from './UserMenu';
import type { SessionUser } from '@/lib/auth';

export function AppHeader({
  user,
  loading,
}: {
  user: SessionUser | null;
  loading?: boolean;
  /** @deprecated Mobile usa bottom nav; mantido por compat. */
  showMenu?: boolean;
}) {
  return (
    <header className="safe-pt sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="flex min-h-11 items-center justify-end gap-4 px-4 py-2.5">
        {loading ? (
          <div className="h-8 w-40 animate-pulse rounded bg-surface" aria-hidden />
        ) : user ? (
          <UserMenu user={user} />
        ) : null}
      </div>
    </header>
  );
}
