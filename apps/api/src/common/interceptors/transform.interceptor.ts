import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { ApiResponse } from '@propertyos/types';
import { REQUEST_ID_HEADER } from './request-id.interceptor';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const req = context.switchToHttp().getRequest<Request>();
    const requestId = (req.headers[REQUEST_ID_HEADER] as string) || '';

    return next.handle().pipe(
      map((data) => {
        // If data is already an envelope, return as-is
        if (data && typeof data === 'object' && 'success' in data) {
          return data as ApiResponse<T>;
        }

        return {
          success: true,
          data,
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        };
      })
    );
  }
}
