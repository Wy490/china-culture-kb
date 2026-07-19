import type {
  GearsWebhookStatus,
  StoryGenerateResult,
} from '@shared/types.js';
import type { ProductResourceOwnership } from '@shared/product-access.js';
import { StoryRepositoryConflictError } from '../repositories/story-repository.js';
import {
  createProjectFromGeneratedStory,
  updateProjectCurrentGearsWebhookStatus,
} from '../services/project-service.js';
import { notifyGearsStoryReady } from '../services/gears-webhook-service.js';
import type { GearsWebhookResult } from '../services/gears-webhook-service.js';
import { rebuildDerivedStoryState } from '../services/derived-story-state-service.js';

interface GeneratedStoryWriter {
  create(story: StoryGenerateResult): Promise<'created' | 'exists'>;
}

function safeWebhookTarget(webhookUrl: string): string {
  try {
    const url = new URL(webhookUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return 'configured endpoint';
  }
}

export function buildInitialGearsWebhookStatus(): GearsWebhookStatus {
  const webhookUrl = process.env.GEARS_WEBHOOK_URL;
  if (!webhookUrl) return { status: 'not_configured' };
  return {
    status: 'pending',
    webhook_target: safeWebhookTarget(webhookUrl),
  };
}

function gearsWebhookStatusFromResult(result: GearsWebhookResult): GearsWebhookStatus {
  if (result.status === 'skipped') {
    return {
      status: 'not_configured',
      last_attempt_at: result.attemptedAt,
    };
  }
  if (result.status === 'sent') {
    return {
      status: 'sent',
      webhook_target: safeWebhookTarget(result.webhookUrl),
      attempts: result.attempts,
      last_attempt_at: result.attemptedAt,
      last_success_at: result.attemptedAt,
    };
  }
  return {
    status: 'failed',
    webhook_target: safeWebhookTarget(result.webhookUrl),
    attempts: result.attempts,
    last_attempt_at: result.attemptedAt,
    last_error_at: result.attemptedAt,
    last_error: result.error,
  };
}

function stripInternalFields(data: StoryGenerateResult): StoryGenerateResult {
  const cleaned = { ...data } as Record<string, unknown>;
  delete cleaned._request_meta;
  return cleaned as unknown as StoryGenerateResult;
}

export async function persistGeneratedStoryAndNotifyGears(input: {
  storyData: StoryGenerateResult;
  createdAt: string;
  accessControl?: ProductResourceOwnership;
  repository: GeneratedStoryWriter;
  generatedRoot: string;
}): Promise<StoryGenerateResult> {
  const rebuiltStory = await rebuildDerivedStoryState(input.storyData, {
    // Initial generation already evaluated the exact request material. Some
    // user-supplied/ephemeral entries do not exist in the durable Domain Pack,
    // so a registry lookup here would replace a valid report with "not found".
    revalidateDomainSafety: false,
  });
  const storyWithProject = await createProjectFromGeneratedStory(
    rebuiltStory,
    input.createdAt,
    input.accessControl,
  );
  if (await input.repository.create(storyWithProject) === 'exists') {
    throw new StoryRepositoryConflictError(`Story "${storyWithProject.storyId}" already exists`);
  }

  const apiStory = stripInternalFields(storyWithProject);
  const webhookResult = notifyGearsStoryReady(apiStory, { generatedRoot: input.generatedRoot })
    .then(result => updateProjectCurrentGearsWebhookStatus(
      apiStory.project_id,
      apiStory.storyId,
      gearsWebhookStatusFromResult(result),
      input.generatedRoot,
    ))
    .catch(() => undefined);
  if (process.env.GEARS_WEBHOOK_URL?.trim()) {
    void webhookResult;
  } else {
    await webhookResult;
  }

  return apiStory;
}
