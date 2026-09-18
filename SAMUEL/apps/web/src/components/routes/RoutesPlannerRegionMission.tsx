'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapLibreMap, { Layer, Marker, NavigationControl, Source } from 'react-map-gl/maplibre';
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

const BRASIL = { latitude: -14.235, longitude: -51.9253, zoom: 3.8 };

export function RoutesPlannerRegionMission() {
  const user = useSessionUser();
  const { theme } = useTheme();
  const mapStyle = getRasterStyleForTheme(theme);
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  const [nearby, setNearby] = useState<NearbyPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const hasCenter = latitude != null && longitude != null;
  const defaultName = `Raio ${formatRegionKm(radiusMeters)}`;

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

  useEffect(() => {
    if (!hasCenter || !mapRef.current) return;
    mapRef.current.fitBounds(regionCircleBounds(latitude!, longitude!, radiusMeters), {
      padding: 40,
      maxZoom: 13,
      duration: 500,
    });
  }, [hasCenter, latitude, longitude, radiusMeters]);

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
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      void apiFetch<{ suggestions: AddressSuggestion[] }>(
        `/api/v1/lookups/address?q=${encodeURIComponent(q)}`,
      )
        .then((r) => setSuggestions(r.suggestions ?? []))
        .catch(() => setSuggestions([]));
    }, 400);
    return () => window.clearTimeout(t);
  }, [addressQ]);

  function setCenter(lat: number, lng: number) {
    setLatitude(lat);
    setLongitude(lng);
    setMsg(null);
  }

  function handleClick(e: MapLayerMouseEvent) {
    setCenter(e.lngLat.lat, e.lngLat.lng);
  }

  function handleDragEnd(e: MarkerDragEvent) {
    setCenter(e.lngLat.lat, e.lngLat.lng);
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
    <div className="relative flex min-h-[480px] flex-col gap-3 lg:h-[calc(100vh-11rem)] lg:flex-row">
      <div
        ref={containerRef}
        className="order-1 h-[280px] overflow-hidden rounded-2xl border border-brand-100 bg-surface sm:h-[360px] lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1"
      >
        <MapLibreMap
          ref={mapRef}
          initialViewState={BRASIL}
          mapStyle={mapStyle}
          style={{ width: '100%', height: '100%' }}
          attributionControl
          onClick={handleClick}
          cursor="crosshair"
        >
          <NavigationControl position="bottom-right" />
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
            Clique no mapa para o centro. Raio padrão 5 km. O funcionário grava pontos como na
            missão Gravar cliente. Clientes já no círculo só aparecem no mapa (não viram paradas).
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
            Clique no mapa para definir o centro.
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
            onChange={(e) => setAddressQ(e.target.value)}
            placeholder="Rua, cidade…"
            className="w-full ops-input text-sm"
            autoComplete="off"
          />
        </label>
        {suggestions.length > 0 ? (
          <ul className="max-h-28 space-y-1 overflow-auto text-sm">
            {suggestions.map((s) => (
              <li key={`${s.label}-${s.latitude}`}>
                <button
                  type="button"
                  className="w-full rounded-[6px] px-2 py-1.5 text-left hover:bg-surface"
                  onClick={() => {
                    setCenter(s.latitude, s.longitude);
                    setAddressQ(s.label);
                    setSuggestions([]);
                  }}
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
