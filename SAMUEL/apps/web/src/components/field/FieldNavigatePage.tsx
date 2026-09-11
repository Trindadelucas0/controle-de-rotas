'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import MapGL, { Layer, Marker, Source } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiFetch, ApiError } from '@/lib/api-client';
import {
  gpsActiveLabel,
  gpsCatchMessage,
  geolocationErrorMessage,
  isInsecureGeolocationContext,
  isTransientGeolocationError,
  requestCurrentPosition,
  startRouteGpsWatch,
  trackingErrorMessage,
  TRACK_RECORD_TRIP_INTERVAL_MS,
  TRACK_RECORD_TRIP_MIN_MOVE_M,
  type RouteGpsWatchHandle,
} from '@/lib/field-tracking';
import {
  enqueueLandmark,
  peekLandmarkQueue,
  prependLandmarkQueue,
  takeLandmarkQueue,
} from '@/lib/field-landmark-queue';
import { toDateInputValue } from '@/lib/ops-labels';
import { cartoDarkRasterStyle, ROUTE_GLOW, ROUTE_LINE } from '@/lib/map-style';
import {
  formatDistanceKm,
  formatDuration,
  formatEta,
  clipLineToNextStop,
  flattenSteps,
  haversineMeters,
  laneHintFromModifier,
  laneIndicationDeg,
  maneuverArrowDeg,
  maneuverInstruction,
  metersUntilManeuver,
  NEAR_STOP_M,
  OFF_ROUTE_M,
  parseGeometryJson,
  parsePlannedStepsJson,
  remainingFromCurrentPosition,
  LIVE_SPEED_MIN_M_S,
  speedKmh,
  upcomingManeuver,
  type LngLat,
  type PlannedNavLane,
  type PlannedNavStep,
} from '@/lib/nav-geometry';
import { LivePositionMarker } from '@/components/map/LivePositionMarker';
import {
  LandmarkMapMarker,
  LANDMARK_LABELS,
  type LandmarkType,
} from '@/components/map/LandmarkMapMarker';
import { useSmoothedLngLat, type LngLatTarget } from '@/hooks/useSmoothedLngLat';
import { SlideToComplete } from '@/components/field/SlideToComplete';
import { CompleteRouteConfirm } from '@/components/field/CompleteRouteConfirm';
import {
  canCompleteAsFinished,
  hasOpenVisitOnStops,
  remainingPlannedMeters,
} from '@/lib/route-complete';

const NAV_FOLLOW_ZOOM = 16;
const NAV_FOLLOW_MIN_ZOOM = 15;
/** Desloca o centro “para frente” no ecrã — carro fica mais abaixo, rua à frente visível. */
const CAMERA_LOOK_AHEAD_PX = 60;
/** Atualiza o texto “GPS ativo · HH:MM:SS” no máximo a cada N ms. */
const GPS_HINT_CLOCK_MS = 15_000;
/** Off-route sustentado: samples + tempo antes de pedir OSRM de novo. */
const OFF_ROUTE_SAMPLES = 2;
const OFF_ROUTE_HOLD_MS = 2_500;
const REROUTE_COOLDOWN_MS = 8_000;
const LANDMARK_PROXIMITY_M = 120;
const LANDMARK_COOLDOWN_MS = 5 * 60 * 1000;

type CustomerLandmark = {
  id: string;
  type: LandmarkType;
  latitude: number;
  longitude: number;
  note: string | null;
};

/** Polyline restante — menta, só no traçado. */
const NAV_ROUTE_GLOW = ROUTE_GLOW;
const NAV_ROUTE_LINE = ROUTE_LINE;

type RouteStop = {
  id: string;
  sequence: number;
  status: string;
  latitude: number;
  longitude: number;
  plannedDistanceMeters?: number | null;
  landmarks?: CustomerLandmark[];
  accessPath?: { id: string; geometryJson: unknown; distanceMeters: number | null } | null;
  visit: {
    id: string;
    status?: string;
    customer: { id: string; name: string };
    serviceOrder: { id: string; number: number; title: string };
  };
};

type NavRoute = {
  id: string;
  status: string;
  date: string;
  startedAt?: string | null;
  recordTrip?: boolean;
  plannedDistanceMeters?: number | null;
  plannedDurationSeconds?: number | null;
  plannedGeometryJson?: unknown;
  plannedStepsJson?: unknown;
  originLatitude?: number;
  originLongitude?: number;
  vehicle: { id: string; plate: string; brand: string | null; model: string | null } | null;
  employee: { id: string; name: string } | null;
  stops: RouteStop[];
};

type GpsState = {
  latitude: number;
  longitude: number;
  heading: number | null;
  speedMs: number | null;
  accuracy: number | null;
};

/** Centro do mapa ligeiramente à frente do carro (em px de ecrã, com bearing atual). */
function cameraCenterWithLookAhead(
  map: MapLibreMap,
  lat: number,
  lng: number,
  pixelsAhead: number,
): [number, number] {
  const pt = map.project([lng, lat]);
  const ll = map.unproject([pt.x, pt.y - pixelsAhead]);
  return [ll.lng, ll.lat];
}

function resolveFollowBearing(
  map: MapLibreMap,
  heading: number | null | undefined,
  speedMs: number | null | undefined,
  forceRotate: boolean,
): number {
  if (heading == null || !Number.isFinite(heading)) {
    return map.getBearing();
  }
  if (forceRotate || (speedMs ?? 0) > 0.5) {
    return heading;
  }
  return map.getBearing();
}

