import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  formatProductionMaterialDraftCliError,
  loadProductionMaterialSourceObservationsFile,
  parseProductionMaterialSourceObservationsJson,
} from './production-material-source-observations.js';

const temporaryRoots: string[] = [];

async function makeTemporaryRoot(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe('production material source observations input', () => {
  it('sanitizes invalid MCP sourceObservations JSON', () => {
    const sensitivePayload = 'sensitive-mcp-source-observations-payload';

    const error = (() => {
      try {
        parseProductionMaterialSourceObservationsJson(`{\"${sensitivePayload}\":`);
        return undefined;
      } catch (reason) {
        return reason as Error;
      }
    })();

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('sourceObservations must contain valid JSON');
    expect(error?.message).not.toContain(sensitivePayload);
    expect(error?.message).not.toContain('Unexpected');
  });

  it('sanitizes an unavailable CLI observations file error', async () => {
    const root = await makeTemporaryRoot('kb-pack-observations-unavailable-sensitive-');
    const missingPath = path.join(root, 'sensitive-missing-observations.json');

    const error = await loadProductionMaterialSourceObservationsFile(missingPath)
      .then(() => undefined, reason => reason as Error);

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('observations file is unavailable');
    expect(error?.message).not.toContain(missingPath);
    expect(error?.message).not.toContain('ENOENT');
  });

  it('sanitizes an invalid CLI observations file JSON error', async () => {
    const root = await makeTemporaryRoot('kb-pack-observations-invalid-json-');
    const sensitivePayload = 'sensitive-cli-observations-payload';
    const filePath = path.join(root, 'observations.json');
    await fs.writeFile(filePath, `{\"${sensitivePayload}\":`, 'utf8');

    const error = await loadProductionMaterialSourceObservationsFile(filePath)
      .then(() => undefined, reason => reason as Error);

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('observations file must contain valid JSON');
    expect(error?.message).not.toContain(sensitivePayload);
    expect(error?.message).not.toContain('Unexpected');
  });

  it('parses valid input without swallowing downstream shape validation', async () => {
    const root = await makeTemporaryRoot('kb-pack-observations-valid-json-');
    const filePath = path.join(root, 'observations.json');
    await fs.writeFile(filePath, '{}', 'utf8');

    expect(parseProductionMaterialSourceObservationsJson('{}')).toEqual({});
    await expect(loadProductionMaterialSourceObservationsFile(filePath)).resolves.toEqual({});
  });

  it('formats CLI failures without exposing stack paths or unknown payloads', () => {
    const error = new Error('observations file is unavailable');
    error.stack = 'sensitive absolute stack path';

    expect(formatProductionMaterialDraftCliError(error)).toBe('observations file is unavailable');
    expect(formatProductionMaterialDraftCliError({ sensitive: 'unknown payload' }))
      .toBe('production material pack draft failed');
  });
});
