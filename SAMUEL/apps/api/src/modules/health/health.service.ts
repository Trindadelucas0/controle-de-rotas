import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check() {
    const [db, redis, postgis] = await Promise.all([
      this.prisma.isHealthy(),
      this.redis.ping(),
      this.prisma.hasPostgis(),
    ]);
    const status = db && redis ? 'ok' : 'degraded';
    return { status, db, redis, postgis };
  }
}
