import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth.decorators.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import {
  addressIdDto,
  addressInputDto,
  addressPatchDto,
  type AddressInputDto,
  type AddressPatchDto,
} from '../dtos/address-input.dto.js';
import type { AddressDto } from '../dtos/address.dto.js';
import { updateProfileDto, type UpdateProfileDto } from '../dtos/update-profile.dto.js';
import type { UserDto } from '../dtos/user.dto.js';
import type { UserEntity } from '../entities/user.entity.js';
import { AddressesService } from '../services/addresses.service.js';
import { UsersService } from '../services/users.service.js';

@Controller('me')
export class MeController {
  constructor(
    private readonly usersService: UsersService,
    private readonly addressesService: AddressesService,
  ) {}

  @Get()
  me(@CurrentUser() user: UserEntity): UserDto {
    return this.usersService.toDto(user);
  }

  @Patch()
  updateMe(@CurrentUser() user: UserEntity, @Body(new ZodPipe(updateProfileDto)) body: UpdateProfileDto): Promise<UserDto> {
    return this.usersService.updateProfile(user.id, body);
  }

  @Get('addresses')
  @Roles('HOUSEHOLD')
  listAddresses(@CurrentUser() user: UserEntity): Promise<AddressDto[]> {
    return this.addressesService.list(user.id);
  }

  @Post('addresses')
  @Roles('HOUSEHOLD')
  addAddress(@CurrentUser() user: UserEntity, @Body(new ZodPipe(addressInputDto)) body: AddressInputDto): Promise<AddressDto> {
    return this.addressesService.create(user.id, body);
  }

  @Patch('addresses/:addressId')
  @Roles('HOUSEHOLD')
  editAddress(
    @CurrentUser() user: UserEntity,
    @Param('addressId', new ZodPipe(addressIdDto)) addressId: string,
    @Body(new ZodPipe(addressPatchDto)) body: AddressPatchDto,
  ): Promise<AddressDto> {
    return this.addressesService.update(user.id, addressId, body);
  }

  @Delete('addresses/:addressId')
  @Roles('HOUSEHOLD')
  @HttpCode(204)
  async removeAddress(
    @CurrentUser() user: UserEntity,
    @Param('addressId', new ZodPipe(addressIdDto)) addressId: string,
  ): Promise<void> {
    await this.addressesService.remove(user.id, addressId);
  }
}
