import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_ATTENTION, type WorkArea } from '@bw/shared';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { AppError } from '../../../common/errors.js';
import { UsersService } from '../../users/services/users.service.js';
import type { AdminUserPageDto, AdminUserRowDto, ListAdminUsersDto, SetUserStatusDto } from '../dtos/admin-users.dto.js';
import { AdminReadRepository, type AdminUserDbRow } from '../repositories/admin-read.repository.js';

const DAYS_30 = 30 * 24 * 60 * 60_000;

/** A5: households and collectors with their figures, and status changes. */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly adminReadRepository: AdminReadRepository,
    private readonly usersService: UsersService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(query: ListAdminUsersDto): Promise<AdminUserPageDto> {
    let after: { at: string; id: string } | null = null;
    if (query.cursor) {
      const [at, id] = Buffer.from(query.cursor, 'base64url').toString().split('|');
      if (!at || !id || Number.isNaN(Date.parse(at))) throw AppError.validation('The cursor is not valid. Start from the first page.');
      after = { at, id };
    }
    const since = new Date(this.clock.now().getTime() - DAYS_30);
    const found = await this.adminReadRepository.users(query.role, query.q ?? null, since, after, query.limit + 1);
    const page = found.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map((r) => this.toDto(r)),
      nextCursor:
        found.length > query.limit && last ? Buffer.from(`${last.created_at.toISOString()}|${last.id}`).toString('base64url') : null,
    };
  }

  setStatus(userId: string, body: SetUserStatusDto): Promise<void> {
    return this.usersService.setStatus(userId, body.status, body.note?.trim() || null);
  }

  private toDto(r: AdminUserDbRow): AdminUserRowDto {
    return {
      id: r.id,
      phone: r.phone,
      role: r.role,
      name: r.name,
      language: r.language,
      status: r.status,
      statusNote: r.status_note,
      createdAt: r.created_at.toISOString(),
      releaseFlag: r.role === 'COLLECTOR' && r.releases_30d > ADMIN_ATTENTION.maxReleases30d,
      household:
        r.role === 'HOUSEHOLD'
          ? { area: r.home_area, completedCount: r.completed_count, totalReceived: Number(r.total_received), noShows30d: r.no_shows_30d }
          : null,
      collector:
        r.role === 'COLLECTOR' && r.has_profile
          ? {
              workAreas: (r.work_areas ?? []) as WorkArea[],
              ratingAvg: r.rating_avg === null ? null : Number(r.rating_avg),
              pickups30d: r.pickups_30d,
              releases30d: r.releases_30d,
              verificationStatus: r.verification_status!,
              isOnline: r.is_online === true,
            }
          : null,
    };
  }
}
