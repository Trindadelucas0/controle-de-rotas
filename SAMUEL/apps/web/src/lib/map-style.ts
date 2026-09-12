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
/** Trilha GPS real (congelada) — âmbar, distinta do plano. */
export const ROUTE_EXECUTED_LINE = '#F5A524';
export const ROUTE_EXECUTED_GLOW = '#F5A524';

function buildRasterStyle(style: 'dark_all' | 'voyager', background: string) {
  return {
    version: 8 as const,
    sources: {
      osm: {
        type: 'raster' as const,
        tiles: cartoTileUrls(style),
        tileSize: 256,
        attribution: '© OpenStreetMap © CARTO',
        maxzoom: 20,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background' as const,
        paint: { 'background-color': background },
      },
      {
        id: 'osm',
        type: 'raster' as const,
        source: 'osm',
      },
    ],
  };
}

/** Estilo MapLibre v8 — CARTO Dark Matter. */
export const osmRasterStyle = buildRasterStyle('dark_all', '#0d0d0d');

/** Estilo claro — CARTO Voyager. */
export const osmLightRasterStyle = buildRasterStyle('voyager', '#f4f4f5');

/**
 * Navegação GPS — mesmo Dark Matter (campo permanece escuro).
 */
export const cartoDarkRasterStyle = osmRasterStyle;

export function getRasterStyleForTheme(theme: 'dark' | 'light') {
  return theme === 'light' ? osmLightRasterStyle : osmRasterStyle;
}

export type MapCustomerPin = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  locationStatus: string;
  status: string;
  profileIncomplete?: boolean;
  city: string | null;
  street: string | null;
  number: string | null;
};
