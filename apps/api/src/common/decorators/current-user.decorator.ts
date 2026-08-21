import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '@propertyos/types';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  organizationId?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) return null;
    return data ? user[data] : user;
  }
);

export const CurrentOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.organizationId || request.user?.organizationId || null;
  }
);
