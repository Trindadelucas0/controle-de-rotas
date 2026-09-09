/** Fila local de GPS para Gravar viagem — não descarta ponto se o POST falhar. */

export const TRACK_QUEUE_CAP = 500;
export const TRACK_FLUSH_BATCH = 50;

const QUEUE_PREFIX = 'samuel:track-queue:';
const TRAIL_PREFIX = 'samuel:track-trail:';

export type StoredTrackPoint = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recordedAt: number;
};

function readList(key: string): StoredTrackPoint[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is StoredTrackPoint =>
        !!p &&
        typeof p === 'object' &&
        Number.isFinite((p as StoredTrackPoint).latitude) &&
        Number.isFinite((p as StoredTrackPoint).longitude),
    );
  } catch {
    return [];
  }
}

function writeList(key: string, value: StoredTrackPoint[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota cheia — ignora
  }
}

function cap(list: StoredTrackPoint[]): StoredTrackPoint[] {
  if (list.length <= TRACK_QUEUE_CAP) return list;
  return list.slice(list.length - TRACK_QUEUE_CAP);
}

export function appendTrackPoint(
  routeId: string,
  point: StoredTrackPoint,
): { queued: number; trail: number } {
  const queue = cap([...readList(QUEUE_PREFIX + routeId), point]);
  const trail = cap([...readList(TRAIL_PREFIX + routeId), point]);
  writeList(QUEUE_PREFIX + routeId, queue);
  writeList(TRAIL_PREFIX + routeId, trail);
  return { queued: queue.length, trail: trail.length };
}

export function peekTrackQueue(routeId: string): StoredTrackPoint[] {
  return readList(QUEUE_PREFIX + routeId);
}

export function takeTrackQueueBatch(routeId: string, max = TRACK_FLUSH_BATCH): StoredTrackPoint[] {
  const queue = readList(QUEUE_PREFIX + routeId);
  const batch = queue.slice(0, max);
  writeList(QUEUE_PREFIX + routeId, queue.slice(batch.length));
  return batch;
}

export function prependTrackQueue(routeId: string, points: StoredTrackPoint[]) {
  if (!points.length) return;
  const queue = cap([...points, ...readList(QUEUE_PREFIX + routeId)]);
  writeList(QUEUE_PREFIX + routeId, queue);
}

export function peekTrailSnapshot(routeId: string): StoredTrackPoint[] {
  return readList(TRAIL_PREFIX + routeId);
}

export function trailSnapshotCount(routeId: string): number {
  return readList(TRAIL_PREFIX + routeId).length;
}

export function queuedTrackCount(routeId: string): number {
  return readList(QUEUE_PREFIX + routeId).length;
}

export function clearTrackStorage(routeId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(QUEUE_PREFIX + routeId);
    window.localStorage.removeItem(TRAIL_PREFIX + routeId);
  } catch {
    // ignore
  }
}

export function trailPointsPayload(routeId: string): {
  latitude: number;
  longitude: number;
  recordedAt: string;
}[] {
  return peekTrailSnapshot(routeId).map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    recordedAt: new Date(p.recordedAt).toISOString(),
  }));
}
