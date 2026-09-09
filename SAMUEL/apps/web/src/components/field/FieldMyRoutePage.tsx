'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api-client';
import {
  gpsActiveLabel,
  geolocationErrorMessage,
  isInsecureGeolocationContext,
  startRouteGpsWatch,
  trackingErrorMessage,
  TRACK_RECORD_TRIP_INTERVAL_MS,
  TRACK_RECORD_TRIP_MIN_MOVE_M,
  type RouteGpsWatchHandle,
} from '@/lib/field-tracking';
import { toDateInputValue } from '@/lib/ops-labels';
import { formatDuration, formatMeters } from '@/components/routes/routes-planner-shared';
import { FieldRoutePreviewMap } from '@/components/field/FieldRoutePreviewMap';

const POLL_MS = 15_000;

type RouteStop = {
  id: string;
  sequence: number;
  latitude: number;
  longitude: number;
  plannedDistanceMeters?: number | null;
  plannedDurationSeconds?: number | null;
  visit: {
    id: string;
    customer: { id: string; name: string };
    serviceOrder: { id: string; number: number; title: string };
  };
};

type MyRoute = {
  id: string;
  status: string;
  date: string;
  startedAt?: string | null;
  recordTrip?: boolean;
  plannedDistanceMeters?: number | null;
  plannedDurationSeconds?: number | null;
  plannedGeometryJson?: unknown;
  plannedStepsJson?: unknown;
  vehicle: { id: string; plate: string; brand: string | null; model: string | null } | null;
  employee: { id: string; name: string } | null;
  stops: RouteStop[];
};

function statusLabel(status: string) {
  if (status === 'PUBLISHED') return 'Publicada';
  if (status === 'IN_PROGRESS') return 'Em andamento';
  return status;
}

