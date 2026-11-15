import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { AddressEntity } from '../entities/address.entity.js';

/** Addresses; methods take the transaction's EntityManager when called inside `transaction`. */
@Injectable()
export class AddressesRepository {
  constructor(
    @InjectRepository(AddressEntity) private readonly addresses: Repository<AddressEntity>,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  transaction<T>(work: (tx: EntityManager) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  private repo(tx?: EntityManager): Repository<AddressEntity> {
    return tx ? tx.getRepository(AddressEntity) : this.addresses;
  }

  /** Default first, then newest. */
  listByUser(userId: string): Promise<AddressEntity[]> {
    return this.addresses.find({ where: { userId }, order: { isDefault: 'DESC', createdAt: 'DESC' } });
  }

  countByUser(userId: string, tx?: EntityManager): Promise<number> {
    return this.repo(tx).countBy({ userId });
  }

  findOwned(userId: string, id: string, tx?: EntityManager): Promise<AddressEntity | null> {
    return this.repo(tx).findOneBy({ id, userId });
  }

  findNewest(userId: string, tx?: EntityManager): Promise<AddressEntity | null> {
    return this.repo(tx).findOne({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async clearDefault(userId: string, tx?: EntityManager): Promise<void> {
    await this.repo(tx).update({ userId, isDefault: true }, { isDefault: false });
  }

  async makeDefault(id: string, tx?: EntityManager): Promise<void> {
    await this.repo(tx).update({ id }, { isDefault: true });
  }

  create(values: Omit<AddressEntity, 'id' | 'createdAt'>, tx?: EntityManager): Promise<AddressEntity> {
    const repo = this.repo(tx);
    return repo.save(repo.create(values));
  }

  save(address: AddressEntity, tx?: EntityManager): Promise<AddressEntity> {
    return this.repo(tx).save(address);
  }

  async delete(id: string, tx?: EntityManager): Promise<void> {
    await this.repo(tx).delete({ id });
  }
}
