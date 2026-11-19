import { Module } from '@nestjs/common';
import { OpsModule } from '../ops/ops.module.js';
import { PickupsModule } from '../pickups/pickups.module.js';
import { MatchingJobsService } from './services/matching-jobs.service.js';
import { OpsJobsService } from './services/ops-jobs.service.js';

@Module({
  imports: [PickupsModule, OpsModule],
  providers: [MatchingJobsService, OpsJobsService],
  exports: [MatchingJobsService],
})
export class JobsModule {}
