import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';
import { ApiErrorDetail } from '@propertyos/types';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const details: ApiErrorDetail[] = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        throw new BadRequestException({
          error: 'VALIDATION_FAILED',
          message: 'Invalid request data provided.',
          details,
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
