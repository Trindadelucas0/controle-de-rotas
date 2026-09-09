/** Amostragem de histórico GPS (PostGIS). */

export const HISTORY_MIN_MOVE_M = 25;
export const HISTORY_MAX_INTERVAL_MS = 15_000;
/** Alinhado ao cliente em Gravar viagem (~5 m / 2 s). */
export const HISTORY_RECORD_TRIP_MIN_MOVE_M = 5;
export const HISTORY_RECORD_TRIP_MAX_INTERVAL_MS = 2_000;

export type HistorySample = {
  latitude: number;
  longitude: number;
  at: number;
};

export function trackingSampleThresholds(recordTrip: boolean): {
  minMoveM: number;
  maxIntervalMs: number;
} {
  if (recordTrip) {
    return {
      minMoveM: HISTORY_RECORD_TRIP_MIN_MOVE_M,
      maxIntervalMs: HISTORY_RECORD_TRIP_MAX_INTERVAL_MS,
    };
  }
  return { minMoveM: HISTORY_MIN_MOVE_M, maxIntervalMs: HISTORY_MAX_INTERVAL_MS };
}

export function shouldPersistTrackingSample(input: {
  last: HistorySample | null | undefined;
  latitude: number;
  longitude: number;
  recordedAtMs: number;
  recordTrip: boolean;
  distanceMeters: number;
}): boolean {
  if (!input.last) return true;
  const { minMoveM, maxIntervalMs } = trackingSampleThresholds(input.recordTrip);
  return (
    input.distanceMeters >= minMoveM || input.recordedAtMs - input.last.at >= maxIntervalMs
  );
}
