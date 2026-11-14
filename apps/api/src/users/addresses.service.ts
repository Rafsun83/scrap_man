import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { DataSource, Repository } from 'typeorm';
import { AppError } from '../common/errors.js';
import { AddressEntity, toPoint } from './address.entity.js';

export interface AddressInput {
  label: string;
  line: string;
  area: string;
  city?: string;
  location: { lat: number; lng: number };
  note?: string;
  isDefault?: boolean;
}

export const MAX_ADDRESSES = 10;

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(AddressEntity) private readonly addresses: Repository<AddressEntity>,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  list(userId: string): Promise<AddressEntity[]> {
    return this.addresses.find({ where: { userId }, order: { isDefault: 'DESC', createdAt: 'DESC' } });
  }

  async create(userId: string, input: AddressInput): Promise<AddressEntity> {
    return this.db.transaction(async (tx) => {
      const repo = tx.getRepository(AddressEntity);
      const count = await repo.countBy({ userId });
      if (count >= MAX_ADDRESSES) {
        throw AppError.validation(`You can save up to ${MAX_ADDRESSES} addresses. Remove one first.`);
      }
      const makeDefault = count === 0 || input.isDefault === true;
      if (makeDefault) await repo.update({ userId, isDefault: true }, { isDefault: false });
      return repo.save(
        repo.create({
          userId,
          label: input.label,
          line: input.line,
          area: input.area,
          city: input.city ?? 'Dhaka',
          location: toPoint(input.location.lat, input.location.lng),
          note: input.note ?? null,
          isDefault: makeDefault,
        }),
      );
    });
  }

  async update(userId: string, id: string, input: Partial<AddressInput>): Promise<AddressEntity> {
    return this.db.transaction(async (tx) => {
      const repo = tx.getRepository(AddressEntity);
      const address = await repo.findOneBy({ id, userId });
      if (!address) throw AppError.notFound('That address was not found.');
      if (input.isDefault === true && !address.isDefault) {
        await repo.update({ userId, isDefault: true }, { isDefault: false });
        address.isDefault = true;
      }
      if (input.label !== undefined) address.label = input.label;
      if (input.line !== undefined) address.line = input.line;
      if (input.area !== undefined) address.area = input.area;
      if (input.city !== undefined) address.city = input.city;
      if (input.note !== undefined) address.note = input.note || null;
      if (input.location) address.location = toPoint(input.location.lat, input.location.lng);
      return repo.save(address);
    });
  }

  /** Removing the default address makes the newest remaining one the default. */
  async remove(userId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const repo = tx.getRepository(AddressEntity);
      const address = await repo.findOneBy({ id, userId });
      if (!address) throw AppError.notFound('That address was not found.');
      await repo.delete({ id });
      if (address.isDefault) {
        const next = await repo.findOne({ where: { userId }, order: { createdAt: 'DESC' } });
        if (next) await repo.update({ id: next.id }, { isDefault: true });
      }
    });
  }
}
