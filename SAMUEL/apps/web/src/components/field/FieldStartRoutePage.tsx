'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, apiUpload, ApiError } from '@/lib/api-client';
import { toDateInputValue } from '@/lib/ops-labels';
import { formatDuration, formatMeters } from '@/components/routes/routes-planner-shared';
import { haversineMeters } from '@/lib/nav-geometry';
import {
  gpsCatchMessage,
  isInsecureGeolocationContext,
  requestCurrentPosition,
  startLocalGpsWatch,
  type RouteGpsWatchHandle,
} from '@/lib/field-tracking';
import { StartRoutePreviewMap } from './StartRoutePreviewMap';
import { ActionButton } from '@/components/ui/ActionButton';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { OdometerPhotoCapture } from './OdometerPhotoCapture';
import { FUEL_LEVEL_OPTIONS, type FuelLevel } from '@/lib/field-fuel';

type RouteStop = {
  id: string;
  sequence: number;
  latitude: number;
  longitude: number;
  visit: { customer: { name: string } };
};

type RouteDetail = {
  id: string;
  status: string;
  date?: string;
  recordNewCustomer?: boolean;
  plannedDistanceMeters?: number | null;
  plannedDurationSeconds?: number | null;
  vehicle: { id: string; plate: string; brand: string | null; model: string | null } | null;
  stops: RouteStop[];
};

type VehicleOption = {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  status: string;
  odometerKm?: number | null;
  lastFuelLevel?: string | null;
  inUseByOther?: boolean;
};

type Step = 'gps' | 'summary' | 'vehicle' | 'checklist' | 'confirm';

type GpsFix = { latitude: number; longitude: number; heading?: number | null };

async function requestGps(): Promise<GpsFix> {
  const pos = await requestCurrentPosition();
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    heading:
      pos.coords.heading != null && Number.isFinite(pos.coords.heading)
        ? pos.coords.heading
        : null,
  };
}

function fallbackGpsFromRoute(route: RouteDetail): GpsFix | null {
  const first = [...route.stops].sort((a, b) => a.sequence - b.sequence)[0];
  if (!first) return null;
  return { latitude: first.latitude, longitude: first.longitude };
}

async function requestOptionalMedia() {
  try {
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((t) => t.stop());
    }
  } catch {
    // opcional — não bloqueia
  }
}

