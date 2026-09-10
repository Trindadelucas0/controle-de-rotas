'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import MapLibreMap, { Layer, Marker, NavigationControl, Source } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useSessionUser } from '@/lib/session-context';
import { osmRasterStyle } from '@/lib/map-style';
import { VISIT_STATUS_LABELS, addDaysYmd, labelOf, toDateInputValue } from '@/lib/ops-labels';
import {
  type CompanyOrigin,
  formatDuration,
  formatMeters,
} from './routes-planner-shared';
import {
  companyDisplayName,
  CompanyOriginMarker,
  RouteMapLegend,
  RouteOriginReturnRow,
  RouteOriginStartRow,
} from './route-origin-ui';
import { ActionButton } from '@/components/ui/ActionButton';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
type PlanVisit = {
  id: string;
  scheduledStart: string;
  status: string;
  latitude: number;
  longitude: number;
  street: string | null;
  number: string | null;
  city: string | null;
  customer: { id: string; name: string; tradeName: string | null };
  employee: { id: string; name: string } | null;
  serviceOrder: { id: string; number: number; title: string; status: string };
  routeStop: { id: string; routeId: string; sequence: number } | null;
};

type RouteStop = {
  sequence: number;
  visitId: string;
  customerId: string;
  name: string;
  city: string | null;
  street: string | null;
  number: string | null;
  serviceOrderNumber: number;
  serviceOrderTitle: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  durationSeconds: number;
};

type RoutePreview = {
  origin: {
    name: string;
    latitude: number;
    longitude: number;
    address: string | null;
  };
  stops: RouteStop[];
  totals: {
    distanceMeters: number;
    durationSeconds: number;
    distanceKm: number;
  };
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  quality: 'road' | 'straight_line';
  roundtrip: boolean;
};

type EmployeeOption = { id: string; name: string; status?: string };
type VehicleOption = { id: string; plate: string; status?: string };

const PLAN_STATUSES = new Set(['SCHEDULED', 'RESCHEDULED', 'ASSIGNED']);

type Props = {
  company: CompanyOrigin;
};

