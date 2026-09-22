'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapLibreMap, {
  Layer,
  Marker,
  NavigationControl,
  ScaleControl,
  Source,
} from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent, MapRef, MarkerDragEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useSessionUser } from '@/lib/session-context';
import { getRasterStyleForTheme } from '@/lib/map-style';
import { useTheme } from '@/components/theme/ThemeProvider';
import { toDateInputValue } from '@/lib/ops-labels';
import { ActionButton } from '@/components/ui/ActionButton';
import {
  DEFAULT_REGION_RADIUS_METERS,
  formatRegionKm,
  MAX_REGION_RADIUS_METERS,
  MIN_REGION_RADIUS_METERS,
  regionCircleBounds,
  regionCirclePolygon,
} from '@/lib/region-circle';

type EmployeeOption = { id: string; name: string; status?: string; userId?: string | null };
type VehicleOption = { id: string; plate: string; status?: string };
type NearbyPin = { id: string; name: string; latitude: number; longitude: number };
type AddressSuggestion = { label: string; latitude: number; longitude: number };
type AddressHint = 'idle' | 'loading' | 'ok' | 'not_found' | 'error' | 'rate_limit';

const BRASIL = { latitude: -14.235, longitude: -51.9253, zoom: 3.8 };

function addressHintMessage(hint: AddressHint): string | null {
  if (hint === 'loading') return 'Buscando endereço…';
  if (hint === 'not_found') return 'Nenhum endereço encontrado.';
  if (hint === 'rate_limit') return 'Muitas buscas. Aguarde.';
  if (hint === 'error') return 'Falha ao buscar endereço.';
  return null;
}

