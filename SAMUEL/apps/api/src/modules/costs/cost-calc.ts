export const CONSUMPTION_VARIANCE_RATIO = 0.2;
export const COST_PER_KM_UP_RATIO = 0.25;

export type MetricKind = 'REAL' | 'ESTIMATED' | 'UNAVAILABLE';

export type Metric = {
  kind: MetricKind;
  value: number | null;
  unit?: string;
  reason?: string;
};

export type FuelFillInput = {
  id: string;
  vehicleId: string;
  occurredAt: Date;
  odometerKm: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  status: 'ACTIVE' | 'CANCELLED';
};

export type TankInterval = {
  fromFillId: string;
  toFillId: string;
  fromKm: number;
  toKm: number;
  km: number;
  liters: number;
  kmPerL: number;
  pricePerLiter: number;
  inconsistent: boolean;
};

export function unavailable(reason: string, unit?: string): Metric {
  return { kind: 'UNAVAILABLE', value: null, unit, reason };
}

export function realMetric(value: number, unit?: string): Metric {
  return { kind: 'REAL', value, unit };
}

export function estimatedMetric(value: number, unit?: string, reason?: string): Metric {
  return { kind: 'ESTIMATED', value, unit, reason };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function computeFillTotal(liters: number, pricePerLiter: number): number {
  return round2(liters * pricePerLiter);
}

export function calculateEstimatedFuelLiters(
  distanceKm: number | null | undefined,
  avgConsumptionKmPerL: number | null | undefined,
): Metric {
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm < 0) {
    return unavailable('Sem distância para estimar o consumo.', 'L');
  }
  if (avgConsumptionKmPerL == null || !Number.isFinite(avgConsumptionKmPerL) || avgConsumptionKmPerL <= 0) {
    return unavailable('Veículo sem consumo médio configurado.', 'L');
  }
  return estimatedMetric(round3(distanceKm / avgConsumptionKmPerL), 'L');
}

export function calculateEstimatedFuelCost(
  liters: Metric,
  referencePricePerLiter: number | null | undefined,
): Metric {
  if (liters.kind === 'UNAVAILABLE' || liters.value == null) {
    return unavailable(liters.reason ?? 'Sem litros estimados.', 'BRL');
  }
  if (
    referencePricePerLiter == null ||
    !Number.isFinite(referencePricePerLiter) ||
    referencePricePerLiter < 0
  ) {
    return unavailable('Sem preço de referência da empresa para estimar o custo.', 'BRL');
  }
  return estimatedMetric(round2(liters.value * referencePricePerLiter), 'BRL', liters.reason);
}

export function calculateCostPerKm(cost: Metric, distanceKm: Metric): Metric {
  if (cost.kind === 'UNAVAILABLE' || cost.value == null) {
    return unavailable(cost.reason ?? 'Sem custo para custo/km.', 'BRL/km');
  }
  if (distanceKm.kind === 'UNAVAILABLE' || distanceKm.value == null) {
    return unavailable(distanceKm.reason ?? 'Sem distância para custo/km.', 'BRL/km');
  }
  if (distanceKm.value <= 0) {
    return unavailable('Distância zero: custo/km não calculável.', 'BRL/km');
  }
  const kind: MetricKind = cost.kind === 'REAL' && distanceKm.kind === 'REAL' ? 'REAL' : 'ESTIMATED';
  const metric = { kind, value: round4(cost.value / distanceKm.value), unit: 'BRL/km' };
  return metric;
}

export function calculateCostPerVisit(cost: Metric, visitCount: number | null | undefined): Metric {
  if (cost.kind === 'UNAVAILABLE' || cost.value == null) {
    return unavailable(cost.reason ?? 'Sem custo para ratear por visita.', cost.unit);
  }
  if (visitCount == null || !Number.isFinite(visitCount) || visitCount <= 0) {
    return unavailable('Sem visitas para ratear o custo.');
  }
  return { kind: cost.kind, value: round2(cost.value / visitCount), unit: cost.unit };
}

