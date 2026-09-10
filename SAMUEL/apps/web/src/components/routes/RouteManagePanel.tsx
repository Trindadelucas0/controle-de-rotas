'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api-client';
import { addDaysYmd, toDateInputValue } from '@/lib/ops-labels';
import { formatDuration, formatMeters } from './routes-planner-shared';

const EDITABLE = new Set(['PLANNED', 'PUBLISHED']);
const PLAN_STATUSES = new Set(['SCHEDULED', 'RESCHEDULED', 'ASSIGNED']);

const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Planejada',
  ASSIGNED: 'Atribuída',
  PUBLISHED: 'Publicada',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
};

type RouteStopDetail = {
  id: string;
  sequence: number;
  visitId: string;
  latitude: number;
  longitude: number;
  plannedDistanceMeters: number | null;
  plannedDurationSeconds: number | null;
  visit: {
    id: string;
    customer: { id: string; name: string };
    serviceOrder: { id: string; number: number; title: string };
  };
};

type RouteDetail = {
  id: string;
  status: string;
  date: string;
  roundtrip: boolean;
  recordTrip: boolean;
  employeeId: string | null;
  vehicleId: string | null;
  plannedDistanceMeters: number | null;
  plannedDurationSeconds: number | null;
  plannedGeometryJson: { type: 'LineString'; coordinates: [number, number][] } | null;
  quality: string | null;
  employee: { id: string; name: string } | null;
  vehicle: { id: string; plate: string } | null;
  stops: RouteStopDetail[];
};

type PlanVisit = {
  id: string;
  status: string;
  latitude: number;
  longitude: number;
  customer: { id: string; name: string; tradeName: string | null };
  serviceOrder: { id: string; number: number; title: string };
  routeStop: { id: string; routeId: string; sequence: number } | null;
};

type EmployeeOption = { id: string; name: string; status?: string };
type VehicleOption = { id: string; plate: string; status?: string };

type PreviewStop = {
  sequence: number;
  visitId: string;
  name: string;
  distanceMeters: number;
  durationSeconds: number;
};

type RoutePreview = {
  stops: PreviewStop[];
  totals: { distanceMeters: number; durationSeconds: number; distanceKm: number };
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  quality: string;
  roundtrip: boolean;
};

type LocalStop = {
  visitId: string;
  customerName: string;
  serviceOrderLabel: string;
};

type Props = {
  routeId: string;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
};

function routeDateYmd(raw: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return toDateInputValue(new Date(raw));
}

