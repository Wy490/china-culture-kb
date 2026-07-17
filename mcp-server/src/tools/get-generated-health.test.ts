import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getStoryAgentGeneratedHealth } from './get-generated-health.js';

let tmpRoot = '';
const previousKbRoot = process.env.KB_ROOT;
const previousGeneratedRoot = process.env.WEB_GENERATED_ROOT;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-story-agent-generated-health-'));
  process.env.KB_ROOT = path.join(tmpRoot, 'data');
  process.env.WEB_GENERATED_ROOT = path.join(tmpRoot, 'web-generated');
  fs.mkdirSync(path.join(process.env.KB_ROOT, 'provinces'), { recursive: true });
});

afterEach(() => {
  if (previousKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = previousKbRoot;
  if (previousGeneratedRoot === undefined) delete process.env.WEB_GENERATED_ROOT;
  else process.env.WEB_GENERATED_ROOT = previousGeneratedRoot;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('getStoryAgentGeneratedHealth', () => {
  it('does not treat a concat plan without a final-delivery manifest as publishable', async () => {
    const generatedRoot = process.env.WEB_GENERATED_ROOT!;
    const storyId = '20260718-story-manifest-gap';
    const storyDir = path.join(generatedRoot, 'stories', 'ai_comic_drama');
    const seriesDir = path.join(generatedRoot, 'ai-comic-series-projects', 'manifest-gap-series');
    fs.mkdirSync(storyDir, { recursive: true });
    fs.mkdirSync(seriesDir, { recursive: true });
    fs.writeFileSync(path.join(storyDir, `${storyId}.json`), JSON.stringify({ storyId }));
    fs.writeFileSync(path.join(seriesDir, 'project.json'), JSON.stringify({
      project: {
        series_project_id: 'manifest-gap-series',
        title: 'Manifest Gap Series',
        episode_count: 1,
        generated_episode_count: 1,
        updated_at: '2026-07-18T01:00:00.000Z',
      },
      generated_episode_story_ids: { '1': storyId },
      seedance_production: {
        items: [{
          shot_id: 'shot-1',
          status: 'ready',
          video_url: '/generated/manifest-gap/shot-1.mp4',
          thumbnail: { status: 'ready', output_path: '/generated/manifest-gap/thumb-1.jpg' },
        }],
      },
      seedance_cut_assembly: {
        status: 'ready',
        output_path: '/generated/manifest-gap/cut.mp4',
        concat_list_path: '/generated/manifest-gap/cut.concat.txt',
      },
      seedance_subtitle_render: {
        status: 'ready',
        output_path: '/generated/manifest-gap/subtitled.mp4',
        srt_path: '/generated/manifest-gap/subtitles.srt',
      },
      seedance_final_delivery: {
        status: 'planned',
        dry_run: true,
        output_path: '/generated/manifest-gap/final.mp4',
        concat_list_path: '/generated/manifest-gap/final.concat.txt',
      },
      gears_job_ledger: { jobs: [{ gears_job_id: 'job-1', status: 'ready' }] },
    }));

    const report = await getStoryAgentGeneratedHealth({ limit: 20 });
    const item = report.items.find(candidate => candidate.project_id === 'manifest-gap-series');

    expect(item).toMatchObject({
      status: 'production_gap',
      missing_contracts: expect.arrayContaining(['final_delivery_manifest']),
      final_delivery_ready: false,
      final_delivery_manifest_ready: false,
      final_delivery_manifest_missing: true,
      final_delivery_dry_run: true,
    });
    expect(report.summary.series_missing_final_delivery_manifest_count).toBe(1);
    expect(report.markdown).toContain('series_missing_final_delivery_manifest: 1');
  });
});
