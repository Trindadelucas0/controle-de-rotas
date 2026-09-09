/** Helpers de progresso na polyline / manobras OSRM para a tela de navegação. */

export type LngLat = [number, number];

export type PlannedNavLane = {
  indications: string[];
  valid: boolean;
};

export type PlannedNavStep = {
  distanceMeters: number;
  durationSeconds: number;
  name: string;
  ref?: string | null;
  lanes?: PlannedNavLane[] | null;
  maneuver: {
    type: string;
    modifier: string | null;
    location: [number, number];
  };
};

export type PlannedNavJson = {
  provider: string;
  roundtrip: boolean;
  legs: {
    distanceMeters: number;
    durationSeconds: number;
    steps: PlannedNavStep[];
  }[];
};

export type FlatStep = PlannedNavStep & {
  legIndex: number;
  stepIndex: number;
  /** Distância acumulada no início deste step (metros ao longo da rota). */
  startAlongMeters: number;
  endAlongMeters: number;
};

const EARTH_RADIUS_M = 6_371_000;
export const NEAR_STOP_M = 80;
/** Distância à polyline acima da qual consideramos fora da rota (m). */
export const OFF_ROUTE_M = 50;

export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
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

/** Ponto mais próximo na polyline (coords [lng, lat]) e distância ao longo dela. */
export function nearestOnLine(
  coords: LngLat[],
  lng: number,
  lat: number,
): { point: LngLat; alongMeters: number; distanceToLineMeters: number; index: number } {
  if (!coords.length) {
    return {
      point: [lng, lat],
      alongMeters: 0,
      distanceToLineMeters: Number.POSITIVE_INFINITY,
      index: 0,
    };
  }
  if (coords.length === 1) {
    const only = coords[0];
    return {
      point: only,
      alongMeters: 0,
      distanceToLineMeters: haversineMeters(
        { latitude: lat, longitude: lng },
        { latitude: only[1], longitude: only[0] },
      ),
      index: 0,
    };
  }

  let bestDist = Number.POSITIVE_INFINITY;
  let bestPoint: LngLat = coords[0];
  let bestAlong = 0;
  let bestIndex = 0;
  let traversed = 0;

  for (let i = 0; i < coords.length - 1; i++) {
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
      bestIndex = i;
    }
    traversed += segLen;
  }

  return {
    point: bestPoint,
    alongMeters: bestAlong,
    distanceToLineMeters: bestDist,
    index: bestIndex,
  };
}

export function lineLengthMeters(coords: LngLat[]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    total += haversineMeters(
      { latitude: a[1], longitude: a[0] },
      { latitude: b[1], longitude: b[0] },
    );
  }
  return total;
}

function clamp01(t: number): number {
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.min(1, t));
}

