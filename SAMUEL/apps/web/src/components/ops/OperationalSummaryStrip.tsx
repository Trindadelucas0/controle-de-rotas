'use client';

type SummaryItem = {
  label: string;
  value: string | number;
  href?: string;
};

export function OperationalSummaryStrip({
  items,
  loading,
  error,
}: {
  items: SummaryItem[];
  loading?: boolean;
  error?: string | null;
}) {
  if (error) {
    return (
      <p className="mb-4 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
        {error}
      </p>
    );
  }

  if (loading) {
    return <div className="mb-4 h-10 animate-pulse rounded-[8px] bg-surface" />;
  }

  const visible = items.filter((item) => item.value !== '—' && item.value !== '');
  if (!visible.length) return null;

  return (
    <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-[var(--border)] pb-3">
      {visible.map((item) => {
        const inner = (
          <>
            <p className="ops-label mb-0">{item.label}</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-brand-900">{item.value}</p>
          </>
        );
        if (item.href) {
          return (
            <a key={item.label} href={item.href} className="min-w-[4.5rem]">
              {inner}
            </a>
          );
        }
        return (
          <div key={item.label} className="min-w-[4.5rem]">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

export function summaryValue(n: number | null | undefined, suffix = ''): string {
  if (n == null) return '—';
  return `${n}${suffix}`;
}

export function summaryKm(meters: number | null | undefined): string {
  if (meters == null || meters === 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}