function formatDateBr(ymd: string) {
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function routeDateYmd(date: string) {
  return date.slice(0, 10);
}

export function FieldMyRoutePage() {
  const [routes, setRoutes] = useState<MyRoute[]>([]);
  const [searchedDate, setSearchedDate] = useState(() => toDateInputValue());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState('GPS parado');
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);
  const watchRef = useRef<RouteGpsWatchHandle | null>(null);
  const trackingRouteIdRef = useRef<string | null>(null);

  const stopWatch = useCallback(() => {
    watchRef.current?.stop();
    watchRef.current = null;
    trackingRouteIdRef.current = null;
  }, []);

  const startWatching = useCallback(
    (routeId: string, recordTrip?: boolean) => {
      if (!navigator.geolocation) {
        setGpsStatus('Geolocation indisponível neste dispositivo');
        return;
      }
      if (isInsecureGeolocationContext()) {
        setGpsStatus(
          'GPS bloqueado em HTTP. Use HTTPS (túnel) no celular ou localhost no PC.',
        );
        return;
      }
      if (trackingRouteIdRef.current === routeId && watchRef.current) {
        return;
      }
      stopWatch();
      trackingRouteIdRef.current = routeId;
      setGpsStatus('Aguardando permissão GPS…');

      watchRef.current = startRouteGpsWatch(
        routeId,
        {
          onPosition: (pos) => {
            const accuracy = pos.coords.accuracy;
            setLastAccuracy(Number.isFinite(accuracy) ? accuracy : null);
          },
          onPosted: () => setGpsStatus(gpsActiveLabel()),
          onPostError: (e) => setGpsStatus(trackingErrorMessage(e)),
          onError: (err) => {
            setGpsStatus(geolocationErrorMessage(err));
            if (err.code === 1) stopWatch();
          },
        },
        recordTrip
          ? {
              maxIntervalMs: TRACK_RECORD_TRIP_INTERVAL_MS,
              minMoveM: TRACK_RECORD_TRIP_MIN_MOVE_M,
            }
          : {},
      );
    },
    [stopWatch],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const dateYmd = toDateInputValue();
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const r = await apiFetch<{
          date: string;
          routes: MyRoute[];
          route: MyRoute | null;
        }>(`/api/v1/field/my-route?date=${encodeURIComponent(dateYmd)}`);
        const list = r.routes?.length ? r.routes : r.route ? [r.route] : [];
        setRoutes(list);
        setSearchedDate(r.date || dateYmd);
        const active = list.find((x) => x.status === 'IN_PROGRESS');
        if (active) {
          startWatching(active.id, active.recordTrip);
        } else if (!opts?.silent) {
          stopWatch();
          setGpsStatus('GPS parado');
        }
      } catch (e) {
        if (!opts?.silent) {
          setError(e instanceof ApiError ? e.message : 'Falha ao carregar rota');
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [startWatching, stopWatch],
  );

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load({ silent: true }), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      stopWatch();
    };
  }, [load, stopWatch]);

  async function onComplete(routeId: string) {
    setCompletingId(routeId);
    setError(null);
    try {
      await apiFetch(`/api/v1/routes/${routeId}/complete`, { method: 'POST' });
      stopWatch();
      setGpsStatus('GPS parado');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível concluir a rota');
    } finally {
      setCompletingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Carregando suas rotas…</p>;
  }

  if (!routes.length) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-brand-900">Minha rota</h1>
        <div className="rounded-2xl border border-brand-100 bg-surface p-6 text-sm text-[var(--muted)]">
          Nenhuma rota para hoje ({formatDateBr(searchedDate)}). Peça ao gestor para publicar uma
          rota com o seu funcionário selecionado e a data correta no planejador.
        </div>
        <Link href="/agenda" className="text-sm ops-link">
          Ver agenda
        </Link>
      </section>
    );
  }

  const inProgress = routes.find((r) => r.status === 'IN_PROGRESS');
  const inProgressYmd = inProgress ? routeDateYmd(inProgress.date) : null;
  const leftoverFromOtherDay = Boolean(inProgressYmd && inProgressYmd !== searchedDate);
  const dayRoutes = leftoverFromOtherDay
    ? routes.filter((r) => r.id !== inProgress?.id)
    : routes;
  const dayDuration = dayRoutes.reduce((sum, r) => sum + (r.plannedDurationSeconds ?? 0), 0);
  const dayDistance = dayRoutes.reduce((sum, r) => sum + (r.plannedDistanceMeters ?? 0), 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Minha rota</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {leftoverFromOtherDay && dayRoutes.length === 0
              ? `Nenhuma rota publicada para hoje (${formatDateBr(searchedDate)})`
              : `${dayRoutes.length} rota(s) em ${formatDateBr(searchedDate)}`}
            {leftoverFromOtherDay && inProgressYmd
              ? ` · 1 em andamento de ${formatDateBr(inProgressYmd)}`
              : ''}
            {dayDuration > 0 ? ` · ~${formatDuration(dayDuration)} de deslocamento` : ''}
            {dayDistance > 0 ? ` · ${formatMeters(dayDistance)}` : ''}
          </p>
        </div>
        <Link
          href="/field/tracking-status"
          className="ops-btn ops-btn-secondary"
        >
          Status GPS
        </Link>
      </div>

      {leftoverFromOtherDay && inProgressYmd ? (
        <div
          className="rounded-[8px] border border-[var(--warn)]/40 bg-[var(--warn-bg)] px-4 py-3 text-sm text-[var(--warn)]"
          role="status"
        >
          <p className="font-semibold">
            Rota de {formatDateBr(inProgressYmd)} ainda em andamento
          </p>
          <p className="mt-1">
            Encerrar a navegação não conclui a rota. Toque em <strong>Concluir rota</strong> no
            card abaixo para liberar o início de outra.
          </p>
        </div>
      ) : null}

      {error ? (
        <p
          className="rounded-[6px] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {inProgress ? (
        <div className="rounded-2xl border border-brand-100 bg-surface p-4 text-sm">
          <p className="font-semibold text-brand-900">Tracking HTTP ativo</p>
          <p className="mt-1 text-[var(--muted)]">{gpsStatus}</p>
          {lastAccuracy != null ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Precisão ≈ {Math.round(lastAccuracy)} m
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4">
        {routes.map((route, index) => {
          const canPlay = route.status === 'PUBLISHED' && !inProgress;
          const isActive = route.status === 'IN_PROGRESS';
          return (
            <article
              key={route.id}
              className={
                isActive && leftoverFromOtherDay
                  ? 'rounded-2xl border border-amber-300 bg-surface p-4'
                  : 'rounded-2xl border border-brand-100 bg-surface p-4'
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-brand-900">
                    Rota {index + 1} · {statusLabel(route.status)}
                    {routeDateYmd(route.date) !== searchedDate
                      ? ` · ${formatDateBr(routeDateYmd(route.date))}`
                      : ''}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {route.vehicle ? `Veículo ${route.vehicle.plate}` : 'Sem veículo'}
                    {route.plannedDurationSeconds != null
                      ? ` · ~${formatDuration(route.plannedDurationSeconds)}`
                      : ''}
                    {route.plannedDistanceMeters != null
                      ? ` · ${formatMeters(route.plannedDistanceMeters)}`
                      : ''}
                    {` · ${route.stops.length} parada(s)`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canPlay ? (
                    <Link
                      href={`/field/start/${route.id}`}
                      className="ops-btn ops-btn-primary"
                    >
                      ▶ Iniciar rota
                    </Link>
                  ) : null}
                  {route.status === 'PUBLISHED' && inProgress && !isActive ? (
                    <p className="self-center text-xs text-[var(--muted)]">
                      Conclua a rota em andamento para iniciar esta.
                    </p>
                  ) : null}
                  {isActive ? (
                    <>
                      <Link
                        href="/field/navigate"
                        className="ops-btn ops-btn-primary"
                      >
                        Continuar navegação
                      </Link>
                      <button
                        type="button"
                        disabled={completingId === route.id}
                        onClick={() => void onComplete(route.id)}
                        className="ops-btn ops-btn-secondary disabled:opacity-60"
                      >
                        {completingId === route.id ? 'Concluindo…' : 'Concluir rota'}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              <FieldRoutePreviewMap
                geometryJson={route.plannedGeometryJson}
                stops={route.stops.map((s) => ({
                  id: s.id,
                  sequence: s.sequence,
                  latitude: s.latitude,
                  longitude: s.longitude,
                  label: s.visit.customer.name,
                }))}
              />

              <ul className="mt-4 space-y-3">
                {[...route.stops]
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((s) => (
                  <li key={s.id} className="rounded-xl border border-brand-50 bg-brand-50/40 p-3">
                    <p className="ops-label mb-0">
                      Parada {s.sequence}
                    </p>
                    <p className="mt-1 text-base font-semibold text-brand-900">
                      <Link
                        href={`/customers/${s.visit.customer.id}`}
                        className="hover:underline"
                      >
                        {s.visit.customer.name}
                      </Link>
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      <Link
                        href={`/services/${s.visit.serviceOrder.id}`}
                        className="hover:underline"
                      >
                        OS #{s.visit.serviceOrder.number}
                      </Link>
                      {' — '}
                      {s.visit.serviceOrder.title}
                    </p>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
