'use client';

import { cn } from '@/lib/utils';

/** Barra de ações fixa acima da bottom nav no mobile; em md+ fica no fluxo. */
export function MobileActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-stretch gap-2 border-t border-[var(--border)] bg-[var(--surface)] pt-3',
        'md:static md:flex-row md:items-center md:justify-end md:border-0 md:bg-transparent md:pt-4',
        'max-md:sticky max-md:bottom-[calc(var(--app-bottom-nav-height)+var(--safe-bottom))] max-md:z-20 max-md:-mx-5 max-md:mt-4 max-md:px-5 max-md:pb-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
