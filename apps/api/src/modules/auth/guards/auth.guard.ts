import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '@bw/shared';
import { IS_PUBLIC, ROLES } from '../../../common/auth.decorators.js';
import { AppError } from '../../../common/errors.js';
import { AuthService } from '../services/auth.service.js';

/**
 * Runs on every route: checks the Bearer token, loads the user, blocks suspended accounts,
 * and enforces `@Roles(...)`. Routes marked `@Public()` skip it.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw AppError.unauthorized();

    const user = await this.authService.authenticate(token);
    req.user = user;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(user.role)) {
      throw AppError.forbidden('Your account type cannot do this.');
    }
    return true;
  }
}
