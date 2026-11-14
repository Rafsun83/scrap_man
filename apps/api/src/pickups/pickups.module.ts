import { Module } from '@nestjs/common';
import { AdminPickupsController } from './admin-pickups.controller.js';
import { CollectorController } from './collector.controller.js';
import { CollectorService } from './collector.service.js';
import { DisputesService } from './disputes.service.js';
import { MatchingService } from './matching.service.js';
import { PickupEvents } from './pickup-events.js';
import { PickupStore } from './pickup-store.js';
import { MyPickupsController, PickupsController } from './pickups.controller.js';
import { PickupsService } from './pickups.service.js';
import { WeighingService } from './weighing.service.js';

@Module({
  controllers: [PickupsController, MyPickupsController, CollectorController, AdminPickupsController],
  providers: [
    PickupStore,
    PickupEvents,
    MatchingService,
    PickupsService,
    WeighingService,
    DisputesService,
    CollectorService,
  ],
  exports: [PickupStore, PickupEvents, MatchingService],
})
export class PickupsModule {}
