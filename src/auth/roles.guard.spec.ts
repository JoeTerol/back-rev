import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../common/roles.enum';
import { RolesGuard } from './roles.guard';

const guardRequiring = (roles?: Role[]): RolesGuard =>
  new RolesGuard({ getAllAndOverride: () => roles } as unknown as Reflector);

const contextFor = (user?: { role: Role }): ExecutionContext =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  it('should not interfere when the route requires no roles', () => {
    const guard = guardRequiring(undefined);

    expect(guard.canActivate(contextFor({ role: Role.USER }))).toBe(true);
    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });

  it('should allow a user whose role is required', () => {
    const guard = guardRequiring([Role.MODERATOR]);

    expect(guard.canActivate(contextFor({ role: Role.MODERATOR }))).toBe(true);
  });

  it('should allow an admin on any restricted route', () => {
    const guard = guardRequiring([Role.EDITOR]);

    expect(guard.canActivate(contextFor({ role: Role.ADMIN }))).toBe(true);
  });

  it('should forbid a user whose role is not required', () => {
    const guard = guardRequiring([Role.EDITOR]);

    expect(() => guard.canActivate(contextFor({ role: Role.USER }))).toThrow(
      ForbiddenException,
    );
  });

  it('should forbid a role that is close but not the required one', () => {
    const guard = guardRequiring([Role.ADMIN]);

    expect(() =>
      guard.canActivate(contextFor({ role: Role.MODERATOR })),
    ).toThrow(ForbiddenException);
  });

  it('should forbid when there is no user on a restricted route', () => {
    const guard = guardRequiring([Role.ADMIN]);

    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });
});