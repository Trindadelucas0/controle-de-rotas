'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebarNav } from '@/components/layout/AppNav';
import { fetchMe, type SessionUser } from '@/lib/auth';
import { SessionContext } from '@/lib/session-context';

const FULL_BLEED = new Set(['/', '/map']);

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        // api-client limpa cookies e redireciona se sessão inválida
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const fullBleed = FULL_BLEED.has(pathname);

  return (
    <SessionContext.Provider value={user}>
      <div className="flex min-h-screen bg-[var(--background)]">
        {/* Desktop sidebar */}
        {user ? (
          <aside className="hidden w-56 shrink-0 border-r border-[var(--border)] bg-[#121212] lg:flex lg:flex-col">
            <div className="border-b border-[var(--border)] px-4 py-4">
              <p className="text-[15px] font-semibold tracking-tight text-brand-900">Rotas</p>
              <p className="truncate text-xs text-[var(--muted)]">{user.company.name}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AppSidebarNav user={user} />
            </div>
          </aside>
        ) : null}

        {/* Mobile drawer */}
        {user && mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Fechar menu"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-[#121212] shadow-xl">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <p className="text-[15px] font-semibold tracking-tight text-brand-900">Rotas</p>
                <button
                  type="button"
                  className="ops-btn ops-btn-ghost !py-1 text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  Fechar
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <AppSidebarNav user={user} onNavigate={() => setMobileOpen(false)} />
              </div>
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            user={user}
            loading={loading}
            onMenuClick={user ? () => setMobileOpen(true) : undefined}
          />
          <main
            className={
              fullBleed
                ? 'flex-1 px-0 py-0'
                : 'mx-auto w-full max-w-5xl flex-1 px-4 py-8'
            }
          >
            {loading ? (
              <div className="m-4 h-40 animate-pulse rounded-[10px] bg-surface" aria-busy="true" />
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </SessionContext.Provider>
  );
}
