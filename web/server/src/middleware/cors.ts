import type { CorsOptions } from 'cors';

/**
 * Create CORS options based on NODE_ENV and CORS_ORIGINS env var.
 *
 * - Development: allow all localhost origins (any port on localhost/127.0.0.1)
 *   plus any origins listed in CORS_ORIGINS.
 * - Production: strict whitelist from CORS_ORIGINS only, no wildcard.
 *
 * credentials: true in both modes.
 */
export function createCorsOptions(): CorsOptions {
  const env = process.env.NODE_ENV ?? 'development';
  const extraOrigins = parseCorsOrigins();

  if (env === 'development') {
    return {
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. server-to-server, curl)
        if (!origin) return callback(null, true);

        if (isLocalhost(origin) || extraOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
    };
  }

  // Production — strict whitelist only
  return {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (extraOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  };
}

/** Parse CORS_ORIGINS env var — comma-separated list of origins. */
function parseCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Check if an origin URL is localhost (any port). */
function isLocalhost(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}