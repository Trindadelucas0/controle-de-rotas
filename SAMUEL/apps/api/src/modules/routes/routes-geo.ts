export type LatLng = { latitude: number; longitude: number };

export type GeoStop = LatLng & {
  id: string;
  customerId: string;
  name: string;
  city: string | null;
  street: string | null;
  number: string | null;
  serviceOrderNumber: number;
  serviceOrderTitle: string;
};

export type RouteOrigin = LatLng & { name: string; address: string | null };

export type PlannedNavLane = {
  indications: string[];
  valid: boolean;
};

export type PlannedNavStep = {
  distanceMeters: number;
  durationSeconds: number;
  name: string;
  ref: string | null;
  lanes: PlannedNavLane[] | null;
  maneuver: {
    type: string;
    modifier: string | null;
    location: [number, number];
  };
};

export type PlannedNavJson = {
  provider: 'osrm' | 'straight_line';
  roundtrip: boolean;
  legs: {
    distanceMeters: number;
    durationSeconds: number;
    steps: PlannedNavStep[];
  }[];
};

export type OptimizedStop = GeoStop & {
  sequence: number;
  distanceMeters: number;
  durationSeconds: number;
};

export type OptimizedTrip = {
  origin: {
    name: string;
    latitude: number;
    longitude: number;
    address: string | null;
  };
  stops: OptimizedStop[];
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
  plannedSteps: PlannedNavJson;
};

export type OsrmStep = {
  distance: number;
  duration: number;
  name?: string;
  ref?: string;
  maneuver?: {
    type?: string;
    modifier?: string;
    location?: [number, number];
  };
  intersections?: {
    lanes?: { indications?: string[]; valid?: boolean }[];
  }[];
};

export type OsrmTripResponse = {
  code: string;
  waypoints?: { waypoint_index: number; location: [number, number] }[];
  trips?: {
    distance: number;
    duration: number;
    geometry: { type: string; coordinates: [number, number][] };
    legs: { distance: number; duration: number; steps?: OsrmStep[] }[];
  }[];
};

export type OsrmRouteResponse = {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { type: string; coordinates: [number, number][] };
    legs: { distance: number; duration: number; steps?: OsrmStep[] }[];
  }[];
};

const EARTH_RADIUS_M = 6_371_000;
const FALLBACK_SPEED_M_S = 11.1;
/** Longe da trilha gravada: liga origem GPS → ponto de entrada. */
const ACCESS_PATH_JOIN_M = 50;

type LngLat = [number, number];

function sameLngLat(a: LngLat, b: LngLat): boolean {
  return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
}

function lineLengthMeters(coords: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    total += haversineMeters(
      { latitude: coords[i - 1][1], longitude: coords[i - 1][0] },
      { latitude: coords[i][1], longitude: coords[i][0] },
    );
  }
  return total;
}

function projectPointOnSegment(
  p: LngLat,
  a: LngLat,
  b: LngLat,
): { point: LngLat; t: number } {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { point: a, t: 0 };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return { point: [ax + t * dx, ay + t * dy], t };
}

function nearestOnLine(
  coords: LngLat[],
  lng: number,
  lat: number,
): { point: LngLat; alongMeters: number; distanceToLineMeters: number } {
  if (coords.length < 2) {
    const only = coords[0] ?? [lng, lat];
    return {
      point: only,
      alongMeters: 0,
      distanceToLineMeters: haversineMeters(
        { latitude: lat, longitude: lng },
        { latitude: only[1], longitude: only[0] },
      ),
    };
  }

  let bestDist = Number.POSITIVE_INFINITY;
  let bestPoint: LngLat = coords[0];
  let bestAlong = 0;
  let traversed = 0;

  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = haversineMeters(
      { latitude: a[1], longitude: a[0] },
      { latitude: b[1], longitude: b[0] },
    );
    const { point, t } = projectPointOnSegment([lng, lat], a, b);
    const d = haversineMeters(
      { latitude: lat, longitude: lng },
      { latitude: point[1], longitude: point[0] },
    );
    if (d < bestDist) {
      bestDist = d;
      bestPoint = point;
      bestAlong = traversed + t * segLen;
    }
    traversed += segLen;
  }

  return {
    point: bestPoint,
    alongMeters: bestAlong,
    distanceToLineMeters: bestDist,
  };
}

