import {
  clipAccessPathToOrigin,
  haversineMeters,
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
