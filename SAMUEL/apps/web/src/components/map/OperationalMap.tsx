'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import MapGL, { Layer, Marker, NavigationControl, Source } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useSessionUser } from '@/lib/session-context';
import { ROUTE_EXECUTED_GLOW, ROUTE_EXECUTED_LINE, ROUTE_GLOW, ROUTE_LINE, getRasterStyleForTheme, type MapCustomerPin } from '@/lib/map-style';
import { useTheme } from '@/components/theme/ThemeProvider';
import { toDateInputValue } from '@/lib/ops-labels';
import {
  formatMetersKm,
  formatOpsDate,
  formatOpsDay,
  OPS_OPERATIONAL_LABELS,
  OPS_ROUTE_STATUS_LABELS,
  opsEmployeeStatusLine,
  type CustomerOpsContext,
  type OpsSnapshot,
} from '@/lib/ops-types';
import { parseGeometryJson, type LngLat } from '@/lib/nav-geometry';
import { LiveVehicleMarker, type OpsLiveVehicle } from '@/components/map/LiveVehicleMarker';
import { LandmarkMapMarker } from '@/components/map/LandmarkMapMarker';

const BRASIL = { latitude: -14.235, longitude: -51.9253, zoom: 4 };
const LIVE_POLL_MS = 3_000;
const ROUTE_REFRESH_MS = 15_000;

const STOP_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  SKIPPED: 'Pulado',
  COMPLETED: 'Concluído',
  FAILED: 'Falhou',
};

type LiveVehicle = OpsLiveVehicle;
type OpsLiveRow = OpsSnapshot['live'][number];

type Selection =
  | { kind: 'customer'; pin: MapCustomerPin }
  | { kind: 'vehicle'; vehicle: LiveVehicle }
  | { kind: 'roster'; row: OpsLiveRow }
  | null;

type DrawerView = 'closed' | 'list' | 'detail';
type MapLayer = 'customers' | 'team' | 'routes' | 'all';
type MobileTab = 'equipe' | 'detalhe';

type RouteStopDetail = {
  id: string;
  sequence: number;
  status: string;
  latitude: number;
  longitude: number;
  visit?: {
    customer?: { id: string; name: string } | null;
    serviceOrder?: { id: string; number: string; title: string } | null;
  } | null;
};

type RouteDetail = {
  id: string;
  status: string;
  plannedGeometryJson?: unknown;
  stops: RouteStopDetail[];
};

