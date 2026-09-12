import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface StoredObject {
  storageKey: string;
  absolutePath: string;
}

@Injectable()
export class LocalStorageService implements OnModuleInit {
  private rootDir = '';

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.rootDir = path.resolve(
      this.config.get<string>('STORAGE_DIR') || path.join(process.cwd(), 'storage'),
    );
    await fs.mkdir(this.rootDir, { recursive: true });
  }

  resolveAbsolute(storageKey: string): string {
    const normalized = storageKey.replace(/\\/g, '/');
    if (normalized.includes('..')) {
      throw new Error('Invalid storage key');
    }
    const absolute = path.join(this.rootDir, normalized);
    const relative = path.relative(this.rootDir, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Invalid storage key');
    }
    return absolute;
  }

  async saveBuffer(
    parts: { companyId: string; visitId: string } | { companyId: string; routeId: string },
    ext: string,
    buffer: Buffer,
  ): Promise<StoredObject> {
    const folder = 'visitId' in parts ? parts.visitId : parts.routeId;
    const storageKey = `${parts.companyId}/${folder}/${randomUUID()}${ext}`;
    const absolutePath = this.resolveAbsolute(storageKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);
    return { storageKey, absolutePath };
  }

  openReadStream(storageKey: string) {
    const absolutePath = this.resolveAbsolute(storageKey);
    if (!existsSync(absolutePath)) {
      return null;
    }
    return createReadStream(absolutePath);
  }

  async deleteObject(storageKey: string): Promise<void> {
    const absolutePath = this.resolveAbsolute(storageKey);
    if (existsSync(absolutePath)) {
      await fs.unlink(absolutePath);
    }
  }
}
