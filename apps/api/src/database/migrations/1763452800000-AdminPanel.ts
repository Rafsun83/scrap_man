import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M5 admin panel.
 * - users.status_note: why an admin flagged, suspended or re-activated the account (A5).
 * - status_events_release_idx: release counts per collector over 30 days (A1 attention list, A5 flag).
 * - pickups_status_requested_idx: counts by status and the admin search, newest request first (A1).
 */
export class AdminPanel1763452800000 implements MigrationInterface {
  name = 'AdminPanel1763452800000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE users ADD COLUMN status_note varchar(500);
      CREATE INDEX status_events_release_idx ON status_events (actor_id, at)
        WHERE from_status = 'ACCEPTED' AND to_status = 'REQUESTED';
      CREATE INDEX pickups_status_requested_idx ON pickups (status, requested_at DESC);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP INDEX pickups_status_requested_idx;
      DROP INDEX status_events_release_idx;
      ALTER TABLE users DROP COLUMN status_note;
    `);
  }
}
