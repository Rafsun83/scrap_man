import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Role } from '@bw/shared';
import type { Db } from '../../../common/sql.js';
import { UserEntity } from '../entities/user.entity.js';

@Injectable()
export class UsersRepository {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {}

  findById(id: string): Promise<UserEntity | null> {
    return this.users.findOneBy({ id });
  }

  findByPhone(phone: string): Promise<UserEntity | null> {
    return this.users.findOneBy({ phone });
  }

  /** Inserts the user unless the phone already exists (two sign-ins racing for a new number). */
  async insertIfAbsent(phone: string, role: Role): Promise<void> {
    await this.users.createQueryBuilder().insert().values({ phone, role }).orIgnore().execute();
  }

  save(user: UserEntity): Promise<UserEntity> {
    return this.users.save(user);
  }

  async suspend(db: Db, id: string, now: Date): Promise<void> {
    await db.query(`UPDATE users SET status = 'SUSPENDED', updated_at = $2 WHERE id = $1`, [id, now]);
  }
}
