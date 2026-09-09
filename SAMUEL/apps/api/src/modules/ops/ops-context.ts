import { HttpStatus } from '@nestjs/common';
import {
  RouteStatus,
  ServiceOrderStatus,
  VisitStatus,
} from '@prisma/client';
import { businessDayBoundsUtc, businessDayUtc } from '../../common/date/business-day';
import { httpError } from '../../common/errors/http-error';
import type { AuthUser } from '../auth/decorators/auth.decorators';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { TrackingService } from '../tracking/tracking.service';
import type {
  EmployeeContextCard,
  InteractionType,
  ServiceOrderContextCard,
  VehicleContextCard,
} from './context-cards';
import type { OpsSnapshotQueryDto } from './dto/ops.dto';

const TIMELINE_LIMIT = 8;

export async function vehicleContext(
  prisma: PrismaService,
  tracking: TrackingService,
  user: AuthUser,
  vehicleId: string,
): Promise<{ vehicle: VehicleContextCard }> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, companyId: user.companyId },
  });
  if (!vehicle) {
    throw httpError(HttpStatus.NOT_FOUND, 'VEHICLE_NOT_FOUND', 'Veículo não encontrado.');
  }

  const { ymd } = businessDayBoundsUtc(undefined);
  const routeDate = businessDayUtc(ymd);

  const [routeToday, recentRoutes] = await Promise.all([
    prisma.route.findFirst({
      where: {
        companyId: user.companyId,
        vehicleId,
        date: routeDate,
        status: {
          in: [
            RouteStatus.PUBLISHED,
            RouteStatus.IN_PROGRESS,
            RouteStatus.COMPLETED,
            RouteStatus.ASSIGNED,
          ],
        },
      },
      include: {
        employee: { select: { id: true, name: true } },
        _count: { select: { stops: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.route.findMany({
      where: { companyId: user.companyId, vehicleId },
      orderBy: { date: 'desc' },
      take: TIMELINE_LIMIT,
      select: {
        id: true,
        date: true,
        status: true,
        plannedDistanceMeters: true,
        actualDistanceMeters: true,
        employee: { select: { name: true } },
      },
    }),
  ]);

  const live = await tracking.listLive(user);
  const liveRow = live.positions.find((p) => p.vehiclePlate === vehicle.plate);

  const canWrite = user.role === 'ADMIN' || user.role === 'MANAGER';

  const timeline = recentRoutes.map((r) => ({
    at: r.date.toISOString(),
    type: 'OTHER' as InteractionType,
    title: `Rota — ${r.status}`,
    detail: r.employee?.name
      ? `${r.employee.name}${r.plannedDistanceMeters ? ` · ${Math.round(r.plannedDistanceMeters / 1000)} km plan.` : ''}`
      : null,
    actorName: r.employee?.name ?? null,
  }));

  const card: VehicleContextCard = {
    summary: {
      id: vehicle.id,
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      status: vehicle.status,
      avgConsumption: vehicle.avgConsumption,
      odometerKm: vehicle.odometerKm,
    },
    statusAtual: vehicle.status,
    metrics: {
      routesToday: routeToday ? 1 : 0,
      stopsToday: routeToday?._count.stops ?? null,
      plannedDistanceMeters: routeToday?.plannedDistanceMeters ?? null,
      actualDistanceMeters: routeToday?.actualDistanceMeters ?? null,
      liveTracking: liveRow ? 1 : 0,
    },
    historico: [],
    relacionamentos: {
      routeToday: routeToday
        ? {
            id: routeToday.id,
            status: routeToday.status,
            employee: routeToday.employee,
          }
        : null,
      driverToday: routeToday?.employee ?? null,
    },
    acoes: [
      {
        id: 'edit',
        label: 'Editar veículo',
        href: `/vehicles/${vehicle.id}`,
        enabled: canWrite,
      },
      {
        id: 'routes',
        label: 'Ver rotas',
        href: '/routes',
        enabled: true,
      },
      {
        id: 'route_today',
        label: 'Rota de hoje',
        href: routeToday ? '/routes' : undefined,
        enabled: !!routeToday,
      },
    ],
    timeline,
    localizacao: liveRow
      ? {
          latitude: liveRow.latitude,
          longitude: liveRow.longitude,
          label: 'Posição GPS ao vivo',
        }
      : null,
    alertas: [],
    permissoes: { role: user.role, canRead: true, canWrite },
  };

  return { vehicle: card };
}

export async function employeeContext(
  prisma: PrismaService,
  tracking: TrackingService,
  user: AuthUser,
  employeeId: string,
): Promise<{ employee: EmployeeContextCard }> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId: user.companyId },
    include: { user: { select: { id: true, email: true, status: true } } },
  });
  if (!employee) {
    throw httpError(HttpStatus.NOT_FOUND, 'EMPLOYEE_NOT_FOUND', 'Funcionário não encontrado.');
  }

  const { ymd } = businessDayBoundsUtc(undefined);
  const routeDate = businessDayUtc(ymd);

  const [routeToday, recentVisits, live, inServiceVisit] = await Promise.all([
    prisma.route.findFirst({
      where: {
        companyId: user.companyId,
        employeeId,
        date: routeDate,
        status: {
          in: [
            RouteStatus.PUBLISHED,
            RouteStatus.IN_PROGRESS,
            RouteStatus.COMPLETED,
            RouteStatus.ASSIGNED,
          ],
        },
      },
      include: {
        vehicle: { select: { id: true, plate: true } },
        _count: { select: { stops: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.visit.findMany({
      where: { companyId: user.companyId, employeeId },
      orderBy: { scheduledStart: 'desc' },
      take: TIMELINE_LIMIT,
      include: {
        customer: { select: { name: true } },
        serviceOrder: { select: { number: true } },
      },
    }),
    tracking.listLive(user),
    prisma.visit.findFirst({
      where: {
        companyId: user.companyId,
        employeeId,
        status: VisitStatus.IN_PROGRESS,
      },
      select: { id: true },
    }),
  ]);

  const liveRow = live.positions.find((p) => p.employeeId === employeeId);
  let operational: EmployeeContextCard['summary']['operational'] = 'OFFLINE';
  let presence: EmployeeContextCard['summary']['presence'] = 'OFFLINE';

  if (liveRow) {
    presence = 'ONLINE';
  } else {
    presence = 'OFFLINE';
  }

  if (inServiceVisit) {
    operational = 'IN_SERVICE';
  } else if (liveRow) {
    operational = routeToday?.status === RouteStatus.IN_PROGRESS ? 'IN_ROUTE' : 'AVAILABLE';
  } else {
    operational = 'OFFLINE';
  }

  const canWrite = user.role === 'ADMIN' || user.role === 'MANAGER';

  const timeline = recentVisits.map((v) => ({
    at: v.scheduledStart.toISOString(),
    type: 'VISIT' as InteractionType,
    title: v.serviceOrder
      ? `Visita — OS #${v.serviceOrder.number}`
      : `Visita — ${v.customer.name}`,
    detail: v.notes,
    actorName: employee.name,
  }));

  const card: EmployeeContextCard = {
    summary: {
      id: employee.id,
      name: employee.name,
      hrStatus: employee.status,
      presence,
      operational,
    },
    statusAtual: employee.status,
    metrics: {
      visitsRecent: recentVisits.length,
      routeStopsToday: routeToday?._count.stops ?? null,
      plannedDistanceMeters: routeToday?.plannedDistanceMeters ?? null,
      hasLogin: employee.userId ? 1 : 0,
    },
    historico: [],
    relacionamentos: {
      routeToday: routeToday
        ? { id: routeToday.id, status: routeToday.status, vehicle: routeToday.vehicle }
        : null,
      loginUser: employee.user
        ? { id: employee.user.id, email: employee.user.email, status: employee.user.status }
        : null,
    },
    acoes: [
      {
        id: 'edit',
        label: 'Editar funcionário',
        href: `/employees/${employee.id}`,
        enabled: canWrite,
      },
      {
        id: 'agenda',
        label: 'Ver agenda',
        href: '/agenda',
        enabled: true,
      },
      {
        id: 'map',
        label: 'Ver no mapa',
        href: `/map?employeeId=${employee.id}`,
        enabled: user.role !== 'EMPLOYEE',
      },
    ],
    timeline,
    localizacao: liveRow
      ? {
          latitude: liveRow.latitude,
          longitude: liveRow.longitude,
          label: liveRow.vehiclePlate ? `Veículo ${liveRow.vehiclePlate}` : null,
        }
      : null,
    alertas: [],
    permissoes: { role: user.role, canRead: true, canWrite },
  };

  return { employee: card };
}

export async function serviceOrderContext(
  prisma: PrismaService,
  user: AuthUser,
  serviceOrderId: string,
): Promise<{ serviceOrder: ServiceOrderContextCard }> {
  const order = await prisma.serviceOrder.findFirst({
    where: { id: serviceOrderId, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, tradeName: true } },
      visits: {
        orderBy: { scheduledStart: 'desc' },
        take: TIMELINE_LIMIT,
        include: {
          employee: { select: { name: true } },
          routeStop: { select: { routeId: true, sequence: true } },
        },
      },
    },
  });
  if (!order) {
    throw httpError(
      HttpStatus.NOT_FOUND,
      'SERVICE_ORDER_NOT_FOUND',
      'Ordem de serviço não encontrada.',
    );
  }

  const canWrite = user.role === 'ADMIN' || user.role === 'MANAGER';
  const routeIds = [
    ...new Set(order.visits.map((v) => v.routeStop?.routeId).filter(Boolean)),
  ] as string[];

  const timeline: ServiceOrderContextCard['timeline'] = [
    {
      at: order.createdAt.toISOString(),
      type: 'OTHER' as InteractionType,
      title: 'OS criada',
      detail: order.title,
      actorName: null,
    },
    ...order.visits.map((v) => ({
      at: v.scheduledStart.toISOString(),
      type: 'VISIT' as InteractionType,
      title: `Visita — ${v.status}`,
      detail: v.notes,
      actorName: v.employee?.name ?? null,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const card: ServiceOrderContextCard = {
    summary: {
      id: order.id,
      number: order.number,
      title: order.title,
      priority: order.priority,
      status: order.status,
      customerId: order.customerId,
      customerName: order.customer.tradeName || order.customer.name,
    },
    statusAtual: order.status,
    metrics: {
      visitsCount: order.visits.length,
      openVisits: order.visits.filter(
        (v) =>
          v.status !== VisitStatus.COMPLETED &&
          v.status !== VisitStatus.CANCELLED &&
          v.status !== VisitStatus.FAILED,
      ).length,
    },
    historico: [],
    relacionamentos: {
      customer: { id: order.customer.id, name: order.customer.name },
      routeIds,
      lastVisit: order.visits[0]
        ? {
            id: order.visits[0].id,
            scheduledStart: order.visits[0].scheduledStart.toISOString(),
            status: order.visits[0].status,
          }
        : null,
    },
    acoes: [
      {
        id: 'customer',
        label: 'Abrir cliente',
        href: `/customers/${order.customerId}`,
        enabled: true,
      },
      {
        id: 'routes',
        label: 'Ver rotas',
        href: '/routes',
        enabled: routeIds.length > 0,
      },
      {
        id: 'agenda',
        label: 'Ver agenda',
        href: '/agenda',
        enabled: order.visits.length > 0,
      },
    ],
    timeline,
    localizacao: null,
    alertas: [],
    permissoes: { role: user.role, canRead: true, canWrite },
  };

  return { serviceOrder: card };
}

export async function agendaSummary(
  prisma: PrismaService,
  user: AuthUser,
  query: OpsSnapshotQueryDto,
) {
  const { ymd, from, to } = businessDayBoundsUtc(query.date);
  const now = new Date();

  const visits = await prisma.visit.findMany({
    where: {
      companyId: user.companyId,
      scheduledStart: { gte: from, lte: to },
    },
    select: { status: true, scheduledStart: true },
  });

  return {
    date: ymd,
    total: visits.length,
    planned: visits.filter((v) => v.status !== VisitStatus.CANCELLED).length,
    completed: visits.filter((v) => v.status === VisitStatus.COMPLETED).length,
    inProgress: visits.filter(
      (v) =>
        v.status === VisitStatus.IN_PROGRESS ||
        v.status === VisitStatus.ARRIVED ||
        v.status === VisitStatus.IN_ROUTE,
    ).length,
    delayed: visits.filter(
      (v) =>
        (v.status === VisitStatus.SCHEDULED ||
          v.status === VisitStatus.ASSIGNED ||
          v.status === VisitStatus.RESCHEDULED) &&
        v.scheduledStart < now,
    ).length,
    cancelled: visits.filter((v) => v.status === VisitStatus.CANCELLED).length,
  };
}
