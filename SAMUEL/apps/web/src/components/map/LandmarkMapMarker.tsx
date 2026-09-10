'use client';

import { Marker } from 'react-map-gl/maplibre';

export type LandmarkType = 'PORTEIRA' | 'PONTE' | 'BIFURCACAO' | 'ESTRADA_RUIM';

export const LANDMARK_LABELS: Record<LandmarkType, string> = {
  PORTEIRA: 'Porteira',
  PONTE: 'Ponte',
  BIFURCACAO: 'Bifurcação',
  ESTRADA_RUIM: 'Estrada ruim',
};

type LandmarkMapMarkerProps = {
  latitude: number;
  longitude: number;
  type: LandmarkType | string;
  variant?: 'field' | 'ops';
};

function isLandmarkType(type: string): type is LandmarkType {
  return type in LANDMARK_LABELS;
}

function GateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 12V3.5h10V12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2 5.5h10M7 3.5v8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="5.5" cy="8" r="0.7" fill="currentColor" />
      <circle cx="8.5" cy="8" r="0.7" fill="currentColor" />
    </svg>
  );
}

function BridgeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1.5 11V8.5M12.5 11V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M1.5 8.5c2.2-3.5 8.8-3.5 11 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M1.5 11h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 8.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ForkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 12.5V7M7 7L3 2.5M7 7l4-4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RoughRoadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 2.2 12.3 11.5H1.7L7 2.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M7 5.8v2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="10" r="0.7" fill="currentColor" />
    </svg>
  );
}

function LandmarkGlyph({ type }: { type: LandmarkType }) {
  switch (type) {
    case 'PORTEIRA':
      return <GateIcon />;
    case 'PONTE':
      return <BridgeIcon />;
    case 'BIFURCACAO':
      return <ForkIcon />;
    case 'ESTRADA_RUIM':
      return <RoughRoadIcon />;
  }
}

export function LandmarkMapMarker({
  latitude,
  longitude,
  type,
  variant = 'field',
}: LandmarkMapMarkerProps) {
  const landmarkType: LandmarkType = isLandmarkType(type) ? type : 'ESTRADA_RUIM';
  const label = LANDMARK_LABELS[landmarkType];
  const shell =
    variant === 'field'
      ? 'border-white bg-accent text-white'
      : 'border-white/80 bg-[#1c1c1e] text-accent';

  return (
    <Marker latitude={latitude} longitude={longitude} anchor="bottom">
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-md ${shell}`}
        title={label}
        aria-label={label}
      >
        <LandmarkGlyph type={landmarkType} />
      </div>
    </Marker>
  );
}