export function OperationalMap() {
  const user = useSessionUser();
  const { theme } = useTheme();
  const mapStyle = getRasterStyleForTheme(theme);
  const searchParams = useSearchParams();
  const employeeIdFromUrl = searchParams.get('employeeId')?.trim() || '';
  const routeIdFromUrl = searchParams.get('routeId')?.trim() || '';
  const canCreateService =
    user?.role === 'ADMIN' || user?.role === 'PLATFORM_ADMIN' || user?.role === 'MANAGER';
  const canSeeLive =
    user?.role === 'ADMIN' ||
    user?.role === 'PLATFORM_ADMIN' ||
    user?.role === 'MANAGER' ||
    user?.role === 'SUPERVISOR';
  const mapRef = useRef<MapRef>(null);
  const deepLinkHandledRef = useRef<string | null>(null);

  const [pins, setPins] = useState<MapCustomerPin[]>([]);
  const [live, setLive] = useState<LiveVehicle[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [date, setDate] = useState(() => toDateInputValue());
  const [teamFilter, setTeamFilter] = useState('');
  const [selection, setSelection] = useState<Selection>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<OpsSnapshot | null>(null);
  const [ctx, setCtx] = useState<CustomerOpsContext | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('equipe');
  const [drawerView, setDrawerView] = useState<DrawerView>('closed');
  const [mapLayer, setMapLayer] = useState<MapLayer>('all');
  const canManageEmployees =
    user?.role === 'ADMIN' || user?.role === 'PLATFORM_ADMIN' || user?.role === 'MANAGER';

  const [vehicleRoute, setVehicleRoute] = useState<RouteDetail | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routePainted, setRoutePainted] = useState(false);
  const [paintedGeometry, setPaintedGeometry] = useState<{
    type: 'LineString';
    coordinates: LngLat[];
  } | null>(null);
  const [paintedExecutedGeometry, setPaintedExecutedGeometry] = useState<{
    type: 'LineString';
    coordinates: LngLat[];
  } | null>(null);
  const [trailMessage, setTrailMessage] = useState<string | null>(null);
  const [paintedStops, setPaintedStops] = useState<RouteStopDetail[]>([]);
  const [paintedRouteId, setPaintedRouteId] = useState<string | null>(null);
  const [paintedLandmarks, setPaintedLandmarks] = useState<
    {
      id: string;
      type: string;
      latitude: number;
      longitude: number;
      note: string | null;
    }[]
  >([]);
  const accessCacheRef = useRef<
    Map<
      string,
      {
        landmarks: {
          id: string;
          type: string;
          latitude: number;
          longitude: number;
          note: string | null;
        }[];
      }
    >
  >(new globalThis.Map());
  const [customerAccess, setCustomerAccess] = useState<{
    accessPath: {
      id: string;
      geometryJson: unknown;
      distanceMeters: number | null;
    } | null;
    landmarks: {
      id: string;
      type: string;
      latitude: number;
      longitude: number;
      note: string | null;
    }[];
  } | null>(null);

  const loadPins = useCallback(async (search: string, status: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (status) params.set('status', status);
      const qs = params.toString() ? `?${params}` : '';
      const r = await apiFetch<{ customers: MapCustomerPin[] }>(`/api/v1/map/customers${qs}`);
      setPins(r.customers);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar mapa');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLive = useCallback(async () => {
    if (!canSeeLive) return;
    try {
      const r = await apiFetch<{ positions: LiveVehicle[] }>('/api/v1/tracking/live');
      setLive(r.positions);
    } catch {
      // silencioso no poll
    }
  }, [canSeeLive]);

  const loadSnapshot = useCallback(async (day: string) => {
    if (!canSeeLive) return;
    try {
      const r = await apiFetch<OpsSnapshot>(`/api/v1/ops/snapshot?date=${encodeURIComponent(day)}`);
      setSnapshot(r);
    } catch {
      // painel de operação degradado
    }
  }, [canSeeLive]);

  const fetchRouteDetail = useCallback(async (routeId: string): Promise<RouteDetail | null> => {
    const r = await apiFetch<{ route: RouteDetail }>(`/api/v1/routes/${routeId}`);
    return r.route;
  }, []);

  const fitRouteBounds = useCallback(
    (
      geometry: { type: 'LineString'; coordinates: LngLat[] } | null,
      stops: RouteStopDetail[],
      vehicle?: LiveVehicle | null,
    ) => {
      if (!mapRef.current) return;
      const lngs: number[] = [];
      const lats: number[] = [];
      if (geometry?.coordinates.length) {
        for (const [lng, lat] of geometry.coordinates) {
          lngs.push(lng);
          lats.push(lat);
        }
      }
      for (const s of stops) {
        lngs.push(s.longitude);
        lats.push(s.latitude);
      }
      if (vehicle) {
        lngs.push(vehicle.longitude);
        lats.push(vehicle.latitude);
      }
      if (!lngs.length) return;
      mapRef.current.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 72, duration: 800, maxZoom: 15 },
      );
    },
    [],
  );

  const paintRoute = useCallback(
    (route: RouteDetail, vehicle?: LiveVehicle | null) => {
      const geometry = parseGeometryJson(route.plannedGeometryJson);
      const orderedStops = [...route.stops].sort((a, b) => a.sequence - b.sequence);
      setPaintedGeometry(geometry);
      setPaintedStops(orderedStops);
      setPaintedRouteId(route.id);
      setRoutePainted(true);
      setPaintedExecutedGeometry(null);
      setTrailMessage(null);
      fitRouteBounds(geometry, orderedStops, vehicle);

      const loadTrail =
        route.status === 'COMPLETED' ||
        route.status === 'INCOMPLETE' ||
        route.status === 'IN_PROGRESS';
      if (!loadTrail) return;

      void apiFetch<{
        geometry: { type: 'LineString'; coordinates: LngLat[] } | null;
      }>(`/api/v1/tracking/history?routeId=${encodeURIComponent(route.id)}`)
        .then((hist) => {
          if (hist.geometry?.coordinates?.length) {
            setPaintedExecutedGeometry(hist.geometry);
            setTrailMessage(
              route.status === 'INCOMPLETE'
                ? 'Trilha real (rota incompleta)'
                : 'Trilha real percorrida',
            );
            fitRouteBounds(hist.geometry, orderedStops, vehicle);
          } else {
            setTrailMessage('Sem GPS gravado nesta rota');
          }
        })
        .catch((e) => {
          const detail =
            e instanceof ApiError
              ? e.message
              : e instanceof Error
                ? e.message
                : null;
          setTrailMessage(
            detail
              ? `Não foi possível carregar a trilha GPS — ${detail}`
              : 'Não foi possível carregar a trilha GPS',
          );
        });
    },
    [fitRouteBounds],
  );

  const hideRoutePaint = useCallback(() => {
    setRoutePainted(false);
    setPaintedGeometry(null);
    setPaintedExecutedGeometry(null);
    setTrailMessage(null);
    setPaintedStops([]);
    setPaintedRouteId(null);
    setPaintedLandmarks([]);
  }, []);

  const selectVehicle = useCallback(
    (vehicle: LiveVehicle, opts?: { autoPaint?: boolean; openDrawer?: boolean }) => {
      setSelection({ kind: 'vehicle', vehicle });
      setMobileTab('detalhe');
      if (opts?.openDrawer !== false) {
        setDrawerView('detail');
      }
      setMsg(null);
      setRouteError(null);
      setLoadingRoute(true);
      setVehicleRoute(null);
      void fetchRouteDetail(vehicle.routeId)
        .then((route) => {
          setVehicleRoute(route);
          if (opts?.autoPaint && route) {
            paintRoute(route, vehicle);
          }
        })
        .catch((e) => {
          setRouteError(e instanceof ApiError ? e.message : 'Falha ao carregar rota');
        })
        .finally(() => setLoadingRoute(false));
    },
    [fetchRouteDetail, paintRoute],
  );

  const selectRosterEmployee = useCallback(
    (row: OpsLiveRow, opts?: { autoPaint?: boolean }) => {
      const liveMatch = live.find((v) => v.employeeId === row.employeeId);
      if (liveMatch) {
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [liveMatch.longitude, liveMatch.latitude],
            zoom: 14,
            duration: 600,
          });
        }
        selectVehicle(liveMatch, { autoPaint: opts?.autoPaint, openDrawer: true });
        return;
      }

      setSelection({ kind: 'roster', row });
      setDrawerView('detail');
      setMobileTab('detalhe');
      setMsg(null);
      setRouteError(null);
      setVehicleRoute(null);
      if (!row.routeId) {
        setLoadingRoute(false);
        return;
      }
      setLoadingRoute(true);
      void fetchRouteDetail(row.routeId)
        .then((route) => {
          setVehicleRoute(route);
          if (opts?.autoPaint && route) {
            paintRoute(route, null);
          }
        })
        .catch((e) => {
          setRouteError(e instanceof ApiError ? e.message : 'Falha ao carregar rota');
        })
        .finally(() => setLoadingRoute(false));
    },
    [live, selectVehicle, fetchRouteDetail, paintRoute],
  );

  const closeDrawer = useCallback(() => {
    setDrawerView('closed');
  }, []);

  const openTeamList = useCallback(() => {
    setDrawerView('list');
  }, []);

  useEffect(() => {
    if (drawerView === 'closed') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerView, closeDrawer]);

  useEffect(() => {
    void loadPins('', '');
  }, [loadPins]);

  useEffect(() => {
    if (!canSeeLive) return;
    void loadLive();
    const id = window.setInterval(() => void loadLive(), LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [canSeeLive, loadLive]);

  useEffect(() => {
    void loadSnapshot(date);
    const id = window.setInterval(() => void loadSnapshot(date), 15000);
    return () => window.clearInterval(id);
  }, [date, loadSnapshot]);

  // Mantém o painel do veículo com GPS fresco a cada poll
  const selectedEmployeeId =
    selection?.kind === 'vehicle'
      ? selection.vehicle.employeeId
      : selection?.kind === 'roster'
        ? selection.row.employeeId
        : null;
  const selectedRecordedAt =
    selection?.kind === 'vehicle' ? selection.vehicle.recordedAt : null;

  useEffect(() => {
    if (selection?.kind !== 'vehicle' || !selectedEmployeeId) return;
    const fresh = live.find((v) => v.employeeId === selectedEmployeeId);
    if (!fresh) return;
    if (fresh.recordedAt === selectedRecordedAt) return;
    setSelection({ kind: 'vehicle', vehicle: fresh });
  }, [live, selectedEmployeeId, selectedRecordedAt, selection?.kind]);

  // Se o roster estava sem GPS e o pin aparece, promove para vehicle
  useEffect(() => {
    if (selection?.kind !== 'roster') return;
    const fresh = live.find((v) => v.employeeId === selection.row.employeeId);
    if (!fresh) return;
    setSelection({ kind: 'vehicle', vehicle: fresh });
  }, [live, selection]);

  // Recarrega geometria enquanto a linha está pintada (reroute do campo)
  useEffect(() => {
    if (!routePainted || !paintedRouteId) return;
    const refresh = () => {
      void fetchRouteDetail(paintedRouteId)
        .then((route) => {
          if (!route) return;
          setVehicleRoute((prev) =>
            prev?.id === route.id ? route : prev,
          );
          const geometry = parseGeometryJson(route.plannedGeometryJson);
          const orderedStops = [...route.stops].sort((a, b) => a.sequence - b.sequence);
          setPaintedGeometry(geometry);
          setPaintedStops(orderedStops);
        })
        .catch(() => {
          /* silencioso no refresh */
        });
    };
    const id = window.setInterval(refresh, ROUTE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [routePainted, paintedRouteId, fetchRouteDetail]);

  useEffect(() => {
    if (!pins.length || !mapRef.current || routePainted) return;
    const lats = pins.map((p) => p.latitude);
    const lngs = pins.map((p) => p.longitude);
    mapRef.current.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 60, duration: 800, maxZoom: 14 },
    );
  }, [pins, routePainted]);

  useEffect(() => {
    if (selection?.kind !== 'customer') {
      setCtx(null);
      setCustomerAccess(null);
      return;
    }
    let cancelled = false;
    setLoadingCtx(true);
    setMobileTab('detalhe');
    hideRoutePaint();
    setVehicleRoute(null);
    setCustomerAccess(null);
    apiFetch<CustomerOpsContext>(`/api/v1/ops/customers/${selection.pin.id}`)
      .then((r) => {
        if (!cancelled) setCtx(r);
      })
      .catch(() => {
        if (!cancelled) setCtx(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingCtx(false);
      });
    apiFetch<{
      accessPath: {
        id: string;
        geometryJson: unknown;
        distanceMeters: number | null;
      } | null;
      landmarks: {
        id: string;
        type: string;
        latitude: number;
        longitude: number;
        note: string | null;
      }[];
    }>(`/api/v1/customers/${selection.pin.id}/access`)
      .then((r) => {
        if (!cancelled) {
          setCustomerAccess(r);
          accessCacheRef.current.set(selection.pin.id, {
            landmarks: r.landmarks ?? [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setCustomerAccess(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selection?.kind === 'customer' ? selection.pin.id : null, hideRoutePaint]);

  // Marcos dos clientes da rota pintada (visíveis sem clicar no pin)
  useEffect(() => {
    if (!routePainted || !paintedStops.length) {
      setPaintedLandmarks([]);
      return;
    }
    const customerIds = [
      ...new Set(
        paintedStops
          .map((s) => s.visit?.customer?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (!customerIds.length) {
      setPaintedLandmarks([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const byId = new globalThis.Map<
        string,
        {
          id: string;
          type: string;
          latitude: number;
          longitude: number;
          note: string | null;
        }
      >();
      await Promise.all(
        customerIds.map(async (customerId) => {
          let cached = accessCacheRef.current.get(customerId);
          if (!cached) {
            try {
              const r = await apiFetch<{
                landmarks: {
                  id: string;
                  type: string;
                  latitude: number;
                  longitude: number;
                  note: string | null;
                }[];
              }>(`/api/v1/customers/${customerId}/access`);
              cached = { landmarks: r.landmarks ?? [] };
              accessCacheRef.current.set(customerId, cached);
            } catch {
              cached = { landmarks: [] };
            }
          }
          for (const lm of cached.landmarks) {
            byId.set(lm.id, lm);
          }
        }),
      );
      if (!cancelled) setPaintedLandmarks([...byId.values()]);
    })();
    return () => {
      cancelled = true;
    };
  }, [routePainted, paintedStops]);

  // Deep-link /map?employeeId=
  useEffect(() => {
    if (!employeeIdFromUrl || !canSeeLive) return;
    if (deepLinkHandledRef.current === employeeIdFromUrl) return;
    setTeamFilter(employeeIdFromUrl);
    const matchLive = live.find((v) => v.employeeId === employeeIdFromUrl);
    if (matchLive) {
      deepLinkHandledRef.current = employeeIdFromUrl;
      selectVehicle(matchLive, { autoPaint: true, openDrawer: true });
      return;
    }
    const matchRow = snapshot?.live.find((r) => r.employeeId === employeeIdFromUrl);
    if (matchRow) {
      deepLinkHandledRef.current = employeeIdFromUrl;
      selectRosterEmployee(matchRow, { autoPaint: Boolean(matchRow.routeId) });
    }
  }, [
    employeeIdFromUrl,
    live,
    snapshot,
    canSeeLive,
    selectVehicle,
    selectRosterEmployee,
  ]);

  // Deep-link /map?routeId= — pinta plano + trilha congelada
  useEffect(() => {
    if (!routeIdFromUrl || !canSeeLive) return;
    const key = `route:${routeIdFromUrl}`;
    if (deepLinkHandledRef.current === key) return;
    deepLinkHandledRef.current = key;
    setMapLayer('routes');
    setLoadingRoute(true);
    setRouteError(null);
    void fetchRouteDetail(routeIdFromUrl)
      .then((route) => {
        if (!route) {
          setRouteError('Rota não encontrada');
          return;
        }
        setVehicleRoute(route);
        setDrawerView('detail');
        paintRoute(route);
      })
      .catch((e) => {
        setRouteError(e instanceof ApiError ? e.message : 'Falha ao carregar rota');
      })
      .finally(() => setLoadingRoute(false));
  }, [routeIdFromUrl, canSeeLive, fetchRouteDetail, paintRoute]);

  const filteredLive = useMemo(() => {
    if (!teamFilter) return live;
    return live.filter((v) => v.employeeId === teamFilter);
  }, [live, teamFilter]);

  const teamOptions = useMemo(() => {
    const names = new globalThis.Map<string, string>();
    for (const v of live) names.set(v.employeeId, v.employeeName);
    for (const row of snapshot?.live ?? []) names.set(row.employeeId, row.employeeName);
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [live, snapshot]);

  const initialView = useMemo(() => {
    if (pins[0]) {
      return { latitude: pins[0].latitude, longitude: pins[0].longitude, zoom: 12 };
    }
    return BRASIL;
  }, [pins]);

  const routeGeoJson = useMemo(() => {
    if (!paintedGeometry) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: paintedGeometry,
    };
  }, [paintedGeometry]);

  const executedRouteGeoJson = useMemo(() => {
    if (!paintedExecutedGeometry) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: paintedExecutedGeometry,
    };
  }, [paintedExecutedGeometry]);

  const accessPathGeoJson = useMemo(() => {
    const geo = parseGeometryJson(customerAccess?.accessPath?.geometryJson);
    if (!geo?.coordinates?.length) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: geo,
    };
  }, [customerAccess?.accessPath?.geometryJson]);

  async function geocodeSelected() {
    if (selection?.kind !== 'customer') return;
    setGeocoding(true);
    setMsg(null);
    setError(null);
    try {
      const r = await apiFetch<{ customer: MapCustomerPin }>(
        `/api/v1/customers/${selection.pin.id}/geocode`,
        { method: 'POST' },
      );
      setSelection({ kind: 'customer', pin: { ...selection.pin, ...r.customer } });
      setMsg('Geocodificado com sucesso.');
      await loadPins(q, statusFilter);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha no geocode');
    } finally {
      setGeocoding(false);
    }
  }

  const showCustomerPins = mapLayer === 'customers' || mapLayer === 'all';
  const showTeamMarkers = mapLayer === 'team' || mapLayer === 'all';
  const showRouteLayer = mapLayer === 'routes' || mapLayer === 'all';

  const operacaoPanel = (
    <div className="space-y-3 text-sm">
      <h2 className="text-base font-semibold text-brand-900">Operação</h2>
      {!snapshot ? (
        <p className="text-xs text-[var(--muted)]">Carregando resumo do dia…</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-brand-50/80 px-2 py-1.5">
              <dt className="text-[var(--muted)]">Funcionários</dt>
              <dd className="text-lg font-bold text-brand-900">{snapshot.team.total}</dd>
            </div>
            <div className="rounded-lg bg-brand-50/80 px-2 py-1.5">
              <dt className="text-[var(--muted)]">Em rota</dt>
              <dd className="text-lg font-bold text-brand-900">{snapshot.team.inRoute}</dd>
            </div>
            <div className="rounded-lg bg-brand-50/80 px-2 py-1.5">
              <dt className="text-[var(--muted)]">Parado</dt>
              <dd className="text-lg font-bold text-brand-900">{snapshot.team.parado}</dd>
            </div>
            <div className="rounded-lg bg-brand-50/80 px-2 py-1.5">
              <dt className="text-[var(--muted)]">Offline</dt>
              <dd className="text-lg font-bold text-brand-900">{snapshot.team.offline}</dd>
            </div>
            {(snapshot.team.available ?? 0) > 0 ? (
              <div className="rounded-lg bg-brand-50/80 px-2 py-1.5">
                <dt className="text-[var(--muted)]">Disponível</dt>
                <dd className="text-lg font-bold text-brand-900">{snapshot.team.available}</dd>
              </div>
            ) : null}
          </dl>
          <p className="text-xs text-[var(--muted)]">
            Em atendimento:{' '}
            {snapshot.meta.inServiceAvailable ? snapshot.team.inService : '—'}
          </p>
          <p className="text-xs text-[var(--muted)]">
            Ao vivo: {snapshot.team.onlineLive} · Visitas: {snapshot.visits.planned} · Rotas:{' '}
            {snapshot.routes.count}
          </p>
        </>
      )}
    </div>
  );

  const orderedVehicleStops = useMemo(() => {
    if (!vehicleRoute) return [];
    return [...vehicleRoute.stops].sort((a, b) => a.sequence - b.sequence);
  }, [vehicleRoute]);

  const activeRosterRow: OpsLiveRow | null = useMemo(() => {
    if (selection?.kind === 'roster') return selection.row;
    if (selection?.kind === 'vehicle') {
      return (
        snapshot?.live.find((r) => r.employeeId === selection.vehicle.employeeId) ?? null
      );
    }
    return null;
  }, [selection, snapshot]);

  const employeeDetailBody = (() => {
    if (selection?.kind !== 'vehicle' && selection?.kind !== 'roster') return null;

    const name =
      selection.kind === 'vehicle'
        ? selection.vehicle.employeeName
        : selection.row.employeeName;
    const plate =
      selection.kind === 'vehicle'
        ? selection.vehicle.vehiclePlate
        : selection.row.vehiclePlate;
    const isOnline =
      selection.kind === 'vehicle'
        ? selection.vehicle.presence === 'online'
        : selection.row.presence === 'online';
    const lastGps =
      selection.kind === 'vehicle'
        ? new Date(selection.vehicle.recordedAt).toLocaleTimeString('pt-BR')
        : selection.row.minutesWithoutGps != null
          ? `${selection.row.minutesWithoutGps} min sem GPS`
          : '—';
    const routeStatus = vehicleRoute?.status ?? activeRosterRow?.routeStatus ?? null;
    const routeLabel = routeStatus
      ? OPS_ROUTE_STATUS_LABELS[routeStatus] ?? routeStatus
      : 'Sem rota hoje';
    const statusLine = activeRosterRow
      ? opsEmployeeStatusLine(activeRosterRow)
      : selection.kind === 'vehicle'
        ? 'Em rota'
        : 'Offline';

    const nextPendingStop =
      orderedVehicleStops.find((s) => s.status === 'PENDING') ?? null;
    const operationalCode = activeRosterRow?.operational ?? null;
    const operationalLabel = operationalCode
      ? OPS_OPERATIONAL_LABELS[operationalCode] ?? operationalCode
      : statusLine;
    const employeeId =
      selection.kind === 'vehicle'
        ? selection.vehicle.employeeId
        : selection.row.employeeId;

    return (
      <div className="space-y-3">
        <div>
          <p className="text-lg font-semibold text-brand-900">{name}</p>
        </div>

        <dl className="space-y-2 text-xs">
          <div>
            <dt className="ops-label mb-0">
              Status operacional
            </dt>
            <dd className="mt-0.5 font-semibold text-brand-900">{operationalLabel}</dd>
          </div>
          <div>
            <dt className="ops-label mb-0">
              Presença
            </dt>
            <dd className="mt-0.5 font-semibold text-brand-900">
              <span
                className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                  isOnline ? 'bg-emerald-500' : 'bg-brand-200'
                }`}
                aria-hidden
              />
              {isOnline ? 'Online' : 'Offline'}
            </dd>
          </div>
          <div>
            <dt className="ops-label mb-0">
              Rota atual
            </dt>
            <dd className="mt-0.5 font-semibold text-brand-900">{routeLabel}</dd>
          </div>
          <div>
            <dt className="ops-label mb-0">
              Veículo
            </dt>
            <dd className="mt-0.5 font-semibold text-brand-900">{plate ?? '—'}</dd>
          </div>
          <div>
            <dt className="ops-label mb-0">
              Parada atual
            </dt>
            <dd className="mt-0.5 font-semibold text-brand-900">
              {activeRosterRow?.currentCustomerName ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="ops-label mb-0">
              Próxima parada
            </dt>
            <dd className="mt-0.5 font-semibold text-brand-900">
              {nextPendingStop?.visit?.customer?.name ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="ops-label mb-0">
              Localização
            </dt>
            <dd className="mt-0.5 text-brand-800">Último GPS: {lastGps}</dd>
          </div>
        </dl>

        {loadingRoute ? (
          <p className="text-xs text-[var(--muted)]">Carregando paradas da rota…</p>
        ) : null}
        {routeError ? <p className="text-xs text-[var(--danger)]">{routeError}</p> : null}

        {orderedVehicleStops.length > 0 ? (
          <div className="border-t border-brand-100 pt-2">
            <p className="text-xs font-semibold text-brand-800">
              Paradas ({orderedVehicleStops.length})
            </p>
            <ol className="mt-1.5 max-h-40 space-y-1 overflow-auto text-xs">
              {orderedVehicleStops.map((s) => (
                <li key={s.id} className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                    {s.sequence}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium text-brand-900">
                      {s.visit?.customer?.name ?? 'Cliente'}
                    </span>
                    <span className="text-[var(--muted)]">
                      {' '}
                      · {STOP_STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5 border-t border-brand-100 pt-2">
          {vehicleRoute ? (
            routePainted && paintedRouteId === vehicleRoute.id ? (
              <button
                type="button"
                onClick={hideRoutePaint}
                className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-900"
              >
                Ocultar rota
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  paintRoute(
                    vehicleRoute,
                    selection.kind === 'vehicle' ? selection.vehicle : null,
                  )
                }
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Ver rota
              </button>
            )
          ) : mapLayer === 'routes' && !vehicleRoute ? (
            <p className="text-xs text-[var(--muted)]">
              Selecione um funcionário com rota para ver o traçado.
            </p>
          ) : null}
          {canManageEmployees ? (
            <Link
              href={`/employees/${employeeId}`}
              className="rounded-lg border border-brand-200 px-3 py-1.5 text-center text-xs font-semibold text-brand-900"
            >
              Ver funcionário
            </Link>
          ) : null}
        </div>
      </div>
    );
  })();

  const teamListItems = (snapshot?.live ?? []).map((row) => {
    const online = row.presence === 'online';
    const selected =
      selectedEmployeeId === row.employeeId &&
      (selection?.kind === 'vehicle' || selection?.kind === 'roster');
    return (
      <button
        key={row.employeeId}
        type="button"
        onClick={() => selectRosterEmployee(row)}
        className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-xs transition ${
          selected ? 'bg-brand-100 ring-1 ring-brand-300' : 'hover:bg-brand-50'
        }`}
      >
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
            online ? 'bg-emerald-500' : 'bg-brand-200'
          }`}
          aria-hidden
        />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-brand-900">{row.employeeName}</span>
          <span className="block text-[11px] text-[var(--muted)]">
            {row.operational
              ? OPS_OPERATIONAL_LABELS[row.operational] ?? row.operational
              : opsEmployeeStatusLine(row)}
          </span>
        </span>
      </button>
    );
  });

  const customerDetailBody =
    selection?.kind === 'customer' ? (
      loadingCtx ? (
        <p className="text-xs text-[var(--muted)]">Carregando contexto…</p>
      ) : ctx ? (
        <CustomerDetailPanel
          ctx={ctx}
          canCreateService={!!canCreateService}
          geocoding={geocoding}
          onGeocode={() => void geocodeSelected()}
          locationStatus={selection.pin.locationStatus}
          access={customerAccess}
        />
      ) : (
        <div className="space-y-2">
          <p className="font-semibold text-brand-900">{selection.pin.name}</p>
          <p className="text-xs text-[var(--muted)]">Não foi possível carregar o contexto.</p>
          <Link
            href={`/customers/${selection.pin.id}`}
            className="inline-block rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white"
          >
            Abrir cliente
          </Link>
        </div>
      )
    ) : null;

  const railDetailBody =
    selection?.kind === 'customer'
      ? customerDetailBody
      : selection?.kind === 'vehicle' || selection?.kind === 'roster'
        ? employeeDetailBody
        : (
            <div className="space-y-3">
              {operacaoPanel}
              <p className="text-xs text-[var(--muted)]">
                Clique em um cliente no mapa ou selecione um funcionário na lista.
              </p>
            </div>
          );

  const layerButtons: { id: MapLayer; label: string }[] = [
    { id: 'customers', label: 'Clientes' },
    { id: 'team', label: 'Equipe' },
    { id: 'routes', label: 'Rotas' },
    { id: 'all', label: 'Todos' },
  ];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-canvas">
      {/* Toolbar */}
      <form
        className="flex flex-wrap items-end gap-2 border-b border-brand-100 bg-surface px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          void loadPins(q, statusFilter);
        }}
      >
        <label className="flex min-w-[140px] flex-1 flex-col gap-0.5 text-xs">
          <span className="font-medium text-[var(--muted)]">Busca</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cliente"
            className="rounded-lg border border-brand-100 bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="font-medium text-[var(--muted)]">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              void loadPins(q, e.target.value);
            }}
            className="rounded-lg border border-brand-100 bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="font-medium text-[var(--muted)]">Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-brand-100 bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="font-medium text-[var(--muted)]">Equipe</span>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="min-w-[140px] rounded-lg border border-brand-100 bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">Todos ao vivo</option>
            {teamOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="ops-btn ops-btn-secondary">
          Filtrar
        </button>
        <div
          role="group"
          aria-label="Camadas do mapa"
          className="flex flex-wrap gap-1 self-center rounded-lg border border-brand-100 bg-surface p-0.5"
        >
          {layerButtons.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setMapLayer(b.id)}
              className={`rounded-md px-2 py-1 text-xs font-semibold ${
                mapLayer === b.id
                  ? 'bg-brand-600 text-white'
                  : 'text-brand-800 hover:bg-brand-50'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        {canSeeLive ? (
          <>
            <button
              type="button"
              onClick={openTeamList}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-100 bg-surface px-2.5 py-1.5 text-sm font-semibold text-brand-800 md:hidden"
              aria-label="Abrir equipe"
            >
              <span aria-hidden>☰</span>
              Equipe {snapshot?.team.total ?? ''}
            </button>
            <span className="ml-auto self-center rounded-[6px] border border-[var(--border)] bg-[#161618] px-2 py-1 text-xs font-semibold text-brand-800">
              Ao vivo: {showTeamMarkers ? filteredLive.length : 0}
            </span>
          </>
        ) : null}
      </form>

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Map */}
        <div className="relative min-h-0 min-w-0 flex-1" style={{ minHeight: '45vh' }}>
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 text-sm text-brand-800">
              Carregando pins…
            </div>
          ) : null}
          {mapLayer === 'routes' && !routePainted ? (
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-surface px-3 py-2 text-xs text-brand-800 shadow">
              Selecione um funcionário para ver a rota.
            </div>
          ) : null}
          {trailMessage ? (
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-surface px-3 py-2 text-xs text-brand-800 shadow">
              <span className="font-semibold">{trailMessage}</span>
              <span className="mt-0.5 block text-[10px] text-[var(--muted)]">
                Menta = planejado · Âmbar = percorrido
              </span>
            </div>
          ) : null}
          <MapGL
            ref={mapRef}
            initialViewState={initialView}
            mapStyle={mapStyle}
            style={{ width: '100%', height: '100%' }}
            attributionControl
          >
            <NavigationControl position="bottom-right" />

            {showRouteLayer && routeGeoJson ? (
              <Source id="admin-live-route" type="geojson" data={routeGeoJson}>
                <Layer
                  id="admin-live-route-glow"
                  type="line"
                  paint={{
                    'line-color': ROUTE_GLOW,
                    'line-width': 10,
                    'line-opacity': 0.28,
                  }}
                />
                <Layer
                  id="admin-live-route-line"
                  type="line"
                  paint={{
                    'line-color': ROUTE_LINE,
                    'line-width': 4.5,
                    'line-opacity': 0.95,
                  }}
                />
              </Source>
            ) : null}

            {showRouteLayer && executedRouteGeoJson ? (
              <Source id="admin-executed-route" type="geojson" data={executedRouteGeoJson}>
                <Layer
                  id="admin-executed-route-glow"
                  type="line"
                  paint={{
                    'line-color': ROUTE_EXECUTED_GLOW,
                    'line-width': 10,
                    'line-opacity': 0.3,
                  }}
                />
                <Layer
                  id="admin-executed-route-line"
                  type="line"
                  paint={{
                    'line-color': ROUTE_EXECUTED_LINE,
                    'line-width': 4,
                    'line-opacity': 0.95,
                  }}
                />
              </Source>
            ) : null}

            {accessPathGeoJson ? (
              <Source id="customer-access-path" type="geojson" data={accessPathGeoJson}>
                <Layer
                  id="customer-access-path-line"
                  type="line"
                  paint={{
                    'line-color': ROUTE_LINE,
                    'line-width': 4,
                    'line-opacity': 0.85,
                    'line-dasharray': [1.5, 1.2],
                  }}
                />
              </Source>
            ) : null}

            {customerAccess?.landmarks
              ?.filter((lm) => !paintedLandmarks.some((p) => p.id === lm.id))
              .map((lm) => (
                <LandmarkMapMarker
                  key={`lm-${lm.id}`}
                  latitude={lm.latitude}
                  longitude={lm.longitude}
                  type={lm.type}
                  variant="ops"
                />
              ))}

            {routePainted
              ? paintedLandmarks.map((lm) => (
                  <LandmarkMapMarker
                    key={`route-lm-${lm.id}`}
                    latitude={lm.latitude}
                    longitude={lm.longitude}
                    type={lm.type}
                    variant="ops"
                  />
                ))
              : null}

            {showRouteLayer && routePainted
              ? paintedStops.map((s) => (
                  <Marker
                    key={`stop-${s.id}`}
                    latitude={s.latitude}
                    longitude={s.longitude}
                    anchor="bottom"
                  >
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-accent text-[11px] font-bold text-white"
                      aria-label={`${s.sequence}. ${s.visit?.customer?.name ?? 'Parada'}`}
                    >
                      {s.sequence}
                    </div>
                  </Marker>
                ))
              : null}

            {showCustomerPins
              ? pins.map((p) => (
                  <Marker
                    key={p.id}
                    latitude={p.latitude}
                    longitude={p.longitude}
                    anchor="bottom"
                    onClick={(e) => {
                      e.originalEvent.stopPropagation();
                      setSelection({ kind: 'customer', pin: p });
                      setDrawerView('detail');
                      setMobileTab('detalhe');
                      setMsg(null);
                    }}
                  >
                    <button
                      type="button"
                      className={`h-3.5 w-3.5 rounded-full border-2 border-white shadow ${
                        selection?.kind === 'customer' && selection.pin.id === p.id
                          ? 'bg-amber-500'
                          : 'bg-brand-600'
                      }`}
                      aria-label={p.name}
                    />
                  </Marker>
                ))
              : null}
            {showTeamMarkers
              ? filteredLive.map((v) => (
                  <LiveVehicleMarker
                    key={`live-${v.employeeId}`}
                    vehicle={v}
                    onSelect={(vehicle) => {
                      if (
                        routePainted &&
                        paintedRouteId &&
                        paintedRouteId !== vehicle.routeId
                      ) {
                        hideRoutePaint();
                      }
                      selectVehicle(vehicle, { openDrawer: true });
                    }}
                  />
                ))
              : null}
          </MapGL>
        </div>

        {/* Desktop command rail */}
        {canSeeLive ? (
          <aside className="hidden w-[300px] shrink-0 flex-col border-l border-brand-100 bg-surface md:flex">
            <div className="border-b border-brand-100 px-3 py-2">
              <p className="ops-label mb-0">
                {selection?.kind === 'customer'
                  ? 'Cliente'
                  : selection?.kind === 'vehicle' || selection?.kind === 'roster'
                    ? 'Funcionário'
                    : 'Equipe'}
              </p>
              <p className="text-[11px] text-[var(--muted)]">
                {selection
                  ? 'Detalhe operacional'
                  : `${snapshot?.team.total ?? 0} funcionário(s)`}
              </p>
            </div>
            <div className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {selection ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSelection(null);
                      setCtx(null);
                      setVehicleRoute(null);
                    }}
                    className="mb-2 text-xs ops-link"
                  >
                    ← Voltar à equipe
                  </button>
                  {railDetailBody}
                </>
              ) : (
                <>
                  <div className="mb-3">{operacaoPanel}</div>
                  <p className="mb-1 ops-label mb-0">
                    Equipe
                  </p>
                  {teamListItems.length > 0 ? (
                    teamListItems
                  ) : (
                    <p className="px-2 py-4 text-xs text-[var(--muted)]">
                      Nenhum funcionário com login ativo.
                    </p>
                  )}
                </>
              )}
            </div>
          </aside>
        ) : null}

        {/* Mobile bottom tabs */}
        <div className="border-t border-brand-100 bg-surface md:hidden">
          <div className="flex border-b border-brand-100">
            <button
              type="button"
              className={`flex-1 px-3 py-2 text-sm font-semibold ${
                mobileTab === 'equipe'
                  ? 'border-b-2 border-brand-600 text-brand-800'
                  : 'text-[var(--muted)]'
              }`}
              onClick={() => setMobileTab('equipe')}
            >
              Equipe
            </button>
            <button
              type="button"
              className={`flex-1 px-3 py-2 text-sm font-semibold ${
                mobileTab === 'detalhe'
                  ? 'border-b-2 border-brand-600 text-brand-800'
                  : 'text-[var(--muted)]'
              }`}
              onClick={() => setMobileTab('detalhe')}
            >
              Detalhe
            </button>
          </div>
          <div className="max-h-[38vh] overflow-auto p-3">
            {mobileTab === 'equipe' ? (
              <div className="space-y-0.5">
                {teamListItems.length > 0 ? (
                  teamListItems
                ) : (
                  <p className="px-2 py-4 text-xs text-[var(--muted)]">
                    Nenhum funcionário com login ativo.
                  </p>
                )}
              </div>
            ) : (
              railDetailBody
            )}
          </div>
        </div>
      </div>

      {/* Drawer hambúrguer — equipe / detalhe */}
      {drawerView !== 'closed' ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar painel"
            onClick={closeDrawer}
          />
          <aside
            className="absolute inset-y-0 right-0 flex w-[min(100%,320px)] flex-col bg-surface shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={
              drawerView === 'list'
                ? 'Equipe'
                : activeRosterRow?.employeeName ??
                  (selection?.kind === 'vehicle'
                    ? selection.vehicle.employeeName
                    : selection?.kind === 'customer'
                      ? selection.pin.name
                      : 'Detalhe')
            }
          >
            <div className="flex items-center justify-between border-b border-brand-100 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                {drawerView === 'detail' ? (
                  <button
                    type="button"
                    className="ops-btn ops-btn-ghost text-sm"
                    onClick={() => setDrawerView('list')}
                  >
                    ← Equipe
                  </button>
                ) : null}
                <p className="truncate text-base font-semibold text-brand-900">
                  {drawerView === 'list'
                    ? 'Equipe'
                    : selection?.kind === 'customer'
                      ? 'Cliente'
                      : 'Funcionário'}
                </p>
              </div>
              <button
                type="button"
                className="ops-btn ops-btn-ghost text-sm"
                onClick={closeDrawer}
              >
                Fechar
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {drawerView === 'list' ? (
                <div className="space-y-0.5">
                  {teamListItems.length > 0 ? (
                    teamListItems
                  ) : (
                    <p className="px-2 py-4 text-xs text-[var(--muted)]">
                      Nenhum funcionário com login ativo.
                    </p>
                  )}
                </div>
              ) : (
                railDetailBody ?? (
                  <p className="text-xs text-[var(--muted)]">Selecione um item.</p>
                )
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function CustomerDetailPanel({
  ctx,
  canCreateService,
  geocoding,
  onGeocode,
  locationStatus,
  access,
}: {
  ctx: CustomerOpsContext;
  canCreateService: boolean;
  geocoding: boolean;
  onGeocode: () => void;
  locationStatus: string;
  access: {
    accessPath: { id: string; distanceMeters: number | null } | null;
    landmarks: { id: string; type: string }[];
  } | null;
}) {
  const s = ctx.customer.summary;
  const m = ctx.customer.metrics;

  return (
    <div className="space-y-3">
      <div>
        <p className="ops-label mb-0">Cliente</p>
        <p className="text-lg font-semibold text-brand-900">{s.name}</p>
        {s.document ? (
          <p className="font-mono text-xs text-[var(--muted)]">{s.document}</p>
        ) : null}
        <p className="text-xs text-[var(--muted)]">
          {[s.city, s.state].filter(Boolean).join(' / ') || 'Endereço —'}
        </p>
      </div>

      {access ? (
        <div className="rounded-[8px] border border-[var(--border)] bg-[#161618] px-3 py-2 text-xs">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Acesso à fazenda
          </p>
          <p className="mt-1 font-semibold text-brand-900">
            {access.accessPath
              ? `Trilha gravada${
                  access.accessPath.distanceMeters != null
                    ? ` · ${formatMetersKm(access.accessPath.distanceMeters)}`
                    : ''
                }`
              : 'Sem trilha de acesso'}
          </p>
          <p className="text-[var(--muted)]">
            Marcos: {access.landmarks?.length ?? 0}
          </p>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="ops-label mb-0">
            Categoria
          </dt>
          <dd className="font-semibold">—</dd>
        </div>
        <div>
          <dt className="ops-label mb-0">
            Prioridade
          </dt>
          <dd className="font-semibold">{s.priority ?? '—'}</dd>
        </div>
        <div>
          <dt className="ops-label mb-0">Status</dt>
          <dd className="font-semibold">{s.status}</dd>
        </div>
        <div>
          <dt className="ops-label mb-0">
            OS abertas
          </dt>
          <dd className="font-semibold">{m.openServiceOrders}</dd>
        </div>
      </dl>

      <div className="border-t border-brand-100 pt-2">
        <p className="ops-label mb-0">Visita</p>
        <p className="mt-1 text-sm font-semibold text-brand-900">
          {m.nextVisitAt ? formatOpsDate(m.nextVisitAt) : '—'}
        </p>
        <p className="text-xs text-[var(--muted)]">
          Última: {formatOpsDay(m.lastVisitAt)} · Total: {m.visitsTotal}
        </p>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-brand-100 pt-2">
        {ctx.customer.acoes
          .filter((a) => a.enabled && a.href && (a.id !== 'create_os' || canCreateService))
          .map((a) => (
            <Link
              key={a.id}
              href={a.href!}
              className={`rounded-lg px-3 py-1.5 text-center text-xs font-semibold ${
                a.id === 'open_record'
                  ? 'bg-brand-600 text-white'
                  : 'border border-brand-200 text-brand-900'
              }`}
            >
              {a.id === 'open_record'
                ? 'Abrir cliente'
                : a.id === 'create_os'
                  ? 'Abrir OS'
                  : a.label}
            </Link>
          ))}
        {(locationStatus === 'PENDING' || locationStatus === 'FAILED') && canCreateService ? (
          <button
            type="button"
            disabled={geocoding}
            onClick={onGeocode}
            className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium disabled:opacity-60"
          >
            {geocoding ? 'Geocodificando…' : 'Geocodificar endereço'}
          </button>
        ) : null}
      </div>

      {ctx.nearby.length > 0 ? (
        <div className="border-t border-brand-100 pt-2">
          <h3 className="text-xs font-semibold text-brand-900">Clientes próximos</h3>
          <ul className="mt-1.5 space-y-1">
            {ctx.nearby.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-brand-800">{n.name}</span>
                <span className="shrink-0 text-[var(--muted)]">
                  {formatMetersKm(n.distanceMeters)}
                </span>
                {canCreateService ? (
                  <Link
                    href={`/routes?customerId=${n.id}`}
                    className="shrink-0 ops-link"
                  >
                    + rota
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ctx.customer.timeline.length > 0 ? (
        <div className="border-t border-brand-100 pt-2">
          <h3 className="text-xs font-semibold text-brand-900">Últimas interações</h3>
          <ul className="mt-1.5 space-y-1.5">
            {ctx.customer.timeline.map((t, i) => (
              <li key={`${t.at}-${i}`} className="text-xs">
                <span className="font-medium text-brand-800">
                  {new Date(t.at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </span>
                <span className="text-[var(--muted)]">
                  {' '}
                  · {t.title}
                  {t.actorName ? ` — ${t.actorName}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
