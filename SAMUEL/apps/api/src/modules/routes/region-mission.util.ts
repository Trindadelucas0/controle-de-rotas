export const DEFAULT_REGION_RADIUS_METERS = 5000;
export const MIN_REGION_RADIUS_METERS = 500;
export const MAX_REGION_RADIUS_METERS = 50_000;

export type ResolvedAssignmentRegion = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  regionName: string;
};

export function formatRegionRadiusLabel(radiusMeters: number): string {
  const km = radiusMeters / 1000;
  const text = Number.isInteger(km) ? String(km) : String(Math.round(km * 10) / 10);
  return `Raio ${text} km`;
}

export function resolveAssignmentRegion(input: {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  regionName?: string | null;
}):
  | { ok: true; value: ResolvedAssignmentRegion }
  | { ok: false; code: 'REGION_CENTER_REQUIRED' | 'REGION_RADIUS_INVALID'; message: string } {
  const latitude = input.latitude;
  const longitude = input.longitude;
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return {
      ok: false,
      code: 'REGION_CENTER_REQUIRED',
      message: 'Clique no mapa para definir o centro da região.',
    };
  }

  const radiusMeters =
    input.radiusMeters == null
      ? DEFAULT_REGION_RADIUS_METERS
      : Math.round(Number(input.radiusMeters));
  if (
    !Number.isFinite(radiusMeters) ||
    radiusMeters < MIN_REGION_RADIUS_METERS ||
    radiusMeters > MAX_REGION_RADIUS_METERS
  ) {
    return {
      ok: false,
      code: 'REGION_RADIUS_INVALID',
      message: 'O raio deve ficar entre 500 m e 50 km.',
    };
  }

  const trimmed = typeof input.regionName === 'string' ? input.regionName.trim() : '';
  const regionName =
    trimmed.length > 0
      ? trimmed.slice(0, 200)
      : formatRegionRadiusLabel(radiusMeters);

  return {
    ok: true,
    value: { latitude, longitude, radiusMeters, regionName },
  };
}