function lerpLngLat(a: LngLat, b: LngLat, t: number): LngLat {
  const u = clamp01(t);
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

function sameLngLat(a: LngLat, b: LngLat): boolean {
  return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
}

function connectorToStop(
  from: { latitude: number; longitude: number } | null,
  to: { latitude: number; longitude: number } | null,
): LngLat[] {
  if (!from || !to) return [];
  const a: LngLat = [from.longitude, from.latitude];
  const b: LngLat = [to.longitude, to.latitude];
  if (sameLngLat(a, b)) return [a, b];
  return [a, b];
}

function snapEndToStop(
  line: LngLat[],
  stop: { latitude: number; longitude: number } | null,
): LngLat[] {
  if (!stop || line.length < 1) return line;
  const end: LngLat = [stop.longitude, stop.latitude];
  const last = line[line.length - 1];
  if (sameLngLat(last, end)) return line;
  return [...line, end];
}

/**
 * Distância ao longo da polyline no fim do leg que chega na parada `stopIndex` (0-based).
 * Legs OSRM: 0 = origem→parada 1, 1 = parada 1→parada 2, …
 */
export function alongMetersAtStop(flatSteps: FlatStep[], stopIndex: number): number | null {
  if (!flatSteps.length || stopIndex < 0) return null;
  const ofLeg = flatSteps.filter((s) => s.legIndex === stopIndex);
  if (!ofLeg.length) return null;
  return ofLeg[ofLeg.length - 1].endAlongMeters;
}

/** Recorta a polyline entre dois offsets em metros (inclusive). */
export function sliceLineAlongMeters(
  coords: LngLat[],
  startAlong: number,
  endAlong: number,
): LngLat[] {
  if (coords.length < 2) return coords.slice();
  const total = lineLengthMeters(coords);
  if (total <= 0) return coords.slice(0, 2);

  const start = Math.max(0, Math.min(Number.isFinite(startAlong) ? startAlong : 0, total));
  const end = Math.max(start, Math.min(Number.isFinite(endAlong) ? endAlong : total, total));

  const out: LngLat[] = [];
  let traversed = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = haversineMeters(
      { latitude: a[1], longitude: a[0] },
      { latitude: b[1], longitude: b[0] },
    );
    const segStart = traversed;
    const segEnd = traversed + segLen;

    if (segEnd < start - 1e-6) {
      traversed = segEnd;
      continue;
    }
    if (segStart > end + 1e-6) break;

    if (out.length === 0) {
      const t = segLen > 0 ? (start - segStart) / segLen : 0;
      out.push(lerpLngLat(a, b, t));
    }

    if (end <= segEnd + 1e-6) {
      const t = segLen > 0 ? (end - segStart) / segLen : 1;
      const p = lerpLngLat(a, b, t);
      const last = out[out.length - 1];
      if (!last || !sameLngLat(last, p)) out.push(p);
      return out.length >= 2 ? out : [out[0] ?? a, p];
    }

    const last = out[out.length - 1];
    if (!last || !sameLngLat(last, b)) out.push(b);
    traversed = segEnd;
  }

  if (out.length >= 2) return out;
  if (out.length === 1) return [out[0], out[0]];
  return [];
}

/**
 * Trecho ativo de navegação: da posição atual (GPS / carro) até a parada-alvo.
 * Não inclui geometria depois do destino corrente (paradas 3, 4, …).
 * Com GPS, o primeiro ponto da linha é sempre a posição atual (trecho já percorrido some).
 * Usa o fim do leg OSRM da parada; fallback = projeção da parada na polyline.
 */
export function clipLineToNextStop(opts: {
  coords: LngLat[];
  flatSteps: FlatStep[];
  from: { latitude: number; longitude: number } | null;
  nextStop: { latitude: number; longitude: number } | null;
  nextStopIndex: number;
}): LngLat[] {
  const { coords, flatSteps, from, nextStop, nextStopIndex } = opts;
  if (!nextStop) return [];
  if (coords.length < 2) {
    return connectorToStop(from, nextStop);
  }

  let endAlong = alongMetersAtStop(flatSteps, nextStopIndex);
  if (endAlong == null || !Number.isFinite(endAlong)) {
    endAlong = nearestOnLine(coords, nextStop.longitude, nextStop.latitude).alongMeters;
  }

  const prefix = sliceLineAlongMeters(coords, 0, endAlong);
  if (prefix.length < 2) {
    return connectorToStop(from, nextStop);
  }

  if (!from) {
    return snapEndToStop(prefix, nextStop);
  }

  const gpsPoint: LngLat = [from.longitude, from.latitude];
  const nearest = nearestOnLine(prefix, from.longitude, from.latitude);
  const prefixLen = lineLengthMeters(prefix);
  if (prefixLen <= 1 || nearest.alongMeters >= prefixLen - 2) {
    return connectorToStop(from, nextStop);
  }

  const clipped = sliceLineAlongMeters(prefix, nearest.alongMeters, prefixLen);
  if (clipped.length < 2) {
    return connectorToStop(from, nextStop);
  }

  // Sempre nasce no carro — não deixa o trecho projetado “atrás” do GPS.
  const fromCar = sameLngLat(clipped[0], gpsPoint) ? clipped : [gpsPoint, ...clipped];
  return snapEndToStop(fromCar, nextStop);
}

export function flattenSteps(planned: PlannedNavJson | null | undefined): FlatStep[] {
  if (!planned?.legs?.length) return [];
  const out: FlatStep[] = [];
  let along = 0;
  planned.legs.forEach((leg, legIndex) => {
    (leg.steps || []).forEach((step, stepIndex) => {
      const startAlongMeters = along;
      const endAlongMeters = along + Math.max(0, step.distanceMeters || 0);
      out.push({
        ...step,
        legIndex,
        stepIndex,
        startAlongMeters,
        endAlongMeters,
      });
      along = endAlongMeters;
    });
  });
  return out;
}

