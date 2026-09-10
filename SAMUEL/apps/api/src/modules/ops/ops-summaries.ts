import {
  CustomerStatus,
  RouteStatus,
  ServiceOrderStatus,
  VehicleStatus,
  VisitStatus,
} from '@prisma/client';
import { businessDayBoundsUtc, businessDayUtc } from '../../common/date/business-day';
import type { AuthUser } from '../auth/decorators/auth.decorators';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { TrackingService } from '../tracking/tracking.service';
import type { OpsSnapshotQueryDto } from './dto/ops.dto';

export async function vehiclesSummary(
  prisma: PrismaService,
  tracking: TrackingService,
  user: AuthUser,
  query: OpsSnapshotQueryDto,
) {
  const { ymd } = businessDayBoundsUtc(query.date);
  const routeDate = businessDayUtc(ymd);

  const [byStatus, routesToday, live] = await Promise.all([
    prisma.vehicle.groupBy({
      by: ['status'],
      where: { companyId: user.companyId },
      _count: { id: true },
    }),
    prisma.route.findMany({
      where: {
        companyId: user.companyId,
        date: routeDate,
        status: {
          in: [
            RouteStatus.PUBLISHED,
            RouteStatus.IN_PROGRESS,
            RouteStatus.COMPLETED,
            RouteStatus.INCOMPLETE,
            RouteStatus.ASSIGNED,
          ],
        },
      },
      select: { vehicleId: true, plannedDistanceMeters: true, status: true },
    }),
    tracking.listLive(user),
  ]);

  const statusMap = Object.fromEntries(
    byStatus.map((r) => [r.status, r._count.id]),
  ) as Record<string, number>;

  const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const plannedKm = routesToday.reduce((s, r) => s + (r.plannedDistanceMeters ?? 0), 0);
  const routesCount = routesToday.length;
  const inUseToday = new Set(routesToday.map((r) => r.vehicleId).filter(Boolean)).size;
  const livePlates = new Set(live.positions.map((p) => p.vehiclePlate).filter(Boolean));

  return {
    date: ymd,
    total,
    available: statusMap[VehicleStatus.AVAILABLE] ?? 0,
    inUse: statusMap[VehicleStatus.IN_USE] ?? 0,
    maintenance: statusMap[VehicleStatus.MAINTENANCE] ?? 0,
    inactive: statusMap[VehicleStatus.INACTIVE] ?? 0,
    routesToday: routesCount,
    vehiclesOnRoutesToday: inUseToday,
    plannedDistanceMeters: plannedKm || null,
    liveTrackingCount: livePlates.size,
  };
}

export async function employeesSummary(
  prisma: PrismaService,
  tracking: TrackingService,
  user: AuthUser,
  query: OpsSnapshotQueryDto,
) {
  const { ymd } = businessDayBoundsUtc(query.date);
  const routeDate = businessDayUtc(ymd);

  const [byStatus, withLogin, routesToday, live] = await Promise.all([
    prisma.employee.groupBy({
      by: ['status'],
      where: { companyId: user.companyId },
      _count: { id: true },
    }),
    prisma.employee.count({
      where: { companyId: user.companyId, userId: { not: null } },
    }),
    prisma.route.count({
      where: {
        companyId: user.companyId,
        date: routeDate,
        status: {
          in: [
            RouteStatus.PUBLISHED,
            RouteStatus.IN_PROGRESS,
            RouteStatus.COMPLETED,
            RouteStatus.INCOMPLETE,
          ],
        },
      },
    }),
    tracking.listLive(user),
  ]);

  const statusMap = Object.fromEntries(
    byStatus.map((r) => [r.status, r._count.id]),
  ) as Record<string, number>;

  const total = Object.values(statusMap).reduce((a, b) => a + b, 0);

  return {
    date: ymd,
    total,
    active: statusMap.ACTIVE ?? 0,
    inactive: statusMap.INACTIVE ?? 0,
    onLeave: statusMap.ON_LEAVE ?? 0,
    suspended: statusMap.SUSPENDED ?? 0,
    withLogin,
    routesToday,
    liveOnline: live.positions.length,
  };
}

