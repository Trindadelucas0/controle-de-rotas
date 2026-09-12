export const ODOMETER_ROLLBACK_TOLERANCE_KM = 1;
export const ODOMETER_GAP_KM = 50;
export const OFF_ROUTE_ALERT_M = 500;
export const OFF_ROUTE_ALERT_MS = 60_000;

function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Limiar: max(planejado * 1,5, planejado + 5 km). Ex.: 10 km planejado → 15 km. */
export function kmDiscrepancyLimitKm(plannedKm: number): number {
  const safe = Math.max(0, plannedKm);
  return Math.max(safe * 1.5, safe + 5);
}

export function isOdometerKmDiscrepancy(
  plannedMeters: number | null | undefined,
  deltaKm: number,
): boolean {
  if (!Number.isFinite(deltaKm) || deltaKm < 0) return false;
  const plannedKm = (plannedMeters ?? 0) / 1000;
  if (plannedKm <= 0) return deltaKm > 5;
  return deltaKm > kmDiscrepancyLimitKm(plannedKm);
}

export function isOdometerRollback(
  startKm: number,
  lastKm: number | null | undefined,
): boolean {
  if (lastKm == null || !Number.isFinite(lastKm)) return false;
  return startKm < lastKm - ODOMETER_ROLLBACK_TOLERANCE_KM;
}

export function isOdometerGap(
  startKm: number,
  lastKm: number | null | undefined,
): boolean {
  if (lastKm == null || !Number.isFinite(lastKm)) return false;
  return startKm > lastKm + ODOMETER_GAP_KM;
}

export function trailLengthMeters(
  points: { latitude: number; longitude: number }[],
): number {
  let sum = 0;
  for (let i = 1; i < points.length; i += 1) {
    sum += haversineMeters(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude,
    );
  }
  return sum;
}

export function actualDistanceMeters(
  odometerDeltaKm: number | null,
  gpsTrailMeters: number,
): number | null {
  const odoM =
    odometerDeltaKm != null && Number.isFinite(odometerDeltaKm)
      ? Math.round(odometerDeltaKm * 1000)
      : null;
  const gpsM = Number.isFinite(gpsTrailMeters) ? Math.round(gpsTrailMeters) : 0;
  if (odoM != null && gpsM > 0) return Math.max(odoM, gpsM);
  if (odoM != null) return odoM;
  if (gpsM > 0) return gpsM;
  return null;
}
