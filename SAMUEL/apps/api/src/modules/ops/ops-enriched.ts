import { RouteStatus, ServiceOrderStatus, VisitStatus } from '@prisma/client';
import { businessDayBoundsUtc, businessDayUtc } from '../../common/date/business-day';
import type { AuthUser } from '../auth/decorators/auth.decorators';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { TrackingService } from '../tracking/tracking.service';

export type EnrichedCustomerRow = {
  id: string;
  name: string;
  tradeName: string | null;
  document: string | null;
  city: string | null;
  locationStatus: string;
  status: string;
  openServiceOrders: number;
  nextVisitAt: string | null;
  nextVisitEmployeeName: string | null;
};

export async function customersListEnriched(
  prisma: PrismaService,
  user: AuthUser,
  q?: string,
): Promise<{ customers: EnrichedCustomerRow[] }> {
  const customers = await prisma.customer.findMany({
    where: {
      companyId: user.companyId,
      recordSessionShell: false,
      ...(q?.trim()
        ? {
            OR: [
              { name: { contains: q.trim(), mode: 'insensitive' } },
              { tradeName: { contains: q.trim(), mode: 'insensitive' } },
              { document: { contains: q.trim(), mode: 'insensitive' } },
              { city: { contains: q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      tradeName: true,
      document: true,
      city: true,
      locationStatus: true,
      status: true,
    },
  });

  if (!customers.length) return { customers: [] };

  const ids = customers.map((c) => c.id);
  const now = new Date();

  const [openOsRows, nextVisits] = await Promise.all([
    prisma.serviceOrder.groupBy({
      by: ['customerId'],
      where: {
        companyId: user.companyId,
        customerId: { in: ids },
        status: { in: [ServiceOrderStatus.OPEN, ServiceOrderStatus.IN_PROGRESS] },
      },
      _count: { id: true },
    }),
    prisma.visit.findMany({
      where: {
        companyId: user.companyId,
        customerId: { in: ids },
        status: {
          in: [
            VisitStatus.SCHEDULED,
            VisitStatus.ASSIGNED,
            VisitStatus.RESCHEDULED,
            VisitStatus.IN_ROUTE,
            VisitStatus.ARRIVED,
            VisitStatus.IN_PROGRESS,
          ],
        },
      },
      orderBy: { scheduledStart: 'asc' },
      distinct: ['customerId'],
      select: {
        customerId: true,
        scheduledStart: true,
        employee: { select: { name: true } },
      },
    }),
  ]);

  const openMap = new Map(openOsRows.map((r) => [r.customerId, r._count.id]));
  const nextMap = new Map(nextVisits.map((v) => [v.customerId, v]));

  return {
    customers: customers.map((c) => {
      const next = nextMap.get(c.id);
      return {
        ...c,
        locationStatus: String(c.locationStatus),
        status: String(c.status),
        openServiceOrders: openMap.get(c.id) ?? 0,
        nextVisitAt: next?.scheduledStart.toISOString() ?? null,
        nextVisitEmployeeName: next?.employee?.name ?? null,
      };
    }),
  };
}

export type EnrichedEmployeeRow = {
  id: string;
  name: string;
  jobTitle: string | null;
  status: string;
  userId: string | null;
  routeTodayId: string | null;
  routeTodayStatus: string | null;
  vehiclePlate: string | null;
  operational: string | null;
};

export async function employeesListEnriched(
  prisma: PrismaService,
  tracking: TrackingService,
  user: AuthUser,
  q?: string,
  dateYmd?: string,
): Promise<{ employees: EnrichedEmployeeRow[] }> {
  const { ymd } = businessDayBoundsUtc(dateYmd);
  const routeDate = businessDayUtc(ymd);

  const employees = await prisma.employee.findMany({
    where: {
      companyId: user.companyId,
      ...(q?.trim()
        ? {
            OR: [
              { name: { contains: q.trim(), mode: 'insensitive' } },
              { email: { contains: q.trim(), mode: 'insensitive' } },
              { jobTitle: { contains: q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      jobTitle: true,
      status: true,
      userId: true,
    },
  });

  if (!employees.length) return { employees: [] };

  const ids = employees.map((e) => e.id);

  const [routes, live, inServiceVisits] = await Promise.all([
    prisma.route.findMany({
      where: {
        companyId: user.companyId,
        employeeId: { in: ids },
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
      select: {
        id: true,
        employeeId: true,
        status: true,
        vehicle: { select: { plate: true } },
      },
    }),
    tracking.listLive(user),
    prisma.visit.findMany({
      where: {
        companyId: user.companyId,
        employeeId: { in: ids },
        status: VisitStatus.IN_PROGRESS,
      },
      select: { employeeId: true },
    }),
  ]);

  const routeMap = new Map<string, (typeof routes)[0]>();
  for (const r of routes) {
    if (!r.employeeId) continue;
    const prev = routeMap.get(r.employeeId);
    if (!prev) {
      routeMap.set(r.employeeId, r);
    } else if (r.status === RouteStatus.IN_PROGRESS) {
      routeMap.set(r.employeeId, r);
    }
  }
  const liveMap = new Map(live.positions.map((p) => [p.employeeId, p]));
  const inServiceIds = new Set(
    inServiceVisits.map((v) => v.employeeId).filter((id): id is string => Boolean(id)),
  );

  return {
    employees: employees.map((e) => {
      const route = routeMap.get(e.id);
      const liveRow = liveMap.get(e.id);
      const serving = inServiceIds.has(e.id);
      let operational: string | null = null;
      if (serving) {
        operational = 'IN_SERVICE';
      } else if (liveRow) {
        operational =
          route?.status === RouteStatus.IN_PROGRESS ? 'IN_ROUTE' : 'AVAILABLE';
      } else if (route) {
        // Inclui COMPLETED / ASSIGNED / PUBLISHED / IN_PROGRESS sem GPS
        operational = 'OFFLINE';
      }

      return {
        ...e,
        status: String(e.status),
        routeTodayId: route?.id ?? null,
        routeTodayStatus: route?.status ?? null,
        vehiclePlate: route?.vehicle?.plate ?? liveRow?.vehiclePlate ?? null,
        operational,
      };
    }),
  };
}

export type EnrichedVehicleRow = {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  status: string;
  routeTodayId: string | null;
  routeTodayStatus: string | null;
  driverName: string | null;
};

export async function vehiclesListEnriched(
  prisma: PrismaService,
  user: AuthUser,
  q?: string,
  dateYmd?: string,
): Promise<{ vehicles: EnrichedVehicleRow[] }> {
  const { ymd } = businessDayBoundsUtc(dateYmd);
  const routeDate = businessDayUtc(ymd);

  const vehicles = await prisma.vehicle.findMany({
    where: {
      companyId: user.companyId,
      ...(q?.trim()
        ? {
            OR: [
              { plate: { contains: q.trim(), mode: 'insensitive' } },
              { brand: { contains: q.trim(), mode: 'insensitive' } },
              { model: { contains: q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { plate: 'asc' },
    select: {
      id: true,
      plate: true,
      brand: true,
      model: true,
      status: true,
    },
  });

  if (!vehicles.length) return { vehicles: [] };

  const ids = vehicles.map((v) => v.id);

  const routes = await prisma.route.findMany({
    where: {
      companyId: user.companyId,
      vehicleId: { in: ids },
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
    select: {
      id: true,
      vehicleId: true,
      status: true,
      employee: { select: { name: true } },
    },
  });

  const routeMap = new Map(routes.map((r) => [r.vehicleId!, r]));

  return {
    vehicles: vehicles.map((v) => {
      const route = routeMap.get(v.id);
      return {
        ...v,
        status: String(v.status),
        routeTodayId: route?.id ?? null,
        routeTodayStatus: route?.status ?? null,
        driverName: route?.employee?.name ?? null,
      };
    }),
  };
}