export function stepAtAlong(steps: FlatStep[], alongMeters: number): FlatStep | null {
  if (!steps.length) return null;
  for (const s of steps) {
    if (alongMeters <= s.endAlongMeters + 1) return s;
  }
  return steps[steps.length - 1];
}

export function remainingFromSteps(
  steps: FlatStep[],
  alongMeters: number,
): { distanceMeters: number; durationSeconds: number } {
  let distanceMeters = 0;
  let durationSeconds = 0;
  for (const s of steps) {
    if (s.endAlongMeters <= alongMeters) continue;
    if (s.startAlongMeters >= alongMeters) {
      distanceMeters += s.distanceMeters;
      durationSeconds += s.durationSeconds;
    } else {
      const frac =
        s.distanceMeters > 0
          ? (s.endAlongMeters - alongMeters) / s.distanceMeters
          : 0;
      distanceMeters += s.distanceMeters * frac;
      durationSeconds += s.durationSeconds * frac;
    }
  }
  return { distanceMeters, durationSeconds };
}

/** Fallback ~30 km/h quando parado e sem velocidade recente. */
export const NAV_FALLBACK_SPEED_M_S = 30 / 3.6;
/** Velocidade GPS abaixo disso conta como parado (não alimenta o ETA). */
export const LIVE_SPEED_MIN_M_S = 2;

/**
 * Velocidade para Tempo/ETA: GPS ao vivo se estiver andando; senão última
 * boa; senão ~30 km/h. Não usa a duração congelada da viagem gravada.
 */
export function effectiveNavSpeedMs(opts: {
  speedMs?: number | null;
  lastGoodSpeedMs?: number | null;
}): number {
  const live = opts.speedMs;
  if (live != null && Number.isFinite(live) && live >= LIVE_SPEED_MIN_M_S) {
    return live;
  }
  const last = opts.lastGoodSpeedMs;
  if (last != null && Number.isFinite(last) && last >= LIVE_SPEED_MIN_M_S) {
    return last;
  }
  return NAV_FALLBACK_SPEED_M_S;
}

function remainingStopsDistance(
  gps: { latitude: number; longitude: number },
  remainingStops: { latitude: number; longitude: number }[],
  nextStop: { latitude: number; longitude: number } | null,
): number {
  if (remainingStops.length) {
    let distanceMeters = 0;
    let prev = gps;
    for (const stop of remainingStops) {
      distanceMeters += haversineMeters(prev, stop);
      prev = stop;
    }
    return distanceMeters;
  }
  if (nextStop) return haversineMeters(gps, nextStop);
  return 0;
}

/**
 * Tempo/km restantes a partir da posição GPS atual.
 * Distância: polyline a partir do GPS (não o total da viagem gravada).
 * Duração: restante / velocidade efetiva (GPS ao vivo).
 */
