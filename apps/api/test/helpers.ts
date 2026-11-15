import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import type { Redis } from 'ioredis';
import { AppModule } from '../src/app.module.js';
import { SMS_SENDER, type SmsSender } from '../src/modules/auth/services/sms.service.js';
import { configureApp } from '../src/configure-app.js';
import { REDIS } from '../src/modules/redis/redis.module.js';
import { PHOTO_STORAGE } from '../src/modules/storage/storage.module.js';
import type { PhotoStorage } from '../src/modules/storage/types/photo-storage.type.js';

/** Catches outgoing SMS so tests can read the OTP. */
export class FakeSms implements SmsSender {
  readonly codes = new Map<string, string>();
  async send(phone: string, message: string): Promise<void> {
    const code = /(\d{6})/.exec(message)?.[1];
    if (code) this.codes.set(phone, code);
  }
}

/** Photo storage in memory: tests "upload" by calling complete() with the upload URL. */
export class FakeStorage implements PhotoStorage {
  readonly uploaded = new Set<string>();
  async uploadUrl(key: string): Promise<string> {
    return `https://storage.test/upload/${key}`;
  }
  async downloadUrl(key: string): Promise<string> {
    return `https://storage.test/download/${key}`;
  }
  async exists(key: string): Promise<boolean> {
    return this.uploaded.has(key);
  }
  complete(uploadUrl: string): void {
    this.uploaded.add(uploadUrl.replace('https://storage.test/upload/', ''));
  }
}

export interface TestContext {
  app: INestApplication<App>;
  http: () => ReturnType<typeof request>;
  sms: FakeSms;
  storage: FakeStorage;
  db: DataSource;
  redis: Redis;
}

export async function createTestApp(): Promise<TestContext> {
  const sms = new FakeSms();
  const storage = new FakeStorage();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SMS_SENDER)
    .useValue(sms)
    .overrideProvider(PHOTO_STORAGE)
    .useValue(storage)
    .compile();
  const app = configureApp(moduleRef.createNestApplication()) as INestApplication<App>;
  await app.init();
  return {
    app,
    http: () => request(app.getHttpServer()),
    sms,
    storage,
    db: app.get(DataSource),
    redis: app.get<Redis>(REDIS),
  };
}

/** Empties every table except categories and the migration log, and the test Redis db. */
export async function resetData(ctx: TestContext): Promise<void> {
  await ctx.db.query(
    `TRUNCATE status_events, ratings, disputes, payments, pickup_photos, weigh_lines, pickup_items,
              pickups, daily_rates, notification_reads, collector_profiles, addresses, users RESTART IDENTITY CASCADE`,
  );
  await ctx.redis.flushdb();
  ctx.sms.codes.clear();
  ctx.storage.uploaded.clear();
}

export async function signIn(
  ctx: TestContext,
  phone: string,
  role: 'HOUSEHOLD' | 'COLLECTOR' = 'HOUSEHOLD',
): Promise<{ accessToken: string; refreshToken: string; user: { id: string; role: string } }> {
  await ctx.http().post('/api/v1/auth/otp/request').send({ phone }).expect(204);
  const code = ctx.sms.codes.get(phone);
  const res = await ctx.http().post('/api/v1/auth/otp/verify').send({ phone, code, role }).expect(200);
  return res.body;
}

export async function makeAdmin(ctx: TestContext, phone: string) {
  await ctx.db.query(`INSERT INTO users (phone, role, name) VALUES ($1, 'ADMIN', 'Admin')`, [phone]);
  return signIn(ctx, phone);
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
