import { apiFetch, ApiError } from '@/lib/api-client';
import {
  appendTrackPoint,
  peekTrailSnapshot,
  peekTrackQueue,
  prependTrackQueue,
  takeTrackQueueBatch,
  TRACK_FLUSH_BATCH,
  type StoredTrackPoint,
} from '@/lib/field-track-queue';

export type TrackingPointInput = {
  routeId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  recordedAt?: string | Date | number;
};

function formatGpsClock(d = new Date()) {
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function gpsActiveLabel(d = new Date()) {
  return `GPS ativo · ${formatGpsClock(d)}`;
}

/** Rede/Wi‑Fi — rápido para o pin aparecer. */
export const GEO_COARSE: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 12_000,
  maximumAge: 60_000,
};

/** GPS fino (satélite). */
export const GEO_HIGH_ACCURACY: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 45_000,
  maximumAge: 15_000,
};

/**
 * Watch operacional (rota ativa).
 * Sem timeout: celular parado não deve disparar TIMEOUT só porque não há fix novo.
 */
export const GEO_WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 15_000,
  timeout: Number.POSITIVE_INFINITY,
};

/** Envia se andou ≥ N metros OU passou N ms desde o último POST. */
export const TRACK_MIN_MOVE_M = 15;
export const TRACK_MAX_INTERVAL_MS = 5_000;
/** Amostragem densa ao gravar viagem até a fazenda. */
export const TRACK_RECORD_TRIP_MIN_MOVE_M = 5;
export const TRACK_RECORD_TRIP_INTERVAL_MS = 2_000;

export type RouteGpsWatchOptions = {
  maxIntervalMs?: number;
  minMoveM?: number;
};

function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function getPositionOnce(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation indisponível neste dispositivo'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function isGeolocationPositionError(
  err: unknown,
): err is GeolocationPositionError | { code: number; message?: string } {
  return (
    !!err &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'number'
  );
}

/** TIMEOUT (3) ou POSITION_UNAVAILABLE (2) — vale tentar coarse / não derrubar a sessão. */
export function isTransientGeolocationError(
  err: GeolocationPositionError | { code?: number },
): boolean {
  return err.code === 2 || err.code === 3;
}

/**
 * Posição atual: tenta GPS fino; se timeout/indisponível, cai para rede/Wi‑Fi.
 * Rejeita de verdade em permissão negada ou se as duas tentativas falharem.
 */
export async function requestCurrentPosition(
  options: PositionOptions = GEO_HIGH_ACCURACY,
): Promise<GeolocationPosition> {
  try {
    return await getPositionOnce(options);
  } catch (err) {
    if (!isGeolocationPositionError(err) || err.code === 1) {
      throw err;
    }
    if (!isTransientGeolocationError(err)) {
      throw err;
    }
    // Já pediu coarse explicitamente — não re-tenta o mesmo.
    if (options === GEO_COARSE || options.enableHighAccuracy === false) {
      throw err;
    }
    return getPositionOnce(GEO_COARSE);
  }
}

/**
 * Envia pontos de tracking via HTTP sem redirecionar/recarregar a página.
 * Endpoint: POST /api/v1/tracking/points
 */
export async function postTrackingPoints(
  routeId: string,
  points: StoredTrackPoint[],
): Promise<{ accepted: number }> {
  if (!routeId) {
    throw new ApiError(400, 'Rota não informada para o tracking.');
  }
  const payload = points.map((input) => {
    if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
      throw new ApiError(400, 'Coordenadas GPS inválidas.');
    }
    const point: Record<string, unknown> = {
      routeId,
      latitude: input.latitude,
      longitude: input.longitude,
    };
    if (input.accuracy != null && Number.isFinite(input.accuracy) && input.accuracy >= 0) {
      point.accuracy = input.accuracy;
    }
    if (input.speed != null && Number.isFinite(input.speed)) {
      point.speed = input.speed;
    }
    if (
      input.heading != null &&
      Number.isFinite(input.heading) &&
      input.heading >= 0 &&
      input.heading <= 360
    ) {
      point.heading = input.heading;
    }
    const d = new Date(input.recordedAt);
    if (!Number.isNaN(d.getTime())) {
      point.recordedAt = d.toISOString();
    }
    return point;
  });

  return apiFetch<{ accepted: number }>(
    '/api/v1/tracking/points',
    {
      method: 'POST',
      body: JSON.stringify({ points: payload }),
    },
    { authRedirect: false, retryOn401: true },
  );
}

export async function postTrackingPoint(input: TrackingPointInput): Promise<{ accepted: number }> {
  const recordedAt =
    input.recordedAt instanceof Date
      ? input.recordedAt.getTime()
      : input.recordedAt != null
        ? new Date(input.recordedAt).getTime()
        : Date.now();
  return postTrackingPoints(input.routeId, [
    {
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy ?? null,
      speed: input.speed ?? null,
      heading: input.heading ?? null,
      recordedAt: Number.isFinite(recordedAt) ? recordedAt : Date.now(),
    },
  ]);
}