export function calculateConsumptionVariance(
  realKmPerL: number | null | undefined,
  expectedKmPerL: number | null | undefined,
): Metric {
  if (realKmPerL == null || !Number.isFinite(realKmPerL) || realKmPerL <= 0) {
    return unavailable('Sem consumo real para comparar.', '%');
  }
  if (expectedKmPerL == null || !Number.isFinite(expectedKmPerL) || expectedKmPerL <= 0) {
    return unavailable('Sem consumo esperado cadastrado.', '%');
  }
  return realMetric(round2(((realKmPerL - expectedKmPerL) / expectedKmPerL) * 100), '%');
}

export function tankIntervals(fills: FuelFillInput[]): TankInterval[] {
  const active = fills
    .filter((f) => f.status === 'ACTIVE')
    .slice()
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.odometerKm - b.odometerKm);
  const out: TankInterval[] = [];
  for (let i = 1; i < active.length; i += 1) {
    const prev = active[i - 1]!;
    const curr = active[i]!;
    const km = curr.odometerKm - prev.odometerKm;
    const inconsistent = km <= 0 || curr.liters <= 0;
    const kmPerL = !inconsistent ? km / curr.liters : 0;
    out.push({
      fromFillId: prev.id,
      toFillId: curr.id,
      fromKm: prev.odometerKm,
      toKm: curr.odometerKm,
      km,
      liters: curr.liters,
      kmPerL,
      pricePerLiter: curr.pricePerLiter,
      inconsistent,
    });
  }
  return out;
}

export function calculateRealConsumption(
  fills: FuelFillInput[],
  period?: { from: Date; to: Date },
): Metric {
  const intervals = tankIntervals(fills).filter((iv) => {
    if (iv.inconsistent) return false;
    if (!period) return true;
    const later = fills.find((f) => f.id === iv.toFillId);
    if (!later) return false;
    return later.occurredAt >= period.from && later.occurredAt <= period.to;
  });
  if (intervals.length === 0) {
    const active = fills.filter((f) => f.status === 'ACTIVE');
    if (active.length < 2) {
      return unavailable(
        'Não existem abastecimentos suficientes para determinar o consumo real deste período.',
        'km/L',
      );
    }
    return unavailable(
      'Não há intervalo tanque a tanque válido (km crescente e litros > 0) neste período.',
      'km/L',
    );
  }
  const km = intervals.reduce((s, iv) => s + iv.km, 0);
  const liters = intervals.reduce((s, iv) => s + iv.liters, 0);
  if (liters <= 0) {
    return unavailable('Litros do intervalo inválidos para consumo real.', 'km/L');
  }
  return realMetric(round3(km / liters), 'km/L');
}

export function coveringInterval(
  fills: FuelFillInput[],
  startKm: number,
  endKm: number,
): TankInterval | null {
  const valid = tankIntervals(fills).filter((iv) => !iv.inconsistent);
  const covering = valid.filter((iv) => iv.fromKm <= startKm && iv.toKm >= endKm);
  if (!covering.length) return null;
  covering.sort((a, b) => a.km - b.km);
  return covering[0] ?? null;
}

export function calculateRouteEstimated(input: {
  plannedDistanceMeters: number | null;
  actualDistanceMeters: number | null;
  avgConsumptionKmPerL: number | null;
  referencePricePerLiter: number | null;
  visitCount: number;
}): {
  distanceKm: Metric;
  estimatedLiters: Metric;
  estimatedCost: Metric;
  estimatedCostPerKm: Metric;
  estimatedCostPerVisit: Metric;
  distanceBasis: 'ACTUAL' | 'PLANNED' | null;
} {
  let distanceKm: Metric;
  let distanceBasis: 'ACTUAL' | 'PLANNED' | null = null;
  if (input.actualDistanceMeters != null && input.actualDistanceMeters >= 0) {
    distanceKm = realMetric(round3(input.actualDistanceMeters / 1000), 'km');
    distanceBasis = 'ACTUAL';
  } else if (input.plannedDistanceMeters != null && input.plannedDistanceMeters >= 0) {
    distanceKm = estimatedMetric(
      round3(input.plannedDistanceMeters / 1000),
      'km',
      'Distância planejada: a rota ainda não tem distância real.',
    );
    distanceBasis = 'PLANNED';
  } else {
    distanceKm = unavailable('Rota sem distância planejada nem real.', 'km');
  }

  const kmValue = distanceKm.value;
  const estimatedLiters = calculateEstimatedFuelLiters(kmValue, input.avgConsumptionKmPerL);
  const estimatedCost = calculateEstimatedFuelCost(estimatedLiters, input.referencePricePerLiter);
  return {
    distanceKm,
    estimatedLiters,
    estimatedCost,
    estimatedCostPerKm: calculateCostPerKm(estimatedCost, distanceKm),
    estimatedCostPerVisit: calculateCostPerVisit(estimatedCost, input.visitCount),
    distanceBasis,
  };
}

