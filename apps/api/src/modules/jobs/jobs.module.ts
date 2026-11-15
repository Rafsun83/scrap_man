import { Module } from '@nestjs/common';
import { PickupsModule } from '../pickups/pickups.module.js';
import { MatchingJobsService } from './services/matching-jobs.service.js';

@Module({
  imports: [PickupsModule],
  providers: [MatchingJobsService],
  exports: [MatchingJobsService],
})
export class JobsModule {}
