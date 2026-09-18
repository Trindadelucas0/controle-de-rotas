'use client';

import { useEffect, useMemo, useRef } from 'react';
import Map, { Layer, Marker, ScaleControl, Source } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { osmRasterStyle } from '@/lib/map-style';
import { regionCircleBounds, regionCirclePolygon } from '@/lib/region-circle';

type FieldRegionPreviewMapProps = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export function FieldRegionPreviewMap({
  latitude,
  longitude,
  radiusMeters,
}: FieldRegionPreviewMapProps) {
  const mapRef = useRef<MapRef>(null);
  const circle = useMemo(
    () => regionCirclePolygon(latitude, longitude, radiusMeters),
    [latitude, longitude, radiusMeters],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = regionCircleBounds(latitude, longitude, radiusMeters);
    map.fitBounds(bounds, { padding: 28, maxZoom: 12, duration: 0 });
  }, [latitude, longitude, radiusMeters]);

  return (
    <div className="mt-3 h-40 overflow-hidden rounded-[8px] border border-[var(--border)] sm:h-44">
      <Map
        ref={mapRef}
        initialViewState={{ latitude, longitude, zoom: 11 }}
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
        onLoad={() => {
          const map = mapRef.current;
          if (!map) return;
          map.fitBounds(regionCircleBounds(latitude, longitude, radiusMeters), {
            padding: 28,
            maxZoom: 12,
            duration: 0,
          });
        }}
      >
        <ScaleControl position="bottom-left" unit="metric" maxWidth={80} />
        <Source id="region-circle" type="geojson" data={circle}>
          <Layer
            id="region-circle-fill"
            type="fill"
            paint={{ 'fill-color': '#FF5722', 'fill-opacity': 0.14 }}
          />
          <Layer
            id="region-circle-line"
            type="line"
            paint={{
              'line-color': '#FF5722',
              'line-width': 2,
              'line-opacity': 0.9,
            }}
          />
        </Source>
        <Marker latitude={latitude} longitude={longitude} anchor="bottom">
          <div
            className="h-4 w-4 rounded-full border-2 border-white bg-accent shadow"
            aria-label="Centro da região"
          />
        </Marker>
      </Map>
    </div>
  );
}