export async function customersSummary(
  prisma: PrismaService,
  user: AuthUser,
  query: OpsSnapshotQueryDto,
) {
  const { ymd, from, to } = businessDayBoundsUtc(query.date);
  const now = new Date();

  const [
    total,
    active,
    inactive,
    withLocation,
    withoutLocation,
    withVisitToday,
    withOpenOs,
  ] = await Promise.all([
    prisma.customer.count({ where: { companyId: user.companyId } }),
    prisma.customer.count({
      where: { companyId: user.companyId, status: CustomerStatus.ACTIVE },
    }),
    prisma.customer.count({
      where: { companyId: user.companyId, status: CustomerStatus.INACTIVE },
    }),
    prisma.customer.count({
      where: {
        companyId: user.companyId,
        latitude: { not: null },
        longitude: { not: null },
      },
    }),
    prisma.customer.count({
      where: {
        companyId: user.companyId,
        OR: [{ latitude: null }, { longitude: null }],
      },
    }),
    prisma.visit.groupBy({
      by: ['customerId'],
      where: {
        companyId: user.companyId,
        scheduledStart: { gte: from, lte: to },
        status: { not: VisitStatus.CANCELLED },
      },
    }),
    prisma.serviceOrder.groupBy({
      by: ['customerId'],
      where: {
        companyId: user.companyId,
        status: { in: [ServiceOrderStatus.OPEN, ServiceOrderStatus.IN_PROGRESS] },
      },
    }),
  ]);

  const since30 = new Date(now.getTime() - 30 * 24 * 3600_000);
  const recentVisitCustomers = await prisma.visit.findMany({
    where: {
      companyId: user.companyId,
      scheduledStart: { gte: since30 },
      status: { not: VisitStatus.CANCELLED },
    },
    select: { customerId: true },
    distinct: ['customerId'],
  });
  const recentSet = new Set(recentVisitCustomers.map((v) => v.customerId));
  const withoutVisit30d = await prisma.customer.count({
    where: {
      companyId: user.companyId,
      status: CustomerStatus.ACTIVE,
      ...(recentSet.size ? { id: { notIn: [...recentSet] } } : {}),
    },
  });

  return {
    date: ymd,
    total,
    active,
    inactive,
    withLocation,
    withoutLocation,
    withVisitToday: withVisitToday.length,
    withOpenOs: withOpenOs.length,
    withoutVisit30d,
  };
}

export async function serviceOrdersSummary(prisma: PrismaService, user: AuthUser) {
  const byStatus = await prisma.serviceOrder.groupBy({
    by: ['status'],
    where: { companyId: user.companyId },
    _count: { id: true },
  });

  const statusMap = Object.fromEntries(
    byStatus.map((r) => [r.status, r._count.id]),
  ) as Record<string, number>;

  const total = Object.values(statusMap).reduce((a, b) => a + b, 0);

  return {
    total,
    open: statusMap[ServiceOrderStatus.OPEN] ?? 0,
    inProgress: statusMap[ServiceOrderStatus.IN_PROGRESS] ?? 0,
    completed: statusMap[ServiceOrderStatus.COMPLETED] ?? 0,
    cancelled: statusMap[ServiceOrderStatus.CANCELLED] ?? 0,
  };
}

export async function routesSummary(
  prisma: PrismaService,
  user: AuthUser,
  query: OpsSnapshotQueryDto,
) {
  const { ymd } = businessDayBoundsUtc(query.date);
  const routeDate = businessDayUtc(ymd);

  const routes = await prisma.route.findMany({
    where: {
      companyId: user.companyId,
      date: routeDate,
      status: {
        in: [
          RouteStatus.PUBLISHED,
          RouteStatus.IN_PROGRESS,
          RouteStatus.COMPLETED,
          RouteStatus.INCOMPLETE,
          RouteStatus.ASSIGNED,
        ],
      },
    },
    include: { _count: { select: { stops: true } } },
  });

  const planned = routes.reduce((s, r) => s + (r.plannedDistanceMeters ?? 0), 0);
  const actualVals = routes
    .map((r) => r.actualDistanceMeters)
    .filter((v): v is number => v != null);
  const actual = actualVals.length ? actualVals.reduce((a, b) => a + b, 0) : null;
  const visits = routes.reduce((s, r) => s + r._count.stops, 0);

  const byStatus = {
    published: routes.filter((r) => r.status === RouteStatus.PUBLISHED).length,
    inProgress: routes.filter((r) => r.status === RouteStatus.IN_PROGRESS).length,
    completed: routes.filter((r) => r.status === RouteStatus.COMPLETED).length,
    incomplete: routes.filter((r) => r.status === RouteStatus.INCOMPLETE).length,
    assigned: routes.filter((r) => r.status === RouteStatus.ASSIGNED).length,
  };

  const executionPercent =
    actual != null && planned > 0 ? Math.round((actual / planned) * 100) : null;

  return {
    date: ymd,
    count: routes.length,
    visits,
    ...byStatus,
    plannedDistanceMeters: planned || null,
    actualDistanceMeters: actual,
    executionPercent,
  };
}
