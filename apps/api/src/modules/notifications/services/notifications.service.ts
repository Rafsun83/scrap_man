import { Inject, Injectable } from '@nestjs/common';
import type { DisputeOutcome, DisputeStatus, DisputeType, PaymentMethod } from '@bw/shared';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { AppError } from '../../../common/errors.js';
import { dhakaToday } from '../../../common/time.js';
import type { NotificationDto, NotificationPageDto } from '../dtos/notification.dto.js';
import { NotificationTypeEnum } from '../enums/notification-type.enum.js';
import { NotificationsRepository, type FeedOwner, type FeedRow, type PickupFacts } from '../repositories/notifications.repository.js';

interface Reader {
  id: string;
  role: string;
  createdAt: Date;
}

/** Collectors hear about rates only once approved; until then, never. */
const NEVER = new Date(8.64e15);

/** H13 and the collector bell: the user's feed with read state, and "mark all read". */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(user: Reader, limit: number, cursor?: string): Promise<NotificationPageDto> {
    const after = cursor ? this.decodeCursor(cursor) : null;
    const today = dhakaToday(this.clock.now());
    const owner: FeedOwner = user.role === 'COLLECTOR' ? 'COLLECTOR' : 'HOUSEHOLD';
    const since = owner === 'COLLECTOR' ? ((await this.notificationsRepository.approvedAt(user.id)) ?? NEVER) : user.createdAt;
    const [found, seenAt] = await Promise.all([
      this.notificationsRepository.page(owner, user.id, since, today, limit + 1, after),
      this.notificationsRepository.seenAt(user.id),
    ]);
    const page = found.slice(0, limit);
    const pickupIds = [...new Set(page.map((r) => r.pickup_id).filter((id): id is string => id !== null))];
    const [facts, totals, unreadCount] = await Promise.all([
      this.notificationsRepository.pickupFacts(pickupIds),
      this.notificationsRepository.weighTotals(pickupIds),
      this.notificationsRepository.countAfter(owner, user.id, since, today, seenAt),
    ]);
    const factsById = new Map(facts.map((f) => [f.pickup_id, f]));
    const totalsByRound = new Map(totals.map((t) => [`${t.pickup_id}:${t.version}`, t]));
    const last = page.at(-1);

    return {
      items: page.map((r) => this.toDto(r, seenAt, factsById, totalsByRound)),
      nextCursor: found.length > limit && last ? this.encodeCursor(last) : null,
      unreadCount,
    };
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationsRepository.markSeen(userId, this.clock.now());
  }

  private toDto(
    r: FeedRow,
    seenAt: Date | null,
    facts: Map<string, PickupFacts>,
    totals: Map<string, { total_kg: string; total_amount: string }>,
  ): NotificationDto {
    const type = r.type as NotificationTypeEnum;
    const f = r.pickup_id ? facts.get(r.pickup_id) : undefined;
    const data: NotificationDto['data'] = {};
    if (f) data.categoryCodes = f.category_codes;
    switch (type) {
      case NotificationTypeEnum.PICKUP_ACCEPTED:
      case NotificationTypeEnum.PICKUP_RELEASED:
        data.collectorName = r.actor_name;
        break;
      case NotificationTypeEnum.PICKUP_WEIGHED: {
        data.collectorName = r.actor_name;
        if (r.weigh_version !== null) {
          data.weighVersion = Number(r.weigh_version);
          const t = totals.get(`${r.pickup_id}:${r.weigh_version}`);
          if (t) {
            data.totalKg = Number(t.total_kg);
            data.amount = Number(t.total_amount);
          }
        }
        break;
      }
      case NotificationTypeEnum.PICKUP_PAID:
        data.collectorName = r.actor_name;
        if (f?.payment_method) data.method = f.payment_method as PaymentMethod;
        if (f?.payment_amount) data.amount = Number(f.payment_amount);
        break;
      case NotificationTypeEnum.DISPUTE_RESOLVED:
        data.disputeType = r.dispute_type as DisputeType;
        data.outcome = r.outcome as DisputeOutcome;
        break;
      case NotificationTypeEnum.PICKUP_NO_SHOW:
        data.collectorName = r.actor_name;
        break;
      case NotificationTypeEnum.APPLICATION_APPROVED:
      case NotificationTypeEnum.APPLICATION_REJECTED:
        data.note = r.note;
        break;
      case NotificationTypeEnum.PICKUP_CONFIRMED:
        data.householdName = r.actor_name;
        if (f?.confirmed_method) data.method = f.confirmed_method as PaymentMethod;
        if (f?.total_amount) data.amount = Number(f.total_amount);
        break;
      case NotificationTypeEnum.PICKUP_DISPUTED:
        data.householdName = r.actor_name;
        data.disputeType = r.dispute_type as DisputeType;
        data.disputeStatus = r.dispute_status as DisputeStatus;
        break;
      case NotificationTypeEnum.PAYMENT_REPORTED:
        data.householdName = r.actor_name;
        if (f?.payment_method) data.method = f.payment_method as PaymentMethod;
        if (f?.payment_amount) data.amount = Number(f.payment_amount);
        break;
      case NotificationTypeEnum.RATED:
        data.householdName = r.actor_name;
        if (r.stars !== null) data.stars = Number(r.stars);
        break;
      case NotificationTypeEnum.RATES_PUBLISHED:
        data.effectiveDate = r.effective_date ?? undefined;
        break;
      default:
        break;
    }
    return {
      id: r.id,
      type,
      at: r.at.toISOString(),
      read: seenAt !== null && r.at.getTime() <= seenAt.getTime(),
      pickupId: r.pickup_id,
      displayNo: r.display_no,
      data,
    };
  }

  private encodeCursor(r: FeedRow): string {
    return Buffer.from(`${r.at.toISOString()}|${r.id}`).toString('base64url');
  }

  private decodeCursor(cursor: string): { at: string; id: string } {
    const text = Buffer.from(cursor, 'base64url').toString();
    const sep = text.indexOf('|');
    const at = text.slice(0, sep);
    const id = text.slice(sep + 1);
    if (sep < 0 || !id || Number.isNaN(Date.parse(at))) {
      throw AppError.validation('The cursor is not valid. Start from the first page.');
    }
    return { at, id };
  }
}
