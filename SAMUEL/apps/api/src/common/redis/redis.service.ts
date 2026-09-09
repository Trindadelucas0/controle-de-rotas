import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis(this.config.get<string>('REDIS_URL') || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    // Evita "Unhandled error event" em spam quando Redis ainda não subiu
    this.client.on('error', (err) => {
      if (process.env.NODE_ENV !== 'production') {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('ECONNREFUSED')) {
          console.warn('[redis]', msg);
        }
      }
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async incrWithTtl(key: string, ttlSec: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, ttlSec);
    }
    return count;
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSec: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSec);
    } catch {
      // cache best-effort
    }
  }

  async sAdd(key: string, member: string, ttlSec?: number): Promise<void> {
    try {
      await this.client.sadd(key, member);
      if (ttlSec) await this.client.expire(key, ttlSec);
    } catch {
      // best-effort
    }
  }

  async sMembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch {
      return [];
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!keys.length) return;
    try {
      await this.client.del(...keys);
    } catch {
      // best-effort
    }
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => undefined);
  }
}
