import { Inject, Injectable } from '@nestjs/common';
import type { Role } from '@bw/shared';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { AppError } from '../../../common/errors.js';
import type { Db } from '../../../common/sql.js';
import type { UpdateProfileDto } from '../dtos/update-profile.dto.js';
import type { UserDto } from '../dtos/user.dto.js';
import type { UserEntity } from '../entities/user.entity.js';
import { CollectorProfilesRepository } from '../repositories/collector-profiles.repository.js';
import { UsersRepository } from '../repositories/users.repository.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly collectorProfilesRepository: CollectorProfilesRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  findById(id: string): Promise<UserEntity | null> {
    return this.usersRepository.findById(id);
  }

  /** Signs in an existing user, or creates one. A phone number keeps the role it signed up with. */
  async findOrCreate(phone: string, role: Extract<Role, 'HOUSEHOLD' | 'COLLECTOR'>): Promise<UserEntity> {
    const existing = await this.usersRepository.findByPhone(phone);
    if (existing) return existing;
    await this.usersRepository.insertIfAbsent(phone, role);
    const created = await this.usersRepository.findByPhone(phone);
    if (!created) throw new Error(`User for ${phone} was not created`);
    return created;
  }

  async updateProfile(id: string, changes: UpdateProfileDto): Promise<UserDto> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw AppError.notFound('This account no longer exists.');
    if (changes.name !== undefined) user.name = changes.name.trim() || null;
    if (changes.language !== undefined) user.language = changes.language;
    return this.toDto(await this.usersRepository.save(user));
  }

  /** Suspends the account and takes a collector offline, inside the caller's transaction. */
  async suspend(db: Db, userId: string, now: Date = this.clock.now()): Promise<void> {
    await this.usersRepository.suspend(db, userId, now);
    await this.collectorProfilesRepository.takeOffline(db, userId, now);
  }

  /** The contract's User. */
  toDto(user: UserEntity): UserDto {
    return {
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
      language: user.language,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
