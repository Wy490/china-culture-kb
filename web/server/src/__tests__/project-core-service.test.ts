import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { StoryProjectMeta } from '@shared/types.js';
import {
  buildProjectId,
  buildVersionId,
  nextProjectUpdatedAt,
  parseProjectId,
  projectDir,
  projectMetaExpectation,
  projectVersionExpectation,
  projectVersionPath,
  projectVersionsDir,
  projectsRoot,
} from '../services/project-core-service.js';

function projectMeta(overrides: Partial<StoryProjectMeta> = {}): StoryProjectMeta {
  return {
    current_version_id: 'story-1--ai_comic_drama-v3',
    version_count: 3,
    updated_at: '2036-07-19T08:00:00.000Z',
    ...overrides,
  } as StoryProjectMeta;
}

describe('project core service', () => {
  it('keeps the project and version identifier formats stable', () => {
    const projectId = buildProjectId('story-1', 'ai_comic_drama');

    expect(projectId).toBe('story-1--ai_comic_drama');
    expect(buildVersionId(projectId, 3)).toBe('story-1--ai_comic_drama-v3');
    expect(parseProjectId(projectId)).toEqual({
      storyId: 'story-1',
      videoType: 'ai_comic_drama',
    });
  });

  it('rejects malformed or unsupported project identifiers', () => {
    expect(parseProjectId('story-1')).toBeNull();
    expect(parseProjectId('story-1--unsupported_type')).toBeNull();
  });

  it('derives repository concurrency expectations from current metadata', () => {
    const project = projectMeta();

    expect(projectVersionExpectation(project)).toEqual({
      current_version_id: project.current_version_id,
      version_count: 3,
    });
    expect(projectMetaExpectation(project)).toEqual({
      current_version_id: project.current_version_id,
      version_count: 3,
      updated_at: project.updated_at,
    });
  });

  it('always advances the project timestamp beyond the persisted value', () => {
    const project = projectMeta();

    expect(Date.parse(nextProjectUpdatedAt(project))).toBe(Date.parse(project.updated_at) + 1);
  });

  it('keeps project repository paths under the selected generated root', () => {
    const generatedRoot = resolve('/tmp', 'story-agent-generated-root');
    const projectId = 'story-1--ai_comic_drama';
    const versionId = `${projectId}-v3`;
    const expectedProjectsRoot = resolve(generatedRoot, 'projects');
    const expectedProjectDir = resolve(expectedProjectsRoot, projectId);
    const expectedVersionsDir = resolve(expectedProjectDir, 'versions');

    expect(projectsRoot(generatedRoot)).toBe(expectedProjectsRoot);
    expect(projectDir(projectId, generatedRoot)).toBe(expectedProjectDir);
    expect(projectVersionsDir(projectId, generatedRoot)).toBe(expectedVersionsDir);
    expect(projectVersionPath(projectId, versionId, generatedRoot))
      .toBe(resolve(expectedVersionsDir, `${versionId}.json`));
  });
});