export function FieldStartRoutePage() {
  const params = useParams<{ id: string }>();
  const routeId = params.id;
  const router = useRouter();
  const localWatchRef = useRef<RouteGpsWatchHandle | null>(null);

  const [step, setStep] = useState<Step>('gps');
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [fuelLevel, setFuelLevel] = useState<FuelLevel>('HALF');
  const [notes, setNotes] = useState('');
  const [odometerPhoto, setOdometerPhoto] = useState<File | null>(null);
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [gpsFallback, setGpsFallback] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const dateYmd = toDateInputValue();
      const r = await apiFetch<{ routes: RouteDetail[] }>(
        `/api/v1/field/my-route?date=${encodeURIComponent(dateYmd)}`,
      );
      const found = r.routes.find((x) => x.id === routeId);
      const active = r.routes.find((x) => x.status === 'IN_PROGRESS');
      if (found?.status === 'IN_PROGRESS') {
        router.replace('/field/navigate');
        return;
      }
      if (active && active.id !== routeId) {
        const ymd = (active.date ?? '').slice(0, 10);
        const [y, m, d] = ymd.split('-');
        const when = y && m && d ? ` (${d}/${m}/${y})` : '';
        setError(
          `Você já tem uma rota em andamento${when}. Volte para Minha rota e toque em Concluir antes de iniciar outra.`,
        );
        setErrorCode('ROUTE_ALREADY_ACTIVE');
        return;
      }
      if (!found) {
        setError('Rota não encontrada ou não está mais disponível para você.');
        setErrorCode(null);
        return;
      }
      if (found.status !== 'PUBLISHED') {
        setError('Esta rota já foi iniciada ou não pode ser iniciada.');
        setErrorCode(null);
        return;
      }
      setRoute(found);
      const v = await apiFetch<{ vehicles: VehicleOption[] }>(
        `/api/v1/field/vehicles?routeId=${encodeURIComponent(routeId)}`,
      );
      setVehicles(v.vehicles);
      const pre = found.vehicle?.id ?? v.vehicles[0]?.id ?? '';
      setVehicleId(pre);
      const chosen = v.vehicles.find((x) => x.id === pre) ?? v.vehicles[0];
      if (chosen?.odometerKm != null) setOdometerKm(String(chosen.odometerKm));
      if (chosen?.lastFuelLevel && FUEL_LEVEL_OPTIONS.some((o) => o.value === chosen.lastFuelLevel)) {
        setFuelLevel(chosen.lastFuelLevel as FuelLevel);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar rota');
      setErrorCode(e instanceof ApiError ? e.code ?? null : null);
    } finally {
      setLoading(false);
    }
  }, [routeId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || !route || step !== 'gps' || gps) return;

    if (isInsecureGeolocationContext()) {
      const fallback = fallbackGpsFromRoute(route);
      if (!fallback) {
        setGpsError('Sem GPS neste HTTP e a rota não tem paradas.');
        return;
      }
      setGps(fallback);
      setGpsFallback(true);
      setGpsError(null);
      setStep('summary');
      return;
    }

    let cancelled = false;
    void requestGps()
      .then((fix) => {
        if (cancelled) return;
        setGps(fix);
        setGpsFallback(false);
        setGpsError(null);
        setStep('summary');
      })
      .catch((e) => {
        if (cancelled) return;
        setGpsError(gpsCatchMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [loading, route, step, gps]);

  // Watch local (sem POST) enquanto o wizard está aberto com GPS real.
  useEffect(() => {
    if (!gps || gpsFallback || step === 'gps') {
      localWatchRef.current?.stop();
      localWatchRef.current = null;
      return;
    }
    if (localWatchRef.current) return;
    localWatchRef.current = startLocalGpsWatch({
      onPosition: (pos) => {
        setGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading:
            pos.coords.heading != null && Number.isFinite(pos.coords.heading)
              ? pos.coords.heading
              : null,
        });
      },
    });
    return () => {
      localWatchRef.current?.stop();
      localWatchRef.current = null;
    };
  }, [gps, gpsFallback, step]);

  const previewStops = useMemo(() => {
    if (!route?.stops?.length) return [];
    if (!gps || gpsFallback) {
      return [...route.stops].sort((a, b) => a.sequence - b.sequence);
    }
    return [...route.stops].sort(
      (a, b) => haversineMeters(gps, a) - haversineMeters(gps, b),
    );
  }, [route?.stops, gps, gpsFallback]);

  const markerKind = step === 'summary' || !vehicleId ? 'person' : 'car';
  const showMap = Boolean(gps) && step !== 'gps';

  async function onEnableGps() {
    setGpsError(null);
    try {
      const fix = await requestGps();
      setGps(fix);
      setGpsFallback(false);
      await requestOptionalMedia();
      setStep('summary');
    } catch (e) {
      setGpsError(gpsCatchMessage(e));
    }
  }

  async function onStartRoute() {
    if (!route || !vehicleId || submitting) return;
    const km = Number(odometerKm.replace(',', '.'));
    if (!Number.isFinite(km) || km <= 0) {
      setError('Informe o km inicial do veículo.');
      setErrorCode(null);
      return;
    }
    if (!odometerPhoto) {
      setError('Tire uma foto do odômetro para iniciar.');
      setErrorCode(null);
      return;
    }
    setSubmitting(true);
    setError(null);
    setErrorCode(null);
    let fix = gps;
    if (!fix) {
      if (isInsecureGeolocationContext()) {
        fix = fallbackGpsFromRoute(route);
        if (fix) {
          setGps(fix);
          setGpsFallback(true);
        }
      } else {
        try {
          fix = await requestGps();
          setGps(fix);
          setGpsFallback(false);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'GPS obrigatório para iniciar');
          setErrorCode(null);
          setSubmitting(false);
          return;
        }
      }
    }
    if (!fix) {
      setError('GPS obrigatório para iniciar');
      setErrorCode(null);
      setSubmitting(false);
      return;
    }
    try {
      const form = new FormData();
      form.append('vehicleId', vehicleId);
      form.append('startOdometerKm', String(km));
      form.append('startFuelLevel', fuelLevel);
      if (notes.trim()) form.append('startNotes', notes.trim());
      form.append('latitude', String(fix.latitude));
      form.append('longitude', String(fix.longitude));
      form.append('file', odometerPhoto);
      await apiUpload(`/api/v1/routes/${route.id}/start`, form);
      router.push('/field/navigate');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível iniciar a rota');
      setErrorCode(e instanceof ApiError ? e.code ?? null : null);
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Preparando início da rota…</p>;
  }

  if (error && !route) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-brand-900">Iniciar rota</h1>
        <p
          className="rounded-[6px] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]"
          role="alert"
        >
          {error}
        </p>
        {errorCode === 'ROUTE_ALREADY_ACTIVE' ? (
          <Link
            href="/field/my-route"
            className="text-sm ops-link"
          >
            Ir para Minha rota e concluir
          </Link>
        ) : null}
        <Link href="/field/my-route" className="text-sm ops-link">
          ← Voltar para Minha rota
        </Link>
      </section>
    );
  }

  if (!route) return null;

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? null;

  const previewMap = showMap ? (
    <StartRoutePreviewMap
      gps={gps}
      markerKind={markerKind}
      stops={previewStops.map((s) => ({
        id: s.id,
        latitude: s.latitude,
        longitude: s.longitude,
        label: s.visit.customer.name,
      }))}
    />
  ) : null;

  return (
    <section className="relative mx-auto max-w-lg space-y-6">
      <LoadingOverlay show={submitting} label="Iniciando…" />
      <div>
        <Link href="/field/my-route" className="text-sm ops-link">
          ← Minha rota
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-brand-900">
          {route.recordNewCustomer ? 'Iniciar gravação' : 'Iniciar rota'}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {route.recordNewCustomer
            ? 'Grave o caminho e marque pontos (clientes) no GPS. Encerre quando quiser.'
            : `${route.stops.length} parada(s)`}
          {route.plannedDurationSeconds != null
            ? ` · ~${formatDuration(route.plannedDurationSeconds)}`
            : ''}
          {route.plannedDistanceMeters != null
            ? ` · ${formatMeters(route.plannedDistanceMeters)}`
            : ''}
        </p>
      </div>

      <ol className="flex gap-1 text-xs font-medium text-[var(--muted)]">
        {(['gps', 'summary', 'vehicle', 'checklist', 'confirm'] as Step[]).map((s, i) => (
          <li
            key={s}
            className={
              s === step
                ? 'rounded-full bg-brand-600 px-2 py-0.5 text-white'
                : 'rounded-full bg-brand-50 px-2 py-0.5'
            }
          >
            {i + 1}
          </li>
        ))}
      </ol>

      {error ? (
        <div
          className="rounded-[6px] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]"
          role="alert"
        >
          <p>{error}</p>
          {errorCode === 'ROUTE_ALREADY_ACTIVE' ? (
            <Link
              href="/field/my-route"
              className="mt-2 inline-block font-semibold text-[var(--danger)] underline"
            >
              Ir para Minha rota e concluir
            </Link>
          ) : null}
        </div>
      ) : null}

      {step === 'gps' ? (
        <div className="space-y-4 rounded-2xl border border-brand-100 bg-surface p-5">
          <h2 className="font-semibold text-brand-900">Permissões</h2>
          <p className="text-sm text-[var(--muted)]">
            A <strong>localização</strong> é pedida automaticamente ao abrir o app. Se o aviso do
            celular não apareceu, toque no botão abaixo e escolha <strong>Permitir</strong>.
          </p>
          {gpsError ? <p className="text-sm text-[var(--danger)]">{gpsError}</p> : null}
          <button
            type="button"
            onClick={() => void onEnableGps()}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white"
          >
            Permitir localização e continuar
          </button>
        </div>
      ) : null}

      {step === 'summary' ? (
        <div className="space-y-4 rounded-2xl border border-brand-100 bg-surface p-5">
          <h2 className="font-semibold text-brand-900">Resumo</h2>
          <p className="text-sm text-[var(--muted)]">
            {route.recordNewCustomer
              ? 'A gravação começa no seu GPS. Marque um ponto em cada fazenda nova e finalize quando quiser.'
              : gpsFallback
              ? 'Sem GPS neste endereço HTTP (o celular só libera localização em HTTPS ou o PC em localhost). Ordem = planejada. Origem do Play = 1ª parada.'
              : 'Entregas ordenadas da mais perto para a mais longe a partir de onde você está. A ordem definitiva é gravada ao confirmar o início.'}
          </p>
          {route.recordNewCustomer ? null : previewMap}
          {route.recordNewCustomer ? null : (
          <ol className="space-y-2 text-sm">
            {previewStops.map((s, index) => {
              const dist = gps ? haversineMeters(gps, s) : null;
              return (
                <li key={s.id} className="flex gap-2">
                  <span className="font-semibold text-brand-600">{index + 1}.</span>
                  <span className="min-w-0 flex-1">
                    {s.visit.customer.name}
                    {dist != null && !gpsFallback ? (
                      <span className="ml-1 text-xs text-[var(--muted)]">
                        · {formatMeters(dist)}
                        {index === 0 ? ' (mais perto)' : ''}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
          )}
          <button
            type="button"
            onClick={() => setStep('vehicle')}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white"
          >
            Continuar
          </button>
        </div>
      ) : null}

      {step === 'vehicle' ? (
        <div className="space-y-4 rounded-2xl border border-brand-100 bg-surface p-5">
          <h2 className="font-semibold text-brand-900">Veículo</h2>
          {previewMap}
          {vehicles.length === 0 ? (
            <p className="text-sm text-[var(--muted)]" role="status">
              Nenhum veículo disponível. Outro funcionário pode estar usando a frota.
            </p>
          ) : (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Qual veículo você está usando?</span>
              <select
                value={vehicleId}
                onChange={(e) => {
                  const next = e.target.value;
                  setVehicleId(next);
                  const chosen = vehicles.find((x) => x.id === next);
                  if (chosen?.odometerKm != null) setOdometerKm(String(chosen.odometerKm));
                  if (
                    chosen?.lastFuelLevel &&
                    FUEL_LEVEL_OPTIONS.some((o) => o.value === chosen.lastFuelLevel)
                  ) {
                    setFuelLevel(chosen.lastFuelLevel as FuelLevel);
                  }
                }}
                className="w-full ops-input"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                    {v.brand || v.model ? ` · ${[v.brand, v.model].filter(Boolean).join(' ')}` : ''}
                    {v.status !== 'AVAILABLE' ? ' (atribuído)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selectedVehicle && (selectedVehicle.odometerKm != null || selectedVehicle.lastFuelLevel) ? (
            <p className="text-xs text-[var(--muted)]">
              Último km: {selectedVehicle.odometerKm ?? '—'}
              {selectedVehicle.lastFuelLevel
                ? ` · Comb.: ${FUEL_LEVEL_OPTIONS.find((o) => o.value === selectedVehicle.lastFuelLevel)?.label ?? selectedVehicle.lastFuelLevel}`
                : ''}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('summary')}
              className="flex-1 rounded-xl border border-brand-200 px-4 py-2 text-sm font-semibold"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={!vehicleId}
              onClick={() => setStep('checklist')}
              className="flex-1 ops-btn ops-btn-primary disabled:opacity-60"
            >
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {step === 'checklist' ? (
        <div className="space-y-4 rounded-2xl border border-brand-100 bg-surface p-5">
          <h2 className="font-semibold text-brand-900">Checklist</h2>
          {previewMap}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Km inicial do veículo *</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              value={odometerKm}
              onChange={(e) => setOdometerKm(e.target.value)}
              className="w-full ops-input"
              placeholder="Ex.: 125430"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Combustível *</span>
            <select
              value={fuelLevel}
              onChange={(e) => setFuelLevel(e.target.value as FuelLevel)}
              className="w-full ops-input"
            >
              {FUEL_LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Observação</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full ops-input"
              placeholder="Opcional"
            />
          </label>
          <OdometerPhotoCapture
            id="start-odometer-photo"
            file={odometerPhoto}
            onChange={setOdometerPhoto}
            required
            disabled={submitting}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('vehicle')}
              className="flex-1 rounded-xl border border-brand-200 px-4 py-2 text-sm font-semibold"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => setStep('confirm')}
              disabled={!odometerPhoto || !odometerKm}
              className="flex-1 ops-btn ops-btn-primary disabled:opacity-60"
            >
              Revisar
            </button>
          </div>
        </div>
      ) : null}

      {step === 'confirm' ? (
        <div className="space-y-4 rounded-2xl border border-brand-100 bg-surface p-5">
          <h2 className="font-semibold text-brand-900">Confirmar início</h2>
          {previewMap}
          <ul className="space-y-1 text-sm text-[var(--muted)]">
            <li>
              Veículo:{' '}
              <strong className="text-brand-900">
                {vehicles.find((v) => v.id === vehicleId)?.plate ?? '—'}
              </strong>
            </li>
            <li>
              Km inicial: <strong className="text-brand-900">{odometerKm || '—'}</strong>
            </li>
            <li>
              Combustível:{' '}
              <strong className="text-brand-900">
                {FUEL_LEVEL_OPTIONS.find((o) => o.value === fuelLevel)?.label}
              </strong>
            </li>
            <li>
              Foto do odômetro:{' '}
              <strong className="text-brand-900">{odometerPhoto ? 'Anexada' : '—'}</strong>
            </li>
            {gps && previewStops[0] && !route.recordNewCustomer ? (
              <li>
                1ª parada:{' '}
                <strong className="text-brand-900">
                  {previewStops[0].visit.customer.name}
                  {gpsFallback
                    ? ' (ordem planejada, sem GPS)'
                    : ` · ${formatMeters(haversineMeters(gps, previewStops[0]))}`}
                </strong>
              </li>
            ) : null}
          </ul>
          <p className="text-xs text-[var(--muted)]">
            {gpsFallback
              ? 'O mapa abre na 1ª parada. O pin ao vivo só aparece com GPS (HTTPS no celular ou localhost no PC).'
              : 'Ao iniciar, o mapa abrirá centralizado na sua posição atual e o rastreamento HTTP será ativado.'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep('checklist')}
              className="flex-1 rounded-xl border border-brand-200 px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              Voltar
            </button>
            <ActionButton
              disabled={submitting || !odometerPhoto}
              loading={submitting}
              loadingLabel="Iniciando…"
              onClick={() => void onStartRoute()}
              className="flex-1 justify-center"
            >
              ▶ Iniciar rota
            </ActionButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}
