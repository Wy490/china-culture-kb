import express, { type RequestHandler } from 'express';

export const DEFAULT_JSON_BODY_LIMIT = '2mb';

export function createJsonBodyParser(
  limit = process.env.JSON_BODY_LIMIT?.trim() || DEFAULT_JSON_BODY_LIMIT,
): RequestHandler {
  return express.json({ limit });
}
