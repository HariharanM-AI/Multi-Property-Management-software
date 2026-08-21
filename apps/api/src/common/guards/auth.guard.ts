import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../decorators/current-user.decorator';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // 1. Extract session token from HTTP-only cookie, or fallback to Bearer header
    const token =
      request.cookies?.['propertyos_session'] ||
      this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required. Missing session cookie or token.');
    }

    // 2. Validate session in DB (verifies active status, expiry, and organization)
    const user = await this.authService.validateSession(token);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired authentication session.');
    }

    // 3. Attach hydrated user and organization context to request
    request.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      organizationId: user.organizationId,
      roles: user.roles,
      isActive: true,
    };
    request.organizationId = user.organizationId;

    return true;
  }

  private extractTokenFromHeader(request: AuthenticatedRequest): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