export function remainingFromCurrentPosition(opts: {
  gps: { latitude: number; longitude: number };
  lineCoords: LngLat[];
  flatSteps: FlatStep[];
  nextStop: { latitude: number; longitude: number } | null;
  remainingStops: { latitude: number; longitude: number }[];
  plannedDistanceMeters?: number | null;
  plannedDurationSeconds?: number | null;
  speedMs?: number | null;
  lastGoodSpeedMs?: number | null;
}): {
  alongMeters: number;
  offRouteMeters: number;
  remainingDistance: number;
  remainingDuration: number;
  currentStep: FlatStep | null;
  offRoute: boolean;
} {
  const {
    gps,
    lineCoords,
    flatSteps,
    nextStop,
    remainingStops,
    speedMs,
    lastGoodSpeedMs,
  } = opts;

  const speed = effectiveNavSpeedMs({ speedMs, lastGoodSpeedMs });
  const durationFromDist = (distanceMeters: number) =>
    speed > 0 ? distanceMeters / speed : distanceMeters / NAV_FALLBACK_SPEED_M_S;

  if (!lineCoords.length) {
    const distanceMeters = remainingStopsDistance(gps, remainingStops, nextStop);
    return {
      alongMeters: 0,
      offRouteMeters: 0,
      remainingDistance: distanceMeters,
      remainingDuration: durationFromDist(distanceMeters),
      currentStep: flatSteps[0] ?? null,
      offRoute: false,
    };
  }

  const nearest = nearestOnLine(lineCoords, gps.longitude, gps.latitude);
  const offRoute = nearest.distanceToLineMeters > OFF_ROUTE_M;

  if (!offRoute) {
    const rem = remainingFromSteps(flatSteps, nearest.alongMeters);
    const lineRemain = Math.max(0, lineLengthMeters(lineCoords) - nearest.alongMeters);
    const distanceMeters =
      lineRemain > 0 ? lineRemain : rem.distanceMeters > 0 ? rem.distanceMeters : 0;
    return {
      alongMeters: nearest.alongMeters,
      offRouteMeters: nearest.distanceToLineMeters,
      remainingDistance: distanceMeters,
      remainingDuration: durationFromDist(distanceMeters),
      currentStep: stepAtAlong(flatSteps, nearest.alongMeters),
      offRoute: false,
    };
  }

  let distanceMeters = remainingStopsDistance(gps, remainingStops, nextStop);
  if (!distanceMeters) {
    distanceMeters =
      nearest.distanceToLineMeters +
      Math.max(0, lineLengthMeters(lineCoords) - nearest.alongMeters);
  }

  return {
    alongMeters: nearest.alongMeters,
    offRouteMeters: nearest.distanceToLineMeters,
    remainingDistance: distanceMeters,
    remainingDuration: durationFromDist(distanceMeters),
    currentStep: nextStop
      ? stepAtAlong(
          flatSteps,
          nearestOnLine(lineCoords, nextStop.longitude, nextStop.latitude).alongMeters,
        )
      : stepAtAlong(flatSteps, nearest.alongMeters),
    offRoute: true,
  };
}

const MANEUVER_PT: Record<string, string> = {
  turn: 'Vire',
  'new name': 'Continue',
  depart: 'Saia',
  arrive: 'Chegue',
  merge: 'Entre na via',
  'on ramp': 'Entre na rampa',
  'off ramp': 'Saia na rampa',
  fork: 'Siga na bifurcação',
  'end of road': 'No fim da via',
  continue: 'Continue',
  roundabout: 'Na rotatória',
  rotary: 'Na rotatória',
  'roundabout turn': 'Na rotatória',
  notification: 'Atenção',
  exit: 'Saia',
};

const MODIFIER_PT: Record<string, string> = {
  left: 'à esquerda',
  right: 'à direita',
  'sharp left': 'à esquerda acentuada',
  'sharp right': 'à direita acentuada',
  'slight left': 'à esquerda suave',
  'slight right': 'à direita suave',
  straight: 'em frente',
  uturn: 'retorno',
};

/** Tipos OSRM que não são “próxima virada” (seguir reto / sair). */
const PASS_THROUGH_TYPES = new Set([
  'depart',
  'continue',
  'new name',
  'notification',
]);

function stepRoadName(step: PlannedNavStep | null | undefined): string {
  if (!step) return '';
  const name = (step.name || '').trim();
  if (name) return name;
  return (step.ref || '').trim();
}

function isPassThroughStep(step: PlannedNavStep): boolean {
  const type = (step.maneuver?.type || '').toLowerCase();
  return PASS_THROUGH_TYPES.has(type);
}

/**
 * Próxima manobra real a partir da posição na polyline.
 * Ignora depart/continue/new name/notification.
 * A manobra OSRM fica no início do step: se já passou ~25 m do início,
 * busca a seguinte (evita “Vire…” depois de já ter virado).
 */
export function upcomingManeuver(
  steps: FlatStep[],
  alongMeters: number,
): FlatStep | null {
  if (!steps.length) return null;
  const LOOKAHEAD_SLACK_M = 25;

  for (const s of steps) {
    if (isPassThroughStep(s)) continue;
    if (s.startAlongMeters + LOOKAHEAD_SLACK_M >= alongMeters) return s;
  }

  for (let i = steps.length - 1; i >= 0; i--) {
    if (!isPassThroughStep(steps[i])) return steps[i];
  }
  return steps[steps.length - 1] ?? null;
}

/** Distância (m) até o início da manobra alvo. */
export function metersUntilManeuver(
  upcoming: FlatStep | null | undefined,
  alongMeters: number,
): number {
  if (!upcoming) return 0;
  return Math.max(0, Math.round(upcoming.startAlongMeters - alongMeters));
}

