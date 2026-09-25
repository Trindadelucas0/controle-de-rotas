import {
  clipAccessPathToOrigin,
  haversineMeters,
  legFromAccessPath,
  legWithAccessPath,
  orderByDurationMatrix,
  tripFromAccessPath,
  type GeoStop,
  type RouteOrigin,
} from '../src/modules/routes/routes-geo';

const originBase: RouteOrigin = {
  name: 'GPS',
  latitude: -16.045,
  longitude: -47,
  address: null,
};

const stop: GeoStop = {
  id: 'visit-1',
  customerId: 'cust-1',
  name: 'Fazenda',
  city: null,
  street: null,
  number: null,
  serviceOrderNumber: 1,
  serviceOrderTitle: 'OS',
  latitude: -16.09,
  longitude: -47,
};

/** ~10 km norte-sul (1° lat ≈ 111 km). */
const tenKmTrail: [number, number][] = [
  [-47, -16.0],
  [-47, -16.045],
  [-47, -16.09],
];

describe('clipAccessPathToOrigin', () => {
  it('recorta a trilha a partir do meio (~5 km restantes)', () => {
    const mid: { latitude: number; longitude: number } = {
      latitude: -16.045,
      longitude: -47,
    };
    const clipped = clipAccessPathToOrigin(mid, tenKmTrail);
    const dist = haversineMeters(
      { latitude: clipped[0][1], longitude: clipped[0][0] },
      { latitude: clipped[clipped.length - 1][1], longitude: clipped[clipped.length - 1][0] },
    );
    expect(dist).toBeGreaterThan(4_500);
    expect(dist).toBeLessThan(5_500);
    expect(clipped[0][1]).toBeCloseTo(-16.045, 3);
    expect(clipped[0][1]).not.toBeCloseTo(-16.0, 2);
  });

  it('prefixa a origem quando o funcionário está longe da trilha', () => {
    const far = { latitude: -16.045, longitude: -46.98 };
    const clipped = clipAccessPathToOrigin(far, tenKmTrail);
    expect(clipped[0][0]).toBeCloseTo(-46.98, 4);
    expect(clipped[0][1]).toBeCloseTo(-16.045, 4);
    expect(clipped.length).toBeGreaterThanOrEqual(3);
  });
});

describe('legFromAccessPath', () => {
  it('recorta e retorna perna com passo Caminho gravado', () => {
    const leg = legFromAccessPath(originBase, stop, {
      type: 'LineString',
      coordinates: tenKmTrail,
    });
    // Pode ter 2 ou 3 pontos dependendo do recorte
    expect(leg.geometry.length).toBeGreaterThanOrEqual(2);
    expect(leg.distanceMeters).toBeGreaterThan(4_500);
    expect(leg.distanceMeters).toBeLessThan(5_500);
    expect(leg.steps).toHaveLength(1);
    expect(leg.steps[0].name).toBe('Caminho gravado');
  });

  it('prefixá a origem quando longe', () => {
    const far = { latitude: -16.045, longitude: -46.98 };
    const leg = legFromAccessPath(far, stop, {
      type: 'LineString',
      coordinates: tenKmTrail,
    });
    expect(leg.geometry[0][0]).toBeCloseTo(-46.98, 4);
    expect(leg.geometry[0][1]).toBeCloseTo(-16.045, 4);
  });
});

describe('legWithAccessPath', () => {
  it('detecta se está perto (≤50m) e não precisa aproximação', () => {
    const { needsApproach, accessLeg } = legWithAccessPath(originBase, stop, {
      type: 'LineString',
      coordinates: tenKmTrail,
    });
    expect(needsApproach).toBe(false);
    expect(accessLeg.distanceMeters).toBeGreaterThan(4_500);
  });

  it('detecta se está longe e precisa OSRM/reta', () => {
    const far = { latitude: -16.045, longitude: -46.8 }; // ~20 km a leste
    const { needsApproach } = legWithAccessPath(far, stop, {
      type: 'LineString',
      coordinates: tenKmTrail,
    });
    expect(needsApproach).toBe(true);
  });
});

describe('orderByDurationMatrix', () => {
  it('escolhe a parada mais rápida, não a mais perto em linha reta', () => {
    // Índices: 0 origem, 1 A (perto e lenta), 2 B, 3 C (longe e rápida).
    // Proximidade A→B→C seria [0, 1, 2]. Duração: C primeiro, depois A, depois B.
    const duration: Array<Array<number | null>> = [
      [0, 600, 500, 100],
      [600, 0, 50, 900],
      [500, 50, 0, 900],
      [100, 40, 400, 0],
    ];
    expect(orderByDurationMatrix(duration)).toEqual([2, 0, 1]);
  });
});

describe('tripFromAccessPath', () => {
  it('não usa o distanceMeters total da gravação do admin', () => {
    const trip = tripFromAccessPath(
      originBase,
      stop,
      { type: 'LineString', coordinates: tenKmTrail },
      99_999,
      false,
    );
    expect(trip.totals.distanceMeters).toBeGreaterThan(4_500);
    expect(trip.totals.distanceMeters).toBeLessThan(5_500);
    expect(trip.geometry.coordinates[0][1]).toBeCloseTo(-16.045, 3);
    expect(trip.stops[0].durationSeconds).toBe(
      Math.round(trip.stops[0].distanceMeters / 11.1),
    );
  });
});
