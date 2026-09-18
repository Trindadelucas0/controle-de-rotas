'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SessionUser } from '@/lib/auth';
import { logout } from '@/lib/auth';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto max-w-[14rem] justify-end px-2 py-1.5 text-right"
            aria-label="Conta"
          />
        }
      >
        <span className="min-w-0 text-right">
          <span className="block truncate text-sm font-medium leading-tight text-brand-900">{user.name}</span>
          <span className="block text-[11px] uppercase tracking-wide text-[var(--muted)]">{user.role}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
          <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">{user.role}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account/change-password" />}>Alterar senha</DropdownMenuItem>
        <div className="px-1 py-1">
          <ThemeToggle wide />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={busy} onClick={() => void onLogout()}>
          {busy ? 'Saindo…' : 'Sair'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
