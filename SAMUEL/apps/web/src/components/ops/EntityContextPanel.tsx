'use client';

import Link from 'next/link';
import { formatOpsDate, OPS_OPERATIONAL_LABELS } from '@/lib/ops-types';

type ContextAction = { id: string; label: string; href?: string; enabled: boolean };

type ContextTimelineItem = {
  at: string;
  type: string;
  title: string;
  detail?: string | null;
  actorName?: string | null;
};

type EntityContextPanelProps = {
  title: string;
  statusLabel?: string | null;
  metrics: { label: string; value: string }[];
  relacionamentos?: { label: string; href?: string; value: string }[];
  timeline?: ContextTimelineItem[];
  acoes?: ContextAction[];
  loading?: boolean;
  error?: string | null;
};

export function EntityContextPanel({
  title,
  statusLabel,
  metrics,
  relacionamentos = [],
  timeline = [],
  acoes = [],
  loading,
  error,
}: EntityContextPanelProps) {
  if (loading) {
    return <div className="mb-6 h-40 animate-pulse rounded-2xl bg-surface" />;
  }

  if (error) {
    return (
      <p className="mb-6 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
        {error}
      </p>
    );
  }

  const visibleMetrics = metrics.filter((m) => m.value !== '—');
  const enabledActions = acoes.filter((a) => a.enabled && a.href);

  return (
    <section className="mb-6 space-y-4 rounded-2xl border border-brand-100 bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-brand-900">{title}</h2>
          {statusLabel ? (
            <p className="mt-1 text-sm text-[var(--muted)]">Status: {statusLabel}</p>
          ) : null}
        </div>
        {enabledActions.length ? (
          <div className="flex flex-wrap gap-2">
            {enabledActions.map((a) => (
              <Link
                key={a.id}
                href={a.href!}
                className="ops-btn ops-btn-secondary text-xs"
              >
                {a.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {visibleMetrics.length ? (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visibleMetrics.map((m) => (
            <div key={m.label}>
              <dt className="ops-label mb-0">
                {m.label}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-brand-900">{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {relacionamentos.length ? (
        <RelatedLinks items={relacionamentos} />
      ) : null}

      {timeline.length ? (
        <div>
          <h3 className="ops-section-title mb-2">
            Timeline
          </h3>
          <ul className="space-y-2">
            {timeline.slice(0, 6).map((t, i) => (
              <li key={`${t.at}-${i}`} className="border-l-2 border-brand-200 pl-3 text-sm">
                <p className="text-xs text-[var(--muted)]">{formatOpsDate(t.at)}</p>
                <p className="font-medium text-brand-900">{t.title}</p>
                {t.detail ? <p className="text-xs text-[var(--muted)]">{t.detail}</p> : null}
                {t.actorName ? (
                  <p className="text-xs text-[var(--muted)]">{t.actorName}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function RelatedLinks({
  items,
}: {
  items: { label: string; href?: string; value: string }[];
}) {
  const visible = items.filter((i) => i.value && i.value !== '—');
  if (!visible.length) return null;

  return (
    <div>
      <h3 className="ops-section-title mb-2">
        Relacionamentos
      </h3>
      <ul className="space-y-1 text-sm">
        {visible.map((item) => (
          <li key={item.label}>
            <span className="text-[var(--muted)]">{item.label}: </span>
            {item.href ? (
              <Link href={item.href} className="ops-link">
                {item.value}
              </Link>
            ) : (
              <span className="font-medium text-brand-900">{item.value}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function operationalLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return OPS_OPERATIONAL_LABELS[code] ?? code;
}
