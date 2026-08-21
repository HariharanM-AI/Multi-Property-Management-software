import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/roles.decorator';
import { Permission, UserRole, hasAllPermissions } from '@propertyos/types';
import { AuthenticatedRequest } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || !user.roles || user.roles.length === 0) {
      throw new ForbiddenException('Access denied. No roles or permissions assigned.');
    }

    const isAuthorized = hasAllPermissions(user.roles as UserRole[], requiredPermissions);

    if (!isAuthorized) {
      throw new ForbiddenException(
        'Access denied. You do not possess the required permissions for this operation.'
      );
    }

    return true;
  }
}
