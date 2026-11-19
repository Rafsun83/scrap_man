import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CLOCK, type Clock } from '../../../common/clock.js';
import type { Env } from '../../../config/env.js';
import { OpsAlertsService } from '../../ops/services/ops-alerts.service.js';

export const OPS_CHECK_EVERY_MS = 60_000;

/** Checks for ops alerts every minute; the rules live in OpsAlertsService. */
@Injectable()
export class OpsJobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('OpsJobs');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly opsAlertsService: OpsAlertsService,
    private readonly config: ConfigService<Env, true>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get('JOBS_ENABLED', { infer: true })) return;
    this.timer = setInterval(() => void this.tick(), OPS_CHECK_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.opsAlertsService.check(this.clock.now());
    } catch (error) {
      this.logger.error(`Ops check failed: ${error instanceof Error ? error.stack : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
