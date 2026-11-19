import { Inject, Injectable, Logger } from '@nestjs/common';
import { OPS_ALERTS } from '@bw/shared';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { AuthService } from '../../auth/services/auth.service.js';
import { RealtimeService } from '../../realtime/services/realtime.service.js';
import type { OpsAlertDto, OpsAlertKind } from '../dtos/ops-alert.dto.js';
import { OpsAlertsRepository } from '../repositories/ops-alerts.repository.js';

const MINUTE = 60_000;

const SEVERITY: Record<OpsAlertKind, OpsAlertDto['severity']> = {
  PAYMENT_REPORTED: 'CRITICAL',
  CONFIRMED_UNPAID: 'CRITICAL',
  OTP_FAILURES: 'CRITICAL',
  REVIEW_OVERDUE: 'WARNING',
  ACCEPTED_PAST_SLOT: 'WARNING',
  NO_SHOW: 'WARNING',
};

/**
 * Operational alerts: what is stuck or suspicious right now. `check()` runs every minute (JobsModule) and
 * announces each new alert once: an `alert` log line (an alert destination plugs in during M7) and `ops.alert`
 * to admins.
 */
@Injectable()
export class OpsAlertsService {
  private readonly logger = new Logger('Ops');

  constructor(
    private readonly opsAlertsRepository: OpsAlertsRepository,
    private readonly authService: AuthService,
    private readonly realtimeService: RealtimeService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async current(now: Date = this.clock.now()): Promise<OpsAlertDto[]> {
    const t = now.getTime();
    const [pickupRows, otpFailures] = await Promise.all([
      this.opsAlertsRepository.pickupAlerts({
        slotEndedBefore: new Date(t - OPS_ALERTS.acceptedPastSlotMinutes * MINUTE),
        confirmedBefore: new Date(t - OPS_ALERTS.confirmedUnpaidMinutes * MINUTE),
        reviewBefore: new Date(t - OPS_ALERTS.reviewOverdueHours * 60 * MINUTE),
        recentAfter: new Date(t - OPS_ALERTS.recentHours * 60 * MINUTE),
      }),
      this.authService.recentOtpFailures(OPS_ALERTS.otpWindowMinutes, now),
    ]);
    const alerts: OpsAlertDto[] = pickupRows.map((r) => ({
      id: `${r.kind}:${r.pickup_id}`,
      kind: r.kind,
      severity: SEVERITY[r.kind],
      pickupId: r.pickup_id,
      displayNo: `BW-${r.display_no}`,
      userId: r.user_id,
      name: r.name,
      since: r.since.toISOString(),
      count: null,
    }));
    if (otpFailures > OPS_ALERTS.otpFailures) {
      // One alert per window, so a long attack is announced again every 10 minutes.
      const window = Math.floor(t / (OPS_ALERTS.otpWindowMinutes * MINUTE));
      alerts.push({
        id: `OTP_FAILURES:${window}`,
        kind: 'OTP_FAILURES',
        severity: 'CRITICAL',
        pickupId: null,
        displayNo: null,
        userId: null,
        name: null,
        since: new Date(t - OPS_ALERTS.otpWindowMinutes * MINUTE).toISOString(),
        count: otpFailures,
      });
    }
    return alerts.sort((a, b) => (a.severity === b.severity ? a.since.localeCompare(b.since) : a.severity === 'CRITICAL' ? -1 : 1));
  }

  /** Announces alerts not announced before; returns them. */
  async check(now: Date = this.clock.now()): Promise<OpsAlertDto[]> {
    const alerts = await this.current(now);
    const fresh = new Set(await this.opsAlertsRepository.markSeen(alerts.map((a) => a.id)));
    const announced = alerts.filter((a) => fresh.has(a.id));
    for (const a of announced) {
      this.logger.warn({ msg: 'alert', ...a });
      this.realtimeService.emit('ops.alert', a, [], true);
    }
    return announced;
  }
}
