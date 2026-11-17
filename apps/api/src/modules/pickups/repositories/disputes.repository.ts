import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { DisputeOutcome, DisputeStatus, DisputeType } from '@bw/shared';
import { one, rows, type Db } from '../../../common/sql.js';
import type { AdminDisputeRow, DisputeRow } from '../types/pickup-record.types.js';

export interface NewDisputeInput {
  pickupId: string;
  raisedBy: string;
  type: DisputeType;
  status: DisputeStatus;
  reason: string | null;
  photoIds: string[];
  at: Date;
}

const DISPUTE_SELECT = `
  SELECT d.id, d.pickup_id, p.display_no::text AS display_no, d.raised_by, d.type, d.status, d.reason,
         d.photo_ids, d.resolution, d.resolution_note, d.created_at, d.resolved_at
    FROM disputes d JOIN pickups p ON p.id = d.pickup_id`;

@Injectable()
export class DisputesRepository {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  byPickupIds(pickupIds: string[], db: Db = this.db): Promise<DisputeRow[]> {
    if (pickupIds.length === 0) return Promise.resolve([]);
    return rows<DisputeRow>(db, `${DISPUTE_SELECT} WHERE d.pickup_id = ANY($1::uuid[]) ORDER BY d.created_at`, [pickupIds]);
  }

  byIds(ids: string[], db: Db = this.db): Promise<DisputeRow[]> {
    return rows<DisputeRow>(db, `${DISPUTE_SELECT} WHERE d.id = ANY($1::uuid[]) ORDER BY d.created_at`, [ids]);
  }

  async byId(id: string, db: Db = this.db): Promise<DisputeRow | null> {
    return one<DisputeRow>(db, `${DISPUTE_SELECT} WHERE d.id = $1`, [id]);
  }

  /** Open ones first, then newest; at most 200. With the pickup's area, status and both names. */
  list(status: DisputeStatus | null, type: DisputeType | null): Promise<AdminDisputeRow[]> {
    return rows<AdminDisputeRow>(
      this.db,
      `SELECT d.id, d.pickup_id, p.display_no::text AS display_no, d.raised_by, d.type, d.status, d.reason,
              d.photo_ids, d.resolution, d.resolution_note, d.created_at, d.resolved_at,
              p.status AS pickup_status, p.area, h.name AS household_name, c.name AS collector_name
         FROM disputes d
         JOIN pickups p ON p.id = d.pickup_id
         JOIN users h ON h.id = p.household_id
         LEFT JOIN users c ON c.id = p.collector_id
        WHERE ($1::dispute_status IS NULL OR d.status = $1) AND ($2::dispute_type IS NULL OR d.type = $2)
        ORDER BY (d.status = 'RESOLVED'), d.created_at DESC LIMIT 200`,
      [status, type],
    );
  }

  /** The pickup's open dispute, locked; null when none is open. */
  lockOpen(tx: Db, pickupId: string): Promise<{ id: string; type: DisputeType; status: DisputeStatus } | null> {
    return one(tx, `SELECT id, type, status FROM disputes WHERE pickup_id = $1 AND status <> 'RESOLVED' FOR UPDATE`, [pickupId]);
  }

  async hasOpen(tx: Db, pickupId: string): Promise<boolean> {
    return (await one(tx, `SELECT 1 FROM disputes WHERE pickup_id = $1 AND status <> 'RESOLVED'`, [pickupId])) !== null;
  }

  /** The newest dispute of this type on the pickup. */
  latestOfType(tx: Db, pickupId: string, type: DisputeType): Promise<{ status: DisputeStatus; resolution: DisputeOutcome | null } | null> {
    return one(
      tx,
      `SELECT status, resolution FROM disputes WHERE pickup_id = $1 AND type = $2 ORDER BY created_at DESC LIMIT 1`,
      [pickupId, type],
    );
  }

  async countOfType(tx: Db, pickupId: string, type: DisputeType): Promise<number> {
    const row = await one<{ n: number }>(tx, `SELECT count(*)::int AS n FROM disputes WHERE pickup_id = $1 AND type = $2`, [
      pickupId,
      type,
    ]);
    return row!.n;
  }

  async insert(tx: Db, d: NewDisputeInput): Promise<string> {
    const row = await one<{ id: string }>(
      tx,
      `INSERT INTO disputes (pickup_id, raised_by, type, status, reason, photo_ids, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [d.pickupId, d.raisedBy, d.type, d.status, d.reason, d.photoIds, d.at],
    );
    return row!.id;
  }

  findRef(id: string): Promise<{ pickup_id: string; type: DisputeType } | null> {
    return one(this.db, `SELECT pickup_id, type FROM disputes WHERE id = $1`, [id]);
  }

  lockStatus(tx: Db, id: string): Promise<{ status: DisputeStatus } | null> {
    return one(tx, `SELECT status FROM disputes WHERE id = $1 FOR UPDATE`, [id]);
  }

  async resolve(tx: Db, id: string, outcome: DisputeOutcome, note: string, resolvedBy: string, at: Date): Promise<void> {
    await tx.query(
      `UPDATE disputes SET status = 'RESOLVED', resolution = $2, resolution_note = $3, resolved_by = $4, resolved_at = $5
        WHERE id = $1`,
      [id, outcome, note, resolvedBy, at],
    );
  }

  /** Closes every open dispute of a cancelled pickup; returns their ids. */
  async resolveOpenAsCancelled(tx: Db, pickupId: string, note: string, resolvedBy: string, at: Date): Promise<string[]> {
    const closed = await rows<{ id: string }>(
      tx,
      `UPDATE disputes SET status = 'RESOLVED', resolution = 'CANCEL', resolution_note = $2,
              resolved_by = $3, resolved_at = $4
        WHERE pickup_id = $1 AND status <> 'RESOLVED' RETURNING id`,
      [pickupId, note, resolvedBy, at],
    );
    return closed.map((d) => d.id);
  }
}
