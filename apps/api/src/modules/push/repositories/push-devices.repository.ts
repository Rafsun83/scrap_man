import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { DevicePlatform } from '@bw/shared';
import { rows } from '../../../common/sql.js';
import type { Language } from '../../users/enums/language.enum.js';

export interface DeviceTarget {
  token: string;
  platform: DevicePlatform;
  user_id: string;
  language: Language;
}

/** Push tokens per user; reads the users' language for the push text. */
@Injectable()
export class PushDevicesRepository {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Saves the token for this user (moving it from another user if needed) and marks it seen now. */
  async upsert(token: string, userId: string, platform: DevicePlatform, now: Date): Promise<void> {
    await this.db.query(
      `INSERT INTO push_devices (token, user_id, platform, created_at, last_seen_at) VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, last_seen_at = EXCLUDED.last_seen_at`,
      [token, userId, platform, now],
    );
  }

  async deleteForUser(token: string, userId: string): Promise<void> {
    await this.db.query(`DELETE FROM push_devices WHERE token = $1 AND user_id = $2`, [token, userId]);
  }

  async deleteTokens(tokens: string[]): Promise<void> {
    if (tokens.length) await this.db.query(`DELETE FROM push_devices WHERE token = ANY($1::text[])`, [tokens]);
  }

  /** Every phone of these active users, with their language. */
  targets(userIds: string[]): Promise<DeviceTarget[]> {
    if (userIds.length === 0) return Promise.resolve([]);
    return rows<DeviceTarget>(
      this.db,
      `SELECT d.token, d.platform, d.user_id, u.language
         FROM push_devices d JOIN users u ON u.id = d.user_id AND u.status <> 'SUSPENDED'
        WHERE d.user_id = ANY($1::uuid[])`,
      [userIds],
    );
  }
}
