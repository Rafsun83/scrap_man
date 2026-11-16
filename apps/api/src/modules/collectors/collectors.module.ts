import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PickupsModule } from '../pickups/pickups.module.js';
import { SmsModule } from '../sms/sms.module.js';
import { UsersModule } from '../users/users.module.js';
import { AdminCollectorsController } from './controllers/admin-collectors.controller.js';
import { CollectorProfileController } from './controllers/collector-profile.controller.js';
import { CollectorSelfieEntity } from './entities/collector-selfie.entity.js';
import { CollectorSelfiesRepository } from './repositories/collector-selfies.repository.js';
import { CollectorApprovalsService } from './services/collector-approvals.service.js';
import { CollectorsService } from './services/collectors.service.js';

/**
 * Collector sign-up, profile and admin approval. The collector_profiles table belongs to the users module
 * (matching reads it too); this module owns the selfies and the application workflow around it.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CollectorSelfieEntity]), UsersModule, PickupsModule, SmsModule],
  controllers: [CollectorProfileController, AdminCollectorsController],
  providers: [CollectorSelfiesRepository, CollectorsService, CollectorApprovalsService],
})
export class CollectorsModule {}
