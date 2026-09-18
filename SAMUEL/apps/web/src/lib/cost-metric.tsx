export type MetricKind = 'REAL' | 'ESTIMATED' | 'UNAVAILABLE';

export type Metric = {
  kind: MetricKind;
  value: number | null;
  unit?: string;
  reason?: string;
};

export function metricLabel(kind: MetricKind) {
  if (kind === 'REAL') return 'REAL';
  if (kind === 'ESTIMATED') return 'ESTIMADO';
  return 'NÃO CALCULÁVEL';
}

export function formatMoney(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatQty(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function MetricView({
  label,
  metric,
  money,
}: {
  label: string;
  metric: Metric | undefined;
  money?: boolean;
}) {
  if (!metric) {
    return (
      <div>
        <p className="text-xs text-[var(--muted)]">{label}</p>
        <p className="text-sm text-[var(--muted)]">—</p>
      </div>
    );
  }
  const value =
    metric.value == null
      ? 'Não disponível'
      : money
        ? formatMoney(metric.value)
        : `${formatQty(metric.value, metric.unit === '%' ? 1 : 2)}${metric.unit && metric.unit !== 'BRL' ? ` ${metric.unit}` : ''}`;
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">
        {label}{' '}
        <span className="font-semibold tracking-wide text-[var(--muted)]">{metricLabel(metric.kind)}</span>
      </p>
      <p className="text-lg font-semibold text-brand-900">{value}</p>
      {metric.kind === 'UNAVAILABLE' && metric.reason ? (
        <p className="mt-1 text-xs text-[var(--muted)]">{metric.reason}</p>
      ) : null}
    </div>
  );
}