function ManeuverArrow({ deg }: { deg: number }) {
  return (
    <span
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/20 text-current"
      aria-hidden
      style={{ transform: `rotate(${deg}deg)` }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 4L12 20M12 4L6 10M12 4L18 10"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function LaneArrowIcon({ deg, valid }: { deg: number; valid: boolean }) {
  return (
    <span
      className={`inline-flex h-8 w-7 items-center justify-center rounded-md ${
        valid ? 'bg-white/25 text-white' : 'bg-white/5 text-white/35'
      }`}
      aria-hidden
      style={{ transform: `rotate(${deg}deg)` }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 4L12 20M12 4L6 10M12 4L18 10"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function LaneGuidance({
  step,
  metersUntil,
}: {
  step: PlannedNavStep | null;
  metersUntil: number;
}) {
  if (!step) return null;
  const type = (step.maneuver?.type || '').toLowerCase();
  if (type === 'arrive') return null;

  const lanes: PlannedNavLane[] | null =
    Array.isArray(step.lanes) && step.lanes.length ? step.lanes : null;
  const hint = !lanes ? laneHintFromModifier(step) : null;
  const distLabel =
    Number.isFinite(metersUntil) && metersUntil > 0
      ? `em ${formatDistanceKm(metersUntil)}`
      : null;

  if (!lanes && !hint && !distLabel) return null;

  const ariaParts = [
    lanes
      ? `Faixas: ${lanes.filter((l) => l.valid).length} de ${lanes.length} válidas`
      : hint,
    distLabel,
  ].filter(Boolean);

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-2"
      aria-label={ariaParts.join(' · ')}
    >
      {lanes ? (
        <div className="flex items-center gap-1" role="img" aria-hidden>
          {lanes.map((lane, i) => (
            <LaneArrowIcon
              key={`${i}-${lane.indications.join(',')}-${lane.valid}`}
              deg={laneIndicationDeg(lane.indications[0])}
              valid={lane.valid}
            />
          ))}
        </div>
      ) : hint ? (
        <p className="text-xs font-semibold tracking-wide opacity-90">{hint}</p>
      ) : null}
      {distLabel ? (
        <p className="text-xs font-medium opacity-75">{distLabel}</p>
      ) : null}
    </div>
  );
}

export function FieldNavigatePage() {
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);
  const watchRef = useRef<RouteGpsWatchHandle | null>(null);
  const followRef = useRef(true);
  const userPanningRef = useRef(false);
  const initialCenterDoneRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastHeadingRef = useRef<number | null>(null);
  const lastGoodSpeedMsRef = useRef<number | null>(null);
  const lastGpsAtRef = useRef<number | null>(null);
  const lastCameraRef = useRef<{ lat: number; lng: number; heading: number | null } | null>(
    null,
  );
  const lastHintAtRef = useRef(0);
  const gpsRef = useRef<GpsState | null>(null);
  const startWatchingRef = useRef<(routeId: string) => void>(() => undefined);
  const orderedStopsRef = useRef<RouteStop[]>([]);
  const initialRerouteDoneRef = useRef(false);
  const hasReorderedRef = useRef(false);
  const offRouteSinceRef = useRef<number | null>(null);
  const offRouteSamplesRef = useRef(0);
  const lastRerouteAtRef = useRef(0);
  const recalculatingRef = useRef(false);

  const [route, setRoute] = useState<NavRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gps, setGps] = useState<GpsState | null>(null);
  const [follow, setFollow] = useState(true);
  const [gpsHint, setGpsHint] = useState('Aguardando GPS…');
  const [gpsBlocked, setGpsBlocked] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [rerouteError, setRerouteError] = useState<string | null>(null);
  const [proximityLandmark, setProximityLandmark] = useState<CustomerLandmark | null>(null);
  const [landmarkBusy, setLandmarkBusy] = useState(false);
  const [landmarkMsg, setLandmarkMsg] = useState<string | null>(null);
  const [trackStats, setTrackStats] = useState({ queued: 0, posted: 0, trail: 0 });
  const landmarkCooldownRef = useRef<globalThis.Map<string, number>>(new globalThis.Map());
  const routeFitDoneRef = useRef(false);

  useEffect(() => {
    followRef.current = follow;
  }, [follow]);

  const geometry = useMemo(
    () => parseGeometryJson(route?.plannedGeometryJson),
    [route?.plannedGeometryJson],
  );
  const plannedSteps = useMemo(
    () => parsePlannedStepsJson(route?.plannedStepsJson),
    [route?.plannedStepsJson],
  );
  const flatSteps = useMemo(() => flattenSteps(plannedSteps), [plannedSteps]);
  const lineCoords: LngLat[] = geometry?.coordinates ?? [];

  const pendingStops = useMemo(
    () =>
      [...(route?.stops ?? [])]
        .filter((s) => s.status === 'PENDING')
        .sort((a, b) => a.sequence - b.sequence),
    [route?.stops],
  );

  const orderedStops = useMemo(
    () => [...(route?.stops ?? [])].sort((a, b) => a.sequence - b.sequence),
    [route?.stops],
  );
  orderedStopsRef.current = orderedStops;

  useEffect(() => {
    gpsRef.current = gps;
  }, [gps]);

  const nextStop = useMemo(() => {
    if (!pendingStops.length) return null;
    if (!gps) return pendingStops[0];
    for (const s of pendingStops) {
      const d = haversineMeters(gps, s);
      if (d > 40) return s;
    }
    return pendingStops[pendingStops.length - 1];
  }, [pendingStops, gps]);

  const remainingStops = useMemo(() => {
    if (!pendingStops.length) return [];
    if (!nextStop) return pendingStops;
    const idx = pendingStops.findIndex((s) => s.id === nextStop.id);
    return idx >= 0 ? pendingStops.slice(idx) : pendingStops;
  }, [pendingStops, nextStop]);

  const progress = useMemo(() => {
    // Sem GPS: não inventar restante com a rota inteira (causava 2000+ km / 24 h no HUD)
    if (!gps) {
      return {
        alongMeters: 0,
        offRouteMeters: 0,
        remainingDistance: null as number | null,
        remainingDuration: null as number | null,
        currentStep: null,
        offRoute: false,
      };
    }
    const rem = remainingFromCurrentPosition({
      gps,
      lineCoords,
      flatSteps,
      nextStop,
      remainingStops,
      plannedDistanceMeters: route?.plannedDistanceMeters,
      plannedDurationSeconds: route?.plannedDurationSeconds,
      speedMs: gps.speedMs,
      lastGoodSpeedMs: lastGoodSpeedMsRef.current,
    });
    return {
      ...rem,
      remainingDistance: rem.remainingDistance,
      remainingDuration: rem.remainingDuration,
    };
  }, [
    gps,
    lineCoords,
    flatSteps,
    nextStop,
    remainingStops,
    route?.plannedDistanceMeters,
    route?.plannedDurationSeconds,
  ]);

  const arriving = Boolean(gps && nextStop && haversineMeters(gps, nextStop) <= NEAR_STOP_M);

  const routeLandmarks = useMemo(() => {
    const stops = route?.stops ?? [];
    const byId = new globalThis.Map<string, CustomerLandmark>();
    for (const s of stops) {
      for (const lm of s.landmarks ?? []) {
        byId.set(lm.id, lm);
      }
    }
    return [...byId.values()];
  }, [route?.stops]);

  useEffect(() => {
    if (!gps || !routeLandmarks.length) {
      setProximityLandmark(null);
      return;
    }
    const now = Date.now();
    let nearest: { lm: CustomerLandmark; d: number } | null = null;
    for (const lm of routeLandmarks) {
      const d = haversineMeters(gps, lm);
      if (d > LANDMARK_PROXIMITY_M) continue;
      const coolUntil = landmarkCooldownRef.current.get(lm.id) ?? 0;
      if (now < coolUntil) continue;
      if (!nearest || d < nearest.d) nearest = { lm, d };
    }
    setProximityLandmark(nearest?.lm ?? null);
  }, [gps, routeLandmarks]);

  async function dismissProximity() {
    if (proximityLandmark) {
      landmarkCooldownRef.current.set(proximityLandmark.id, Date.now() + LANDMARK_COOLDOWN_MS);
    }
    setProximityLandmark(null);
  }

  const flushLandmarkQueue = useCallback(async () => {
    const pending = takeLandmarkQueue();
    if (!pending.length) return;
    const failed: typeof pending = [];
    for (const item of pending) {
      try {
        const r = await apiFetch<{ landmark: CustomerLandmark }>(
          `/api/v1/customers/${item.customerId}/landmarks`,
          {
            method: 'POST',
            body: JSON.stringify({
              type: item.type,
              latitude: item.latitude,
              longitude: item.longitude,
            }),
          },
        );
        setRoute((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            stops: prev.stops.map((s) =>
              s.visit.customer.id === item.customerId
                ? { ...s, landmarks: [...(s.landmarks ?? []), r.landmark] }
                : s,
            ),
          };
        });
      } catch {
        failed.push(item);
      }
    }
    if (failed.length) prependLandmarkQueue(failed);
  }, []);

  useEffect(() => {
    const kick = () => {
      if (peekLandmarkQueue().length) void flushLandmarkQueue();
    };
    document.addEventListener('visibilitychange', kick);
    window.addEventListener('online', kick);
    kick();
    return () => {
      document.removeEventListener('visibilitychange', kick);
      window.removeEventListener('online', kick);
    };
  }, [flushLandmarkQueue]);

  async function markLandmark(type: LandmarkType) {
    if (!route?.recordTrip || !gps || !nextStop || landmarkBusy) return;
    const customerId = nextStop.visit.customer.id;
    const body = {
      type,
      latitude: gps.latitude,
      longitude: gps.longitude,
    };
    setLandmarkBusy(true);
    setLandmarkMsg(null);
    try {
      const r = await apiFetch<{ landmark: CustomerLandmark }>(
        `/api/v1/customers/${customerId}/landmarks`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      );
      setRoute((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stops: prev.stops.map((s) =>
            s.id === nextStop.id
              ? { ...s, landmarks: [...(s.landmarks ?? []), r.landmark] }
              : s,
          ),
        };
      });
      setLandmarkMsg(`${LANDMARK_LABELS[type]} marcada`);
      void flushLandmarkQueue();
    } catch (e) {
      enqueueLandmark({
        customerId,
        type,
        latitude: gps.latitude,
        longitude: gps.longitude,
      });
      setLandmarkMsg(
        e instanceof ApiError
          ? `${e.message} — marco guardado para reenviar`
          : 'Falha ao marcar marco — guardado para reenviar',
      );
    } finally {
      setLandmarkBusy(false);
    }
  }

  /** Fix impreciso demais não conta como fora da rota (evita falso positivo). */
  const gpsAccuracyOk =
    gps == null ||
    gps.accuracy == null ||
    !Number.isFinite(gps.accuracy) ||
    gps.accuracy <= OFF_ROUTE_M;
  const effectivelyOffRoute = Boolean(progress.offRoute && gpsAccuracyOk);

  const nextManeuver = useMemo(
    () => (gps ? upcomingManeuver(flatSteps, progress.alongMeters) : null),
    [gps, flatSteps, progress.alongMeters],
  );
  const untilManeuverM = useMemo(
    () => metersUntilManeuver(nextManeuver, progress.alongMeters),
    [nextManeuver, progress.alongMeters],
  );

  const smoothedGps = useSmoothedLngLat(
    gps
      ? {
          latitude: gps.latitude,
          longitude: gps.longitude,
          heading: gps.heading,
        }
      : null,
    400,
  );
  const markerHeading = smoothedGps?.heading ?? gps?.heading ?? 0;

  const showManeuverBanner =
    !recalculating && !rerouteError && !arriving && !effectivelyOffRoute;

  const bannerText = recalculating
    ? 'Recalculando a partir da sua posição…'
    : rerouteError
      ? rerouteError
      : arriving && nextStop
        ? `Chegando em ${nextStop.visit.customer.name}`
        : effectivelyOffRoute && gps && nextStop
          ? `Fora da rota — ${formatDistanceKm(haversineMeters(gps, nextStop))} até ${nextStop.visit.customer.name}`
          : effectivelyOffRoute
            ? 'Fora da rota — aguardando recálculo'
            : maneuverInstruction(nextManeuver ?? progress.currentStep);

  const arrowDeg = arriving
    ? 0
    : maneuverArrowDeg(nextManeuver ?? progress.currentStep);
  const speed = speedKmh(gps?.speedMs);

  const requestReroute = useCallback(
    async (routeId: string, pos: GpsState, reorderRemaining: boolean) => {
      if (recalculatingRef.current) return;
      recalculatingRef.current = true;
      setRecalculating(true);
      setRerouteError(null);
      try {
        const r = await apiFetch<{ route: NavRoute }>(`/api/v1/routes/${routeId}/reroute`, {
          method: 'POST',
          body: JSON.stringify({
            latitude: pos.latitude,
            longitude: pos.longitude,
            reorderRemaining,
          }),
        });
        setRoute(r.route);
        lastRerouteAtRef.current = Date.now();
        offRouteSinceRef.current = null;
        offRouteSamplesRef.current = 0;
        if (reorderRemaining) hasReorderedRef.current = true;
        setRerouteError(null);
      } catch (e) {
        setRerouteError(
          e instanceof ApiError ? e.message : 'Não foi possível recalcular a rota',
        );
      } finally {
        recalculatingRef.current = false;
        setRecalculating(false);
      }
    },
    [],
  );

  // 1º fix GPS: sempre recalcula a partir da posição atual (elimina U-turn da origem publicada).
  useEffect(() => {
    if (!gps || !route || route.status !== 'IN_PROGRESS') return;
    if (initialRerouteDoneRef.current || recalculatingRef.current) return;

    initialRerouteDoneRef.current = true;
    void requestReroute(route.id, gps, true);
  }, [gps, route, requestReroute]);

  // Off-route sustentado: redesenha traçado; reordena só se o 1º recálculo ainda não rodou.
  useEffect(() => {
    if (!gps || !route || route.status !== 'IN_PROGRESS') return;
    if (!initialRerouteDoneRef.current || recalculating) return;

    if (!effectivelyOffRoute) {
      offRouteSinceRef.current = null;
      offRouteSamplesRef.current = 0;
      return;
    }

    offRouteSamplesRef.current += 1;
    if (offRouteSinceRef.current == null) {
      offRouteSinceRef.current = Date.now();
    }

    const heldMs = Date.now() - (offRouteSinceRef.current ?? Date.now());
    const sustained =
      offRouteSamplesRef.current >= OFF_ROUTE_SAMPLES && heldMs >= OFF_ROUTE_HOLD_MS;
    const cooled = Date.now() - lastRerouteAtRef.current >= REROUTE_COOLDOWN_MS;

    if (sustained && cooled) {
      void requestReroute(route.id, gps, !hasReorderedRef.current);
    }
  }, [gps, route, effectivelyOffRoute, recalculating, requestReroute]);

  const stopWatch = useCallback(() => {
    watchRef.current?.stop();
    watchRef.current = null;
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } catch {
      // best-effort
    }
    wakeLockRef.current = null;
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {
      // best-effort — alguns browsers negam em background
    }
  }, []);

  const followCamera = useCallback(
    (target: LngLatTarget, opts?: { initial?: boolean; force?: boolean }) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const speedMs = gpsRef.current?.speedMs;
      const bearing = resolveFollowBearing(
        map,
        target.heading,
        speedMs,
        Boolean(opts?.force || opts?.initial),
      );

      if (opts?.initial && !initialCenterDoneRef.current) {
        initialCenterDoneRef.current = true;
        routeFitDoneRef.current = true;
        const [centerLng, centerLat] = cameraCenterWithLookAhead(
          map,
          target.latitude,
          target.longitude,
          CAMERA_LOOK_AHEAD_PX,
        );
        map.jumpTo({
          center: [centerLng, centerLat],
          zoom: NAV_FOLLOW_ZOOM,
          bearing,
        });
        lastCameraRef.current = {
          lat: target.latitude,
          lng: target.longitude,
          heading: target.heading ?? null,
        };
        setFollow(true);
        return;
      }

      const [centerLng, centerLat] = cameraCenterWithLookAhead(
        map,
        target.latitude,
        target.longitude,
        CAMERA_LOOK_AHEAD_PX,
      );

      map.jumpTo({
        center: [centerLng, centerLat],
        zoom: Math.max(map.getZoom(), NAV_FOLLOW_MIN_ZOOM),
        bearing,
      });
      lastCameraRef.current = {
        lat: target.latitude,
        lng: target.longitude,
        heading: target.heading ?? null,
      };
    },
    [],
  );

  const applyGpsFix = useCallback(
    (pos: GeolocationPosition) => {
      const heading =
        pos.coords.heading != null && Number.isFinite(pos.coords.heading)
          ? pos.coords.heading
          : lastHeadingRef.current;
      if (heading != null) lastHeadingRef.current = heading;

      const now = pos.timestamp || Date.now();
      const prev = gpsRef.current;
      let speedMs =
        pos.coords.speed != null && Number.isFinite(pos.coords.speed) && pos.coords.speed >= 0
          ? pos.coords.speed
          : null;
      if (speedMs == null && prev && lastGpsAtRef.current != null) {
        const dt = (now - lastGpsAtRef.current) / 1000;
        if (dt > 0.4 && dt < 30) {
          const moved = haversineMeters(prev, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          speedMs = moved / dt;
        }
      }
      lastGpsAtRef.current = now;
      if (speedMs != null && speedMs >= LIVE_SPEED_MIN_M_S) {
        lastGoodSpeedMsRef.current = speedMs;
      }

      const next: GpsState = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        heading,
        speedMs,
        accuracy: pos.coords.accuracy,
      };

      const moved =
        prev != null ? haversineMeters(prev, next) : Number.POSITIVE_INFINITY;
      const speedChanged =
        Math.abs((next.speedMs ?? 0) - (prev?.speedMs ?? 0)) >= 0.5;
      if (!prev || moved >= 2 || speedChanged) {
        gpsRef.current = next;
        setGps(next);
      }

      const hintAt = Date.now();
      if (hintAt - lastHintAtRef.current >= GPS_HINT_CLOCK_MS) {
        lastHintAtRef.current = hintAt;
        setGpsHint(gpsActiveLabel());
      }
      setGpsBlocked(false);
    },
    [],
  );

  const startWatching = useCallback(
    (routeId: string) => {
      if (!navigator.geolocation) {
        setGpsBlocked(true);
        setGpsHint('Geolocation indisponível neste dispositivo');
        return;
      }

      const insecure = isInsecureGeolocationContext();
      if (insecure) {
        setGpsBlocked(true);
        setGpsHint(
          'GPS bloqueado em HTTP. No iPhone use HTTPS (túnel) ou teste em localhost no computador.',
        );
        return;
      }

      stopWatch();
      setGpsBlocked(false);
      if (!gpsRef.current) {
        setGpsHint('Procurando GPS…');
      }

      // Browser → seed coarse + watchPosition → POST /tracking/points → Redis + PostGIS
      watchRef.current = startRouteGpsWatch(
        routeId,
        {
          onPosition: (pos) => applyGpsFix(pos),
          onPosted: () => {
            lastHintAtRef.current = Date.now();
            setGpsHint(gpsActiveLabel());
          },
          onQueueChange: (stats) => setTrackStats(stats),
          onPostError: (e) => setGpsHint(trackingErrorMessage(e)),
          onError: (err) => {
            if (err.code === 1) {
              setGpsBlocked(true);
              setGpsHint(geolocationErrorMessage(err));
              stopWatch();
              return;
            }
            // TIMEOUT/UNAVAILABLE com posição já obtida: não derruba a UI
            if (isTransientGeolocationError(err) && gpsRef.current) {
              return;
            }
            // Após fallback coarse falhar (sem fix): overlay
            setGpsBlocked(true);
            setGpsHint(geolocationErrorMessage(err));
          },
        },
        route?.recordTrip
          ? {
              maxIntervalMs: TRACK_RECORD_TRIP_INTERVAL_MS,
              minMoveM: TRACK_RECORD_TRIP_MIN_MOVE_M,
            }
          : {},
      );
    },
    [stopWatch, applyGpsFix, route?.recordTrip],
  );

  const retryGps = useCallback(async () => {
    if (!route?.id) return;
    if (isInsecureGeolocationContext()) {
      setGpsBlocked(true);
      setGpsHint(
        'GPS bloqueado em HTTP. No iPhone use HTTPS (túnel) ou teste em localhost no computador.',
      );
      return;
    }
    setGpsBlocked(false);
    setGpsHint('Procurando GPS…');
    try {
      const pos = await requestCurrentPosition();
      applyGpsFix(pos);
    } catch (e) {
      setGpsBlocked(true);
      setGpsHint(gpsCatchMessage(e));
    }
    startWatching(route.id);
  }, [route?.id, applyGpsFix, startWatching]);

  startWatchingRef.current = startWatching;

  const fitRouteOverview = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (
      !map ||
      routeFitDoneRef.current ||
      initialCenterDoneRef.current ||
      gpsRef.current
    ) {
      return;
    }

    const lngs: number[] = [];
    const lats: number[] = [];
    for (const c of lineCoords) {
      lngs.push(c[0]);
      lats.push(c[1]);
    }
    for (const s of orderedStopsRef.current) {
      lngs.push(s.longitude);
      lats.push(s.latitude);
    }
    if (route?.originLongitude != null && route?.originLatitude != null) {
      lngs.push(route.originLongitude);
      lats.push(route.originLatitude);
    }
    if (!lngs.length) return;

    routeFitDoneRef.current = true;
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 72, maxZoom: 15, duration: 400 },
    );
  }, [lineCoords, route?.originLatitude, route?.originLongitude]);

  useEffect(() => {
    if (!mapReady || gps || !route) return;
    fitRouteOverview();
  }, [mapReady, gps, route, fitRouteOverview]);

  // 1º center: GPS bruto (não espera interpolação). Depois acompanha o ícone suave.
  useEffect(() => {
    if (!mapReady || !follow || userPanningRef.current) return;
    const rawTarget = gps
      ? {
          latitude: gps.latitude,
          longitude: gps.longitude,
          heading: gps.heading,
        }
      : null;
    const target = smoothedGps ?? rawTarget;
    if (!target) return;
    if (!initialCenterDoneRef.current) {
      followCamera(target, { initial: true });
      return;
    }
    if (!smoothedGps) return;
    followCamera(smoothedGps);
  }, [mapReady, smoothedGps, gps, follow, followCamera]);

  useEffect(() => {
    if (route?.status !== 'IN_PROGRESS') return;
    void requestWakeLock();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void releaseWakeLock();
    };
  }, [route?.status, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    if (route?.status !== 'IN_PROGRESS') return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const onPopState = () => {
      const ok = window.confirm(
        'Sair da navegação? A rota continua em andamento até você concluir em Minha rota.',
      );
      if (!ok) {
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [route?.status]);

  // Mount: busca rota ativa.
  // Nunca usar loadOnceRef + cancel no cleanup: no Strict Mode (dev) o 1º fetch
  // é cancelado e o 2º não roda → "Abrindo navegação…" para sempre.
  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      setLoading((still) => {
        if (!still) return still;
        setError('Demorou demais para abrir a navegação. Verifique a conexão e tente de novo.');
        return false;
      });
    }, 20_000);

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const dateYmd = toDateInputValue();
        const r = await apiFetch<{ routes?: NavRoute[]; route: NavRoute | null }>(
          `/api/v1/field/my-route?date=${encodeURIComponent(dateYmd)}`,
        );
        if (cancelled) return;
        const active =
          r.routes?.find((x) => x.status === 'IN_PROGRESS') ??
          (r.route?.status === 'IN_PROGRESS' ? r.route : null);
        if (!active) {
          if (!r.route && !(r.routes?.length)) {
            setError('Nenhuma rota publicada para hoje.');
          } else {
            setError('Inicie a rota em Minha rota antes de navegar.');
          }
          setRoute(r.route ?? r.routes?.[0] ?? null);
          return;
        }
        setRoute(active);
        startWatchingRef.current(active.id);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Falha ao carregar navegação');
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      stopWatch();
      void releaseWakeLock();
    };
  }, [stopWatch, releaseWakeLock]);

  const initialView = useMemo(() => {
    if (lineCoords[0]) {
      return { longitude: lineCoords[0][0], latitude: lineCoords[0][1], zoom: 13 };
    }
    if (route?.originLongitude != null && route?.originLatitude != null) {
      return {
        longitude: route.originLongitude,
        latitude: route.originLatitude,
        zoom: 13,
      };
    }
    if (orderedStops[0]) {
      return {
        longitude: orderedStops[0].longitude,
        latitude: orderedStops[0].latitude,
        zoom: 13,
      };
    }
    return { longitude: -46.63, latitude: -23.55, zoom: 12 };
  }, [lineCoords, route?.originLatitude, route?.originLongitude, orderedStops]);

  const paintedCoords = useMemo(() => {
    if (!nextStop) return [];

    // Recalculando ou fora da rota: não pintar U-turn / geometria velha — só GPS → parada.
    if (gps && (recalculating || effectivelyOffRoute)) {
      return [
        [gps.longitude, gps.latitude] as [number, number],
        [nextStop.longitude, nextStop.latitude] as [number, number],
      ];
    }

    if (!lineCoords.length) {
      if (!gps) return [];
      return [
        [gps.longitude, gps.latitude] as [number, number],
        [nextStop.longitude, nextStop.latitude] as [number, number],
      ];
    }

    const nextIdx = orderedStops.findIndex((s) => s.id === nextStop.id);
    return clipLineToNextStop({
      coords: lineCoords,
      flatSteps,
      from: gps,
      nextStop,
      nextStopIndex: nextIdx >= 0 ? nextIdx : 0,
    });
  }, [
    lineCoords,
    flatSteps,
    gps,
    nextStop,
    orderedStops,
    recalculating,
    effectivelyOffRoute,
  ]);

  const geojson = useMemo(() => {
    if (paintedCoords.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: paintedCoords },
    };
  }, [paintedCoords]);

  function reenableFollow() {
    userPanningRef.current = false;
    setFollow(true);
    const target =
      smoothedGps ??
      (gps
        ? { latitude: gps.latitude, longitude: gps.longitude, heading: gps.heading }
        : null);
    if (target) followCamera(target, { force: true });
  }

  function confirmExitNav() {
    setShowExitConfirm(true);
  }

  function exitNav() {
    stopWatch();
    void releaseWakeLock();
    router.push('/field/my-route');
  }

  function openCompleteConfirm() {
    if (!route || completing) return;
    if (hasOpenVisitOnStops(route.stops)) {
      setCompleteError('Finalize a visita em andamento antes de concluir a rota.');
      setShowCompleteConfirm(true);
      return;
    }
    setCompleteError(null);
    setShowCompleteConfirm(true);
  }

  async function submitCompleteRoute() {
    if (!route || completing) return;
    if (hasOpenVisitOnStops(route.stops)) {
      setCompleteError('Finalize a visita em andamento antes de concluir a rota.');
      return;
    }
    const pending = route.stops.filter((s) => s.status === 'PENDING');
    const remaining = remainingPlannedMeters(route.stops);
    const asFinished = canCompleteAsFinished(remaining, pending.length);
    const mode = asFinished ? 'COMPLETED' : 'INCOMPLETE';
    setCompleting(true);
    setCompleteError(null);
    try {
      await apiFetch(`/api/v1/field/routes/${route.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
      stopWatch();
      void releaseWakeLock();
      setShowCompleteConfirm(false);
      router.push('/field/my-route');
    } catch (e) {
      setCompleteError(e instanceof ApiError ? e.message : 'Não foi possível concluir a rota');
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 bg-[#121212] px-6 text-center text-sm text-white/70">
        <p>Abrindo navegação Rotas…</p>
        <p className="text-xs text-white/40">Buscando rota em andamento</p>
      </div>
    );
  }

  if (error && (!route || route.status !== 'IN_PROGRESS')) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 bg-[#121212] px-6 text-center">
        <p className="text-xl font-semibold text-white">Rotas</p>
        <p className="text-sm text-white/70" role="alert">
          {error}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setLoading(true);
              const dateYmd = toDateInputValue();
              void apiFetch<{ routes?: NavRoute[]; route: NavRoute | null }>(
                `/api/v1/field/my-route?date=${encodeURIComponent(dateYmd)}`,
              )
                .then((r) => {
                  const active =
                    r.routes?.find((x) => x.status === 'IN_PROGRESS') ??
                    (r.route?.status === 'IN_PROGRESS' ? r.route : null);
                  if (!active) {
                    setError('Inicie a rota em Minha rota antes de navegar.');
                    setRoute(r.route ?? r.routes?.[0] ?? null);
                    return;
                  }
                  setRoute(active);
                  startWatchingRef.current(active.id);
                })
                .catch((e) =>
                  setError(e instanceof ApiError ? e.message : 'Falha ao carregar navegação'),
                )
                .finally(() => setLoading(false));
            }}
            className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white"
          >
            Tentar de novo
          </button>
          <button
            type="button"
            onClick={() => router.push('/field/my-route')}
            className="ops-btn ops-btn-primary"
          >
            Voltar para Minha rota
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden bg-[#121212] text-white">
      <div className="absolute inset-0">
        <MapGL
          ref={mapRef}
          initialViewState={initialView}
          mapStyle={cartoDarkRasterStyle}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
          onLoad={() => {
            setMapReady(true);
            window.setTimeout(() => {
              if (initialCenterDoneRef.current) return;
              const g = gpsRef.current;
              if (g) {
                followCamera(
                  {
                    latitude: g.latitude,
                    longitude: g.longitude,
                    heading: g.heading,
                  },
                  { initial: true },
                );
                return;
              }
              fitRouteOverview();
            }, 50);
          }}
          onError={() => {
            setGpsHint((h) =>
              h.includes('mapa') ? h : `${h} · Falha ao carregar tiles do mapa`,
            );
          }}
          onDragStart={() => {
            userPanningRef.current = true;
            setFollow(false);
          }}
          onDragEnd={() => {
            userPanningRef.current = false;
          }}
        >
          {mapReady && geojson ? (
            <Source id="nav-route" type="geojson" data={geojson}>
              <Layer
                id="nav-route-glow"
                type="line"
                paint={{
                  'line-color': NAV_ROUTE_GLOW,
                  'line-width': 10,
                  'line-opacity': 0.25,
                }}
              />
              <Layer
                id="nav-route-line"
                type="line"
                paint={{
                  'line-color': NAV_ROUTE_LINE,
                  'line-width': 5,
                  'line-opacity': 0.95,
                }}
              />
            </Source>
          ) : null}

          {mapReady
            ? orderedStops.map((s) => (
                <Marker
                  key={s.id}
                  latitude={s.latitude}
                  longitude={s.longitude}
                  anchor="bottom"
                >
                  <div
                    className={`flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white px-1.5 text-[11px] font-bold ${
                      nextStop?.id === s.id
                        ? 'bg-amber-400 text-[#121212]'
                        : 'bg-accent text-white'
                    }`}
                    aria-label={`Parada ${s.sequence}: ${s.visit.customer.name}`}
                  >
                    {s.sequence}
                  </div>
                </Marker>
              ))
            : null}

          {mapReady
            ? routeLandmarks.map((lm) => (
                <LandmarkMapMarker
                  key={lm.id}
                  latitude={lm.latitude}
                  longitude={lm.longitude}
                  type={lm.type}
                  variant="field"
                />
              ))
            : null}

          {mapReady && smoothedGps ? (
            <LivePositionMarker
              latitude={smoothedGps.latitude}
              longitude={smoothedGps.longitude}
              kind="car"
              heading={markerHeading}
              accuracyMeters={gps?.accuracy}
              plate={route?.vehicle?.plate}
              label="Seu veículo"
            />
          ) : null}
        </MapGL>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto mx-auto mt-3 max-w-md flex items-center justify-between gap-2">
          <p className="text-sm font-semibold tracking-wide text-white/80">
            ROTAS
          </p>
          <div className="flex items-center gap-2">
            {route?.recordTrip ? (
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white ${
                  trackStats.queued > 0 ? 'bg-amber-600/95' : 'bg-accent/90'
                }`}
              >
                {trackStats.queued > 0
                  ? `Gravando · ${trackStats.queued} na fila`
                  : `Gravando · ${trackStats.posted || trackStats.trail} pts`}
              </span>
            ) : null}
            <button
              type="button"
              onClick={confirmExitNav}
              className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label="Encerrar navegação"
            >
              <span aria-hidden>✕</span> Encerrar
            </button>
          </div>
        </div>

        <div
          className={`pointer-events-auto mx-auto mt-3 max-w-md rounded-[10px] border px-4 py-3 ${
            recalculating
              ? 'border-sky-500/40 bg-sky-800 text-white'
              : rerouteError
                ? 'border-red-500/40 bg-red-900 text-white'
                : arriving
                  ? 'border-amber-300/60 bg-amber-400 text-[#121212]'
                  : effectivelyOffRoute
                    ? 'border-orange-400/40 bg-orange-700 text-white'
                    : 'border-[var(--border)] bg-surface text-brand-900'
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <ManeuverArrow deg={arrowDeg} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                {recalculating
                  ? 'Recálculo'
                  : rerouteError
                    ? 'Recálculo'
                    : arriving
                      ? 'Próxima parada'
                      : 'Próxima manobra'}
              </p>
              <p className="mt-0.5 text-lg font-semibold leading-snug">{bannerText}</p>
              {showManeuverBanner ? (
                <LaneGuidance
                  step={nextManeuver ?? progress.currentStep}
                  metersUntil={untilManeuverM}
                />
              ) : null}
              {nextStop && !arriving && !recalculating ? (
                <p className="mt-1 truncate text-xs opacity-80">
                  Destino: {nextStop.visit.customer.name}
                </p>
              ) : null}
              {arriving && nextStop ? (
                <button
                  type="button"
                  onClick={() => router.push(`/field/visits/${nextStop.visit.id}`)}
                  className="mt-3 w-full rounded-[6px] bg-[#121212] px-3 py-2 text-sm font-semibold text-white hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212]"
                >
                  Cheguei
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {proximityLandmark ? (
          <div
            className="pointer-events-auto mx-auto mt-2 max-w-md rounded-[10px] border border-[var(--warn)]/45 bg-surface px-4 py-3 text-brand-900"
            role="alert"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--warn)]">
              Atenção — marco próximo
            </p>
            <p className="mt-0.5 text-base font-semibold">
              {LANDMARK_LABELS[proximityLandmark.type]}
              {proximityLandmark.note ? ` · ${proximityLandmark.note}` : ''}
            </p>
            <button
              type="button"
              onClick={() => void dismissProximity()}
              className="ops-btn ops-btn-primary mt-2 w-full"
            >
              OK
            </button>
          </div>
        ) : null}

        {gpsBlocked ? (
          <div
            className="pointer-events-auto mx-auto mt-2 max-w-md rounded-2xl border border-amber-400/40 bg-amber-950/90 px-4 py-3 text-amber-50 shadow-lg backdrop-blur"
            role="alert"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
              Localização necessária
            </p>
            <p className="mt-1 text-sm leading-snug">{gpsHint}</p>
            {isInsecureGeolocationContext() ? (
              <p className="mt-2 text-[11px] leading-snug text-amber-200/80">
                Dica: no PC abra http://localhost:3000. No celular, use um túnel HTTPS apontando para
                esta máquina — Safari bloqueia GPS em http://192.168…
              </p>
            ) : (
              <button
                type="button"
                className="mt-2 rounded-[6px] bg-amber-400 px-3 py-1.5 text-xs font-bold text-[#121212]"
                onClick={() => {
                  void retryGps();
                }}
              >
                Tentar GPS de novo
              </button>
            )}
          </div>
        ) : null}
      </div>

      {showExitConfirm ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-nav-title"
        >
          <div className="w-full max-w-sm rounded-[10px] border border-[var(--border)] bg-surface p-5 text-brand-900">
            <h2 id="exit-nav-title" className="text-lg font-semibold">
              Sair da navegação?
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              A rota continua em andamento. Você pode retomar em Minha rota ou concluir quando
              terminar o dia.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="ops-btn ops-btn-secondary flex-1"
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={exitNav}
                className="ops-btn ops-btn-primary flex-1"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCompleteConfirm && route ? (
        <CompleteRouteConfirm
          pendingCount={route.stops.filter((s) => s.status === 'PENDING').length}
          totalStops={route.stops.length}
          remainingMeters={remainingPlannedMeters(route.stops)}
          asFinished={
            !hasOpenVisitOnStops(route.stops) &&
            canCompleteAsFinished(
              remainingPlannedMeters(route.stops),
              route.stops.filter((s) => s.status === 'PENDING').length,
            )
          }
          busy={completing}
          error={completeError}
          onCancel={() => {
            if (completing) return;
            setShowCompleteConfirm(false);
            setCompleteError(null);
          }}
          onConfirm={() => void submitCompleteRoute()}
        />
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="relative mx-auto max-w-md">
          <button
            type="button"
            onClick={reenableFollow}
            className={`absolute -top-14 right-0 z-10 flex h-12 w-12 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:-top-16 ${
              follow
                ? 'bg-accent text-white'
                : 'bg-black/60 text-white/80'
            }`}
            aria-label="Centralizar na minha posição"
            title="Centralizar"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
          {route?.recordTrip && nextStop && gps ? (
            <div className="mb-2">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {(Object.keys(LANDMARK_LABELS) as LandmarkType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={landmarkBusy || gpsBlocked}
                    onClick={() => void markLandmark(type)}
                    className="rounded-xl bg-black/65 px-2 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    {LANDMARK_LABELS[type]}
                  </button>
                ))}
              </div>
              {landmarkMsg ? (
                <p className="mt-1 text-center text-[10px] text-white/70">{landmarkMsg}</p>
              ) : null}
            </div>
          ) : null}
          <div className="mb-2">
            <SlideToComplete
              busy={completing}
              disabled={showExitConfirm}
              onComplete={openCompleteConfirm}
            />
          </div>
          <div className="grid grid-cols-4 gap-2 rounded-2xl bg-black/70 px-3 py-3 text-center shadow-lg backdrop-blur">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">Tempo</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">
                {progress.remainingDuration == null
                  ? '—'
                  : formatDuration(progress.remainingDuration)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
                Restante
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">
                {progress.remainingDistance == null
                  ? '—'
                  : formatDistanceKm(progress.remainingDistance)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">ETA</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">
                {progress.remainingDuration == null
                  ? '—'
                  : formatEta(progress.remainingDuration)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">Vel.</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">{speed} km/h</p>
            </div>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-white/45">
            {gps ? gpsHint : 'Aguardando GPS para tempo e km reais'}
          </p>
        </div>
      </div>
    </div>
  );
}
