import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OpsAlertsController } from './controllers/ops-alerts.controller.js';
import { OpsAlertsRepository } from './repositories/ops-alerts.repository.js';
import { OpsAlertsService } from './services/ops-alerts.service.js';

/** Ops alerts (stuck pickups, OTP failure spikes, payment reports, no-shows): GET /admin/alerts and ops.alert. */
@Module({
  imports: [AuthModule],
  controllers: [OpsAlertsController],
  providers: [OpsAlertsRepository, OpsAlertsService],
  exports: [OpsAlertsService],
})
export class OpsModule {}
