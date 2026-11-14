import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, Roles } from '../common/auth.decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { toAddressDto } from './address.entity.js';
import { AddressesService } from './addresses.service.js';
import { addressInputSchema, addressPatchSchema, profilePatchSchema, uuidSchema } from './schemas.js';
import { toUserDto, type UserEntity } from './user.entity.js';
import { UsersService } from './users.service.js';

@Controller('me')
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly addresses: AddressesService,
  ) {}

  @Get()
  me(@CurrentUser() user: UserEntity) {
    return toUserDto(user);
  }

  @Patch()
  async updateMe(
    @CurrentUser() user: UserEntity,
    @Body(new ZodPipe(profilePatchSchema)) body: z.infer<typeof profilePatchSchema>,
  ) {
    return toUserDto(await this.users.updateProfile(user.id, body));
  }

  @Get('addresses')
  @Roles('HOUSEHOLD')
  async listAddresses(@CurrentUser() user: UserEntity) {
    return (await this.addresses.list(user.id)).map(toAddressDto);
  }

  @Post('addresses')
  @Roles('HOUSEHOLD')
  async addAddress(
    @CurrentUser() user: UserEntity,
    @Body(new ZodPipe(addressInputSchema)) body: z.infer<typeof addressInputSchema>,
  ) {
    return toAddressDto(await this.addresses.create(user.id, body));
  }

  @Patch('addresses/:addressId')
  @Roles('HOUSEHOLD')
  async editAddress(
    @CurrentUser() user: UserEntity,
    @Param('addressId', new ZodPipe(uuidSchema)) addressId: string,
    @Body(new ZodPipe(addressPatchSchema)) body: z.infer<typeof addressPatchSchema>,
  ) {
    return toAddressDto(await this.addresses.update(user.id, addressId, body));
  }

  @Delete('addresses/:addressId')
  @Roles('HOUSEHOLD')
  @HttpCode(204)
  async removeAddress(
    @CurrentUser() user: UserEntity,
    @Param('addressId', new ZodPipe(uuidSchema)) addressId: string,
  ) {
    await this.addresses.remove(user.id, addressId);
  }
}
