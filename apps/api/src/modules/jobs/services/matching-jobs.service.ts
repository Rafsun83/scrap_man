import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CLOCK, type Clock } from '../../../common/clock.js';
import type { Env } from '../../../config/env.js';
import { MatchingService } from '../../pickups/services/matching.service.js';

export const SWEEP_EVERY_MS = 15_000;

/**
 * Runs the time-based matching rules every 15 seconds: expiry at the end of the booked slot,
 * then radius widening. The rules themselves live in MatchingService.
 */
@Injectable()
export class MatchingJobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('MatchingJobs');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly matchingService: MatchingService,
    private readonly config: ConfigService<Env, true>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get('JOBS_ENABLED', { infer: true })) return;
    this.timer = setInterval(() => void this.tick(), SWEEP_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce(this.clock.now());
    } catch (error) {
      this.logger.error(`Sweep failed: ${error instanceof Error ? error.stack : String(error)}`);
    } finally {
      this.running = false;
    }
  }

  async runOnce(now: Date): Promise<{ widened: string[]; expired: string[] }> {
    const expired = await this.matchingService.expireDue(now);
    const widened = await this.matchingService.widenDue(now);
    return { widened, expired };
  }
}
