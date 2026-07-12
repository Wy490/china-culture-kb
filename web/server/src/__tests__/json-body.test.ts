import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../middleware/error-handler.js';
import { createJsonBodyParser } from '../middleware/json-body.js';

function createApp(limit?: string) {
  const app = express();
  app.use(createJsonBodyParser(limit));
  app.post('/echo-size', (req, res) => {
    res.json({ length: String(req.body.outline ?? '').length });
  });
  app.use(errorHandler);
  return app;
}

describe('JSON request body handling', () => {
  it('accepts story material larger than the Express 100 KB default', async () => {
    const outline = '庄'.repeat(50_000);
    expect(Buffer.byteLength(JSON.stringify({ outline }), 'utf8')).toBeGreaterThan(100 * 1024);

    const response = await supertest(createApp())
      .post('/echo-size')
      .send({ outline });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ length: outline.length });
  });

  it('returns a localized 413 response when the configured limit is exceeded', async () => {
    const response = await supertest(createApp('1kb'))
      .post('/echo-size')
      .send({ outline: '庄'.repeat(1_000) });

    expect(response.status).toBe(413);
    expect(response.body).toMatchObject({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('请求内容过大'),
      },
    });
  });
});
