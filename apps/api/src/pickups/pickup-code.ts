import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/** A fresh 4-digit pickup code, e.g. "0427". */
export function newPickupCode(): string {
  return randomInt(0, 10_000).toString().padStart(4, '0');
}

/**
 * Codes are stored as an HMAC keyed with a server secret and bound to the pickup, so the
 * 10,000 possible codes cannot be tried offline against a leaked database.
 */
export function hashPickupCode(secret: string, pickupId: string, code: string): string {
  return createHmac('sha256', `pickup-code:${secret}`).update(`${pickupId}:${code}`).digest('hex');
}

export function pickupCodeMatches(secret: string, pickupId: string, code: string, storedHash: string): boolean {
  const given = Buffer.from(hashPickupCode(secret, pickupId, code), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return given.length === stored.length && timingSafeEqual(given, stored);
}