export function calculateRouteReal(input: {
  startOdometerKm: number | null;
  endOdometerKm: number | null;
  actualDistanceMeters: number | null;
  fills: FuelFillInput[];
  visitCount: number;
}): {
  realCost: Metric;
  realLiters: Metric;
  realCostPerKm: Metric;
  realCostPerVisit: Metric;
} {
  if (input.startOdometerKm == null || input.endOdometerKm == null) {
    const reason =
      'Não disponível. Motivo: a rota não tem km inicial e final para associar abastecimentos.';
    return {
      realCost: unavailable(reason, 'BRL'),
      realLiters: unavailable(reason, 'L'),
      realCostPerKm: unavailable(reason, 'BRL/km'),
      realCostPerVisit: unavailable(reason),
    };
  }
  if (input.actualDistanceMeters == null) {
    const reason = 'Não disponível. Motivo: a rota não tem distância real oficial.';
    return {
      realCost: unavailable(reason, 'BRL'),
      realLiters: unavailable(reason, 'L'),
      realCostPerKm: unavailable(reason, 'BRL/km'),
      realCostPerVisit: unavailable(reason),
    };
  }
  const lo = Math.min(input.startOdometerKm, input.endOdometerKm);
  const hi = Math.max(input.startOdometerKm, input.endOdometerKm);
  const interval = coveringInterval(input.fills, lo, hi);
  if (!interval) {
    const reason =
      'Não disponível. Motivo: não existem abastecimentos suficientes para determinar o consumo real deste período.';
    return {
      realCost: unavailable(reason, 'BRL'),
      realLiters: unavailable(reason, 'L'),
      realCostPerKm: unavailable(reason, 'BRL/km'),
      realCostPerVisit: unavailable(reason),
    };
  }
  const distanceKm = input.actualDistanceMeters / 1000;
  const liters = round3(distanceKm / interval.kmPerL);
  const cost = round2(liters * interval.pricePerLiter);
  const realCost = realMetric(cost, 'BRL');
  const realLiters = realMetric(liters, 'L');
  const kmMetric = realMetric(round3(distanceKm), 'km');
  return {
    realCost,
    realLiters,
    realCostPerKm: calculateCostPerKm(realCost, kmMetric),
    realCostPerVisit: calculateCostPerVisit(realCost, input.visitCount),
  };
}

export function sumActiveFillCost(fills: FuelFillInput[]): Metric {
  const active = fills.filter((f) => f.status === 'ACTIVE');
  const total = round2(active.reduce((s, f) => s + f.totalCost, 0));
  return realMetric(total, 'BRL');
}

export function sumActiveFillLiters(fills: FuelFillInput[]): Metric {
  const active = fills.filter((f) => f.status === 'ACTIVE');
  const total = round3(active.reduce((s, f) => s + f.liters, 0));
  return realMetric(total, 'L');
}

export function sumRouteActualKm(routes: { actualDistanceMeters: number | null; status: string }[]): Metric {
  const done = routes.filter((r) => r.status === 'COMPLETED' || r.status === 'INCOMPLETE');
  if (!done.length) {
    return unavailable('Nenhuma rota concluída no período.', 'km');
  }
  const withActual = done.filter((r) => r.actualDistanceMeters != null && r.actualDistanceMeters >= 0);
  if (!withActual.length) {
    return unavailable('Rotas do período sem distância real.', 'km');
  }
  const km = withActual.reduce((s, r) => s + (r.actualDistanceMeters ?? 0) / 1000, 0);
  return realMetric(round3(km), 'km');
}

export function isConsumptionOffPattern(realKmPerL: number, expectedKmPerL: number): boolean {
  return realKmPerL < expectedKmPerL * (1 - CONSUMPTION_VARIANCE_RATIO);
}

export function isCostPerKmUp(current: number, previous: number): boolean {
  if (previous <= 0) return false;
  return current > previous * (1 + COST_PER_KM_UP_RATIO);
}
