import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Role } from '@bw/shared';
import { AppError } from '../common/errors.js';
import { type Language, UserEntity } from './user.entity.js';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {}

  findById(id: string): Promise<UserEntity | null> {
    return this.users.findOneBy({ id });
  }

  findByPhone(phone: string): Promise<UserEntity | null> {
    return this.users.findOneBy({ phone });
  }

  /** Signs in an existing user, or creates one. A phone number keeps the role it signed up with. */
  async findOrCreate(phone: string, role: Extract<Role, 'HOUSEHOLD' | 'COLLECTOR'>): Promise<UserEntity> {
    const existing = await this.findByPhone(phone);
    if (existing) return existing;
    await this.users
      .createQueryBuilder()
      .insert()
      .values({ phone, role })
      .orIgnore() // two verifies racing for a new number both end up with the same row
      .execute();
    const created = await this.findByPhone(phone);
    if (!created) throw new Error(`User for ${phone} was not created`);
    return created;
  }

  async updateProfile(id: string, changes: { name?: string; language?: Language }): Promise<UserEntity> {
    const user = await this.findById(id);
    if (!user) throw AppError.notFound('This account no longer exists.');
    if (changes.name !== undefined) user.name = changes.name.trim() || null;
    if (changes.language !== undefined) user.language = changes.language;
    return this.users.save(user);
  }
}
