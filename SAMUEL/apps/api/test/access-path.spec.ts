import {
  consolidateTrackingToLineString,
  evaluateAccessReadAuth,
  evaluateLandmarkCreateAuth,
  sanitizeTrailPoints,
  validateRecordTripCustomers,
} from '../src/modules/customers/access-path.util';

describe('validateRecordTripCustomers', () => {
  it('permite quando recordTrip=false com vários clientes', () => {
    expect(validateRecordTripCustomers(false, 3)).toEqual({ ok: true });
  });

  it('permite quando recordTrip=true com 1 cliente', () => {
    expect(validateRecordTripCustomers(true, 1)).toEqual({ ok: true });
  });

  it('permite quando recordTrip=true com vários clientes', () => {
    expect(validateRecordTripCustomers(true, 2)).toEqual({ ok: true });
    expect(validateRecordTripCustomers(true, 5)).toEqual({ ok: true });
  });

  it('recusa recordTrip=true sem clientes', () => {
    const a = validateRecordTripCustomers(true, 0);
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.code).toBe('ROUTE_RECORD_TRIP_NO_CUSTOMERS');
  });
});

describe('evaluateLandmarkCreateAuth', () => {
  const base = {
    actorRole: 'EMPLOYEE',
    actorEmployeeId: 'emp-1',
    customerFoundInTenant: true,
    employeeOnInProgressRouteForCustomer: true,
    routeHasRecordTrip: true,
  };

  it('ADMIN pode criar', () => {
    expect(
      evaluateLandmarkCreateAuth({
        ...base,
        actorRole: 'ADMIN',
        actorEmployeeId: null,
        employeeOnInProgressRouteForCustomer: false,
        routeHasRecordTrip: false,
      }),
    ).toEqual({ ok: true });
  });

  it('EMPLOYEE na rota IN_PROGRESS com Gravar viagem pode criar', () => {
    expect(evaluateLandmarkCreateAuth(base)).toEqual({ ok: true });
  });

  it('EMPLOYEE fora da rota é 403', () => {
    const r = evaluateLandmarkCreateAuth({
      ...base,
      employeeOnInProgressRouteForCustomer: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.statusCode).toBe(403);
      expect(r.code).toBe('LANDMARK_FORBIDDEN');
    }
  });

  it('EMPLOYEE na rota sem Gravar viagem é 403', () => {
    const r = evaluateLandmarkCreateAuth({
      ...base,
      routeHasRecordTrip: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.statusCode).toBe(403);
      expect(r.code).toBe('LANDMARK_RECORD_TRIP_REQUIRED');
    }
  });

  it('cliente de outro tenant é 404', () => {
    const r = evaluateLandmarkCreateAuth({ ...base, customerFoundInTenant: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('CUSTOMER_NOT_FOUND');
  });

  it('SUPERVISOR não cria marco', () => {
    const r = evaluateLandmarkCreateAuth({
      ...base,
      actorRole: 'SUPERVISOR',
      actorEmployeeId: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('AUTH_FORBIDDEN');
  });
});

describe('evaluateAccessReadAuth', () => {
  it('MANAGER lê access', () => {
    expect(
      evaluateAccessReadAuth({ actorRole: 'MANAGER', customerFoundInTenant: true }),
    ).toEqual({ ok: true });
  });

  it('EMPLOYEE não lê access admin', () => {
    const r = evaluateAccessReadAuth({
      actorRole: 'EMPLOYEE',
      customerFoundInTenant: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.statusCode).toBe(403);
  });
});

describe('consolidateTrackingToLineString', () => {
  it('monta LineString com distância e dedupe', () => {
    const r = consolidateTrackingToLineString({
      origin: { latitude: -23.5, longitude: -46.6 },
      points: [
        { latitude: -23.5, longitude: -46.6 },
        { latitude: -23.501, longitude: -46.601 },
        { latitude: -23.502, longitude: -46.602 },
      ],
      destination: { latitude: -23.503, longitude: -46.603 },
    });
    expect(r).not.toBeNull();
    expect(r!.geometry.type).toBe('LineString');
    expect(r!.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
    expect(r!.distanceMeters).toBeGreaterThan(0);
  });

  it('retorna null com menos de 2 pontos úteis', () => {
    expect(
      consolidateTrackingToLineString({
        points: [{ latitude: -23.5, longitude: -46.6 }],
      }),
    ).toBeNull();
  });

  it('keepOriginDestination grava origem e destino mesmo sem GPS no meio', () => {
    const r = consolidateTrackingToLineString({
      points: [],
      origin: { latitude: -23.5, longitude: -46.6 },
      destination: { latitude: -23.51, longitude: -46.61 },
      keepOriginDestination: true,
    });
    expect(r).not.toBeNull();
    expect(r!.geometry.coordinates).toHaveLength(2);
    expect(r!.distanceMeters).toBeGreaterThan(0);
  });

  it('keepOriginDestination mantém 2 pontos se origem ≈ destino', () => {
    const p = { latitude: -23.5, longitude: -46.6 };
    const r = consolidateTrackingToLineString({
      points: [],
      origin: p,
      destination: p,
      keepOriginDestination: true,
    });
    expect(r).not.toBeNull();
    expect(r!.geometry.coordinates).toHaveLength(2);
  });
});

describe('sanitizeTrailPoints', () => {
  const now = Date.parse('2026-09-06T20:00:00.000Z');

  it('aceita até 500 pontos válidos e descarta coords inválidas', () => {
    const out = sanitizeTrailPoints(
      [
        { latitude: -23.5, longitude: -46.6, recordedAt: '2026-09-06T19:00:00.000Z' },
        { latitude: 99, longitude: 0, recordedAt: '2026-09-06T19:00:00.000Z' },
        { latitude: -23.51, longitude: -46.61 },
      ],
      now,
    );
    expect(out).toHaveLength(2);
    expect(out[0].latitude).toBe(-23.5);
  });

  it('descarta timestamp com mais de 24h', () => {
    const out = sanitizeTrailPoints(
      [{ latitude: -23.5, longitude: -46.6, recordedAt: '2026-09-01T00:00:00.000Z' }],
      now,
    );
    expect(out).toHaveLength(0);
  });

  it('não é array → lista vazia (não confiar no cliente)', () => {
    expect(sanitizeTrailPoints({ latitude: -23.5 } as unknown, now)).toEqual([]);
  });
});
