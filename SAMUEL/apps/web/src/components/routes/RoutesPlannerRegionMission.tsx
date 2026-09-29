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
import { cartoTransformRequest, getRasterStyleForTheme } from '@/lib/map-style';
import { useTheme } from '@/components/theme/ThemeProvider';
import { ActionButton } from '@/components/ui/ActionButton';
import { MobileActionBar } from '@/components/ui/MobileActionBar';
import { CustomerRegionCircles, type CustomerRegionPin } from '@/components/map/CustomerRegionCircles';
import {
  DEFAULT_REGION_RADIUS_METERS,
  formatRegionKm,
  MAX_REGION_RADIUS_METERS,
  MIN_REGION_RADIUS_METERS,
  regionCircleBounds,
  regionCirclePolygon,
} from '@/lib/region-circle';
import type { CompanyOrigin } from './routes-planner-shared';
import { RoutesPlannerRegionDispatch, type RegionDispatchPin } from './RoutesPlannerRegionDispatch';
import { regionMeta, RoutesPlannerRegionList, type RegionListItem } from './RoutesPlannerRegionList';

type RegionPanel = 'browse' | 'create' | 'edit' | 'dispatch';
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

function sliderRadius(meters: number): number {
  return Math.min(MAX_REGION_RADIUS_METERS, Math.max(MIN_REGION_RADIUS_METERS, meters));
}

