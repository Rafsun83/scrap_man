import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_ATTENTION, MATCHING, PICKUP_CODE_MAX_ATTEMPTS } from '@bw/shared';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { dhakaToday } from '../../../common/time.js';
import type { AdminMapDto, AdminOverviewDto } from '../dtos/admin-overview.dto.js';
import { AdminReadRepository } from '../repositories/admin-read.repository.js';

const MINUTE = 60_000;
const DAYS_30 = 30 * 24 * 60 * MINUTE;

/** A1: status counts, the needs-attention list and the map. */
@Injectable()
export class AdminOverviewService {
  constructor(
    private readonly adminReadRepository: AdminReadRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async overview(): Promise<AdminOverviewDto> {
    const now = this.clock.now();
    const dayStart = new Date(`${dhakaToday(now)}T00:00:00+06:00`);
    const [c, attention] = await Promise.all([
      this.adminReadRepository.counts(dayStart),
      this.adminReadRepository.attention(
        now,
        new Date(now.getTime() - ADMIN_ATTENTION.waitingMinutes * MINUTE),
        new Date(now.getTime() - DAYS_30),
        ADMIN_ATTENTION.maxReleases30d,
        PICKUP_CODE_MAX_ATTEMPTS,
      ),
    ]);
    return {
      counts: {
        requested: c.requested,
        accepted: c.accepted,
        weighing: c.weighing,
        disputed: c.disputed,
        confirmed: c.confirmed,
        completedToday: c.completed_today,
        pendingApplications: c.pending_applications,
        openDisputes: c.open_disputes,
      },
      attention: attention.map((a) => ({
        kind: a.kind,
        pickupId: a.pickup_id,
        displayNo: a.display_no ? `BW-${a.display_no}` : null,
        area: a.area,
        userId: a.user_id,
        name: a.name,
        since: a.since.toISOString(),
        count: a.count,
      })),
    };
  }

  async map(): Promise<AdminMapDto> {
    const now = this.clock.now();
    const overdueBefore = now.getTime() - ADMIN_ATTENTION.waitingMinutes * MINUTE;
    const [requests, collectors] = await Promise.all([
      this.adminReadRepository.openRequests(now),
      this.adminReadRepository.onlineCollectors(new Date(now.getTime() - MATCHING.onlineStaleAfterMs)),
    ]);
    return {
      requests: requests.map((r) => ({
        pickupId: r.id,
        displayNo: `BW-${r.display_no}`,
        area: r.area,
        lat: Number(r.lat),
        lng: Number(r.lng),
        requestedAt: r.requested_at.toISOString(),
        overdue: r.requested_at.getTime() < overdueBefore,
      })),
      collectors: collectors.map((c) => ({
        userId: c.user_id,
        name: c.name,
        lat: Number(c.lat),
        lng: Number(c.lng),
        lastSeenAt: c.last_seen_at.toISOString(),
        busy: c.busy,
      })),
    };
  }
}
