import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Language } from '../../users/enums/language.enum.js';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { AppError } from '../../../common/errors.js';
import { RealtimeService } from '../../realtime/services/realtime.service.js';
import { SMS_SENDER, type SmsSender } from '../../sms/services/sms.service.js';
import { CollectorProfilesService } from '../../users/services/collector-profiles.service.js';
import { UsersService } from '../../users/services/users.service.js';
import type { CollectorDecisionDto, ListCollectorsDto } from '../dtos/collector-decision.dto.js';
import type { CollectorProfilePageDto } from '../dtos/collector-profile.dto.js';
import { CollectorsService } from './collectors.service.js';

type Decision = CollectorDecisionDto['decision'];

const DECISION_SMS: Record<Decision, Record<Language, string>> = {
  APPROVED: {
    BN: 'ভাঙ্গারিওয়ালা: আপনার সংগ্রাহক আবেদন অনুমোদিত হয়েছে। অ্যাপ খুলে অনলাইন হোন, কাছের অনুরোধ দেখতে পাবেন।',
    EN: 'BhangariWala: your collector application is approved. Open the app and go online to see nearby requests.',
  },
  REJECTED: {
    BN: 'ভাঙ্গারিওয়ালা: আপনার সংগ্রাহক আবেদন এবার গ্রহণ করা যায়নি। কারণ দেখতে ও আবার আবেদন করতে অ্যাপ খুলুন।',
    EN: 'BhangariWala: your collector application was not approved. Open the app to see why and apply again.',
  },
};

/** Admins reviewing collector applications (the A3 screens arrive in M5). */
@Injectable()
export class CollectorApprovalsService {
  private readonly logger = new Logger('CollectorApprovals');

  constructor(
    private readonly collectorProfilesService: CollectorProfilesService,
    private readonly collectorsService: CollectorsService,
    private readonly usersService: UsersService,
    private readonly realtimeService: RealtimeService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(query: ListCollectorsDto): Promise<CollectorProfilePageDto> {
    let after: { at: string; id: string } | null = null;
    if (query.cursor) {
      const [at, id] = Buffer.from(query.cursor, 'base64url').toString().split('|');
      if (!at || !id || Number.isNaN(Date.parse(at))) throw AppError.validation('The cursor is not valid. Start from the first page.');
      after = { at, id };
    }
    const rows = await this.collectorProfilesService.page(query.status ?? null, after, query.limit + 1);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: await this.collectorsService.toDtos(page),
      nextCursor:
        rows.length > query.limit && last
          ? Buffer.from(`${last.submitted_at.toISOString()}|${last.user_id}`).toString('base64url')
          : null,
    };
  }

  /** Approves or rejects a PENDING application, then tells the collector by SMS and live event. */
  async decide(adminId: string, userId: string, input: CollectorDecisionDto): Promise<void> {
    const now = this.clock.now();
    const note = input.note?.trim() || null;
    await this.collectorProfilesService.decide(userId, input.decision, note, adminId, now);

    this.realtimeService.emit(
      'collector.verification',
      { userId, verificationStatus: input.decision, verificationNote: note, at: now.toISOString() },
      [userId],
    );
    const user = await this.usersService.findById(userId);
    if (!user) return;
    try {
      await this.sms.send(user.phone, DECISION_SMS[input.decision][user.language]);
    } catch (error) {
      // The decision is saved and the app shows it; a failed SMS must not undo it.
      this.logger.warn(`Decision SMS to collector ${userId} failed: ${String(error)}`);
    }
  }
}
