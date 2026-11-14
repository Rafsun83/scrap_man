import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '@bw/shared';
import { IS_PUBLIC, ROLES } from '../common/auth.decorators.js';
import { AppError } from '../common/errors.js';
import { UsersService } from '../users/users.service.js';
import { TokenService } from './token.service.js';

/**
 * Runs on every route: checks the Bearer token, loads the user, blocks suspended accounts,
 * and enforces `@Roles(...)`. Routes marked `@Public()` skip it.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw AppError.unauthorized();

    const payload = await this.tokens.verifyAccess(token);
    const user = await this.users.findById(payload.sub);
    if (!user) throw AppError.unauthorized('This account no longer exists.');
    if (user.status === 'SUSPENDED') {
      throw AppError.forbidden('This account is suspended. Contact BhangariWala support.');
    }
    req.user = user;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(user.role)) {
      throw AppError.forbidden('Your account type cannot do this.');
    }
    return true;
  }
}
