import {
  calculateCostPerKm,
  calculateCostPerVisit,
  calculateConsumptionVariance,
  calculateEstimatedFuelCost,
  calculateEstimatedFuelLiters,
  calculateRealConsumption,
  calculateRouteEstimated,
  calculateRouteReal,
  computeFillTotal,
  coveringInterval,
  isConsumptionOffPattern,
  sumActiveFillCost,
  sumRouteActualKm,
  tankIntervals,
  type FuelFillInput,
} from '../src/modules/costs/cost-calc';

function fill(partial: Partial<FuelFillInput> & Pick<FuelFillInput, 'id' | 'odometerKm' | 'liters'>): FuelFillInput {
  return {
    vehicleId: 'v1',
    occurredAt: new Date('2026-09-17T12:00:00Z'),
    pricePerLiter: 6.19,
    totalCost: computeFillTotal(partial.liters, 6.19),
    status: 'ACTIVE',
    ...partial,
  };
}

describe('cost-calc', () => {
  it('total do abastecimento é litros × preço (servidor)', () => {
    expect(computeFillTotal(42.3, 6.19)).toBe(261.84);
  });

  it('sem consumo cadastrado não devolve 0', () => {
    const m = calculateEstimatedFuelLiters(63.4, null);
    expect(m.kind).toBe('UNAVAILABLE');
    expect(m.value).toBeNull();
  });

  it('estima litros e custo com preço de referência', () => {
    const liters = calculateEstimatedFuelLiters(63.4, 8.2);
    expect(liters.kind).toBe('ESTIMATED');
    expect(liters.value).toBeCloseTo(7.732, 2);
    const cost = calculateEstimatedFuelCost(liters, 6.19);
    expect(cost.kind).toBe('ESTIMATED');
    expect(cost.value).toBe(47.86);
  });

  it('custo estimado sem preço é não calculável', () => {
    const liters = calculateEstimatedFuelLiters(10, 10);
    const cost = calculateEstimatedFuelCost(liters, null);
    expect(cost.kind).toBe('UNAVAILABLE');
    expect(cost.value).toBeNull();
  });

  it('primeiro abastecimento não gera consumo real', () => {
    const m = calculateRealConsumption([fill({ id: 'a', odometerKm: 100, liters: 40 })]);
    expect(m.kind).toBe('UNAVAILABLE');
    expect(m.value).toBeNull();
  });

  it('tanque a tanque: 252 km / 42,3 L', () => {
    const m = calculateRealConsumption([
      fill({ id: 'a', odometerKm: 125430, liters: 38.1, occurredAt: new Date('2026-09-15') }),
      fill({ id: 'b', odometerKm: 125682, liters: 42.3, occurredAt: new Date('2026-09-17') }),
    ]);
    expect(m.kind).toBe('REAL');
    expect(m.value).toBeCloseTo(5.957, 2);
  });

  it('km reverso não entra no consumo real', () => {
    const ivs = tankIntervals([
      fill({ id: 'a', odometerKm: 200, liters: 10, occurredAt: new Date('2026-09-15') }),
      fill({ id: 'b', odometerKm: 100, liters: 10, occurredAt: new Date('2026-09-17') }),
    ]);
    expect(ivs[0]?.inconsistent).toBe(true);
    const m = calculateRealConsumption([
      fill({ id: 'a', odometerKm: 200, liters: 10, occurredAt: new Date('2026-09-15') }),
      fill({ id: 'b', odometerKm: 100, liters: 10, occurredAt: new Date('2026-09-17') }),
    ]);
    expect(m.kind).toBe('UNAVAILABLE');
  });

  it('0 real de gasto quando não há abastecimento ACTIVE', () => {
    const m = sumActiveFillCost([]);
    expect(m.kind).toBe('REAL');
    expect(m.value).toBe(0);
  });

  it('km de rotas sem actualDistance é não calculável, não 0', () => {
    const m = sumRouteActualKm([{ actualDistanceMeters: null, status: 'COMPLETED' }]);
    expect(m.kind).toBe('UNAVAILABLE');
    expect(m.value).toBeNull();
  });

  it('custo/km precisa de distância > 0', () => {
    const m = calculateCostPerKm(
      { kind: 'REAL', value: 100, unit: 'BRL' },
      { kind: 'REAL', value: 0, unit: 'km' },
    );
    expect(m.kind).toBe('UNAVAILABLE');
  });

  it('custo por visita', () => {
    const m = calculateCostPerVisit({ kind: 'ESTIMATED', value: 47.85, unit: 'BRL' }, 5);
    expect(m.value).toBe(9.57);
  });

  it('variação de consumo -27,3%', () => {
    const m = calculateConsumptionVariance(5.96, 8.2);
    expect(m.kind).toBe('REAL');
    expect(m.value).toBe(-27.32);
    expect(isConsumptionOffPattern(5.96, 8.2)).toBe(true);
  });

  it('rota sem par de fills cobre o odômetro: REAL indisponível', () => {
    const r = calculateRouteReal({
      startOdometerKm: 100,
      endOdometerKm: 163.4,
      actualDistanceMeters: 63400,
      fills: [fill({ id: 'a', odometerKm: 90, liters: 20 })],
      visitCount: 5,
    });
    expect(r.realCost.kind).toBe('UNAVAILABLE');
    expect(r.realCost.value).toBeNull();
  });

  it('rota coberta por tanque a tanque calcula custo real', () => {
    const fills = [
      fill({ id: 'a', odometerKm: 100, liters: 30 }),
      fill({ id: 'b', odometerKm: 200, liters: 20, pricePerLiter: 6 }),
    ];
    expect(coveringInterval(fills, 110, 160)?.toFillId).toBe('b');
    const r = calculateRouteReal({
      startOdometerKm: 110,
      endOdometerKm: 160,
      actualDistanceMeters: 50000,
      fills,
      visitCount: 2,
    });
    expect(r.realCost.kind).toBe('REAL');
    expect(r.realLiters.value).toBeCloseTo(10, 2);
    expect(r.realCost.value).toBe(60);
  });

  it('estimativa da rota usa actualDistance quando existe', () => {
    const r = calculateRouteEstimated({
      plannedDistanceMeters: 48000,
      actualDistanceMeters: 63400,
      avgConsumptionKmPerL: 8.2,
      referencePricePerLiter: 6.19,
      visitCount: 5,
    });
    expect(r.distanceBasis).toBe('ACTUAL');
    expect(r.distanceKm.kind).toBe('REAL');
    expect(r.estimatedLiters.kind).toBe('ESTIMATED');
    expect(r.estimatedCost.kind).toBe('ESTIMATED');
  });
});
