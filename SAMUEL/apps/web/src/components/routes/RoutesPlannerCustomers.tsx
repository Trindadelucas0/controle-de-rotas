'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import MapLibreMap, { Layer, Marker, NavigationControl, Source } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useSessionUser } from '@/lib/session-context';
import { osmRasterStyle } from '@/lib/map-style';
import { toDateInputValue } from '@/lib/ops-labels';
import {
  type CompanyOrigin,
  type RouteOriginMode,
  formatDuration,
  formatMeters,
  formatGpsAge,
  isEmployeeGpsStart,
  routeColorAt,
} from './routes-planner-shared';
import {
  companyDisplayName,
  CompanyOriginMarker,
  EmployeeStartMarker,
  RouteEmployeeStartRow,
  RouteMapLegend,
  RouteOriginReturnRow,
  RouteOriginStartRow,
} from './route-origin-ui';

type CustomerOption = {
  id: string;
  name: string;
  tradeName: string | null;
  city: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
};

type EmployeeOption = {
  id: string;
  name: string;
  status?: string;
  userId?: string | null;
  user?: { email: string } | null;
};

type CustomerStop = {
  sequence: number;
  customerId: string;
  name: string;
  city: string | null;
  street: string | null;
  number: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  durationSeconds: number;
};

type DayLoad = {
  existingRouteCount: number;
  existingDistanceMeters: number;
  existingDurationSeconds: number;
  dayDistanceMeters: number;
  dayDurationSeconds: number;
  dayDistanceKm: number;
};

type AssignmentStartOrigin = {
  source: 'live' | 'tracking_history' | 'company' | 'company_fallback';
  name: string;
  latitude: number;
  longitude: number;
  recordedAt: string | null;
};

type CustomerAssignment = {
  employeeId: string;
  employeeName: string;
  vehicleId: string | null;
  stops: CustomerStop[];
  totals: {
    distanceMeters: number;
    durationSeconds: number;
    distanceKm: number;
  };
  dayLoad: DayLoad;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  quality: 'road' | 'straight_line';
  startOrigin: AssignmentStartOrigin;
};

type CustomersPreview = {
  origin: {
    name: string;
    latitude: number;
    longitude: number;
    address: string | null;
  };
  originMode?: RouteOriginMode;
  date: string;
  roundtrip: boolean;
  assignments: CustomerAssignment[];
};

type Props = {
  company: CompanyOrigin;
  preselectCustomerId?: string | null;
};

