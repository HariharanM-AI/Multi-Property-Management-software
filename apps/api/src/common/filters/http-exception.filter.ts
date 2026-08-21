import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse, ApiErrorDetail } from '@propertyos/types';
import { REQUEST_ID_HEADER } from '../interceptors/request-id.interceptor';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request.headers[REQUEST_ID_HEADER] as string) || '';
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred. Please try again later.';
    let details: ApiErrorDetail[] | undefined = undefined;

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj['message'] as string) || exception.message;
        code = (resObj['error'] as string) || `HTTP_${status}`;
        if (Array.isArray(resObj['details'])) {
          details = resObj['details'] as ApiErrorDetail[];
        }
      }
    } else if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
      // In development only, log detailed stack
      this.logger.error(`[${requestId}] Unhandled exception: ${exception.message}`, exception.stack);
    } else {
      this.logger.error(`[${requestId}] Production unhandled exception: ${String(exception)}`);
    }

    const errorPayload: ApiResponse = {
      success: false,
      error: {
        code,
        message,
        details,
        requestId,
        timestamp: new Date().toISOString(),
      },
    };

    response.status(status).json(errorPayload);
  }
}
