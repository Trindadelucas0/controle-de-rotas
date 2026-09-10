'use client';

import { useCallback, useRef, useState } from 'react';

type Props = {
  label?: string;
  disabled?: boolean;
  busy?: boolean;
  onComplete: () => void;
};

/**
 * Controle de arrastar até o fim para confirmar ação (campo).
 * Só dispara onComplete ao soltar com progresso ≥ 90%.
 */
export function SlideToComplete({
  label = 'Arraste para concluir a rota',
  disabled,
  busy,
  onComplete,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const dragging = useRef(false);

  const reset = useCallback(() => {
    setProgress(0);
    dragging.current = false;
  }, []);

  const updateFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const thumb = 48;
    const max = Math.max(1, rect.width - thumb);
    const x = Math.min(max, Math.max(0, clientX - rect.left - thumb / 2));
    setProgress(x / max);
  }, []);

  const endDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setProgress((p) => {
      if (p >= 0.9) {
        queueMicrotask(() => onComplete());
        return 0;
      }
      return 0;
    });
  }, [onComplete]);

  const locked = disabled || busy;

  return (
    <div
      ref={trackRef}
      className={`relative h-14 w-full select-none overflow-hidden rounded-full border ${
        locked
          ? 'pointer-events-none border-brand-100 bg-brand-50/50 opacity-60'
          : 'border-brand-200 bg-brand-50'
      }`}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-label={label}
      aria-disabled={locked || undefined}
      onPointerDown={(e) => {
        if (locked) return;
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        updateFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!dragging.current || locked) return;
        updateFromClientX(e.clientX);
      }}
      onPointerUp={endDrag}
      onPointerCancel={reset}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-accent/25"
        style={{ width: `${Math.max(progress * 100, 8)}%` }}
      />
      <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-14 text-center text-xs font-semibold text-brand-800">
        {busy ? 'Concluindo…' : label}
      </p>
      <div
        className="absolute top-1 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow"
        style={{ left: `calc(${progress * 100}% - ${progress * 48}px)` }}
        aria-hidden
      >
        →
      </div>
    </div>
  );
}
