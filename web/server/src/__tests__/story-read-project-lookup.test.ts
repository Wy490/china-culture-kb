import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listProjectIds: vi.fn(),
  readMeta: vi.fn(),
  readVersion: vi.fn(),
  readStory: vi.fn(),
}));

vi.mock('../platform/story-storage.js', () => ({
  ALL_STORY_VIDEO_TYPES: ['character_story', 'legend_story'],
  createProjectRepository: () => ({
    listProjectIds: mocks.listProjectIds,
    readMeta: mocks.readMeta,
    readVersion: mocks.readVersion,
  }),
  createStoryRepository: () => ({
    read: mocks.readStory,
    list: vi.fn(async () => []),
  }),
}));

import { getStory } from '../platform/story-read-service.js';

describe('story read current-project lookup', () => {
  it('reads only canonical story project candidates instead of scanning every project', async () => {
    const storyId = '20260822-story-indexed';
    const projectId = `${storyId}--character_story`;
    const versionId = `${projectId}-v2`;
    mocks.listProjectIds.mockResolvedValue([
      ...Array.from({ length: 100 }, (_, index) => `unrelated-${index}--character_story`),
      projectId,
    ]);
    mocks.readMeta.mockImplementation(async (candidateId: string) => candidateId === projectId
      ? {
          project_id: projectId,
          current_story_id: storyId,
          current_version_id: versionId,
          updated_at: '2026-08-22T10:00:00.000Z',
        }
      : null);
    mocks.readVersion.mockImplementation(async (candidateId: string, candidateVersionId: string) => (
      candidateId === projectId && candidateVersionId === versionId
        ? {
            project_id: projectId,
            version_id: versionId,
            created_at: '2026-08-22T10:00:00.000Z',
            story: {
              storyId,
              title: '项目当前版本',
              generation_type: 'character_story',
              video_type: 'character_story',
              presentation_style: 'cinematic',
              source_entry: '测试',
              logline: '测试',
              credibility_note: '测试',
              scene_breakdown: [],
              gears_segments: [],
            },
          }
        : null
    ));
    mocks.readStory.mockResolvedValue(null);

    const result = await getStory(storyId);

    expect(result.ok).toBe(true);
    expect(result.data?.title).toBe('项目当前版本');
    expect(mocks.listProjectIds).not.toHaveBeenCalled();
    expect(mocks.readMeta).toHaveBeenCalledTimes(2);
    expect(mocks.readMeta).toHaveBeenCalledWith(projectId);
    expect(mocks.readVersion).toHaveBeenCalledTimes(1);
    expect(mocks.readStory).not.toHaveBeenCalled();
  });
});
