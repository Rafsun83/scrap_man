import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import type { Redis } from 'ioredis';
import { AppModule } from '../src/app.module.js';
import { SMS_SENDER, type SmsSender } from '../src/auth/sms/sms-sender.js';
import { configureApp } from '../src/configure-app.js';
import { REDIS } from '../src/redis/redis.module.js';

/** Catches outgoing SMS so tests can read the OTP. */
export class FakeSms implements SmsSender {
  readonly codes = new Map<string, string>();
  async send(phone: string, message: string): Promise<void> {
    const code = /(\d{6})/.exec(message)?.[1];
    if (code) this.codes.set(phone, code);
  }
}

export interface TestContext {
  app: INestApplication<App>;
  http: () => ReturnType<typeof request>;
  sms: FakeSms;
  db: DataSource;
  redis: Redis;
}

export async function createTestApp(): Promise<TestContext> {
  const sms = new FakeSms();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SMS_SENDER)
    .useValue(sms)
    .compile();
  const app = configureApp(moduleRef.createNestApplication()) as INestApplication<App>;
  await app.init();
  return {
    app,
    http: () => request(app.getHttpServer()),
    sms,
    db: app.get(DataSource),
    redis: app.get<Redis>(REDIS),
  };
}

/** Empties every table except categories and the migration log, and the test Redis db. */
export async function resetData(ctx: TestContext): Promise<void> {
  await ctx.db.query(
    `TRUNCATE status_events, ratings, disputes, payments, pickup_photos, weigh_lines, pickup_items,
              pickups, daily_rates, collector_profiles, addresses, users RESTART IDENTITY CASCADE`,
  );
  await ctx.redis.flushdb();
  ctx.sms.codes.clear();
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
