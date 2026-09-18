'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { MetricView, type Metric } from '@/lib/cost-metric';

const SOURCE: Record<string, string> = {
  ROUTE_START: 'Início de rota',
  ROUTE_END: 'Fim de rota',
  FUEL_FILL: 'Abastecimento',
  ADMIN_ADJUST: 'Ajuste administrativo',
  MAINTENANCE: 'Manutenção',
  OTHER: 'Outro',
};

type VehicleCosts = {
  spent: Metric;
  km: Metric;
  costPerKm: Metric;
  consumption: Metric;
  expectedKmPerL: number | null;
  variance: Metric;
  readings: { id: string; source: string; km: number | null; occurredAt: string }[];
};

export function VehicleCostPanel({ vehicleId }: { vehicleId: string }) {
  const [data, setData] = useState<VehicleCosts | null>(null);

  useEffect(() => {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    apiFetch<VehicleCosts>(`/api/v1/costs/vehicles/${vehicleId}?from=${from}&to=${to}`)
      .then(setData)
      .catch(() => setData(null));
  }, [vehicleId]);

  if (!data) return null;

  return (
    <section className="mb-6 space-y-3 rounded-2xl border border-brand-100 bg-surface p-5">
      <h2 className="text-lg font-semibold text-brand-900">Custos do mês</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricView label="Consumo real" metric={data.consumption} />
        <MetricView label="Custo médio" metric={data.costPerKm} money />
        <MetricView label="Gasto no mês" metric={data.spent} money />
        <MetricView label="Km no mês" metric={data.km} />
        <MetricView label="Variação vs esperado" metric={data.variance} />
      </div>
      <h3 className="pt-2 text-sm font-semibold text-brand-900">Últimas leituras do odômetro</h3>
      {data.readings.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nenhuma leitura gravada.</p>
      ) : (
        <ul className="space-y-1 text-sm text-[var(--muted)]">
          {data.readings.slice(0, 12).map((r) => (
            <li key={r.id}>
              {new Date(r.occurredAt).toLocaleString('pt-BR')} · {r.km ?? '—'} km ·{' '}
              {SOURCE[r.source] ?? r.source}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
