/** Fila local de marcos (porteira etc.) quando o POST falha. */

const KEY = 'samuel:landmark-queue';
const CAP = 40;

export type LandmarkType = 'PORTEIRA' | 'PONTE' | 'BIFURCACAO' | 'ESTRADA_RUIM';

export type PendingLandmark = {
  customerId: string;
  type: LandmarkType;
  latitude: number;
  longitude: number;
  note?: string | null;
};

function readQueue(): PendingLandmark[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PendingLandmark[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: PendingLandmark[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(-CAP)));
  } catch {
    // ignore
  }
}

export function enqueueLandmark(item: PendingLandmark) {
  writeQueue([...readQueue(), item]);
}

export function peekLandmarkQueue(): PendingLandmark[] {
  return readQueue();
}

export function takeLandmarkQueue(): PendingLandmark[] {
  const items = readQueue();
  writeQueue([]);
  return items;
}

export function prependLandmarkQueue(items: PendingLandmark[]) {
  if (!items.length) return;
  writeQueue([...items, ...readQueue()]);
}