export function RoutesPlannerVisits({ company }: Props) {
  const user = useSessionUser();
  const canSave =
    user?.role === 'ADMIN' || user?.role === 'PLATFORM_ADMIN' || user?.role === 'MANAGER';
  const mapRef = useRef<MapRef>(null);
  const [visits, setVisits] = useState<PlanVisit[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [roundtrip, setRoundtrip] = useState(true);
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<RoutePreview | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [routeDate, setRouteDate] = useState(toDateInputValue());
  const [loadingVisits, setLoadingVisits] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savedRouteId, setSavedRouteId] = useState<string | null>(null);
  const previewAbort = useRef<AbortController | null>(null);

  const hasOrigin = company.latitude != null && company.longitude != null;

  useEffect(() => {
    if (!canSave) return;
    Promise.all([
      apiFetch<{ employees: EmployeeOption[] }>('/api/v1/employees'),
      apiFetch<{ vehicles: VehicleOption[] }>('/api/v1/vehicles'),
    ])
      .then(([e, v]) => {
        setEmployees(e.employees.filter((x) => !x.status || x.status === 'ACTIVE'));
        setVehicles(v.vehicles.filter((x) => !x.status || x.status === 'AVAILABLE' || x.status === 'IN_USE'));
      })
      .catch(() => {
        /* SUPERVISOR não lista; ignore */
      });
  }, [canSave]);

  const loadVisits = useCallback(async () => {
    setLoadingVisits(true);
    try {
      const today = toDateInputValue();
      const from = new Date(`${addDaysYmd(today, -7)}T00:00:00`);
      const to = new Date(`${addDaysYmd(today, 30)}T23:59:59.999`);
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const r = await apiFetch<{ visits: PlanVisit[] }>(`/api/v1/visits?${params}`);
      setVisits(
        r.visits.filter(
          (v) =>
            PLAN_STATUSES.has(v.status) &&
            !v.routeStop &&
            Number.isFinite(v.latitude) &&
            Number.isFinite(v.longitude),
        ),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar visitas');
    } finally {
      setLoadingVisits(false);
    }
  }, []);

  useEffect(() => {
    void loadVisits();
  }, [loadVisits]);

  useEffect(() => {
    if (!hasOrigin || selectedIds.length === 0) {
      setPreview(null);
      setLoadingPreview(false);
      return;
    }

    const timer = setTimeout(async () => {
      previewAbort.current?.abort();
      const controller = new AbortController();
      previewAbort.current = controller;
      setLoadingPreview(true);
      setError(null);
      setSavedRouteId(null);
      try {
        const r = await apiFetch<RoutePreview>('/api/v1/routes/preview', {
          method: 'POST',
          body: JSON.stringify({ visitIds: selectedIds, roundtrip }),
          signal: controller.signal,
        });
        setPreview(r);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setPreview(null);
        setError(e instanceof ApiError ? e.message : 'Falha ao calcular rota');
      } finally {
        setLoadingPreview(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      previewAbort.current?.abort();
    };
  }, [selectedIds, roundtrip, hasOrigin]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredAvailable = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return visits.filter((v) => {
      if (selectedSet.has(v.id)) return false;
      if (!needle) return true;
      const hay = [
        v.customer.name,
        v.customer.tradeName,
        v.serviceOrder.title,
        String(v.serviceOrder.number),
        v.city,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [visits, selectedSet, q]);

  const visitsById = useMemo(() => new Map(visits.map((v) => [v.id, v])), [visits]);

  const sequenceById = useMemo(() => {
    const map = new Map<string, number>();
    preview?.stops.forEach((s) => map.set(s.visitId, s.sequence));
    selectedIds.forEach((id, i) => {
      if (!map.has(id)) map.set(id, i + 1);
    });
    return map;
  }, [preview, selectedIds]);

  useEffect(() => {
    if (!mapRef.current) return;
    const coords: [number, number][] = [];
    if (hasOrigin) {
      coords.push([company.longitude!, company.latitude!]);
    }
    if (preview?.geometry.coordinates.length) {
      for (const c of preview.geometry.coordinates) coords.push(c);
    } else {
      for (const id of selectedIds) {
        const v = visitsById.get(id);
        if (v) coords.push([v.longitude, v.latitude]);
      }
    }
    if (coords.length < 1) return;
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    mapRef.current.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 56, duration: 700, maxZoom: 14 },
    );
  }, [preview, selectedIds, visitsById, hasOrigin, company]);

  function addVisit(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setMsg(null);
    setSavedRouteId(null);
  }

  function removeVisit(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setMsg(null);
    setSavedRouteId(null);
  }

  async function saveRoute(thenPublish: boolean) {
    if (!preview || !canSave || saving || publishing) return;
    if (!employeeId || !vehicleId) {
      setError('Selecione funcionário e veículo para salvar a rota.');
      return;
    }
    if (thenPublish) setPublishing(true);
    else setSaving(true);
    setError(null);
    setMsg(null);
    try {
      let routeId = savedRouteId;
      if (!routeId) {
        const body = {
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
          plannedDistanceMeters: preview.totals.distanceMeters,
          plannedDurationSeconds: preview.totals.durationSeconds,
          geometry: preview.geometry,
          quality: preview.quality,
        };
        const created = await apiFetch<{ route: { id: string } }>('/api/v1/routes', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        routeId = created.route.id;
        setSavedRouteId(routeId);
      }

      if (thenPublish && routeId) {
        await apiFetch(`/api/v1/routes/${routeId}/publish`, { method: 'POST' });
        setMsg('Rota salva e publicada.');
        setSelectedIds([]);
        setPreview(null);
        setSavedRouteId(null);
        await loadVisits();
      } else {
        setMsg('Rota salva (planejada).');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao salvar/publicar rota');
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  }

  const geojson = useMemo(() => {
    if (!preview?.geometry.coordinates.length) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: preview.geometry,
    };
  }, [preview]);

  const initialView = useMemo(() => {
    if (hasOrigin) {
      return { latitude: company.latitude!, longitude: company.longitude!, zoom: 12 };
    }
    const first = visits[0];
    if (first) {
      return { latitude: first.latitude, longitude: first.longitude, zoom: 11 };
    }
    return { latitude: -14.235, longitude: -51.9253, zoom: 4 };
  }, [hasOrigin, company, visits]);

  const orderedStops: RouteStop[] =
    preview?.stops.length
      ? preview.stops
      : selectedIds.map((id, i) => {
          const v = visitsById.get(id);
          return {
            sequence: i + 1,
            visitId: id,
            customerId: v?.customer.id || '',
            name: v?.customer.tradeName || v?.customer.name || id,
            city: v?.city ?? null,
            street: v?.street ?? null,
            number: v?.number ?? null,
            serviceOrderNumber: v?.serviceOrder.number ?? 0,
            serviceOrderTitle: v?.serviceOrder.title ?? '',
            latitude: v?.latitude ?? 0,
            longitude: v?.longitude ?? 0,
            distanceMeters: 0,
            durationSeconds: 0,
          };
        });

  const busy = saving || publishing;

  return (
    <div className="relative flex h-[calc(100vh-11rem)] min-h-[480px] flex-col gap-3 lg:flex-row">
      <LoadingOverlay
        show={busy}
        label={publishing ? 'Publicando…' : 'Salvando…'}
      />
      <aside className="flex w-full shrink-0 flex-col gap-3 overflow-auto rounded-2xl border border-brand-100 bg-surface p-4 lg:w-96">
        <div>
          <h2 className="text-lg font-semibold text-brand-900">Visitas agendadas</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Origem (marcador <strong className="text-accent">E</strong> no mapa):{' '}
            <strong className="text-brand-800">{companyDisplayName(company)}</strong>
            {company.address ? ` · ${company.address}` : ''}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-brand-900">
          <input
            type="checkbox"
            checked={roundtrip}
            onChange={(e) => setRoundtrip(e.target.checked)}
            className="rounded border-brand-300"
          />
          Voltar para a empresa no fim
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-900">Buscar visita</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="OS #, cliente, título…"
            className="w-full ops-input text-sm"
            aria-label="Buscar visita"
          />
        </label>

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {msg ? <p className="text-sm text-[var(--ok)]">{msg}</p> : null}

        {preview?.quality === 'straight_line' ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Traçado aproximado em linha reta (serviço de ruas indisponível). A ordem ainda é otimizada
            por distância.
          </p>
        ) : null}

        {loadingPreview && selectedIds.length > 0 ? (
          <p className="text-xs text-[var(--muted)]">Recalculando melhor ordem…</p>
        ) : null}

        {preview ? (
          <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-sm">
            <p>
              <strong>{preview.totals.distanceKm} km</strong>
              {' · '}
              {formatDuration(preview.totals.durationSeconds)}
              {' · '}
              {preview.stops.length} parada(s)
            </p>
          </div>
        ) : selectedIds.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Adicione visitas para montar a rota.</p>
        ) : null}

        <div>
          <h3 className="text-sm font-semibold text-brand-900">Ordem das visitas</h3>
          {selectedIds.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted)]">Nenhuma visita na rota.</p>
          ) : (
            <div className="mt-2 space-y-2">
              <RouteOriginStartRow company={company} />
              <ol className="space-y-2">
                {orderedStops.map((s) => (
                  <li
                    key={s.visitId}
                    className="flex items-start justify-between gap-2 ops-input text-sm"
                  >
                    <div>
                      <p className="font-medium text-brand-900">
                        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] text-white">
                          {s.sequence}
                        </span>
                        OS #{s.serviceOrderNumber} — {s.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {s.serviceOrderTitle}
                        {s.distanceMeters > 0
                          ? ` · ${formatMeters(s.distanceMeters)} · ${formatDuration(s.durationSeconds)}`
                          : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVisit(s.visitId)}
                      className="shrink-0 text-xs font-medium text-[var(--danger)] hover:underline"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ol>
              {roundtrip ? <RouteOriginReturnRow /> : null}
            </div>
          )}
        </div>

        {canSave ? (
          <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
            <h3 className="text-sm font-semibold text-brand-900">Salvar rota</h3>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-brand-900">Data</span>
              <input
                type="date"
                value={routeDate}
                onChange={(e) => {
                  setRouteDate(e.target.value);
                  setSavedRouteId(null);
                }}
                className="w-full ops-input text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-brand-900">Funcionário</span>
              <select
                value={employeeId}
                onChange={(e) => {
                  setEmployeeId(e.target.value);
                  setSavedRouteId(null);
                }}
                className="w-full ops-input text-sm"
              >
                <option value="">Selecione…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-brand-900">Veículo</span>
              <select
                value={vehicleId}
                onChange={(e) => {
                  setVehicleId(e.target.value);
                  setSavedRouteId(null);
                }}
                className="w-full ops-input text-sm"
              >
                <option value="">Selecione…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-2">
              <ActionButton
                variant="secondary"
                disabled={!preview || busy}
                loading={saving}
                loadingLabel="Salvando…"
                onClick={() => void saveRoute(false)}
                className="w-full justify-center"
              >
                {savedRouteId ? 'Já salva' : 'Salvar rota'}
              </ActionButton>
              <ActionButton
                disabled={!preview || busy}
                loading={publishing}
                loadingLabel="Publicando…"
                onClick={() => void saveRoute(true)}
                className="w-full justify-center"
              >
                Publicar
              </ActionButton>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            Preview disponível. Salvar/publicar exige perfil ADMIN ou MANAGER.
          </p>
        )}

        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-brand-900">Visitas disponíveis</h3>
            <button
              type="button"
              onClick={() => void loadVisits()}
              className="ops-link text-xs"
            >
              Atualizar
            </button>
          </div>
          {loadingVisits ? (
            <p className="mt-2 text-xs text-[var(--muted)]">Carregando…</p>
          ) : filteredAvailable.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Nenhuma visita SCHEDULED/RESCHEDULED livre no período. Crie em{' '}
              <Link href="/services" className="underline">
                Serviços
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-2 max-h-56 space-y-1 overflow-auto">
              {filteredAvailable.slice(0, 50).map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => addVisit(v.id)}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-brand-50"
                  >
                    <span className="font-medium text-brand-900">
                      OS #{v.serviceOrder.number} — {v.customer.tradeName || v.customer.name}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {new Date(v.scheduledStart).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' · '}
                      {labelOf(VISIT_STATUS_LABELS, v.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-2xl border border-brand-100 bg-brand-50">
        <RouteMapLegend />
        <MapLibreMap
          ref={mapRef}
          initialViewState={initialView}
          mapStyle={osmRasterStyle}
          style={{ width: '100%', height: '100%' }}
          attributionControl
        >
          <NavigationControl position="bottom-right" />
          {geojson ? (
            <Source id="route-line" type="geojson" data={geojson}>
              <Layer
                id="route-line-layer"
                type="line"
                paint={{
                  'line-color': preview?.quality === 'road' ? '#2EE6C7' : '#F5A524',
                  'line-width': 4,
                  'line-opacity': 0.85,
                }}
              />
            </Source>
          ) : null}
          <CompanyOriginMarker
            latitude={company.latitude!}
            longitude={company.longitude!}
            companyName={companyDisplayName(company)}
          />
          {selectedIds.map((id) => {
            const v = visitsById.get(id);
            if (!v) return null;
            const seq = sequenceById.get(id) ?? '?';
            return (
              <Marker key={id} latitude={v.latitude} longitude={v.longitude} anchor="bottom">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-[11px] font-bold text-white shadow"
                  aria-label={`${seq}. OS #${v.serviceOrder.number}`}
                >
                  {seq}
                </div>
              </Marker>
            );
          })}
        </MapLibreMap>
      </div>
    </div>
  );
}
