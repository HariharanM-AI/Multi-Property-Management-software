import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  RegisterOwnerSchema,
  LoginSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  RegisterOwnerInput,
  LoginInput,
  PasswordResetRequestInput,
  PasswordResetConfirmInput,
} from '@propertyos/validation';
import { AuthResponseData, AuthUser } from '@propertyos/types';
import { Throttle } from '@nestjs/throttler';

const SESSION_COOKIE_NAME = 'propertyos_session';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setSessionCookie(res: Response, rawSessionToken: string): void {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(SESSION_COOKIE_NAME, rawSessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private clearSessionCookie(res: Response): void {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 attempts per 15 mins
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(RegisterOwnerSchema))
  async register(
    @Body() body: RegisterOwnerInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<AuthResponseData> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.registerOwner(body, ip, userAgent);
    this.setSessionCookie(res, result.rawSessionToken);

    return result.data;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 mins
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(
    @Body() body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<AuthResponseData> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.login(body, ip, userAgent);
    this.setSessionCookie(res, result.rawSessionToken);

    return result.data;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: AuthUser
  ): Promise<{ message: string }> {
    const rawSessionToken = req.cookies?.[SESSION_COOKIE_NAME];
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await this.authService.logout(rawSessionToken, user?.id, ip, userAgent);
    this.clearSessionCookie(res);

    return { message: 'Logged out successfully.' };
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: AuthUser): Promise<{ user: AuthUser }> {
    return { user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 mins
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(PasswordResetRequestSchema))
  async forgotPassword(
    @Body() body: PasswordResetRequestInput,
    @Req() req: Request
  ): Promise<{ message: string; devResetToken?: string }> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.requestPasswordReset(body, ip, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 mins
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(PasswordResetConfirmSchema))
  async resetPassword(
    @Body() body: PasswordResetConfirmInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ message: string }> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.resetPassword(body, ip, userAgent);
    this.clearSessionCookie(res);

    return result;
  }
}
