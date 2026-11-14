import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../common/auth.decorators.js';
import { HealthService, type HealthReport } from './health.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** 200 when the database and Redis answer, 503 with the same body when one does not. */
  @Get()
  async get(): Promise<HealthReport> {
    const report = await this.health.check();
    if (report.status !== 'ok') {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }
}
