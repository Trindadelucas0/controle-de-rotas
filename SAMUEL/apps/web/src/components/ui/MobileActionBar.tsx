'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Barra de ações presa na borda de baixo no mobile; em md+ fica no fluxo. */
export function MobileActionBar({
  children,
  className,
  dock = 'nav',
}: {
  children: React.ReactNode;
  className?: string;
  /** `nav`: acima da bottom nav. `screen`: encosta na borda (telas sem nav). */
  dock?: 'nav' | 'screen';
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);

  // O bloco sai do fluxo no mobile; o espaçador devolve a altura dele para o
  // último campo do formulário não ficar embaixo da barra.
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setBarHeight(el.offsetHeight));
    observer.observe(el);
    setBarHeight(el.offsetHeight);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="shrink-0 md:hidden" style={{ height: barHeight }} aria-hidden />
      <div
        ref={barRef}
        className={cn(
          'flex flex-col items-stretch gap-2 border-t border-[var(--border)] bg-[var(--surface)] pt-3',
          'md:static md:flex-row md:items-center md:justify-end md:border-0 md:bg-transparent md:pt-4',
          'max-md:fixed max-md:inset-x-0 max-md:z-30 max-md:px-5 max-md:pb-3',
          className,
        )}
        style={{
          bottom:
            dock === 'screen'
              ? 'var(--safe-bottom)'
              : 'calc(var(--app-bottom-nav-height) + var(--safe-bottom))',
        }}
      >
        {children}
      </div>
    </>
  );
}
