import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors.js';
import { toGeoPoint } from '../../../common/geo.js';
import type { AddressInputDto, AddressPatchDto } from '../dtos/address-input.dto.js';
import type { AddressDto } from '../dtos/address.dto.js';
import type { AddressEntity } from '../entities/address.entity.js';
import { AddressesRepository } from '../repositories/addresses.repository.js';

export const MAX_ADDRESSES = 10;

@Injectable()
export class AddressesService {
  constructor(private readonly addressesRepository: AddressesRepository) {}

  async list(userId: string): Promise<AddressDto[]> {
    return (await this.addressesRepository.listByUser(userId)).map((a) => this.toDto(a));
  }

  /** The first address, or one sent with isDefault, becomes the default. */
  async create(userId: string, input: AddressInputDto): Promise<AddressDto> {
    const saved = await this.addressesRepository.transaction(async (tx) => {
      const count = await this.addressesRepository.countByUser(userId, tx);
      if (count >= MAX_ADDRESSES) {
        throw AppError.validation(`You can save up to ${MAX_ADDRESSES} addresses. Remove one first.`);
      }
      const makeDefault = count === 0 || input.isDefault === true;
      if (makeDefault) await this.addressesRepository.clearDefault(userId, tx);
      return this.addressesRepository.create(
        {
          userId,
          label: input.label,
          line: input.line,
          area: input.area,
          city: input.city ?? 'Dhaka',
          location: toGeoPoint(input.location.lat, input.location.lng),
          note: input.note ?? null,
          isDefault: makeDefault,
        },
        tx,
      );
    });
    return this.toDto(saved);
  }

  async update(userId: string, id: string, input: AddressPatchDto): Promise<AddressDto> {
    const saved = await this.addressesRepository.transaction(async (tx) => {
      const address = await this.addressesRepository.findOwned(userId, id, tx);
      if (!address) throw AppError.notFound('That address was not found.');
      if (input.isDefault === true && !address.isDefault) {
        await this.addressesRepository.clearDefault(userId, tx);
        address.isDefault = true;
      }
      if (input.label !== undefined) address.label = input.label;
      if (input.line !== undefined) address.line = input.line;
      if (input.area !== undefined) address.area = input.area;
      if (input.city !== undefined) address.city = input.city;
      if (input.note !== undefined) address.note = input.note || null;
      if (input.location) address.location = toGeoPoint(input.location.lat, input.location.lng);
      return this.addressesRepository.save(address, tx);
    });
    return this.toDto(saved);
  }

  /** Removing the default address makes the newest remaining one the default. */
  async remove(userId: string, id: string): Promise<void> {
    await this.addressesRepository.transaction(async (tx) => {
      const address = await this.addressesRepository.findOwned(userId, id, tx);
      if (!address) throw AppError.notFound('That address was not found.');
      await this.addressesRepository.delete(id, tx);
      if (address.isDefault) {
        const next = await this.addressesRepository.findNewest(userId, tx);
        if (next) await this.addressesRepository.makeDefault(next.id, tx);
      }
    });
  }

  /** The contract's Address; GeoJSON stores [lng, lat]. */
  private toDto(a: AddressEntity): AddressDto {
    return {
      id: a.id,
      label: a.label,
      line: a.line,
      area: a.area,
      city: a.city,
      location: { lat: a.location.coordinates[1], lng: a.location.coordinates[0] },
      note: a.note,
      isDefault: a.isDefault,
    };
  }
}
