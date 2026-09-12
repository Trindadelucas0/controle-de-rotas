import { Injectable, HttpStatus } from '@nestjs/common';
import { EmployeeObservationCode, EmployeeObservationSeverity, RouteStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';
import { EmployeeObservationsService } from '../ops/employee-observations.service';
import { PostTrackingPointsDto } from './dto/tracking.dto';
import {
  shouldPersistTrackingSample,
  type HistorySample,
} from './tracking-sample.util';
import { OFF_ROUTE_ALERT_M, OFF_ROUTE_ALERT_MS } from '../routes/route-odometer-audit.util';

const LIVE_TTL_SEC = 120;
const LIVE_SET_TTL_SEC = 3600;
/** Após este tempo sem atualização, o pin no mapa fica visualmente stale. */
const LIVE_STALE_MS = 30_000;

export type LiveVehiclePosition = {
  employeeId: string;
  employeeName: string;
  vehicleId: string | null;
  vehiclePlate: string | null;
  routeId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
  updatedAt: string;
  presence: 'online' | 'stale';
};

function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly observations: EmployeeObservationsService,
  ) {}

  private currentKey(companyId: string, employeeId: string) {
    return `tracking:current:${companyId}:${employeeId}`;
  }

  private liveSetKey(companyId: string) {
    return `tracking:live:${companyId}`;
  }

  private historySampleKey(companyId: string, employeeId: string) {
    return `tracking:history-sample:${companyId}:${employeeId}`;
  }

  async ingestPoints(user: AuthUser, dto: PostTrackingPointsDto) {
    if (user.role !== UserRole.EMPLOYEE) {
      throw httpError(
        HttpStatus.FORBIDDEN,
        'TRACKING_EMPLOYEE_ONLY',
        'Apenas o funcionário de campo envia posição.',
      );
    }

    const employee = await this.prisma.employee.findFirst({
      where: { companyId: user.companyId, userId: user.id },
      select: { id: true, name: true },
    });
    if (!employee) {
      throw httpError(
        HttpStatus.FORBIDDEN,
        'EMPLOYEE_PROFILE_REQUIRED',
        'Seu usuário não está vinculado a um funcionário.',
      );
    }

    let accepted = 0;
    let persisted = 0;
    let skippedInactive = 0;
    for (const p of dto.points) {
      const route = await this.prisma.route.findFirst({
        where: {
          id: p.routeId,
          companyId: user.companyId,
          employeeId: employee.id,
          status: RouteStatus.IN_PROGRESS,
        },
        include: {
          vehicle: { select: { id: true, plate: true } },
        },
      });
      if (!route) {
        skippedInactive += 1;
        continue;
      }

      const recordedAt = p.recordedAt ? new Date(p.recordedAt) : new Date();
      if (Number.isNaN(recordedAt.getTime())) {
        continue;
      }

      const accuracy =
        p.accuracy != null && Number.isFinite(p.accuracy) && p.accuracy >= 0
          ? p.accuracy
          : null;
      const speed =
        p.speed != null && Number.isFinite(p.speed) ? p.speed : null;
      const heading =
        p.heading != null && Number.isFinite(p.heading) ? p.heading : null;

      const nowMs = recordedAt.getTime();
      const sampleKey = this.historySampleKey(user.companyId, employee.id);
      const last = await this.redis.getJson<HistorySample>(sampleKey);
      const distanceMeters = last
        ? haversineMeters(last.latitude, last.longitude, p.latitude, p.longitude)
        : 0;
      const shouldPersist = shouldPersistTrackingSample({
        last,
        latitude: p.latitude,
        longitude: p.longitude,
        recordedAtMs: nowMs,
        recordTrip: route.recordTrip,
        distanceMeters,
      });

      if (shouldPersist) {
        try {
          await this.prisma.trackingPoint.create({
            data: {
              companyId: user.companyId,
              employeeId: employee.id,
              routeId: route.id,
              vehicleId: route.vehicleId,
              latitude: p.latitude,
              longitude: p.longitude,
              accuracy,
              recordedAt,
            },
          });
          persisted += 1;
          await this.redis.setJson(
            sampleKey,
            { latitude: p.latitude, longitude: p.longitude, at: nowMs },
            LIVE_SET_TTL_SEC,
          );
        } catch {
          // próximo ponto do lote segue; a trilha do check-in ainda pode recuperar
        }
      }

      const payload: LiveVehiclePosition = {
        employeeId: employee.id,
        employeeName: employee.name,
        vehicleId: route.vehicleId,
        vehiclePlate: route.vehicle?.plate ?? null,
        routeId: route.id,
        latitude: p.latitude,
        longitude: p.longitude,
        accuracy,
        speed,
        heading,
        recordedAt: recordedAt.toISOString(),
        updatedAt: new Date().toISOString(),
        presence: 'online',
      };
      await this.redis.setJson(this.currentKey(user.companyId, employee.id), payload, LIVE_TTL_SEC);
      await this.redis.sAdd(this.liveSetKey(user.companyId), employee.id, LIVE_SET_TTL_SEC);

      accepted += 1;
      await this.evaluateOffRoute({
        companyId: user.companyId,
        employeeId: employee.id,
        routeId: route.id,
        vehicleId: route.vehicleId,
        plate: route.vehicle?.plate ?? null,
        latitude: p.latitude,
        longitude: p.longitude,
        recordedAtMs: nowMs,
      });
    }

    if (accepted === 0 && skippedInactive > 0) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'TRACKING_ROUTE_NOT_ACTIVE',
        'Inicie a rota (Play) antes de enviar localização.',
      );
    }

    return { accepted, persisted };
  }

  async listLive(user: AuthUser) {
    if (user.role === UserRole.EMPLOYEE) {
      throw httpError(
        HttpStatus.FORBIDDEN,
        'TRACKING_LIVE_FORBIDDEN',
        'Funcionário de campo não acessa o painel ao vivo.',
      );
    }

    const members = await this.redis.sMembers(this.liveSetKey(user.companyId));
    const positions: LiveVehiclePosition[] = [];
    const staleIds: string[] = [];

    for (const employeeId of members) {
      const pos = await this.redis.getJson<LiveVehiclePosition>(
        this.currentKey(user.companyId, employeeId),
      );
      if (!pos) {
        staleIds.push(employeeId);
        continue;
      }
      const updatedMs = Date.parse(pos.updatedAt || pos.recordedAt);
      const ageMs = Number.isFinite(updatedMs) ? Date.now() - updatedMs : LIVE_STALE_MS + 1;
      const presence: 'online' | 'stale' = ageMs > LIVE_STALE_MS ? 'stale' : 'online';
      positions.push({ ...pos, presence });
    }

    if (staleIds.length) {
      try {
        await this.redis.getClient().srem(this.liveSetKey(user.companyId), ...staleIds);
      } catch {
        // ignore
      }
    }

    return { positions };
  }

  async getLivePosition(companyId: string, employeeId: string): Promise<LiveVehiclePosition | null> {
    return this.redis.getJson<LiveVehiclePosition>(this.currentKey(companyId, employeeId));
  }

  /** Redis ao vivo (TTL 120s) ou último ponto persistido da mesma empresa. */
  async getLastKnownPosition(
    companyId: string,
    employeeId: string,
  ): Promise<{
    latitude: number;
    longitude: number;
    recordedAt: string;
    source: 'live' | 'tracking_history';
  } | null> {
    const live = await this.getLivePosition(companyId, employeeId);
    if (live && Number.isFinite(live.latitude) && Number.isFinite(live.longitude)) {
      return {
        latitude: live.latitude,
        longitude: live.longitude,
        recordedAt: live.recordedAt,
        source: 'live',
      };
    }

    const row = await this.prisma.trackingPoint.findFirst({
      where: { companyId, employeeId },
      orderBy: { recordedAt: 'desc' },
      select: { latitude: true, longitude: true, recordedAt: true },
    });
    if (!row || !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) {
      return null;
    }
    return {
      latitude: row.latitude,
      longitude: row.longitude,
      recordedAt: row.recordedAt.toISOString(),
      source: 'tracking_history',
    };
  }

  /**
   * Trilha GPS congelada de uma rota (gestor). Isolada por companyId.
   * Downsample se > 2000 pontos.
   */
  async routeHistory(user: AuthUser, routeId: string) {
    if (user.role === UserRole.EMPLOYEE) {
      throw httpError(
        HttpStatus.FORBIDDEN,
        'TRACKING_HISTORY_FORBIDDEN',
        'Funcionário de campo não acessa o histórico de trilha.',
      );
    }

    const route = await this.prisma.route.findFirst({
      where: { id: routeId, companyId: user.companyId },
      select: { id: true, status: true },
    });
    if (!route) {
      throw httpError(HttpStatus.NOT_FOUND, 'ROUTE_NOT_FOUND', 'Rota não encontrada.');
    }

    const rows = await this.prisma.trackingPoint.findMany({
      where: { companyId: user.companyId, routeId: route.id },
      orderBy: { recordedAt: 'asc' },
      select: { latitude: true, longitude: true, recordedAt: true },
    });

    const MAX = 2000;
    const sampled =
      rows.length <= MAX
        ? rows
        : rows.filter((_, i) => i === 0 || i === rows.length - 1 || i % Math.ceil(rows.length / MAX) === 0);

    const points = sampled.map((p) => ({
      lat: p.latitude,
      lng: p.longitude,
      recordedAt: p.recordedAt.toISOString(),
    }));

    const coordinates: [number, number][] = points.map((p) => [p.lng, p.lat]);

    return {
      routeId: route.id,
      status: route.status,
      points,
      geometry:
        coordinates.length >= 2
          ? { type: 'LineString' as const, coordinates }
          : null,
    };
  }

  private offRouteStreakKey(companyId: string, routeId: string) {
    return `offroute:streak:${companyId}:${routeId}`;
  }

  private async distanceToPlannedMeters(
    routeId: string,
    latitude: number,
    longitude: number,
  ): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<{ meters: number | null }[]>`
      SELECT ST_Distance(
        planned_geometry::geography,
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      ) AS meters
      FROM routes
      WHERE id = ${routeId}::uuid AND planned_geometry IS NOT NULL
    `;
    const meters = rows[0]?.meters;
    return meters != null && Number.isFinite(Number(meters)) ? Number(meters) : null;
  }

  private async evaluateOffRoute(input: {
    companyId: string;
    employeeId: string;
    routeId: string;
    vehicleId: string | null;
    plate: string | null;
    latitude: number;
    longitude: number;
    recordedAtMs: number;
  }) {
    const meters = await this.distanceToPlannedMeters(
      input.routeId,
      input.latitude,
      input.longitude,
    );
    if (meters == null) return;

    const streakKey = this.offRouteStreakKey(input.companyId, input.routeId);
    type Streak = { startedAtMs: number; lastAtMs: number; maxMeters: number };

    if (meters <= OFF_ROUTE_ALERT_M) {
      await this.redis.del(streakKey);
      return;
    }

    const prev = await this.redis.getJson<Streak>(streakKey);
    const streak: Streak = prev
      ? {
          startedAtMs: prev.startedAtMs,
          lastAtMs: input.recordedAtMs,
          maxMeters: Math.max(prev.maxMeters, meters),
        }
      : {
          startedAtMs: input.recordedAtMs,
          lastAtMs: input.recordedAtMs,
          maxMeters: meters,
        };
    await this.redis.setJson(streakKey, streak, 2 * 3600);

    const durationMs = streak.lastAtMs - streak.startedAtMs;
    if (durationMs < OFF_ROUTE_ALERT_MS) return;

    const km = Math.round((streak.maxMeters / 1000) * 10) / 10;
    const seconds = Math.round(durationMs / 1000);
    await this.observations.upsert({
      companyId: input.companyId,
      employeeId: input.employeeId,
      routeId: input.routeId,
      vehicleId: input.vehicleId,
      code: EmployeeObservationCode.OFF_ROUTE,
      severity: EmployeeObservationSeverity.WARNING,
      summary: `Saiu ${km} km da rota planejada por ${seconds}s · ${input.plate ?? 'sem placa'}.`,
      details: {
        plate: input.plate,
        maxOffRouteMeters: Math.round(streak.maxMeters),
        offRouteSeconds: seconds,
        sampleAt: new Date(input.recordedAtMs).toISOString(),
        latitude: input.latitude,
        longitude: input.longitude,
      },
    });
  }
}
