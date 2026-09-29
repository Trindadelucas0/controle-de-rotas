'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppBottomNav } from '@/components/layout/AppBottomNav';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api-client';
import { fetchMe, type SessionUser } from '@/lib/auth';
import { SessionContext } from '@/lib/session-context';

const FULL_BLEED = new Set(['/', '/map']);

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(false);

  const loadSession = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setSessionError(false);
    fetchMe()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch((err) => {
        // 401: api-client limpa cookies e redireciona para o login.
        if (cancelled || (err instanceof ApiError && err.status === 401)) return;
        setSessionError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => loadSession(), [loadSession]);

  const fullBleed = FULL_BLEED.has(pathname);

  return (
    <SessionContext.Provider value={user}>
      <TooltipProvider>
        <SidebarProvider className="min-h-screen bg-[var(--background)] max-md:h-dvh max-md:min-h-0 max-md:overflow-hidden">
          {user ? <AppSidebar user={user} /> : null}
          <SidebarInset className="min-w-0 bg-[var(--background)] max-md:h-dvh max-md:overflow-hidden md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:shadow-none">
            <AppHeader user={user} loading={loading} />
            <div
              className={
                fullBleed
                  ? 'flex min-h-0 flex-1 flex-col px-0 py-0 max-md:overflow-y-auto max-md:overscroll-y-contain'
                  : 'app-main-pad mx-auto w-full max-w-5xl flex-1 px-4 py-6 max-md:min-h-0 max-md:overflow-y-auto max-md:overscroll-y-contain md:py-8 md:pb-8'
              }
            >
              {loading ? (
                <div className="m-4 h-40 animate-pulse rounded-[10px] bg-surface" aria-busy="true" />
              ) : !user && sessionError ? (
                <div className="m-4 space-y-3 rounded-[10px] border border-brand-100 p-4" role="alert">
                  <p className="text-sm font-medium text-brand-900">
                    Não foi possível carregar sua sessão.
                  </p>
                  <p className="text-sm text-[var(--muted)]">A API pode estar reiniciando.</p>
                  <button type="button" className="ops-btn ops-btn-primary" onClick={() => loadSession()}>
                    Tentar de novo
                  </button>
                </div>
              ) : (
                children
              )}
            </div>
            {user ? <AppBottomNav user={user} /> : null}
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </SessionContext.Provider>
  );
}
