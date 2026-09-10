import { Injectable, HttpStatus } from '@nestjs/common';
import {
  CustomerAccessPathStatus,
  LocationStatus,
  Prisma,
  RouteStatus,
  UserRole,
} from '@prisma/client';
import { CustomersRepository } from './customers.repository';
import {
  CreateCustomerDto,
  CreateCustomerLandmarkDto,
  ListCustomersQueryDto,
  UpdateCustomerDto,
} from './dto/customers.dto';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';
import { MapService } from '../map/map.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  consolidateTrackingToLineString,
  evaluateAccessReadAuth,
  evaluateLandmarkCreateAuth,
  isValidLatLng,
  normalizeLandmarkNote,
  sanitizeTrailPoints,
  type SanitizedTrailPoint,
} from './access-path.util';
import { lineStringWkt } from '../routes/routes-geo';

export type AccessPathFinalizeResult =
  | { saved: true; pathId: string; pointCount: number }
  | { saved: false; reason: string };

function resolveLocationStatus(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): LocationStatus {
  if (latitude != null && longitude != null) {
    return LocationStatus.OK;
  }
  return LocationStatus.PENDING;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly customersRepository: CustomersRepository,
    private readonly mapService: MapService,
    private readonly prisma: PrismaService,
  ) {}

  async list(user: AuthUser, query: ListCustomersQueryDto) {
    const customers = await this.customersRepository.list({
      companyId: user.companyId,
      q: query.q,
      status: query.status,
      document: query.document,
    });
    return { customers };
  }

  async create(user: AuthUser, dto: CreateCustomerDto) {
    const latitude = dto.latitude ?? null;
    const longitude = dto.longitude ?? null;
    const customer = await this.customersRepository.create({
      company: { connect: { id: user.companyId } },
      name: dto.name,
      tradeName: dto.tradeName ?? null,
      document: dto.document ?? null,
      phone: dto.phone ?? null,
      whatsapp: dto.whatsapp ?? null,
      email: dto.email ?? null,
      street: dto.street ?? null,
      number: dto.number ?? null,
      complement: dto.complement ?? null,
      district: dto.district ?? null,
      city: dto.city ?? null,
      state: dto.state ?? null,
      zipCode: dto.zipCode ?? null,
      latitude,
      longitude,
      locationStatus: resolveLocationStatus(latitude, longitude),
      category: dto.category ?? null,
      priority: dto.priority ?? null,
      notes: dto.notes ?? null,
      status: dto.status,
    });
    return { customer };
  }

  async getOne(user: AuthUser, id: string) {
    const customer = await this.customersRepository.findByIdInCompany(id, user.companyId);
    if (!customer) {
      throw httpError(HttpStatus.NOT_FOUND, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.');
    }
    return { customer };
  }

  async update(user: AuthUser, id: string, dto: UpdateCustomerDto) {
    const existing = await this.customersRepository.findByIdInCompany(id, user.companyId);
    if (!existing) {
      throw httpError(HttpStatus.NOT_FOUND, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.');
    }

    const latitude = dto.latitude !== undefined ? dto.latitude : existing.latitude;
    const longitude = dto.longitude !== undefined ? dto.longitude : existing.longitude;
    const locationTouched = dto.latitude !== undefined || dto.longitude !== undefined;

    const customer = await this.customersRepository.update(id, user.companyId, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.tradeName !== undefined ? { tradeName: dto.tradeName } : {}),
      ...(dto.document !== undefined ? { document: dto.document } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.whatsapp !== undefined ? { whatsapp: dto.whatsapp } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.street !== undefined ? { street: dto.street } : {}),
      ...(dto.number !== undefined ? { number: dto.number } : {}),
      ...(dto.complement !== undefined ? { complement: dto.complement } : {}),
      ...(dto.district !== undefined ? { district: dto.district } : {}),
      ...(dto.city !== undefined ? { city: dto.city } : {}),
      ...(dto.state !== undefined ? { state: dto.state } : {}),
      ...(dto.zipCode !== undefined ? { zipCode: dto.zipCode } : {}),
      ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
      ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      ...(locationTouched
        ? { locationStatus: resolveLocationStatus(latitude, longitude) }
        : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    });

    return { customer };
  }

  geocode(user: AuthUser, id: string) {
    return this.mapService.geocodeCustomer(user, id);
  }

  private async myEmployeeId(user: AuthUser): Promise<string | null> {
    if (user.role !== UserRole.EMPLOYEE) return null;
    const emp = await this.prisma.employee.findFirst({
      where: { companyId: user.companyId, userId: user.id },
      select: { id: true },
    });
    return emp?.id ?? null;
  }

  private async employeeInProgressLandmarkContext(
    companyId: string,
    employeeId: string,
    customerId: string,
  ): Promise<{ onRoute: boolean; recordTrip: boolean }> {
    const stop = await this.prisma.routeStop.findFirst({
      where: {
        companyId,
        visit: { customerId },
        route: {
          companyId,
          employeeId,
          status: RouteStatus.IN_PROGRESS,
        },
      },
      select: {
        id: true,
        route: { select: { recordTrip: true } },
      },
    });
    return {
      onRoute: Boolean(stop),
      recordTrip: stop?.route.recordTrip === true,
    };
  }

  async createLandmark(user: AuthUser, customerId: string, dto: CreateCustomerLandmarkDto) {
    if (!isValidLatLng(dto.latitude, dto.longitude)) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'LANDMARK_INVALID_COORDS',
        'Informe latitude e longitude válidas.',
      );
    }

    const customer = await this.customersRepository.findByIdInCompany(
      customerId,
      user.companyId,
    );
    const actorEmployeeId = await this.myEmployeeId(user);
    const ctx =
      actorEmployeeId != null
        ? await this.employeeInProgressLandmarkContext(
            user.companyId,
            actorEmployeeId,
            customerId,
          )
        : { onRoute: false, recordTrip: false };

    const auth = evaluateLandmarkCreateAuth({
      actorRole: user.role,
      actorEmployeeId,
      customerFoundInTenant: Boolean(customer),
      employeeOnInProgressRouteForCustomer: ctx.onRoute,
      routeHasRecordTrip: ctx.recordTrip,
    });
    if (!auth.ok) {
      throw httpError(auth.statusCode as HttpStatus, auth.code, auth.message);
    }

    const landmark = await this.prisma.customerLandmark.create({
      data: {
        companyId: user.companyId,
        customerId,
        type: dto.type,
        latitude: dto.latitude,
        longitude: dto.longitude,
        note: normalizeLandmarkNote(dto.note),
        createdByEmployeeId: actorEmployeeId,
      },
    });

    return { landmark };
  }

  async getAccess(user: AuthUser, customerId: string) {
    const customer = await this.customersRepository.findByIdInCompany(
      customerId,
      user.companyId,
    );
    const auth = evaluateAccessReadAuth({
      actorRole: user.role,
      customerFoundInTenant: Boolean(customer),
    });
    if (!auth.ok) {
      throw httpError(auth.statusCode as HttpStatus, auth.code, auth.message);
    }

    const [accessPath, landmarks] = await Promise.all([
      this.prisma.customerAccessPath.findFirst({
        where: {
          companyId: user.companyId,
          customerId,
          status: CustomerAccessPathStatus.ACTIVE,
        },
        select: {
          id: true,
          customerId: true,
          routeId: true,
          geometryJson: true,
          distanceMeters: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.customerLandmark.findMany({
        where: { companyId: user.companyId, customerId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          latitude: true,
          longitude: true,
          note: true,
          createdAt: true,
        },
      }),
    ]);

    return { accessPath, landmarks };
  }

  /**
   * Consolida TrackingPoint da rota em CustomerAccessPath ACTIVE (supersede anterior).
   * Chamado no check-in/check-out quando route.recordTrip = true.
   */
  async finalizeAccessPathFromCheckIn(input: {
    companyId: string;
    customerId: string;
    routeId: string;
    employeeId: string | null;
    destination: { latitude: number; longitude: number };
    extraPoints?: SanitizedTrailPoint[];
  }): Promise<AccessPathFinalizeResult> {
    const route = await this.prisma.route.findFirst({
      where: { id: input.routeId, companyId: input.companyId },
      select: {
        id: true,
        recordTrip: true,
        originLatitude: true,
        originLongitude: true,
        startLatitude: true,
        startLongitude: true,
      },
    });
    if (!route) {
      return { saved: false, reason: 'ROUTE_NOT_FOUND' };
    }
    if (!route.recordTrip) {
      return { saved: false, reason: 'NOT_RECORDING' };
    }
    if (!isValidLatLng(input.destination.latitude, input.destination.longitude)) {
      return { saved: false, reason: 'INVALID_DESTINATION' };
    }

    const extras = input.extraPoints ?? [];
    if (extras.length && input.employeeId) {
      try {
        await this.prisma.trackingPoint.createMany({
          data: extras.map((p) => ({
            companyId: input.companyId,
            routeId: input.routeId,
            employeeId: input.employeeId as string,
            latitude: p.latitude,
            longitude: p.longitude,
            recordedAt: p.recordedAt,
          })),
        });
      } catch {
        // merge abaixo ainda usa extraPoints em memória
      }
    }

    const dbPoints = await this.prisma.trackingPoint.findMany({
      where: { companyId: input.companyId, routeId: input.routeId },
      orderBy: { recordedAt: 'asc' },
      select: { latitude: true, longitude: true },
    });

    const merged = [
      ...dbPoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
      ...extras.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    ];

    const origin =
      route.startLatitude != null && route.startLongitude != null
        ? { latitude: route.startLatitude, longitude: route.startLongitude }
        : { latitude: route.originLatitude, longitude: route.originLongitude };

    const consolidated = consolidateTrackingToLineString({
      points: merged,
      origin,
      destination: input.destination,
      keepOriginDestination: true,
    });
    if (!consolidated) {
      return { saved: false, reason: 'INSUFFICIENT_GEOMETRY' };
    }

    try {
      const created = await this.persistActiveAccessPath({
        companyId: input.companyId,
        customerId: input.customerId,
        routeId: input.routeId,
        employeeId: input.employeeId,
        geometry: consolidated.geometry,
        distanceMeters: consolidated.distanceMeters,
      });
      return {
        saved: true,
        pathId: created.id,
        pointCount: consolidated.geometry.coordinates.length,
      };
    } catch {
      return { saved: false, reason: 'TRANSACTION_FAILED' };
    }
  }

  private async persistActiveAccessPath(input: {
    companyId: string;
    customerId: string;
    routeId: string;
    employeeId: string | null;
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    distanceMeters: number;
  }) {
    const write = async () =>
      this.prisma.$transaction(async (tx) => {
        await tx.customerAccessPath.updateMany({
          where: {
            companyId: input.companyId,
            customerId: input.customerId,
            status: CustomerAccessPathStatus.ACTIVE,
          },
          data: { status: CustomerAccessPathStatus.SUPERSEDED },
        });

        const path = await tx.customerAccessPath.create({
          data: {
            companyId: input.companyId,
            customerId: input.customerId,
            routeId: input.routeId,
            geometryJson: input.geometry as Prisma.InputJsonValue,
            distanceMeters: input.distanceMeters,
            recordedByEmployeeId: input.employeeId,
            status: CustomerAccessPathStatus.ACTIVE,
          },
        });

        if (input.geometry.coordinates.length >= 2) {
          const wkt = lineStringWkt(input.geometry.coordinates);
          await tx.$executeRaw`
            UPDATE customer_access_paths
            SET geometry = ST_SetSRID(ST_GeomFromText(${wkt}), 4326)
            WHERE id = ${path.id}::uuid
          `;
        }

        return path;
      });

    try {
      return await write();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2002') {
        return write();
      }
      throw err;
    }
  }

  async hasActiveAccessPathForRoute(companyId: string, routeId: string): Promise<boolean> {
    const row = await this.prisma.customerAccessPath.findFirst({
      where: {
        companyId,
        routeId,
        status: CustomerAccessPathStatus.ACTIVE,
      },
      select: { id: true },
    });
    return Boolean(row);
  }

  async loadActiveAccessPaths(
    companyId: string,
    customerIds: string[],
  ): Promise<
    Map<
      string,
      {
        geometryJson: unknown;
        distanceMeters: number | null;
      }
    >
  > {
    if (!customerIds.length) return new Map();
    const rows = await this.prisma.customerAccessPath.findMany({
      where: {
        companyId,
        customerId: { in: customerIds },
        status: CustomerAccessPathStatus.ACTIVE,
      },
      select: {
        customerId: true,
        geometryJson: true,
        distanceMeters: true,
      },
    });
    return new Map(
      rows.map((r) => [
        r.customerId,
        { geometryJson: r.geometryJson, distanceMeters: r.distanceMeters },
      ]),
    );
  }

  async loadLandmarksForCustomers(companyId: string, customerIds: string[]) {
    if (!customerIds.length) return new Map<string, never[]>();
    const rows = await this.prisma.customerLandmark.findMany({
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
    });
    const map = new Map<
      string,
      { id: string; type: string; latitude: number; longitude: number; note: string | null }[]
    >();
    for (const r of rows) {
      const list = map.get(r.customerId) ?? [];
      list.push({
        id: r.id,
        type: r.type,
        latitude: r.latitude,
        longitude: r.longitude,
        note: r.note,
      });
      map.set(r.customerId, list);
    }
    return map;
  }
}
