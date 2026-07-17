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
    source_domain: 'second_domain',
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
    expect(result!.project.source_domain).toBe('second_domain');
    expect(result!.project.creation_contract?.truth_mode).toBe('fictional_original');
    expect(result!.project.material_sufficiency?.score).toBe(88);
    expect(result!.current_story.creation_contract).toEqual(expect.objectContaining({ creation_use_case: 'original_ai_comic' }));
    expect(result!.current_story.title).toBe('测试故事');
    expect(result!.current_story.sourceDomain).toBe('second_domain');
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
    expect(result!.version_snapshots![0].story.sourceDomain).toBe('second_domain');
    expect(result!.exports).toEqual(['20260615-story.json']);
  });

  it('hydrates legacy missing domains in memory without rewriting project files', async () => {
    const projectRoot = path.join(tmpDir, 'web', 'generated', 'projects', projectId);
    const projectPath = path.join(projectRoot, 'project.json');
    const versionPath = path.join(projectRoot, 'versions', `${projectId}-v1.json`);
    const project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
    delete project.source_domain;
    fs.writeFileSync(projectPath, JSON.stringify(project, null, 2));

    const result = await getProjectContext({ project_id: projectId, include_versions: true });

    expect(result!.project.source_domain).toBe('china_culture');
    expect(result!.current_story.sourceDomain).toBe('china_culture');
    expect(result!.version_snapshots![0].story.sourceDomain).toBe('china_culture');
    expect(JSON.parse(fs.readFileSync(projectPath, 'utf-8')).source_domain).toBeUndefined();
    expect(JSON.parse(fs.readFileSync(versionPath, 'utf-8')).story.sourceDomain).toBeUndefined();
  });

  it('fails closed when a version snapshot conflicts with the project source domain', async () => {
    const versionPath = path.join(
      tmpDir,
      'web',
      'generated',
      'projects',
      projectId,
      'versions',
      `${projectId}-v1.json`,
    );
    const snapshot = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
    snapshot.story.sourceDomain = 'china_culture';
    fs.writeFileSync(versionPath, JSON.stringify(snapshot, null, 2));

    await expect(getProjectContext({ project_id: projectId, include_versions: true }))
      .rejects.toThrow(
        `版本快照 ${projectId}-v1 的 Story sourceDomain（china_culture）与项目 source_domain（second_domain）不一致`,
      );
  });

  it('fails closed instead of falling back to an old snapshot when current_version_id is missing', async () => {
    const projectPath = path.join(
      tmpDir,
      'web',
      'generated',
      'projects',
      projectId,
      'project.json',
    );
    const project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
    project.current_version_id = `${projectId}-v9`;
    fs.writeFileSync(projectPath, JSON.stringify(project, null, 2));

    await expect(getProjectContext({ project_id: projectId }))
      .rejects.toThrow(`项目当前版本快照缺失：${projectId}-v9`);
  });

  it('fails closed when a version snapshot belongs to another project', async () => {
    const versionPath = path.join(
      tmpDir,
      'web',
      'generated',
      'projects',
      projectId,
      'versions',
      `${projectId}-v1.json`,
    );
    const snapshot = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
    snapshot.project_id = 'another-project--ai_comic_drama';
    fs.writeFileSync(versionPath, JSON.stringify(snapshot, null, 2));

    await expect(getProjectContext({ project_id: projectId }))
      .rejects.toThrow(`版本快照 ${projectId}-v1.json 的 project_id（another-project--ai_comic_drama）与项目（${projectId}）不一致`);
  });

  it('fails closed when a snapshot version_id does not match its file name', async () => {
    const versionPath = path.join(
      tmpDir,
      'web',
      'generated',
      'projects',
      projectId,
      'versions',
      `${projectId}-v1.json`,
    );
    const snapshot = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
    snapshot.version_id = `${projectId}-v2`;
    fs.writeFileSync(versionPath, JSON.stringify(snapshot, null, 2));

    await expect(getProjectContext({ project_id: projectId }))
      .rejects.toThrow(`版本快照 ${projectId}-v1.json 的 version_id（${projectId}-v2）与文件名不一致`);
  });

  it('fails closed when two snapshot files declare the same version_id', async () => {
    const versionsRoot = path.join(tmpDir, 'web', 'generated', 'projects', projectId, 'versions');
    const v1Path = path.join(versionsRoot, `${projectId}-v1.json`);
    const duplicate = JSON.parse(fs.readFileSync(v1Path, 'utf-8'));
    fs.writeFileSync(path.join(versionsRoot, `${projectId}-v2.json`), JSON.stringify(duplicate, null, 2));

    await expect(getProjectContext({ project_id: projectId }))
      .rejects.toThrow(`项目存在重复 version_id：${projectId}-v1`);
  });

  it('fails closed on an invalid snapshot file name', async () => {
    const versionsRoot = path.join(tmpDir, 'web', 'generated', 'projects', projectId, 'versions');
    fs.writeFileSync(path.join(versionsRoot, 'foreign.json'), '{}');

    await expect(getProjectContext({ project_id: projectId }))
      .rejects.toThrow('非法版本快照文件名：foreign.json');
  });

  it('fails closed when a snapshot path is a symbolic link', async () => {
    const versionsRoot = path.join(tmpDir, 'web', 'generated', 'projects', projectId, 'versions');
    fs.symlinkSync(
      path.join(versionsRoot, `${projectId}-v1.json`),
      path.join(versionsRoot, `${projectId}-v2.json`),
    );

    await expect(getProjectContext({ project_id: projectId }))
      .rejects.toThrow(`版本快照不是普通文件：${projectId}-v2.json`);
  });

  it('returns null for missing project', async () => {
    const result = await getProjectContext({ project_id: 'missing-project' });
    expect(result).toBeNull();
  });

  it('rejects unsafe project ids', async () => {
    await expect(getProjectContext({ project_id: '../project' })).rejects.toThrow('非法项目 ID');
  });
});
