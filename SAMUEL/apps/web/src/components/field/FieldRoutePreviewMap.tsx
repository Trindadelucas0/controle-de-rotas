'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import Map, { Layer, Marker, Source } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { osmRasterStyle, ROUTE_GLOW, ROUTE_LINE } from '@/lib/map-style';
import { parseGeometryJson, type LngLat } from '@/lib/nav-geometry';

type PreviewStop = {
  id: string;
  sequence: number;
  latitude: number;
  longitude: number;
  label: string;
};

type FieldRoutePreviewMapProps = {
  geometryJson?: unknown;
  stops: PreviewStop[];
};

export function FieldRoutePreviewMap({ geometryJson, stops }: FieldRoutePreviewMapProps) {
  const mapRef = useRef<MapRef>(null);
  const ordered = useMemo(
    () => [...stops].sort((a, b) => a.sequence - b.sequence),
    [stops],
  );

  const geojson = useMemo(() => {
    const parsed = parseGeometryJson(geometryJson);
    if (parsed && parsed.coordinates.length >= 2) {
      return { type: 'Feature' as const, properties: {}, geometry: parsed };
    }
    if (ordered.length < 2) return null;
    const coordinates: LngLat[] = ordered.map((s) => [s.longitude, s.latitude]);
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates },
    };
  }, [geometryJson, ordered]);

  const fitPreview = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const lngs: number[] = [];
    const lats: number[] = [];
    if (geojson) {
      for (const c of geojson.geometry.coordinates) {
        lngs.push(c[0]);
        lats.push(c[1]);
      }
    }
    for (const s of ordered) {
      lngs.push(s.longitude);
      lats.push(s.latitude);
    }
    if (!lngs.length) return;
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 28, maxZoom: 14, duration: 0 },
    );
  }, [geojson, ordered]);

  useEffect(() => {
    fitPreview();
  }, [fitPreview]);

  if (!ordered.length) return null;

  const first = ordered[0]!;
  const initialView = {
    latitude: first.latitude,
    longitude: first.longitude,
    zoom: 12,
  };

  return (
    <div className="mt-3 h-40 overflow-hidden rounded-[8px] border border-[var(--border)] sm:h-44">
      <Map
        ref={mapRef}
        initialViewState={initialView}
        mapStyle={osmRasterStyle}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        scrollZoom={false}
        dragPan={false}
        dragRotate={false}
        doubleClickZoom={false}
        touchZoomRotate={false}
        pitchWithRotate={false}
        keyboard={false}
        onLoad={fitPreview}
      >
        {geojson ? (
          <Source id="preview-route" type="geojson" data={geojson}>
            <Layer
              id="preview-route-glow"
              type="line"
              paint={{
                'line-color': ROUTE_GLOW,
                'line-width': 8,
                'line-opacity': 0.28,
              }}
            />
            <Layer
              id="preview-route-line"
              type="line"
              paint={{
                'line-color': ROUTE_LINE,
                'line-width': 4,
                'line-opacity': 0.95,
              }}
            />
          </Source>
        ) : null}
        {ordered.map((s) => (
          <Marker key={s.id} latitude={s.latitude} longitude={s.longitude} anchor="bottom">
            <div
              className="flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-accent px-1 text-[10px] font-bold text-white"
              aria-label={`Parada ${s.sequence}: ${s.label}`}
            >
              {s.sequence}
            </div>
          </Marker>
        ))}
      </Map>
    </div>
  );
}
