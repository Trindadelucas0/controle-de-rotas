'use client';

import { useEffect, useMemo, useRef } from 'react';
import Map, { Layer, Marker, NavigationControl, Source } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { osmRasterStyle, ROUTE_GLOW, ROUTE_LINE } from '@/lib/map-style';
import { LivePositionMarker, type LiveMarkerKind } from '@/components/map/LivePositionMarker';
import { useSmoothedLngLat } from '@/hooks/useSmoothedLngLat';

type PreviewStop = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
};

type StartRoutePreviewMapProps = {
  gps: { latitude: number; longitude: number; heading?: number | null } | null;
  stops: PreviewStop[];
  markerKind: LiveMarkerKind;
};

export function StartRoutePreviewMap({ gps, stops, markerKind }: StartRoutePreviewMapProps) {
  const mapRef = useRef<MapRef>(null);
  const smoothed = useSmoothedLngLat(
    gps
      ? { latitude: gps.latitude, longitude: gps.longitude, heading: gps.heading ?? null }
      : null,
    400,
  );

  const initialView = useMemo(() => {
    if (gps) return { latitude: gps.latitude, longitude: gps.longitude, zoom: 14 };
    if (stops[0]) return { latitude: stops[0].latitude, longitude: stops[0].longitude, zoom: 13 };
    return { latitude: -14.235, longitude: -51.9253, zoom: 4 };
  }, [gps, stops]);

  const routeLine = useMemo(() => {
    if (stops.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: stops.map((s) => [s.longitude, s.latitude] as [number, number]),
      },
    };
  }, [stops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const lngs: number[] = [];
    const lats: number[] = [];
    if (smoothed) {
      lngs.push(smoothed.longitude);
      lats.push(smoothed.latitude);
    }
    for (const s of stops) {
      lngs.push(s.longitude);
      lats.push(s.latitude);
    }
    if (!lngs.length) return;
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 40, maxZoom: 15, duration: 400 },
    );
  }, [smoothed?.latitude, smoothed?.longitude, stops]);

  return (
    <div className="h-[200px] overflow-hidden rounded-xl border border-brand-100">
      <Map
        ref={mapRef}
        initialViewState={initialView}
        mapStyle={osmRasterStyle}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        {routeLine ? (
          <Source id="start-preview-route" type="geojson" data={routeLine}>
            <Layer
              id="start-preview-glow"
              type="line"
              paint={{ 'line-color': ROUTE_GLOW, 'line-width': 8, 'line-opacity': 0.28 }}
            />
            <Layer
              id="start-preview-line"
              type="line"
              paint={{ 'line-color': ROUTE_LINE, 'line-width': 4, 'line-opacity': 0.95 }}
            />
          </Source>
        ) : null}
        {stops.map((s, i) => (
          <Marker key={s.id} latitude={s.latitude} longitude={s.longitude} anchor="bottom">
            <div
              className={`flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white px-1 text-[10px] font-bold shadow ${
                i === 0 ? 'bg-amber-400 text-[#121212]' : 'bg-accent text-white'
              }`}
              aria-label={`Parada ${i + 1}: ${s.label}`}
            >
              {i + 1}
            </div>
          </Marker>
        ))}
        {smoothed ? (
          <LivePositionMarker
            latitude={smoothed.latitude}
            longitude={smoothed.longitude}
            kind={markerKind}
            heading={smoothed.heading}
            label={markerKind === 'person' ? 'Sua posição' : 'Seu veículo'}
          />
        ) : null}
      </Map>
    </div>
  );
}
