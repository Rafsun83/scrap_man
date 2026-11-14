import { Module } from '@nestjs/common';
import { PickupsModule } from '../pickups/pickups.module.js';
import { MatchingJobs } from './matching-jobs.service.js';

@Module({
  imports: [PickupsModule],
  providers: [MatchingJobs],
  exports: [MatchingJobs],
})
export class JobsModule {}
