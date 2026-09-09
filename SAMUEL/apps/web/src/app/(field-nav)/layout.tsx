'use client';

import { useEffect, useState } from 'react';
import { FieldPwaLocationGate } from '@/components/field/FieldPwaLocationGate';
import { fetchMe, type SessionUser } from '@/lib/auth';
import { SessionContext } from '@/lib/session-context';

/** Layout sem header/nav — navegação GPS em tela cheia. */
export default function FieldNavLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        // api-client redireciona se sessão inválida
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SessionContext.Provider value={user}>
      <div className="h-[100dvh] overflow-hidden bg-[#121212]">
        <FieldPwaLocationGate>{children}</FieldPwaLocationGate>
      </div>
    </SessionContext.Provider>
  );
}
