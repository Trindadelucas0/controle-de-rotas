const CARTO_SUBDOMAINS = ['a', 'b', 'c', 'd'] as const;

/** Chave pública de cota dos basemaps CARTO (visível no Network das tiles). */
function cartoTileUrls(style: 'dark_all' | 'voyager'): string[] {
  const key = process.env.NEXT_PUBLIC_CARTO_BASEMAPS_KEY?.trim();
  const qs = key ? `?key=${encodeURIComponent(key)}` : '';
  return CARTO_SUBDOMAINS.map(
    (s) => `https://${s}.basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}.png${qs}`,
  );
}

/** Menta — somente polyline / glow de rota. */
export const ROUTE_LINE = '#2EE6C7';
export const ROUTE_GLOW = '#2EE6C7';

/** Estilo MapLibre v8 — CARTO Dark Matter. */
export const osmRasterStyle = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: cartoTileUrls('dark_all'),
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background' as const,
      paint: { 'background-color': '#0d0d0d' },
    },
    {
      id: 'osm',
      type: 'raster' as const,
      source: 'osm',
    },
  ],
};

/**
 * Navegação GPS — mesmo Dark Matter (campo e gestor compartilham o mundo).
 */
export const cartoDarkRasterStyle = osmRasterStyle;

export type MapCustomerPin = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  locationStatus: string;
  status: string;
  city: string | null;
  street: string | null;
  number: string | null;
};
