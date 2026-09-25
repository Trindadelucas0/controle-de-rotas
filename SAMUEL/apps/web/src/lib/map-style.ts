import type { RequestTransformFunction } from 'maplibre-gl';

const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAPS_KEY?.trim() ?? '';

/** Estilo MapLibre — CARTO Dark Matter vetorial. */
export const osmRasterStyle = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/** Estilo claro — CARTO Voyager vetorial. */
export const osmLightRasterStyle = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

/**
 * Navegação GPS — mesmo Dark Matter (campo permanece escuro).
 */
export const cartoDarkRasterStyle = osmRasterStyle;

export function getRasterStyleForTheme(theme: 'dark' | 'light') {
  return theme === 'light' ? osmLightRasterStyle : osmRasterStyle;
}

/** Acrescenta a chave pública de cota em pedidos cartocdn.com. */
export const cartoTransformRequest: RequestTransformFunction = (url) => {
  if (!CARTO_KEY) return { url };
  if (!url.includes('cartocdn.com')) return { url };
  if (/[?&]key=/.test(url)) return { url };
  const sep = url.includes('?') ? '&' : '?';
  return { url: `${url}${sep}key=${encodeURIComponent(CARTO_KEY)}` };
};

/** Menta — somente polyline / glow de rota. */
export const ROUTE_LINE = '#2EE6C7';
export const ROUTE_GLOW = '#2EE6C7';
/** Trilha GPS real (congelada) — âmbar, distinta do plano. */
export const ROUTE_EXECUTED_LINE = '#F5A524';
export const ROUTE_EXECUTED_GLOW = '#F5A524';

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