export function trackingErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return 'Falha ao enviar localização.';
}

export function geolocationErrorMessage(
  err: GeolocationPositionError | { code?: number; message?: string },
): string {
  const code = err.code;
  const insecure =
    typeof window !== 'undefined' &&
    typeof window.isSecureContext === 'boolean' &&
    !window.isSecureContext;

  if (code === 1) {
    if (insecure) {
      return 'GPS bloqueado neste endereço HTTP. No iPhone, Localização exige HTTPS (ou localhost). Use o PC em localhost ou um túnel HTTPS (ex. Cloudflare Tunnel / ngrok).';
    }
    return 'Permissão de localização negada. Em Ajustes → Privacidade → Serviços de Localização, ative para o Safari (ou para o Rotas se estiver instalado como PWA).';
  }
  if (code === 2) {
    return 'GPS indisponível agora. Vá para área aberta e tente de novo.';
  }
  if (code === 3) {
    return 'GPS demorou demais. Verifique se a Localização está ligada e tente Centralizar.';
  }
  return err.message || 'Erro de GPS';
}

export function gpsCatchMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    return geolocationErrorMessage(err as { code?: number; message?: string });
  }
  return 'Não foi possível obter GPS';
}

export function isInsecureGeolocationContext(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.isSecureContext === 'boolean' &&
    !window.isSecureContext
  );
}

export type RouteGpsWatchHandlers = {
  /** Todo fix do browser (UI local: pin/HUD). */
  onPosition?: (pos: GeolocationPosition) => void;
  onError?: (err: GeolocationPositionError) => void;
  /** Depois de um POST aceito (amostrado). */
  onPosted?: () => void;
  onPostError?: (err: unknown) => void;
  onQueueChange?: (stats: { queued: number; posted: number; trail: number }) => void;
};

export type RouteGpsWatchHandle = {
  stop: () => void;
};

export type LocalGpsWatchHandlers = {
  onPosition?: (pos: GeolocationPosition) => void;
  onError?: (err: GeolocationPositionError) => void;
};

function unavailableError(message: string): GeolocationPositionError {
  return {
    code: 2,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

/**
 * Seed rápido (coarse) + watch fino sem timeout.
 * TIMEOUT/UNAVAILABLE com lastKnown já existente são ignorados.
 * Sem lastKnown: tenta um getCurrentPosition coarse antes de propagar o erro.
 */
function startGpsWatchCore(
  handlers: {
    onPosition?: (pos: GeolocationPosition) => void;
    onError?: (err: GeolocationPositionError) => void;
    onFix?: (pos: GeolocationPosition) => void;
  },
): RouteGpsWatchHandle {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    handlers.onError?.(unavailableError('Geolocation indisponível neste dispositivo'));
    return { stop: () => undefined };
  }

  let stopped = false;
  let lastKnown: GeolocationPosition | null = null;
  let coarseRetrying = false;
  let watchId: number | null = null;

  const deliver = (pos: GeolocationPosition) => {
    if (stopped) return;
    lastKnown = pos;
    handlers.onPosition?.(pos);
    handlers.onFix?.(pos);
  };

  const handleWatchError = (err: GeolocationPositionError) => {
    if (stopped) return;
    if (err.code === 1) {
      handlers.onError?.(err);
      return;
    }
    if (isTransientGeolocationError(err)) {
      if (lastKnown) {
        // Celular parado / lock lento — não derruba a sessão.
        return;
      }
      if (coarseRetrying) {
        handlers.onError?.(err);
        return;
      }
      coarseRetrying = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          coarseRetrying = false;
          deliver(pos);
        },
        (retryErr) => {
          coarseRetrying = false;
          if (stopped) return;
          handlers.onError?.(retryErr);
        },
        GEO_COARSE,
      );
      return;
    }
    handlers.onError?.(err);
  };

  // Seed imediato (rede/Wi‑Fi) para o pin aparecer em segundos.
  navigator.geolocation.getCurrentPosition(
    deliver,
    (err) => {
      if (stopped) return;
      if (err.code === 1) handlers.onError?.(err);
      // TIMEOUT/UNAVAILABLE no seed: o watch fino segue tentando
    },
    GEO_COARSE,
  );

  watchId = navigator.geolocation.watchPosition(deliver, handleWatchError, GEO_WATCH_OPTIONS);

  return {
    stop: () => {
      stopped = true;
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    },
  };
}

/**
 * Watch local de GPS sem POST — útil no wizard antes do Play (rota ainda PUBLISHED).
 */
export function startLocalGpsWatch(handlers: LocalGpsWatchHandlers = {}): RouteGpsWatchHandle {
  return startGpsWatchCore({
    onPosition: handlers.onPosition,
    onError: handlers.onError,
  });
}

