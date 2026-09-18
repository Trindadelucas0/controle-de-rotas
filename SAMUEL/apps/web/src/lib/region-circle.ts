import { haversineMeters } from './nav-geometry';

const EARTH_RADIUS_M = 6_371_000;
const CIRCLE_STEPS = 64;

export const DEFAULT_REGION_RADIUS_METERS = 5000;
export const MIN_REGION_RADIUS_METERS = 500;
export const MAX_REGION_RADIUS_METERS = 50_000;

export type RegionCircleFeature = {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: {
    type: 'Polygon';
    coordinates: [number, number][][];
  };
};

export function isRegionMission(route: {
  recordNewCustomer?: boolean | null;
  assignmentRegionRadiusMeters?: number | null;
}): boolean {
  return Boolean(route.recordNewCustomer) && route.assignmentRegionRadiusMeters != null;
}

export function formatRegionKm(radiusMeters: number): string {
  const km = radiusMeters / 1000;
  if (Number.isInteger(km)) return `${km} km`;
  return `${(Math.round(km * 10) / 10).toString()} km`;
}

export function destinationPoint(
  latitude: number,
  longitude: number,
  distanceM: number,
  bearingRad: number,
): { latitude: number; longitude: number } {
  const lat1 = (latitude * Math.PI) / 180;
  const lng1 = (longitude * Math.PI) / 180;
  const ang = distanceM / EARTH_RADIUS_M;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(bearingRad),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { latitude: (lat2 * 180) / Math.PI, longitude: (lng2 * 180) / Math.PI };
}

export function regionCirclePolygon(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  steps = CIRCLE_STEPS,
): RegionCircleFeature {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (2 * Math.PI * i) / steps;
    const p = destinationPoint(latitude, longitude, radiusMeters, bearing);
    ring.push([p.longitude, p.latitude]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

export function regionCircleBounds(
  latitude: number,
  longitude: number,
  radiusMeters: number,
): [[number, number], [number, number]] {
  const north = destinationPoint(latitude, longitude, radiusMeters, 0);
  const east = destinationPoint(latitude, longitude, radiusMeters, Math.PI / 2);
  const south = destinationPoint(latitude, longitude, radiusMeters, Math.PI);
  const west = destinationPoint(latitude, longitude, radiusMeters, (3 * Math.PI) / 2);
  return [
    [west.longitude, south.latitude],
    [east.longitude, north.latitude],
  ];
}

export function metersFromRegionCenter(
  gps: { latitude: number; longitude: number },
  center: { latitude: number; longitude: number },
): number {
  return haversineMeters(gps, center);
}
