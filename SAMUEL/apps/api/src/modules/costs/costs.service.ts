import { Injectable, HttpStatus } from '@nestjs/common';
import {
  FuelFillStatus,
  Prisma,
  RouteStatus,
  UserRole,
} from '@prisma/client';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  calculateConsumptionVariance,
  calculateRealConsumption,
  calculateRouteEstimated,
  calculateRouteReal,
  isConsumptionOffPattern,
  isCostPerKmUp,
  sumActiveFillCost,
  sumActiveFillLiters,
  sumRouteActualKm,
  tankIntervals,
  type FuelFillInput,
  type Metric,
} from './cost-calc';
import { CostsQueryDto } from './dto/costs.dto';

function num(v: Prisma.Decimal | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

function periodBounds(query: CostsQueryDto): { from: Date; to: Date } {
  const now = new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = query.to
    ? new Date(`${query.to}T23:59:59.999Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { from, to };
}

function toFillInput(row: {
  id: string;
  vehicleId: string;
  occurredAt: Date;
  odometerKm: Prisma.Decimal;
  liters: Prisma.Decimal;
  pricePerLiter: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  status: FuelFillStatus;
}): FuelFillInput {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    occurredAt: row.occurredAt,
    odometerKm: num(row.odometerKm) ?? 0,
    liters: num(row.liters) ?? 0,
    pricePerLiter: num(row.pricePerLiter) ?? 0,
    totalCost: num(row.totalCost) ?? 0,
    status: row.status,
  };
}

@Injectable()
export class CostsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertOfficeRead(user: AuthUser) {
    if (user.role === UserRole.EMPLOYEE) {
      throw httpError(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', 'Você não tem permissão para esta ação.');
    }
  }

  async dashboard(user: AuthUser, query: CostsQueryDto) {
    this.assertOfficeRead(user);
    const { from, to } = periodBounds(query);
    const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    const prevTo = new Date(from.getTime() - 1);

    const fillWhere: Prisma.FuelFillWhereInput = {
      companyId: user.companyId,
      occurredAt: { gte: from, lte: to },
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.fuelType ? { fuelType: { equals: query.fuelType, mode: 'insensitive' } } : {}),
    };

    const [fills, allFillsForTank, routes, vehicles, company] = await Promise.all([
      this.prisma.fuelFill.findMany({
        where: fillWhere,
        include: { vehicle: { select: { id: true, plate: true } }, evidence: { select: { id: true } } },
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.fuelFill.findMany({
        where: {
          companyId: user.companyId,
          status: FuelFillStatus.ACTIVE,
          ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
        },
      }),
      this.prisma.route.findMany({
        where: {
          companyId: user.companyId,
          date: { gte: from, lte: to },
          status: { in: [RouteStatus.COMPLETED, RouteStatus.INCOMPLETE] },
          ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
          ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        },
        select: {
          id: true,
          vehicleId: true,
          actualDistanceMeters: true,
          status: true,
        },
      }),
      this.prisma.vehicle.findMany({
        where: {
          companyId: user.companyId,
          ...(query.vehicleId ? { id: query.vehicleId } : {}),
        },
        select: { id: true, plate: true, avgConsumption: true },
      }),
      this.prisma.company.findUnique({
        where: { id: user.companyId },
        select: { fuelReceiptRequired: true, referenceFuelPricePerLiter: true },
      }),
    ]);

    const fillInputs = fills.map(toFillInput);
    const spent = sumActiveFillCost(fillInputs);
    const liters = sumActiveFillLiters(fillInputs);
    const km = sumRouteActualKm(routes);
    const costPerKm = spent.kind === 'REAL' && km.kind === 'REAL' && km.value && km.value > 0
      ? { kind: 'REAL' as const, value: Math.round((spent.value! / km.value) * 10000) / 10000, unit: 'BRL/km' }
      : { kind: 'UNAVAILABLE' as const, value: null, unit: 'BRL/km', reason: km.reason ?? 'Sem km real e gasto no período.' };

    const prevFills = await this.prisma.fuelFill.findMany({
      where: {
        companyId: user.companyId,
        status: FuelFillStatus.ACTIVE,
        occurredAt: { gte: prevFrom, lte: prevTo },
        ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      },
    });
    const prevRoutes = await this.prisma.route.findMany({
      where: {
        companyId: user.companyId,
        date: { gte: prevFrom, lte: prevTo },
        status: { in: [RouteStatus.COMPLETED, RouteStatus.INCOMPLETE] },
        ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      },
      select: { actualDistanceMeters: true, status: true },
    });
    const prevSpent = sumActiveFillCost(prevFills.map(toFillInput));
    const prevKm = sumRouteActualKm(prevRoutes);

    const byVehicle = vehicles.map((v) => {
      const vFills = fillInputs.filter((f) => f.vehicleId === v.id && f.status === 'ACTIVE');
      const vAll = allFillsForTank.filter((f) => f.vehicleId === v.id).map(toFillInput);
      const vRoutes = routes.filter((r) => r.vehicleId === v.id);
      const vSpent = sumActiveFillCost(vFills);
      const vKm = sumRouteActualKm(vRoutes);
      const consumption = calculateRealConsumption(vAll, { from, to });
      const expected = v.avgConsumption;
      const variance =
        consumption.value != null && expected != null
          ? calculateConsumptionVariance(consumption.value, expected)
          : { kind: 'UNAVAILABLE' as const, value: null, reason: 'Sem par esperado × real.', unit: '%' };
      return {
        vehicleId: v.id,
        plate: v.plate,
        spent: vSpent,
        km: vKm,
        consumption,
        expectedKmPerL: expected,
        variance,
      };
    });

    const alerts: { code: string; message: string }[] = [];
    for (const row of byVehicle) {
      if (
        row.consumption.value != null &&
        row.expectedKmPerL != null &&
        isConsumptionOffPattern(row.consumption.value, row.expectedKmPerL)
      ) {
        alerts.push({
          code: 'CONSUMPTION_VARIANCE',
          message: `Consumo fora do padrão · ${row.plate}: esperado ${row.expectedKmPerL} km/L, real ${row.consumption.value} km/L.`,
        });
      }
      const intervals = tankIntervals(allFillsForTank.filter((f) => f.vehicleId === row.vehicleId).map(toFillInput));
      if (intervals.some((iv) => iv.inconsistent)) {
        alerts.push({
          code: 'ODOMETER_INCONSISTENT',
          message: `Odômetro inconsistente · ${row.plate}: leitura menor ou igual à anterior num abastecimento.`,
        });
      }
    }
    if (company?.fuelReceiptRequired) {
      const missing = fills.filter((f) => f.status === FuelFillStatus.ACTIVE && f.evidence.length === 0);
      if (missing.length) {
        alerts.push({
          code: 'MISSING_RECEIPT',
          message: `${missing.length} abastecimento(s) sem comprovante.`,
        });
      }
    }
    if (
      costPerKm.kind === 'REAL' &&
      costPerKm.value != null &&
      prevSpent.kind === 'REAL' &&
      prevKm.kind === 'REAL' &&
      prevKm.value &&
      prevKm.value > 0 &&
      prevSpent.value != null
    ) {
      const prevCpk = prevSpent.value / prevKm.value;
      if (isCostPerKmUp(costPerKm.value, prevCpk)) {
        alerts.push({
          code: 'COST_PER_KM_UP',
          message: `Aumento de custo/km: período anterior R$ ${prevCpk.toFixed(2)}/km, atual R$ ${costPerKm.value.toFixed(2)}/km.`,
        });
      }
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      spent,
      liters,
      km,
      costPerKm,
      vehicles: byVehicle,
      alerts,
    };
  }

  async vehicle(user: AuthUser, vehicleId: string, query: CostsQueryDto) {
    this.assertOfficeRead(user);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, companyId: user.companyId },
    });
    if (!vehicle) {
      throw httpError(HttpStatus.NOT_FOUND, 'VEHICLE_NOT_FOUND', 'Veículo não encontrado.');
    }
    const { from, to } = periodBounds(query);
    const fills = await this.prisma.fuelFill.findMany({
      where: { companyId: user.companyId, vehicleId },
    });
    const periodFills = fills.filter((f) => f.occurredAt >= from && f.occurredAt <= to);
    const routes = await this.prisma.route.findMany({
      where: {
        companyId: user.companyId,
        vehicleId,
        date: { gte: from, lte: to },
        status: { in: [RouteStatus.COMPLETED, RouteStatus.INCOMPLETE] },
      },
      select: { actualDistanceMeters: true, status: true },
    });
    const spent = sumActiveFillCost(periodFills.map(toFillInput));
    const km = sumRouteActualKm(routes);
    const consumption = calculateRealConsumption(fills.map(toFillInput), { from, to });
    const readings = await this.prisma.odometerReading.findMany({
      where: { companyId: user.companyId, vehicleId },
      orderBy: { occurredAt: 'desc' },
      take: 30,
    });
    return {
      vehicle: {
        id: vehicle.id,
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        fuelType: vehicle.fuelType,
        capacity: vehicle.capacity,
        avgConsumption: vehicle.avgConsumption,
        odometerKm: vehicle.odometerKm,
      },
      from: from.toISOString(),
      to: to.toISOString(),
      spent,
      km,
      costPerKm:
        spent.value != null && km.value != null && km.value > 0
          ? { kind: 'REAL' as const, value: Math.round((spent.value / km.value) * 10000) / 10000, unit: 'BRL/km' }
          : { kind: 'UNAVAILABLE' as const, value: null, reason: 'Sem gasto e km reais no período.', unit: 'BRL/km' },
      consumption,
      expectedKmPerL: vehicle.avgConsumption,
      variance: calculateConsumptionVariance(consumption.value, vehicle.avgConsumption),
      readings: readings.map((r) => ({
        id: r.id,
        source: r.source,
        km: num(r.km),
        occurredAt: r.occurredAt.toISOString(),
        routeId: r.routeId,
        fuelFillId: r.fuelFillId,
      })),
    };
  }

  async route(user: AuthUser, routeId: string) {
    this.assertOfficeRead(user);
    const route = await this.prisma.route.findFirst({
      where: { id: routeId, companyId: user.companyId },
      include: {
        vehicle: true,
        stops: { select: { id: true } },
      },
    });
    if (!route) {
      throw httpError(HttpStatus.NOT_FOUND, 'ROUTE_NOT_FOUND', 'Rota não encontrada.');
    }
    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
      select: { referenceFuelPricePerLiter: true },
    });
    const fills = route.vehicleId
      ? await this.prisma.fuelFill.findMany({
          where: { companyId: user.companyId, vehicleId: route.vehicleId, status: FuelFillStatus.ACTIVE },
        })
      : [];
    const estimated = calculateRouteEstimated({
      plannedDistanceMeters: route.plannedDistanceMeters,
      actualDistanceMeters: route.actualDistanceMeters,
      avgConsumptionKmPerL: route.vehicle?.avgConsumption ?? null,
      referencePricePerLiter: num(company?.referenceFuelPricePerLiter ?? null),
      visitCount: route.stops.length,
    });
    const real = calculateRouteReal({
      startOdometerKm: route.startOdometerKm,
      endOdometerKm: route.endOdometerKm,
      actualDistanceMeters: route.actualDistanceMeters,
      fills: fills.map(toFillInput),
      visitCount: route.stops.length,
    });
    const relatedFills = fills
      .map(toFillInput)
      .filter((f) => {
        if (route.startOdometerKm == null || route.endOdometerKm == null) return false;
        const lo = Math.min(route.startOdometerKm, route.endOdometerKm);
        const hi = Math.max(route.startOdometerKm, route.endOdometerKm);
        return f.odometerKm >= lo && f.odometerKm <= hi;
      })
      .map((f) => ({ id: f.id, odometerKm: f.odometerKm, liters: f.liters, totalCost: f.totalCost }));

    return {
      routeId: route.id,
      plannedDistanceMeters: route.plannedDistanceMeters,
      actualDistanceMeters: route.actualDistanceMeters,
      visitCount: route.stops.length,
      ...estimated,
      ...real,
      relatedFills,
    };
  }

  async odometerReadings(user: AuthUser, vehicleId: string) {
    this.assertOfficeRead(user);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, companyId: user.companyId },
      select: { id: true },
    });
    if (!vehicle) {
      throw httpError(HttpStatus.NOT_FOUND, 'VEHICLE_NOT_FOUND', 'Veículo não encontrado.');
    }
    const readings = await this.prisma.odometerReading.findMany({
      where: { companyId: user.companyId, vehicleId },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    });
    return {
      readings: readings.map((r) => ({
        id: r.id,
        source: r.source,
        km: num(r.km),
        occurredAt: r.occurredAt.toISOString(),
        routeId: r.routeId,
        fuelFillId: r.fuelFillId,
        note: r.note,
      })),
    };
  }

  async getCostSettings(user: AuthUser) {
    const company = await this.prisma.company.findUnique({ where: { id: user.companyId } });
    if (!company) {
      throw httpError(HttpStatus.NOT_FOUND, 'COMPANY_NOT_FOUND', 'Empresa não encontrada.');
    }
    return {
      settings: {
        referenceFuelPricePerLiter: num(company.referenceFuelPricePerLiter),
        fuelReceiptRequired: company.fuelReceiptRequired,
      },
    };
  }

  async patchCostSettings(
    user: AuthUser,
    dto: { referenceFuelPricePerLiter?: number | null; fuelReceiptRequired?: boolean },
  ) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.PLATFORM_ADMIN) {
      throw httpError(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', 'Você não tem permissão para esta ação.');
    }
    const before = await this.getCostSettings(user);
    const company = await this.prisma.company.update({
      where: { id: user.companyId },
      data: {
        ...(dto.referenceFuelPricePerLiter !== undefined
          ? {
              referenceFuelPricePerLiter:
                dto.referenceFuelPricePerLiter == null
                  ? null
                  : new Prisma.Decimal(dto.referenceFuelPricePerLiter),
            }
          : {}),
        ...(dto.fuelReceiptRequired !== undefined
          ? { fuelReceiptRequired: dto.fuelReceiptRequired }
          : {}),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: 'COST_SETTINGS_UPDATED',
        entity: 'Company',
        entityId: user.companyId,
        metadata: {
          before: before.settings,
          after: {
            referenceFuelPricePerLiter: num(company.referenceFuelPricePerLiter),
            fuelReceiptRequired: company.fuelReceiptRequired,
          },
        },
      },
    });
    return {
      settings: {
        referenceFuelPricePerLiter: num(company.referenceFuelPricePerLiter),
        fuelReceiptRequired: company.fuelReceiptRequired,
      },
    };
  }
}

export type { Metric };
