import { RouteStopStatus } from '@prisma/client';

/** Distância restante planejada ≤ este valor → pode concluir como COMPLETED. */
export const ROUTE_COMPLETE_REMAINING_TOLERANCE_METERS = 500;

export type StopForRemaining = {
  status: string;
  sequence: number;
  latitude: number;
  longitude: number;
  plannedDistanceMeters?: number | null;
};

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

/**
 * Soma a distância planejada das paradas PENDING.
 * Se `plannedDistanceMeters` faltar, estima haversine a partir da parada anterior.
 * Se não der para estimar com pending > 0, retorna `null` (força fluxo incompleto).
 */
export function remainingPlannedMeters(stops: StopForRemaining[]): number | null {
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
  const pending = ordered.filter((s) => s.status === RouteStopStatus.PENDING);
  if (pending.length === 0) return 0;

  let total = 0;
  let estimatedAny = false;

  for (const stop of pending) {
    if (stop.plannedDistanceMeters != null && Number.isFinite(stop.plannedDistanceMeters)) {
      total += Math.max(0, stop.plannedDistanceMeters);
      estimatedAny = true;
      continue;
    }
    const prev = ordered.find((s) => s.sequence === stop.sequence - 1);
    if (
      prev &&
      Number.isFinite(prev.latitude) &&
      Number.isFinite(prev.longitude) &&
      Number.isFinite(stop.latitude) &&
      Number.isFinite(stop.longitude)
    ) {
      total += haversineMeters(prev.latitude, prev.longitude, stop.latitude, stop.longitude);
      estimatedAny = true;
    }
  }

  if (!estimatedAny) return null;
  return Math.round(total);
}

export function canCompleteAsFinished(
  remainingMeters: number | null,
  pendingCount: number,
): boolean {
  if (pendingCount === 0) return true;
  if (remainingMeters == null) return false;
  return remainingMeters <= ROUTE_COMPLETE_REMAINING_TOLERANCE_METERS;
}
