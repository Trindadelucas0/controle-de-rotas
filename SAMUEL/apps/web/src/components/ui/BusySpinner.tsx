'use client';

export function BusySpinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white ${className}`}
      aria-hidden
    />
  );
}
