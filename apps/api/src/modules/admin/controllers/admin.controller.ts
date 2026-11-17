import { Body, Controller, Get, HttpCode, Param, Put, Query } from '@nestjs/common';
import { Roles } from '../../../common/auth.decorators.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import type { AdminMapDto, AdminOverviewDto } from '../dtos/admin-overview.dto.js';
import {
  adminUserIdDto,
  listAdminUsersDto,
  setUserStatusDto,
  type AdminUserIdDto,
  type AdminUserPageDto,
  type ListAdminUsersDto,
  type SetUserStatusDto,
} from '../dtos/admin-users.dto.js';
import { AdminOverviewService } from '../services/admin-overview.service.js';
import { AdminUsersService } from '../services/admin-users.service.js';

@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminOverviewService: AdminOverviewService,
    private readonly adminUsersService: AdminUsersService,
  ) {}

  @Get('overview')
  overview(): Promise<AdminOverviewDto> {
    return this.adminOverviewService.overview();
  }

  @Get('map')
  map(): Promise<AdminMapDto> {
    return this.adminOverviewService.map();
  }

  @Get('users')
  users(@Query(new ZodPipe(listAdminUsersDto)) query: ListAdminUsersDto): Promise<AdminUserPageDto> {
    return this.adminUsersService.list(query);
  }

  @Put('users/:userId/status')
  @HttpCode(204)
  async setStatus(
    @Param(new ZodPipe(adminUserIdDto)) params: AdminUserIdDto,
    @Body(new ZodPipe(setUserStatusDto)) body: SetUserStatusDto,
  ): Promise<void> {
    await this.adminUsersService.setStatus(params.userId, body);
  }
}
