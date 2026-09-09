'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SessionUser } from '@/lib/auth';
import { logout } from '@/lib/auth';

export function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await logout();
    } finally {
      router.replace('/login');
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="min-w-0 text-right">
        <p className="truncate font-medium leading-tight text-brand-900">{user.name}</p>
        <p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{user.role}</p>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <Link href="/account/change-password" className="ops-btn ops-btn-secondary !py-1.5 text-xs">
          Alterar senha
        </Link>
        <button type="button" onClick={onLogout} disabled={busy} className="ops-btn ops-btn-ghost !py-1.5 text-xs">
          {busy ? 'Saindo…' : 'Sair'}
        </button>
      </div>
      <details className="relative sm:hidden">
        <summary className="ops-btn ops-btn-ghost cursor-pointer list-none !px-2 !py-1.5" aria-label="Conta">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="8" cy="5.5" r="2.25" stroke="currentColor" strokeWidth="1.4" />
            <path d="M3.2 13c.7-2.2 2.4-3.4 4.8-3.4s4.1 1.2 4.8 3.4" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </summary>
        <div className="absolute right-0 z-40 mt-1 min-w-[10rem] ops-surface rounded-[8px] p-2">
          <Link href="/account/change-password" className="ops-btn ops-btn-ghost w-full justify-start text-xs">
            Alterar senha
          </Link>
          <button type="button" onClick={onLogout} disabled={busy} className="ops-btn ops-btn-ghost w-full justify-start text-xs">
            {busy ? 'Saindo…' : 'Sair'}
          </button>
        </div>
      </details>
    </div>
  );
}
