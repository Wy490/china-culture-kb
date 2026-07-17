import { describe, expect, it } from 'vitest';
import type { StoryGenerateResult } from '@shared/types.js';
import {
  getStoryDomainRevisionEditBoundary,
  getStoryDomainSupplementEditBoundary,
} from '../platform/story-domain-edit-boundary.js';

function story(sourceDomain: string): StoryGenerateResult {
  return {
    sourceDomain,
    source_entry: sourceDomain === 'original_fiction' ? '用户原创素材' : '周敦颐——理学开山鼻祖',
  } as StoryGenerateResult;
}

describe('story domain edit boundary', () => {
  it('allows only an append-only project version for revision while every external write remains false', async () => {
    const boundary = await getStoryDomainRevisionEditBoundary(story('china_culture'));

    expect(boundary.guidance.writer_role).toContain('中国传统文化');
    expect(boundary.persistence).toEqual({
      schema_version: 'story-domain-edit-persistence/v1',
      domain_id: 'china_culture',
      operation: 'story_revision',
      project_version_append_allowed: true,
      project_current_state_update_allowed: false,
      generated_story_snapshot_sync_allowed: false,
      domain_source_write_allowed: false,
      knowledge_writeback_performed: false,
      external_delivery_triggered: false,
      migration_action_performed: false,
      real_credit_granted: false,
    });
  });

  it('keeps original fiction supplements project-local and prevents a formal writeback draft contract', async () => {
    const boundary = await getStoryDomainSupplementEditBoundary(story('original_fiction'));

    expect(boundary.guidance).toMatchObject({
      candidate_kind: 'project_material_candidate',
      candidate_heading: '项目素材候选稿',
    });
    expect(boundary.guidance.writeback_draft_heading).toBeUndefined();
    expect(boundary.persistence).toMatchObject({
      schema_version: 'story-domain-edit-persistence/v1',
      domain_id: 'original_fiction',
      operation: 'story_supplement',
      project_version_append_allowed: false,
      project_current_state_update_allowed: true,
      generated_story_snapshot_sync_allowed: true,
      domain_source_write_allowed: false,
      knowledge_writeback_performed: false,
      external_delivery_triggered: false,
      migration_action_performed: false,
      real_credit_granted: false,
    });
  });
});
