'use client';

import { BusySpinner } from './BusySpinner';

type Props = {
  show: boolean;
  label?: string;
};

/**
 * Overlay local: o ancestral deve ter `relative` (e preferencialmente min-height).
 */
export function LoadingOverlay({ show, label = 'Aguarde…' }: Props) {
  if (!show) return null;
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-brand-950/45 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-brand-900 shadow-sm">
        <BusySpinner className="border-[var(--muted)]/40 border-t-brand-700" />
        <span>{label}</span>
      </div>
    </div>
  );
}
