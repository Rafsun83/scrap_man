import { PICKUP_CODE_MAX_ATTEMPTS, type PickupStatus } from '@bw/shared';
import { estimatePayout } from './estimate.js';
import { num } from './money.js';
import { displayNo, type DisputeRow, type PickupRecord, type Viewer } from './records.js';

/** Statuses in which the assigned collector sees the exact address and the household's phone. */
const COLLECTOR_SEES_ADDRESS: ReadonlySet<PickupStatus> = new Set([
  'ACCEPTED',
  'ARRIVED',
  'WEIGHED',
  'DISPUTED',
  'CONFIRMED',
  'COMPLETED',
]);

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Who may open a pickup at all: its household, its assigned collector, or an admin. */
export function canSeePickup(rec: PickupRecord, viewer: Viewer): boolean {
  const { row } = rec;
  if (viewer.role === 'ADMIN') return true;
  if (viewer.role === 'HOUSEHOLD') return row.household_id === viewer.id;
  return row.collector_id === viewer.id;
}

export function toDisputeDto(d: DisputeRow) {
  return {
    id: d.id,
    pickupId: d.pickup_id,
    displayNo: displayNo(d.display_no),
    type: d.type,
    status: d.status,
    raisedBy: d.raised_by,
    reason: d.reason,
    photoIds: d.photo_ids,
    outcome: d.resolution,
    resolutionNote: d.resolution_note,
    createdAt: d.created_at.toISOString(),
    resolvedAt: iso(d.resolved_at),
  };
}

/** Rough payout range: locked rates after accept, today's rates before. */
export function estimateFor(rec: PickupRecord) {
  const locked = rec.row.collector_id !== null && rec.row.accepted_at !== null;
  const rates = rec.items
    .filter((i) => i.pricing_type === 'PER_KG')
    .map((i) => num(locked ? i.rate_snapshot : i.current_rate))
    .filter((r): r is number => r !== null);
  return estimatePayout(rec.row.weight_band, rates);
}

/**
 * The contract's Pickup shape for one viewer. Fields the viewer may not see are null:
 * the exact address and household phone only reach the assigned collector after accept,
 * and the pickup code only reaches the household while ACCEPTED.
 */