function sliceLineFromAlong(coords: LngLat[], startAlong: number): LngLat[] {
  if (coords.length < 2) return coords.slice();
  const total = lineLengthMeters(coords);
  if (total <= 0) return coords.slice();
  const start = Math.max(0, Math.min(startAlong, total));
  if (start <= 1) return coords.slice();

  const out: LngLat[] = [];
  let traversed = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = haversineMeters(
      { latitude: a[1], longitude: a[0] },
      { latitude: b[1], longitude: b[0] },
    );
    const segStart = traversed;
    const segEnd = traversed + segLen;
    traversed = segEnd;

    if (segEnd < start - 1e-6) continue;

    if (out.length === 0) {
      const t = segLen > 0 ? (start - segStart) / segLen : 0;
      const u = Math.max(0, Math.min(1, t));
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
    }

    const last = out[out.length - 1];
    if (!last || !sameLngLat(last, b)) out.push(b);
  }

  if (out.length >= 2) return out;
  const last = coords[coords.length - 1];
  if (out.length === 1) return [out[0], last];
  return [last, last];
}

/**
 * Recorta a trilha gravada a partir da origem atual (GPS / E).
 * Não devolve o trecho já “atrás” do funcionário. Se estiver longe da linha,
 * prefixa origem → ponto de entrada.
 */
export function clipAccessPathToOrigin(origin: LatLng, coords: LngLat[]): LngLat[] {
  if (coords.length < 2) {
    const dest = coords[0] ?? [origin.longitude, origin.latitude];
    return [[origin.longitude, origin.latitude], dest];
  }

  const nearest = nearestOnLine(coords, origin.longitude, origin.latitude);
  const sliced = sliceLineFromAlong(coords, nearest.alongMeters);
  const originPt: LngLat = [origin.longitude, origin.latitude];
  const first = sliced[0];

  if (nearest.distanceToLineMeters <= ACCESS_PATH_JOIN_M) {
    return sliced.length >= 2 ? sliced : [first ?? originPt, coords[coords.length - 1]];
  }

  if (!first || sameLngLat(originPt, first)) {
    return sliced.length >= 2 ? sliced : [originPt, coords[coords.length - 1]];
  }
  return [originPt, ...sliced];
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function bearingRadians(origin: LatLng, point: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1 = toRad(origin.latitude);
  const lat2 = toRad(point.latitude);
  const dLng = toRad(point.longitude - origin.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return Math.atan2(y, x);
}

function pathLength(order: number[], visits: GeoStop[], origin: LatLng): number {
  let total = 0;
  let prev: LatLng = origin;
  for (const i of order) {
    total += haversineMeters(prev, visits[i]);
    prev = visits[i];
  }
  return total;
}

function twoOpt(order: number[], visits: GeoStop[], origin: LatLng): number[] {
  const n = order.length;
  if (n < 4) return order;
  let improved = true;
  let best = [...order];
  let bestLen = pathLength(best, visits, origin);
  let guard = 0;
  while (improved && guard < 200) {
    improved = false;
    guard += 1;
    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const next = [...best];
        const slice = next.slice(i, k + 1).reverse();
        next.splice(i, k - i + 1, ...slice);
        const len = pathLength(next, visits, origin);
        if (len + 0.5 < bestLen) {
          best = next;
          bestLen = len;
          improved = true;
        }
      }
    }
  }
  return best;
}

/** Ordena paradas da mais perto para a mais longe a partir de `origin` (sem 2-opt). */
export function orderStopsNearestFirst<T extends LatLng>(origin: LatLng, stops: T[]): T[] {
  return [...stops].sort((a, b) => haversineMeters(origin, a) - haversineMeters(origin, b));
}

