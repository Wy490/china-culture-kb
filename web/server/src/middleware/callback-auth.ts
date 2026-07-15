import { timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { ErrorCodes, fail } from '@shared/types.js';

type CallbackSecretOptions = {
  envName: string;
  explicitHeaders: readonly string[];
  label: string;
};

function callbackSecretFromRequest(req: Request, explicitHeaders: readonly string[]): string | undefined {
  for (const headerName of explicitHeaders) {
    const explicitSecret = req.header(headerName)?.trim();
    if (explicitSecret) return explicitSecret;
  }
  const authorization = req.header('authorization')?.trim();
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1]?.trim();
}

function constantTimeTextEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * External callbacks use a machine secret, independently from product-user RBAC.
 * Tests and local development retain the legacy no-secret fallback; production
 * fails closed when the corresponding secret is not configured.
 */
export function requireCallbackSecret(options: CallbackSecretOptions): RequestHandler {
  return (req, res, next) => {
    const expectedSecret = process.env[options.envName]?.trim();
    if (!expectedSecret) {
      if (process.env.NODE_ENV !== 'production') {
        next();
        return;
      }
      res.status(503).json(fail(
        ErrorCodes.CALLBACK_AUTH_UNAVAILABLE,
        `${options.label} authentication is not configured`,
      ));
      return;
    }

    const providedSecret = callbackSecretFromRequest(req, options.explicitHeaders);
    if (providedSecret && constantTimeTextEqual(providedSecret, expectedSecret)) {
      next();
      return;
    }
    res.status(401).json(fail(
      ErrorCodes.CALLBACK_UNAUTHENTICATED,
      `${options.label} secret is missing or invalid`,
    ));
  };
}
