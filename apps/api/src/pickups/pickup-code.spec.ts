import { hashPickupCode, newPickupCode, pickupCodeMatches } from './pickup-code.js';

describe('pickup code', () => {
  const secret = 'test-secret';
  const id = '7c1f3c1e-8a3d-4a52-9d55-3c5c2a0c6b11';

  it('is always 4 digits', () => {
    for (let i = 0; i < 200; i++) expect(newPickupCode()).toMatch(/^[0-9]{4}$/);
  });

  it('matches only the same code for the same pickup', () => {
    const hash = hashPickupCode(secret, id, '0427');
    expect(hash).not.toContain('0427');
    expect(pickupCodeMatches(secret, id, '0427', hash)).toBe(true);
    expect(pickupCodeMatches(secret, id, '0428', hash)).toBe(false);
    expect(pickupCodeMatches(secret, 'another-id', '0427', hash)).toBe(false);
    expect(pickupCodeMatches('other-secret', id, '0427', hash)).toBe(false);
  });
});
