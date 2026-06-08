import type { Request, Response, NextFunction } from 'express';
import { fail, ErrorCodes, type ErrorCode } from '@shared/types.js';

/**
 * Unified error handler — catches all errors thrown in route handlers or
 * validation middleware and returns a consistent ApiResponse envelope.
 */
export function errorHandler(
  err: Error & { code?: string; status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation errors → 400 VALIDATION_ERROR
  if (err.name === 'ZodError') {
    const details =
      typeof err.message === 'string' ? JSON.parse(err.message) : err.message;
    res.status(400).json(fail(ErrorCodes.VALIDATION_ERROR, err.message, details));
    return;
  }

  // Errors with a known 'code' property
  if (err.code) {
    const status = deriveStatus(err.code);
    res.status(status).json(fail(err.code as ErrorCode, err.message));
    return;
  }

  // Fallthrough → 500 INTERNAL_ERROR
  console.error('[error-handler] Unhandled error:', err);
  res.status(500).json(fail(ErrorCodes.INTERNAL_ERROR, err.message));
}

function deriveStatus(code: string): number {
  if (code.includes('NOT_FOUND')) return 404;
  if (code.includes('INVALID')) return 400;
  return 500;
}