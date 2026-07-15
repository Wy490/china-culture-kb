import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { buildInitialGearsWebhookStatus } from '../platform/generated-story-persistence.js';

const originalWebhookUrl = process.env.GEARS_WEBHOOK_URL;

afterEach(() => {
  if (originalWebhookUrl === undefined) delete process.env.GEARS_WEBHOOK_URL;
  else process.env.GEARS_WEBHOOK_URL = originalWebhookUrl;
});

describe('generated story persistence platform boundary', () => {
  it('keeps initial webhook status secret-free and deterministic', () => {
    delete process.env.GEARS_WEBHOOK_URL;
    expect(buildInitialGearsWebhookStatus()).toEqual({ status: 'not_configured' });

    process.env.GEARS_WEBHOOK_URL = 'https://worker.example.test/callback?secret=do-not-leak';
    expect(buildInitialGearsWebhookStatus()).toEqual({
      status: 'pending',
      webhook_target: 'https://worker.example.test/callback',
    });
  });

  it('keeps project/story publication and notification outside the generation orchestrator', async () => {
    const source = await readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf8');
    const platformSource = await readFile(
      new URL('../platform/generated-story-persistence.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain("from '../../platform/generated-story-persistence.js'");
    expect(source).not.toContain('createProjectFromGeneratedStory(');
    expect(source).not.toContain('notifyGearsStoryReady(');
    expect(source).not.toContain('function gearsWebhookStatusFromResult');
    expect(platformSource).toContain('createProjectFromGeneratedStory(');
    expect(platformSource).toContain('notifyGearsStoryReady(');
    expect(platformSource).toContain('StoryRepositoryConflictError');
  });
});
