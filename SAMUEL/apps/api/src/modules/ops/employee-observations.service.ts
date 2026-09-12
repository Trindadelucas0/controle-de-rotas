import { Injectable, HttpStatus } from '@nestjs/common';
import {
  EmployeeObservationCode,
  EmployeeObservationSeverity,
  EmployeeObservationStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { httpError } from '../../common/errors/http-error';
import { AuthUser } from '../auth/decorators/auth.decorators';

export type ObservationDetails = Record<string, unknown>;

const OFFICE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.PLATFORM_ADMIN,
];

@Injectable()
export class EmployeeObservationsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertOffice(user: AuthUser) {
    if (!OFFICE_ROLES.includes(user.role)) {
      throw httpError(
        HttpStatus.FORBIDDEN,
        'AUTH_FORBIDDEN',
        'Você não tem permissão para ver estas observações.',
      );
    }
  }

  async upsert(input: {
    companyId: string;
    employeeId: string;
    routeId: string;
    vehicleId?: string | null;
    code: EmployeeObservationCode;
    severity?: EmployeeObservationSeverity;
    summary: string;
    details?: ObservationDetails;
  }) {
    if (!input.employeeId) return null;
    return this.prisma.employeeObservation.upsert({
      where: { routeId_code: { routeId: input.routeId, code: input.code } },
      create: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        routeId: input.routeId,
        vehicleId: input.vehicleId ?? null,
        code: input.code,
        severity: input.severity ?? EmployeeObservationSeverity.WARNING,
        status: EmployeeObservationStatus.OPEN,
        summary: input.summary.slice(0, 500),
        details: (input.details ?? {}) as Prisma.InputJsonValue,
      },
      update: {
        severity: input.severity ?? EmployeeObservationSeverity.WARNING,
        status: EmployeeObservationStatus.OPEN,
        summary: input.summary.slice(0, 500),
        details: (input.details ?? {}) as Prisma.InputJsonValue,
        vehicleId: input.vehicleId ?? undefined,
      },
    });
  }

  async listByEmployee(user: AuthUser, employeeId: string) {
    this.assertOffice(user);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId: user.companyId },
      select: { id: true },
    });
    if (!employee) {
      throw httpError(HttpStatus.NOT_FOUND, 'EMPLOYEE_NOT_FOUND', 'Funcionário não encontrado.');
    }

    const observations = await this.prisma.employeeObservation.findMany({
      where: { companyId: user.companyId, employeeId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        route: {
          select: {
            id: true,
            date: true,
            status: true,
            plannedDistanceMeters: true,
            actualDistanceMeters: true,
            startOdometerKm: true,
            endOdometerKm: true,
            startFuelLevel: true,
            endFuelLevel: true,
          },
        },
        vehicle: { select: { id: true, plate: true } },
      },
    });

    const routeIds = [...new Set(observations.map((o) => o.routeId))];
    const evidence =
      routeIds.length === 0
        ? []
        : await this.prisma.routeEvidence.findMany({
            where: { companyId: user.companyId, routeId: { in: routeIds } },
            select: { id: true, routeId: true, kind: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          });
    const evidenceByRoute = new Map<string, typeof evidence>();
    for (const row of evidence) {
      const list = evidenceByRoute.get(row.routeId) ?? [];
      list.push(row);
      evidenceByRoute.set(row.routeId, list);
    }

    return {
      observations: observations.map((o) => ({
        id: o.id,
        code: o.code,
        severity: o.severity,
        status: o.status,
        summary: o.summary,
        details: o.details,
        createdAt: o.createdAt.toISOString(),
        route: {
          id: o.route.id,
          date: o.route.date.toISOString().slice(0, 10),
          status: o.route.status,
          plannedDistanceMeters: o.route.plannedDistanceMeters,
          actualDistanceMeters: o.route.actualDistanceMeters,
          startOdometerKm: o.route.startOdometerKm,
          endOdometerKm: o.route.endOdometerKm,
          startFuelLevel: o.route.startFuelLevel,
          endFuelLevel: o.route.endFuelLevel,
        },
        vehicle: o.vehicle,
        evidence: (evidenceByRoute.get(o.routeId) ?? []).map((e) => ({
          id: e.id,
          kind: e.kind,
          createdAt: e.createdAt.toISOString(),
        })),
      })),
    };
  }

  async markSeen(user: AuthUser, employeeId: string, observationId: string) {
    this.assertOffice(user);
    const row = await this.prisma.employeeObservation.findFirst({
      where: { id: observationId, employeeId, companyId: user.companyId },
    });
    if (!row) {
      throw httpError(HttpStatus.NOT_FOUND, 'OBSERVATION_NOT_FOUND', 'Observação não encontrada.');
    }
    const updated = await this.prisma.employeeObservation.update({
      where: { id: row.id },
      data: { status: EmployeeObservationStatus.SEEN },
    });
    return { observation: { id: updated.id, status: updated.status } };
  }

  async openAlertsForSnapshot(companyId: string, since: Date) {
    return this.prisma.employeeObservation.findMany({
      where: {
        companyId,
        status: EmployeeObservationStatus.OPEN,
        createdAt: { gte: since },
        code: {
          in: [
            EmployeeObservationCode.KM_DISCREPANCY,
            EmployeeObservationCode.OFF_ROUTE,
            EmployeeObservationCode.ODOMETER_ROLLBACK,
          ],
        },
      },
      include: {
        employee: { select: { id: true, name: true } },
        route: { select: { id: true, date: true } },
        vehicle: { select: { plate: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
  }

  async openSummariesForEmployee(companyId: string, employeeId: string) {
    return this.prisma.employeeObservation.findMany({
      where: {
        companyId,
        employeeId,
        status: EmployeeObservationStatus.OPEN,
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        code: true,
        severity: true,
        summary: true,
      },
    });
  }
}
