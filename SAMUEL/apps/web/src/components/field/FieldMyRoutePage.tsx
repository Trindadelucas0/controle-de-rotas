'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch, apiUpload, ApiError } from '@/lib/api-client';
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
import { SlideToComplete } from '@/components/field/SlideToComplete';
import { CompleteRouteConfirm, type CompleteRoutePayload } from '@/components/field/CompleteRouteConfirm';
import {
  RecordToCustomerSheet,
  type RecordPointForm,
} from '@/components/field/RecordToCustomerSheet';
import {
  canCompleteAsFinished,
  hasOpenVisitOnStops,
  remainingPlannedMeters,
} from '@/lib/route-complete';

const POLL_MS = 15_000;

type RouteStop = {
  id: string;
  sequence: number;
  status: string;
  latitude: number;
  longitude: number;
  plannedDistanceMeters?: number | null;
  plannedDurationSeconds?: number | null;
  visit: {
    id: string;
    status?: string;
    customer: { id: string; name: string };
    serviceOrder: { id: string; number: number; title: string };
  };
};

type RecordedCustomer = {
  id: string;
  name: string;
  phone?: string | null;
  document?: string | null;
  city?: string | null;
  state?: string | null;
  street?: string | null;
  notes?: string | null;
  profileIncomplete?: boolean;
};

