import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressEntity } from './address.entity.js';
import { AddressesService } from './addresses.service.js';
import { CollectorProfileEntity } from './collector-profile.entity.js';
import { MeController } from './me.controller.js';
import { UserEntity } from './user.entity.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, AddressEntity, CollectorProfileEntity])],
  controllers: [MeController],
  providers: [UsersService, AddressesService],
  exports: [UsersService],
})
export class UsersModule {}
