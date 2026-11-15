import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@bw/shared';
import type { UserEntity } from '../modules/users/entities/user.entity.js';

export const IS_PUBLIC = 'bw:isPublic';
export const ROLES = 'bw:roles';

/** Marks a route that needs no sign-in. Every other route requires a valid access token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Limits a route to some roles, e.g. `@Roles('ADMIN')`. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** The signed-in user, loaded by the auth guard. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UserEntity => ctx.switchToHttp().getRequest().user,
);
