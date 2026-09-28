'use client';

import { useEffect, useState } from 'react';
import { Layer, Marker, Source } from 'react-map-gl/maplibre';
import { apiFetch } from '@/lib/api-client';
import { formatRegionKm, regionCirclePolygon } from '@/lib/region-circle';

export type CustomerRegionPin = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

type Props = {
  /** Incrementar depois de salvar ou excluir para redesenhar. */
  reloadToken?: number;
};

export function CustomerRegionCircles({ reloadToken = 0 }: Props) {
  const [regions, setRegions] = useState<CustomerRegionPin[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ regions: CustomerRegionPin[] }>('/api/v1/customer-regions')
      .then((r) => {
        if (!cancelled) setRegions(r.regions ?? []);
      })
      .catch(() => {
        if (!cancelled) setRegions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return (
    <>
      {regions.map((region) => {
        const circle = regionCirclePolygon(region.latitude, region.longitude, region.radiusMeters);
        return (
          <Source key={region.id} id={`customer-region-${region.id}`} type="geojson" data={circle}>
            <Layer
              id={`customer-region-${region.id}-fill`}
              type="fill"
              paint={{ 'fill-color': '#FF5722', 'fill-opacity': 0.14 }}
            />
            <Layer
              id={`customer-region-${region.id}-line`}
              type="line"
              paint={{
                'line-color': '#FF5722',
                'line-width': 2,
                'line-opacity': 0.95,
              }}
            />
          </Source>
        );
      })}
      {regions.map((region) => (
        <Marker
          key={`customer-region-label-${region.id}`}
          latitude={region.latitude}
          longitude={region.longitude}
          anchor="center"
        >
          <span className="pointer-events-none max-w-[10rem] truncate rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {region.name} · {formatRegionKm(region.radiusMeters)}
          </span>
        </Marker>
      ))}
    </>
  );
}
