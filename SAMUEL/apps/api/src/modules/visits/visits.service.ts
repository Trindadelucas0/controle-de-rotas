import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  RouteStopStatus,
  ServiceOrderStatus,
  UserRole,
  VisitEventType,
  VisitOutcome,
  VisitStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { LocalStorageService } from '../../common/storage/local-storage.service';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';
import { visitAddressSnapshot } from '../service-orders/visit-snapshot';
import {
  assertEvidenceCount,
  validateEvidenceUpload,
} from './visit-file.util';
import {
  CheckInVisitDto,
  CheckOutVisitDto,
  ListVisitsQueryDto,
  UpdateVisitDto,
} from './dto/visits.dto';
import {
  evaluateVisitCheckIn,
  evaluateVisitCheckOut,
  routeStopStatusForOutcome,
  visitStatusForOutcome,
} from './visit-state';
import { sanitizeTrailPoints } from '../customers/access-path.util';
import type { AccessPathFinalizeResult } from '../customers/customers.service';

const ACTIVE_ROUTE_STATUSES = ['DRAFT', 'PLANNED', 'ASSIGNED', 'PUBLISHED', 'IN_PROGRESS'] as const;

const visitDetailInclude = {
  customer: true,
  employee: { select: { id: true, name: true } },
  serviceOrder: { select: { id: true, number: true, title: true, status: true } },
  routeStop: {
    include: {
      route: { select: { id: true, date: true, status: true, recordTrip: true } },
    },
  },
  evidence: {
    select: {
      id: true,
      type: true,
      mimeType: true,
      sizeBytes: true,
      caption: true,
      originalName: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.VisitInclude;

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
    private readonly customersService: CustomersService,
  ) {}

  async list(user: AuthUser, query: ListVisitsQueryDto) {
    const employeeId = await this.resolveEmployeeScope(user, query.employeeId);

    const where: Prisma.VisitWhereInput = {
      companyId: user.companyId,
      customer: { recordSessionShell: false },
      ...(employeeId ? { employeeId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.serviceOrderId ? { serviceOrderId: query.serviceOrderId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            scheduledStart: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const visits = await this.prisma.visit.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, tradeName: true } },
        employee: { select: { id: true, name: true } },
        serviceOrder: { select: { id: true, number: true, title: true, status: true } },
        routeStop: { select: { id: true, routeId: true, sequence: true, status: true } },
      },
      orderBy: [{ scheduledStart: 'asc' }],
      take: 500,
    });

    return { visits };
  }

  async getOne(user: AuthUser, id: string) {
    const visit = await this.prisma.visit.findFirst({
      where: { id, companyId: user.companyId },
      include: visitDetailInclude,
    });
    if (!visit) {
      throw httpError(HttpStatus.NOT_FOUND, 'VISIT_NOT_FOUND', 'Visita não encontrada.');
    }
    if (user.role === UserRole.EMPLOYEE) {
      const mine = await this.myEmployeeId(user);
      if (!mine || visit.employeeId !== mine) {
        throw httpError(HttpStatus.FORBIDDEN, 'VISIT_FORBIDDEN', 'Você não pode ver esta visita.');
      }
    }
    return { visit };
  }

  async update(user: AuthUser, id: string, dto: UpdateVisitDto) {
    const visit = await this.prisma.visit.findFirst({
      where: { id, companyId: user.companyId },
      include: { routeStop: { include: { route: true } } },
    });
    if (!visit) {
      throw httpError(HttpStatus.NOT_FOUND, 'VISIT_NOT_FOUND', 'Visita não encontrada.');
    }
    if (visit.status === VisitStatus.CANCELLED) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VISIT_CANCELLED',
        'Visita cancelada não pode ser editada.',
      );
    }

    if (dto.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: dto.employeeId, companyId: user.companyId },
        select: { id: true },
      });
      if (!employee) {
        throw httpError(HttpStatus.NOT_FOUND, 'EMPLOYEE_NOT_FOUND', 'Funcionário não encontrado.');
      }
    }

    const cancelling = dto.status === VisitStatus.CANCELLED;
    const rescheduling =
      dto.scheduledStart !== undefined ||
      dto.scheduledEnd !== undefined ||
      dto.status === VisitStatus.RESCHEDULED;

    if (
      (cancelling || rescheduling) &&
      visit.routeStop &&
      ACTIVE_ROUTE_STATUSES.includes(
        visit.routeStop.route.status as (typeof ACTIVE_ROUTE_STATUSES)[number],
      )
    ) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VISIT_ON_ACTIVE_ROUTE',
        'Remova a visita da rota ativa antes de remarcar ou cancelar.',
      );
    }

    const updated = await this.prisma.visit.update({
      where: { id },
      data: {
        ...(dto.scheduledStart !== undefined
          ? { scheduledStart: new Date(dto.scheduledStart) }
          : {}),
        ...(dto.scheduledEnd !== undefined
          ? { scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : null }
          : {}),
        ...(dto.employeeId !== undefined ? { employeeId: dto.employeeId } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.status !== undefined
          ? { status: dto.status }
          : rescheduling
            ? { status: VisitStatus.RESCHEDULED }
            : {}),
      },
      include: {
        customer: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        serviceOrder: { select: { id: true, number: true, title: true } },
      },
    });

    return { visit: updated };
  }

  async checkIn(
    user: AuthUser,
    id: string,
    dto: CheckInVisitDto,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const actorEmployeeId = await this.myEmployeeId(user);

    const visit = await this.prisma.visit.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        routeStop: {
          include: {
            route: { select: { id: true, status: true, employeeId: true, recordTrip: true } },
          },
        },
      },
    });

    const decision = evaluateVisitCheckIn({
      visitFoundInTenant: Boolean(visit),
      visitStatus: visit?.status ?? null,
      checkedInAt: visit?.checkedInAt ?? null,
      visitEmployeeId: visit?.employeeId ?? null,
      actorRole: user.role,
      actorEmployeeId,
      routeStatus: visit?.routeStop?.route.status ?? null,
      routeEmployeeId: visit?.routeStop?.route.employeeId ?? null,
    });

    if (!decision.ok) {
      throw httpError(decision.statusCode as HttpStatus, decision.code, decision.message);
    }

    const now = new Date();
    const fromStatus = visit!.status;
    let accessPath: AccessPathFinalizeResult | undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.visit.update({
        where: { id: visit!.id },
        data: {
          status: VisitStatus.IN_PROGRESS,
          checkedInAt: now,
          checkedInLat: dto.latitude,
          checkedInLng: dto.longitude,
          checkedInAccuracy: dto.accuracy,
        },
        include: {
          customer: { select: { id: true, name: true, tradeName: true } },
          employee: { select: { id: true, name: true } },
          serviceOrder: { select: { id: true, number: true, title: true, status: true } },
          routeStop: {
            select: {
              id: true,
              routeId: true,
              sequence: true,
              status: true,
              route: { select: { id: true, recordTrip: true, status: true } },
            },
          },
          evidence: {
            select: {
              id: true,
              type: true,
              mimeType: true,
              sizeBytes: true,
              caption: true,
              originalName: true,
              createdAt: true,
            },
          },
        },
      });

      await tx.visitEvent.create({
        data: {
          companyId: user.companyId,
          visitId: visit!.id,
          type: VisitEventType.CHECK_IN,
          actorUserId: user.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracy: dto.accuracy,
          payload: {
            fromStatus,
            toStatus: VisitStatus.IN_PROGRESS,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          action: 'VISIT_CHECKED_IN',
          entity: 'Visit',
          entityId: visit!.id,
          metadata: {
            routeId: visit!.routeStop?.routeId ?? null,
            latitude: dto.latitude,
            longitude: dto.longitude,
            accuracy: dto.accuracy,
          },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
      });

      return next;
    });

    if (visit!.routeStop?.route.recordTrip) {
      const extraPoints = sanitizeTrailPoints(dto.trailPoints);
      try {
        accessPath = await this.customersService.finalizeAccessPathFromCheckIn({
          companyId: user.companyId,
          customerId: visit!.customerId,
          routeId: visit!.routeStop.route.id,
          employeeId: actorEmployeeId,
          destination: {
            latitude: dto.latitude,
            longitude: dto.longitude,
          },
          extraPoints,
        });
      } catch {
        accessPath = { saved: false, reason: 'TRANSACTION_FAILED' };
      }
      await this.auditAccessPathResult(user, visit!.id, visit!.routeStop.route.id, accessPath, meta);
    } else if (dto.trailPoints?.length) {
      accessPath = { saved: false, reason: 'NOT_RECORDING' };
    }

    return { visit: updated, accessPath };
  }

  async addEvidence(
    user: AuthUser,
    id: string,
    file: Express.Multer.File | undefined,
    body: { caption?: string; latitude?: number; longitude?: number; accuracy?: number },
    meta?: { ip?: string; userAgent?: string },
  ) {
    if (user.role !== UserRole.EMPLOYEE) {
      throw httpError(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', 'Apenas o funcionário de campo envia fotos.');
    }
    const actorEmployeeId = await this.myEmployeeId(user);
    if (!actorEmployeeId) {
      throw httpError(
        HttpStatus.FORBIDDEN,
        'EMPLOYEE_PROFILE_REQUIRED',
        'Seu usuário não está vinculado a um funcionário.',
      );
    }

    const visit = await this.prisma.visit.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        _count: { select: { evidence: true } },
        routeStop: { include: { route: { select: { status: true, employeeId: true } } } },
      },
    });
    if (!visit) {
      throw httpError(HttpStatus.NOT_FOUND, 'VISIT_NOT_FOUND', 'Visita não encontrada.');
    }
    if (visit.employeeId !== actorEmployeeId) {
      throw httpError(HttpStatus.FORBIDDEN, 'VISIT_FORBIDDEN', 'Você não pode enviar fotos nesta visita.');
    }
    if (!visit.checkedInAt || visit.status !== VisitStatus.IN_PROGRESS) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VISIT_EVIDENCE_NOT_ALLOWED',
        'Fotos só podem ser enviadas durante a visita em atendimento.',
      );
    }
    if (visit.checkedOutAt) {
      throw httpError(
        HttpStatus.CONFLICT,
        'VISIT_ALREADY_CHECKED_OUT',
        'Esta visita já foi finalizada.',
      );
    }

    const countCheck = assertEvidenceCount(visit._count.evidence);
    if (!countCheck.ok) {
      throw httpError(HttpStatus.UNPROCESSABLE_ENTITY, countCheck.code, countCheck.message);
    }

    const fileCheck = validateEvidenceUpload(file);
    if (!fileCheck.ok) {
      throw httpError(HttpStatus.UNPROCESSABLE_ENTITY, fileCheck.code, fileCheck.message);
    }

    const stored = await this.storage.saveBuffer(
      { companyId: user.companyId, visitId: visit.id },
      fileCheck.ext,
      file!.buffer,
    );

    const evidence = await this.prisma.$transaction(async (tx) => {
      const row = await tx.visitEvidence.create({
        data: {
          companyId: user.companyId,
          visitId: visit.id,
          storageKey: stored.storageKey,
          mimeType: fileCheck.mimeType,
          sizeBytes: file!.size,
          originalName: file!.originalname?.slice(0, 255) || null,
          caption: body.caption?.trim()?.slice(0, 500) || null,
          latitude: body.latitude ?? null,
          longitude: body.longitude ?? null,
          accuracy: body.accuracy ?? null,
          actorUserId: user.id,
        },
      });

      await tx.visitEvent.create({
        data: {
          companyId: user.companyId,
          visitId: visit.id,
          type: VisitEventType.EVIDENCE,
          actorUserId: user.id,
          payload: { evidenceId: row.id, mimeType: fileCheck.mimeType },
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          action: 'VISIT_EVIDENCE_ADDED',
          entity: 'VisitEvidence',
          entityId: row.id,
          metadata: { visitId: visit.id, mimeType: fileCheck.mimeType, sizeBytes: file!.size },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
      });

      return row;
    });

    return {
      evidence: {
        id: evidence.id,
        type: evidence.type,
        mimeType: evidence.mimeType,
        sizeBytes: evidence.sizeBytes,
        caption: evidence.caption,
        originalName: evidence.originalName,
        createdAt: evidence.createdAt,
      },
    };
  }

  async listEvidence(user: AuthUser, visitId: string) {
    await this.getOne(user, visitId);
    const evidence = await this.prisma.visitEvidence.findMany({
      where: { visitId, companyId: user.companyId },
      select: {
        id: true,
        type: true,
        mimeType: true,
        sizeBytes: true,
        caption: true,
        originalName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return { evidence };
  }

  async getEvidenceFile(user: AuthUser, visitId: string, evidenceId: string) {
    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, companyId: user.companyId },
      select: { id: true, employeeId: true },
    });
    if (!visit) {
      throw httpError(HttpStatus.NOT_FOUND, 'VISIT_NOT_FOUND', 'Visita não encontrada.');
    }
    if (user.role === UserRole.EMPLOYEE) {
      const mine = await this.myEmployeeId(user);
      if (!mine || visit.employeeId !== mine) {
        throw httpError(HttpStatus.FORBIDDEN, 'VISIT_FORBIDDEN', 'Você não pode ver esta visita.');
      }
    }

    const evidence = await this.prisma.visitEvidence.findFirst({
      where: { id: evidenceId, visitId, companyId: user.companyId },
    });
    if (!evidence) {
      throw httpError(HttpStatus.NOT_FOUND, 'VISIT_EVIDENCE_NOT_FOUND', 'Foto não encontrada.');
    }

    const stream = this.storage.openReadStream(evidence.storageKey);
    if (!stream) {
      throw httpError(HttpStatus.NOT_FOUND, 'VISIT_EVIDENCE_NOT_FOUND', 'Arquivo não encontrado.');
    }

    return { stream, mimeType: evidence.mimeType, originalName: evidence.originalName };
  }

  async checkOut(
    user: AuthUser,
    id: string,
    dto: CheckOutVisitDto,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const actorEmployeeId = await this.myEmployeeId(user);

    const visit = await this.prisma.visit.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        customer: true,
        _count: { select: { evidence: true } },
        routeStop: { include: { route: { select: { id: true, status: true, employeeId: true, recordTrip: true } } } },
      },
    });

    const decision = evaluateVisitCheckOut({
      visitFoundInTenant: Boolean(visit),
      visitStatus: visit?.status ?? null,
      checkedInAt: visit?.checkedInAt ?? null,
      checkedOutAt: visit?.checkedOutAt ?? null,
      visitEmployeeId: visit?.employeeId ?? null,
      actorRole: user.role,
      actorEmployeeId,
      routeStatus: visit?.routeStop?.route.status ?? null,
      routeEmployeeId: visit?.routeStop?.route.employeeId ?? null,
      outcome: dto.outcome,
      evidenceCount: visit?._count.evidence ?? 0,
      executionNotes: dto.executionNotes,
      nextVisitScheduledStart: dto.nextVisit?.scheduledStart,
    });

    if (!decision.ok) {
      throw httpError(decision.statusCode as HttpStatus, decision.code, decision.message);
    }

    const now = new Date();
    const nextStatus = visitStatusForOutcome(dto.outcome);
    const stopStatus = routeStopStatusForOutcome(dto.outcome);
    const executionNotes = dto.executionNotes?.trim() || null;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.visit.update({
        where: { id: visit!.id },
        data: {
          status: nextStatus,
          outcome: dto.outcome,
          executionNotes,
          checkedOutAt: now,
          checkedOutLat: dto.latitude,
          checkedOutLng: dto.longitude,
          checkedOutAccuracy: dto.accuracy,
        },
        include: visitDetailInclude,
      });

      if (visit!.routeStop) {
        await tx.routeStop.update({
          where: { id: visit!.routeStop.id },
          data: { status: stopStatus as RouteStopStatus },
        });
      }

      await tx.visitEvent.create({
        data: {
          companyId: user.companyId,
          visitId: visit!.id,
          type: VisitEventType.CHECK_OUT,
          actorUserId: user.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracy: dto.accuracy,
          payload: {
            outcome: dto.outcome,
            toStatus: nextStatus,
            executionNotes,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          action: 'VISIT_CHECKED_OUT',
          entity: 'Visit',
          entityId: visit!.id,
          metadata: {
            outcome: dto.outcome,
            routeId: visit!.routeStop?.routeId ?? null,
          },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
      });

      let nextVisit: Awaited<ReturnType<typeof tx.visit.create>> | null = null;
      if (dto.nextVisit?.scheduledStart) {
        nextVisit = await tx.visit.create({
          data: {
            companyId: user.companyId,
            serviceOrderId: visit!.serviceOrderId,
            customerId: visit!.customerId,
            employeeId: visit!.employeeId,
            scheduledStart: new Date(dto.nextVisit.scheduledStart),
            scheduledEnd: dto.nextVisit.scheduledEnd
              ? new Date(dto.nextVisit.scheduledEnd)
              : null,
            status: VisitStatus.ASSIGNED,
            ...visitAddressSnapshot(visit!.customer),
            notes: null,
          },
        });

        await tx.visitEvent.create({
          data: {
            companyId: user.companyId,
            visitId: visit!.id,
            type: VisitEventType.STATUS_CHANGE,
            actorUserId: user.id,
            payload: {
              action: 'NEXT_VISIT_SCHEDULED',
              nextVisitId: nextVisit.id,
              scheduledStart: dto.nextVisit.scheduledStart,
            },
          },
        });
      }

      const allVisits = await tx.visit.findMany({
        where: { serviceOrderId: visit!.serviceOrderId, companyId: user.companyId },
        select: { status: true },
      });
      const terminal = new Set<VisitStatus>([
        VisitStatus.COMPLETED,
        VisitStatus.FAILED,
        VisitStatus.CANCELLED,
      ]);
      if (allVisits.every((v) => terminal.has(v.status))) {
        await tx.serviceOrder.update({
          where: { id: visit!.serviceOrderId },
          data: { status: ServiceOrderStatus.COMPLETED },
        });
      }

      return { visit: updated, nextVisit };
    });

    let accessPath: AccessPathFinalizeResult | undefined;
    const recordTrip = visit!.routeStop?.route.recordTrip === true;
    if (recordTrip && visit!.routeStop) {
      const already = await this.customersService.hasActiveAccessPathForRoute(
        user.companyId,
        visit!.routeStop.route.id,
      );
      if (!already) {
        const extraPoints = sanitizeTrailPoints(dto.trailPoints);
        try {
          accessPath = await this.customersService.finalizeAccessPathFromCheckIn({
            companyId: user.companyId,
            customerId: visit!.customerId,
            routeId: visit!.routeStop.route.id,
            employeeId: actorEmployeeId,
            destination: {
              latitude: dto.latitude,
              longitude: dto.longitude,
            },
            extraPoints,
          });
        } catch {
          accessPath = { saved: false, reason: 'TRANSACTION_FAILED' };
        }
        await this.auditAccessPathResult(
          user,
          visit!.id,
          visit!.routeStop.route.id,
          accessPath,
          meta,
        );
      } else {
        accessPath = { saved: true, pathId: 'existing', pointCount: 0 };
      }
    }

    return { ...result, accessPath };
  }

  private async auditAccessPathResult(
    user: AuthUser,
    visitId: string,
    routeId: string,
    result: AccessPathFinalizeResult,
    meta?: { ip?: string; userAgent?: string },
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          action: result.saved ? 'ACCESS_PATH_SAVED' : 'ACCESS_PATH_FAILED',
          entity: 'CustomerAccessPath',
          entityId: visitId,
          metadata: {
            visitId,
            routeId,
            saved: result.saved,
            reason: result.saved ? undefined : result.reason,
            pathId: result.saved ? result.pathId : undefined,
          },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
      });
    } catch {
      // auditoria não bloqueia visita
    }
  }

  private async resolveEmployeeScope(user: AuthUser, queryEmployeeId?: string) {
    if (user.role === UserRole.EMPLOYEE) {
      const mine = await this.myEmployeeId(user);
      if (!mine) {
        throw httpError(
          HttpStatus.FORBIDDEN,
          'EMPLOYEE_PROFILE_REQUIRED',
          'Seu usuário não está vinculado a um funcionário.',
        );
      }
      return mine;
    }
    return queryEmployeeId;
  }

  private async myEmployeeId(user: AuthUser): Promise<string | null> {
    const employee = await this.prisma.employee.findFirst({
      where: { companyId: user.companyId, userId: user.id },
      select: { id: true },
    });
    return employee?.id ?? null;
  }
}

