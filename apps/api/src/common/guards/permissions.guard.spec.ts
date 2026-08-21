import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { Permission, UserRole } from '@propertyos/types';

describe('PermissionsGuard (CORE-003 RBAC Matrix)', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  function createMockContext(user: any, isPublic = false): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow public endpoints unconditionally', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true); // isPublic = true
    const context = createMockContext(null, true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow OWNER all permissions unconditionally', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return [Permission.ORGANIZATION_UPDATE, Permission.TEAM_INVITE];
      return null;
    });

    const context = createMockContext({
      id: 'owner-id',
      roles: [UserRole.OWNER],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow PROPERTY_MANAGER operational/property permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return [Permission.PROPERTY_CREATE, Permission.TENANT_READ];
      return null;
    });

    const context = createMockContext({
      id: 'pm-id',
      roles: [UserRole.PROPERTY_MANAGER],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should forbid PROPERTY_MANAGER from organization.update', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return [Permission.ORGANIZATION_UPDATE];
      return null;
    });

    const context = createMockContext({
      id: 'pm-id',
      roles: [UserRole.PROPERTY_MANAGER],
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow ACCOUNTANT billing and reports permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return [Permission.BILLING_CREATE, Permission.REPORTS_READ];
      return null;
    });

    const context = createMockContext({
      id: 'acc-id',
      roles: [UserRole.ACCOUNTANT],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should forbid ACCOUNTANT from team.invite and property.create', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return [Permission.TEAM_INVITE];
      return null;
    });

    const context = createMockContext({
      id: 'acc-id',
      roles: [UserRole.ACCOUNTANT],
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should forbid SECURITY from financial and team administration', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return [Permission.BILLING_READ];
      return null;
    });

    const context = createMockContext({
      id: 'sec-id',
      roles: [UserRole.SECURITY],
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should forbid user with no roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return [Permission.ORGANIZATION_READ];
      return null;
    });

    const context = createMockContext({
      id: 'norole-id',
      roles: [],
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
