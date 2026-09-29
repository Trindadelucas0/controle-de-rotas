'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useSessionUser } from '@/lib/session-context';
import { toDateInputValue } from '@/lib/ops-labels';
import { ActionButton } from '@/components/ui/ActionButton';
import { MobileActionBar } from '@/components/ui/MobileActionBar';
import {
  type CompanyOrigin,
  type RouteOriginMode,
  ROUTE_STATUS_LABELS,
  formatDuration,
  routeColorAt,
} from './routes-planner-shared';

type RegionCustomerActiveRoute = {
  employeeName: string | null;
  status: string;
  date: string;
};

type RegionCustomer = {
  id: string;
  name: string;
  tradeName: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  onActiveRoute: boolean;
  activeRoute?: RegionCustomerActiveRoute | null;
  /** Sem região no cadastro, mas o pin cai dentro do círculo. */
  inCircleOnly?: boolean;
};

type RegionCustomersResponse = {
  customers: RegionCustomer[];
  withoutPin: { id: string; name: string }[];
};

type EmployeeOption = {
  id: string;
  name: string;
  status?: string;
  userId?: string | null;
  user?: { email: string } | null;
};

type RegionPreview = {
  assignments: {
    employeeId: string;
    employeeName: string;
    stops: { sequence: number; customerId: string; name: string }[];
    totals: { distanceMeters: number; durationSeconds: number; distanceKm: number };
  }[];
};

export type RegionDispatchPin = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  selected: boolean;
};

type Props = {
  company: CompanyOrigin;
  customerRegionId: string;
  onPinsChange?: (pins: RegionDispatchPin[]) => void;
};

const ORIGIN_OPTIONS = [
  { id: 'EMPLOYEE_LAST' as const, label: 'Última localização', hint: 'GPS do funcionário' },
  { id: 'COMPANY' as const, label: 'Empresa (pin E)', hint: 'Sai do escritório' },
];

function activeRouteLabel(route: RegionCustomerActiveRoute | null | undefined) {
  if (!route) return 'já em rota ativa';
  const status = ROUTE_STATUS_LABELS[route.status] ?? route.status;
  return `já em rota ativa · ${route.employeeName ?? 'sem funcionário'} · ${status}`;
}

