import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { CollectorSelfieEntity } from '../entities/collector-selfie.entity.js';

/** Selfie upload records; the files themselves live in photo storage. */
@Injectable()
export class CollectorSelfiesRepository {
  constructor(@InjectRepository(CollectorSelfieEntity) private readonly selfies: Repository<CollectorSelfieEntity>) {}

  async insert(id: string, userId: string, storageKey: string, now: Date): Promise<void> {
    await this.selfies.insert({ id, userId, storageKey, createdAt: now });
  }

  countByUser(userId: string): Promise<number> {
    return this.selfies.countBy({ userId });
  }

  findOfUser(id: string, userId: string): Promise<CollectorSelfieEntity | null> {
    return this.selfies.findOneBy({ id, userId });
  }

  findByIds(ids: string[]): Promise<CollectorSelfieEntity[]> {
    return ids.length === 0 ? Promise.resolve([]) : this.selfies.findBy({ id: In(ids) });
  }
}
