import { GeoStop, LatLng, bearingRadians, haversineMeters } from './routes-geo';

const AT_COMPANY_M = 80;

export type EmployeeSlot = {
  id: string;
  name: string;
  position: LatLng;
};

export function balancedCapacities(stopCount: number, employeeCount: number): number[] {
  const base = Math.floor(stopCount / employeeCount);
  const rem = stopCount % employeeCount;
  return Array.from({ length: employeeCount }, (_, i) => base + (i < rem ? 1 : 0));
}

export function allAtCompany(origin: LatLng, employees: EmployeeSlot[]): boolean {
  return employees.every((e) => haversineMeters(origin, e.position) <= AT_COMPANY_M);
}

function clusterSpread(group: GeoStop[]): number {
  let maxD = 0;
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      maxD = Math.max(maxD, haversineMeters(group[i], group[j]));
    }
  }
  return maxD;
}

function splitByAngle(origin: LatLng, stops: GeoStop[], capacities: number[]): GeoStop[][] {
  const indexed = stops.map((item, i) => ({
    item,
    angle: bearingRadians(origin, item),
    i,
  }));
  indexed.sort((a, b) => a.angle - b.angle || a.i - b.i);

  const n = indexed.length;
  let bestScore = Infinity;
  let best: GeoStop[][] = capacities.map(() => []);

  for (let start = 0; start < n; start++) {
    const groups: GeoStop[][] = capacities.map(() => []);
    let cursor = start;
    for (let g = 0; g < capacities.length; g++) {
      for (let c = 0; c < capacities[g]; c++) {
        groups[g].push(indexed[cursor % n].item);
        cursor += 1;
      }
    }
    const score = groups.reduce((sum, group) => sum + clusterSpread(group), 0);
    if (score < bestScore) {
      bestScore = score;
      best = groups;
    }
  }

  return best;
}

function assignNearestPair(employees: EmployeeSlot[], stops: GeoStop[], capacities: number[]): Map<string, GeoStop[]> {
  const remaining = new Set(stops);
  const assigned = new Map<string, GeoStop[]>(employees.map((e) => [e.id, []]));
  const cap = new Map(employees.map((e, i) => [e.id, capacities[i]]));

  while (remaining.size) {
    let bestEmp: string | null = null;
    let bestStop: GeoStop | null = null;
    let bestDist = Infinity;

    for (const emp of employees) {
      if ((cap.get(emp.id) ?? 0) <= 0) continue;
      const group = assigned.get(emp.id)!;
      for (const stop of remaining) {
        let d = haversineMeters(emp.position, stop);
        for (const existing of group) {
          d = Math.min(d, haversineMeters(existing, stop));
        }
        if (d < bestDist) {
          bestDist = d;
          bestEmp = emp.id;
          bestStop = stop;
        }
      }
    }

    if (!bestEmp || !bestStop) break;
    assigned.get(bestEmp)!.push(bestStop);
    remaining.delete(bestStop);
    cap.set(bestEmp, (cap.get(bestEmp) ?? 1) - 1);
  }

  return assigned;
}

export function splitStopsAmongEmployees(
  origin: LatLng,
  employees: EmployeeSlot[],
  stops: GeoStop[],
): Map<string, GeoStop[]> {
  const capacities = balancedCapacities(stops.length, employees.length);

  if (allAtCompany(origin, employees)) {
    const groups = splitByAngle(origin, stops, capacities);
    const result = new Map<string, GeoStop[]>();
    employees.forEach((emp, i) => result.set(emp.id, groups[i] ?? []));
    return result;
  }

  return assignNearestPair(employees, stops, capacities);
}
