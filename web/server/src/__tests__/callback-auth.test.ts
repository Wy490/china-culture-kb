import express from 'express';
import supertest from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { requireCallbackSecret } from '../middleware/callback-auth.js';

const ENVIRONMENT_NAMES = ['NODE_ENV', 'TEST_CALLBACK_SECRET'] as const;
const ORIGINAL_ENVIRONMENT = Object.fromEntries(ENVIRONMENT_NAMES.map(name => [name, process.env[name]]));

function callbackRequest() {
  const app = express();
  app.post(
    '/callback',
    requireCallbackSecret({
      envName: 'TEST_CALLBACK_SECRET',
      explicitHeaders: ['x-test-callback-secret', 'x-test-provider-secret'],
      label: 'Test callback',
    }),
    (_req, res) => res.status(204).end(),
  );
  return supertest(app);
}

afterEach(() => {
  for (const name of ENVIRONMENT_NAMES) {
    const value = ORIGINAL_ENVIRONMENT[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('external callback authentication', () => {
  it('keeps the no-secret fallback only outside production', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.TEST_CALLBACK_SECRET;

    const response = await callbackRequest().post('/callback');
    expect(response.status).toBe(204);
  });

  it('fails closed when a production callback secret is not configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TEST_CALLBACK_SECRET;

    const response = await callbackRequest().post('/callback');
    expect(response.status).toBe(503);
    expect(response.body.error).toMatchObject({
      code: 'CALLBACK_AUTH_UNAVAILABLE',
      message: 'Test callback authentication is not configured',
    });
  });

  it('rejects an invalid machine secret regardless of a supplied product role', async () => {
    process.env.NODE_ENV = 'production';
    process.env.TEST_CALLBACK_SECRET = 'correct-secret';

    const response = await callbackRequest()
      .post('/callback')
      .set('x-test-callback-secret', 'wrong-secret')
      .set('x-story-agent-role', 'administrator');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('CALLBACK_UNAUTHENTICATED');
    expect(JSON.stringify(response.body)).not.toContain('correct-secret');
  });

  it('accepts either an allowed explicit provider header or Bearer authentication', async () => {
    process.env.NODE_ENV = 'production';
    process.env.TEST_CALLBACK_SECRET = 'correct-secret';
    const request = callbackRequest();

    const explicit = await request
      .post('/callback')
      .set('x-test-provider-secret', 'correct-secret');
    expect(explicit.status).toBe(204);

    const bearer = await request
      .post('/callback')
      .set('authorization', 'Bearer correct-secret');
    expect(bearer.status).toBe(204);
  });
});
