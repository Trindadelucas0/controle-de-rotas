export type CompanyOrigin = {
  id: string;
  name: string;
  tradeName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationStatus: string;
};

/** Distinct colors for up to 8 employee routes on the map. */
export const ROUTE_LINE_COLORS = [
  '#2EE6C7',
  '#1AB89C',
  '#5EF0D6',
  '#0D9A84',
  '#A8FFF0',
  '#148F7A',
  '#3AD4B8',
  '#067A6A',
] as const;

export function formatDuration(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} h ${rem} min` : `${h} h`;
}

export function formatMeters(m: number) {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function routeColorAt(index: number): string {
  return ROUTE_LINE_COLORS[index % ROUTE_LINE_COLORS.length]!;
}
