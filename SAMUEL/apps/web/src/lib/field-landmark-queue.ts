/** Fila local de marcos (porteira etc.) quando o POST/DELETE falha. */

const KEY = 'samuel:landmark-queue';
const DELETE_KEY = 'samuel:landmark-delete-queue';
const CAP = 40;

export type LandmarkType = 'PORTEIRA' | 'PONTE' | 'BIFURCACAO' | 'ESTRADA_RUIM';

export type PendingLandmark = {
  customerId: string;
  type: LandmarkType;
  latitude: number;
  longitude: number;
  note?: string | null;
};

export type PendingLandmarkDelete = {
  customerId: string;
  landmarkId: string;
};

function readQueue<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeQueue<T>(key: string, items: T[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items.slice(-CAP)));
  } catch {
    // ignore
  }
}

export function enqueueLandmark(item: PendingLandmark) {
  writeQueue(KEY, [...readQueue<PendingLandmark>(KEY), item]);
}

export function peekLandmarkQueue(): PendingLandmark[] {
  return readQueue<PendingLandmark>(KEY);
}

export function takeLandmarkQueue(): PendingLandmark[] {
  const items = readQueue<PendingLandmark>(KEY);
  writeQueue(KEY, []);
  return items;
}

export function prependLandmarkQueue(items: PendingLandmark[]) {
  if (!items.length) return;
  writeQueue(KEY, [...items, ...readQueue<PendingLandmark>(KEY)]);
}

export function enqueueLandmarkDelete(item: PendingLandmarkDelete) {
  const current = readQueue<PendingLandmarkDelete>(DELETE_KEY);
  if (current.some((x) => x.landmarkId === item.landmarkId)) return;
  writeQueue(DELETE_KEY, [...current, item]);
}

export function peekLandmarkDeleteQueue(): PendingLandmarkDelete[] {
  return readQueue<PendingLandmarkDelete>(DELETE_KEY);
}

export function takeLandmarkDeleteQueue(): PendingLandmarkDelete[] {
  const items = readQueue<PendingLandmarkDelete>(DELETE_KEY);
  writeQueue(DELETE_KEY, []);
  return items;
}

export function prependLandmarkDeleteQueue(items: PendingLandmarkDelete[]) {
  if (!items.length) return;
  writeQueue(DELETE_KEY, [...items, ...readQueue<PendingLandmarkDelete>(DELETE_KEY)]);
}
