import { Injectable, HttpStatus } from '@nestjs/common';
import { businessDayYmd } from '../../common/date/business-day';
import { ConfigService } from '@nestjs/config';
import {
  CustomerAccessPathStatus,
  CustomerStatus,
  EmployeeStatus,
  Prisma,
  RouteStatus,
  RouteStopStatus,
  ServiceOrderStatus,
  UserRole,
  VehicleStatus,
  VisitStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';
import { TrackingService } from '../tracking/tracking.service';
import { allocateServiceOrderNumber } from '../service-orders/service-order-seq';
import { customerHasPin, visitAddressSnapshot } from '../service-orders/visit-snapshot';
import {
  CompleteRouteDto,
  CreateRouteDto,
  DispatchCustomersRouteDto,
  ListRoutesQueryDto,
  PreviewCustomersRouteDto,
  PreviewRouteDto,
  RerouteRouteDto,
  StartRouteDto,
  UpdateRouteDto,
  type RouteOriginMode,
} from './dto/routes.dto';
import {
  canCompleteAsFinished,
  remainingPlannedMeters,
  ROUTE_COMPLETE_REMAINING_TOLERANCE_METERS,
} from './route-complete.util';
import {
  GeoStop,
  OptimizedTrip,
  OsrmRouteResponse,
  OsrmTripResponse,
  RouteOrigin,
  haversineMeters,
  lineStringWkt,
  orderStopsNearestFirst,
  routeFromOsrm,
  straightLineTrip,
  straightLineTripAlongOrder,
  tripFromAccessPath,
  tripFromOsrm,
} from './routes-geo';
import { validateRecordTripCustomers } from '../customers/access-path.util';
import {
  EmployeeSlot,
  pickEmployeeDispatchPosition,
  splitStopsAmongEmployees,
} from './routes-split';

/** Mesmo limiar de “Chegando” na PWA — paradas mais perto não entram no recálculo. */
const REROUTE_NEAR_STOP_M = 80;

const MAX_STOPS = 25;
const MAX_EMPLOYEES = 8;
const RATE_MAX = 30;
const RATE_WINDOW_SEC = 60;
const OSRM_TIMEOUT_MS = 12_000;

const ACTIVE_ROUTE_STATUSES: RouteStatus[] = [
  RouteStatus.DRAFT,
  RouteStatus.PLANNED,
  RouteStatus.ASSIGNED,
  RouteStatus.PUBLISHED,
  RouteStatus.IN_PROGRESS,
];

/** Cancelar / editar só antes do Play. */
const EDITABLE_ROUTE_STATUSES: RouteStatus[] = [
  RouteStatus.PLANNED,
  RouteStatus.PUBLISHED,
];

const DAY_ACTIVE_ROUTE_STATUSES: RouteStatus[] = [
  RouteStatus.PUBLISHED,
  RouteStatus.IN_PROGRESS,
];

export type RouteStopDto = {
  sequence: number;
  visitId: string;
  customerId: string;
  name: string;
  city: string | null;
  street: string | null;
  number: string | null;
  serviceOrderNumber: number;
  serviceOrderTitle: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  durationSeconds: number;
};

export type CustomerRouteStopDto = {
  sequence: number;
  customerId: string;
  name: string;
  city: string | null;
  street: string | null;
  number: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  durationSeconds: number;
};

export type RoutePreviewResult = {
  origin: {
    name: string;
    latitude: number;
    longitude: number;
    address: string | null;
  };
  stops: RouteStopDto[];
  totals: {
    distanceMeters: number;
    durationSeconds: number;
    distanceKm: number;
  };
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  quality: 'road' | 'straight_line';
  roundtrip: boolean;
};

export type DayLoadDto = {
  existingRouteCount: number;
  existingDistanceMeters: number;
  existingDurationSeconds: number;
  dayDistanceMeters: number;
  dayDurationSeconds: number;
  dayDistanceKm: number;
};

export type AssignmentStartOriginDto = {
  source: EmployeeSlot['positionSource'];
  name: string;
  latitude: number;
  longitude: number;
  recordedAt: string | null;
};

export type CustomerAssignmentDto = {
  employeeId: string;
  employeeName: string;
  vehicleId: string | null;
  stops: CustomerRouteStopDto[];
  totals: {
    distanceMeters: number;
    durationSeconds: number;
    distanceKm: number;
  };
  dayLoad: DayLoadDto;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  quality: 'road' | 'straight_line';
  startOrigin: AssignmentStartOriginDto;
};

export type CustomerRoutesPreviewResult = {
  origin: RoutePreviewResult['origin'];
  originMode: RouteOriginMode;
  date: string;
  roundtrip: boolean;
  recordTrip: boolean;
  assignments: CustomerAssignmentDto[];
};

type EmployeeDayLoad = {
  existingRouteCount: number;
  existingDistanceMeters: number;
  existingDurationSeconds: number;
  vehicleId: string | null;
};

type PreparedAssignment = {
  employee: EmployeeSlot;
  vehicleId: string | null;
  trip: OptimizedTrip;
  dayLoad: EmployeeDayLoad;
};

@Injectable()
export class RoutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly tracking: TrackingService,
  ) {}

  async preview(user: AuthUser, dto: PreviewRouteDto): Promise<RoutePreviewResult> {
    await this.assertRateLimit(user.id);

    const roundtrip = dto.roundtrip !== false;
    const uniqueIds = [...new Set(dto.visitIds)];
    if (uniqueIds.length !== dto.visitIds.length) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_DUPLICATE_VISITS',
        'Remova visitas duplicadas da rota.',
      );
    }
    if (uniqueIds.length > MAX_STOPS) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_TOO_MANY_STOPS',
        `Máximo de ${MAX_STOPS} visitas por cálculo.`,
      );
    }

    const { origin, stops } = await this.loadVisitStops(user.companyId, uniqueIds);
    const trip = await this.optimizeTrip(origin, stops, roundtrip, false);
    return this.toVisitPreview(trip);
  }

  async previewCustomers(
    user: AuthUser,
    dto: PreviewCustomersRouteDto,
  ): Promise<CustomerRoutesPreviewResult> {
    await this.assertRateLimit(user.id);
    const prepared = await this.prepareCustomerAssignments(user, dto, false);
    return {
      origin: prepared.origin,
      originMode: prepared.originMode,
      date: prepared.dateIso,
      roundtrip: prepared.roundtrip,
      recordTrip: prepared.recordTrip,
      assignments: prepared.assignments.map((a) => this.toCustomerAssignment(a)),
    };
  }

  async dispatchCustomers(user: AuthUser, dto: DispatchCustomersRouteDto) {
    await this.assertRateLimit(user.id);
    const prepared = await this.prepareCustomerAssignments(user, dto, true);

    const missingVehicle = prepared.assignments.find((a) => !a.vehicleId);
    if (missingVehicle) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_NOT_ENOUGH_VEHICLES',
        'Não há veículos AVAILABLE suficientes para as rotas. Cadastre ou libere veículos.',
      );
    }

    const createdIds = await this.prisma.$transaction(
      async (tx) => {
        const ids: string[] = [];
        for (const assignment of prepared.assignments) {
          const visitIds: string[] = [];
          for (const stop of assignment.trip.stops) {
            const customer = prepared.customersById.get(stop.customerId)!;
            const number = await allocateServiceOrderNumber(tx, user.companyId);
            const order = await tx.serviceOrder.create({
              data: {
                companyId: user.companyId,
                customerId: customer.id,
                number,
                title: `Rota ${prepared.dateIso}`,
                description: null,
                status: ServiceOrderStatus.IN_PROGRESS,
                createdByUserId: user.id,
              },
            });
            const visit = await tx.visit.create({
              data: {
                companyId: user.companyId,
                serviceOrderId: order.id,
                customerId: customer.id,
                employeeId: assignment.employee.id,
                scheduledStart: new Date(`${prepared.dateIso}T08:00:00.000Z`),
                status: VisitStatus.ASSIGNED,
                ...visitAddressSnapshot(customer),
              },
            });
            visitIds.push(visit.id);
          }

          const route = await tx.route.create({
            data: {
              companyId: user.companyId,
              employeeId: assignment.employee.id,
              vehicleId: assignment.vehicleId,
              date: prepared.date,
              status: RouteStatus.PUBLISHED,
              roundtrip: prepared.roundtrip,
              originName: assignment.trip.origin.name,
              originAddress: assignment.trip.origin.address,
              originLatitude: assignment.trip.origin.latitude,
              originLongitude: assignment.trip.origin.longitude,
              plannedDistanceMeters: assignment.trip.totals.distanceMeters,
              plannedDurationSeconds: assignment.trip.totals.durationSeconds,
              plannedGeometryJson: assignment.trip.geometry as Prisma.InputJsonValue,
              plannedStepsJson: assignment.trip.plannedSteps as Prisma.InputJsonValue,
              recordTrip: prepared.recordTrip,
              quality: assignment.trip.quality,
              publishedAt: new Date(),
              stops: {
                create: assignment.trip.stops.map((s, i) => ({
                  companyId: user.companyId,
                  visitId: visitIds[i],
                  sequence: s.sequence,
                  plannedDistanceMeters: s.distanceMeters,
                  plannedDurationSeconds: s.durationSeconds,
                  latitude: s.latitude,
                  longitude: s.longitude,
                })),
              },
            },
          });

          if (assignment.trip.geometry.coordinates.length) {
            const wkt = lineStringWkt(assignment.trip.geometry.coordinates);
            await tx.$executeRaw`
              UPDATE routes
              SET planned_geometry = ST_SetSRID(ST_GeomFromText(${wkt}), 4326)
              WHERE id = ${route.id}::uuid
            `;
          }

          ids.push(route.id);
        }
        return ids;
      },
      { timeout: 20_000 },
    );

    const routes = [];
    for (const id of createdIds) {
      const { route } = await this.getOne(user, id);
      routes.push(route);
    }

    return {
      origin: prepared.origin,
      originMode: prepared.originMode,
      date: prepared.dateIso,
      roundtrip: prepared.roundtrip,
      recordTrip: prepared.recordTrip,
      routes,
    };
  }

  async list(user: AuthUser, query: ListRoutesQueryDto) {
    const routes = await this.prisma.route.findMany({
      where: {
        companyId: user.companyId,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.date ? { date: new Date(`${query.date.slice(0, 10)}T00:00:00.000Z`) } : {}),
      },
      include: {
        employee: { select: { id: true, name: true } },
        vehicle: { select: { id: true, plate: true } },
        _count: { select: { stops: true } },
        stops: { select: { status: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return {
      routes: routes.map(({ stops, ...route }) => ({
        ...route,
        stopsDone: stops.filter(
          (s) =>
            s.status === RouteStopStatus.COMPLETED || s.status === RouteStopStatus.FAILED,
        ).length,
      })),
    };
  }

  async getOne(user: AuthUser, id: string) {
    const route = await this.prisma.route.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        employee: { select: { id: true, name: true } },
        vehicle: { select: { id: true, plate: true, brand: true, model: true } },
        stops: {
          orderBy: { sequence: 'asc' },
          include: {
            visit: {
              include: {
                customer: { select: { id: true, name: true } },
                serviceOrder: { select: { id: true, number: true, title: true } },
              },
            },
          },
        },
      },
    });
    if (!route) {
      throw httpError(HttpStatus.NOT_FOUND, 'ROUTE_NOT_FOUND', 'Rota não encontrada.');
    }
    return { route };
  }

  async create(user: AuthUser, dto: CreateRouteDto) {
    const roundtrip = dto.roundtrip !== false;
    const visitIds = dto.stops.map((s) => s.visitId);
    const uniqueIds = [...new Set(visitIds)];
    if (uniqueIds.length !== visitIds.length) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_DUPLICATE_VISITS',
        'Remova visitas duplicadas da rota.',
      );
    }
    if (new Set(dto.stops.map((s) => s.sequence)).size !== dto.stops.length) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_DUPLICATE_SEQUENCE',
        'Sequência de paradas inválida.',
      );
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId: user.companyId },
      select: { id: true },
    });
    if (!employee) {
      throw httpError(HttpStatus.NOT_FOUND, 'EMPLOYEE_NOT_FOUND', 'Funcionário não encontrado.');
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, companyId: user.companyId },
      select: { id: true },
    });
    if (!vehicle) {
      throw httpError(HttpStatus.NOT_FOUND, 'VEHICLE_NOT_FOUND', 'Veículo não encontrado.');
    }

    const { origin, stops: visitStops } = await this.loadVisitStops(user.companyId, uniqueIds);
    await this.assertVisitsAvailable(user.companyId, uniqueIds);

    const recordTrip = dto.recordTrip === true;
    const recordCheck = validateRecordTripCustomers(recordTrip, uniqueIds.length);
    if (!recordCheck.ok) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        recordCheck.code,
        recordCheck.message,
      );
    }

    const byId = new Map(visitStops.map((v) => [v.id, v]));
    const orderedStops = [...dto.stops].sort((a, b) => a.sequence - b.sequence);

    const created = await this.prisma.$transaction(async (tx) => {
      const route = await tx.route.create({
        data: {
          companyId: user.companyId,
          employeeId: dto.employeeId,
          vehicleId: dto.vehicleId,
          date: new Date(`${dto.date.slice(0, 10)}T00:00:00.000Z`),
          status: RouteStatus.PLANNED,
          roundtrip,
          originName: origin.name,
          originAddress: origin.address,
          originLatitude: origin.latitude,
          originLongitude: origin.longitude,
          plannedDistanceMeters: dto.plannedDistanceMeters ?? null,
          plannedDurationSeconds: dto.plannedDurationSeconds ?? null,
          plannedGeometryJson: dto.geometry ?? Prisma.JsonNull,
          recordTrip,
          quality: dto.quality ?? null,
          stops: {
            create: orderedStops.map((s) => {
              const visit = byId.get(s.visitId)!;
              return {
                companyId: user.companyId,
                visitId: s.visitId,
                sequence: s.sequence,
                plannedDistanceMeters: s.distanceMeters ?? null,
                plannedDurationSeconds: s.durationSeconds ?? null,
                latitude: visit.latitude,
                longitude: visit.longitude,
              };
            }),
          },
        },
      });

      if (dto.geometry?.coordinates?.length) {
        const wkt = lineStringWkt(dto.geometry.coordinates);
        await tx.$executeRaw`
          UPDATE routes
          SET planned_geometry = ST_SetSRID(ST_GeomFromText(${wkt}), 4326)
          WHERE id = ${route.id}::uuid
        `;
      }

      return route;
    });

    return this.getOne(user, created.id);
  }

  async publish(user: AuthUser, id: string) {
    const route = await this.prisma.route.findFirst({
      where: { id, companyId: user.companyId },
      include: { stops: true },
    });
    if (!route) {
      throw httpError(HttpStatus.NOT_FOUND, 'ROUTE_NOT_FOUND', 'Rota não encontrada.');
    }
    if (route.status === RouteStatus.PUBLISHED) {
      return this.getOne(user, id);
    }
    if (!route.employeeId || !route.vehicleId) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_MISSING_ASSIGNMENT',
        'Defina funcionário e veículo antes de publicar.',
      );
    }
    if (!route.stops.length) {
      throw httpError(HttpStatus.UNPROCESSABLE_ENTITY, 'ROUTE_EMPTY', 'Rota sem paradas não pode ser publicada.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.route.update({
        where: { id },
        data: { status: RouteStatus.PUBLISHED, publishedAt: new Date() },
      });
      await tx.visit.updateMany({
        where: {
          id: { in: route.stops.map((s) => s.visitId) },
          companyId: user.companyId,
          status: { in: [VisitStatus.SCHEDULED, VisitStatus.RESCHEDULED] },
        },
        data: {
          status: VisitStatus.ASSIGNED,
          employeeId: route.employeeId,
        },
      });
    });

    return this.getOne(user, id);
  }

  async cancel(user: AuthUser, id: string) {
    const route = await this.prisma.route.findFirst({
      where: { id, companyId: user.companyId },
      include: { stops: { select: { visitId: true } } },
    });
    if (!route) {
      throw httpError(HttpStatus.NOT_FOUND, 'ROUTE_NOT_FOUND', 'Rota não encontrada.');
    }
    this.assertRouteEditable(route.status);

    const visitIds = route.stops.map((s) => s.visitId);

    await this.prisma.$transaction(async (tx) => {
      if (visitIds.length) {
        await tx.visit.updateMany({
          where: {
            id: { in: visitIds },
            companyId: user.companyId,
            status: VisitStatus.ASSIGNED,
          },
          data: {
            status: VisitStatus.SCHEDULED,
            employeeId: null,
          },
        });
        await tx.routeStop.deleteMany({ where: { routeId: id } });
      }
      await tx.route.update({
        where: { id },
        data: { status: RouteStatus.CANCELLED },
      });
    });

    return this.getOne(user, id);
  }

  async update(user: AuthUser, id: string, dto: UpdateRouteDto) {
    const route = await this.prisma.route.findFirst({
      where: { id, companyId: user.companyId },
      include: { stops: { select: { visitId: true } } },
    });
    if (!route) {
      throw httpError(HttpStatus.NOT_FOUND, 'ROUTE_NOT_FOUND', 'Rota não encontrada.');
    }
    this.assertRouteEditable(route.status);

    const roundtrip = dto.roundtrip !== false;
    const visitIds = dto.stops.map((s) => s.visitId);
    const uniqueIds = [...new Set(visitIds)];
    if (uniqueIds.length !== visitIds.length) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_DUPLICATE_VISITS',
        'Remova visitas duplicadas da rota.',
      );
    }
    if (new Set(dto.stops.map((s) => s.sequence)).size !== dto.stops.length) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_DUPLICATE_SEQUENCE',
        'Sequência de paradas inválida.',
      );
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId: user.companyId },
      select: { id: true },
    });
    if (!employee) {
      throw httpError(HttpStatus.NOT_FOUND, 'EMPLOYEE_NOT_FOUND', 'Funcionário não encontrado.');
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, companyId: user.companyId },
      select: { id: true },
    });
    if (!vehicle) {
      throw httpError(HttpStatus.NOT_FOUND, 'VEHICLE_NOT_FOUND', 'Veículo não encontrado.');
    }

    const { origin, stops: visitStops } = await this.loadVisitStops(user.companyId, uniqueIds);
    await this.assertVisitsAvailable(user.companyId, uniqueIds, id);

    const recordTrip = dto.recordTrip === true;
    const recordCheck = validateRecordTripCustomers(recordTrip, uniqueIds.length);
    if (!recordCheck.ok) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        recordCheck.code,
        recordCheck.message,
      );
    }

    const byId = new Map(visitStops.map((v) => [v.id, v]));
    const orderedStops = [...dto.stops].sort((a, b) => a.sequence - b.sequence);
    const previousVisitIds = route.stops.map((s) => s.visitId);
    const nextSet = new Set(uniqueIds);
    const removedVisitIds = previousVisitIds.filter((vid) => !nextSet.has(vid));

    await this.prisma.$transaction(async (tx) => {
      if (removedVisitIds.length) {
        await tx.visit.updateMany({
          where: {
            id: { in: removedVisitIds },
            companyId: user.companyId,
            status: VisitStatus.ASSIGNED,
          },
          data: {
            status: VisitStatus.SCHEDULED,
            employeeId: null,
          },
        });
      }

      await tx.routeStop.deleteMany({ where: { routeId: id } });

      await tx.route.update({
        where: { id },
        data: {
          employeeId: dto.employeeId,
          vehicleId: dto.vehicleId,
          date: new Date(`${dto.date.slice(0, 10)}T00:00:00.000Z`),
          roundtrip,
          originName: origin.name,
          originAddress: origin.address,
          originLatitude: origin.latitude,
          originLongitude: origin.longitude,
          plannedDistanceMeters: dto.plannedDistanceMeters ?? null,
          plannedDurationSeconds: dto.plannedDurationSeconds ?? null,
          plannedGeometryJson: dto.geometry ?? Prisma.JsonNull,
          recordTrip,
          quality: dto.quality ?? null,
          stops: {
            create: orderedStops.map((s) => {
              const visit = byId.get(s.visitId)!;
              return {
                companyId: user.companyId,
                visitId: s.visitId,
                sequence: s.sequence,
                plannedDistanceMeters: s.distanceMeters ?? null,
                plannedDurationSeconds: s.durationSeconds ?? null,
                latitude: visit.latitude,
                longitude: visit.longitude,
              };
            }),
          },
        },
      });

      if (dto.geometry?.coordinates?.length) {
        const wkt = lineStringWkt(dto.geometry.coordinates);
        await tx.$executeRaw`
          UPDATE routes
          SET planned_geometry = ST_SetSRID(ST_GeomFromText(${wkt}), 4326)
          WHERE id = ${id}::uuid
        `;
      } else {
        await tx.$executeRaw`
          UPDATE routes
          SET planned_geometry = NULL
          WHERE id = ${id}::uuid
        `;
      }

      if (route.status === RouteStatus.PUBLISHED) {
        await tx.visit.updateMany({
          where: {
            id: { in: uniqueIds },
            companyId: user.companyId,
            status: { in: [VisitStatus.SCHEDULED, VisitStatus.RESCHEDULED, VisitStatus.ASSIGNED] },
          },
          data: {
            status: VisitStatus.ASSIGNED,
            employeeId: dto.employeeId,
          },
        });
      }
    });

    return this.getOne(user, id);
  }

  async start(user: AuthUser, id: string, dto: StartRouteDto) {
    if (user.role !== UserRole.EMPLOYEE) {
      throw httpError(
        HttpStatus.FORBIDDEN,
        'ROUTE_START_EMPLOYEE_ONLY',
        'Apenas o funcionário atribuído pode iniciar a rota.',
      );
    }

    if (!Number.isFinite(dto.latitude) || !Number.isFinite(dto.longitude)) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_START_GPS_REQUIRED',
        'Informe a localização atual para iniciar a rota.',
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

    const route = await this.prisma.route.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!route) {
      throw httpError(HttpStatus.NOT_FOUND, 'ROUTE_NOT_FOUND', 'Rota não encontrada.');
    }
    if (route.employeeId !== employee.id) {
      throw httpError(
        HttpStatus.FORBIDDEN,
        'ROUTE_NOT_ASSIGNED',
        'Esta rota não está atribuída a você.',
      );
    }
    if (route.status === RouteStatus.IN_PROGRESS) {
      return this.getOne(user, id);
    }
    if (route.status !== RouteStatus.PUBLISHED) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_NOT_PUBLISHED',
        'Publique a rota antes de iniciar (Play).',
      );
    }

    const otherActive = await this.prisma.route.findFirst({
      where: {
        companyId: user.companyId,
        employeeId: employee.id,
        status: RouteStatus.IN_PROGRESS,
        NOT: { id },
      },
      select: { id: true, date: true },
    });
    if (otherActive) {
      const ymd = businessDayYmd(otherActive.date.toISOString());
      const [y, m, d] = ymd.split('-');
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_ALREADY_ACTIVE',
        `Você já tem uma rota em andamento (${d}/${m}/${y}). Volte para Minha rota e toque em Concluir antes de iniciar outra.`,
      );
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, companyId: user.companyId },
      select: { id: true, status: true, plate: true },
    });
    if (!vehicle) {
      throw httpError(HttpStatus.NOT_FOUND, 'VEHICLE_NOT_FOUND', 'Veículo não encontrado.');
    }
    const isAssignedVehicle = route.vehicleId === vehicle.id;
    if (!isAssignedVehicle && vehicle.status !== VehicleStatus.AVAILABLE) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VEHICLE_NOT_AVAILABLE',
        'Este veículo não está disponível. Escolha outro ou o veículo já atribuído à rota.',
      );
    }

    const routeWithStops = await this.prisma.route.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        stops: {
          orderBy: { sequence: 'asc' },
          include: {
            visit: {
              include: {
                customer: { select: { id: true, name: true } },
                serviceOrder: { select: { number: true, title: true } },
              },
            },
          },
        },
      },
    });
    if (!routeWithStops) {
      throw httpError(HttpStatus.NOT_FOUND, 'ROUTE_NOT_FOUND', 'Rota não encontrada.');
    }

    const employeeOrigin: RouteOrigin = {
      name: 'Início da rota',
      latitude: dto.latitude,
      longitude: dto.longitude,
      address: null,
    };

    const geoStops: GeoStop[] = routeWithStops.stops.map((s) => ({
      id: s.visitId,
      customerId: s.visit.customerId,
      name: s.visit.customer.name,
      city: s.visit.city,
      street: s.visit.street,
      number: s.visit.number,
      serviceOrderNumber: s.visit.serviceOrder.number,
      serviceOrderTitle: s.visit.serviceOrder.title,
      latitude: s.latitude,
      longitude: s.longitude,
    }));

    const orderedGeoStops = orderStopsNearestFirst(employeeOrigin, geoStops);
    const companyHome = routeWithStops.roundtrip
      ? await this.loadCompanyOrigin(user.companyId).catch(() => null)
      : null;
    const trip = await this.routeAlongFixedOrder(
      employeeOrigin,
      orderedGeoStops,
      routeWithStops.roundtrip,
      companyHome,
      user.companyId,
    );

    const stopByVisitId = new Map(routeWithStops.stops.map((s) => [s.visitId, s]));

    await this.prisma.$transaction(async (tx) => {
      for (const stop of routeWithStops.stops) {
        await tx.routeStop.update({
          where: { id: stop.id },
          data: { sequence: stop.sequence + 1000 },
        });
      }

      await tx.route.update({
        where: { id },
        data: {
          status: RouteStatus.IN_PROGRESS,
          startedAt: new Date(),
          vehicleId: dto.vehicleId,
          startOdometerKm: dto.startOdometerKm,
          startFuelLevel: dto.startFuelLevel,
          startNotes: dto.startNotes?.trim() || null,
          startLatitude: dto.latitude,
          startLongitude: dto.longitude,
          originName: employeeOrigin.name,
          originLatitude: dto.latitude,
          originLongitude: dto.longitude,
          plannedDistanceMeters: trip.totals.distanceMeters,
          plannedDurationSeconds: trip.totals.durationSeconds,
          plannedGeometryJson: trip.geometry as Prisma.InputJsonValue,
          plannedStepsJson: trip.plannedSteps as Prisma.InputJsonValue,
          quality: trip.quality,
        },
      });

      for (const tripStop of trip.stops) {
        const routeStop = stopByVisitId.get(tripStop.id);
        if (!routeStop) continue;
        await tx.routeStop.update({
          where: { id: routeStop.id },
          data: {
            sequence: tripStop.sequence,
            plannedDistanceMeters: tripStop.distanceMeters,
            plannedDurationSeconds: tripStop.durationSeconds,
          },
        });
      }

      if (trip.geometry.coordinates.length) {
        const wkt = lineStringWkt(trip.geometry.coordinates);
        await tx.$executeRaw`
          UPDATE routes
          SET planned_geometry = ST_SetSRID(ST_GeomFromText(${wkt}), 4326)
          WHERE id = ${id}::uuid
        `;
      }
    });

    return this.getOne(user, id);
  }

  /**
   * Recalcula geometria + manobras a partir da posição GPS atual (navegação estilo Maps).
   * reorderRemaining=true: pendentes mais perto → mais longe.
   * reorderRemaining=false: mantém ordem das pendentes (só redesenha o traçado).
   */
  async reroute(user: AuthUser, id: string, dto: RerouteRouteDto) {
    if (user.role !== UserRole.EMPLOYEE) {
      throw httpError(
        HttpStatus.FORBIDDEN,
        'ROUTE_REROUTE_EMPLOYEE_ONLY',
        'Apenas o funcionário atribuído pode recalcular a rota.',
      );
    }

    if (!Number.isFinite(dto.latitude) || !Number.isFinite(dto.longitude)) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_REROUTE_GPS_REQUIRED',
        'Informe a localização atual para recalcular a rota.',
      );
    }

    await this.assertRateLimit(user.id);

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

    const routeWithStops = await this.prisma.route.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        stops: {
          orderBy: { sequence: 'asc' },
          include: {
            visit: {
              include: {
                customer: { select: { id: true, name: true } },
                serviceOrder: { select: { number: true, title: true } },
              },
            },
          },
        },
      },
    });
    if (!routeWithStops) {
      throw httpError(HttpStatus.NOT_FOUND, 'ROUTE_NOT_FOUND', 'Rota não encontrada.');
    }
    if (routeWithStops.employeeId !== employee.id) {
      throw httpError(
        HttpStatus.FORBIDDEN,
        'ROUTE_NOT_ASSIGNED',
        'Esta rota não está atribuída a você.',
      );
    }
    if (routeWithStops.status !== RouteStatus.IN_PROGRESS) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_NOT_IN_PROGRESS',
        'Só é possível recalcular uma rota em andamento.',
      );
    }

    const gps = { latitude: dto.latitude, longitude: dto.longitude };
    const arrived = routeWithStops.stops.filter(
      (s) => haversineMeters(gps, s) <= REROUTE_NEAR_STOP_M,
    );
    const pending = routeWithStops.stops.filter(
      (s) => haversineMeters(gps, s) > REROUTE_NEAR_STOP_M,
    );

    const employeeOrigin: RouteOrigin = {
      name: 'Posição atual',
      latitude: dto.latitude,
      longitude: dto.longitude,
      address: null,
    };

    if (!pending.length) {
      await this.prisma.route.update({
        where: { id },
        data: {
          originName: employeeOrigin.name,
          originLatitude: dto.latitude,
          originLongitude: dto.longitude,
        },
      });
      return this.getOne(user, id);
    }

    const toGeo = (s: (typeof pending)[number]): GeoStop => ({
      id: s.visitId,
      customerId: s.visit.customerId,
      name: s.visit.customer.name,
      city: s.visit.city,
      street: s.visit.street,
      number: s.visit.number,
      serviceOrderNumber: s.visit.serviceOrder.number,
      serviceOrderTitle: s.visit.serviceOrder.title,
      latitude: s.latitude,
      longitude: s.longitude,
    });

    const pendingGeo = pending.map(toGeo);
    const orderedPendingGeo = dto.reorderRemaining
      ? orderStopsNearestFirst(employeeOrigin, pendingGeo)
      : pendingGeo;

    const companyHome = routeWithStops.roundtrip
      ? await this.loadCompanyOrigin(user.companyId).catch(() => null)
      : null;
    const trip = await this.routeAlongFixedOrder(
      employeeOrigin,
      orderedPendingGeo,
      routeWithStops.roundtrip,
      companyHome,
      user.companyId,
    );

    const stopByVisitId = new Map(routeWithStops.stops.map((s) => [s.visitId, s]));
    const arrivedOrdered = [...arrived].sort((a, b) => a.sequence - b.sequence);

    await this.prisma.$transaction(async (tx) => {
      for (const stop of routeWithStops.stops) {
        await tx.routeStop.update({
          where: { id: stop.id },
          data: { sequence: stop.sequence + 1000 },
        });
      }

      let seq = 1;
      for (const tripStop of trip.stops) {
        const routeStop = stopByVisitId.get(tripStop.id);
        if (!routeStop) continue;
        await tx.routeStop.update({
          where: { id: routeStop.id },
          data: {
            sequence: seq,
            plannedDistanceMeters: tripStop.distanceMeters,
            plannedDurationSeconds: tripStop.durationSeconds,
          },
        });
        seq += 1;
      }

      for (const stop of arrivedOrdered) {
        await tx.routeStop.update({
          where: { id: stop.id },
          data: {
            sequence: seq,
            plannedDistanceMeters: 0,
            plannedDurationSeconds: 0,
          },
        });
        seq += 1;
      }

      await tx.route.update({
        where: { id },
        data: {
          originName: employeeOrigin.name,
          originLatitude: dto.latitude,
          originLongitude: dto.longitude,
          plannedDistanceMeters: trip.totals.distanceMeters,
          plannedDurationSeconds: trip.totals.durationSeconds,
          plannedGeometryJson: trip.geometry as Prisma.InputJsonValue,
          plannedStepsJson: trip.plannedSteps as Prisma.InputJsonValue,
          quality: trip.quality,
        },
      });

      if (trip.geometry.coordinates.length) {
        const wkt = lineStringWkt(trip.geometry.coordinates);
        await tx.$executeRaw`
          UPDATE routes
          SET planned_geometry = ST_SetSRID(ST_GeomFromText(${wkt}), 4326)
          WHERE id = ${id}::uuid
        `;
      }
    });

    return this.getOne(user, id);
  }

  async complete(user: AuthUser, id: string, dto: CompleteRouteDto) {
    if (user.role !== UserRole.EMPLOYEE) {
      throw httpError(
        HttpStatus.FORBIDDEN,
        'ROUTE_COMPLETE_EMPLOYEE_ONLY',
        'Apenas o funcionário atribuído pode concluir a rota.',
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

    const route = await this.prisma.route.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        stops: {
          orderBy: { sequence: 'asc' },
          select: {
            id: true,
            status: true,
            sequence: true,
            latitude: true,
            longitude: true,
            plannedDistanceMeters: true,
            visit: { select: { id: true, status: true } },
          },
        },
      },
    });
    if (!route) {
      throw httpError(HttpStatus.NOT_FOUND, 'ROUTE_NOT_FOUND', 'Rota não encontrada.');
    }
    if (route.employeeId !== employee.id) {
      throw httpError(
        HttpStatus.FORBIDDEN,
        'ROUTE_NOT_ASSIGNED',
        'Esta rota não está atribuída a você.',
      );
    }
    if (
      route.status === RouteStatus.COMPLETED ||
      route.status === RouteStatus.INCOMPLETE
    ) {
      return this.getOne(user, id);
    }
    if (route.status !== RouteStatus.IN_PROGRESS) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_NOT_IN_PROGRESS',
        'Só é possível concluir uma rota em andamento.',
      );
    }

    const openVisit = route.stops.find(
      (s) =>
        s.visit?.status === VisitStatus.ARRIVED ||
        s.visit?.status === VisitStatus.IN_PROGRESS,
    );
    if (openVisit) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_HAS_OPEN_VISIT',
        'Finalize a visita em andamento antes de concluir a rota.',
      );
    }

    const pendingStops = route.stops.filter((s) => s.status === RouteStopStatus.PENDING);
    const remainingMeters = remainingPlannedMeters(route.stops);
    const withinTolerance = canCompleteAsFinished(remainingMeters, pendingStops.length);

    let finalStatus: RouteStatus = RouteStatus.COMPLETED;
    if (dto.mode === 'INCOMPLETE') {
      if (withinTolerance) {
        finalStatus = RouteStatus.COMPLETED;
      } else {
        finalStatus = RouteStatus.INCOMPLETE;
      }
    } else if (!withinTolerance) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_HAS_PENDING_STOPS',
        `Ainda há mais de ${ROUTE_COMPLETE_REMAINING_TOLERANCE_METERS} m de paradas pendentes. Finalize como incompleta ou complete as visitas.`,
      );
    }

    const now = new Date();
    const actualDurationSeconds =
      route.startedAt != null
        ? Math.max(0, Math.round((now.getTime() - route.startedAt.getTime()) / 1000))
        : null;

    const pendingIds = pendingStops.map((s) => s.id);

    await this.prisma.$transaction(async (tx) => {
      if (pendingIds.length) {
        await tx.routeStop.updateMany({
          where: { id: { in: pendingIds }, routeId: id },
          data: { status: RouteStopStatus.SKIPPED },
        });
      }
      await tx.route.update({
        where: { id },
        data: {
          status: finalStatus,
          actualDurationSeconds,
        },
      });
    });

    return this.getOne(user, id);
  }

  private async prepareCustomerAssignments(
    user: AuthUser,
    dto: PreviewCustomersRouteDto,
    requireVehicles: boolean,
  ) {
    const roundtrip = dto.roundtrip !== false;
    const recordTrip = dto.recordTrip === true;
    const originMode: RouteOriginMode =
      dto.originMode === 'COMPANY' ? 'COMPANY' : 'EMPLOYEE_LAST';
    const dateIso = utcDateIso(dto.date);
    const date = new Date(`${dateIso}T00:00:00.000Z`);

    const customerIds = uniqueOrThrow(
      dto.customerIds,
      'ROUTE_DUPLICATE_CUSTOMERS',
      'Remova clientes duplicados da rota.',
    );
    const employeeIds = uniqueOrThrow(
      dto.employeeIds,
      'ROUTE_DUPLICATE_EMPLOYEES',
      'Remova funcionários duplicados da rota.',
    );

    const recordCheck = validateRecordTripCustomers(recordTrip, customerIds.length);
    if (!recordCheck.ok) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        recordCheck.code,
        recordCheck.message,
      );
    }

    if (customerIds.length > MAX_STOPS) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_TOO_MANY_STOPS',
        `Máximo de ${MAX_STOPS} clientes por cálculo.`,
      );
    }
    if (employeeIds.length > MAX_EMPLOYEES) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_TOO_MANY_EMPLOYEES',
        `Máximo de ${MAX_EMPLOYEES} funcionários por cálculo.`,
      );
    }
    if (employeeIds.length > customerIds.length) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_TOO_MANY_EMPLOYEES',
        'Há mais funcionários do que clientes para dividir.',
      );
    }

    const origin = await this.loadCompanyOrigin(user.companyId);
    const { stops: customers, customersById } = await this.loadCustomerStops(
      user.companyId,
      customerIds,
    );
    const employees = await this.loadDispatchEmployees(
      user.companyId,
      employeeIds,
      origin,
      originMode,
    );
    const dayLoads = await this.loadEmployeeDayLoads(user.companyId, date, employeeIds);

    const reservedVehicleIds = new Set<string>();
    for (const emp of employees) {
      const load = dayLoads.get(emp.id);
      if (load?.vehicleId) reservedVehicleIds.add(load.vehicleId);
    }

    const needFreshVehicles = employees.filter((e) => !dayLoads.get(e.id)?.vehicleId).length;
    const availableVehicles = await this.loadAvailableVehicles(
      user.companyId,
      Math.max(needFreshVehicles, employees.length),
      reservedVehicleIds,
    );

    if (requireVehicles && availableVehicles.length < needFreshVehicles) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_NOT_ENOUGH_VEHICLES',
        'Não há veículos AVAILABLE suficientes para as rotas. Cadastre ou libere veículos.',
      );
    }

    const grouped = splitStopsAmongEmployees(origin, employees, customers);
    const assignments: PreparedAssignment[] = [];
    let freshVehicleIdx = 0;

    for (const employee of employees) {
      const group = grouped.get(employee.id) ?? [];
      if (!group.length) continue;

      // Início = última loc. do funcionário ou pin E; roundtrip volta ao E.
      const useCompanyStart =
        employee.positionSource === 'company' ||
        employee.positionSource === 'company_fallback';
      const employeeOrigin: RouteOrigin = useCompanyStart
        ? origin
        : {
            name: employee.name,
            latitude: employee.position.latitude,
            longitude: employee.position.longitude,
            address: null,
          };
      const ordered = orderStopsNearestFirst(employee.position, group);
      const trip = await this.routeAlongFixedOrder(
        employeeOrigin,
        ordered,
        roundtrip,
        roundtrip ? origin : null,
        user.companyId,
      );

      const existing = dayLoads.get(employee.id) ?? {
        existingRouteCount: 0,
        existingDistanceMeters: 0,
        existingDurationSeconds: 0,
        vehicleId: null,
      };
      let vehicleId = existing.vehicleId;
      if (!vehicleId) {
        vehicleId = availableVehicles[freshVehicleIdx]?.id ?? null;
        freshVehicleIdx += 1;
      }
      assignments.push({
        employee,
        vehicleId,
        trip,
        dayLoad: existing,
      });
    }

    return {
      origin,
      originMode,
      date,
      dateIso,
      roundtrip,
      recordTrip,
      customersById,
      assignments,
    };
  }

  private async loadCompanyOrigin(companyId: string): Promise<RouteOrigin> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        tradeName: true,
        address: true,
        latitude: true,
        longitude: true,
      },
    });
    if (!company) {
      throw httpError(HttpStatus.NOT_FOUND, 'COMPANY_NOT_FOUND', 'Empresa não encontrada.');
    }
    if (company.latitude == null || company.longitude == null) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'COMPANY_ORIGIN_MISSING',
        'Cadastre o pin da empresa em Configurações → Empresa para calcular rotas.',
      );
    }
    return {
      name: company.tradeName || company.name,
      address: company.address,
      latitude: company.latitude,
      longitude: company.longitude,
    };
  }

  private async loadCustomerStops(companyId: string, customerIds: string[]) {
    const rows = await this.prisma.customer.findMany({
      where: {
        companyId,
        id: { in: customerIds },
        status: CustomerStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        tradeName: true,
        street: true,
        number: true,
        complement: true,
        district: true,
        city: true,
        state: true,
        zipCode: true,
        latitude: true,
        longitude: true,
      },
    });

    if (rows.length !== customerIds.length) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_CUSTOMER_NOT_FOUND',
        'Um ou mais clientes não existem, não estão ativos ou não pertencem a esta empresa.',
      );
    }

    const byId = new Map(rows.map((c) => [c.id, c]));
    const customersById = new Map<string, (typeof rows)[number]>();
    const stops: GeoStop[] = customerIds.map((id) => {
      const c = byId.get(id)!;
      if (!customerHasPin(c)) {
        throw httpError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'CUSTOMER_NO_PIN',
          `Cliente "${c.name}" não tem pin no mapa. Geocodifique o endereço antes de montar a rota.`,
        );
      }
      customersById.set(c.id, c);
      return {
        id: c.id,
        customerId: c.id,
        name: c.tradeName || c.name,
        city: c.city,
        street: c.street,
        number: c.number,
        serviceOrderNumber: 0,
        serviceOrderTitle: '',
        latitude: c.latitude,
        longitude: c.longitude,
      };
    });

    return { stops, customersById };
  }

  private async loadDispatchEmployees(
    companyId: string,
    employeeIds: string[],
    origin: RouteOrigin,
    originMode: RouteOriginMode,
  ): Promise<EmployeeSlot[]> {
    const rows = await this.prisma.employee.findMany({
      where: { companyId, id: { in: employeeIds } },
      select: { id: true, name: true, status: true, userId: true },
    });

    if (rows.length !== employeeIds.length) {
      throw httpError(
        HttpStatus.NOT_FOUND,
        'EMPLOYEE_NOT_FOUND',
        'Um ou mais funcionários não existem ou não pertencem a esta empresa.',
      );
    }

    const byId = new Map(rows.map((e) => [e.id, e]));
    const result: EmployeeSlot[] = [];
    const companyLatLng = { latitude: origin.latitude, longitude: origin.longitude };

    for (const id of employeeIds) {
      const emp = byId.get(id)!;
      if (emp.status !== EmployeeStatus.ACTIVE) {
        throw httpError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'EMPLOYEE_NOT_ACTIVE',
          `Funcionário "${emp.name}" não está ativo.`,
        );
      }
      if (!emp.userId) {
        throw httpError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'EMPLOYEE_LOGIN_REQUIRED',
          `Funcionário "${emp.name}" precisa de login para receber a rota.`,
        );
      }

      const lastKnown =
        originMode === 'EMPLOYEE_LAST'
          ? await this.tracking.getLastKnownPosition(companyId, emp.id)
          : null;
      const picked = pickEmployeeDispatchPosition(originMode, lastKnown, companyLatLng);
      result.push({
        id: emp.id,
        name: emp.name,
        position: picked.position,
        positionSource: picked.source,
        recordedAt: picked.recordedAt,
      });
    }

    return result;
  }

  private async loadAvailableVehicles(
    companyId: string,
    take: number,
    excludeIds: Set<string> = new Set(),
  ) {
    const rows = await this.prisma.vehicle.findMany({
      where: {
        companyId,
        status: VehicleStatus.AVAILABLE,
        ...(excludeIds.size ? { id: { notIn: [...excludeIds] } } : {}),
      },
      select: { id: true, plate: true },
      orderBy: { plate: 'asc' },
      take: Math.max(take, 1),
    });
    return rows;
  }

  private async loadEmployeeDayLoads(
    companyId: string,
    date: Date,
    employeeIds: string[],
  ): Promise<Map<string, EmployeeDayLoad>> {
    const map = new Map<string, EmployeeDayLoad>();
    for (const id of employeeIds) {
      map.set(id, {
        existingRouteCount: 0,
        existingDistanceMeters: 0,
        existingDurationSeconds: 0,
        vehicleId: null,
      });
    }
    if (!employeeIds.length) return map;

    const routes = await this.prisma.route.findMany({
      where: {
        companyId,
        date,
        employeeId: { in: employeeIds },
        status: { in: DAY_ACTIVE_ROUTE_STATUSES },
      },
      select: {
        employeeId: true,
        vehicleId: true,
        plannedDistanceMeters: true,
        plannedDurationSeconds: true,
        publishedAt: true,
        createdAt: true,
      },
      orderBy: [{ publishedAt: 'asc' }, { createdAt: 'asc' }],
    });

    for (const route of routes) {
      if (!route.employeeId) continue;
      const cur = map.get(route.employeeId)!;
      cur.existingRouteCount += 1;
      cur.existingDistanceMeters += route.plannedDistanceMeters ?? 0;
      cur.existingDurationSeconds += route.plannedDurationSeconds ?? 0;
      if (!cur.vehicleId && route.vehicleId) cur.vehicleId = route.vehicleId;
    }
    return map;
  }

  private toCustomerAssignment(assignment: PreparedAssignment): CustomerAssignmentDto {
    const newDistance = assignment.trip.totals.distanceMeters;
    const newDuration = assignment.trip.totals.durationSeconds;
    const dayDistanceMeters = assignment.dayLoad.existingDistanceMeters + newDistance;
    const dayDurationSeconds = assignment.dayLoad.existingDurationSeconds + newDuration;
    return {
      employeeId: assignment.employee.id,
      employeeName: assignment.employee.name,
      vehicleId: assignment.vehicleId,
      stops: assignment.trip.stops.map((s) => ({
        sequence: s.sequence,
        customerId: s.customerId,
        name: s.name,
        city: s.city,
        street: s.street,
        number: s.number,
        latitude: s.latitude,
        longitude: s.longitude,
        distanceMeters: s.distanceMeters,
        durationSeconds: s.durationSeconds,
      })),
      totals: assignment.trip.totals,
      dayLoad: {
        existingRouteCount: assignment.dayLoad.existingRouteCount,
        existingDistanceMeters: assignment.dayLoad.existingDistanceMeters,
        existingDurationSeconds: assignment.dayLoad.existingDurationSeconds,
        dayDistanceMeters,
        dayDurationSeconds,
        dayDistanceKm: Math.round((dayDistanceMeters / 1000) * 10) / 10,
      },
      geometry: assignment.trip.geometry,
      quality: assignment.trip.quality,
      startOrigin: {
        source: assignment.employee.positionSource,
        name: assignment.trip.origin.name,
        latitude: assignment.trip.origin.latitude,
        longitude: assignment.trip.origin.longitude,
        recordedAt: assignment.employee.recordedAt,
      },
    };
  }

  private toVisitPreview(trip: OptimizedTrip): RoutePreviewResult {
    return {
      origin: trip.origin,
      stops: trip.stops.map((s) => ({
        sequence: s.sequence,
        visitId: s.id,
        customerId: s.customerId,
        name: s.name,
        city: s.city,
        street: s.street,
        number: s.number,
        serviceOrderNumber: s.serviceOrderNumber,
        serviceOrderTitle: s.serviceOrderTitle,
        latitude: s.latitude,
        longitude: s.longitude,
        distanceMeters: s.distanceMeters,
        durationSeconds: s.durationSeconds,
      })),
      totals: trip.totals,
      geometry: trip.geometry,
      quality: trip.quality,
      roundtrip: trip.roundtrip,
    };
  }

  private async loadVisitStops(companyId: string, visitIds: string[]) {
    const origin = await this.loadCompanyOrigin(companyId);

    const visits = await this.prisma.visit.findMany({
      where: {
        companyId,
        id: { in: visitIds },
        status: { in: [VisitStatus.SCHEDULED, VisitStatus.RESCHEDULED, VisitStatus.ASSIGNED] },
      },
      include: {
        customer: { select: { id: true, name: true, tradeName: true } },
        serviceOrder: { select: { number: true, title: true } },
      },
    });

    if (visits.length !== visitIds.length) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_VISIT_NOT_FOUND',
        'Uma ou mais visitas não existem, não estão disponíveis ou não pertencem a esta empresa.',
      );
    }

    const byId = new Map(visits.map((v) => [v.id, v]));
    const stops: GeoStop[] = visitIds.map((id) => {
      const v = byId.get(id)!;
      return {
        id: v.id,
        customerId: v.customerId,
        name: v.customer.tradeName || v.customer.name,
        city: v.city,
        street: v.street,
        number: v.number,
        serviceOrderNumber: v.serviceOrder.number,
        serviceOrderTitle: v.serviceOrder.title,
        latitude: v.latitude,
        longitude: v.longitude,
      };
    });

    return { origin, stops };
  }

  private assertRouteEditable(status: RouteStatus) {
    if (!EDITABLE_ROUTE_STATUSES.includes(status)) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_NOT_EDITABLE',
        'Só é possível cancelar ou alterar rotas planejadas ou publicadas (antes do início).',
      );
    }
  }

  private async assertVisitsAvailable(
    companyId: string,
    visitIds: string[],
    exceptRouteId?: string,
  ) {
    const busy = await this.prisma.routeStop.findMany({
      where: {
        visitId: { in: visitIds },
        ...(exceptRouteId ? { routeId: { not: exceptRouteId } } : {}),
        route: { companyId, status: { in: ACTIVE_ROUTE_STATUSES } },
      },
      select: { visitId: true },
    });
    if (busy.length) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ROUTE_VISIT_ALREADY_ASSIGNED',
        'Uma ou mais visitas já estão em outra rota ativa.',
      );
    }
  }

  private async assertRateLimit(userId: string) {
    const count = await this.redis.incrWithTtl(`rl:routes:preview:${userId}`, RATE_WINDOW_SEC);
    if (count > RATE_MAX) {
      throw httpError(
        HttpStatus.TOO_MANY_REQUESTS,
        'ROUTE_RATE_LIMITED',
        'Muitos cálculos de rota. Aguarde um momento.',
      );
    }
  }

  private async routeAlongFixedOrder(
    origin: RouteOrigin,
    orderedVisits: GeoStop[],
    roundtrip: boolean,
    returnTo?: RouteOrigin | null,
    companyId?: string,
  ): Promise<OptimizedTrip> {
    if (companyId && orderedVisits.length === 1) {
      const stop = orderedVisits[0];
      const access = await this.prisma.customerAccessPath.findFirst({
        where: {
          companyId,
          customerId: stop.customerId,
          status: CustomerAccessPathStatus.ACTIVE,
        },
        select: { geometryJson: true, distanceMeters: true },
      });
      const geo = access?.geometryJson as
        | { type?: string; coordinates?: [number, number][] }
        | null
        | undefined;
      if (geo?.type === 'LineString' && Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
        return tripFromAccessPath(
          origin,
          stop,
          { type: 'LineString', coordinates: geo.coordinates },
          access?.distanceMeters,
          roundtrip,
          returnTo,
        );
      }
    }

    const osrm = await this.tryOsrmRoute(origin, orderedVisits, roundtrip, returnTo);
    if (osrm) return osrm;
    return straightLineTripAlongOrder(origin, orderedVisits, roundtrip, returnTo);
  }

  private async tryOsrmRoute(
    origin: RouteOrigin,
    orderedVisits: GeoStop[],
    roundtrip: boolean,
    returnTo?: RouteOrigin | null,
  ): Promise<OptimizedTrip | null> {
    const base =
      this.config.get<string>('OSRM_URL')?.replace(/\/$/, '') ||
      'https://router.project-osrm.org';

    const home = returnTo ?? origin;
    const coordList = [
      `${origin.longitude},${origin.latitude}`,
      ...orderedVisits.map((v) => `${v.longitude},${v.latitude}`),
    ];
    if (roundtrip && orderedVisits.length) {
      coordList.push(`${home.longitude},${home.latitude}`);
    }

    const url = new URL(`${base}/route/v1/driving/${coordList.join(';')}`);
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('overview', 'full');
    url.searchParams.set('steps', 'true');

    let data: OsrmRouteResponse;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      data = (await res.json()) as OsrmRouteResponse;
    } catch {
      return null;
    }

    return routeFromOsrm(origin, orderedVisits, roundtrip, data);
  }

  private async optimizeTrip(
    origin: RouteOrigin,
    stops: GeoStop[],
    roundtrip: boolean,
    includeSteps: boolean,
  ): Promise<OptimizedTrip> {
    const osrm = await this.tryOsrm(origin, stops, roundtrip, includeSteps);
    if (osrm) return osrm;
    return straightLineTrip(origin, stops, roundtrip);
  }

  private async tryOsrm(
    origin: RouteOrigin,
    visits: GeoStop[],
    roundtrip: boolean,
    includeSteps: boolean,
  ): Promise<OptimizedTrip | null> {
    const base =
      this.config.get<string>('OSRM_URL')?.replace(/\/$/, '') ||
      'https://router.project-osrm.org';

    const coords = [
      `${origin.longitude},${origin.latitude}`,
      ...visits.map((v) => `${v.longitude},${v.latitude}`),
    ].join(';');

    const url = new URL(`${base}/trip/v1/driving/${coords}`);
    url.searchParams.set('source', 'first');
    url.searchParams.set('roundtrip', roundtrip ? 'true' : 'false');
    if (!roundtrip) url.searchParams.set('destination', 'any');
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('overview', 'full');
    url.searchParams.set('annotations', 'false');
    if (includeSteps) url.searchParams.set('steps', 'true');

    let data: OsrmTripResponse;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      data = (await res.json()) as OsrmTripResponse;
    } catch {
      return null;
    }

    return tripFromOsrm(origin, visits, roundtrip, data);
  }
}

function uniqueOrThrow(ids: string[], code: string, message: string): string[] {
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) {
    throw httpError(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
  }
  return unique;
}

function utcDateIso(value?: string): string {
  return businessDayYmd(value);
}
