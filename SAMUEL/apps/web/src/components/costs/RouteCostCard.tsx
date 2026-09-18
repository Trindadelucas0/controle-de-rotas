'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { MetricView, type Metric } from '@/lib/cost-metric';

type RouteCost = {
  plannedDistanceMeters: number | null;
  actualDistanceMeters: number | null;
  visitCount: number;
  distanceKm: Metric;
  estimatedLiters: Metric;
  estimatedCost: Metric;
  estimatedCostPerKm: Metric;
  estimatedCostPerVisit: Metric;
  realCost: Metric;
  realLiters: Metric;
  realCostPerVisit: Metric;
};

export function RouteCostCard({ routeId, status }: { routeId: string; status: string }) {
  const [data, setData] = useState<RouteCost | null>(null);
  const show = ['COMPLETED', 'INCOMPLETE', 'IN_PROGRESS'].includes(status);

  useEffect(() => {
    if (!show) return;
    apiFetch<RouteCost>(`/api/v1/costs/routes/${routeId}`)
      .then(setData)
      .catch(() => setData(null));
  }, [routeId, show]);

  if (!show || !data) return null;

  return (
    <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <h3 className="mb-2 text-sm font-semibold text-brand-900">Custo desta rota</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <MetricView label="Distância" metric={data.distanceKm} />
        <MetricView label="Consumo estimado" metric={data.estimatedLiters} />
        <MetricView label="Custo estimado" metric={data.estimatedCost} money />
        <MetricView label="Custo/km estimado" metric={data.estimatedCostPerKm} money />
        <MetricView label="Custo real" metric={data.realCost} money />
        <MetricView label="Custo estimado por visita" metric={data.estimatedCostPerVisit} money />
      </div>
    </section>
  );
}