export function optimizeOrder(origin: LatLng, visits: GeoStop[]): number[] {
  const n = visits.length;
  if (n <= 1) return visits.map((_, i) => i);
  const remaining = new Set(Array.from({ length: n }, (_, i) => i));
  const order: number[] = [];
  let current: LatLng = origin;
  while (remaining.size) {
    let best = -1;
    let bestDist = Infinity;
    for (const i of remaining) {
      const d = haversineMeters(current, visits[i]);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    order.push(best);
    remaining.delete(best);
    current = visits[best];
  }
  return twoOpt(order, visits, origin);
}

export function lineStringWkt(coordinates: [number, number][]): string {
  const points = coordinates.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
  return `LINESTRING(${points})`;
}

function compactOsrmLanes(
  intersections: OsrmStep['intersections'] | undefined,
): PlannedNavLane[] | null {
  const raw = intersections?.[0]?.lanes;
  if (!raw?.length) return null;
  return raw.map((lane) => ({
    indications: Array.isArray(lane.indications)
      ? lane.indications.filter((x): x is string => typeof x === 'string')
      : [],
    valid: Boolean(lane.valid),
  }));
}

export function compactOsrmSteps(steps: OsrmStep[] | undefined): PlannedNavStep[] {
  if (!steps?.length) return [];
  return steps.map((s) => ({
    distanceMeters: Math.round(s.distance ?? 0),
    durationSeconds: Math.round(s.duration ?? 0),
    name: (s.name || '').trim(),
    ref: (s.ref || '').trim() || null,
    lanes: compactOsrmLanes(s.intersections),
    maneuver: {
      type: s.maneuver?.type || 'continue',
      modifier: s.maneuver?.modifier || null,
      location: (s.maneuver?.location || [0, 0]) as [number, number],
    },
  }));
}

function fallbackArriveStep(stop: GeoStop, dist: number, dur: number): PlannedNavStep {
  return {
    distanceMeters: Math.round(dist),
    durationSeconds: dur,
    name: stop.name,
    ref: null,
    lanes: null,
    maneuver: {
      type: 'arrive',
      modifier: null,
      location: [stop.longitude, stop.latitude],
    },
  };
}

export function straightLineTripAlongOrder(
  origin: RouteOrigin,
  orderedVisits: GeoStop[],
  roundtrip: boolean,
  returnTo?: RouteOrigin | null,
): OptimizedTrip {
  const stops: OptimizedStop[] = [];
  const geometry: [number, number][] = [[origin.longitude, origin.latitude]];
  const legs: PlannedNavJson['legs'] = [];
  let prev: LatLng = origin;
  let totalDist = 0;
  let totalDur = 0;
  const home = returnTo ?? origin;

  for (let i = 0; i < orderedVisits.length; i++) {
    const v = orderedVisits[i];
    const dist = haversineMeters(prev, v);
    const dur = Math.round(dist / FALLBACK_SPEED_M_S);
    totalDist += dist;
    totalDur += dur;
    stops.push({
      ...v,
      sequence: i + 1,
      distanceMeters: Math.round(dist),
      durationSeconds: dur,
    });
    geometry.push([v.longitude, v.latitude]);
    legs.push({
      distanceMeters: Math.round(dist),
      durationSeconds: dur,
      steps: [fallbackArriveStep(v, dist, dur)],
    });
    prev = v;
  }

  if (roundtrip && orderedVisits.length) {
    const back = haversineMeters(prev, home);
    const backDur = Math.round(back / FALLBACK_SPEED_M_S);
    totalDist += back;
    totalDur += backDur;
    geometry.push([home.longitude, home.latitude]);
    legs.push({
      distanceMeters: Math.round(back),
      durationSeconds: backDur,
      steps: [
        {
          distanceMeters: Math.round(back),
          durationSeconds: backDur,
          name: home.name,
          ref: null,
          lanes: null,
          maneuver: {
            type: 'arrive',
            modifier: null,
            location: [home.longitude, home.latitude],
          },
        },
      ],
    });
  }

  return {
    origin: {
      name: origin.name,
      latitude: origin.latitude,
      longitude: origin.longitude,
      address: origin.address,
    },
    stops,
    totals: {
      distanceMeters: Math.round(totalDist),
      durationSeconds: totalDur,
      distanceKm: Math.round((totalDist / 1000) * 10) / 10,
    },
    geometry: { type: 'LineString', coordinates: geometry },
    quality: 'straight_line',
    roundtrip,
    plannedSteps: { provider: 'straight_line', roundtrip, legs },
  };
}

export function straightLineTrip(
  origin: RouteOrigin,
  visits: GeoStop[],
  roundtrip: boolean,
): OptimizedTrip {
  const order = optimizeOrder(origin, visits);
  const ordered = order.map((i) => visits[i]);
  return straightLineTripAlongOrder(origin, ordered, roundtrip);
}

/**
 * Usa geometria gravada (CustomerAccessPath) para rota de 1 cliente.
 * Recorta a partir da origem atual (GPS no start/reroute) — não cola a
 * trilha inteira da gravação. `distanceMeters` do path é ignorado após o recorte.
 * Opcionalmente acrescenta perna de volta (reta) se roundtrip.
 */
export function tripFromAccessPath(
  origin: RouteOrigin,
  stop: GeoStop,
  accessGeometry: { type: 'LineString'; coordinates: [number, number][] },
  _distanceMeters: number | null | undefined,
  roundtrip: boolean,
  returnTo?: RouteOrigin | null,
): OptimizedTrip {
  const raw = accessGeometry.coordinates.length
    ? [...accessGeometry.coordinates]
    : [
        [origin.longitude, origin.latitude] as [number, number],
        [stop.longitude, stop.latitude] as [number, number],
      ];
  const coords = clipAccessPathToOrigin(origin, raw);
  const dist = Math.round(lineLengthMeters(coords));
  const dur = Math.round(dist / FALLBACK_SPEED_M_S);
  const home = returnTo ?? origin;
  const geometry = [...coords];
  const legs: PlannedNavJson['legs'] = [
    {
      distanceMeters: dist,
      durationSeconds: dur,
      steps: [fallbackArriveStep(stop, dist, dur)],
    },
  ];
  let totalDist = dist;
  let totalDur = dur;

  if (roundtrip) {
    const back = Math.round(haversineMeters(stop, home));
    const backDur = Math.round(back / FALLBACK_SPEED_M_S);
    totalDist += back;
    totalDur += backDur;
    geometry.push([home.longitude, home.latitude]);
    legs.push({
      distanceMeters: back,
      durationSeconds: backDur,
      steps: [
        {
          distanceMeters: back,
          durationSeconds: backDur,
          name: home.name,
          ref: null,
          lanes: null,
          maneuver: {
            type: 'arrive',
            modifier: null,
            location: [home.longitude, home.latitude],
          },
        },
      ],
    });
  }

  return {
    origin: {
      name: origin.name,
      latitude: origin.latitude,
      longitude: origin.longitude,
      address: origin.address,
    },
    stops: [
      {
        ...stop,
        sequence: 1,
        distanceMeters: dist,
        durationSeconds: dur,
      },
    ],
    totals: {
      distanceMeters: totalDist,
      durationSeconds: totalDur,
      distanceKm: Math.round((totalDist / 1000) * 10) / 10,
    },
    geometry: { type: 'LineString', coordinates: geometry },
    quality: 'road',
    roundtrip,
    plannedSteps: { provider: 'straight_line', roundtrip, legs },
  };
}

export function routeFromOsrm(
  origin: RouteOrigin,
  orderedVisits: GeoStop[],
  roundtrip: boolean,
  data: OsrmRouteResponse,
): OptimizedTrip | null {
  if (data.code !== 'Ok' || !data.routes?.[0]) return null;

  const osrmRoute = data.routes[0];
  const stops: OptimizedStop[] = orderedVisits.map((visit, i) => {
    const leg = osrmRoute.legs[i];
    return {
      ...visit,
      sequence: i + 1,
      distanceMeters: Math.round(leg?.distance ?? 0),
      durationSeconds: Math.round(leg?.duration ?? 0),
    };
  });

  const legs: PlannedNavJson['legs'] = osrmRoute.legs
    .slice(0, stops.length + (roundtrip ? 1 : 0))
    .map((leg) => ({
      distanceMeters: Math.round(leg.distance ?? 0),
      durationSeconds: Math.round(leg.duration ?? 0),
      steps: compactOsrmSteps(leg.steps),
    }));

  return {
    origin: {
      name: origin.name,
      latitude: origin.latitude,
      longitude: origin.longitude,
      address: origin.address,
    },
    stops,
    totals: {
      distanceMeters: Math.round(osrmRoute.distance),
      durationSeconds: Math.round(osrmRoute.duration),
      distanceKm: Math.round((osrmRoute.distance / 1000) * 10) / 10,
    },
    geometry: {
      type: 'LineString',
      coordinates: (osrmRoute.geometry?.coordinates || []) as [number, number][],
    },
    quality: 'road',
    roundtrip,
    plannedSteps: { provider: 'osrm', roundtrip, legs },
  };
}

export function tripFromOsrm(
  origin: RouteOrigin,
  visits: GeoStop[],
  roundtrip: boolean,
  data: OsrmTripResponse,
): OptimizedTrip | null {
  if (data.code !== 'Ok' || !data.trips?.[0] || !data.waypoints) return null;

  const trip = data.trips[0];
  const visitMeta = data.waypoints
    .map((wp, inputIndex) => ({ wp, inputIndex }))
    .filter((x) => x.inputIndex > 0)
    .sort((a, b) => a.wp.waypoint_index - b.wp.waypoint_index);

  const stops: OptimizedStop[] = visitMeta.map((meta, i) => {
    const visit = visits[meta.inputIndex - 1];
    const leg = trip.legs[i];
    return {
      ...visit,
      sequence: i + 1,
      distanceMeters: Math.round(leg?.distance ?? 0),
      durationSeconds: Math.round(leg?.duration ?? 0),
    };
  });

  const legs: PlannedNavJson['legs'] = trip.legs.slice(0, stops.length + (roundtrip ? 1 : 0)).map((leg) => ({
    distanceMeters: Math.round(leg.distance ?? 0),
    durationSeconds: Math.round(leg.duration ?? 0),
    steps: compactOsrmSteps(leg.steps),
  }));

  return {
    origin: {
      name: origin.name,
      latitude: origin.latitude,
      longitude: origin.longitude,
      address: origin.address,
    },
    stops,
    totals: {
      distanceMeters: Math.round(trip.distance),
      durationSeconds: Math.round(trip.duration),
      distanceKm: Math.round((trip.distance / 1000) * 10) / 10,
    },
    geometry: {
      type: 'LineString',
      coordinates: (trip.geometry?.coordinates || []) as [number, number][],
    },
    quality: 'road',
    roundtrip,
    plannedSteps: { provider: 'osrm', roundtrip, legs },
  };
}
