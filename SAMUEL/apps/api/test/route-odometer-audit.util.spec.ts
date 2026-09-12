import {
  actualDistanceMeters,
  isOdometerGap,
  isOdometerKmDiscrepancy,
  isOdometerRollback,
  kmDiscrepancyLimitKm,
  trailLengthMeters,
} from '../src/modules/routes/route-odometer-audit.util';

describe('route-odometer-audit.util', () => {
  it('limiar 10 km planejado é 15 km (max 1,5x e +5)', () => {
    expect(kmDiscrepancyLimitKm(10)).toBe(15);
  });

  it('10 km planejado e 30 km no odômetro é discrepância', () => {
    expect(isOdometerKmDiscrepancy(10_000, 30)).toBe(true);
  });

  it('10 km planejado e 10,4 km não dispara', () => {
    expect(isOdometerKmDiscrepancy(10_000, 10.4)).toBe(false);
  });

  it('rollback se km inicial < último - 1', () => {
    expect(isOdometerRollback(100, 102)).toBe(true);
    expect(isOdometerRollback(101.5, 102)).toBe(false);
  });

  it('gap se km inicial > último + 50', () => {
    expect(isOdometerGap(160, 100)).toBe(true);
    expect(isOdometerGap(140, 100)).toBe(false);
  });

  it('actualDistanceMeters usa o maior entre odômetro e GPS', () => {
    expect(actualDistanceMeters(10, 18_000)).toBe(18_000);
    expect(actualDistanceMeters(12, 8_000)).toBe(12_000);
    expect(actualDistanceMeters(null, 5_000)).toBe(5_000);
  });

  it('trailLengthMeters soma haversine', () => {
    const meters = trailLengthMeters([
      { latitude: -23.55, longitude: -46.63 },
      { latitude: -23.55, longitude: -46.64 },
    ]);
    expect(meters).toBeGreaterThan(800);
    expect(meters).toBeLessThan(2000);
  });
});