export function RoutesPlannerRegionMission() {
  const user = useSessionUser();
  const { theme } = useTheme();
  const mapStyle = getRasterStyleForTheme(theme);
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const radiusMetersRef = useRef(DEFAULT_REGION_RADIUS_METERS);
  const addressAbort = useRef<AbortController | null>(null);
  const appliedLabelRef = useRef<string | null>(null);

  const canPublish =
    user?.role === 'ADMIN' || user?.role === 'PLATFORM_ADMIN' || user?.role === 'MANAGER';

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [routeDate, setRouteDate] = useState(() => toDateInputValue());
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_REGION_RADIUS_METERS);
  const [regionName, setRegionName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [addressQ, setAddressQ] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressHint, setAddressHint] = useState<AddressHint>('idle');
  const [nearby, setNearby] = useState<NearbyPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const hasCenter = latitude != null && longitude != null;
  const defaultName = `Raio ${formatRegionKm(radiusMeters)}`;
  radiusMetersRef.current = radiusMeters;
  const addressMsg = addressHintMessage(addressHint);

  const circle = useMemo(() => {
    if (!hasCenter) return null;
    return regionCirclePolygon(latitude!, longitude!, radiusMeters);
  }, [hasCenter, latitude, longitude, radiusMeters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, v] = await Promise.all([
        apiFetch<{ employees: EmployeeOption[] }>('/api/v1/employees?status=ACTIVE'),
        apiFetch<{ vehicles: VehicleOption[] }>('/api/v1/vehicles'),
      ]);
      setEmployees(
        e.employees.filter((x) => (!x.status || x.status === 'ACTIVE') && Boolean(x.userId)),
      );
      setVehicles(
        v.vehicles.filter((x) => !x.status || x.status === 'AVAILABLE' || x.status === 'IN_USE'),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar funcionários/veículos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => mapRef.current?.getMap()?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitMapToCenter = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.getMap()?.resize();
    map.fitBounds(regionCircleBounds(lat, lng, radiusMetersRef.current), {
      padding: 40,
      maxZoom: 13,
      duration: 500,
    });
  }, []);

  const resetMapToBrasil = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getMap()?.resize();
    map.jumpTo({
      center: [BRASIL.longitude, BRASIL.latitude],
      zoom: BRASIL.zoom,
    });
  }, []);

  useEffect(() => {
    if (!hasCenter || !mapRef.current) return;
    fitMapToCenter(latitude!, longitude!);
  }, [hasCenter, latitude, longitude, fitMapToCenter]);

  useEffect(() => {
    if (!hasCenter) {
      setNearby([]);
      return;
    }
    const t = window.setTimeout(() => {
      void apiFetch<{ customers: NearbyPin[] }>(
        `/api/v1/map/customers/nearby?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}&radiusMeters=${encodeURIComponent(String(radiusMeters))}`,
      )
        .then((r) => setNearby(r.customers ?? []))
        .catch(() => setNearby([]));
    }, 400);
    return () => window.clearTimeout(t);
  }, [hasCenter, latitude, longitude, radiusMeters]);

  useEffect(() => {
    const q = addressQ.trim();
    if (appliedLabelRef.current && q === appliedLabelRef.current) {
      setSuggestions([]);
      if (addressHint === 'loading') setAddressHint('idle');
      return;
    }
    if (q.length < 3) {
      setSuggestions([]);
      if (addressHint === 'loading') setAddressHint('idle');
      return;
    }
    const t = window.setTimeout(async () => {
      addressAbort.current?.abort();
      const controller = new AbortController();
      addressAbort.current = controller;
      setAddressHint('loading');
      try {
        const r = await apiFetch<{ suggestions: AddressSuggestion[] }>(
          `/api/v1/lookups/address?q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        setSuggestions(r.suggestions ?? []);
        setAddressHint((r.suggestions ?? []).length ? 'ok' : 'not_found');
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setSuggestions([]);
        if (e instanceof ApiError && e.status === 429) setAddressHint('rate_limit');
        else setAddressHint('error');
      }
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressQ]);

  function setCenter(lat: number, lng: number) {
    setLatitude(lat);
    setLongitude(lng);
    setMsg(null);
  }

  function applyAddress(s: AddressSuggestion) {
    appliedLabelRef.current = s.label;
    setLatitude(s.latitude);
    setLongitude(s.longitude);
    setAddressQ(s.label);
    setSuggestions([]);
    setAddressHint('ok');
    setMsg(null);
    fitMapToCenter(s.latitude, s.longitude);
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function resetForm() {
    appliedLabelRef.current = null;
    addressAbort.current?.abort();
    setLatitude(null);
    setLongitude(null);
    setAddressQ('');
    setSuggestions([]);
    setNearby([]);
    setAddressHint('idle');
    setRadiusMeters(DEFAULT_REGION_RADIUS_METERS);
    setRegionName('');
    setNameTouched(false);
    setEmployeeId('');
    setVehicleId('');
    setError(null);
    resetMapToBrasil();
  }

  function handleClick(e: MapLayerMouseEvent) {
    setCenter(e.lngLat.lat, e.lngLat.lng);
  }

  function handleDragEnd(e: MarkerDragEvent) {
    setCenter(e.lngLat.lat, e.lngLat.lng);
  }

  function handleMapLoad() {
    mapRef.current?.getMap()?.resize();
    if (latitude != null && longitude != null) {
      fitMapToCenter(latitude, longitude);
    }
  }

  async function publish() {
    if (!canPublish || !employeeId || !vehicleId || !hasCenter || publishing) return;
    setPublishing(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch('/api/v1/routes/dispatch-region-mission', {
        method: 'POST',
        body: JSON.stringify({
          date: routeDate,
          employeeId,
          vehicleId,
          latitude,
          longitude,
          radiusMeters,
          regionName: (nameTouched ? regionName : defaultName).trim() || undefined,
        }),
      });
      setMsg('Missão de gravar região publicada. O funcionário vê a área em Minha rota.');
      resetForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao publicar missão');
    } finally {
      setPublishing(false);
    }
  }

  const kmValue = radiusMeters / 1000;

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  }

  return (
    <div className="relative flex min-h-[360px] flex-col gap-3 lg:h-[calc(100vh-11rem)] lg:min-h-[480px] lg:flex-row">
      <div
        ref={containerRef}
        className="order-1 h-[min(50dvh,320px)] overflow-hidden rounded-2xl border border-brand-100 bg-surface sm:h-[360px] lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1"
      >
        <MapLibreMap
          ref={mapRef}
          initialViewState={BRASIL}
          mapStyle={mapStyle}
          style={{ width: '100%', height: '100%' }}
          attributionControl
          onLoad={handleMapLoad}
          onClick={handleClick}
          cursor="crosshair"
        >
          <NavigationControl position="bottom-right" />
          <ScaleControl position="bottom-left" unit="metric" maxWidth={120} />
          {circle ? (
            <Source id="region-circle" type="geojson" data={circle}>
              <Layer
                id="region-circle-fill"
                type="fill"
                paint={{ 'fill-color': '#FF5722', 'fill-opacity': 0.14 }}
              />
              <Layer
                id="region-circle-line"
                type="line"
                paint={{
                  'line-color': '#FF5722',
                  'line-width': 2,
                  'line-opacity': 0.95,
                }}
              />
            </Source>
          ) : null}
          {nearby.map((c) => (
            <Marker key={c.id} latitude={c.latitude} longitude={c.longitude} anchor="bottom">
              <div
                className="h-3 w-3 rounded-full border border-white bg-neutral-400 shadow"
                title={c.name}
                aria-label={`Cliente no raio: ${c.name}`}
              />
            </Marker>
          ))}
          {suggestions.map((s) => (
            <Marker
              key={`sug-${s.label}-${s.latitude}-${s.longitude}`}
              latitude={s.latitude}
              longitude={s.longitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                applyAddress(s);
              }}
            >
              <button
                type="button"
                className="h-3.5 w-3.5 rounded-full border-2 border-white bg-sky-500 shadow"
                title={s.label}
                aria-label={`Sugestão: ${s.label}`}
              />
            </Marker>
          ))}
          {hasCenter ? (
            <Marker
              latitude={latitude!}
              longitude={longitude!}
              anchor="bottom"
              draggable
              onDragEnd={handleDragEnd}
            >
              <div
                className="h-5 w-5 rounded-full border-2 border-white bg-accent shadow"
                aria-label="Centro da região"
              />
            </Marker>
          ) : null}
        </MapLibreMap>
      </div>

      <aside className="ops-surface order-2 flex w-full shrink-0 flex-col gap-3 overflow-auto rounded-[10px] p-4 lg:order-1 lg:w-[26rem]">
        <div>
          <h2 className="text-lg font-semibold text-brand-900">Gravar região</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Clique no mapa ou busque um endereço para o centro. Raio padrão 5 km. O funcionário
            grava pontos como na missão Gravar cliente. Clientes já no círculo só aparecem no mapa
            (não viram paradas).
          </p>
        </div>

        {error ? (
          <p className="rounded-[8px] bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
        {msg ? (
          <p className="rounded-[8px] bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{msg}</p>
        ) : null}

        {!hasCenter ? (
          <p className="rounded-[8px] border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]">
            Clique no mapa ou busque um endereço para definir o centro.
          </p>
        ) : (
          <p className="font-mono text-xs text-[var(--muted)]">
            Centro {latitude!.toFixed(5)}, {longitude!.toFixed(5)} · {nearby.length} cliente(s) no
            raio
          </p>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-900">Buscar endereço (opcional)</span>
          <input
            type="search"
            value={addressQ}
            onChange={(e) => {
              appliedLabelRef.current = null;
              setAddressQ(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (suggestions[0]) applyAddress(suggestions[0]);
            }}
            placeholder="Rua, cidade…"
            className="w-full ops-input text-sm"
            autoComplete="off"
          />
        </label>
        {addressMsg && addressHint !== 'ok' ? (
          <p className="text-xs text-[var(--warn)]">{addressMsg}</p>
        ) : null}
        {suggestions.length > 0 ? (
          <ul className="max-h-40 space-y-1 overflow-auto text-sm">
            {suggestions.map((s) => (
              <li key={`${s.label}-${s.latitude}-${s.longitude}`}>
                <button
                  type="button"
                  className="w-full rounded-[6px] px-2 py-1.5 text-left hover:bg-surface"
                  onClick={() => applyAddress(s)}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-900">
            Raio ({formatRegionKm(radiusMeters)})
          </span>
          <input
            type="range"
            min={MIN_REGION_RADIUS_METERS / 1000}
            max={MAX_REGION_RADIUS_METERS / 1000}
            step={0.5}
            value={kmValue}
            onChange={(e) => setRadiusMeters(Math.round(Number(e.target.value) * 1000))}
            className="w-full"
            aria-valuemin={0.5}
            aria-valuemax={50}
            aria-valuenow={kmValue}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-900">Nome da região</span>
          <input
            type="text"
            maxLength={200}
            value={nameTouched ? regionName : defaultName}
            onChange={(e) => {
              setNameTouched(true);
              setRegionName(e.target.value);
            }}
            className="w-full ops-input text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-900">Data</span>
          <input
            type="date"
            value={routeDate}
            onChange={(e) => setRouteDate(e.target.value)}
            className="w-full ops-input text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-900">Funcionário</span>
          <select
            value={employeeId}
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
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-900">Veículo</span>
          <select
            value={vehicleId}
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
        </label>

        {canPublish ? (
          <ActionButton
            type="button"
            loading={publishing}
            disabled={!employeeId || !vehicleId || !hasCenter}
            onClick={() => void publish()}
          >
            Publicar missão
          </ActionButton>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            Preview disponível. Publicar exige perfil ADMIN ou MANAGER.
          </p>
        )}
      </aside>
    </div>
  );
}
