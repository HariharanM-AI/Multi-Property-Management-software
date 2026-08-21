import { SetMetadata } from '@nestjs/common';
import { Permission } from '@propertyos/types';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to declare required RBAC permissions on controllers or route handlers
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
