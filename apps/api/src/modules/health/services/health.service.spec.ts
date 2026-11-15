import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { REDIS } from '../../redis/redis.module.js';
import { HealthRepository } from '../repositories/health.repository.js';
import { HealthService } from './health.service.js';

async function makeService(db: () => Promise<unknown>, ping: () => Promise<string>) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      HealthService,
      HealthRepository,
      { provide: DataSource, useValue: { query: vi.fn(db) } },
      { provide: REDIS, useValue: { ping: vi.fn(ping) } },
    ],
  }).compile();
  return moduleRef.get(HealthService);
}

describe('HealthService', () => {
  it('reports ok when the database and Redis answer', async () => {
    const service = await makeService(async () => [{ '?column?': 1 }], async () => 'PONG');
    const report = await service.check();
    expect(report.status).toBe('ok');
    expect(report.checks).toEqual({ database: 'up', redis: 'up' });
  });

  it('reports degraded and names the failing service', async () => {
    const service = await makeService(
      async () => {
        throw new Error('connection refused');
      },
      async () => 'PONG',
    );
    const report = await service.check();
    expect(report.status).toBe('degraded');
    expect(report.checks).toEqual({ database: 'down', redis: 'up' });
  });
});
