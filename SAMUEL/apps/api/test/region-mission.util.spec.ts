import {
  DEFAULT_REGION_RADIUS_METERS,
  resolveAssignmentRegion,
} from '../src/modules/routes/region-mission.util';

describe('region-mission.util', () => {
  it('rejeita centro ausente', () => {
    const r = resolveAssignmentRegion({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('REGION_CENTER_REQUIRED');
  });

  it('usa raio 5000 e nome Raio 5 km por omissão', () => {
    const r = resolveAssignmentRegion({ latitude: -23.55, longitude: -46.63 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.radiusMeters).toBe(DEFAULT_REGION_RADIUS_METERS);
    expect(r.value.regionName).toBe('Raio 5 km');
    expect(r.value.latitude).toBe(-23.55);
    expect(r.value.longitude).toBe(-46.63);
  });

  it('rejeita raio fora da faixa', () => {
    const r = resolveAssignmentRegion({
      latitude: -23.55,
      longitude: -46.63,
      radiusMeters: 100,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('REGION_RADIUS_INVALID');
  });
});
