import { haversineMeters, type LatLng } from '../routes/routes-geo';

export const MIN_CUSTOMER_REGION_RADIUS_METERS = 500;
export const MAX_CUSTOMER_REGION_SLIDER_METERS = 50_000;

export function normalizeRegionName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  if (!name || name.length > 200) return null;
  return name;
}

export function isSliderRadiusMeters(value: unknown): value is number {
  const radius = typeof value === 'number' ? value : Number(value);
  return (
    Number.isFinite(radius) &&
    Number.isInteger(radius) &&
    radius >= MIN_CUSTOMER_REGION_RADIUS_METERS &&
    radius <= MAX_CUSTOMER_REGION_SLIDER_METERS
  );
}

export function isRegionLatLng(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/** Raio gravado: o maior entre o pedido e a distância até o pin (arredondada para cima). */
export function grownRadiusMeters(
  center: LatLng,
  radiusMeters: number,
  point: LatLng | null,
): number {
  if (!point) return radiusMeters;
  const dist = Math.ceil(haversineMeters(center, point));
  if (!Number.isFinite(dist)) return radiusMeters;
  return Math.max(radiusMeters, dist);
}
