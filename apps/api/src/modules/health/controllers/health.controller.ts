import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../../common/auth.decorators.js';
import type { HealthReportDto } from '../dtos/health-report.dto.js';
import { HealthService } from '../services/health.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** 200 when the database and Redis answer, 503 with the same body when one does not. */
  @Get()
  async get(): Promise<HealthReportDto> {
    const report = await this.healthService.check();
    if (report.status !== 'ok') {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }
}