/**
 * Texto de faixa a partir do modifier (quando OSRM não manda lanes).
 * Roundabout / arrive: null (não inventar).
 */
export function laneHintFromModifier(
  step: PlannedNavStep | null | undefined,
): string | null {
  if (!step) return null;
  const type = (step.maneuver?.type || '').toLowerCase();
  if (
    type === 'arrive' ||
    type === 'roundabout' ||
    type === 'rotary' ||
    type === 'roundabout turn'
  ) {
    return null;
  }
  const modifier = (step.maneuver?.modifier || '').toLowerCase();
  if (modifier === 'uturn' || type === 'uturn') return 'Faixa de retorno';
  if (modifier.includes('left')) return 'Faixa da esquerda';
  if (modifier.includes('right')) return 'Faixa da direita';
  if (modifier === 'straight' || !modifier) return 'Siga em frente';
  return null;
}

/** Ângulo CSS aproximado para uma indication OSRM de faixa. */
export function laneIndicationDeg(indication: string | undefined): number {
  const ind = (indication || '').toLowerCase();
  if (ind.includes('uturn')) return 180;
  if (ind === 'sharp left' || ind === 'left') return -90;
  if (ind === 'slight left') return -45;
  if (ind === 'sharp right' || ind === 'right') return 90;
  if (ind === 'slight right') return 45;
  return 0;
}

/** Texto curto da manobra (banner). Usa name || ref. */
export function maneuverInstruction(step: PlannedNavStep | null | undefined): string {
  if (!step) return 'Siga a rota';
  const type = (step.maneuver?.type || '').toLowerCase();
  const modifier = (step.maneuver?.modifier || '').toLowerCase();
  const road = stepRoadName(step);

  if (type === 'arrive') {
    return road ? `Chegue em ${road}` : 'Chegando ao destino';
  }
  if (type === 'depart') {
    return road ? `Saia em direção a ${road}` : 'Inicie o trajeto';
  }

  const verb = MANEUVER_PT[type] || 'Siga';
  const mod = modifier ? MODIFIER_PT[modifier] || modifier : '';
  const base = mod ? `${verb} ${mod}` : verb === 'Continue' ? 'Siga em frente' : verb;
  return road ? `${base} na ${road}` : base;
}

/** Ângulo CSS (graus) para ícone de seta a partir do modifier OSRM. */
export function maneuverArrowDeg(step: PlannedNavStep | null | undefined): number {
  const modifier = (step?.maneuver?.modifier || '').toLowerCase();
  const type = (step?.maneuver?.type || '').toLowerCase();
  if (type === 'uturn' || modifier === 'uturn') return 180;
  switch (modifier) {
    case 'left':
    case 'sharp left':
      return -90;
    case 'slight left':
      return -45;
    case 'right':
    case 'sharp right':
      return 90;
    case 'slight right':
      return 45;
    case 'straight':
    default:
      return 0;
  }
}

export function formatDistanceKm(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters >= 10_000 ? 0 : 1)} km`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m < 1) return '< 1 min';
  return `${m} min`;
}

export function formatEta(remainingSeconds: number, now = new Date()): string {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds < 0) return '—';
  const eta = new Date(now.getTime() + remainingSeconds * 1000);
  return eta.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function speedKmh(speedMs: number | null | undefined): number {
  if (speedMs == null || !Number.isFinite(speedMs) || speedMs < 0) return 0;
  return Math.round(speedMs * 3.6);
}

export function parseGeometryJson(
  value: unknown,
): { type: 'LineString'; coordinates: LngLat[] } | null {
  if (!value || typeof value !== 'object') return null;
  const g = value as { type?: string; coordinates?: unknown };
  if (g.type !== 'LineString' || !Array.isArray(g.coordinates)) return null;
  const coordinates = g.coordinates.filter(
    (c): c is LngLat =>
      Array.isArray(c) &&
      c.length >= 2 &&
      typeof c[0] === 'number' &&
      typeof c[1] === 'number',
  );
  if (!coordinates.length) return null;
  return { type: 'LineString', coordinates };
}

export function parsePlannedStepsJson(value: unknown): PlannedNavJson | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as PlannedNavJson;
  if (!Array.isArray(p.legs)) return null;
  return p;
}
