'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';

export function ThemeToggle({ wide = false }: { wide?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={
        wide
          ? 'ops-btn ops-btn-ghost w-full justify-start !px-2 !py-1.5 text-xs'
          : 'ops-btn ops-btn-ghost !px-2 !py-1.5 text-xs'
      }
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
    >
      {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span className={wide ? undefined : 'hidden sm:inline'}>{isDark ? 'Claro' : 'Escuro'}</span>
    </button>
  );
}
