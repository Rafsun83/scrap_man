import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M4 collector sign-up (C6, C7) and approval.
 * - collector_selfies: private selfie uploads; a profile points at the one it was submitted with.
 *   Replaces collector_profiles.selfie_url, which was never written (links are presigned on read).
 * - collector_profiles: when the application was submitted, and the admin's decision with its note.
 * - collector_queue_idx: the admin's applicant list, oldest first per status.
 */
export class CollectorOnboarding1763366400000 implements MigrationInterface {
  name = 'CollectorOnboarding1763366400000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE collector_selfies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        storage_key text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX collector_selfies_user_idx ON collector_selfies (user_id);

      ALTER TABLE collector_profiles
        DROP COLUMN selfie_url,
        ADD COLUMN selfie_id uuid REFERENCES collector_selfies(id),
        ADD COLUMN verification_note varchar(500),
        ADD COLUMN submitted_at timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN decided_at timestamptz,
        ADD COLUMN decided_by uuid REFERENCES users(id);

      DROP INDEX collector_verification_idx;
      CREATE INDEX collector_queue_idx ON collector_profiles (verification_status, submitted_at, user_id);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP INDEX collector_queue_idx;
      CREATE INDEX collector_verification_idx ON collector_profiles (verification_status);

      ALTER TABLE collector_profiles
        DROP COLUMN decided_by,
        DROP COLUMN decided_at,
        DROP COLUMN submitted_at,
        DROP COLUMN verification_note,
        DROP COLUMN selfie_id,
        ADD COLUMN selfie_url text;

      DROP TABLE collector_selfies;
    `);
  }
}
