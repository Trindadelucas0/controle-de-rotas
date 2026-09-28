import { grownRadiusMeters } from '../src/modules/customer-regions/customer-region.util';

describe('grownRadiusMeters', () => {
  const center = { latitude: -16.36, longitude: -46.9 };

  it('mantém o raio quando o cliente está dentro', () => {
    const inside = { latitude: -16.37, longitude: -46.9 };
    expect(grownRadiusMeters(center, 50_000, inside)).toBe(50_000);
  });

  it('sobe o raio até a distância do cliente fora, sem mover o centro', () => {
    const far = { latitude: -15.8, longitude: -46.9 };
    const next = grownRadiusMeters(center, 50_000, far);
    expect(next).toBeGreaterThan(50_000);
  });

  it('não muda o raio sem pin', () => {
    expect(grownRadiusMeters(center, 50_000, null)).toBe(50_000);
  });
});