export function RoutesPlannerRegionMission({ company }: { company: CompanyOrigin }) {
  const user = useSessionUser();
  const { theme } = useTheme();
  const mapStyle = getRasterStyleForTheme(theme);
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const radiusMetersRef = useRef(DEFAULT_REGION_RADIUS_METERS);
  const addressAbort = useRef<AbortController | null>(null);
  const appliedLabelRef = useRef<string | null>(null);

  const canSave =
    user?.role === 'ADMIN' ||
    user?.role === 'PLATFORM_ADMIN' ||
    user?.role === 'MANAGER' ||
    user?.role === 'SUPERVISOR';

  const [regions, setRegions] = useState<RegionListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<RegionPanel>('browse');
  const [reloadToken, setReloadToken] = useState(0);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_REGION_RADIUS_METERS);
  const [storedRadiusMeters, setStoredRadiusMeters] = useState<number | null>(null);
  const [regionName, setRegionName] = useState('');
  const [addressQ, setAddressQ] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressHint, setAddressHint] = useState<AddressHint>('idle');
  const [nearby, setNearby] = useState<NearbyPin[]>([]);
  const [dispatchPins, setDispatchPins] = useState<RegionDispatchPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const hasCenter = latitude != null && longitude != null;
  const editing = canSave && (panel === 'create' || panel === 'edit');
  const selectedRegion = regions.find((r) => r.id === selectedId) ?? null;
  const visibleDispatchPins = panel === 'dispatch' && selectedId ? dispatchPins : [];
  radiusMetersRef.current = radiusMeters;
  const addressMsg = addressHintMessage(addressHint);
  const kmValue = radiusMeters / 1000;

  const circle = useMemo(() => {
    if (!hasCenter) return null;
    return regionCirclePolygon(latitude!, longitude!, radiusMeters);
  }, [hasCenter, latitude, longitude, radiusMeters]);

  const loadRegions = useCallback(async () => {
    const r = await apiFetch<{ regions: RegionListItem[] }>('/api/v1/customer-regions');
    setRegions(r.regions ?? []);
    return r.regions ?? [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadRegions()
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Falha ao carregar regiões');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadRegions]);

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

  useEffect(() => {
    if (!hasCenter || !mapRef.current) return;
    fitMapToCenter(latitude!, longitude!);
  }, [hasCenter, latitude, longitude, fitMapToCenter]);

  useEffect(() => {
    if (!hasCenter) {
      setNearby([]);
      return;
    }
    const queryRadius = Math.min(radiusMeters, MAX_REGION_RADIUS_METERS);
    const t = window.setTimeout(() => {
      void apiFetch<{ customers: NearbyPin[] }>(
        `/api/v1/map/customers/nearby?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}&radiusMeters=${encodeURIComponent(String(queryRadius))}`,
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

  function clearDraft() {
    setSelectedId(null);
    setStoredRadiusMeters(null);
    setRegionName('');
    setLatitude(null);
    setLongitude(null);
    setRadiusMeters(DEFAULT_REGION_RADIUS_METERS);
    setAddressQ('');
    setSuggestions([]);
  }

  function fillFromRegion(region: CustomerRegionPin) {
    setRegionName(region.name);
    setLatitude(region.latitude);
    setLongitude(region.longitude);
    setRadiusMeters(sliderRadius(region.radiusMeters));
    setStoredRadiusMeters(region.radiusMeters);
    setAddressQ('');
    setSuggestions([]);
  }

  function startNew() {
    clearDraft();
    setError(null);
    setMsg(null);
    setPanel('create');
  }

  function selectRegion(region: RegionListItem) {
    setSelectedId(region.id);
    fillFromRegion(region);
    setError(null);
    setMsg(null);
    fitMapToCenter(region.latitude, region.longitude);
  }

  /** Descarta o rascunho não salvo e volta ao círculo gravado. */
  function restoreSelected() {
    if (selectedRegion) fillFromRegion(selectedRegion);
    else clearDraft();
  }

  function backToList() {
    restoreSelected();
    setError(null);
    setMsg(null);
    setPanel('browse');
  }

  function openDispatch(region: RegionListItem) {
    selectRegion(region);
    setPanel('dispatch');
  }

  function openEdit(region: RegionListItem) {
    selectRegion(region);
    setPanel('edit');
  }

  function editToDispatch() {
    restoreSelected();
    setError(null);
    setMsg(null);
    setPanel('dispatch');
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

  async function save() {
    if (!editing || saving) return;
    const name = regionName.trim();
    if (!name) {
      setError('Informe o nome da região.');
      return;
    }
    if (!hasCenter) {
      setError('Clique no mapa ou busque um endereço para definir o centro.');
      return;
    }
    setSaving(true);
    setError(null);
    setMsg(null);
    const body = {
      name,
      latitude,
      longitude,
      radiusMeters,
    };
    const isEdit = panel === 'edit' && selectedId != null;
    try {
      const path = isEdit
        ? `/api/v1/customer-regions/${selectedId}`
        : '/api/v1/customer-regions';
      const r = await apiFetch<{ region: CustomerRegionPin; linkedCount?: number }>(path, {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      const list = await loadRegions();
      const saved = list.find((item) => item.id === r.region.id) ?? r.region;
      setSelectedId(saved.id);
      fillFromRegion(saved);
      setReloadToken((n) => n + 1);
      setPanel('browse');
      const linkedCount = r.linkedCount ?? 0;
      const radiusNote =
        saved.radiusMeters > radiusMeters
          ? ` O raio ficou em ${formatRegionKm(saved.radiusMeters)} para cobrir os clientes.`
          : '';
      const linkedNote =
        linkedCount > 0 ? ` ${linkedCount} cliente(s) do círculo entraram na região.` : '';
      setMsg(`Região salva.${radiusNote}${linkedNote}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao salvar região');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!canSave || panel !== 'edit' || !selectedId || saving) return;
    if (!window.confirm('Excluir esta região? Os clientes ficam sem região.')) return;
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/customer-regions/${selectedId}`, { method: 'DELETE' });
      await loadRegions();
      setReloadToken((n) => n + 1);
      clearDraft();
      setPanel('browse');
      setMsg('Região excluída. Os clientes ficaram sem região.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao excluir região');
    } finally {
      setSaving(false);
    }
  }

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
          transformRequest={cartoTransformRequest}
          style={{ width: '100%', height: '100%' }}
          attributionControl
          onLoad={handleMapLoad}
          onClick={editing ? handleClick : undefined}
          cursor={editing ? 'crosshair' : 'grab'}
        >
          <NavigationControl position="bottom-right" />
          <ScaleControl position="bottom-left" unit="metric" maxWidth={120} />
          <CustomerRegionCircles reloadToken={reloadToken} />
          {circle ? (
            <Source id="region-draft" type="geojson" data={circle}>
              <Layer
                id="region-draft-fill"
                type="fill"
                paint={{ 'fill-color': '#FF5722', 'fill-opacity': 0.14 }}
              />
              <Layer
                id="region-draft-line"
                type="line"
                paint={{
                  'line-color': '#FF5722',
                  'line-width': 2,
                  'line-dasharray': [2, 1],
                  'line-opacity': 0.95,
                }}
              />
            </Source>
          ) : null}
          {nearby
            .filter((c) => !visibleDispatchPins.some((p) => p.id === c.id))
            .map((c) => (
            <Marker key={c.id} latitude={c.latitude} longitude={c.longitude} anchor="bottom">
              <div
                className="h-3 w-3 rounded-full border border-white bg-neutral-400 shadow"
                title={c.name}
                aria-label={`Cliente no raio: ${c.name}`}
              />
            </Marker>
          ))}
          {visibleDispatchPins.map((p) => (
            <Marker key={`dispatch-${p.id}`} latitude={p.latitude} longitude={p.longitude} anchor="bottom">
              <div
                className={`h-3.5 w-3.5 rounded-full border-2 border-white shadow ${
                  p.selected ? 'bg-accent' : 'bg-neutral-500 opacity-60'
                }`}
                title={p.name}
                aria-label={`${p.selected ? 'Na visita' : 'Fora desta visita'}: ${p.name}`}
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
              draggable={editing}
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
        {panel === 'browse' ? (
          <div>
            <h2 className="text-lg font-semibold text-brand-900">Região</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Escolha uma região para enviar funcionários ou crie uma nova.
            </p>
          </div>
        ) : (
          <button
            type="button"
            className="self-start text-sm font-medium text-brand-700 hover:underline"
            onClick={backToList}
          >
            ← Voltar às regiões
          </button>
        )}

        {error ? (
          <p className="rounded-[8px] bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
        {msg ? (
          <p className="rounded-[8px] bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{msg}</p>
        ) : null}

        {panel === 'browse' ? (
          <RoutesPlannerRegionList
            regions={regions}
            selectedId={selectedId}
            canSave={canSave}
            onSelect={selectRegion}
            onDispatch={openDispatch}
            onEdit={openEdit}
            onCreate={startNew}
          />
        ) : null}

        {panel === 'dispatch' && selectedRegion ? (
          <>
            <div className="flex items-start justify-between gap-2 rounded-xl border border-accent bg-accent/10 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-brand-900">{selectedRegion.name}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{regionMeta(selectedRegion)}</p>
              </div>
              {canSave ? (
                <button
                  type="button"
                  className="ops-btn ops-btn-secondary shrink-0 px-3 text-xs"
                  onClick={() => setPanel('edit')}
                >
                  Editar
                </button>
              ) : null}
            </div>
            <RoutesPlannerRegionDispatch
              key={selectedRegion.id}
              company={company}
              customerRegionId={selectedRegion.id}
              onPinsChange={setDispatchPins}
            />
          </>
        ) : null}

        {editing ? (
          <>
            <div>
              <h2 className="text-lg font-semibold text-brand-900">
                {panel === 'edit' && selectedRegion ? `Editar "${selectedRegion.name}"` : 'Nova região'}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Clique no mapa ou busque um endereço, ajuste o raio e dê um nome. Ao salvar, os
                clientes ativos sem região dentro do círculo entram nela. Se um cliente da região
                cair fora, o km aumenta até o pin dele.
              </p>
            </div>

            {!hasCenter ? (
              <p className="rounded-[8px] border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]">
                Clique no mapa ou busque um endereço para definir o centro.
              </p>
            ) : (
              <p className="font-mono text-xs text-[var(--muted)]">
                Centro {latitude!.toFixed(5)}, {longitude!.toFixed(5)} · {nearby.length} cliente(s)
                no raio
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
                Raio ({formatRegionKm(storedRadiusMeters != null && storedRadiusMeters > radiusMeters ? storedRadiusMeters : radiusMeters)})
              </span>
              <input
                type="range"
                min={MIN_REGION_RADIUS_METERS / 1000}
                max={MAX_REGION_RADIUS_METERS / 1000}
                step={0.5}
                value={kmValue}
                onChange={(e) => {
                  setStoredRadiusMeters(null);
                  setRadiusMeters(Math.round(Number(e.target.value) * 1000));
                }}
                className="w-full"
                aria-valuemin={0.5}
                aria-valuemax={50}
                aria-valuenow={kmValue}
              />
            </label>
            {storedRadiusMeters != null && storedRadiusMeters > MAX_REGION_RADIUS_METERS ? (
              <p className="text-xs text-[var(--muted)]">
                O círculo salvo está em {formatRegionKm(storedRadiusMeters)} porque há cliente fora
                do slider de 50 km.
              </p>
            ) : null}

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-brand-900">Nome da região</span>
              <input
                type="text"
                maxLength={200}
                value={regionName}
                onChange={(e) => setRegionName(e.target.value)}
                className="w-full ops-input text-sm"
              />
            </label>

            <MobileActionBar className="max-md:flex-row max-md:flex-wrap md:flex-wrap md:justify-start">
              <ActionButton
                type="button"
                loading={saving}
                disabled={!hasCenter || !regionName.trim()}
                onClick={() => void save()}
              >
                Salvar região
              </ActionButton>
            </MobileActionBar>

            {panel === 'edit' ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="ops-btn ops-btn-secondary"
                  disabled={saving}
                  onClick={() => void remove()}
                >
                  Excluir
                </button>
                <button type="button" className="ops-link text-sm" onClick={editToDispatch}>
                  Enviar para visitar
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </aside>
    </div>
  );
}