export function RoutesPlannerCustomers({ company, preselectCustomerId }: Props) {
  const user = useSessionUser();
  const canPreview =
    user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPERVISOR';
  const canPublish = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const mapRef = useRef<MapRef>(null);
  const previewAbort = useRef<AbortController | null>(null);
  const preselectApplied = useRef(false);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [roundtrip, setRoundtrip] = useState(true);
  const [recordTrip, setRecordTrip] = useState(false);
  const [originMode, setOriginMode] = useState<RouteOriginMode>('EMPLOYEE_LAST');
  const [routeDate, setRouteDate] = useState(toDateInputValue());
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<CustomersPreview | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const hasOrigin = company.latitude != null && company.longitude != null;

  const loadCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const r = await apiFetch<{ customers: CustomerOption[] }>('/api/v1/customers?status=ACTIVE');
      const list = r.customers.filter(
        (c) =>
          c.status === 'ACTIVE' &&
          c.latitude != null &&
          c.longitude != null &&
          Number.isFinite(c.latitude) &&
          Number.isFinite(c.longitude),
      );
      setCustomers(list);
      if (
        preselectCustomerId &&
        !preselectApplied.current &&
        list.some((c) => c.id === preselectCustomerId)
      ) {
        preselectApplied.current = true;
        setSelectedCustomerIds([preselectCustomerId]);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar clientes');
    } finally {
      setLoadingCustomers(false);
    }
  }, [preselectCustomerId]);

  const loadEmployees = useCallback(async () => {
    if (!canPreview) {
      setLoadingEmployees(false);
      return;
    }
    setLoadingEmployees(true);
    try {
      const r = await apiFetch<{ employees: EmployeeOption[] }>('/api/v1/employees?status=ACTIVE');
      setEmployees(
        r.employees.filter(
          (e) => (!e.status || e.status === 'ACTIVE') && Boolean(e.userId),
        ),
      );
    } catch {
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  }, [canPreview]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (
      !hasOrigin ||
      selectedCustomerIds.length === 0 ||
      selectedEmployeeIds.length === 0
    ) {
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
      try {
        const r = await apiFetch<CustomersPreview>('/api/v1/routes/preview-customers', {
          method: 'POST',
          body: JSON.stringify({
            customerIds: selectedCustomerIds,
            employeeIds: selectedEmployeeIds,
            roundtrip,
            recordTrip,
            originMode,
            date: routeDate,
          }),
          signal: controller.signal,
        });
        setPreview(r);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setPreview(null);
        setError(e instanceof ApiError ? e.message : 'Falha ao calcular rotas');
      } finally {
        setLoadingPreview(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      previewAbort.current?.abort();
    };
  }, [selectedCustomerIds, selectedEmployeeIds, roundtrip, recordTrip, originMode, routeDate, hasOrigin]);

  const customersById = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers],
  );

  const selectedCustomerSet = useMemo(
    () => new Set(selectedCustomerIds),
    [selectedCustomerIds],
  );

  const filteredAvailable = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return customers.filter((c) => {
      if (selectedCustomerSet.has(c.id)) return false;
      if (!needle) return true;
      const hay = [c.name, c.tradeName, c.city].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [customers, selectedCustomerSet, q]);

  const pinByCustomerId = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number; seq: number; color: string; label: string }>();
    if (preview?.assignments.length) {
      preview.assignments.forEach((a, ai) => {
        const color = routeColorAt(ai);
        a.stops.forEach((s) => {
          map.set(s.customerId, {
            lat: s.latitude,
            lng: s.longitude,
            seq: s.sequence,
            color,
            label: s.name,
          });
        });
      });
      return map;
    }
    selectedCustomerIds.forEach((id, i) => {
      const c = customersById.get(id);
      if (!c || c.latitude == null || c.longitude == null) return;
      map.set(id, {
        lat: c.latitude,
        lng: c.longitude,
        seq: i + 1,
        color: '#64748b',
        label: c.tradeName || c.name,
      });
    });
    return map;
  }, [preview, selectedCustomerIds, customersById]);

  const linesGeoJson = useMemo(() => {
    if (!preview?.assignments.length) return null;
    return {
      type: 'FeatureCollection' as const,
      features: preview.assignments
        .filter((a) => a.geometry.coordinates.length > 1)
        .map((a, i) => ({
          type: 'Feature' as const,
          properties: {
            employeeId: a.employeeId,
            color: routeColorAt(i),
            quality: a.quality,
          },
          geometry: a.geometry,
        })),
    };
  }, [preview]);

  const grandTotals = useMemo(() => {
    if (!preview?.assignments.length) return null;
    const distanceMeters = preview.assignments.reduce(
      (sum, a) => sum + a.totals.distanceMeters,
      0,
    );
    const durationSeconds = preview.assignments.reduce(
      (sum, a) => sum + a.totals.durationSeconds,
      0,
    );
    const existingDurationSeconds = preview.assignments.reduce(
      (sum, a) => sum + (a.dayLoad?.existingDurationSeconds ?? 0),
      0,
    );
    const existingRouteCount = preview.assignments.reduce(
      (sum, a) => sum + (a.dayLoad?.existingRouteCount ?? 0),
      0,
    );
    const dayDurationSeconds = preview.assignments.reduce(
      (sum, a) => sum + (a.dayLoad?.dayDurationSeconds ?? a.totals.durationSeconds),
      0,
    );
    const dayDistanceMeters = preview.assignments.reduce(
      (sum, a) => sum + (a.dayLoad?.dayDistanceMeters ?? a.totals.distanceMeters),
      0,
    );
    return {
      distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
      durationSeconds,
      existingDurationSeconds,
      existingRouteCount,
      dayDurationSeconds,
      dayDistanceKm: Math.round((dayDistanceMeters / 1000) * 10) / 10,
      routes: preview.assignments.length,
      stops: preview.assignments.reduce((sum, a) => sum + a.stops.length, 0),
    };
  }, [preview]);

  useEffect(() => {
    if (!mapRef.current) return;
    const coords: [number, number][] = [];
    if (hasOrigin) {
      coords.push([company.longitude!, company.latitude!]);
    }
    if (preview?.assignments.length) {
      for (const a of preview.assignments) {
        coords.push([a.startOrigin.longitude, a.startOrigin.latitude]);
        for (const c of a.geometry.coordinates) coords.push(c);
        for (const s of a.stops) coords.push([s.longitude, s.latitude]);
      }
    } else {
      for (const pin of pinByCustomerId.values()) {
        coords.push([pin.lng, pin.lat]);
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
  }, [preview, pinByCustomerId, hasOrigin, company]);

  function addCustomer(id: string) {
    setSelectedCustomerIds((prev) => {
      if (recordTrip) return [id];
      return prev.includes(id) ? prev : [...prev, id];
    });
    setMsg(null);
  }

  function removeCustomer(id: string) {
    setSelectedCustomerIds((prev) => prev.filter((x) => x !== id));
    setMsg(null);
  }

  function toggleEmployee(id: string) {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setMsg(null);
  }

  async function publishRoutes() {
    if (!preview || !canPublish) return;
    if (selectedCustomerIds.length === 0 || selectedEmployeeIds.length === 0) {
      setError('Selecione clientes e funcionários com login.');
      return;
    }
    setPublishing(true);
    setError(null);
    setMsg(null);
    try {
      const r = await apiFetch<{ routes: { id: string }[] }>('/api/v1/routes/dispatch-customers', {
        method: 'POST',
        body: JSON.stringify({
          customerIds: selectedCustomerIds,
          employeeIds: selectedEmployeeIds,
          roundtrip,
          recordTrip,
          originMode,
          date: routeDate,
        }),
      });
      setMsg(
        `${r.routes.length} rota(s) publicada(s). Os funcionários verão em Minha rota.`,
      );
      setSelectedCustomerIds([]);
      setRecordTrip(false);
      setPreview(null);
      await loadCustomers();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao publicar rotas');
    } finally {
      setPublishing(false);
    }
  }

  const initialView = useMemo(() => {
    if (hasOrigin) {
      return { latitude: company.latitude!, longitude: company.longitude!, zoom: 12 };
    }
    const first = customers[0];
    if (first?.latitude != null && first.longitude != null) {
      return { latitude: first.latitude, longitude: first.longitude, zoom: 11 };
    }
    return { latitude: -14.235, longitude: -51.9253, zoom: 4 };
  }, [hasOrigin, company, customers]);

  const canRequestPreview =
    selectedCustomerIds.length > 0 && selectedEmployeeIds.length > 0;
  const anyStraight = preview?.assignments.some((a) => a.quality === 'straight_line');
  const employeeGpsStarts = (preview?.assignments ?? []).filter((a) =>
    isEmployeeGpsStart(a.startOrigin?.source ?? 'company'),
  );
  const allGpsFallback =
    originMode === 'EMPLOYEE_LAST' &&
    Boolean(preview?.assignments.length) &&
    employeeGpsStarts.length === 0;
  const showCompanyMarker =
    hasOrigin &&
    (originMode === 'COMPANY' ||
      roundtrip ||
      !preview ||
      (preview.assignments ?? []).some(
        (a) =>
          a.startOrigin?.source === 'company' ||
          a.startOrigin?.source === 'company_fallback',
      ));
  const startSequenceLabel =
    originMode === 'EMPLOYEE_LAST' ? 'F' : 'E';

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[480px] flex-col gap-3 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-3 overflow-auto rounded-2xl border border-brand-100 bg-surface p-4 lg:w-[26rem]">
        <div>
          <p className="ops-label mb-0">
            Planejador
          </p>
          <h2 className="text-lg font-semibold text-brand-900">Por clientes</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Pin da empresa (marcador <strong className="text-accent">E</strong>):{' '}
            <strong className="text-brand-800">{companyDisplayName(company)}</strong>
            {company.address ? ` · ${company.address}` : ''}. Km e tempo saem da origem
            escolhida abaixo.
          </p>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-900">Data da rota</span>
          <input
            type="date"
            value={routeDate}
            onChange={(e) => setRouteDate(e.target.value)}
            className="w-full ops-input text-sm"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-brand-900">
          <input
            type="checkbox"
            checked={roundtrip}
            onChange={(e) => setRoundtrip(e.target.checked)}
            className="rounded border-brand-300"
          />
          Voltar para a empresa no fim
        </label>

        <label className="flex items-start gap-2 text-sm text-brand-900">
          <input
            type="checkbox"
            checked={recordTrip}
            onChange={(e) => {
              const on = e.target.checked;
              setRecordTrip(on);
              if (on && selectedCustomerIds.length > 1) {
                setSelectedCustomerIds((prev) => prev.slice(0, 1));
                setPreview(null);
                setMsg('Gravar viagem: mantido só o 1º cliente selecionado.');
              }
            }}
            className="mt-0.5 rounded border-brand-300"
          />
          <span>
            <span className="font-medium">Gravar viagem</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Registra a trilha real até o cliente (fazenda). Exige exatamente 1 cliente.
            </span>
          </span>
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-brand-900">Origem do cálculo</legend>
          <p className="text-xs text-[var(--muted)]">
            Define ordem das paradas, km e estimativa até o primeiro cliente. Voltar no fim
            continua no pin da empresa.
          </p>
          <div
            role="radiogroup"
            aria-label="Origem do cálculo"
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            {(
              [
                {
                  id: 'EMPLOYEE_LAST' as const,
                  label: 'Última localização',
                  hint: 'GPS do funcionário',
                },
                {
                  id: 'COMPANY' as const,
                  label: 'Empresa (pin E)',
                  hint: 'Sai do escritório',
                },
              ] as const
            ).map((opt) => {
              const selected = originMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setOriginMode(opt.id)}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm ${
                    selected
                      ? 'border-accent bg-accent/10 font-semibold text-brand-900'
                      : 'border-brand-100 font-medium text-brand-800 hover:bg-brand-50'
                  }`}
                >
                  {opt.label}
                  <span className="mt-0.5 block text-[11px] font-normal text-[var(--muted)]">
                    {opt.hint}
                  </span>
                </button>
              );
            })}
          </div>
          {preview?.assignments.length ? (
            <ul className="space-y-1 text-[11px] text-[var(--muted)]">
              {preview.assignments.map((a) => {
                const src = a.startOrigin?.source ?? 'company';
                const age = formatGpsAge(a.startOrigin?.recordedAt ?? null);
                let detail = 'pin da empresa';
                if (src === 'live') detail = `GPS ao vivo${age.label ? ` · ${age.label}` : ''}`;
                else if (src === 'tracking_history') {
                  detail = `última loc. ${age.label || ''}`.trim();
                  if (age.stale) detail += ' · desatualizada';
                } else if (src === 'company_fallback') {
                  detail = 'sem GPS — usando empresa';
                }
                return (
                  <li key={`origin-${a.employeeId}`}>
                    {a.employeeName} · {detail}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </fieldset>

        <div>
          <h3 className="text-sm font-semibold text-brand-900">Funcionários com login</h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Só entram quem tem acesso ao Rotas. Veículos AVAILABLE são atribuídos ao publicar.
          </p>
          {loadingEmployees ? (
            <p className="mt-2 text-xs text-[var(--muted)]">Carregando…</p>
          ) : employees.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Nenhum funcionário ACTIVE com login.{' '}
              <Link href="/employees" className="underline">
                Cadastre o acesso
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-2 max-h-36 space-y-1 overflow-auto">
              {employees.map((e) => {
                const checked = selectedEmployeeIds.includes(e.id);
                return (
                  <li key={e.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-brand-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEmployee(e.id)}
                        className="mt-0.5 rounded border-brand-300"
                      />
                      <span>
                        <span className="font-medium text-brand-900">{e.name}</span>
                        {e.user?.email ? (
                          <span className="block text-xs text-[var(--muted)]">{e.user.email}</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-900">Buscar cliente</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome ou cidade…"
            className="w-full ops-input text-sm"
            aria-label="Buscar cliente"
          />
        </label>

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {msg ? <p className="text-sm text-[var(--ok)]">{msg}</p> : null}

        {allGpsFallback ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Nenhum funcionário tem localização gravada. O cálculo usa o pin da empresa até
            haver GPS (Play na rota).
          </p>
        ) : null}

        {anyStraight ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Alguma rota está em linha reta (serviço de ruas indisponível). A ordem ainda é otimizada.
          </p>
        ) : null}

        {loadingPreview && canRequestPreview ? (
          <p className="text-xs text-[var(--muted)]">Dividindo e otimizando rotas…</p>
        ) : null}

        {grandTotals ? (
          <div className="space-y-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-3 text-sm">
            <p className="ops-label mb-0">Resumo</p>
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-[var(--muted)]">Funcionários</dt>
                <dd className="text-lg font-bold text-brand-900">
                  {selectedEmployeeIds.length}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Paradas</dt>
                <dd className="text-lg font-bold text-brand-900">
                  {grandTotals.stops}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Km</dt>
                <dd className="text-lg font-bold text-brand-900">
                  {grandTotals.distanceKm}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Estimativa</dt>
                <dd className="text-lg font-bold text-brand-900">
                  {formatDuration(grandTotals.durationSeconds)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Rotas</dt>
                <dd className="text-lg font-bold text-brand-900">
                  {grandTotals.routes}
                </dd>
              </div>
            </dl>
            {grandTotals.existingRouteCount > 0 ? (
              <p className="text-xs text-brand-800">
                Já no dia: {grandTotals.existingRouteCount} rota(s) ·{' '}
                {formatDuration(grandTotals.existingDurationSeconds)}
                <br />
                Com esta publicação ≈ {formatDuration(grandTotals.dayDurationSeconds)} ·{' '}
                {grandTotals.dayDistanceKm} km
              </p>
            ) : null}
            <p className="text-[11px] leading-snug text-[var(--muted)]">
              Estimativa por ruas (OpenStreetMap/OSRM), sem trânsito ao vivo e sem tempo de
              atendimento no cliente. Azul = estrada; âmbar = linha reta.
            </p>
          </div>
        ) : !canRequestPreview ? (
          <p className="text-sm text-[var(--muted)]">
            Selecione clientes e pelo menos um funcionário para pré-visualizar.
          </p>
        ) : null}

        <div>
          <h3 className="ops-label mb-0">
            Rotas · {startSequenceLabel} → 1 → 2 → … {roundtrip ? '→ E' : ''}
          </h3>
          {preview?.assignments.length ? (
            <div className="mt-2 space-y-3">
              {preview.assignments.map((a, ai) => {
                const color = routeColorAt(ai);
                const day = a.dayLoad;
                return (
                  <div
                    key={a.employeeId}
                    className="rounded-xl border border-brand-100 px-3 py-3"
                    style={{ borderLeftWidth: 4, borderLeftColor: color }}
                  >
                    <p className="ops-label mb-0">
                      Rota {String(ai + 1).padStart(2, '0')} — {a.employeeName}
                    </p>
                    <p className="mt-1 text-sm font-medium text-brand-800">
                      {a.stops.length} paradas · {a.totals.distanceKm} km ·{' '}
                      {formatDuration(a.totals.durationSeconds)}
                    </p>
                    {day && day.existingRouteCount > 0 ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Já no dia: {day.existingRouteCount} rota(s) ·{' '}
                        {formatDuration(day.existingDurationSeconds)}
                        {' → '}
                        com esta: ≈ {formatDuration(day.dayDurationSeconds)} · {day.dayDistanceKm}{' '}
                        km
                      </p>
                    ) : null}
                    <div className="mt-3 space-y-1.5">
                      {isEmployeeGpsStart(a.startOrigin?.source ?? 'company') ? (
                        <RouteEmployeeStartRow
                          employeeName={a.employeeName}
                          source={a.startOrigin.source}
                          recordedAt={a.startOrigin.recordedAt}
                        />
                      ) : (
                        <RouteOriginStartRow
                          company={company}
                          fallbackNote={
                            a.startOrigin?.source === 'company_fallback'
                              ? 'Sem última localização — cálculo pelo pin da empresa.'
                              : undefined
                          }
                        />
                      )}
                      <ol className="space-y-1.5">
                        {a.stops.map((s) => (
                          <li
                            key={`${a.employeeId}-${s.customerId}`}
                            className="flex items-start justify-between gap-2 text-sm"
                          >
                            <div>
                              <p className="font-medium text-brand-900">
                                <span
                                  className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
                                  style={{ backgroundColor: color }}
                                >
                                  {s.sequence}
                                </span>
                                {s.name}
                              </p>
                              <p className="mt-0.5 text-xs text-[var(--muted)]">
                                {[s.city, s.street].filter(Boolean).join(' · ') || '—'}
                                {s.distanceMeters > 0
                                  ? ` · ${formatMeters(s.distanceMeters)} · ${formatDuration(s.durationSeconds)}`
                                  : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCustomer(s.customerId)}
                              className="shrink-0 text-xs font-medium text-[var(--danger)] hover:underline"
                            >
                              Remover
                            </button>
                          </li>
                        ))}
                      </ol>
                      {roundtrip ? <RouteOriginReturnRow /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : selectedCustomerIds.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              A ordem exibida será a do servidor ({startSequenceLabel} → mais perto → mais longe),
              não a do clique.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {selectedCustomerIds.map((id) => {
                const c = customersById.get(id);
                const label = c?.tradeName || c?.name || id;
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-2 ops-input text-sm"
                  >
                    <span className="font-medium text-brand-900">{label}</span>
                    <button
                      type="button"
                      onClick={() => removeCustomer(id)}
                      className="shrink-0 text-xs font-medium text-[var(--danger)] hover:underline"
                    >
                      Remover
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {canPublish ? (
          <button
            type="button"
            disabled={!preview || publishing || loadingPreview}
            onClick={() => void publishRoutes()}
            className="rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {publishing ? 'Publicando…' : 'Publicar rotas'}
          </button>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            Preview disponível. Publicar exige perfil ADMIN ou MANAGER.
          </p>
        )}

        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-brand-900">Clientes com pin</h3>
            <button
              type="button"
              onClick={() => void loadCustomers()}
              className="ops-link text-xs"
            >
              Atualizar
            </button>
          </div>
          {loadingCustomers ? (
            <p className="mt-2 text-xs text-[var(--muted)]">Carregando…</p>
          ) : filteredAvailable.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Nenhum cliente ACTIVE com pin disponível.{' '}
              <Link href="/customers" className="underline">
                Cadastre o endereço
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-2 max-h-56 space-y-1 overflow-auto">
              {filteredAvailable.slice(0, 80).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => addCustomer(c.id)}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-brand-50"
                  >
                    <span className="font-medium text-brand-900">
                      {c.tradeName || c.name}
                    </span>
                    {c.city ? (
                      <span className="block text-xs text-[var(--muted)]">{c.city}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-2xl border border-brand-100 bg-brand-50">
        <RouteMapLegend showEmployeeStart={originMode === 'EMPLOYEE_LAST'} />
        <MapLibreMap
          ref={mapRef}
          initialViewState={initialView}
          mapStyle={osmRasterStyle}
          style={{ width: '100%', height: '100%' }}
          attributionControl
        >
          <NavigationControl position="bottom-right" />
          {linesGeoJson
            ? linesGeoJson.features.map((feature) => (
                <Source
                  key={feature.properties.employeeId}
                  id={`route-line-${feature.properties.employeeId}`}
                  type="geojson"
                  data={feature}
                >
                  <Layer
                    id={`route-line-layer-${feature.properties.employeeId}`}
                    type="line"
                    paint={{
                      'line-color':
                        feature.properties.quality === 'road'
                          ? feature.properties.color
                          : '#d97706',
                      'line-width': 4,
                      'line-opacity': 0.85,
                    }}
                  />
                </Source>
              ))
            : null}
          {showCompanyMarker ? (
            <CompanyOriginMarker
              latitude={company.latitude!}
              longitude={company.longitude!}
              companyName={companyDisplayName(company)}
            />
          ) : null}
          {employeeGpsStarts.map((a) => (
            <EmployeeStartMarker
              key={`start-${a.employeeId}`}
              latitude={a.startOrigin.latitude}
              longitude={a.startOrigin.longitude}
              employeeName={a.employeeName}
            />
          ))}
          {[...pinByCustomerId.entries()].map(([id, pin]) => (
            <Marker key={id} latitude={pin.lat} longitude={pin.lng} anchor="bottom">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow"
                style={{ backgroundColor: pin.color }}
                aria-label={`${pin.seq}. ${pin.label}`}
              >
                {pin.seq}
              </div>
            </Marker>
          ))}
        </MapLibreMap>
      </div>
    </div>
  );
}
