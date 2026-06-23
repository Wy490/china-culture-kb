import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getProjectContext } from '../src/tools/get-project-context.js';

const tmpDir = path.join(os.tmpdir(), 'kb-project-context-test-' + Date.now());
const dataRoot = path.join(tmpDir, 'data');
const projectId = '20260615-story-test--ai_comic_drama';

const materialSufficiency = {
  schema_version: 'material-sufficiency/v1',
  stage: 'script_ready',
  score: 88,
  can_generate: true,
  can_generate_with_risks: false,
  blocked: false,
  missing_items: [],
  optional_items: [],
  token_risk: 'low',
  recommended_next_questions: [],
};

const creationContract = {
  schema_version: 'creation-contract/v1',
  creation_use_case: 'original_ai_comic',
  truth_mode: 'fictional_original',
  video_type: 'ai_comic_drama',
  presentation_style: 'ai_comic',
  story_structure: 'single_event_drama',
  narrative_pattern_ids: [],
  allowed_fiction: ['可原创人物、事件、冲突和世界观。'],
  must_verify: ['不得冒充真实历史、真实机构或真实人物事实。'],
  forbidden_moves: ['把原创设定写成已发生史实。'],
  required_disclaimers: ['必要时标注为原创虚构或架空创作。'],
  material_sufficiency: materialSufficiency,
  delivery_expectation: ['前期剧本与生产指挥材料。'],
};

beforeEach(() => {
  process.env.KB_ROOT = dataRoot;
  fs.mkdirSync(path.join(dataRoot, 'provinces'), { recursive: true });
  const projectRoot = path.join(tmpDir, 'web', 'generated', 'projects', projectId);
  fs.mkdirSync(path.join(projectRoot, 'versions'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'exports'), { recursive: true });

  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({
    project_id: projectId,
    current_story_id: '20260615-story-test',
    title: '测试故事',
    source_domain: 'china_culture',
    source_entry: '周敦颐——理学开山鼻祖',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    story_structure: 'single_event_drama',
    creation_use_case: 'original_ai_comic',
    truth_mode: 'fictional_original',
    material_sufficiency: materialSufficiency,
    creation_contract: creationContract,
    status: 'draft',
    created_at: '2026-06-15T01:00:00.000Z',
    updated_at: '2026-06-15T01:00:00.000Z',
    current_version_id: `${projectId}-v1`,
    version_count: 1,
    scene_count: 1,
    has_gears_segments: true,
    credibility_note: '测试可信度说明',
    logline: '测试梗概',
    quality_passed: true,
    genre_score: 96,
    quality_issue_count: 0,
  }, null, 2));

  fs.writeFileSync(path.join(projectRoot, 'versions', `${projectId}-v1.json`), JSON.stringify({
    project_id: projectId,
    version_id: `${projectId}-v1`,
    created_at: '2026-06-15T01:00:00.000Z',
    change_type: 'initial_generation',
    scene_ids_changed: [],
    quality_report: {
      passed: true,
      genre_score: 96,
      issues: [],
    },
    story: {
      storyId: '20260615-story-test',
      title: '测试故事',
      full_text: '这是一个测试故事。',
      creation_use_case: 'original_ai_comic',
      truth_mode: 'fictional_original',
      material_sufficiency: materialSufficiency,
      creation_contract: creationContract,
      scene_breakdown: [{ scene_id: 1, title: '开场' }],
      gears_segments: [{ segment_id: 1, script_text: '开场文本' }],
    },
  }, null, 2));

  fs.writeFileSync(path.join(projectRoot, 'exports', '20260615-story.json'), '{}');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.KB_ROOT;
});

describe('kb_get_project_context', () => {
  it('returns project metadata, current story, and version summaries', async () => {
    const result = await getProjectContext({ project_id: projectId });

    expect(result).not.toBeNull();
    expect(result!.project.project_id).toBe(projectId);
    expect(result!.project.creation_contract?.truth_mode).toBe('fictional_original');
    expect(result!.project.material_sufficiency?.score).toBe(88);
    expect(result!.current_story.creation_contract).toEqual(expect.objectContaining({ creation_use_case: 'original_ai_comic' }));
    expect(result!.current_story.title).toBe('测试故事');
    expect(result!.versions).toHaveLength(1);
    expect(result!.versions[0].quality_passed).toBe(true);
    expect(result!.version_snapshots).toBeUndefined();
    expect(result!.exports).toBeUndefined();
  });

  it('optionally includes full version snapshots and export list', async () => {
    const result = await getProjectContext({
      project_id: projectId,
      include_versions: true,
      include_exports: true,
    });

    expect(result!.version_snapshots).toHaveLength(1);
    expect(result!.exports).toEqual(['20260615-story.json']);
  });

  it('returns null for missing project', async () => {
    const result = await getProjectContext({ project_id: 'missing-project' });
    expect(result).toBeNull();
  });

  it('rejects unsafe project ids', async () => {
    await expect(getProjectContext({ project_id: '../project' })).rejects.toThrow('非法项目 ID');
  });
});
