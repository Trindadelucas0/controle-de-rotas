import { Injectable, HttpStatus } from '@nestjs/common';
import { businessDayUtc, businessDayYmd } from '../../common/date/business-day';
import { CustomerAccessPathStatus, RouteStatus, UserRole, VehicleStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';
import { mapLandmarkPublic } from '../customers/access-path.util';

const myRouteSelect = {
  id: true,
  status: true,
  date: true,
  startedAt: true,
  roundtrip: true,
  recordTrip: true,
  recordNewCustomer: true,
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
  startOdometerKm: true,
  startFuelLevel: true,
  employee: { select: { id: true, name: true } },
  vehicle: {
    select: {
      id: true,
      plate: true,
      brand: true,
      model: true,
      odometerKm: true,
      lastFuelLevel: true,
    },
  },
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
          status: true,
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

  private async attachRecordedCustomers<
    T extends { id: string; recordNewCustomer?: boolean },
  >(companyId: string, _employeeId: string, routes: T[]) {
    const missionIds = routes.filter((r) => r.recordNewCustomer).map((r) => r.id);
    if (!missionIds.length) {
      return routes.map((r) => ({ ...r, recordedCustomers: [] as never[] }));
    }
    const rows = await this.prisma.customer.findMany({
      where: {
        companyId,
        recordedFromRouteId: { in: missionIds },
        recordSessionShell: false,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        document: true,
        city: true,
        latitude: true,
        longitude: true,
        profileIncomplete: true,
        recordedFromRouteId: true,
      },
    });
    const paths = rows.length
      ? await this.prisma.customerAccessPath.findMany({
          where: {
            companyId,
            routeId: { in: missionIds },
            customerId: { in: rows.map((r) => r.id) },
          },
          select: { customerId: true, distanceMeters: true },
        })
      : [];
    const distByCustomer = new Map(paths.map((p) => [p.customerId, p.distanceMeters]));
    const byRoute = new Map<string, Array<(typeof rows)[number] & { distanceMeters: number | null }>>();
    for (const row of rows) {
      const rid = row.recordedFromRouteId;
      if (!rid) continue;
      const list = byRoute.get(rid) ?? [];
      list.push({ ...row, distanceMeters: distByCustomer.get(row.id) ?? null });
      byRoute.set(rid, list);
    }
    return routes.map((r) => ({
      ...r,
      recordedCustomers: byRoute.get(r.id) ?? [],
    }));
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
          createdByEmployee: { select: { id: true, name: true } },
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
          landmarks: (landmarksByCustomer.get(customerId) ?? []).map((lm) =>
            mapLandmarkPublic(lm),
          ),
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
    const withPoints = await this.attachRecordedCustomers(user.companyId, employeeId, enriched);

    const inProgress = withPoints.find((r) => r.status === RouteStatus.IN_PROGRESS) ?? null;
    const rest = inProgress ? withPoints.filter((r) => r.id !== inProgress.id) : withPoints;
    const routes = inProgress ? [inProgress, ...rest] : rest;
    const route = inProgress ?? routes[0] ?? null;

    const openRecordedCustomers = await this.prisma.customer.findMany({
      where: {
        companyId: user.companyId,
        recordSessionShell: false,
        profileIncomplete: true,
        recordedFromRoute: { employeeId, companyId: user.companyId },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        document: true,
        city: true,
        state: true,
        street: true,
        notes: true,
        profileIncomplete: true,
        latitude: true,
        longitude: true,
        recordedFromRouteId: true,
      },
      take: 50,
    });

    return { date: dateYmd, routes, route, openRecordedCustomers };
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

    const busy = await this.prisma.route.findMany({
      where: {
        companyId: user.companyId,
        status: RouteStatus.IN_PROGRESS,
        vehicleId: { not: null },
        ...(routeId ? { NOT: { id: routeId } } : {}),
      },
      select: { vehicleId: true },
    });
    const busyIds = new Set(busy.map((r) => r.vehicleId).filter(Boolean) as string[]);

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        companyId: user.companyId,
        status: { notIn: [VehicleStatus.MAINTENANCE, VehicleStatus.INACTIVE] },
      },
      select: {
        id: true,
        plate: true,
        brand: true,
        model: true,
        status: true,
        odometerKm: true,
        lastFuelLevel: true,
      },
      orderBy: { plate: 'asc' },
    });

    const listed = vehicles
      .filter((v) => v.id === assignedVehicleId || !busyIds.has(v.id))
      .map((v) => ({
        ...v,
        inUseByOther: busyIds.has(v.id),
      }));

    return { vehicles: listed };
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