export function RoutesPlannerRegionDispatch({ company, customerRegionId, onPinsChange }: Props) {
  const user = useSessionUser();
  const canPublish =
    user?.role === 'ADMIN' || user?.role === 'PLATFORM_ADMIN' || user?.role === 'MANAGER';
  const previewAbort = useRef<AbortController | null>(null);

  const [customers, setCustomers] = useState<RegionCustomer[]>([]);
  const [withoutPin, setWithoutPin] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [routeDate, setRouteDate] = useState(toDateInputValue());
  const [roundtrip, setRoundtrip] = useState(true);
  const [recordTrip, setRecordTrip] = useState(false);
  const [originMode, setOriginMode] = useState<RouteOriginMode>('EMPLOYEE_LAST');
  const [preview, setPreview] = useState<RegionPreview | null>(null);
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
      const r = await apiFetch<RegionCustomersResponse>(
        `/api/v1/routes/region-customers?customerRegionId=${encodeURIComponent(customerRegionId)}`,
      );
      setCustomers(r.customers ?? []);
      setWithoutPin(r.withoutPin ?? []);
      setSelectedCustomerIds((r.customers ?? []).filter((c) => !c.onActiveRoute).map((c) => c.id));
      setError(null);
    } catch (e) {
      setCustomers([]);
      setWithoutPin([]);
      setSelectedCustomerIds([]);
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar clientes da região');
    } finally {
      setLoadingCustomers(false);
    }
  }, [customerRegionId]);

  useEffect(() => {
    setMsg(null);
    setPreview(null);
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    apiFetch<{ employees: EmployeeOption[] }>('/api/v1/employees?status=ACTIVE')
      .then((r) =>
        setEmployees(
          r.employees.filter((e) => (!e.status || e.status === 'ACTIVE') && Boolean(e.userId)),
        ),
      )
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmployees(false));
  }, []);

  useEffect(() => {
    onPinsChange?.(
      customers.map((c) => ({
        id: c.id,
        name: c.tradeName || c.name,
        latitude: c.latitude,
        longitude: c.longitude,
        selected: selectedCustomerIds.includes(c.id),
      })),
    );
  }, [customers, selectedCustomerIds, onPinsChange]);

  useEffect(() => {
    if (!hasOrigin || selectedCustomerIds.length === 0 || selectedEmployeeIds.length === 0) {
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
        const r = await apiFetch<RegionPreview>('/api/v1/routes/preview-region-customers', {
          method: 'POST',
          body: JSON.stringify({
            customerRegionId,
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
  }, [
    customerRegionId,
    selectedCustomerIds,
    selectedEmployeeIds,
    roundtrip,
    recordTrip,
    originMode,
    routeDate,
    hasOrigin,
  ]);

  const totals = useMemo(() => {
    if (!preview?.assignments.length) return null;
    const distanceMeters = preview.assignments.reduce((s, a) => s + a.totals.distanceMeters, 0);
    return {
      routes: preview.assignments.length,
      stops: preview.assignments.reduce((s, a) => s + a.stops.length, 0),
      distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
      durationSeconds: preview.assignments.reduce((s, a) => s + a.totals.durationSeconds, 0),
    };
  }, [preview]);

  function toggleCustomer(id: string) {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setMsg(null);
  }

  function toggleEmployee(id: string) {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setMsg(null);
  }

  async function publishRoutes() {
    if (!preview || !canPublish || publishing) return;
    setPublishing(true);
    setError(null);
    setMsg(null);
    try {
      const r = await apiFetch<{ routes: { id: string }[] }>(
        '/api/v1/routes/dispatch-region-customers',
        {
          method: 'POST',
          body: JSON.stringify({
            customerRegionId,
            customerIds: selectedCustomerIds,
            employeeIds: selectedEmployeeIds,
            roundtrip,
            recordTrip,
            originMode,
            date: routeDate,
          }),
        },
      );
      setPreview(null);
      setRecordTrip(false);
      await loadCustomers();
      setSelectedCustomerIds([]);
      setMsg(`${r.routes.length} rota(s) publicada(s). Os funcionários verão em Minha rota.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao publicar rotas');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className="space-y-3 border-t border-[var(--border)] pt-3" aria-label="Enviar para visitar">
      <div>
        <h3 className="text-base font-semibold text-brand-900">Enviar para visitar</h3>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Entram os clientes com esta região no cadastro e os ativos sem região dentro do
          círculo. Desmarcar tira só desta visita; o cadastro não muda.
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
          onChange={(e) => setRecordTrip(e.target.checked)}
          className="mt-0.5 rounded border-brand-300"
        />
        <span>
          <span className="font-medium">Gravar viagem</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            Densifica o GPS e grava a trilha real até cada cliente no Cheguei.
          </span>
        </span>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-brand-900">Origem do cálculo</legend>
        <div role="radiogroup" aria-label="Origem do cálculo" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ORIGIN_OPTIONS.map((opt) => {
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
      </fieldset>

      <div>
        <h4 className="text-sm font-semibold text-brand-900">Funcionários com login</h4>
        {loadingEmployees ? (
          <p className="mt-1 text-xs text-[var(--muted)]">Carregando…</p>
        ) : employees.length === 0 ? (
          <p className="mt-1 text-xs text-[var(--muted)]">Nenhum funcionário ACTIVE com login.</p>
        ) : (
          <ul className="mt-1 max-h-36 space-y-1 overflow-auto">
            {employees.map((e) => (
              <li key={e.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-brand-50">
                  <input
                    type="checkbox"
                    checked={selectedEmployeeIds.includes(e.id)}
                    onChange={() => toggleEmployee(e.id)}
                    className="mt-0.5 rounded border-brand-300"
                  />
                  <span className="font-medium text-brand-900">{e.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-brand-900">
          Clientes desta região
          {customers.length ? ` · ${selectedCustomerIds.length}/${customers.length}` : ''}
        </h4>
        {loadingCustomers ? (
          <p className="mt-1 text-xs text-[var(--muted)]">Carregando…</p>
        ) : customers.length === 0 && withoutPin.length === 0 ? (
          <p className="mt-1 text-xs text-[var(--muted)]">
            Nenhum cliente ativo nesta região nem dentro do círculo.
          </p>
        ) : (
          <ul className="mt-1 max-h-48 space-y-1 overflow-auto">
            {customers.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-brand-50">
                  <input
                    type="checkbox"
                    checked={selectedCustomerIds.includes(c.id)}
                    onChange={() => toggleCustomer(c.id)}
                    className="mt-0.5 rounded border-brand-300"
                  />
                  <span>
                    <span className="font-medium text-brand-900">{c.tradeName || c.name}</span>
                    {c.city || c.onActiveRoute || c.inCircleOnly ? (
                      <span className="block text-xs text-[var(--muted)]">
                        {[
                          c.city,
                          c.inCircleOnly ? 'no círculo' : null,
                          c.onActiveRoute ? activeRouteLabel(c.activeRoute) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {withoutPin.length ? (
          <div className="mt-2 rounded-[8px] border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--warn)]">
            <p className="font-medium">Sem pin no mapa (não entram nesta visita)</p>
            <p className="mt-0.5">{withoutPin.map((c) => c.name).join(', ')}</p>
          </div>
        ) : null}
      </div>

      {loadingPreview ? (
        <p className="text-xs text-[var(--muted)]">Dividindo e otimizando rotas…</p>
      ) : null}

      {totals && preview ? (
        <div className="space-y-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-3 text-sm">
          <p className="ops-label mb-0">Resumo</p>
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-[var(--muted)]">Rotas</dt>
              <dd className="text-lg font-bold text-brand-900">{totals.routes}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Paradas</dt>
              <dd className="text-lg font-bold text-brand-900">{totals.stops}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Km</dt>
              <dd className="text-lg font-bold text-brand-900">{totals.distanceKm}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Estimativa</dt>
              <dd className="text-lg font-bold text-brand-900">
                {formatDuration(totals.durationSeconds)}
              </dd>
            </div>
          </dl>
          <ul className="space-y-1 text-xs">
            {preview.assignments.map((a, i) => (
              <li
                key={a.employeeId}
                className="rounded-lg border border-brand-100 px-2 py-1.5"
                style={{ borderLeftWidth: 4, borderLeftColor: routeColorAt(i) }}
              >
                <span className="font-semibold text-brand-900">{a.employeeName}</span> ·{' '}
                {a.stops.length} paradas · {a.totals.distanceKm} km
                <span className="block text-[var(--muted)]">
                  {a.stops.map((s) => s.name).join(' → ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : selectedCustomerIds.length === 0 || selectedEmployeeIds.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">
          Marque clientes e pelo menos um funcionário para pré-visualizar.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-[8px] bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-[8px] bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300" role="status">
          {msg}
        </p>
      ) : null}

      {canPublish ? (
        <MobileActionBar>
          <ActionButton
            type="button"
            disabled={!preview || publishing || loadingPreview}
            loading={publishing}
            loadingLabel="Publicando…"
            onClick={() => void publishRoutes()}
            className="w-full justify-center"
          >
            Publicar rotas
          </ActionButton>
        </MobileActionBar>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          Preview disponível. Publicar exige perfil ADMIN ou MANAGER.
        </p>
      )}
    </section>
  );
}
