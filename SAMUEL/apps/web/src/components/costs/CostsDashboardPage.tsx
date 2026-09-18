'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { MetricView, type Metric, formatMoney } from '@/lib/cost-metric';
import { PageHeader } from '@/components/ui/crud';

type Dash = {
  from: string;
  to: string;
  spent: Metric;
  liters: Metric;
  km: Metric;
  costPerKm: Metric;
  vehicles: {
    vehicleId: string;
    plate: string;
    spent: Metric;
    consumption: Metric;
    expectedKmPerL: number | null;
  }[];
  alerts: { code: string; message: string }[];
};

function monthInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function CostsDashboardPage() {
  const [month, setMonth] = useState(() => monthInput(new Date()));
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const [y, m] = month.split('-').map(Number);
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = new Date(y!, m!, 0).getDate();
    const to = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    setLoading(true);
    apiFetch<Dash>(`/api/v1/costs/dashboard?from=${from}&to=${to}`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Falha ao carregar custos'))
      .finally(() => setLoading(false));
  }, [month]);

  return (
    <div>
      <PageHeader
        title="Custos da frota"
        subtitle="Números do banco. ESTIMADO nunca aparece como REAL. Sem dado: não calculável."
        icon={<Wallet />}
        action={
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="ops-input text-sm"
          />
        }
      />
      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}
      {loading || !data ? (
        <div className="h-48 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-brand-100 bg-surface p-4">
              <MetricView label="Combustível" metric={data.spent} money />
            </div>
            <div className="rounded-2xl border border-brand-100 bg-surface p-4">
              <MetricView label="Km (rotas com distância real)" metric={data.km} />
            </div>
            <div className="rounded-2xl border border-brand-100 bg-surface p-4">
              <MetricView label="Custo/km" metric={data.costPerKm} money />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-brand-100 bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold text-brand-900">Consumo médio REAL</h2>
              {data.vehicles.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Ainda não existem dados suficientes para calcular este indicador.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.vehicles.map((v) => (
                    <li key={v.vehicleId} className="flex justify-between gap-2">
                      <Link href={`/vehicles/${v.vehicleId}`} className="ops-link">
                        {v.plate}
                      </Link>
                      <span>
                        {v.consumption.value != null
                          ? `${v.consumption.value} km/L`
                          : 'Não calculável'}
                        {v.expectedKmPerL != null ? ` · esp. ${v.expectedKmPerL}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-2xl border border-brand-100 bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold text-brand-900">Custo por veículo (REAL)</h2>
              <ul className="space-y-2 text-sm">
                {data.vehicles.map((v) => (
                  <li key={v.vehicleId} className="flex justify-between gap-2">
                    <Link href={`/fuel?vehicleId=${v.vehicleId}`} className="ops-link">
                      {v.plate}
                    </Link>
                    <span>{formatMoney(v.spent.value)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <section className="mt-4 rounded-2xl border border-brand-100 bg-surface p-4">
            <h2 className="mb-2 text-sm font-semibold text-brand-900">Alertas</h2>
            <p className="mb-2 text-xs text-[var(--muted)]">Indicadores para análise humana. Não são acusação de fraude.</p>
            {data.alerts.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Nenhum alerta neste período.</p>
            ) : (
              <ul className="space-y-1 text-sm text-brand-900">
                {data.alerts.map((a) => (
                  <li key={`${a.code}-${a.message}`}>{a.message}</li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