export function RouteManagePanel({ routeId, canManage, onClose, onChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [roundtrip, setRoundtrip] = useState(true);
  const [recordTrip, setRecordTrip] = useState(false);
  const [routeDate, setRouteDate] = useState(toDateInputValue());
  const [employeeId, setEmployeeId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [stops, setStops] = useState<LocalStop[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [availableVisits, setAvailableVisits] = useState<PlanVisit[]>([]);
  const [addQ, setAddQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [preview, setPreview] = useState<RoutePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewAbort = useRef<AbortController | null>(null);

  const editable = canManage && EDITABLE.has(status);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const [{ route }, empRes, vehRes] = await Promise.all([
        apiFetch<{ route: RouteDetail }>(`/api/v1/routes/${routeId}`),
        canManage
          ? apiFetch<{ employees: EmployeeOption[] }>('/api/v1/employees')
          : Promise.resolve({ employees: [] as EmployeeOption[] }),
        canManage
          ? apiFetch<{ vehicles: VehicleOption[] }>('/api/v1/vehicles')
          : Promise.resolve({ vehicles: [] as VehicleOption[] }),
      ]);

      setStatus(route.status);
      setRoundtrip(route.roundtrip !== false);
      setRecordTrip(route.recordTrip === true);
      setRouteDate(routeDateYmd(route.date));
      setEmployeeId(route.employeeId || route.employee?.id || '');
      setVehicleId(route.vehicleId || route.vehicle?.id || '');
      setEmployeeName(route.employee?.name || '');
      setVehiclePlate(route.vehicle?.plate || '');
      setStops(
        [...route.stops]
          .sort((a, b) => a.sequence - b.sequence)
          .map((s) => ({
            visitId: s.visitId,
            customerName: s.visit.customer.name,
            serviceOrderLabel: `OS ${s.visit.serviceOrder.number} · ${s.visit.serviceOrder.title}`,
          })),
      );
      setEmployees(empRes.employees.filter((x) => !x.status || x.status === 'ACTIVE'));
      setVehicles(
        vehRes.vehicles.filter(
          (x) => !x.status || x.status === 'AVAILABLE' || x.status === 'IN_USE',
        ),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar a rota');
    } finally {
      setLoading(false);
    }
  }, [routeId, canManage]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const loadAvailableVisits = useCallback(async () => {
    try {
      const today = toDateInputValue();
      const from = new Date(`${addDaysYmd(today, -7)}T00:00:00`);
      const to = new Date(`${addDaysYmd(today, 30)}T23:59:59.999`);
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const r = await apiFetch<{ visits: PlanVisit[] }>(`/api/v1/visits?${params}`);
      const selected = new Set(stops.map((s) => s.visitId));
      setAvailableVisits(
        r.visits.filter(
          (v) =>
            PLAN_STATUSES.has(v.status) &&
            !v.routeStop &&
            !selected.has(v.id) &&
            Number.isFinite(v.latitude) &&
            Number.isFinite(v.longitude),
        ),
      );
    } catch {
      setAvailableVisits([]);
    }
  }, [stops]);

  useEffect(() => {
    if (!showAdd || !editable) return;
    void loadAvailableVisits();
  }, [showAdd, editable, loadAvailableVisits]);

  const visitIdsKey = stops.map((s) => s.visitId).join(',');

  useEffect(() => {
    if (!editable || stops.length === 0) {
      setPreview(null);
      return;
    }
    previewAbort.current?.abort();
    const ac = new AbortController();
    previewAbort.current = ac;
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      apiFetch<RoutePreview>('/api/v1/routes/preview', {
        method: 'POST',
        body: JSON.stringify({ visitIds: stops.map((s) => s.visitId), roundtrip }),
        signal: ac.signal,
      })
        .then((p) => {
          if (!ac.signal.aborted) setPreview(p);
        })
        .catch((e) => {
          if (ac.signal.aborted) return;
          if (e instanceof ApiError) setError(e.message);
          setPreview(null);
        })
        .finally(() => {
          if (!ac.signal.aborted) setPreviewLoading(false);
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [editable, visitIdsKey, roundtrip, stops]);

  const filteredAdd = useMemo(() => {
    const q = addQ.trim().toLowerCase();
    if (!q) return availableVisits;
    return availableVisits.filter((v) => {
      const name = (v.customer.tradeName || v.customer.name).toLowerCase();
      return name.includes(q) || String(v.serviceOrder.number).includes(q);
    });
  }, [availableVisits, addQ]);

  function moveStop(index: number, dir: -1 | 1) {
    setStops((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[index]!;
      next[index] = next[j]!;
      next[j] = tmp;
      return next;
    });
    setMsg(null);
  }

  function removeStop(visitId: string) {
    setStops((prev) => prev.filter((s) => s.visitId !== visitId));
    setMsg(null);
  }

  function addVisit(v: PlanVisit) {
    setStops((prev) => {
      if (prev.some((s) => s.visitId === v.id)) return prev;
      if (prev.length >= 25) return prev;
      return [
        ...prev,
        {
          visitId: v.id,
          customerName: v.customer.tradeName || v.customer.name,
          serviceOrderLabel: `OS ${v.serviceOrder.number} · ${v.serviceOrder.title}`,
        },
      ];
    });
    setMsg(null);
    setShowAdd(false);
    setAddQ('');
  }

  async function saveChanges() {
    if (!editable || saving || !preview) return;
    if (!employeeId || !vehicleId) {
      setError('Selecione funcionário e veículo.');
      return;
    }
    if (stops.length === 0) {
      setError('A rota precisa de ao menos uma parada.');
      return;
    }
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/routes/${routeId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          date: routeDate,
          employeeId,
          vehicleId,
          stops: preview.stops.map((s) => ({
            visitId: s.visitId,
            sequence: s.sequence,
            distanceMeters: s.distanceMeters,
            durationSeconds: s.durationSeconds,
          })),
          roundtrip: preview.roundtrip,
          recordTrip,
          plannedDistanceMeters: preview.totals.distanceMeters,
          plannedDurationSeconds: preview.totals.durationSeconds,
          geometry: preview.geometry,
          quality: preview.quality,
        }),
      });
      setMsg('Alterações salvas.');
      onChanged();
      await loadDetail();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao salvar alterações');
    } finally {
      setSaving(false);
    }
  }

  async function cancelRoute() {
    if (!editable || cancelling) return;
    const ok = window.confirm(
      'Cancelar esta rota? As visitas voltam a ficar livres para outro planejamento.',
    );
    if (!ok) return;
    setCancelling(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/routes/${routeId}/cancel`, { method: 'POST' });
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao cancelar a rota');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div
      className="ops-surface fixed inset-x-0 bottom-0 z-40 flex max-h-[92vh] flex-col overflow-hidden rounded-t-[12px] border-t border-[var(--border)] shadow-lg sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[min(420px,100vw)] sm:rounded-none sm:border-l sm:border-t-0"
      role="dialog"
      aria-label="Gerir rota"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <p className="text-base font-semibold text-brand-900">Gerir rota</p>
          <p className="text-sm text-brand-800">
            {(STATUS_LABEL[status] ?? status) || '—'}
          </p>
        </div>
        <button type="button" className="ops-btn ops-btn-secondary text-sm" onClick={onClose}>
          Fechar
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-surface" />
        ) : (
          <>
            {error ? (
              <p className="rounded-[8px] bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
            ) : null}
            {msg ? (
              <p className="rounded-[8px] bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {msg}
              </p>
            ) : null}

            {!editable ? (
              <p className="text-sm text-[var(--muted)]">
                Esta rota não pode ser alterada nem cancelada neste status. Só rotas
                planejadas ou publicadas (antes do Play).
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-1">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-brand-900">Data</span>
                <input
                  type="date"
                  value={routeDate}
                  disabled={!editable || saving}
                  onChange={(e) => setRouteDate(e.target.value)}
                  className="w-full ops-input text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-brand-900">Funcionário</span>
                {editable ? (
                  <select
                    value={employeeId}
                    disabled={saving}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full ops-input text-sm"
                  >
                    <option value="">Selecione…</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="ops-input text-sm">{employeeName || '—'}</p>
                )}
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-brand-900">Veículo</span>
                {editable ? (
                  <select
                    value={vehicleId}
                    disabled={saving}
                    onChange={(e) => setVehicleId(e.target.value)}
                    className="w-full ops-input text-sm"
                  >
                    <option value="">Selecione…</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="ops-input text-sm">{vehiclePlate || '—'}</p>
                )}
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-brand-900">Paradas (clientes)</p>
                {editable ? (
                  <button
                    type="button"
                    className="ops-btn ops-btn-secondary text-xs"
                    onClick={() => setShowAdd((v) => !v)}
                  >
                    {showAdd ? 'Fechar busca' : '+ Adicionar'}
                  </button>
                ) : null}
              </div>

              {showAdd && editable ? (
                <div className="mb-3 space-y-2 rounded-[8px] border border-[var(--border)] p-3">
                  <input
                    type="search"
                    value={addQ}
                    onChange={(e) => setAddQ(e.target.value)}
                    placeholder="Buscar cliente ou OS…"
                    className="w-full ops-input text-sm"
                  />
                  <p className="text-xs text-[var(--muted)]">
                    Só visitas livres (já agendadas). Cliente novo:{' '}
                    <Link href="/routes" className="underline">
                      Planejador
                    </Link>{' '}
                    ou{' '}
                    <Link href="/services" className="underline">
                      Serviços
                    </Link>
                    .
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto">
                    {filteredAdd.length === 0 ? (
                      <li className="text-xs text-[var(--muted)]">Nenhuma visita livre.</li>
                    ) : (
                      filteredAdd.slice(0, 40).map((v) => (
                        <li key={v.id}>
                          <button
                            type="button"
                            className="w-full rounded-[6px] px-2 py-1.5 text-left text-sm hover:bg-surface"
                            onClick={() => addVisit(v)}
                          >
                            <span className="font-medium text-brand-900">
                              {v.customer.tradeName || v.customer.name}
                            </span>
                            <span className="block text-xs text-[var(--muted)]">
                              OS {v.serviceOrder.number} · {v.serviceOrder.title}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ) : null}

              <ul className="space-y-2">
                {stops.length === 0 ? (
                  <li className="text-sm text-[var(--muted)]">Nenhuma parada.</li>
                ) : (
                  stops.map((s, index) => (
                    <li
                      key={s.visitId}
                      className="flex items-start justify-between gap-2 rounded-[8px] border border-[var(--border)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-brand-900">
                          {index + 1}. {s.customerName}
                        </p>
                        <p className="text-xs text-[var(--muted)]">{s.serviceOrderLabel}</p>
                      </div>
                      {editable ? (
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            className="ops-btn ops-btn-secondary px-2 text-xs"
                            disabled={index === 0 || saving}
                            onClick={() => moveStop(index, -1)}
                            aria-label="Subir"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="ops-btn ops-btn-secondary px-2 text-xs"
                            disabled={index === stops.length - 1 || saving}
                            onClick={() => moveStop(index, 1)}
                            aria-label="Descer"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="ops-btn ops-btn-secondary px-2 text-xs"
                            disabled={saving}
                            onClick={() => removeStop(s.visitId)}
                          >
                            Remover
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </div>

            <p className="text-sm text-[var(--muted)]">
              {previewLoading
                ? 'Recalculando rota…'
                : preview
                  ? `Preview: ${formatMeters(preview.totals.distanceMeters)} · ${formatDuration(preview.totals.durationSeconds)}`
                  : stops.length
                    ? 'Sem preview'
                    : '—'}
            </p>
          </>
        )}
      </div>

      {editable && !loading ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            className="ops-btn ops-btn-secondary text-sm text-red-300"
            disabled={cancelling || saving}
            onClick={() => void cancelRoute()}
          >
            {cancelling ? 'Cancelando…' : 'Cancelar rota'}
          </button>
          <button
            type="button"
            className="ops-btn ops-btn-primary text-sm"
            disabled={saving || cancelling || !preview || stops.length === 0}
            onClick={() => void saveChanges()}
          >
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
