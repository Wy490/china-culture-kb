import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Create an Error that mimics a ZodError so the unified error handler
 * can catch it by name === 'ZodError' and return 400 VALIDATION_ERROR.
 */
function makeZodLikeError(message: string, issues: unknown[]): Error {
  const err = new Error(message);
  err.name = 'ZodError';
  // Attach issues for the error handler's details extraction
  (err as Record<string, unknown>).issues = issues;
  return err;
}

/**
 * validateBody — validates req.body against a Zod schema.
 * On success: replaces req.body with the validated/parsed data.
 * On failure: creates a ZodError-named Error and calls next(err).
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (result.success) {
      req.body = result.data;
      next();
    } else {
      const message = JSON.stringify(result.error.issues);
      next(makeZodLikeError(message, result.error.issues));
    }
  };
}

/**
 * validateQuery — validates req.query against a Zod schema.
 * On success: replaces req.query with the validated/parsed data.
 * On failure: creates a ZodError-named Error and calls next(err).
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (result.success) {
      // Express 5 makes req.query a getter on the prototype, so direct
      // assignment fails. Override with an instance data property instead.
      Object.defineProperty(req, 'query', {
        value: result.data as Record<string, string | string[]>,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      next();
    } else {
      const message = JSON.stringify(result.error.issues);
      next(makeZodLikeError(message, result.error.issues));
    }
  };
}

/**
 * validateParams — validates req.params against a Zod schema.
 * On success: replaces req.params with the validated/parsed data.
 * On failure: creates a ZodError-named Error and calls next(err).
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (result.success) {
      req.params = result.data as Record<string, string>;
      next();
    } else {
      const message = JSON.stringify(result.error.issues);
      next(makeZodLikeError(message, result.error.issues));
    }
  };
}