'use client';

import { useEffect, useRef } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import type { MapRef, MapLayerMouseEvent, MarkerDragEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { osmRasterStyle } from '@/lib/map-style';

const BRASIL = { latitude: -14.235, longitude: -51.9253, zoom: 3.8 };

type Props = {
  latitude: number | null;
  longitude: number | null;
  onPinChange: (latitude: number, longitude: number) => void;
  /** Quando false, pin é recomendado mas não obrigatório (ex.: empresa). Default true. */
  required?: boolean;
  title?: string;
  pinLabel?: string;
};

export function CustomerLocationMap({
  latitude,
  longitude,
  onPinChange,
  required = true,
  title,
  pinLabel = 'Pin do cliente',
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const hasPin = latitude != null && longitude != null;
  const heading = title ?? (required ? 'Local no mapa *' : 'Local no mapa');

  useEffect(() => {
    if (!hasPin || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [longitude!, latitude!],
      zoom: Math.max(mapRef.current.getZoom(), 15),
      duration: 600,
    });
  }, [hasPin, latitude, longitude]);

  function handleClick(e: MapLayerMouseEvent) {
    onPinChange(e.lngLat.lat, e.lngLat.lng);
  }

  function handleDragEnd(e: MarkerDragEvent) {
    onPinChange(e.lngLat.lat, e.lngLat.lng);
  }

  function recenter() {
    if (!hasPin || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [longitude!, latitude!],
      zoom: 16,
      duration: 400,
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-brand-900">{heading}</p>
        {hasPin ? (
          <button
            type="button"
            onClick={recenter}
            className="ops-btn ops-btn-secondary text-xs"
          >
            Centralizar pin
          </button>
        ) : null}
      </div>
      <p className="text-xs text-[var(--muted)]">
        Clique no mapa para marcar o local ou preencha CEP/rua para puxar automaticamente. Arraste o
        pin para ajustar.
      </p>
      <div className="h-[280px] overflow-hidden rounded-xl border border-brand-100 bg-brand-50">
        <Map
          ref={mapRef}
          initialViewState={
            hasPin
              ? { latitude: latitude!, longitude: longitude!, zoom: 15 }
              : BRASIL
          }
          mapStyle={osmRasterStyle}
          style={{ width: '100%', height: '100%' }}
          attributionControl
          onClick={handleClick}
          cursor="crosshair"
        >
          <NavigationControl position="bottom-right" />
          {hasPin ? (
            <Marker
              latitude={latitude!}
              longitude={longitude!}
              anchor="bottom"
              draggable
              onDragEnd={handleDragEnd}
            >
              <div
                className="h-4 w-4 rounded-full border-2 border-white bg-brand-600 shadow"
                aria-label={pinLabel}
              />
            </Marker>
          ) : null}
        </Map>
      </div>
      {hasPin ? (
        <p className="font-mono text-xs text-[var(--muted)]">
          Local marcado: {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
        </p>
      ) : (
        <p className="text-xs text-[var(--warn)]">
          {required
            ? 'Ainda sem pin — clique no mapa ou use CEP/endereço.'
            : 'Sem pin — necessário para calcular rotas a partir da empresa.'}
        </p>
      )}
    </div>
  );
}
