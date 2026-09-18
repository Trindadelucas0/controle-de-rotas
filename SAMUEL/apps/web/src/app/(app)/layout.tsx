'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { fetchMe, type SessionUser } from '@/lib/auth';
import { SessionContext } from '@/lib/session-context';

const FULL_BLEED = new Set(['/', '/map']);

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

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

  const fullBleed = FULL_BLEED.has(pathname);

  return (
    <SessionContext.Provider value={user}>
      <TooltipProvider>
        <SidebarProvider className="min-h-screen bg-[var(--background)]">
          {user ? <AppSidebar user={user} /> : null}
          <SidebarInset className="min-w-0 bg-[var(--background)] md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:shadow-none">
            <AppHeader user={user} loading={loading} showMenu={Boolean(user)} />
            <div
              className={
                fullBleed ? 'flex-1 px-0 py-0' : 'mx-auto w-full max-w-5xl flex-1 px-4 py-8'
              }
            >
              {loading ? (
                <div className="m-4 h-40 animate-pulse rounded-[10px] bg-surface" aria-busy="true" />
              ) : (
                children
              )}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </SessionContext.Provider>
  );
}
