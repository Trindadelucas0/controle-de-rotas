/** Helpers puros: validação Gravar viagem, consolidação de trilha e marcos. */

export const LANDMARK_NOTE_MAX = 300;
export const LANDMARK_PROXIMITY_M = 120;
export const RECORD_TRIP_MAX_CUSTOMERS = 1;

export type LatLngPoint = { latitude: number; longitude: number };

export type LineStringGeometry = {
  type: 'LineString';
  coordinates: [number, number][];
};

export type RecordTripValidation =
  | { ok: true }
  | { ok: false; code: 'ROUTE_RECORD_TRIP_SINGLE_CUSTOMER'; message: string };

export function validateRecordTripCustomers(
  recordTrip: boolean | undefined,
  customerCount: number,
): RecordTripValidation {
  if (!recordTrip) return { ok: true };
  if (customerCount === RECORD_TRIP_MAX_CUSTOMERS) return { ok: true };
  return {
    ok: false,
    code: 'ROUTE_RECORD_TRIP_SINGLE_CUSTOMER',
    message: 'Gravar viagem exige exatamente 1 cliente na rota.',
  };
}

export function isValidLatLng(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function normalizeLandmarkNote(note: string | null | undefined): string | null {
  if (note == null) return null;
  const trimmed = note.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, LANDMARK_NOTE_MAX);
}

export function haversineMeters(a: LatLngPoint, b: LatLngPoint): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Remove pontos consecutivos quase idênticos (< 2 m). */
export function dedupeConsecutivePoints(
  points: LatLngPoint[],
  minGapMeters = 2,
): LatLngPoint[] {
  if (!points.length) return [];
  const out: LatLngPoint[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = out[out.length - 1];
    if (haversineMeters(prev, points[i]) >= minGapMeters) {
      out.push(points[i]);
    }
  }
  return out;
}

export const TRAIL_POINTS_MAX = 500;
export const TRAIL_POINT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const TRAIL_POINT_FUTURE_SLACK_MS = 5 * 60 * 1000;

export type SanitizedTrailPoint = LatLngPoint & { recordedAt: Date };

/**
 * Valida pontos enviados no check-in/check-out (não confiar no cliente).
 * Descarta coords inválidas, timestamps velhos (>24h) ou no futuro.
 */
export function sanitizeTrailPoints(
  raw: unknown,
  nowMs = Date.now(),
): SanitizedTrailPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: SanitizedTrailPoint[] = [];
  for (const item of raw.slice(0, TRAIL_POINTS_MAX)) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as { latitude?: unknown; longitude?: unknown; recordedAt?: unknown };
    const latitude = Number(rec.latitude);
    const longitude = Number(rec.longitude);
    if (!isValidLatLng(latitude, longitude)) continue;
    let recordedAtMs = nowMs;
    if (rec.recordedAt != null && rec.recordedAt !== '') {
      const t = new Date(rec.recordedAt as string | number | Date).getTime();
      if (Number.isNaN(t)) continue;
      if (t < nowMs - TRAIL_POINT_MAX_AGE_MS) continue;
      if (t > nowMs + TRAIL_POINT_FUTURE_SLACK_MS) continue;
      recordedAtMs = t;
    }
    out.push({ latitude, longitude, recordedAt: new Date(recordedAtMs) });
  }
  return out;
}

function lineStringFromPoints(cleaned: LatLngPoint[]): {
  geometry: LineStringGeometry;
  distanceMeters: number;
} | null {
  if (cleaned.length < 2) return null;
  let distanceMeters = 0;
  for (let i = 1; i < cleaned.length; i += 1) {
    distanceMeters += haversineMeters(cleaned[i - 1], cleaned[i]);
  }
  return {
    geometry: {
      type: 'LineString',
      coordinates: cleaned.map((p) => [p.longitude, p.latitude] as [number, number]),
    },
    distanceMeters: Math.round(distanceMeters),
  };
}

/**
 * Consolida pontos GPS em LineString GeoJSON (lng,lat).
 * Com keepOriginDestination, origem e destino entram mesmo se estiverem a < 2 m
 * (trilha mínima para Gravar viagem).
 */
export function consolidateTrackingToLineString(input: {
  points: LatLngPoint[];
  origin?: LatLngPoint | null;
  destination?: LatLngPoint | null;
  keepOriginDestination?: boolean;
}): { geometry: LineStringGeometry; distanceMeters: number } | null {
  let origin =
    input.origin && isValidLatLng(input.origin.latitude, input.origin.longitude)
      ? input.origin
      : null;
  const destination =
    input.destination && isValidLatLng(input.destination.latitude, input.destination.longitude)
      ? input.destination
      : null;

  if (input.keepOriginDestination && !origin && destination) {
    origin = destination;
  }

  const middles = input.points.filter((p) => isValidLatLng(p.latitude, p.longitude));

  if (input.keepOriginDestination && origin && destination) {
    const inner = dedupeConsecutivePoints(middles).filter(
      (p) => haversineMeters(p, origin!) >= 2 && haversineMeters(p, destination) >= 2,
    );
    return lineStringFromPoints([origin, ...inner, destination]);
  }

  const raw: LatLngPoint[] = [];
  if (origin) raw.push(origin);
  raw.push(...middles);
  if (destination) raw.push(destination);
  return lineStringFromPoints(dedupeConsecutivePoints(raw));
}

export type LandmarkAuthInput = {
  actorRole: string;
  actorEmployeeId: string | null;
  customerFoundInTenant: boolean;
  /** EMPLOYEE: tem rota IN_PROGRESS com parada neste cliente */
  employeeOnInProgressRouteForCustomer: boolean;
};

export type LandmarkAuthResult =
  | { ok: true }
  | { ok: false; statusCode: number; code: string; message: string };

export function evaluateLandmarkCreateAuth(input: LandmarkAuthInput): LandmarkAuthResult {
  if (!input.customerFoundInTenant) {
    return {
      ok: false,
      statusCode: 404,
      code: 'CUSTOMER_NOT_FOUND',
      message: 'Cliente não encontrado.',
    };
  }
  if (input.actorRole === 'ADMIN' || input.actorRole === 'MANAGER') {
    return { ok: true };
  }
  if (input.actorRole === 'EMPLOYEE') {
    if (!input.actorEmployeeId) {
      return {
        ok: false,
        statusCode: 403,
        code: 'EMPLOYEE_PROFILE_REQUIRED',
        message: 'Seu usuário não está vinculado a um funcionário.',
      };
    }
    if (!input.employeeOnInProgressRouteForCustomer) {
      return {
        ok: false,
        statusCode: 403,
        code: 'LANDMARK_FORBIDDEN',
        message: 'Só é possível marcar marcos em rota em andamento deste cliente.',
      };
    }
    return { ok: true };
  }
  return {
    ok: false,
    statusCode: 403,
    code: 'AUTH_FORBIDDEN',
    message: 'Sem permissão para criar marco.',
  };
}

export type AccessReadAuthInput = {
  actorRole: string;
  customerFoundInTenant: boolean;
};

export function evaluateAccessReadAuth(input: AccessReadAuthInput): LandmarkAuthResult {
  if (!input.customerFoundInTenant) {
    return {
      ok: false,
      statusCode: 404,
      code: 'CUSTOMER_NOT_FOUND',
      message: 'Cliente não encontrado.',
    };
  }
  if (input.actorRole === 'ADMIN' || input.actorRole === 'MANAGER') {
    return { ok: true };
  }
  return {
    ok: false,
    statusCode: 403,
    code: 'AUTH_FORBIDDEN',
    message: 'Apenas gestores podem consultar o acesso gravado.',
  };
}
