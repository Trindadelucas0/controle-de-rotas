'use client';

import {
  LANDMARK_LABELS,
  type LandmarkType,
} from '@/components/map/LandmarkMapMarker';

type Props = {
  disabled?: boolean;
  busy?: boolean;
  message?: string | null;
  onMark: (type: LandmarkType) => void;
  variant?: 'map' | 'visit';
};

const TYPES = Object.keys(LANDMARK_LABELS) as LandmarkType[];

export function FieldLandmarkButtons({
  disabled,
  busy,
  message,
  onMark,
  variant = 'map',
}: Props) {
  const btnClass =
    variant === 'visit'
      ? 'min-h-11 rounded-xl bg-white/12 px-2 py-2 text-[11px] font-semibold text-white disabled:opacity-50'
      : 'rounded-xl bg-black/65 px-2 py-2 text-[11px] font-semibold text-white disabled:opacity-50';
  const msgClass =
    variant === 'visit'
      ? 'mt-1 text-center text-xs text-white/70'
      : 'mt-1 text-center text-[10px] text-white/70';

  return (
    <div className={variant === 'map' ? 'mb-2' : undefined}>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {TYPES.map((type) => (
          <button
            key={type}
            type="button"
            disabled={disabled || busy}
            onClick={() => onMark(type)}
            className={btnClass}
          >
            {LANDMARK_LABELS[type]}
          </button>
        ))}
      </div>
      {message ? (
        <p
          className={msgClass}
          role={message.endsWith('marcada') ? 'status' : 'alert'}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
