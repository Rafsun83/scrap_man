/** Where a tapped push opens, from the data the API puts on it (kind, event, pickupId). */
export function pushRoute(data: Record<string, unknown> | undefined, role: string | undefined): string {
  const kind = typeof data?.kind === 'string' ? data.kind : '';
  const pickupId = typeof data?.pickupId === 'string' ? data.pickupId : null;
  if (role === 'COLLECTOR') {
    if (kind === 'APPROVED' || kind === 'REJECTED') return '/collector';
    if (kind === 'NEW_REQUEST' || !pickupId) return '/requests';
    return `/job/${pickupId}`;
  }
  return pickupId ? `/pickup/${pickupId}` : '/notifications';
}