type MyRoute = {
  id: string;
  status: string;
  date: string;
  startedAt?: string | null;
  recordTrip?: boolean;
  recordNewCustomer?: boolean;
  recordedCustomers?: RecordedCustomer[];
  plannedDistanceMeters?: number | null;
  plannedDurationSeconds?: number | null;
  plannedGeometryJson?: unknown;
  plannedStepsJson?: unknown;
  startOdometerKm?: number | null;
  startFuelLevel?: string | null;
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
  const [confirmRoute, setConfirmRoute] = useState<MyRoute | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [openRecorded, setOpenRecorded] = useState<RecordedCustomer[]>([]);
  const [editOpen, setEditOpen] = useState<RecordedCustomer | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
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
          openRecordedCustomers?: RecordedCustomer[];
        }>(`/api/v1/field/my-route?date=${encodeURIComponent(dateYmd)}`);
        const list = r.routes?.length ? r.routes : r.route ? [r.route] : [];
        setRoutes(list);
        setOpenRecorded(r.openRecordedCustomers ?? []);
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

  async function openCompleteConfirm(route: MyRoute) {
    if (completingId) return;
    if (!route.recordNewCustomer && hasOpenVisitOnStops(route.stops)) {
      setError('Finalize a visita em andamento antes de concluir a rota.');
      return;
    }
    setConfirmError(null);
    setError(null);
    setConfirmRoute(route);
  }

  async function submitComplete(payload: CompleteRoutePayload) {
    if (!confirmRoute || completingId) return;
    const pending = confirmRoute.stops.filter((s) => s.status === 'PENDING');
    const remaining = remainingPlannedMeters(confirmRoute.stops);
    const asFinished = confirmRoute.recordNewCustomer
      ? true
      : canCompleteAsFinished(remaining, pending.length);
    const mode = asFinished ? 'COMPLETED' : 'INCOMPLETE';
    setCompletingId(confirmRoute.id);
    setConfirmError(null);
    setError(null);
    try {
      const form = new FormData();
      form.append('mode', mode);
      form.append('endOdometerKm', String(payload.endOdometerKm));
      form.append('endFuelLevel', payload.endFuelLevel);
      form.append('file', payload.file);
      await apiUpload(`/api/v1/field/routes/${confirmRoute.id}/complete`, form);
      stopWatch();
      setGpsStatus('GPS parado');
      setConfirmRoute(null);
      await load();
    } catch (e) {
      setConfirmError(e instanceof ApiError ? e.message : 'Não foi possível concluir a rota');
    } finally {
      setCompletingId(null);
    }
  }

  async function saveOpenCustomer(form: RecordPointForm) {
    if (!editOpen || editBusy) return;
    setEditBusy(true);
    setEditError(null);
    try {
      await apiFetch(`/api/v1/customers/${editOpen.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          document: form.document.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          street: form.street.trim() || null,
          notes: form.notes.trim() || null,
          profileIncomplete: false,
        }),
      });
      setEditOpen(null);
      await load({ silent: true });
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : 'Não foi possível salvar o cadastro');
    } finally {
      setEditBusy(false);
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
            Encerrar a navegação não conclui a rota. Arraste para{' '}
            <strong>concluir a rota</strong> no card abaixo para liberar o início de outra.
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

      {openRecorded.length ? (
        <div className="rounded-2xl border border-amber-300/50 bg-surface p-4">
          <p className="text-sm font-semibold text-brand-900">Cadastros em aberto</p>
          <ul className="mt-2 space-y-2">
            {openRecorded.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-brand-900">{c.name}</span>
                <button
                  type="button"
                  className="ops-btn ops-btn-secondary text-xs"
                  onClick={() => {
                    setEditError(null);
                    setEditOpen(c);
                  }}
                >
                  Editar
                </button>
              </li>
            ))}
          </ul>
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
                    {route.recordNewCustomer ? 'Gravar acesso' : `Rota ${index + 1}`} ·{' '}
                    {statusLabel(route.status)}
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
                    {route.recordNewCustomer
                      ? ` · ${route.recordedCustomers?.length ?? 0} ponto(s)`
                      : ` · ${route.stops.length} parada(s)`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canPlay ? (
                    <Link
                      href={`/field/start/${route.id}`}
                      className="ops-btn ops-btn-primary"
                    >
                      ▶ {route.recordNewCustomer ? 'Iniciar gravação' : 'Iniciar rota'}
                    </Link>
                  ) : null}
                  {route.status === 'PUBLISHED' && inProgress && !isActive ? (
                    <p className="self-center text-xs text-[var(--muted)]">
                      Conclua a rota em andamento para iniciar esta.
                    </p>
                  ) : null}
                  {isActive ? (
                    <Link
                      href="/field/navigate"
                      className="ops-btn ops-btn-primary"
                    >
                      Continuar navegação
                    </Link>
                  ) : null}
                </div>
              </div>

              {isActive ? (
                <div className="mt-3">
                  <SlideToComplete
                    label={
                      route.recordNewCustomer
                        ? 'Arraste para finalizar por completo'
                        : undefined
                    }
                    busy={completingId === route.id}
                    disabled={completingId != null && completingId !== route.id}
                    onComplete={() => void openCompleteConfirm(route)}
                  />
                </div>
              ) : null}

              {route.recordNewCustomer ? null : (
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
              )}

              <ul className="mt-4 space-y-3">
                {route.recordNewCustomer
                  ? (route.recordedCustomers ?? []).map((c, i) => (
                      <li key={c.id} className="rounded-xl border border-brand-50 bg-brand-50/40 p-3">
                        <p className="ops-label mb-0">Ponto {i + 1}</p>
                        <p className="mt-1 text-base font-semibold text-brand-900">{c.name}</p>
                        {c.profileIncomplete ? (
                          <p className="text-xs text-amber-700">Cadastro em aberto</p>
                        ) : null}
                      </li>
                    ))
                  : [...route.stops]
                .sort((a, b) => a.sequence - b.sequence)
                .map((s) => (
                  <li key={s.id} className="rounded-xl border border-brand-50 bg-brand-50/40 p-3">
                    <p className="ops-label mb-0">
                      Parada {s.sequence}
                    </p>
                    <p className="mt-1 text-base font-semibold text-brand-900">
                      {s.visit.customer.name}
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

      {confirmRoute ? (
        <CompleteRouteConfirm
          pendingCount={confirmRoute.stops.filter((s) => s.status === 'PENDING').length}
          totalStops={confirmRoute.stops.length}
          remainingMeters={remainingPlannedMeters(confirmRoute.stops)}
          asFinished={
            confirmRoute.recordNewCustomer
              ? true
              : canCompleteAsFinished(
                  remainingPlannedMeters(confirmRoute.stops),
                  confirmRoute.stops.filter((s) => s.status === 'PENDING').length,
                )
          }
          recordMission={
            confirmRoute.recordNewCustomer
              ? { pointCount: confirmRoute.recordedCustomers?.length ?? 0 }
              : undefined
          }
          busy={completingId === confirmRoute.id}
          error={confirmError}
          suggestedOdometerKm={confirmRoute.startOdometerKm}
          suggestedFuelLevel={confirmRoute.startFuelLevel}
          onCancel={() => {
            if (completingId) return;
            setConfirmRoute(null);
            setConfirmError(null);
          }}
          onConfirm={(payload) => void submitComplete(payload)}
        />
      ) : null}

      {editOpen ? (
        <RecordToCustomerSheet
          title="Completar cadastro"
          initial={{
            name: editOpen.name,
            phone: editOpen.phone ?? '',
            document: editOpen.document ?? '',
            city: editOpen.city ?? '',
            state: editOpen.state ?? '',
            street: editOpen.street ?? '',
            notes: editOpen.notes ?? '',
          }}
          busy={editBusy}
          error={editError}
          submitLabel="Concluir cadastro"
          showLater={false}
          onCancel={() => {
            if (editBusy) return;
            setEditOpen(null);
            setEditError(null);
          }}
          onSave={(form) => void saveOpenCustomer(form)}
        />
      ) : null}
    </section>
  );
}
