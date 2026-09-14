'use client';

import { useCallback, useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import {
  enqueueLandmark,
  peekLandmarkQueue,
  prependLandmarkQueue,
  takeLandmarkQueue,
  type LandmarkType,
  type PendingLandmark,
} from '@/lib/field-landmark-queue';
import { LANDMARK_LABELS } from '@/components/map/LandmarkMapMarker';

export type LandmarkCoords = { latitude: number; longitude: number };

export type CreatedCustomerLandmark = {
  id: string;
  customerId?: string;
  type: LandmarkType;
  latitude: number;
  longitude: number;
  note: string | null;
  createdBy?: { id: string; name: string } | null;
};

export async function flushLandmarkCreateQueue(
  onEachCreated?: (item: PendingLandmark, landmark: CreatedCustomerLandmark) => void,
): Promise<void> {
  const pending = takeLandmarkQueue();
  if (!pending.length) return;
  const failed: PendingLandmark[] = [];
  for (const item of pending) {
    try {
      const r = await apiFetch<{ landmark: CreatedCustomerLandmark }>(
        `/api/v1/customers/${item.customerId}/landmarks`,
        {
          method: 'POST',
          body: JSON.stringify({
            type: item.type,
            latitude: item.latitude,
            longitude: item.longitude,
          }),
        },
      );
      onEachCreated?.(item, r.landmark);
    } catch {
      failed.push(item);
    }
  }
  if (failed.length) prependLandmarkQueue(failed);
}

export function kickLandmarkCreateQueue(
  onEachCreated?: (item: PendingLandmark, landmark: CreatedCustomerLandmark) => void,
) {
  if (peekLandmarkQueue().length) void flushLandmarkCreateQueue(onEachCreated);
}

type Options = {
  getCustomerId: () => string | null;
  getCoords: () => Promise<LandmarkCoords | null>;
  enabled?: boolean;
  onCreated?: (landmark: CreatedCustomerLandmark) => void;
};

export function useMarkCustomerLandmark({
  getCustomerId,
  getCoords,
  enabled = true,
  onCreated,
}: Options) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const busyRef = useRef(false);

  const mark = useCallback(
    async (type: LandmarkType) => {
      if (!enabled || busyRef.current) return;
      const customerId = getCustomerId();
      if (!customerId) {
        setMessage('Cliente da parada não encontrado.');
        return;
      }
      busyRef.current = true;
      setBusy(true);
      setMessage(null);
      try {
        const coords = await getCoords();
        if (!coords) {
          setMessage('Não foi possível obter o GPS para marcar o marco.');
          return;
        }
        try {
          const r = await apiFetch<{ landmark: CreatedCustomerLandmark }>(
            `/api/v1/customers/${customerId}/landmarks`,
            {
              method: 'POST',
              body: JSON.stringify({
                type,
                latitude: coords.latitude,
                longitude: coords.longitude,
              }),
            },
          );
          onCreated?.(r.landmark);
          setMessage(`${LANDMARK_LABELS[type]} marcada`);
          void flushLandmarkCreateQueue((_item, lm) => onCreated?.(lm));
        } catch (e) {
          enqueueLandmark({
            customerId,
            type,
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
          setMessage(
            e instanceof ApiError
              ? `${e.message} — marco guardado para reenviar`
              : 'Falha ao marcar marco — guardado para reenviar',
          );
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [enabled, getCustomerId, getCoords, onCreated],
  );

  return { mark, busy, message, setMessage };
}
