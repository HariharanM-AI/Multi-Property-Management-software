import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../decorators/current-user.decorator';

@Injectable()
export class TenantOrgGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      return true; // AuthGuard handles authentication
    }

    // If an organizationId is explicitly specified in the query or body or params, ensure it matches the user's organizationId
    const targetOrgId =
      request.params?.['orgId'] ||
      request.params?.['organizationId'] ||
      request.query?.['organizationId'] ||
      request.body?.['organizationId'];

    if (targetOrgId && targetOrgId !== user.organizationId) {
      throw new ForbiddenException(
        'Cross-tenant violation: You do not have access to resources in another organization.'
      );
    }

    return true;
  }
}
