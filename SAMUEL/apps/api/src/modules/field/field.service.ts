import { Injectable, HttpStatus } from '@nestjs/common';
import { businessDayUtc, businessDayYmd } from '../../common/date/business-day';
import { CustomerAccessPathStatus, RouteStatus, UserRole, VehicleStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';

const myRouteSelect = {
  id: true,
  status: true,
  date: true,
  startedAt: true,
  roundtrip: true,
  recordTrip: true,
  originName: true,
  originAddress: true,
  originLatitude: true,
  originLongitude: true,
  plannedDistanceMeters: true,
  plannedDurationSeconds: true,
  plannedGeometryJson: true,
  plannedStepsJson: true,
  quality: true,
  publishedAt: true,
  employee: { select: { id: true, name: true } },
  vehicle: { select: { id: true, plate: true, brand: true, model: true } },
  stops: {
    orderBy: { sequence: 'asc' as const },
    select: {
      id: true,
      sequence: true,
      status: true,
      latitude: true,
      longitude: true,
      plannedDistanceMeters: true,
      plannedDurationSeconds: true,
      visit: {
        select: {
          id: true,
          customer: { select: { id: true, name: true } },
          serviceOrder: { select: { id: true, number: true, title: true } },
        },
      },
    },
  },
};

@Injectable()
export class FieldService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireEmployeeId(user: AuthUser): Promise<string> {
    if (user.role !== UserRole.EMPLOYEE) {
      throw httpError(
        HttpStatus.FORBIDDEN,
        'FIELD_EMPLOYEE_ONLY',
        'Esta área é exclusiva do funcionário de campo.',
      );
    }
    const employee = await this.prisma.employee.findFirst({
      where: { companyId: user.companyId, userId: user.id },
      select: { id: true },
    });
    if (!employee) {
      throw httpError(
        HttpStatus.FORBIDDEN,
        'EMPLOYEE_PROFILE_REQUIRED',
        'Seu usuário não está vinculado a um funcionário.',
      );
    }
    return employee.id;
  }

  private async enrichRoutesWithAccess<
    T extends {
      id: string;
      status: string;
      stops: Array<{ visit: { customer: { id: string } } }>;
    },
  >(companyId: string, routes: T[]) {
    const customerIds = [
      ...new Set(
        routes.flatMap((r) => r.stops.map((s) => s.visit.customer.id)).filter(Boolean),
      ),
    ];
    if (!customerIds.length) {
      return routes.map((r) => ({
        ...r,
        stops: r.stops.map((s) => ({ ...s, accessPath: null, landmarks: [] as never[] })),
      }));
    }

    const [paths, landmarks] = await Promise.all([
      this.prisma.customerAccessPath.findMany({
        where: {
          companyId,
          customerId: { in: customerIds },
          status: CustomerAccessPathStatus.ACTIVE,
        },
        select: {
          id: true,
          customerId: true,
          geometryJson: true,
          distanceMeters: true,
          status: true,
        },
      }),
      this.prisma.customerLandmark.findMany({
        where: { companyId, customerId: { in: customerIds } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          customerId: true,
          type: true,
          latitude: true,
          longitude: true,
          note: true,
        },
      }),
    ]);

    const pathByCustomer = new Map(paths.map((p) => [p.customerId, p]));
    const landmarksByCustomer = new Map<string, typeof landmarks>();
    for (const lm of landmarks) {
      const list = landmarksByCustomer.get(lm.customerId) ?? [];
      list.push(lm);
      landmarksByCustomer.set(lm.customerId, list);
    }

    return routes.map((r) => ({
      ...r,
      stops: r.stops.map((s) => {
        const customerId = s.visit.customer.id;
        const path = pathByCustomer.get(customerId);
        return {
          ...s,
          accessPath: path
            ? {
                id: path.id,
                geometryJson: path.geometryJson,
                distanceMeters: path.distanceMeters,
                status: path.status,
              }
            : null,
          landmarks: (landmarksByCustomer.get(customerId) ?? []).map((lm) => ({
            id: lm.id,
            type: lm.type,
            latitude: lm.latitude,
            longitude: lm.longitude,
            note: lm.note,
          })),
        };
      }),
    }));
  }

  async myRoute(user: AuthUser, dateInput?: string) {
    const employeeId = await this.requireEmployeeId(user);
    const dateYmd = businessDayYmd(dateInput);
    const date = businessDayUtc(dateYmd);

    const found = await this.prisma.route.findMany({
      where: {
        companyId: user.companyId,
        employeeId,
        OR: [
          { date, status: { in: [RouteStatus.PUBLISHED, RouteStatus.IN_PROGRESS] } },
          { status: RouteStatus.IN_PROGRESS },
        ],
      },
      select: myRouteSelect,
      orderBy: [{ publishedAt: 'asc' }, { createdAt: 'asc' }],
    });

    const enriched = await this.enrichRoutesWithAccess(user.companyId, found);

    const inProgress = enriched.find((r) => r.status === RouteStatus.IN_PROGRESS) ?? null;
    const rest = inProgress ? enriched.filter((r) => r.id !== inProgress.id) : enriched;
    const routes = inProgress ? [inProgress, ...rest] : rest;
    const route = inProgress ?? routes[0] ?? null;

    return { date: dateYmd, routes, route };
  }

  async listVehicles(user: AuthUser, routeId?: string) {
    await this.requireEmployeeId(user);

    let assignedVehicleId: string | null = null;
    if (routeId) {
      const route = await this.prisma.route.findFirst({
        where: { id: routeId, companyId: user.companyId },
        select: { vehicleId: true, employeeId: true },
      });
      if (!route) {
        throw httpError(HttpStatus.NOT_FOUND, 'ROUTE_NOT_FOUND', 'Rota não encontrada.');
      }
      assignedVehicleId = route.vehicleId;
    }

    const available = await this.prisma.vehicle.findMany({
      where: { companyId: user.companyId, status: VehicleStatus.AVAILABLE },
      select: { id: true, plate: true, brand: true, model: true, status: true },
      orderBy: { plate: 'asc' },
    });

    const ids = new Set(available.map((v) => v.id));
    if (assignedVehicleId && !ids.has(assignedVehicleId)) {
      const assigned = await this.prisma.vehicle.findFirst({
        where: { id: assignedVehicleId, companyId: user.companyId },
        select: { id: true, plate: true, brand: true, model: true, status: true },
      });
      if (assigned) available.unshift(assigned);
    }

    return { vehicles: available };
  }

  async trackingStatus(user: AuthUser) {
    const employeeId = await this.requireEmployeeId(user);
    const active = await this.prisma.route.findFirst({
      where: {
        companyId: user.companyId,
        employeeId,
        status: RouteStatus.IN_PROGRESS,
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        recordTrip: true,
        vehicle: { select: { id: true, plate: true } },
      },
    });

    return {
      trackingActive: Boolean(active),
      route: active,
      transport: 'http',
      hint: active
        ? 'Envie pontos via POST /tracking/points enquanto a rota estiver em andamento.'
        : 'Inicie a rota em /field/my-route para ativar o GPS.',
    };
  }
}
