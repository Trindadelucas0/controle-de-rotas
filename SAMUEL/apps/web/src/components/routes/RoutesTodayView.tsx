'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useSessionUser } from '@/lib/session-context';
import { toDateInputValue } from '@/lib/ops-labels';
import { formatMetersKm, type RoutesSummary } from '@/lib/ops-types';
import {
  OperationalSummaryStrip,
  summaryKm,
} from '@/components/ops/OperationalSummaryStrip';
import { RouteManagePanel } from './RouteManagePanel';

type RouteRow = {
  id: string;
  status: string;
  date: string;
  plannedDistanceMeters: number | null;
  actualDistanceMeters: number | null;
  employee: { id: string; name: string } | null;
  vehicle: { id: string; plate: string } | null;
  _count?: { stops: number };
  stopsDone?: number;
  recordNewCustomer?: boolean;
};

const ROUTE_LIST_STATUS: Record<string, string> = {
  PLANNED: 'Planejada',
  ASSIGNED: 'Atribuída',
  PUBLISHED: 'Publicada',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  INCOMPLETE: 'Incompleta',
  CANCELLED: 'Cancelada',
};

const EDITABLE_STATUSES = new Set(['PLANNED', 'PUBLISHED']);

export function RoutesTodayView() {
  const user = useSessionUser();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canDelete = user?.role === 'ADMIN' || user?.role === 'PLATFORM_ADMIN';
  const [date, setDate] = useState(() => toDateInputValue());
  const [summary, setSummary] = useState<RoutesSummary | null>(null);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manageRouteId, setManageRouteId] = useState<string | null>(null);

  const load = useCallback(async (day: string) => {
    setLoading(true);
    setError(null);
    try {
      const [s, r] = await Promise.all([
        apiFetch<RoutesSummary>(`/api/v1/ops/routes/summary?date=${encodeURIComponent(day)}`),
        apiFetch<{ routes: RouteRow[] }>(
          `/api/v1/routes?date=${encodeURIComponent(day)}`,
        ),
      ]);
      setSummary(s);
      setRoutes(r.routes);
    } catch (e) {
      setSummary(null);
      setRoutes([]);
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar rotas do dia');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const stripItems = summary
    ? [
        { label: 'Rotas', value: summary.count },
        { label: 'Em andamento', value: summary.inProgress },
        { label: 'Concluídas', value: summary.completed },
        { label: 'Incompletas', value: summary.incomplete ?? 0 },
        { label: 'Paradas', value: summary.visits },
        { label: 'Km plan.', value: summaryKm(summary.plannedDistanceMeters) },
        {
          label: 'Km real',
          value:
            summary.actualDistanceMeters != null
              ? summaryKm(summary.actualDistanceMeters)
              : '—',
        },
        {
          label: 'Execução',
          value:
            summary.executionPercent != null ? `${summary.executionPercent}%` : '—',
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-900">Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ops-input text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void load(date)}
          className="ops-btn ops-btn-secondary"
        >
          Atualizar
        </button>
      </div>

      <OperationalSummaryStrip items={stripItems} loading={loading} error={error} />

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-surface" />
      ) : routes.length === 0 ? (
        <p className="ops-surface rounded-[10px] border-dashed px-5 py-10 text-center text-sm text-[var(--muted)]">
          Nenhuma rota neste dia. Publique no Planejador ou confira a data.
        </p>
      ) : (
        <ul className="space-y-2">
          {routes.map((route, index) => {
            const canEditThis = canManage && EDITABLE_STATUSES.has(route.status);
            return (
              <li
                key={route.id}
                className="ops-surface rounded-[10px] px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-base font-semibold text-brand-900">
                    {route.recordNewCustomer
                      ? 'Gravar acesso'
                      : `Rota ${String(index + 1).padStart(2, '0')}`}
                  </p>
                  <p className="text-sm font-medium text-brand-800">
                    {ROUTE_LIST_STATUS[route.status] ?? route.status}
                  </p>
                </div>
                <p className="mt-1 text-sm text-brand-800">
                  {route.employee?.name || 'Sem funcionário'}
                  {route.vehicle?.plate ? ` · ${route.vehicle.plate}` : ''}
                </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {route.recordNewCustomer
                  ? 'Missão de gravar — pontos viram clientes'
                  : [
                      route._count?.stops != null
                        ? `${route._count.stops} paradas`
                        : 'Paradas —',
                      route.stopsDone != null && route._count?.stops != null
                        ? `Concluídas ${route.stopsDone}/${route._count.stops}`
                        : 'Concluídas —',
                    ].join(' · ')}
                {' · '}
                {formatMetersKm(route.plannedDistanceMeters)} plan.
                {route.actualDistanceMeters != null
                  ? ` · ${formatMetersKm(route.actualDistanceMeters)} real`
                  : ' · real —'}
              </p>
              {(route.status === 'COMPLETED' || route.status === 'INCOMPLETE') && (
                <p className="mt-2">
                  <a
                    href={`/map?routeId=${encodeURIComponent(route.id)}`}
                    className="ops-link text-xs font-semibold"
                  >
                    Ver trilha no mapa
                  </a>
                </p>
              )}
                <div className="mt-3">
                  <button
                    type="button"
                    className="ops-btn ops-btn-secondary text-sm"
                    onClick={() => setManageRouteId(route.id)}
                  >
                    {canEditThis ? 'Gerir' : 'Ver'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {manageRouteId ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40"
            aria-label="Fechar painel"
            onClick={() => setManageRouteId(null)}
          />
          <RouteManagePanel
            routeId={manageRouteId}
            canManage={canManage}
            canDelete={canDelete}
            onClose={() => setManageRouteId(null)}
            onChanged={() => void load(date)}
          />
        </>
      ) : null}
    </div>
  );
}
