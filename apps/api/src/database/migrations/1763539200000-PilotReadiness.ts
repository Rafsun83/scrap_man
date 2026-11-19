import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M6 pilot readiness.
 * - push_devices: push tokens per phone (PUT /me/devices); a token belongs to one user at a time.
 * - status_events_noshow_idx: no-show counts and alerts (CANCELLED with meta reason NO_SHOW).
 */
export class PilotReadiness1763539200000 implements MigrationInterface {
  name = 'PilotReadiness1763539200000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE push_devices (
        token text PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform varchar(10) NOT NULL CHECK (platform IN ('ANDROID', 'IOS')),
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX push_devices_user_idx ON push_devices (user_id);
      CREATE INDEX status_events_noshow_idx ON status_events (at) WHERE to_status = 'CANCELLED' AND meta->>'reason' = 'NO_SHOW';
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP INDEX status_events_noshow_idx;
      DROP TABLE push_devices;
    `);
  }
}
