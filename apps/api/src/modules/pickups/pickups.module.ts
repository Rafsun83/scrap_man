import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module.js';
import { UsersModule } from '../users/users.module.js';
import { AdminPickupsController } from './controllers/admin-pickups.controller.js';
import { CollectorController } from './controllers/collector.controller.js';
import { MyPickupsController } from './controllers/my-pickups.controller.js';
import { PickupsController } from './controllers/pickups.controller.js';
import { DisputesRepository } from './repositories/disputes.repository.js';
import { LedgerRepository } from './repositories/ledger.repository.js';
import { MatchingRepository } from './repositories/matching.repository.js';
import { PaymentsRepository } from './repositories/payments.repository.js';
import { PhotosRepository } from './repositories/photos.repository.js';
import { PickupCodeRepository } from './repositories/pickup-code.repository.js';
import { PickupsRepository } from './repositories/pickups.repository.js';
import { WeighingRepository } from './repositories/weighing.repository.js';
import { CollectorLedgerService } from './services/collector-ledger.service.js';
import { CollectorService } from './services/collector.service.js';
import { DisputesService } from './services/disputes.service.js';
import { MatchingService } from './services/matching.service.js';
import { PickupCodeService } from './services/pickup-code.service.js';
import { PickupEventsService } from './services/pickup-events.service.js';
import { PickupStateService } from './services/pickup-state.service.js';
import { PickupViewsService } from './services/pickup-views.service.js';
import { PickupsService } from './services/pickups.service.js';
import { WeighingService } from './services/weighing.service.js';

@Module({
  imports: [UsersModule, PushModule],
  controllers: [PickupsController, MyPickupsController, CollectorController, AdminPickupsController],
  providers: [
    PickupsRepository,
    MatchingRepository,
    PhotosRepository,
    WeighingRepository,
    PaymentsRepository,
    DisputesRepository,
    PickupCodeRepository,
    LedgerRepository,
    PickupStateService,
    PickupCodeService,
    PickupViewsService,
    PickupEventsService,
    MatchingService,
    PickupsService,
    WeighingService,
    DisputesService,
    CollectorService,
    CollectorLedgerService,
  ],
  exports: [MatchingService, CollectorLedgerService],
})
export class PickupsModule {}
