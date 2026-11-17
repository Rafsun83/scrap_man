import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AdminController } from './controllers/admin.controller.js';
import { AdminReadRepository } from './repositories/admin-read.repository.js';
import { AdminOverviewService } from './services/admin-overview.service.js';
import { AdminUsersService } from './services/admin-users.service.js';

/**
 * Admin panel read models: A1 overview and map, A5 user list. The repository only reads tables owned by other
 * modules (like the notifications feed); changes go through their services (user status via UsersService).
 * Pickup search, the timeline and disputes live with the pickups module; rates by date with the catalog.
 */
@Module({
  imports: [UsersModule],
  controllers: [AdminController],
  providers: [AdminReadRepository, AdminOverviewService, AdminUsersService],
})
export class AdminModule {}
