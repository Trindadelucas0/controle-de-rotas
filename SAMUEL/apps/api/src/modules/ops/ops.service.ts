import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CustomerStatus,
  RouteStatus,
  ServiceOrderStatus,
  VehicleStatus,
  VisitStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';
import { businessDayBoundsUtc, businessDayUtc } from '../../common/date/business-day';
import { TrackingService, LiveVehiclePosition } from '../tracking/tracking.service';
import type {
  CustomerContextCard,
  InteractionType,
  OpsDerivedOperational,
} from './context-cards';
import { OpsSnapshotQueryDto } from './dto/ops.dto';
import {
  customersSummary,
  employeesSummary,
  routesSummary,
  serviceOrdersSummary,
  vehiclesSummary,
} from './ops-summaries';
import { EmployeeObservationsService } from './employee-observations.service';
import {
  agendaSummary,
  employeeContext,
  serviceOrderContext,
  vehicleContext,
} from './ops-context';
import {
  customersListEnriched,
  employeesListEnriched,
  vehiclesListEnriched,
} from './ops-enriched';

const STATIONARY_METERS = 40;
const STATIONARY_WINDOW_MS = 10 * 60_000;
const NEARBY_RADIUS_METERS = 3000;
const ALERT_CUSTOMERS_WITHOUT_VISIT_LIMIT = 4;
const TIMELINE_LIMIT = 8;

type NearbyRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  location_status: string;
  status: string;
  city: string | null;
  street: string | null;
  number: string | null;
  distance_meters: number;
};

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

