import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { StoryAgentGeneratedHealthReport } from '@shared/types.js';
import {
  getStoryAgentSeriesStoryRecoveryCandidates,
} from '../services/series-story-recovery-candidate-service.js';

function healthFixture(
  projectIds: string[],
): StoryAgentGeneratedHealthReport {
  return {
    schema_version: 'story-agent-generated-health/v1',
    generated_at: '2026-07-30T12:00:00.000Z',
    summary: {
      scanned_story_project_count: 0,
      scanned_series_project_count: projectIds.length,
      total_target_count: projectIds.length,
      ready_count: 0,
      planned_count: 0,
      production_gap_count: 0,
      interrupted_count: projectIds.length,
      missing_current_story_count: 0,
      missing_scene_breakdown_count: 0,
      missing_gears_segments_count: 0,
      missing_quality_count: 0,
      missing_episode_story_id_count: projectIds.length,
      series_missing_delivery_count: 0,
      series_missing_postproduction_count: 0,
      series_interrupted_count: projectIds.length,
      series_relink_candidate_count: projectIds.length,
      signoff_portfolio_interrupted_count: projectIds.length,
    },
    items: projectIds.map(projectId => ({
      scope: 'ai_comic_series_project',
      project_id: projectId,
      title: `Series ${projectId}`,
      status: 'interrupted',
      risk_score: 94,
      issue_count: 2,
      missing_contracts: [
        'generated_episode_story_refs',
        'remaining_episodes',
      ],
      evidence: [
        'contract_evidence=seedance_production,cut_assembly',
        'signoff_eligible=true',
      ],
      recommended_actions: [],
      missing_episode_story_id_count: 1,
      contract_evidence_count: 2,
      relink_candidate: true,
      signoff_eligible: true,
    })),
    notes: [],
    markdown: '# fixture\n',
  };
}

async function writeSeries(
  generatedRoot: string,
  projectId: string,
  storyId: string,
): Promise<string> {
  const projectDir = resolve(
    generatedRoot,
    'ai-comic-series-projects',
    projectId,
  );
  await mkdir(projectDir, { recursive: true });
  const projectPath = resolve(projectDir, 'project.json');
  await writeFile(projectPath, `${JSON.stringify({
    project: {
      series_project_id: projectId,
      title: `Series ${projectId}`,
      episode_count: 3,
      generated_episode_count: 1,
    },
    plan: {
      episodes: [{
        episode_no: 1,
        title: '第1集：问题出现',
      }],
    },
    generated_episode_story_ids: {
      1: storyId,
    },
    seedance_production: {
      items: [{
        source_unit_id: 'shot-1',
        status: 'ready',
        video_url: 'fixture://shot-1',
      }],
    },
    seedance_cut_assembly: {
      status: 'planned',
      concat_list_path: 'delivery/concat.txt',
    },
  }, null, 2)}\n`, 'utf8');
  return projectPath;
}

async function writeStory(
  generatedRoot: string,
  storyId: string,
): Promise<void> {
  const storyDir = resolve(generatedRoot, 'stories', 'ai_comic_drama');
  await mkdir(storyDir, { recursive: true });
  await writeFile(resolve(storyDir, `${storyId}.json`), `${JSON.stringify({
    storyId,
    title: '第1集：问题出现',
    video_type: 'ai_comic_drama',
    source_entry: '测试知识条目',
    full_text: '用于恢复候选证据的合成故事。',
  }, null, 2)}\n`, 'utf8');
}

describe('series story recovery candidate service', () => {
  it('surfaces unique legacy-suffix evidence without auto-relinking project files', async () => {
    const generatedRoot = await mkdtemp(
      resolve(tmpdir(), 'series-story-recovery-candidates-'),
    );
    const matchedProjectId = 'series-recovery-matched';
    const unmatchedProjectId = 'series-recovery-unmatched';
    const matchedProjectPath = await writeSeries(
      generatedRoot,
      matchedProjectId,
      '20260619-story-abc1',
    );
    await writeSeries(
      generatedRoot,
      unmatchedProjectId,
      '20260619-story-none',
    );
    await writeStory(generatedRoot, '20260625-story-abc1');
    const beforeProject = await readFile(matchedProjectPath, 'utf8');

    const report = await getStoryAgentSeriesStoryRecoveryCandidates({
      generatedRoot,
      healthReport: healthFixture([
        matchedProjectId,
        unmatchedProjectId,
      ]),
      now: () => new Date('2026-07-30T12:30:00.000Z'),
    });

    expect(report).toMatchObject({
      schema_version:
        'story-agent-series-story-recovery-candidate-report/v1',
      generated_at: '2026-07-30T12:30:00.000Z',
      summary: {
        active_relink_project_count: 2,
        missing_reference_count: 2,
        unique_legacy_suffix_candidate_count: 1,
        ambiguous_legacy_suffix_candidate_count: 0,
        no_candidate_count: 1,
        operator_whitelisted_count: 0,
        auto_relink_eligible_count: 0,
      },
      boundary: {
        read_only: true,
        operator_whitelist_required: true,
        automatic_relink_allowed: false,
        project_files_modified: false,
        story_files_written: false,
        publishable_delivery_credit_granted: false,
      },
    });
    expect(report.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        series_project_id: matchedProjectId,
        episode_no: 1,
        missing_story_id: '20260619-story-abc1',
        candidate_status: 'unique_legacy_suffix_candidate',
        operator_whitelist_status: 'not_whitelisted',
        automatic_relink_eligible: false,
        candidate_stories: [
          expect.objectContaining({
            story_id: '20260625-story-abc1',
            relative_path:
              'stories/ai_comic_drama/20260625-story-abc1.json',
            sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            video_type: 'ai_comic_drama',
          }),
        ],
      }),
      expect.objectContaining({
        series_project_id: unmatchedProjectId,
        candidate_status: 'no_candidate',
        candidate_stories: [],
      }),
    ]));
    expect(report.markdown).toContain('automatic_relink_allowed: false');
    expect(report.markdown).toContain('series-recovery-matched');
    expect(await readFile(matchedProjectPath, 'utf8')).toBe(beforeProject);
  });
});
