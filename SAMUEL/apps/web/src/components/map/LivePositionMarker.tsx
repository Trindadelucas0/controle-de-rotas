'use client';

import { Marker } from 'react-map-gl/maplibre';

export type LiveMarkerKind = 'person' | 'car';

type LivePositionMarkerProps = {
  latitude: number;
  longitude: number;
  kind: LiveMarkerKind;
  heading?: number | null;
  accuracyMeters?: number | null;
  label?: string;
  plate?: string | null;
  stale?: boolean;
  onClick?: (e: { originalEvent: { stopPropagation: () => void } }) => void;
};

function PersonIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
      <circle cx="18" cy="18" r="16" fill="#FF5722" fillOpacity="0.22" />
      <circle cx="18" cy="18" r="13" fill="#FF5722" stroke="#ffffff" strokeWidth="2" />
      <circle cx="18" cy="13" r="4" fill="#ffffff" />
      <path
        d="M10 26c1.8-4.2 4.2-6 8-6s6.2 1.8 8 6"
        fill="#ffffff"
        stroke="#ffffff"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CarIcon({ heading }: { heading: number }) {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden
      style={{ transform: `rotate(${heading}deg)` }}
    >
      <circle cx="18" cy="18" r="16" fill="#FF5722" fillOpacity="0.22" />
      <rect
        x="12"
        y="8"
        width="12"
        height="20"
        rx="3.5"
        fill="#FF5722"
        stroke="#ffffff"
        strokeWidth="2"
      />
      <rect x="14" y="11" width="8" height="4" rx="1" fill="#2EE6C7" />
      <rect x="14" y="21" width="8" height="3.5" rx="1" fill="#121212" fillOpacity="0.45" />
      <circle cx="14.5" cy="17.5" r="1.4" fill="#ffffff" />
      <circle cx="21.5" cy="17.5" r="1.4" fill="#ffffff" />
    </svg>
  );
}

export function LivePositionMarker({
  latitude,
  longitude,
  kind,
  heading = null,
  accuracyMeters = null,
  label,
  plate,
  stale = false,
  onClick,
}: LivePositionMarkerProps) {
  const aria =
    label ??
    (kind === 'person' ? 'Sua posição' : plate ? `Veículo ${plate}` : 'Veículo em rota');
  const showHalo =
    accuracyMeters != null && Number.isFinite(accuracyMeters) && accuracyMeters > 0 && accuracyMeters < 80;

  const body = (
    <div
      className={`relative flex flex-col items-center drop-shadow-lg ${stale ? 'opacity-55' : ''}`}
      aria-label={aria}
    >
      {plate ? (
        <span className="mb-0.5 rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
          {plate}
        </span>
      ) : null}
      {showHalo ? (
        <span
          className="pointer-events-none absolute rounded-full bg-accent/20"
          style={{
            width: Math.min(72, 24 + accuracyMeters / 2),
            height: Math.min(72, 24 + accuracyMeters / 2),
            top: plate ? 18 : 0,
          }}
          aria-hidden
        />
      ) : null}
      {kind === 'person' ? <PersonIcon /> : <CarIcon heading={heading ?? 0} />}
    </div>
  );

  if (onClick) {
    return (
      <Marker latitude={latitude} longitude={longitude} anchor="center" onClick={onClick}>
        <button type="button" className="appearance-none border-0 bg-transparent p-0" title={aria}>
          {body}
        </button>
      </Marker>
    );
  }

  return (
    <Marker latitude={latitude} longitude={longitude} anchor="center">
      {body}
    </Marker>
  );
}
