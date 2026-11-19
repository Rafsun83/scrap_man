import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../../common/auth.decorators.js';
import type { OpsAlertDto } from '../dtos/ops-alert.dto.js';
import { OpsAlertsService } from '../services/ops-alerts.service.js';

@Controller('admin/alerts')
@Roles('ADMIN')
export class OpsAlertsController {
  constructor(private readonly opsAlertsService: OpsAlertsService) {}

  @Get()
  list(): Promise<OpsAlertDto[]> {
    return this.opsAlertsService.current();
  }
}