/**
 * Tracking operacional com watchPosition:
 * Browser → fila local → HTTPS POST /tracking/points (lote) → Nest (PostGIS + Redis).
 * Só faz sentido com rota IN_PROGRESS (o backend rejeita o contrário).
 * Heartbeat reenvia a última posição se o celular estiver parado.
 */
export function startRouteGpsWatch(
  routeId: string,
  handlers: RouteGpsWatchHandlers = {},
  options: RouteGpsWatchOptions = {},
): RouteGpsWatchHandle {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    handlers.onError?.(unavailableError('Geolocation indisponível neste dispositivo'));
    return { stop: () => undefined };
  }

  const maxIntervalMs = options.maxIntervalMs ?? TRACK_MAX_INTERVAL_MS;
  const minMoveM = options.minMoveM ?? TRACK_MIN_MOVE_M;

  let lastEnqueued: { latitude: number; longitude: number; at: number } | null = null;
  let lastKnown: StoredTrackPoint | null = null;
  let posting = false;
  let stopped = false;
  let postedCount = 0;
  let trailCount = 0;
  let backoffMs = 0;
  let backoffUntil = 0;
  let heartbeatId: ReturnType<typeof setInterval> | null = null;
  let retryId: ReturnType<typeof setTimeout> | null = null;

  const emitQueue = (queued: number, trail: number) => {
    trailCount = trail;
    handlers.onQueueChange?.({ queued, posted: postedCount, trail });
  };

  const shouldEnqueue = (lat: number, lng: number, now: number) => {
    if (!lastEnqueued) return true;
    const moved = haversineMeters(lastEnqueued, { latitude: lat, longitude: lng });
    const elapsed = now - lastEnqueued.at;
    return moved >= minMoveM || elapsed >= maxIntervalMs;
  };

  const flushQueue = async (opts?: { evenIfStopped?: boolean }) => {
    if ((!opts?.evenIfStopped && stopped) || posting) return;
    if (Date.now() < backoffUntil) {
      const wait = Math.max(250, backoffUntil - Date.now());
      if (retryId == null) {
        retryId = setTimeout(() => {
          retryId = null;
          void flushQueue();
        }, wait);
      }
      return;
    }

    const batch = takeTrackQueueBatch(routeId, TRACK_FLUSH_BATCH);
    if (!batch.length) return;

    posting = true;
    try {
      await postTrackingPoints(routeId, batch);
      postedCount += batch.length;
      backoffMs = 0;
      handlers.onPosted?.();
      emitQueue(peekTrackQueue(routeId).length, trailCount);
      posting = false;
      if (peekTrackQueue(routeId).length) {
        void flushQueue();
      }
    } catch (e) {
      prependTrackQueue(routeId, batch);
      backoffMs = backoffMs ? Math.min(backoffMs * 2, 30_000) : 2_000;
      backoffUntil = Date.now() + backoffMs;
      handlers.onPostError?.(e);
      emitQueue(peekTrackQueue(routeId).length, trailCount);
      posting = false;
      if (retryId == null && !stopped) {
        retryId = setTimeout(() => {
          retryId = null;
          void flushQueue();
        }, backoffMs);
      }
    }
  };

  const enqueuePoint = (point: StoredTrackPoint) => {
    const stats = appendTrackPoint(routeId, point);
    lastEnqueued = { latitude: point.latitude, longitude: point.longitude, at: Date.now() };
    emitQueue(stats.queued, stats.trail);
    void flushQueue();
  };

  const onFix = (pos: GeolocationPosition) => {
    handlers.onPosition?.(pos);
    const { latitude, longitude, accuracy, speed, heading } = pos.coords;
    lastKnown = {
      latitude,
      longitude,
      accuracy: accuracy ?? null,
      speed: speed ?? null,
      heading: heading ?? null,
      recordedAt: pos.timestamp,
    };
    const now = Date.now();
    if (!shouldEnqueue(latitude, longitude, now)) return;
    enqueuePoint(lastKnown);
  };

  const core = startGpsWatchCore({
    onFix,
    onError: handlers.onError,
  });

  heartbeatId = setInterval(() => {
    if (!lastKnown || stopped) return;
    const now = Date.now();
    if (!shouldEnqueue(lastKnown.latitude, lastKnown.longitude, now)) return;
    enqueuePoint({ ...lastKnown, recordedAt: now });
  }, maxIntervalMs);

  const onVisible = () => {
    if (document.visibilityState === 'visible') void flushQueue();
  };
  const onOnline = () => {
    backoffUntil = 0;
    void flushQueue();
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisible);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
  }

  emitQueue(peekTrackQueue(routeId).length, peekTrailSnapshot(routeId).length);
  void flushQueue();

  return {
    stop: () => {
      stopped = true;
      core.stop();
      if (heartbeatId != null) {
        clearInterval(heartbeatId);
        heartbeatId = null;
      }
      if (retryId != null) {
        clearTimeout(retryId);
        retryId = null;
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
      }
      void flushQueue({ evenIfStopped: true });
    },
  };
}