@Injectable()
export class OpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracking: TrackingService,
    private readonly observations: EmployeeObservationsService,
  ) {}

  async snapshot(user: AuthUser, query: OpsSnapshotQueryDto) {
    const { ymd, from, to } = businessDayBoundsUtc(query.date);
    const routeDate = businessDayUtc(ymd);
    const now = new Date();

    const [employees, routes, visits, inServiceVisits, liveResult, maintenanceVehicles, customersWithoutVisit] =
      await Promise.all([
        this.prisma.employee.findMany({
          where: {
            companyId: user.companyId,
            status: 'ACTIVE',
            userId: { not: null },
          },
          select: { id: true, name: true },
        }),
        this.prisma.route.findMany({
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
          select: {
            id: true,
            employeeId: true,
            status: true,
            updatedAt: true,
            plannedDistanceMeters: true,
            actualDistanceMeters: true,
            employee: { select: { id: true, name: true } },
            vehicle: { select: { id: true, plate: true } },
            stops: {
              where: { status: 'PENDING' },
              orderBy: { sequence: 'asc' },
              take: 1,
              select: {
                id: true,
                sequence: true,
                visit: {
                  select: {
                    id: true,
                    customer: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        }),
        this.prisma.visit.findMany({
          where: {
            companyId: user.companyId,
            scheduledStart: { gte: from, lte: to },
          },
          select: {
            id: true,
            status: true,
            scheduledStart: true,
            employeeId: true,
          },
        }),
        this.prisma.visit.findMany({
          where: {
            companyId: user.companyId,
            status: VisitStatus.IN_PROGRESS,
            employeeId: { not: null },
          },
          select: { employeeId: true },
        }),
        this.tracking.listLive(user),
        this.prisma.vehicle.count({
          where: { companyId: user.companyId, status: VehicleStatus.MAINTENANCE },
        }),
        this.customersWithoutRecentVisit(user.companyId, now),
      ]);

    const liveByEmployee = new Map<string, LiveVehiclePosition>();
    for (const p of liveResult.positions) {
      liveByEmployee.set(p.employeeId, p);
    }

    type DayRoute = (typeof routes)[0];
    const routeByEmployee = new Map<string, DayRoute>();
    const publishedWithoutLive: string[] = [];
    for (const r of routes) {
      if (!r.employeeId) continue;
      const prev = routeByEmployee.get(r.employeeId);
      if (!prev) {
        routeByEmployee.set(r.employeeId, r);
      } else if (r.status === RouteStatus.IN_PROGRESS) {
        routeByEmployee.set(r.employeeId, r);
      } else if (
        prev.status !== RouteStatus.IN_PROGRESS &&
        r.updatedAt > prev.updatedAt
      ) {
        routeByEmployee.set(r.employeeId, r);
      }
      if (
        (r.status === RouteStatus.PUBLISHED || r.status === RouteStatus.IN_PROGRESS) &&
        !liveByEmployee.has(r.employeeId)
      ) {
        publishedWithoutLive.push(r.employeeId);
      }
    }

    const stationary = await this.detectStationary(
      user.companyId,
      [...liveByEmployee.keys()],
      now,
    );

    const inServiceIds = new Set(
      inServiceVisits.map((v) => v.employeeId).filter((id): id is string => Boolean(id)),
    );

    let inRoute = 0;
    let inService = 0;
    let onlineLive = 0;
    let parado = 0;
    let available = 0;
    let offline = 0;

    type LiveRouteStatus =
      | 'IN_PROGRESS'
      | 'COMPLETED'
      | 'PUBLISHED'
      | 'ASSIGNED'
      | null;

    const liveRows: {
      employeeId: string;
      employeeName: string;
      operational: OpsDerivedOperational;
      presence: 'online' | 'stale' | 'offline';
      currentCustomerName: string | null;
      currentCustomerId: string | null;
      routeId: string | null;
      routeStatus: LiveRouteStatus;
      vehiclePlate: string | null;
      minutesWithoutGps: number | null;
      latitude: number | null;
      longitude: number | null;
    }[] = [];

    const seenLive = new Set<string>();

    for (const emp of employees) {
      const pos = liveByEmployee.get(emp.id);
      const dayRoute = routeByEmployee.get(emp.id) ?? null;
      const inProgress =
        dayRoute?.status === RouteStatus.IN_PROGRESS ? dayRoute : null;
      const nextStop = inProgress?.stops[0] ?? dayRoute?.stops[0];
      const currentCustomer = nextStop?.visit?.customer ?? null;
      const routeStatus = (dayRoute?.status ?? null) as LiveRouteStatus;
      const routeId = pos?.routeId ?? dayRoute?.id ?? null;
      const vehiclePlate =
        pos?.vehiclePlate ?? dayRoute?.vehicle?.plate ?? null;
      const serving = inServiceIds.has(emp.id);

      if (pos) {
        seenLive.add(emp.id);
        onlineLive += 1;
        const isParado = stationary.has(emp.id);
        let operational: OpsDerivedOperational;
        if (serving) {
          inService += 1;
          operational = 'IN_SERVICE';
        } else if (isParado) {
          parado += 1;
          operational = 'PARADO';
        } else if (inProgress) {
          inRoute += 1;
          operational = 'IN_ROUTE';
        } else {
          available += 1;
          operational = 'AVAILABLE';
        }

        const recordedAt = new Date(pos.recordedAt).getTime();
        const minutesWithoutGps = Math.max(
          0,
          Math.floor((now.getTime() - recordedAt) / 60_000),
        );

        liveRows.push({
          employeeId: emp.id,
          employeeName: emp.name,
          operational,
          presence: 'online',
          currentCustomerName: currentCustomer?.name ?? null,
          currentCustomerId: currentCustomer?.id ?? null,
          routeId,
          routeStatus,
          vehiclePlate,
          minutesWithoutGps,
          latitude: pos.latitude,
          longitude: pos.longitude,
        });
      } else if (serving) {
        inService += 1;
        liveRows.push({
          employeeId: emp.id,
          employeeName: emp.name,
          operational: 'IN_SERVICE',
          presence: 'offline',
          currentCustomerName: currentCustomer?.name ?? null,
          currentCustomerId: currentCustomer?.id ?? null,
          routeId,
          routeStatus,
          vehiclePlate,
          minutesWithoutGps: null,
          latitude: null,
          longitude: null,
        });
      } else {
        offline += 1;
        liveRows.push({
          employeeId: emp.id,
          employeeName: emp.name,
          operational: 'OFFLINE',
          presence: 'offline',
          currentCustomerName: currentCustomer?.name ?? null,
          currentCustomerId: currentCustomer?.id ?? null,
          routeId,
          routeStatus,
          vehiclePlate,
          minutesWithoutGps: null,
          latitude: null,
          longitude: null,
        });
      }
    }

    // Live positions for employees not in ACTIVE+login list (edge)
    for (const [empId, pos] of liveByEmployee) {
      if (seenLive.has(empId)) continue;
      const dayRoute = routeByEmployee.get(empId) ?? null;
      const serving = inServiceIds.has(empId);
      liveRows.push({
        employeeId: empId,
        employeeName: pos.employeeName,
        operational: serving ? 'IN_SERVICE' : 'IN_ROUTE',
        presence: 'online',
        currentCustomerName: null,
        currentCustomerId: null,
        routeId: pos.routeId,
        routeStatus: (dayRoute?.status ?? RouteStatus.IN_PROGRESS) as LiveRouteStatus,
        vehiclePlate: pos.vehiclePlate,
        minutesWithoutGps: Math.max(
          0,
          Math.floor((now.getTime() - new Date(pos.recordedAt).getTime()) / 60_000),
        ),
        latitude: pos.latitude,
        longitude: pos.longitude,
      });
      onlineLive += 1;
      if (serving) inService += 1;
      else inRoute += 1;
    }

    const visitCounts = {
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

    const plannedKmSum = routes.reduce((s, r) => s + (r.plannedDistanceMeters ?? 0), 0);
    const actualValues = routes
      .map((r) => r.actualDistanceMeters)
      .filter((v): v is number => v != null);
    const actualKmSum = actualValues.length ? actualValues.reduce((a, b) => a + b, 0) : null;
    const executionPct =
      actualKmSum != null && plannedKmSum > 0
        ? Math.round((actualKmSum / plannedKmSum) * 100)
        : null;

    const withoutGpsUnique = [...new Set(publishedWithoutLive)];

    const alerts: { code: string; message: string; severity: 'info' | 'warning' | 'critical' }[] =
      [];
    if (visitCounts.delayed > 0) {
      alerts.push({
        code: 'VISITS_DELAYED',
        message: `${visitCounts.delayed} visita(s) atrasada(s)`,
        severity: 'warning',
      });
    }
    if (withoutGpsUnique.length > 0) {
      alerts.push({
        code: 'EMPLOYEES_NO_GPS',
        message: `${withoutGpsUnique.length} funcionário(s) sem GPS`,
        severity: 'warning',
      });
    }
    if (maintenanceVehicles > 0) {
      alerts.push({
        code: 'VEHICLES_MAINTENANCE',
        message: `${maintenanceVehicles} veículo(s) em manutenção`,
        severity: 'info',
      });
    }
    if (customersWithoutVisit.length > 0) {
      alerts.push({
        code: 'CUSTOMERS_NO_VISIT_30D',
        message: `${customersWithoutVisit.length} cliente(s) sem visita há 30 dias`,
        severity: 'info',
      });
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const openObs = await this.observations.openAlertsForSnapshot(user.companyId, since);
    const byCode = new Map<string, typeof openObs>();
    for (const row of openObs) {
      const list = byCode.get(row.code) ?? [];
      list.push(row);
      byCode.set(row.code, list);
    }
    const obsLabels: Record<string, string> = {
      KM_DISCREPANCY: 'Km acima do planejado',
      OFF_ROUTE: 'Saiu da rota',
      ODOMETER_ROLLBACK: 'Km inicial abaixo do último registro',
    };
    for (const [code, rows] of byCode) {
      const first = rows[0];
      const extra = rows.length > 1 ? ` e mais ${rows.length - 1}` : '';
      alerts.push({
        code,
        message: `${obsLabels[code] ?? code}: ${first.employee.name}${extra} — abra o perfil do funcionário`,
        severity: 'warning',
      });
    }

    return {
      date: ymd,
      timezone: process.env.APP_TIMEZONE?.trim() || 'America/Sao_Paulo',
      team: {
        total: employees.length,
        inRoute,
        inService,
        parado,
        available,
        offline,
        onlineLive,
      },
      visits: visitCounts,
      routes: {
        count: routes.length,
        plannedDistanceMeters: plannedKmSum || null,
        actualDistanceMeters: actualKmSum,
        executionPercent: executionPct,
      },
      live: liveRows.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'pt-BR')),
      alerts,
      meta: {
        inServiceAvailable: true,
        completedRequiresCheckIn: true,
      },
    };
  }

  async customerContext(user: AuthUser, customerId: string): Promise<{ customer: CustomerContextCard; nearby: unknown[] }> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId: user.companyId },
    });
    if (!customer) {
      throw httpError(HttpStatus.NOT_FOUND, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.');
    }

    const now = new Date();
    const [lastVisit, nextVisit, openOs, visitsTotal, recentVisits] = await Promise.all([
      this.prisma.visit.findFirst({
        where: {
          companyId: user.companyId,
          customerId,
          status: { in: [VisitStatus.COMPLETED, VisitStatus.FAILED] },
        },
        orderBy: { scheduledStart: 'desc' },
        include: { employee: { select: { id: true, name: true } } },
      }),
      this.prisma.visit.findFirst({
        where: {
          companyId: user.companyId,
          customerId,
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
          scheduledStart: { gte: now },
        },
        orderBy: { scheduledStart: 'asc' },
        include: {
          employee: { select: { id: true, name: true } },
          routeStop: { select: { routeId: true } },
        },
      }),
      this.prisma.serviceOrder.count({
        where: {
          companyId: user.companyId,
          customerId,
          status: { in: [ServiceOrderStatus.OPEN, ServiceOrderStatus.IN_PROGRESS] },
        },
      }),
      this.prisma.visit.count({
        where: { companyId: user.companyId, customerId },
      }),
      this.prisma.visit.findMany({
        where: { companyId: user.companyId, customerId },
        orderBy: { scheduledStart: 'desc' },
        take: TIMELINE_LIMIT,
        include: {
          employee: { select: { name: true } },
          serviceOrder: { select: { number: true, title: true } },
        },
      }),
    ]);

    // Fallback próxima: se nenhuma futura, pegar a mais próxima agendada (mesmo atrasada)
    let next = nextVisit;
    if (!next) {
      next = await this.prisma.visit.findFirst({
        where: {
          companyId: user.companyId,
          customerId,
          status: {
            in: [VisitStatus.SCHEDULED, VisitStatus.ASSIGNED, VisitStatus.RESCHEDULED],
          },
        },
        orderBy: { scheduledStart: 'asc' },
        include: {
          employee: { select: { id: true, name: true } },
          routeStop: { select: { routeId: true } },
        },
      });
    }

    const responsible = next?.employee ?? lastVisit?.employee ?? null;
    const lastContactAt = lastVisit?.scheduledStart?.toISOString() ?? null;
    const routeId = next?.routeStop?.routeId ?? null;

    const canWrite = user.role === 'ADMIN' || user.role === 'MANAGER';

    const timeline = recentVisits.map((v) => ({
      at: v.scheduledStart.toISOString(),
      type: 'VISIT' as InteractionType,
      title: v.serviceOrder
        ? `Visita — OS #${v.serviceOrder.number}`
        : 'Visita',
      detail: v.notes ?? v.serviceOrder?.title ?? null,
      actorName: v.employee?.name ?? null,
    }));

    const nearby =
      customer.latitude != null && customer.longitude != null
        ? await this.nearbyWithDistance(
            user.companyId,
            customer.latitude,
            customer.longitude,
            customer.id,
          )
        : [];

    const card: CustomerContextCard = {
      summary: {
        id: customer.id,
        name: customer.name,
        tradeName: customer.tradeName,
        document: customer.document,
        city: customer.city,
        state: customer.state,
        phone: customer.phone,
        email: customer.email,
        priority: customer.priority,
        status: customer.status,
      },
      statusAtual: customer.status,
      metrics: {
        openServiceOrders: openOs,
        visitsTotal,
        lastVisitAt: lastVisit?.scheduledStart.toISOString() ?? null,
        nextVisitAt: next?.scheduledStart.toISOString() ?? null,
        lastContactAt,
      },
      historico: [],
      relacionamentos: {
        responsibleEmployee: responsible
          ? { id: responsible.id, name: responsible.name }
          : null,
        routeId,
      },
      acoes: [
        {
          id: 'create_os',
          label: 'Criar OS',
          href: `/services/new?customerId=${customer.id}`,
          enabled: canWrite,
        },
        {
          id: 'add_to_route',
          label: 'Adicionar à rota',
          href: `/routes?customerId=${customer.id}`,
          enabled: canWrite,
        },
        {
          id: 'open_record',
          label: 'Abrir prontuário',
          href: `/customers/${customer.id}`,
          enabled: true,
        },
        {
          id: 'view_history',
          label: 'Ver histórico',
          href: `/customers/${customer.id}`,
          enabled: true,
        },
        {
          id: 'view_route',
          label: 'Ver rota',
          href: routeId ? `/routes` : undefined,
          enabled: !!routeId,
        },
      ],
      timeline,
      localizacao:
        customer.latitude != null && customer.longitude != null
          ? {
              latitude: customer.latitude,
              longitude: customer.longitude,
              label: [customer.street, customer.number, customer.city, customer.state]
                .filter(Boolean)
                .join(', ') || null,
            }
          : null,
      alertas: [],
      permissoes: {
        role: user.role,
        canRead: true,
        canWrite,
      },
    };

    return { customer: card, nearby };
  }

  private async nearbyWithDistance(
    companyId: string,
    lat: number,
    lng: number,
    excludeId: string,
  ) {
    const rows = await this.prisma.$queryRaw<NearbyRow[]>`
      SELECT
        id::text,
        name,
        latitude,
        longitude,
        location_status::text,
        status::text,
        city,
        street,
        number,
        ST_Distance(
          location::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) AS distance_meters
      FROM customers
      WHERE company_id = ${companyId}::uuid
        AND location IS NOT NULL
        AND id <> ${excludeId}::uuid
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${NEARBY_RADIUS_METERS}
        )
      ORDER BY distance_meters
      LIMIT 12
    `;

    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      latitude: c.latitude,
      longitude: c.longitude,
      locationStatus: c.location_status,
      status: c.status,
      city: c.city,
      street: c.street,
      number: c.number,
      distanceMeters: Math.round(Number(c.distance_meters)),
    }));
  }

  private async customersWithoutRecentVisit(companyId: string, now: Date) {
    const since = new Date(now.getTime() - 30 * 24 * 3600_000);
    const withRecent = await this.prisma.visit.findMany({
      where: {
        companyId,
        scheduledStart: { gte: since },
        status: { not: VisitStatus.CANCELLED },
      },
      select: { customerId: true },
      distinct: ['customerId'],
    });
    const recentIds = new Set(withRecent.map((v) => v.customerId));

    const customers = await this.prisma.customer.findMany({
      where: {
        companyId,
        status: CustomerStatus.ACTIVE,
        ...(recentIds.size
          ? { id: { notIn: [...recentIds] } }
          : {}),
      },
      select: { id: true, name: true },
      take: ALERT_CUSTOMERS_WITHOUT_VISIT_LIMIT,
      orderBy: { name: 'asc' },
    });
    return customers;
  }

  private async detectStationary(
    companyId: string,
    employeeIds: string[],
    now: Date,
  ): Promise<Set<string>> {
    const result = new Set<string>();
    if (!employeeIds.length) return result;

    const since = new Date(now.getTime() - STATIONARY_WINDOW_MS);
    const points = await this.prisma.trackingPoint.findMany({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'desc' },
      select: {
        employeeId: true,
        latitude: true,
        longitude: true,
        recordedAt: true,
      },
    });

    const byEmp = new Map<string, typeof points>();
    for (const p of points) {
      const list = byEmp.get(p.employeeId) ?? [];
      if (list.length < 2) list.push(p);
      byEmp.set(p.employeeId, list);
    }

    for (const [empId, list] of byEmp) {
      if (list.length < 2) continue;
      const [a, b] = list;
      const dist = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
      const dt = Math.abs(a.recordedAt.getTime() - b.recordedAt.getTime());
      if (dist < STATIONARY_METERS && dt >= 60_000) {
        result.add(empId);
      }
    }
    return result;
  }

  vehiclesSummary(user: AuthUser, query: OpsSnapshotQueryDto) {
    return vehiclesSummary(this.prisma, this.tracking, user, query);
  }

  employeesSummary(user: AuthUser, query: OpsSnapshotQueryDto) {
    return employeesSummary(this.prisma, this.tracking, user, query);
  }

  customersSummary(user: AuthUser, query: OpsSnapshotQueryDto) {
    return customersSummary(this.prisma, user, query);
  }

  serviceOrdersSummary(user: AuthUser) {
    return serviceOrdersSummary(this.prisma, user);
  }

  routesSummary(user: AuthUser, query: OpsSnapshotQueryDto) {
    return routesSummary(this.prisma, user, query);
  }

  agendaSummary(user: AuthUser, query: OpsSnapshotQueryDto) {
    return agendaSummary(this.prisma, user, query);
  }

  vehicleContext(user: AuthUser, vehicleId: string) {
    return vehicleContext(this.prisma, this.tracking, user, vehicleId);
  }

  async employeeContext(user: AuthUser, employeeId: string) {
    const result = await employeeContext(this.prisma, this.tracking, user, employeeId);
    const open = await this.observations.openSummariesForEmployee(user.companyId, employeeId);
    result.employee.alertas = open.map((o) => ({
      code: o.code,
      message: o.summary,
      severity: o.severity === 'CRITICAL' ? 'critical' : o.severity === 'INFO' ? 'info' : 'warning',
    }));
    return result;
  }

  serviceOrderContext(user: AuthUser, serviceOrderId: string) {
    return serviceOrderContext(this.prisma, user, serviceOrderId);
  }

  customersListEnriched(user: AuthUser, q?: string) {
    return customersListEnriched(this.prisma, user, q);
  }

  employeesListEnriched(user: AuthUser, q?: string, date?: string) {
    return employeesListEnriched(this.prisma, this.tracking, user, q, date);
  }

  vehiclesListEnriched(user: AuthUser, q?: string, date?: string) {
    return vehiclesListEnriched(this.prisma, user, q, date);
  }
}
