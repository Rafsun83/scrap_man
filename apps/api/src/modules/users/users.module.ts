import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeController } from './controllers/me.controller.js';
import { AddressEntity } from './entities/address.entity.js';
import { CollectorProfileEntity } from './entities/collector-profile.entity.js';
import { UserEntity } from './entities/user.entity.js';
import { AddressesRepository } from './repositories/addresses.repository.js';
import { CollectorProfilesRepository } from './repositories/collector-profiles.repository.js';
import { UsersRepository } from './repositories/users.repository.js';
import { AddressesService } from './services/addresses.service.js';
import { CollectorProfilesService } from './services/collector-profiles.service.js';
import { UsersService } from './services/users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, AddressEntity, CollectorProfileEntity])],
  controllers: [MeController],
  providers: [
    UsersRepository,
    AddressesRepository,
    CollectorProfilesRepository,
    UsersService,
    AddressesService,
    CollectorProfilesService,
  ],
  exports: [UsersService, CollectorProfilesService],
})
export class UsersModule {}
