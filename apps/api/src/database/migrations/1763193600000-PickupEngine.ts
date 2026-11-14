import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M2 pickup engine additions to the core schema:
 * - pickups.area: the approximate area collectors see before accept, copied from the address.
 * - pickups.search_started_at: when matching (re)started; a release resets it so widening waits 5 minutes again.
 * - pickups.wallet_number: the household's bKash/Nagad number, chosen at confirm.
 * - disputes.photo_ids: ITEMS photos the household attached as evidence.
 * - disputes.resolution limited to the contract's DisputeOutcome values.
 * - One open dispute per pickup; one scale photo per weigh round.
 * - Partial indexes for the widening and expiry sweeps.
 */
export class PickupEngine1763193600000 implements MigrationInterface {
  name = 'PickupEngine1763193600000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE pickups
        ADD COLUMN area varchar(80) NOT NULL DEFAULT '',
        ADD COLUMN search_started_at timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN wallet_number varchar(14),
        ADD CONSTRAINT pickups_wallet_format CHECK (wallet_number IS NULL OR wallet_number ~ '^\\+8801[3-9][0-9]{8}$'),
        ADD CONSTRAINT pickups_wallet_for_mobile_money CHECK (
          payment_method IS NULL OR payment_method = 'CASH' OR wallet_number IS NOT NULL
        ),
        ADD CONSTRAINT pickups_search_radius_positive CHECK (search_radius_m > 0),
        ADD CONSTRAINT pickups_code_attempts_range CHECK (code_attempts BETWEEN 0 AND 5);

      UPDATE pickups SET search_started_at = requested_at;

      CREATE INDEX pickups_widen_idx ON pickups (search_started_at)
        WHERE status = 'REQUESTED' AND search_radius_m < 3000;
      CREATE INDEX pickups_expiry_idx ON pickups (expires_at) WHERE status = 'REQUESTED';

      ALTER TABLE disputes
        ADD COLUMN photo_ids uuid[] NOT NULL DEFAULT '{}',
        ADD CONSTRAINT disputes_resolution_values CHECK (
          resolution IS NULL OR resolution IN (
            'REWEIGHED', 'ACCEPT_WEIGHTS', 'TEAM_REWEIGH', 'CANCEL',
            'PAYMENT_VERIFIED', 'PAY_AGAIN', 'SUSPEND_COLLECTOR', 'NO_ACTION'
          )
        ),
        ADD CONSTRAINT disputes_resolved_has_outcome CHECK (
          (status = 'RESOLVED') = (resolution IS NOT NULL AND resolved_at IS NOT NULL)
        );
      CREATE UNIQUE INDEX disputes_one_open_idx ON disputes (pickup_id) WHERE status <> 'RESOLVED';
      CREATE INDEX disputes_pickup_idx ON disputes (pickup_id, created_at);

      CREATE UNIQUE INDEX pickup_photos_one_scale_per_round_idx ON pickup_photos (pickup_id, weigh_version)
        WHERE kind = 'SCALE' AND weigh_version IS NOT NULL;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP INDEX pickup_photos_one_scale_per_round_idx;
      DROP INDEX disputes_pickup_idx;
      DROP INDEX disputes_one_open_idx;
      ALTER TABLE disputes
        DROP CONSTRAINT disputes_resolved_has_outcome,
        DROP CONSTRAINT disputes_resolution_values,
        DROP COLUMN photo_ids;

      DROP INDEX pickups_expiry_idx;
      DROP INDEX pickups_widen_idx;
      ALTER TABLE pickups
        DROP CONSTRAINT pickups_code_attempts_range,
        DROP CONSTRAINT pickups_search_radius_positive,
        DROP CONSTRAINT pickups_wallet_for_mobile_money,
        DROP CONSTRAINT pickups_wallet_format,
        DROP COLUMN wallet_number,
        DROP COLUMN search_started_at,
        DROP COLUMN area;
    `);
  }
}
