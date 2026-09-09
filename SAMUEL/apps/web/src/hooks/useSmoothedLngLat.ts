'use client';

import { useEffect, useRef, useState } from 'react';

export type LngLatTarget = {
  latitude: number;
  longitude: number;
  heading?: number | null;
};

/**
 * Interpola lat/lng (e heading) até o próximo alvo via requestAnimationFrame.
 * Novo ponto no meio do movimento continua a partir da posição já desenhada.
 */
export function useSmoothedLngLat(
  target: LngLatTarget | null,
  durationMs: number,
): LngLatTarget | null {
  const [drawn, setDrawn] = useState<LngLatTarget | null>(target);
  const drawnRef = useRef<LngLatTarget | null>(target);
  const animRef = useRef<number | null>(null);
  const fromRef = useRef<LngLatTarget | null>(null);
  const toRef = useRef<LngLatTarget | null>(null);
  const startAtRef = useRef(0);

  useEffect(() => {
    if (!target) {
      drawnRef.current = null;
      setDrawn(null);
      if (animRef.current != null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      return;
    }

    const current = drawnRef.current;
    if (
      !current ||
      (Math.abs(current.latitude - target.latitude) < 1e-8 &&
        Math.abs(current.longitude - target.longitude) < 1e-8)
    ) {
      drawnRef.current = target;
      setDrawn(target);
      return;
    }

    fromRef.current = current;
    toRef.current = target;
    startAtRef.current = performance.now();

    const tick = (now: number) => {
      const from = fromRef.current;
      const to = toRef.current;
      if (!from || !to) return;

      const t = Math.min(1, (now - startAtRef.current) / Math.max(16, durationMs));
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const next: LngLatTarget = {
        latitude: from.latitude + (to.latitude - from.latitude) * ease,
        longitude: from.longitude + (to.longitude - from.longitude) * ease,
        heading: lerpHeading(from.heading, to.heading, ease),
      };
      drawnRef.current = next;
      setDrawn(next);

      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        animRef.current = null;
        drawnRef.current = to;
        setDrawn(to);
      }
    };

    if (animRef.current != null) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current != null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
  }, [target?.latitude, target?.longitude, target?.heading, durationMs]);

  return drawn;
}

function lerpHeading(a: number | null | undefined, b: number | null | undefined, t: number) {
  if (a == null || !Number.isFinite(a)) return b ?? null;
  if (b == null || !Number.isFinite(b)) return a;
  let delta = ((b - a + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
}
