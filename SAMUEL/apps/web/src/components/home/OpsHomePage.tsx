'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useSessionUser } from '@/lib/session-context';
import {
  dayRangeIso,
  labelOf,
  toDateInputValue,
  VISIT_STATUS_LABELS,
} from '@/lib/ops-labels';
import {
  formatMetersKm,
  opsEmployeeStatusLine,
  type OpsSnapshot,
  type RoutesSummary,
} from '@/lib/ops-types';

type HomeVisit = {
  id: string;
  scheduledStart: string;
  status: string;
  customer: { id: string; name: string; tradeName: string | null };
};

type HomeRoute = {
  id: string;
  status: string;
  employee: { id: string; name: string } | null;
  vehicle: { id: string; plate: string } | null;
  _count?: { stops: number };
};

const ROUTE_LIST_STATUS: Record<string, string> = {
  PLANNED: 'Planejada',
  ASSIGNED: 'Atribuída',
  PUBLISHED: 'Publicada',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
};

function MetricStrip({
  items,
}: {
  items: { label: string; value: string | number; detail: string; href: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3 border-b border-[var(--border)] pb-4">
      {items.map((item) => (
        <Link key={item.label} href={item.href} className="min-w-[6.5rem]">
          <p className="ops-label mb-0">{item.label}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-900">{item.value}</p>
          <p className="mt-0.5 max-w-[16rem] text-xs text-[var(--muted)]">{item.detail}</p>
        </Link>
      ))}
    </div>
  );
}

export function OpsHomePage() {
  const user = useSessionUser();
  const [date, setDate] = useState(() => toDateInputValue());
  const [data, setData] = useState<OpsSnapshot | null>(null);
  const [routesSummary, setRoutesSummary] = useState<RoutesSummary | null>(null);
  const [visits, setVisits] = useState<HomeVisit[]>([]);
  const [routes, setRoutes] = useState<HomeRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (day: string) => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = dayRangeIso(day);
      const visitParams = new URLSearchParams({ from, to });
      const [snap, summary, visitsRes, routesRes] = await Promise.all([
        apiFetch<OpsSnapshot>(`/api/v1/ops/snapshot?date=${encodeURIComponent(day)}`),
        apiFetch<RoutesSummary>(
          `/api/v1/ops/routes/summary?date=${encodeURIComponent(day)}`,
        ).catch(() => null),
        apiFetch<{ visits: HomeVisit[] }>(`/api/v1/visits?${visitParams}`).catch(() => ({
          visits: [] as HomeVisit[],
        })),
        apiFetch<{ routes: HomeRoute[] }>(
          `/api/v1/routes?date=${encodeURIComponent(day)}`,
        ).catch(() => ({ routes: [] as HomeRoute[] })),
      ]);
      setData(snap);
      setRoutesSummary(summary);
      setVisits(visitsRes.visits);
      setRoutes(routesRes.routes);
    } catch (e) {
      setData(null);
      setRoutesSummary(null);
      setVisits([]);
      setRoutes([]);
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar operação');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const upcomingVisits = useMemo(() => {
    const now = Date.now();
    return [...visits]
      .filter((v) => {
        const t = new Date(v.scheduledStart).getTime();
        if (Number.isNaN(t)) return true;
        return t >= now - 30 * 60 * 1000;
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime(),
      )
      .slice(0, 8);
  }, [visits]);

  if (!user) {
    return (
      <p className="p-6 text-sm text-[var(--muted)]">
        Não foi possível carregar a sessão.{' '}
        <Link href="/login" className="ops-link">
          Entrar novamente
        </Link>
      </p>
    );
  }

  const isOpsRole =
    user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'SUPERVISOR';

  if (!isOpsRole) {
    return (
      <section className="space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-900">Olá, {user.name}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{user.company.name} · Campo</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/field/my-route" className="ops-btn ops-btn-primary">
            Minha rota
          </Link>
          <Link href="/agenda" className="ops-btn ops-btn-secondary">
            Agenda
          </Link>
          <Link href="/customers" className="ops-btn ops-btn-ghost">
            Clientes
          </Link>
        </div>
      </section>
    );
  }

  const canManageTeam = user.role === 'ADMIN' || user.role === 'MANAGER';

  const empty =
    data &&
    data.team.total === 0 &&
    data.visits.planned === 0 &&
    data.routes.count === 0 &&
    data.live.length === 0;

  const onlineCount = data
    ? data.live.filter((r) => r.presence === 'online').length
    : 0;
  const offlineCount = data
    ? data.live.filter((r) => r.presence !== 'online').length
    : 0;
  const problemAlerts = data
    ? data.alerts.filter((a) => a.severity === 'warning' || a.severity === 'critical').length
    : 0;

  let executionPct: number | null = null;
  let executionLabel = '—';
  if (data) {
    if (data.visits.planned > 0) {
      executionPct = Math.round((data.visits.completed / data.visits.planned) * 100);
      executionLabel = `${data.visits.completed}/${data.visits.planned}`;
    } else if (data.routes.executionPercent != null) {
      executionPct = data.routes.executionPercent;
      executionLabel = `${data.routes.executionPercent}%`;
    }
  }

  return (
    <section className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-900">
            Centro de Operações
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {user.company.name} · {user.name}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="ops-label mb-0">Dia</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="ops-input"
            />
          </label>
          {data && !empty ? (
            <Link
              href={problemAlerts > 0 ? '/map' : '/agenda'}
              className="ops-btn ops-btn-primary"
            >
              {problemAlerts > 0 ? 'Ver no mapa' : 'Abrir agenda'}
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <p
          className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="h-24 animate-pulse rounded-[8px] bg-surface" />
      ) : null}

      {data ? (
        <>
          <div>
            <h2 className="ops-label mb-2">O que exige atenção</h2>
            {data.alerts.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Nenhum alerta no momento.</p>
            ) : (
              <ul className="space-y-2">
                {data.alerts.map((a) => (
                  <li
                    key={a.code}
                    className={`rounded-[6px] border px-3 py-2 text-sm ${
                      a.severity === 'critical'
                        ? 'border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]'
                        : a.severity === 'warning'
                          ? 'border-[var(--warn)]/40 bg-[var(--warn-bg)] text-[var(--warn)]'
                          : 'border-[var(--border)] bg-[#161618] text-brand-800'
                    }`}
                  >
                    {a.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="ops-label mb-2">Execução do dia</h2>
            {executionPct != null ? (
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="text-2xl font-semibold tabular-nums text-brand-900">{executionPct}%</p>
                <p className="text-sm text-[var(--muted)]">
                  {data.visits.planned > 0
                    ? `Visitas concluídas ${executionLabel}`
                    : `Execução de rota ${executionLabel}`}
                  {data.routes.actualDistanceMeters != null ||
                  data.routes.plannedDistanceMeters != null
                    ? ` · Km ${formatMetersKm(data.routes.actualDistanceMeters)} / ${formatMetersKm(data.routes.plannedDistanceMeters)}`
                    : ''}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">Execução —</p>
            )}
            <div className="mt-2 h-1.5 max-w-md overflow-hidden rounded-full bg-brand-100">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.min(100, Math.max(0, executionPct ?? 0))}%` }}
              />
            </div>
          </div>

          <MetricStrip
            items={[
              {
                label: 'Equipe',
                value: data.team.total,
                href: canManageTeam ? '/employees' : '/map',
                detail: [
                  `${data.team.inRoute} em rota`,
                  data.meta.inServiceAvailable
                    ? `${data.team.inService} em atendimento`
                    : 'Em atendimento —',
                  `${data.team.offline} offline`,
                ].join(' · '),
              },
              {
                label: 'Visitas',
                value: data.visits.planned,
                href: '/agenda',
                detail: [
                  `${data.visits.completed} concluídas`,
                  `${data.visits.inProgress} em andamento`,
                  data.visits.delayed > 0 ? `${data.visits.delayed} atrasadas` : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
              },
              {
                label: 'Rotas',
                value: data.routes.count,
                href: '/routes',
                detail: [
                  routesSummary ? `${routesSummary.inProgress} em andamento` : 'Em andamento —',
                  formatMetersKm(data.routes.plannedDistanceMeters) !== '—'
                    ? `${formatMetersKm(data.routes.plannedDistanceMeters)} plan.`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
              },
              {
                label: 'Ao vivo',
                value: data.team.onlineLive,
                href: '/map',
                detail: `${onlineCount} online · ${offlineCount} offline`,
              },
            ]}
          />

          {!data.meta.inServiceAvailable ? (
            <p className="text-xs text-[var(--muted)]">
              “Em atendimento” depende do check-in de visita.
            </p>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="ops-label mb-0">
                  Equipe ao vivo
                </h2>
                <Link href="/map" className="ops-link text-xs">
                  Abrir mapa
                </Link>
              </div>
              {data.live.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-brand-100 bg-surface px-4 py-6 text-sm text-[var(--muted)]">
                  Nenhum funcionário com login ativo nesta empresa.
                </p>
              ) : (
                <ul className="divide-y divide-brand-50 overflow-hidden rounded-2xl border border-brand-100 bg-surface">
                  {data.live.map((row) => (
                    <li
                      key={row.employeeId}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                    >
                      <span className="flex items-center gap-2 font-semibold text-brand-900">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            row.presence === 'online' ? 'bg-emerald-500' : 'bg-brand-200'
                          }`}
                          aria-hidden
                        />
                        {row.employeeName}
                      </span>
                      <span className="text-[var(--muted)]">{opsEmployeeStatusLine(row)}</span>
                      <span className="text-[var(--muted)]">
                        {row.presence === 'online' ? 'Online' : 'Offline'}
                        {row.currentCustomerName
                          ? ` · ${row.currentCustomerName}`
                          : row.vehiclePlate
                            ? ` · ${row.vehiclePlate}`
                            : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="ops-label mb-0">
                  Próximas visitas
                </h2>
                <Link
                  href="/agenda"
                  className="text-xs ops-link"
                >
                  Agenda
                </Link>
              </div>
              {upcomingVisits.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-brand-100 bg-surface px-4 py-6 text-sm text-[var(--muted)]">
                  Nenhuma visita neste dia.
                </p>
              ) : (
                <ul className="divide-y divide-brand-50 overflow-hidden rounded-2xl border border-brand-100 bg-surface">
                  {upcomingVisits.map((v) => (
                    <li
                      key={v.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                    >
                      <span className="font-semibold tabular-nums text-brand-900">
                        {new Date(v.scheduledStart).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-brand-800">
                        {v.customer.tradeName || v.customer.name}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {labelOf(VISIT_STATUS_LABELS, v.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="ops-label mb-0">
                Rotas do dia
              </h2>
              <Link href="/routes" className="text-xs ops-link">
                Planejador
              </Link>
            </div>
            {routes.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-brand-100 bg-surface px-4 py-6 text-sm text-[var(--muted)]">
                Nenhuma rota neste dia.
              </p>
            ) : (
              <ul className="space-y-2">
                {routes.map((route, index) => (
                  <li
                    key={route.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-surface px-4 py-3 text-sm"
                  >
                    <span className="font-semibold text-brand-900">
                      Rota {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-brand-800">
                      {route.employee?.name || 'Sem funcionário'}
                    </span>
                    <span className="text-[var(--muted)]">
                      {route._count?.stops != null
                        ? `${route._count.stops} paradas`
                        : 'Paradas —'}
                    </span>
                    <span className="text-[var(--muted)]">Concluídas —</span>
                    <span className="font-medium text-brand-800">
                      {ROUTE_LIST_STATUS[route.status] ?? route.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {empty ? (
            <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 px-6 py-8 text-center">
              <p className="font-medium text-brand-900">Nenhuma operação neste dia</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Publique rotas ou crie ordens de serviço para começar.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Link
                  href="/routes"
                  className="ops-btn ops-btn-primary"
                >
                  Ir para Rotas
                </Link>
                <Link
                  href="/services"
                  className="ops-btn ops-btn-secondary"
                >
                  Ir para Serviços
                </Link>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
