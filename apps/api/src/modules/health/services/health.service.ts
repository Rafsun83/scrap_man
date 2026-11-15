import { Injectable } from '@nestjs/common';
import type { CheckStateDto, HealthReportDto } from '../dtos/health-report.dto.js';
import { HealthRepository } from '../repositories/health.repository.js';

const TIMEOUT_MS = 1500;

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
  ]);
}

@Injectable()
export class HealthService {
  constructor(private readonly healthRepository: HealthRepository) {}

  async check(): Promise<HealthReportDto> {
    const [database, redis] = await Promise.all([
      withTimeout(this.healthRepository.pingDatabase()).then(
        (): CheckStateDto => 'up',
        (): CheckStateDto => 'down',
      ),
      withTimeout(this.healthRepository.pingRedis()).then(
        (reply): CheckStateDto => (reply === 'PONG' ? 'up' : 'down'),
        (): CheckStateDto => 'down',
      ),
    ]);
    return {
      status: database === 'up' && redis === 'up' ? 'ok' : 'degraded',
      checks: { database, redis },
      time: new Date().toISOString(),
    };
  }
}
