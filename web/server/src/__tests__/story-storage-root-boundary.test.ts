import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CENTRALIZED_SERVICES = [
  'project-service.ts',
  'generated-health-service.ts',
  'gears-execution-service.ts',
  'ai-comic-series-service.ts',
  'domain-pack-expansion-service.ts',
  'gears-webhook-service.ts',
  'gears-workbench-audit-service.ts',
  'production-readiness-portfolio-service.ts',
  'product-resource-access-service.ts',
  'story-storage-legacy-disposition-service.ts',
];

describe('Story storage root source boundary', () => {
  it.each(CENTRALIZED_SERVICES)('%s delegates root resolution to the platform boundary', async fileName => {
    const source = await readFile(resolve(import.meta.dirname, '..', 'services', fileName), 'utf-8');

    expect(source).toContain("from '../platform/story-storage-root.js'");
    expect(source).not.toContain('process.env.WEB_GENERATED_ROOT');
    expect(source).not.toContain("'web', 'web', 'generated'");
    expect(source).not.toContain("resolve(import.meta.dirname, '..', '..', '..', 'data')");
  });

  it('keeps the legacy path literal isolated to the platform audit boundary', async () => {
    const source = await readFile(resolve(import.meta.dirname, '..', 'platform', 'story-storage-root.ts'), 'utf-8');

    expect(source).toContain("resolve(REPO_ROOT, 'web', 'web', 'generated')");
    expect(source).toContain('included_in_active_read_roots: false');
    expect(source).toContain('automatic_migration_allowed: false');
    expect(source).toContain('automatic_writeback_allowed: false');
  });
});
