import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.js';
import { PickupCodeRepository } from '../repositories/pickup-code.repository.js';
import { PickupsRepository } from '../repositories/pickups.repository.js';
import { pickupCodeUtil } from '../utils/pickup-code.util.js';

const CODE_TTL_SEC = 3 * 86_400;

/** The 4-digit pickup code: created at accept, stored hashed, shown only to the household. */
@Injectable()
export class PickupCodeService {
  private readonly logger = new Logger('Pickups');

  constructor(
    private readonly pickupCodeRepository: PickupCodeRepository,
    private readonly pickupsRepository: PickupsRepository,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get secret(): string {
    return this.config.get('JWT_SECRET', { infer: true });
  }

  /** A new code and its hash; the plain code is remembered after the transaction commits. */
  newCode(pickupId: string): { code: string; hash: string } {
    const code = pickupCodeUtil.generate();
    return { code, hash: pickupCodeUtil.hash(this.secret, pickupId, code) };
  }

  matches(pickupId: string, code: string, storedHash: string): boolean {
    return pickupCodeUtil.matches(this.secret, pickupId, code, storedHash);
  }

  remember(pickupId: string, code: string): Promise<void> {
    return this.pickupCodeRepository.save(pickupId, code, CODE_TTL_SEC);
  }

  forget(pickupId: string): Promise<void> {
    return this.pickupCodeRepository.delete(pickupId);
  }

  /**
   * The household's code while ACCEPTED. Only the hash is in the database, so if Redis lost the
   * plain code a new one is made (the collector has not entered it yet, so nothing breaks).
   */
  async forHousehold(pickupId: string): Promise<string | null> {
    const cached = await this.pickupCodeRepository.find(pickupId);
    if (cached) return cached;
    const { code, hash } = this.newCode(pickupId);
    if (!(await this.pickupsRepository.setCodeHashIfAccepted(pickupId, hash))) return null;
    this.logger.warn(`Pickup code for ${pickupId} was missing from Redis; issued a new one`);
    await this.remember(pickupId, code);
    return code;
  }
}
