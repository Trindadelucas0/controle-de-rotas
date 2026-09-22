'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ICONS } from '@/components/layout/app-icons';
import { isNavActive } from '@/components/layout/AppNav';
import { moreNavGroups } from '@/components/layout/nav-primary';
import type { SessionUser } from '@/lib/auth';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export function AppMoreSheet({
  user,
  open,
  onOpenChange,
}: {
  user: SessionUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const groups = moreNavGroups(user);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-0 rounded-t-2xl border-[var(--border)] bg-[var(--surface)] p-0"
        showCloseButton
      >
        <SheetHeader className="border-b border-[var(--border)] px-4 pb-3 pt-4 text-left">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border-strong)]" aria-hidden />
          <SheetTitle className="text-lg font-semibold text-[var(--ink)]">Mais</SheetTitle>
          <SheetDescription className="text-sm text-[var(--muted)]">
            {user.company.name}
          </SheetDescription>
        </SheetHeader>
        <nav className="overflow-y-auto px-2 py-3" aria-label="Mais opções">
          {groups.map((g) => (
            <div key={g.id} className="mb-4">
              <p className="ops-section-title mb-1 px-3">{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map((item) => {
                  const Icon = NAV_ICONS[item.href];
                  const active = isNavActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition active:scale-[0.99]',
                          active
                            ? 'bg-[var(--accent)] text-white'
                            : 'text-[var(--ink)] hover:bg-[var(--surface-2)]',
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        {Icon ? <Icon className="size-5 shrink-0" aria-hidden /> : null}
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
