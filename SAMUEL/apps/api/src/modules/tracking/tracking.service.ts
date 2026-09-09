import { Injectable, HttpStatus } from '@nestjs/common';
import { RouteStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';
import { PostTrackingPointsDto } from './dto/tracking.dto';
import {
  shouldPersistTrackingSample,
  type HistorySample,
} from './tracking-sample.util';

const LIVE_TTL_SEC = 120;
const LIVE_SET_TTL_SEC = 3600;

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
      positions.push({ ...pos, presence: 'online' });
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
}
