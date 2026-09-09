'use client';

import Link from 'next/link';
import { UserMenu } from './UserMenu';
import type { SessionUser } from '@/lib/auth';

export function AppHeader({
  user,
  loading,
  onMenuClick,
}: {
  user: SessionUser | null;
  loading?: boolean;
  onMenuClick?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[#121212]/95 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          {onMenuClick ? (
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] border border-[var(--border-strong)] text-brand-900 lg:hidden"
              aria-label="Abrir menu"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path d="M3 4.5h12M3 9h12M3 13.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
              </svg>
            </button>
          ) : null}
          <Link href="/" className="truncate text-[15px] font-semibold tracking-tight text-brand-900">
            Rotas
          </Link>
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