export function toPickupDto(
  rec: PickupRecord,
  viewer: Viewer,
  extras: { pickupCode?: string | null; photoUrls?: ReadonlyMap<string, string> } = {},
) {
  const { row } = rec;
  const isOwner = viewer.role === 'HOUSEHOLD' && row.household_id === viewer.id;
  const isAssigned = viewer.role === 'COLLECTOR' && row.collector_id === viewer.id;
  const isAdmin = viewer.role === 'ADMIN';
  const collectorSeesPrivate = isAssigned && COLLECTOR_SEES_ADDRESS.has(row.status);
  const seesAddress = isOwner || isAdmin || collectorSeesPrivate;

  const versions = [...new Set(rec.weighLines.map((l) => l.version))].sort((a, b) => a - b);
  const linesOf = (v: number) =>
    rec.weighLines
      .filter((l) => l.version === v)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => ({ categoryCode: l.code, kg: Number(l.kg), rate: num(l.rate), amount: Number(l.amount) }));
  const weighRounds = versions.map((v) => {
    const lines = linesOf(v);
    const first = rec.weighLines.find((l) => l.version === v)!;
    const scale = rec.photos.find((p) => p.kind === 'SCALE' && p.weigh_version === v);
    const tenths = lines.reduce((s, l) => s + Math.round(l.kg * 10), 0);
    const paisa = lines.reduce((s, l) => s + Math.round(l.amount * 100), 0);
    return {
      version: v,
      lines,
      totalKg: tenths / 10,
      totalAmount: paisa / 100,
      scalePhotoId: scale?.id ?? null,
      weighedBy: first.created_by_role === 'ADMIN' ? ('ADMIN' as const) : ('COLLECTOR' as const),
      createdAt: first.created_at.toISOString(),
    };
  });
  const latest = versions.at(-1);
  const openDispute = rec.disputes.find((d) => d.status !== 'RESOLVED');

  return {
    id: row.id,
    displayNo: displayNo(row.display_no),
    status: row.status,
    slotDate: row.slot_date,
    slot: row.slot,
    weightBand: row.weight_band,
    categoryCodes: [...rec.items].sort((a, b) => a.sort_order - b.sort_order).map((i) => i.code),
    area: row.area,
    estimate: estimateFor(rec),
    address: seesAddress ? { text: row.address_text, lat: row.lat, lng: row.lng, note: row.note } : null,
    household: {
      id: row.household_id,
      name: row.household_name,
      phone: isAdmin || collectorSeesPrivate ? row.household_phone : null,
    },
    collector: row.collector_id
      ? {
          id: row.collector_id,
          name: row.collector_name,
          rating: num(row.collector_rating),
          phone: isOwner || isAdmin || isAssigned ? row.collector_phone : null,
        }
      : null,
    pickupCode: isOwner && row.status === 'ACCEPTED' ? (extras.pickupCode ?? null) : null,
    codeLocked: row.code_attempts >= PICKUP_CODE_MAX_ATTEMPTS,
    lines: latest === undefined ? [] : linesOf(latest),
    weighVersion: latest ?? null,
    weighRounds,
    photos: rec.photos
      .filter((p) => extras.photoUrls?.has(p.id))
      .map((p) => ({
        id: p.id,
        kind: p.kind,
        weighVersion: p.weigh_version,
        url: extras.photoUrls!.get(p.id)!,
        createdAt: p.created_at.toISOString(),
      })),
    totalKg: num(row.total_kg),
    totalAmount: num(row.total_amount),
    paymentMethod: row.payment_method,
    walletNumber: isOwner || isAssigned || isAdmin ? row.wallet_number : null,
    payment: rec.payment
      ? {
          method: rec.payment.method,
          amount: Number(rec.payment.amount),
          walletNumber: rec.payment.wallet_number,
          trxId: rec.payment.trx_id,
          status: rec.payment.status,
          paidAt: rec.payment.paid_at.toISOString(),
        }
      : null,
    openDispute: openDispute ? toDisputeDto(openDispute) : null,
    searchRadiusM: row.search_radius_m,
    requestedAt: row.requested_at.toISOString(),
    acceptedAt: iso(row.accepted_at),
    arrivedAt: iso(row.arrived_at),
    weighedAt: iso(row.weighed_at),
    confirmedAt: iso(row.confirmed_at),
    completedAt: iso(row.completed_at),
    cancelledAt: iso(row.cancelled_at),
    expiresAt: row.expires_at.toISOString(),
    collectorLocation:
      (isOwner || isAdmin) && row.status === 'ACCEPTED' && row.collector_lat !== null && row.collector_lng !== null
        ? { lat: Number(row.collector_lat), lng: Number(row.collector_lng), at: iso(row.collector_seen_at) ?? iso(row.accepted_at)! }
        : null,
    rating:
      (isOwner || isAssigned || isAdmin) && row.rating_stars !== null
        ? { stars: Number(row.rating_stars), comment: row.rating_comment, createdAt: row.rated_at!.toISOString() }
        : null,
  };
}

export type PickupDto = ReturnType<typeof toPickupDto>;

/** The contract's NearbyRequest: area and distance only, never the address or phone. */
export function toNearbyRequest(rec: PickupRecord, distanceM: number) {
  return {
    id: rec.row.id,
    area: rec.row.area,
    distanceM,
    categoryCodes: [...rec.items].sort((a, b) => a.sort_order - b.sort_order).map((i) => i.code),
    weightBand: rec.row.weight_band,
    slotDate: rec.row.slot_date,
    slot: rec.row.slot,
    hasPhoto: rec.photos.some((p) => p.kind === 'ITEMS'),
    estimate: estimateFor(rec),
  };
}
