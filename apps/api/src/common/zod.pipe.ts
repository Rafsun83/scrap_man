import { type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { AppError } from './errors.js';

/** Validates and parses a request part with a Zod schema: `@Body(new ZodPipe(schema))`. */
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw AppError.validation('Some fields are missing or not valid.', {
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
