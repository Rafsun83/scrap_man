import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M3 notifications (H13). The feed itself is read from status_events, disputes and daily_rates, so it
 * always matches what happened; only each user's "seen up to" time is stored.
 * - notification_reads: one row per user, set by POST /me/notifications/read.
 * - disputes_resolved_idx: the feed's resolved-disputes lookup.
 */
export class NotificationReads1763280000000 implements MigrationInterface {
  name = 'NotificationReads1763280000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE notification_reads (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        seen_at timestamptz NOT NULL
      );
      CREATE INDEX disputes_resolved_idx ON disputes (pickup_id, resolved_at) WHERE resolved_at IS NOT NULL;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP INDEX disputes_resolved_idx;
      DROP TABLE notification_reads;
    `);
  }
}
